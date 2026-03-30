---
name: gemini-nanobanana
description: Use this skill when users ask to generate, edit, or compose images with Gemini Nano Banana 2, including text-to-image, image editing, multi-image composition, grounding, and output sizing/saving controls.
required_env:
  - GEMINI_API_KEY
---

## Do this first
- Use a Node.js wrapper (`@google/genai`) as the primary flow (multi-turn edits, grounding, advanced `generationConfig`).
- Use `scripts/gemini-nanobanana-cli.js` for quick single-turn generation/editing runs.
- Do **not** teach raw `curl`; keep guidance in JS CLI/wrapper form.

## Enforce these defaults
- API key source: `GEMINI_NANOBANANA_API_KEY` with fallback `GEMINI_API_KEY`.
- Default model: `gemini-3.1-flash-image-preview` (allow env override via `GEMINI_NANOBANANA_MODEL`).
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

After successful generation, **always** report results in this format:

1. `✅ 圖片已產出`
2. Each image as a **markdown embed with absolute GitHub URL**:
   `![description](https://github.com/{GITHUB_REPO}/blob/{BRANCH}/{relative_path}?raw=true)`
3. File metadata: format (`JPEG`/`PNG`), dimensions, file size
4. **Artifact metadata** block (enables Telegram relay to send the actual photo):
   `<!-- githubclaw-artifacts: {"images":[{"branch":"{BRANCH}","path":"{relative_path}"}],"html":[]} -->`

### Example (single image)

Assuming `GITHUB_REPO=test/baoclaw-5`, `BRANCH=issue-3`:

```
✅ 圖片已產出

![一杯抹茶拿鐵](https://github.com/test/baoclaw-5/blob/issue-3/issue-3/artifacts/4153431460/matcha-latte-01.jpg?raw=true)

- 格式：JPEG · 1408×768 · 757 KB

<!-- githubclaw-artifacts: {"images":[{"branch":"issue-3","path":"issue-3/artifacts/4153431460/matcha-latte-01.jpg"}],"html":[]} -->
```

### Example (multiple images)

```
✅ 圖片已產出

![圖 1](https://github.com/test/baoclaw-5/blob/issue-3/issue-3/artifacts/4153431460/cute-puppy-01.jpg?raw=true)
![圖 2](https://github.com/test/baoclaw-5/blob/issue-3/issue-3/artifacts/4153431460/cute-puppy-02.jpg?raw=true)

- 圖 1：JPEG · 1408×768 · 703 KB
- 圖 2：JPEG · 1408×768 · 512 KB

<!-- githubclaw-artifacts: {"images":[{"branch":"issue-3","path":"issue-3/artifacts/4153431460/cute-puppy-01.jpg"},{"branch":"issue-3","path":"issue-3/artifacts/4153431460/cute-puppy-02.jpg"}],"html":[]} -->
```

### Why this format

- **GitHub Issue comments** require absolute URLs to render images inline (relative paths won't display).
- **Telegram relay** detects `githubclaw-artifacts` metadata → downloads image via GitHub API → sends as photo.
- `?raw=true` ensures GitHub serves raw image bytes instead of the HTML file viewer.

## Execution pattern
- Default to Node.js wrapper flows for regular usage, especially when payload control is needed.
- Quick path (agent runs from `issue-N/`; resolve the repo root first):
  - `REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo "../..")` then
    `node "$REPO_ROOT/.agents/skills/gemini-nanobanana/scripts/gemini-nanobanana-cli.js" --prompt "..."`
  - Add references via repeated `-i/--image` (up to 14).
  - Enable grounding via `--google-search` when prompt needs fresh web context.
- The API key (`GEMINI_NANOBANANA_API_KEY` / `GEMINI_API_KEY`) is injected by the workflow environment; do **not** hardcode it. The CLI reads it automatically from the environment.
