---
name: gemini-nanobanana
description: Use this skill when users ask to generate, edit, or compose images with Nano Banana (Gemini image models), including text-to-image, image editing, multi-image composition, grounding, and output sizing/saving controls.
---

## Do this first
- Use a Node.js wrapper (`@google/genai`) as the primary flow (multi-turn edits, grounding, advanced `generationConfig`).
- Use `scripts/gemini-nanobanana-cli.js` for quick single-turn generation/editing runs.
- Do **not** teach raw `curl`; keep guidance in JS CLI/wrapper form.

## Enforce these defaults
- API key source: `NANOBANANA_GEMINI_API_KEY` with fallback `GEMINI_API_KEY`.
- Default model: `gemini-3.1-flash-image-preview` (allow env override via `NANOBANANA_MODEL`).
- Reference images: support up to **14** total.
- Thinking strength: configurable (`minimal|low|medium|high`), default **High**.
- Aspect ratio: default **Auto**.
- Resolution: default **1K**.
- Output mode: default **Images only**.
- Google Search grounding tool: default **Disabled**; enable with `--google-search` when needed.
- Output directory: default `nanobanana-output/`, unless the prompt explicitly asks for another location.
- 512px rule: send `imageConfig.imageSize` as string `"512"` in API calls (never numeric `512`).

## Read references intentionally
- Start in [`references\image-generation-api.md`](references/image-generation-api.md) for operational payload rules, model behavior, sizing, thinking, grounding, and limits.
- Use [`references\sources.md`](references/sources.md) to verify source provenance and jump to upstream docs.
- For canonical API behavior, read:
  - [Gemini image-generation docs](https://ai.google.dev/gemini-api/docs/image-generation)
  - [Aspect ratios and image size](https://ai.google.dev/gemini-api/docs/image-generation#aspect_ratios_and_image_size)
  - [Thinking process](https://ai.google.dev/gemini-api/docs/image-generation#thinking-process)
  - [Grounding with Google Search](https://ai.google.dev/gemini-api/docs/image-generation#use-with-grounding)
  - [Grounding with Google Image Search](https://ai.google.dev/gemini-api/docs/image-generation#image-search)

## Output formatting rules
- After successful generation, **always** report results in this format:
  1. A short completion message (e.g. `✅ 圖片已產出`)
  2. The **relative path** to each generated file, formatted as a markdown image embed: `![description](relative/path/to/image.jpg)`
  3. File metadata: format (`JPEG`/`PNG`), dimensions, file size
- Example final answer:
  ```
  ✅ 圖片已產出

  ![一杯抹茶拿鐵](workspaces/issue-2/nanobanana-output/matcha-latte-01.jpg)

  - 格式：JPEG · 1408×768 · 757 KB
  ```
- This ensures downstream systems (GitHub Issue comments, Telegram relay) can display or link to the image.

## Execution pattern
- Default to Node.js wrapper flows for regular usage, especially when payload control is needed.
- Quick path (agent runs from `workspaces/issue-N/`; resolve the repo root first):
  - `REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo "../..")` then
    `node "$REPO_ROOT/.agents/skills/gemini-nanobanana/scripts/gemini-nanobanana-cli.js" --prompt "..."`
  - Add references via repeated `-i/--image` (up to 14).
  - Enable grounding via `--google-search` when prompt needs fresh web context.
- The API key (`GEMINI_API_KEY` / `NANOBANANA_GEMINI_API_KEY`) is injected by the workflow environment; do **not** hardcode it. The CLI reads it automatically from the environment.
