# Nano Banana Source Notes

Exact source set used for `references\image-generation-api.md`:

1. [Build with Nano Banana (Google blog)](https://blog.google/innovation-and-ai/technology/developers-tools/build-with-nano-banana-2/)
2. [Get Started Nano Banana (Colab notebook)](https://colab.research.google.com/github/google-gemini/cookbook/blob/main/quickstarts/Get_Started_Nano_Banana.ipynb#nano-banana-pro)
3. [Gemini API image-generation docs](https://ai.google.dev/gemini-api/docs/image-generation)

---

## Extracted highlights by source

### 1) Build with Nano Banana (blog)

- Launch framing for Nano Banana (`gemini-3.1-flash-image-preview`) with speed/fidelity focus.
- Calls out:
  - improved world knowledge with search-grounded visuals
  - advanced text rendering + in-image localization
  - new aspect ratios (1:4, 4:1, 1:8, 8:1)
  - new 512px resolution tier
  - stronger instruction following
  - configurable thinking levels
- Includes ecosystem links (AI Studio, Gemini API, Vertex AI, Firebase, cookbook).

### 2) Get Started Nano Banana (Colab)

- Practical quickstart covering model choice, billing requirement, and setup flow.
- Emphasizes:
  - character consistency
  - intelligent editing/inpainting-style workflows
  - image composition/merging
  - multimodal reasoning over text+image
- Describes model positioning across:
  - `gemini-2.5-flash-image`
  - `gemini-3.1-flash-image-preview`
  - `gemini-3-pro-image-preview`

### 3) Gemini API image-generation docs

- Canonical API reference and examples for:
  - text-to-image
  - text+image editing
  - multi-turn image editing (chat)
  - grounding with Google Search and Google Image Search
  - high-resolution outputs, aspect ratios, and model-specific image-size behavior
  - thinking process, thinking levels, thought signatures
  - prompt strategy catalogs for generation/editing
  - limits, optional configuration, model selection, and next steps

---

## Cross-reference pointers

- Main implementation-oriented reference: [`image-generation-api.md`](.\image-generation-api.md)
- Canonical model docs:
  - [3.1 Flash Image](https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-image-preview)
  - [3 Pro Image](https://ai.google.dev/gemini-api/docs/models/gemini-3-pro-image-preview)
  - [2.5 Flash Image](https://ai.google.dev/gemini-api/docs/models/gemini-2.5-flash-image)

