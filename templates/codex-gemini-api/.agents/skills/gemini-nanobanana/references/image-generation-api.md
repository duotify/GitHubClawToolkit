# Nano Banana Image Generation API Reference (Node.js-first)

Consolidated reference for SKILL.md, based on these exact sources:

- [Build with Nano Banana (Google blog)](https://blog.google/innovation-and-ai/technology/developers-tools/build-with-nano-banana-2/)
- [Get Started Nano Banana notebook (Colab)](https://colab.research.google.com/github/google-gemini/cookbook/blob/main/quickstarts/Get_Started_Nano_Banana.ipynb#nano-banana-pro)
- [Gemini API image-generation docs](https://ai.google.dev/gemini-api/docs/image-generation)

---

## Table of contents

1. [Model map and defaults](#1-model-map-and-defaults)
2. [Node.js SDK baseline](#2-nodejs-sdk-baseline)
3. [Core workflows](#3-core-workflows)
4. [Grounding (Web Search + Image Search)](#4-grounding-web-search--image-search)
5. [Image size, aspect ratio, and payload rules](#5-image-size-aspect-ratio-and-payload-rules)
6. [Thinking, thoughts, and thought signatures](#6-thinking-thoughts-and-thought-signatures)
7. [Multi-image composition and reference limits](#7-multi-image-composition-and-reference-limits)
8. [Prompt strategy coverage (generation + editing)](#8-prompt-strategy-coverage-generation--editing)
9. [Operational limits, policies, and production notes](#9-operational-limits-policies-and-production-notes)
10. [Model-selection guidance](#10-model-selection-guidance)
11. [Link index](#11-link-index)

---

## 1) Model map and defaults

`Nano Banana` = Gemini native image generation capability.

| Public name | Model ID | Best use | Key points |
|---|---|---|---|
| Nano Banana | `gemini-3.1-flash-image-preview` | Default choice for most apps | Best speed/quality/cost balance, supports Search Grounding, Thinking, and 512px tier |
| Nano Banana Pro | `gemini-3-pro-image-preview` | Professional asset production | Strong instruction following + text rendering + 4K output |
| Nano Banana | `gemini-2.5-flash-image` | High-volume low-latency tasks | Fast, efficient, simpler size profile (no 512 tier) |

Notes from sources:

- Blog launch calls out improved world knowledge, better text rendering/localization, new extreme aspect ratios (1:4, 4:1, 1:8, 8:1), and configurable thinking levels for Nano Banana.
- Colab quickstart describes practical strengths: character consistency, intelligent editing (inpainting/outpainting style), composition, multimodal reasoning.
- Docs confirm all generated images include [SynthID watermarking](https://ai.google.dev/gemini-api/docs/image-generation).

---

## 2) Node.js SDK baseline

```js
import { GoogleGenAI } from "@google/genai";
import fs from "node:fs";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export function saveFirstImage(response, outputPath) {
  const parts = response?.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((p) => p.inlineData?.data);
  if (!imagePart) throw new Error("No image returned");
  fs.writeFileSync(outputPath, Buffer.from(imagePart.inlineData.data, "base64"));
}
```

Install/auth references:

- [Gemini API libraries](https://ai.google.dev/gemini-api/docs/libraries)
- [API key setup](https://ai.google.dev/gemini-api/docs/api-key)
- [Pricing](https://ai.google.dev/gemini-api/docs/pricing)

---

## 3) Core workflows

### A. Text-to-image

```js
const response = await ai.models.generateContent({
  model: "gemini-3.1-flash-image-preview",
  contents: "A cinematic product photo of matte-black headphones on stone, studio lighting.",
  config: {
    responseModalities: ["TEXT", "IMAGE"],
    imageConfig: { aspectRatio: "1:1", imageSize: "2K" },
  },
});
saveFirstImage(response, "headphones.png");
```

### B. Text-and-image-to-image editing

```js
const base64 = fs.readFileSync("living-room.png").toString("base64");
const response = await ai.models.generateContent({
  model: "gemini-3.1-flash-image-preview",
  contents: [
    { inlineData: { mimeType: "image/png", data: base64 } },
    { text: "Change only the blue sofa to brown leather; keep all else unchanged." },
  ],
});
saveFirstImage(response, "living-room-edited.png");
```

### C. Multi-turn iterative editing (recommended workflow)

```js
const chat = ai.chats.create({
  model: "gemini-3.1-flash-image-preview",
  config: { responseModalities: ["TEXT", "IMAGE"] },
});

let r1 = await chat.sendMessage({
  message: "Create an infographic that explains photosynthesis for 4th graders.",
});
saveFirstImage(r1, "infographic-en.png");

let r2 = await chat.sendMessage({
  message: "Translate the infographic to Spanish. Keep layout and graphics.",
  config: { imageConfig: { aspectRatio: "16:9", imageSize: "2K" } },
});
saveFirstImage(r2, "infographic-es.png");
```

---

## 4) Grounding (Web Search + Image Search)

### A. Grounding with Google Search

Use for up-to-date/weather/news-style image outputs.

```js
const response = await ai.models.generateContent({
  model: "gemini-3.1-flash-image-preview",
  contents: "Visualize the 5-day weather forecast for San Francisco as a clean chart.",
  config: {
    responseModalities: ["TEXT", "IMAGE"],
    imageConfig: { aspectRatio: "16:9", imageSize: "2K" },
    tools: [{ googleSearch: {} }],
  },
});
```

### B. Grounding with Google Image Search (3.1 Flash)

```js
const response = await ai.models.generateContent({
  model: "gemini-3.1-flash-image-preview",
  contents: "Create a detailed painting of a Timareta butterfly on a flower.",
  config: {
    responseModalities: ["IMAGE"],
    tools: [{
      googleSearch: { searchTypes: { webSearch: {}, imageSearch: {} } },
    }],
  },
});
```

Display/compliance requirements from docs:

- Must provide **source attribution link** to the containing webpage (not only direct image URL).
- If showing source images, user must have a **single-click path** to containing source page.

Grounding metadata to consume:

- `searchEntryPoint`
- `groundingChunks` (`uri`, `imageUri`)
- `groundingSupports`
- `imageSearchQueries`

---

## 5) Image size, aspect ratio, and payload rules

### Critical payload rule for this skill

> **For 512px outputs, send resolution as string `"512"` in payload** (not number `512`), e.g. `imageConfig.imageSize = "512"`.

This is the skill-facing payload convention; it maps to the docs’ 512px/0.5K tier for 3.1 Flash Image.

### Node config shape

```js
const response = await ai.models.generateContent({
  model: "gemini-3.1-flash-image-preview",
  contents: "A modern weather dashboard poster.",
  config: {
    responseModalities: ["IMAGE"], // image-only response
    imageConfig: {
      aspectRatio: "16:9",
      imageSize: "512", // required as string for 512px in this skill
    },
  },
});
```

### Supported sizes (summary)

- **3.1 Flash Image:** 512px tier + `1K`, `2K`, `4K`
- **3 Pro Image:** `1K`, `2K`, `4K`
- **2.5 Flash Image:** fixed profile (1024-class), no 512 tier

### Aspect ratios

- **3.1 Flash Image:** `1:1`, `1:4`, `1:8`, `2:3`, `3:2`, `3:4`, `4:1`, `4:3`, `4:5`, `5:4`, `8:1`, `9:16`, `16:9`, `21:9`
- **3 Pro Image:** `1:1`, `2:3`, `3:2`, `3:4`, `4:3`, `4:5`, `5:4`, `9:16`, `16:9`, `21:9`
- **2.5 Flash Image:** `1:1`, `2:3`, `3:2`, `3:4`, `4:3`, `4:5`, `5:4`, `9:16`, `16:9`, `21:9`

Docs note: `1K/2K/4K` use uppercase `K`.

---

## 6) Thinking, thoughts, and thought signatures

From image-generation docs:

- Gemini 3 image models run with a default thinking process.
- 3.1 Flash supports `thinkingLevel` (`minimal` default, `high` optional).
- `includeThoughts` controls whether thought content is returned; thinking still occurs.
- Thinking tokens are billed even when `includeThoughts` is `false`.
- The thinking flow can create interim composition images before final render.

```js
const response = await ai.models.generateContent({
  model: "gemini-3.1-flash-image-preview",
  contents: "A futuristic city built inside a floating glass bottle.",
  config: {
    responseModalities: ["IMAGE"],
    thinkingConfig: {
      thinkingLevel: "High",
      includeThoughts: true,
    },
  },
});
```

Thought signature handling:

- Pass returned `thought_signature` values forward exactly in multi-turn history when present.
- Images in thought parts do not carry signatures; output image parts do.

---

## 7) Multi-image composition and reference limits

- Gemini 3 image models support up to **14 reference images** in total composition workflows.
- Docs limitations section additionally calls out practical caps for 3.1 Flash:
  - character resemblance up to 4 characters
  - high-fidelity preservation up to 10 objects
- 2.5 Flash Image works best with up to 3 input images.

Node pattern:

```js
const files = ["a.png", "b.png", "c.png"].map((p) =>
  fs.readFileSync(p).toString("base64"),
);

const response = await ai.models.generateContent({
  model: "gemini-3.1-flash-image-preview",
  contents: [
    { inlineData: { mimeType: "image/png", data: files[0] } },
    { inlineData: { mimeType: "image/png", data: files[1] } },
    { inlineData: { mimeType: "image/png", data: files[2] } },
    { text: "Combine these into one polished ecommerce hero image." },
  ],
});
```

---

## 8) Prompt strategy coverage (generation + editing)

The docs include all of the following major strategy families:

### Generation strategy families

1. Photorealistic scenes
2. Stylized illustrations/stickers
3. Accurate text in images
4. Product mockups/commercial photography
5. Minimalist/negative-space design
6. Sequential art/storyboard
7. Grounded real-time graphics via Google Search

### Editing strategy families

1. Add/remove elements
2. Inpainting (semantic masking)
3. Style transfer
4. Advanced composition with multiple images
5. High-fidelity detail preservation
6. Bring rough sketch to finished output
7. Character consistency (multi-angle/360-style iteration)

Best-practice principles repeatedly emphasized:

- Be hyper-specific.
- Provide context/intent.
- Iterate conversationally.
- Break complex asks into steps.
- Use positive semantic constraints.
- Use camera/composition language.

---

## 9) Operational limits, policies, and production notes

- Gemini supports interleaved modes beyond plain text-to-image (text+images in, text+images out).
- Image generation does not support audio/video inputs.
- Exact count of returned images may not always match requested count.
- Language support is best in documented set (EN + major global locales).
- Must have rights for uploaded images; policy compliance is required.
- All generated images include SynthID watermark.

Production notes from sources:

- Batch mode is available for large jobs (higher limits, up to 24h turnaround).
- Blog highlights production deployment across AI Studio/API and ecosystem integrations.

---

## 10) Model-selection guidance

- Start with **3.1 Flash Image (Nano Banana)** for best overall balance.
- Use **3 Pro Image (Nano Banana Pro)** for high-fidelity professional assets and difficult instructions.
- Use **2.5 Flash Image** for speed-sensitive high-volume flows.
- Consider **Imagen** when you specifically need Imagen-family behavior/quality profile.

---

## 11) Link index

### Primary sources

- [Build with Nano Banana (Google blog)](https://blog.google/innovation-and-ai/technology/developers-tools/build-with-nano-banana-2/)
- [Get Started Nano Banana notebook (Colab)](https://colab.research.google.com/github/google-gemini/cookbook/blob/main/quickstarts/Get_Started_Nano_Banana.ipynb#nano-banana-pro)
- [Image generation docs (Gemini API)](https://ai.google.dev/gemini-api/docs/image-generation)

### Core docs

- [Gemini 3.1 Flash Image model page](https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-image-preview)
- [Gemini 3 Pro Image model page](https://ai.google.dev/gemini-api/docs/models/gemini-3-pro-image-preview)
- [Gemini 2.5 Flash Image model page](https://ai.google.dev/gemini-api/docs/models/gemini-2.5-flash-image)
- [Google Search tool](https://ai.google.dev/gemini-api/docs/google-search)
- [Batch API](https://ai.google.dev/gemini-api/docs/batch-api)
- [Batch API image generation section](https://ai.google.dev/gemini-api/docs/batch-api#image-generation)
- [Rate limits](https://ai.google.dev/gemini-api/docs/rate-limits)
- [Thinking guide](https://ai.google.dev/gemini-api/docs/thinking)
- [Thought signatures](https://ai.google.dev/gemini-api/docs/thought-signatures)
- [Image understanding input guidance](https://ai.google.dev/gemini-api/docs/image-understanding)
- [Pricing](https://ai.google.dev/gemini-api/docs/pricing)
- [Imagen docs](https://ai.google.dev/gemini-api/docs/imagen)
- [Video (Veo) docs](https://ai.google.dev/gemini-api/docs/video)
- [Gemini models overview](https://ai.google.dev/gemini-api/docs/models)

### Helpful in-page anchors on image-generation docs

- [Grounding with Google Search](https://ai.google.dev/gemini-api/docs/image-generation#use-with-grounding)
- [Grounding with Google Image Search](https://ai.google.dev/gemini-api/docs/image-generation#image-search)
- [Aspect ratios and image size](https://ai.google.dev/gemini-api/docs/image-generation#aspect_ratios_and_image_size)
- [Thinking process](https://ai.google.dev/gemini-api/docs/image-generation#thinking-process)

