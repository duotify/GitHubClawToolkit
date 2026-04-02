---
name: felo-superAgent
description: "Felo SuperAgent API: AI conversation with real-time SSE streaming on a persistent LiveDoc canvas. Use when users want SuperAgent chat, continuous conversation, logo/branding design, or e-commerce product images. CRITICAL: When user provides ANY image/product description (e.g. '生成一張...產品照片', '我的提示詞為: 生成...', 'generate a product photo'), ALWAYS call the API to generate the actual image — NEVER rewrite the prompt as text output. Do NOT use for tweet/X post writing — use felo-twitter-writer instead. Explicit commands: /felo-superagent."
---

# Felo SuperAgent Skill

## Constraints (MUST READ FIRST)

These rules are mandatory. Violating any of them will produce incorrect behavior.

0. **NEVER treat image/product descriptions as prompt-writing or prompt-optimization tasks.** If the user's message contains a visual description — regardless of phrasing such as "我的提示詞為", "my prompt is", "生成一張", "generate a photo of", "create a product image" — you MUST call the felo-superAgent API immediately to generate the actual image. Do NOT:
   - Rewrite, refine, or "improve" the description as a text output
   - Suggest keywords or aspect ratios as your final response
   - Write a better prompt to result.md instead of calling the API
   - Describe what you would do instead of doing it

   The ONLY correct response to an image/product generation request is to **execute the skill** (run `run_superagent.mjs` with `--skill-id ecommerce-product-image` or `logo-and-branding`) and **output the resulting image URLs**. If you find yourself writing text about the image instead of calling the API, stop and call the API.

1. **ALWAYS use `--json` flag.** The script MUST run in JSON mode (`--json`). In Claude Code's Bash tool, stdout is always captured — it never streams directly to the user. JSON mode returns the full answer in a structured response that Claude can then output as text. State IDs are extracted from the JSON response fields `thread_short_id` and `live_doc_short_id`.

2. **ALWAYS output the answer and all tool results.** After the script finishes: (a) print `data.answer` verbatim as your response text — do NOT summarize or paraphrase; (b) render every entry in `data.image_urls` as a Markdown inline image `![title](url)` immediately after the answer — NEVER skip image URLs; (c) list any entries in `data.discoveries`, `data.documents`, `data.ppts`, `data.htmls`.

3. **`--live-doc-id` is optional for the first call.** `run_superagent.mjs` works without `--live-doc-id` — the API will auto-assign a LiveDoc and return its `live_doc_short_id` in the JSON response. On the FIRST call in a session (no live_doc_id known yet), you MAY omit `--live-doc-id`. After the first call, always reuse the returned `live_doc_short_id` (see Constraint #4 and Step 2).

4. **Reuse `live_doc_id` from ANY source.** If you already have a `live_doc_id` from any previous operation in this session — whether from a prior SuperAgent call's JSON response (`data.live_doc_short_id`), user-provided input, or any other skill — use it directly. Do NOT try to fetch LiveDoc list via felo-livedoc (it may not be installed). Only omit `--live-doc-id` when you truly have no ID from any source. (Note: `live_doc_id` corresponds to the API field `live_doc_short_id` and the `[state]` output key `live_doc_short_id`.)

5. **One LiveDoc per session.** All conversations within a session MUST use the same `--live-doc-id`. Do NOT create a new LiveDoc unless the user explicitly asks to "open a new canvas" / "start a new LiveDoc" / "create a new workspace".

6. **Default behavior is follow-up, not new conversation.** After the first question, every subsequent user message is a follow-up. You MUST pass `--thread-id` from the previous response. Only omit `--thread-id` (to start a new thread on the same LiveDoc) when:
   - The user explicitly says "new topic" / "change subject" / "start over"
   - The user's intent requires a specific `--skill-id` (e.g., tweet writing, logo design, product image) and the current thread was not created with that skill — because `--skill-id` only takes effect in new conversations

7. **Always persist state.** After every call, extract `thread_short_id` and `live_doc_id` from the stderr `[state]` line (where `live_doc_id` is output as `live_doc_short_id`). Use them in the next call. Losing these IDs breaks conversation continuity.

8. **Skill ID selection (New Conversations Only).** When creating a new conversation (no `--thread-id`), analyze the user's intent and determine if it matches one of the supported skill IDs:

   **Available skill IDs:**
   - `twitter-writer` — For composing, drafting, or posting tweets/X posts
   - `logo-and-branding` — For creating logos, brand designs, or visual identity
   - `ecommerce-product-image` — For generating product images for e-commerce use

   **Selection logic:**
   - If the user explicitly requests a specific skill-id, use their specified value
   - If the user's intent clearly matches one of the above, pass `--skill-id` with that value
   - If none of the above match, do NOT pass `--skill-id` (general conversation mode)
   - `--skill-id` is only effective when creating a new conversation. It is ignored in follow-up mode (`--thread-id`).

9. **Brand style selection for skill-based new conversations.** When starting a NEW conversation that uses a skill ID (`twitter-writer`, `logo-and-branding`, `ecommerce-product-image`), you MUST fetch the style library and let the user choose a style BEFORE calling `run_superagent.mjs`. The chosen style is passed via `--ext '{"brand_style_requirement":"<style_string>"}'`. See Step 4.5 for the full procedure.

   - The style string is the exact text block output by `run_style_library.mjs` for that entry. Fields vary by category:
     - **TWITTER**: `Style name` + `Style labels` (language-aware) + `Style DNA` + `Cover file ID` (omitted if null)
     - **IMAGE**: `Style name` + `Style labels` + `Style DNA` or `Cover file ID` depending on what is present
   - Use the category that matches the skill: `TWITTER` for `twitter-writer`, `IMAGE` for `logo-and-branding` and `ecommerce-product-image`.
   - Always pass `--accept-language` to `run_style_library.mjs` so labels are returned in the user's language.
   - If the user has already specified a style (by name or by pasting the style block), skip the fetch and use their choice directly.
   - If the style library returns no entries, proceed without `--ext`.
   - `--ext` is only valid for new conversations. Never pass it in follow-up mode (`--thread-id`).

10. **Never create a new LiveDoc casually.** Reuse the existing one. The only exception is an explicit user request for a new canvas/workspace.

## When to Use

Trigger this skill when users want:

- **SuperAgent conversation:** AI conversation with Felo SuperAgent, with real-time streaming output
- **Continuous conversation:** Multi-turn Q&A on a persistent LiveDoc canvas
- **Logo & branding:** Create logos or brand designs (auto-selects `logo-and-branding` skill)
- **E-commerce images:** Generate product images for e-commerce use (auto-selects `ecommerce-product-image` skill). **This includes any request where the user provides a visual description and wants an AI-generated product photo** — e.g., "生成一張…產品照片", "generate a photo of a leather wallet", "幫我生成一張商品圖"
- **Image generation from description:** Any request where the user describes a scene, product, or visual concept and expects an actual AI-generated image as output — NOT a text description or prompt refinement
- **Tool-augmented answers:** Responses that may include image generation, document creation, PPT generation, or Twitter/X search
- **Streaming responses:** Real-time answer generation with Server-Sent Events (SSE)

**⚠️ IMPORTANT — Do NOT misinterpret image requests as prompt-writing tasks.** If the user provides a visual description and asks to "生成"/"generate"/"create" an image or photo, ALWAYS call the felo-superAgent API with `--skill-id ecommerce-product-image`. Do NOT respond with refined text prompts or suggestions — execute the skill and output the generated image URLs.

**Trigger words:**

- English: superagent, super agent, stream chat, streaming conversation, livedoc conversation, continuous chat, follow-up question, create a logo, brand design, product image, e-commerce image, generate image, generate photo, product photo, product shot
- 繁體中文：超級助手、串流對話、連續對話、追問、設計 logo、品牌設計、電商圖片、商品圖片、商品照片、產品照片、產品圖片、生成圖片、生成照片、生圖、AI 生圖、AI 作圖、製作圖片、電商產品圖
- 简体中文：超级助手、流式对话、连续对话、追问、设计 logo、品牌设计、电商图片、商品图片、商品照片、产品照片、产品图片、生成图片、生成照片、生图、AI 生图
- Japanese (romaji): suupaa eejento, sutoriimingu kaiwa, keizoku kaiwa, rogo sakusei, shouhin gazou, gazou seisei, shouhin shashin

**Explicit commands:** `/felo-superagent`, "use felo superagent", "felo superagent"

**Do NOT use for:**

- Tweet/X post writing of any kind (use `felo-twitter-writer` instead)
- Simple one-off Q&A or real-time information queries (prefer `felo-search`)
- Web page content fetching only (use `felo-web-fetch`)
- PPT/slide generation only (use `felo-slides`)
- LiveDoc knowledge base management only (use `felo-livedoc`)
- Twitter/X search only (use `felo-x-search`)

## Setup

### 1. Get Your API Key

1. Visit [felo.ai](https://felo.ai) and log in (or register)
2. Click your avatar in the top right corner → Settings
3. Navigate to the "API Keys" tab
4. Click "Create New Key" to generate a new API Key
5. Copy and save your API Key securely

### 2. Configure API Key

The scripts (`run_superagent.mjs`, `run_style_library.mjs`) read the API key **only from the `FELO_API_KEY` environment variable**. The `felo config set` CLI command writes to `~/.felo/config.json` which these scripts do NOT read — environment variable is the only supported method.

**Linux/macOS:**
```bash
export FELO_API_KEY="your-api-key-here"
```

For permanent configuration, add to your shell profile (`~/.bashrc` or `~/.zshrc`):
```bash
echo 'export FELO_API_KEY="your-api-key-here"' >> ~/.zshrc
source ~/.zshrc
```

**Windows (PowerShell):**
```powershell
$env:FELO_API_KEY="your-api-key-here"
```

**Windows (CMD):**
```cmd
set FELO_API_KEY=your-api-key-here
```

### 3. Dependency: felo-livedoc (Optional)

`felo-livedoc` is NOT required. `run_superagent.mjs` can be called without `--live-doc-id` on the first call — the API auto-assigns a LiveDoc and returns its ID in the response for reuse.

## How to Execute

When this skill is triggered, follow these steps strictly in order. Execute all commands using the Bash tool.

### Step 1: Check API Key

```bash
if [ -z "$FELO_API_KEY" ]; then
  echo "ERROR: FELO_API_KEY not set"
  exit 1
fi
```

If not set, stop and show the user the setup instructions above.

### Step 2: Obtain `live_doc_id`

(Note: `live_doc_id` corresponds to the API field `live_doc_short_id`.)

**2a. If you already have a `live_doc_id` from ANY source in this session:**
Skip to Step 3. Reuse the same ID. Sources include: a previous SuperAgent call's JSON response (`data.live_doc_short_id`), user-provided input, or any other skill that returned a LiveDoc ID.

**2b. If no `live_doc_id` is available — proceed to Step 3 WITHOUT `--live-doc-id`.**
The API will auto-assign a LiveDoc. After the call completes, capture `data.live_doc_short_id` from the JSON response and reuse it in all subsequent calls.

**2c. If the user explicitly requests a new canvas/workspace:**
Simply omit `--live-doc-id` in the next call. A new LiveDoc will be created automatically.

### Step 3: Determine Conversation Mode

Decide whether this is a **new conversation** or a **follow-up**:

| Condition                                                    | Mode             | What to pass                                |
| ------------------------------------------------------------ | ---------------- | ------------------------------------------- |
| First question in session (no `thread_short_id` yet)         | New conversation | `--live-doc-id` if known, omit if not       |
| User asks a follow-up / continues the topic (DEFAULT)        | Follow-up        | `--thread-id` AND `--live-doc-id`           |
| User explicitly says "new topic" / "change subject"          | New conversation | `--live-doc-id` only (same LiveDoc)         |
| User's intent requires a `--skill-id` not matching current thread | New conversation | `--live-doc-id` + `--skill-id` (same LiveDoc) |
| User explicitly says "new canvas" / "new LiveDoc"            | New conversation | Omit `--live-doc-id` (API creates new one)  |

**IMPORTANT:** The default for any user message after the first one is ALWAYS follow-up. Only treat it as a new conversation if the user explicitly requests it.

### Step 4: Determine Skill ID (New Conversations Only)

If this is a new conversation (no `--thread-id`), analyze the user's intent:

**Available skill IDs:**
- `twitter-writer` — For composing, drafting, or posting tweets/X posts
- `logo-and-branding` — For creating logos, brand designs, or visual identity
- `ecommerce-product-image` — For generating product images for e-commerce use

**How to decide:**
1. If the user explicitly specifies a skill-id, use that value
2. Otherwise, analyze the user's request and determine if it matches one of the above
3. If none match, do NOT pass `--skill-id`

If this is a follow-up (`--thread-id` is set), skip this step entirely. `--skill-id` is ignored in follow-up mode.

### Step 4.5: Fetch and Select Brand Style (New Skill Conversations Only)

**When to run this step:** Only when this is a NEW conversation AND a skill ID was determined in Step 4 (`twitter-writer`, `logo-and-branding`, or `ecommerce-product-image`). Skip entirely for follow-up conversations or general (no skill) conversations.

**Category mapping:**
| Skill ID | Style category |
|---|---|
| `twitter-writer` | `TWITTER` |
| `logo-and-branding` | `IMAGE` |
| `ecommerce-product-image` | `IMAGE` |

**4.5a. If the user has already specified a style** (by name, or by pasting a style block), use it directly — skip to 4.5d.

**4.5b. Fetch the style list:**

Use the category that matches the skill:

| Skill ID | `--category` |
|---|---|
| `twitter-writer` | `TWITTER` |
| `logo-and-branding` | `IMAGE` |
| `ecommerce-product-image` | `IMAGE` |

Pass `--accept-language` matching the user's language (same value used for SuperAgent).

```bash
# For twitter-writer
node .agents/skills/felo-superAgent/scripts/run_style_library.mjs --category TWITTER --accept-language en

# For logo-and-branding or ecommerce-product-image
node .agents/skills/felo-superAgent/scripts/run_style_library.mjs --category IMAGE --accept-language en
```

The output lists styles in this format, one block per style separated by a blank line:

```
Style name: darioamodei
Style labels: Thoughtful long-form essays
Style DNA: # Dario Amodei (@DarioAmodei) Tweet Writing Style DNA
...（full content）

Style name: Casual & Witty
Style labels: humor, relatable
Style DNA: ...（full content）
Cover file ID: file_abc123
```

Notes:
- `Style labels` is omitted if no labels exist for this entry.
- `Style DNA` is the full text of `content.styleDna` (TWITTER type). Do NOT truncate it.
- `Cover file ID` is omitted if the value is null/empty.

User-created styles appear first, followed by recommended styles.

**4.5c. Present the styles to the user and ask them to choose:**

Show the list (style names only is sufficient) and ask which one to use. Wait for the user's selection before proceeding.

Example prompt to user:
> Here are the available Twitter writing styles. Which one would you like to use?
> 1. Casual & Witty (your style)
> 2. Professional Thought Leader (recommended)
> 3. No style preference — use default

If the user picks "no preference" or the list is empty, proceed to Step 5 without `--ext`.

**4.5d. Build the `--ext` value:**

Take the full text block for the chosen style (exactly as output by the script) and use it as the value of `brand_style_requirement`. The block may contain multiple lines — serialize them into a single JSON string with `\n` for newlines and `\"` for any double quotes inside field values:

Example style block output:
```
Style name: darioamodei
Style labels: Thoughtful long-form essays
Style DNA: # Dario Amodei (@DarioAmodei) Tweet Writing Style DNA\n\n## Style Overview\nDario writes like a serious intellectual...
```

Serialized as `--ext`:
```bash
--ext '{"brand_style_requirement":"Style name: darioamodei\nStyle labels: Thoughtful long-form essays\nStyle DNA: # Dario Amodei (@DarioAmodei) Tweet Writing Style DNA\n\n## Style Overview\nDario writes like a serious intellectual..."}'
```

**Important:** Pass the `brand_style_requirement` value completely and verbatim — do NOT truncate `Style DNA`. Partial style content will degrade output quality.

### Step 5: Run the Script

Construct and execute the command. **ALWAYS use `--json`** — in Claude Code's Bash tool, stdout is captured, not streamed to the user. JSON mode returns the full answer in a structured response.

**IMPORTANT:** The SSE stream may take a long time (especially for image generation, research reports, etc.). You MUST set the Bash tool timeout to at least 600000ms (10 minutes) when executing the script to prevent premature termination.

**`--accept-language` selection:** Default is `en`. Match the user's language — if the user writes in Chinese use `zh`, Japanese use `ja`, Korean use `ko`, etc.

**`--query` construction:** Do NOT simply pass the user's raw input as-is. You should enrich and refine the query to make it more complete and effective for SuperAgent:

- **Add context:** If the conversation has prior context (e.g., the user previously discussed a topic), incorporate relevant details so SuperAgent understands the full picture.
- **Clarify vague requests:** If the user says something brief like "continue" or "go on", expand it to describe what should be continued (e.g., "Please continue the previous analysis and provide more details").
- **Supplement missing details:** If the user's request implies information they mentioned earlier (e.g., brand name, product type, style preference), include those details in the query.
- **Preserve user intent:** Never change the user's core intent. Only add context and clarity — do not inject opinions or redirect the topic.
- **Keep it concise:** The query has a 2000-character limit. Enrich the content but stay focused and avoid unnecessary padding.

Examples:
- User says "continue" → `--query "Please continue the analysis above on quantum computing, expanding on real-world applications"`
- User says "one more" → `--query "Please generate another product image in a similar style, white background"`
- User says "fix it" → `--query "Please revise the tweet generated above, make the tone more casual and add some emojis"`

**New conversation (first question, no skill):**
```bash
node .agents/skills/felo-superAgent/scripts/run_superagent.mjs \
  --query "USER_QUERY_HERE" \
  --live-doc-id "LIVE_DOC_ID" \
  --accept-language en \
  --json
```

**New conversation with skill ID, no style selected:**
```bash
node .agents/skills/felo-superAgent/scripts/run_superagent.mjs \
  --query "Write a tweet about the latest AI trends" \
  --live-doc-id "LIVE_DOC_ID" \
  --skill-id twitter-writer \
  --accept-language en \
  --json
```

**New conversation with skill ID and brand style (from Step 4.5):**
```bash
node .agents/skills/felo-superAgent/scripts/run_superagent.mjs \
  --query "Write a tweet about the latest AI trends" \
  --live-doc-id "LIVE_DOC_ID" \
  --skill-id twitter-writer \
  --ext '{"brand_style_requirement":"Style name: darioamodei\nStyle labels: Thoughtful long-form essays\nStyle DNA: # Dario Amodei (@DarioAmodei) Tweet Writing Style DNA\n\n## Style Overview\nDario writes like a serious intellectual...（full content）"}' \
  --accept-language en \
  --json
```

**Follow-up question (DEFAULT for 2nd+ messages):**
```bash
node .agents/skills/felo-superAgent/scripts/run_superagent.mjs \
  --query "USER_FOLLOW_UP_QUERY" \
  --thread-id "THREAD_SHORT_ID_FROM_PREVIOUS" \
  --live-doc-id "LIVE_DOC_ID" \
  --json
```

### Step 6: Extract State and Output the Answer

After the script finishes, parse the JSON output:

```json
{
  "status": "ok",
  "data": {
    "answer": "...",
    "thread_short_id": "CmYpuGwBgCnrUdDx5ZtmxA",
    "live_doc_short_id": "QPetunwpGnkKuZHStP7gwt",
    "live_doc_url": "https://felo.ai/livedoc/QPetunwpGnkKuZHStP7gwt",
    "image_urls": [{ "url": "https://...", "title": "Logo Design" }],
    "discoveries": [{ "title": "Research Report" }],
    "documents": [{ "title": "Generated Document" }],
    "ppts": [{ "title": "Presentation" }],
    "htmls": [{ "title": "HTML Page" }]
  }
}
```

1. **Output `data.answer` verbatim** as your response text — print it exactly as-is so the user sees the full content.
2. **Output `data.image_urls` as inline images** — if `data.image_urls` is present and non-empty, render each entry as a Markdown image immediately after the answer:
   ```markdown
   ![{title}]({url})
   ```
   Do NOT skip or omit image URLs. This is the primary output for logo design, product image, and any image generation requests.
3. **Output other tool results** — if present, list them after the images:
   - `data.discoveries`: 🔍 Research report: {title}
   - `data.documents`: 📄 Document: {title}
   - `data.ppts`: 📊 Presentation: {title}
   - `data.htmls`: 🌐 HTML page: {title}
4. **Extract and save** `data.thread_short_id` and `data.live_doc_short_id` — you MUST use these in the next call.
5. **Optionally show** `data.live_doc_url` so the user can view the LiveDoc canvas in a browser.

Do NOT show `thread_short_id` or `live_doc_short_id` to the user unless they ask for it.

## Complete Workflow Examples

### Example A: Multi-turn Conversation (Most Common)

```
User: "What is quantum computing?"
```

**Step 2b:** No live_doc_id yet → proceed without it (API will auto-assign)
**Step 3:** First question → New conversation
**Step 4:** No special skill → no `--skill-id`
**Step 5:**
```bash
node .agents/skills/felo-superAgent/scripts/run_superagent.mjs \
  --query "What is quantum computing?" \
  --live-doc-id "QPetunwpGnkKuZHStP7gwt" \
  --accept-language en \
  --json
```
**Step 6:** Parse JSON output. Output `data.answer` verbatim as your response. Save `thread_short_id = "CmYpuGwBgCnrUdDx5ZtmxA"`, `live_doc_id = "QPetunwpGnkKuZHStP7gwt"` from `data`.

```
User: "What are its practical applications?"
```

**Step 2a:** Already have `live_doc_id` → skip
**Step 3:** Follow-up (default) → use saved `thread_short_id`
**Step 5:**
```bash
node .agents/skills/felo-superAgent/scripts/run_superagent.mjs \
  --query "What are its practical applications?" \
  --thread-id "CmYpuGwBgCnrUdDx5ZtmxA" \
  --live-doc-id "QPetunwpGnkKuZHStP7gwt" \
  --json
```
**Step 6:** Parse JSON output. Output `data.answer` verbatim. Save updated `thread_short_id` from `data` (may be the same), keep `live_doc_id`.

```
User: "Tell me more about quantum error correction"
```

**Step 3:** Still follow-up (same topic) → use saved `thread_short_id`
**Step 5:** Same pattern as above with new query

### Example B: Tweet Writing with Style Selection

```
User: "Help me write a tweet about AI trends"
```

**Step 2a:** Already have `live_doc_id` → reuse
**Step 3:** New conversation
**Step 4:** User intent matches "write a tweet" → `--skill-id twitter-writer`
**Step 4.5:** Fetch TWITTER styles (pass `--accept-language` matching user's language):
```bash
node .agents/skills/felo-superAgent/scripts/run_style_library.mjs --category TWITTER --accept-language en
```
Output:
```
Style name: My Bold Voice
Style labels: bold, provocative
Style DNA: # My Bold Voice Style DNA
...（full content）

Style name: darioamodei
Style labels: Thoughtful long-form essays
Style DNA: # Dario Amodei (@DarioAmodei) Tweet Writing Style DNA
...（full content）
```
Present to user: "Which writing style would you like? 1. My Bold Voice (yours) 2. darioamodei (recommended) 3. No preference"

User selects: "1. My Bold Voice"

**Step 5:**
```bash
node .agents/skills/felo-superAgent/scripts/run_superagent.mjs \
  --query "Help me write a tweet about AI trends" \
  --live-doc-id "QPetunwpGnkKuZHStP7gwt" \
  --skill-id twitter-writer \
  --ext '{"brand_style_requirement":"Style name: My Bold Voice\nStyle labels: bold, provocative\nStyle DNA: # My Bold Voice Style DNA\n...（full content）"}' \
  --accept-language en \
  --json
```
**Step 6:** Parse JSON output. Output `data.answer` verbatim. Save new `thread_short_id` from `data`, keep same `live_doc_id`.

```
User: "Make it more casual and add some emojis"
```

**Step 3:** Follow-up → use saved `thread_short_id` (do NOT pass `--ext` again)
**Step 5:**
```bash
node .agents/skills/felo-superAgent/scripts/run_superagent.mjs \
  --query "Make it more casual and add some emojis" \
  --thread-id "NEW_THREAD_FROM_TWEET" \
  --live-doc-id "QPetunwpGnkKuZHStP7gwt" \
  --json
```

### Example C: Logo Design with Style Selection

```
User: "Design a logo for my coffee shop called Bean & Brew"
```

**Step 4:** Detected "design a logo" → `--skill-id logo-and-branding`
**Step 4.5:** Fetch IMAGE styles:
```bash
node .agents/skills/felo-superAgent/scripts/run_style_library.mjs --category IMAGE --accept-language en
```
Output example:
```
Style name: Minimalist Modern
Style labels: clean, monochrome
Style DNA: ...（full content）
Cover file ID: file_333
```
Present styles to user and wait for selection. Suppose user picks "Minimalist Modern":

**Step 5:**
```bash
node .agents/skills/felo-superAgent/scripts/run_superagent.mjs \
  --query "Design a logo for my coffee shop called Bean & Brew" \
  --live-doc-id "QPetunwpGnkKuZHStP7gwt" \
  --skill-id logo-and-branding \
  --ext '{"brand_style_requirement":"Style name: Minimalist Modern\nStyle labels: clean, monochrome\nStyle DNA: ...（full content）\nCover file ID: file_333"}' \
  --accept-language en \
  --json
```

### Example D: E-commerce Product Image with Style Selection

```
User: "Generate a product image for a wireless headphone on white background"
```

**Step 4:** Detected "product image" → `--skill-id ecommerce-product-image`
**Step 4.5:** Fetch IMAGE styles:
```bash
node .agents/skills/felo-superAgent/scripts/run_style_library.mjs --category IMAGE --accept-language en
```
Present styles to user. Suppose user picks "No preference":

**Step 5:** (no `--ext` since user chose no preference)
```bash
node .agents/skills/felo-superAgent/scripts/run_superagent.mjs \
  --query "Generate a product image for a wireless headphone on white background" \
  --live-doc-id "QPetunwpGnkKuZHStP7gwt" \
  --skill-id ecommerce-product-image \
  --accept-language en \
  --json
```

### Example E: User Requests a New Canvas

```
User: "Open a new canvas for a different project"
```

**Step 2c:** Omit `--live-doc-id` in the next call — a new LiveDoc is created automatically. Capture `data.live_doc_short_id` from the response and use it for all subsequent calls.

### Example F: User Specifies Style Directly

```
User: "Write a tweet about AI trends using the 'darioamodei' style"
```

**Step 4:** `--skill-id twitter-writer`
**Step 4.5a:** User already named the style → fetch the list to get the full block:
```bash
node .agents/skills/felo-superAgent/scripts/run_style_library.mjs --category TWITTER --accept-language en
```
Find the entry with `Style name: darioamodei`, extract its full block verbatim. No need to ask the user again.

**Step 5:**
```bash
node .agents/skills/felo-superAgent/scripts/run_superagent.mjs \
  --query "Write a tweet about AI trends" \
  --live-doc-id "QPetunwpGnkKuZHStP7gwt" \
  --skill-id twitter-writer \
  --ext '{"brand_style_requirement":"Style name: darioamodei\nStyle labels: Thoughtful long-form essays\nStyle DNA: # Dario Amodei (@DarioAmodei) Tweet Writing Style DNA\n\n## Style Overview\nDario writes like a serious intellectual...（full content, do NOT truncate）"}' \
  --accept-language en \
  --json
```

## Available Script Options

**Core parameters:**
- `--query <text>` (REQUIRED) — User question, 1-2000 characters
- `--live-doc-id <id>` (REQUIRED for new conversations) — LiveDoc ID (`live_doc_id`) to associate with
- `--thread-id <id>` — Thread ID from previous response, for follow-up conversations

**Skill parameters (new conversations only, ignored in follow-up):**
- `--skill-id <id>` — Skill ID (see Constraint #9 for available skill IDs)
- `--selected-resource-ids <ids>` — Comma-separated resource IDs to include
- `--ext <json>` — Extra parameters as JSON object. For skill-based conversations, pass brand style as:
  `--ext '{"brand_style_requirement":"Style name: <name>\nStyle labels: <labels>\nStyle DNA: <full styleDna text>\nCover file ID: <id>"}'`
  Fields present depend on category type. `Cover file ID` is omitted when null. Do NOT truncate `Style DNA`.

**Output control:**
- `--json` / `-j` — Output JSON format with full metadata (ALWAYS use this in Claude Code — stdout is captured by the Bash tool, not streamed to the user)
- `--verbose` / `-v` — Log stream connection details to stderr (for debugging only, not needed for normal use)
- `--accept-language <lang>` — Language preference (e.g., en, ja, ko)

## API Workflow (Reference)

The script handles this workflow automatically:

1. **Create conversation:**
   - New: `POST /v2/conversations` (requires `live_doc_short_id` in body)
   - Follow-up: `POST /v2/conversations/{threadId}/follow_up`
   - Returns: `stream_key`, `thread_short_id`, `live_doc_short_id`

2. **Consume SSE stream:**
   - `GET /v2/conversations/stream/{stream_key}`
   - Supports offset parameter for resuming: `?offset={lastOffset}`
   - Reconnects automatically if connection drops (2-second delay)

3. **Parse events:**
   - `message` — Direct text content
   - `stream` — Wrapped content with type information
   - `heartbeat` — Keep-alive signal
   - `done` / `completed` / `complete` — Stream finished
   - `error` — Error event (non-terminal, continues reading)

4. **Extract tool results:**
   - Image generation (`generate_images`)
   - Research reports (`generate_discovery`)
   - Document generation (`generate_document`)
   - PPT generation (`generate_ppt`)
   - HTML generation (`generate_html`)
   - Twitter/X search (`search_x`)

Base URL: `https://openapi.felo.ai` (override with `FELO_API_BASE` if needed).

## Tool Support

SuperAgent may invoke tools during conversation. The script automatically extracts and displays:

**Image Generation:**
- Tool: `generate_images`
- Output: Image URLs and titles

**Research & Discovery:**
- Tool: `generate_discovery`
- Output: Research report titles and status

**Document Generation:**
- Tool: `generate_document`
- Output: Document titles and status

**Presentation Generation:**
- Tool: `generate_ppt`
- Output: PPT titles and status

**HTML Generation:**
- Tool: `generate_html`
- Output: HTML page titles and status

**Twitter/X Search:**
- Tool: `search_x`
- Output: Tweet content, author info, metrics (likes, retweets, views)

## Error Handling

### Common Error Codes

| Code                                   | HTTP | Description                                       |
| -------------------------------------- | ---- | ------------------------------------------------- |
| INVALID_API_KEY                        | 401  | API Key is invalid or has been revoked             |
| SUPER_AGENT_CONVERSATION_CREATE_FAILED | 502  | Failed to create conversation (upstream error)     |
| SUPER_AGENT_CONVERSATION_QUERY_FAILED  | 502  | Failed to query conversation details               |

### SSE Stream Errors

The stream may send:
- `event: error` with `data: {"message": "..."}` — treat as failure and show message
- Connection timeout — script automatically reconnects with 2-second delay
- Idle timeout (2 hours) — stream aborted if no data received

### Missing API Key

If `FELO_API_KEY` is not set, display this message:

```
ERROR: FELO_API_KEY not set

To use this skill, you need to set up your Felo API Key:

1. Get your API key from https://felo.ai (Settings -> API Keys)
2. Set the environment variable:

   Linux/macOS:
   export FELO_API_KEY="your-api-key-here"

   Windows (PowerShell):
   $env:FELO_API_KEY="your-api-key-here"

3. Restart Claude Code or reload the environment
```

### Timeout Handling

- The SSE stream has its own idle timeout: 2 hours (no data received). The stream stays open as long as data keeps flowing.
- **Bash tool timeout:** MUST be set to at least 600000ms (10 minutes) when executing the script, because the SSE stream can run for a long time.

## Important Notes

- ⚠️ **路徑安全**：skill 腳本位於 repo root 的 `.agents/skills/` 下。若 cwd 不在 repo root，先執行 `git rev-parse --show-toplevel` 取得路徑再 `cd`。禁止用 `$(...)` 語法。
- ⚠️ **指令安全**：Copilot CLI 的安全過濾器會封鎖含有特定 shell 語法的指令，執行時**禁止**加入以下任何寫法，否則指令會被直接擋下：
  - `set -e`、`set -u`、`set -o`、`set -euo pipefail` 等 set 指令
  - `${var@P}`、`${!var}` 等參數展開語法
  - 巢狀的 `$(...)` 指令替換
  - 正確寫法：直接執行 `cd` 與 `node` 指令，不要包在 shell 腳本控制流程內
- **預設輸出語言為繁體中文（zh-TW）**。除非使用者明確指定其他語言，否則所有摘要、整理、說明等 AI 產出的文字，一律使用繁體中文輸出。
- Execute this skill immediately using the Bash tool — do not just describe what you would do
- **ALWAYS use `--json`** — in Claude Code's Bash tool, stdout is captured, not streamed. JSON mode returns the answer in a structured response that Claude outputs as text
- **ALWAYS output `data.answer` verbatim AND render `data.image_urls`** — print the answer exactly as-is, then render each image URL as `![title](url)` Markdown. Never discard image URLs.
- After create, the script connects to the stream **immediately** — the `stream_key` has a limited validity period
- Use the bundled Node script to consume SSE; do not assume `jq` or other tools for parsing SSE
- Same API key as other Felo skills (`FELO_API_KEY`)
- The script handles reconnection automatically if the stream drops
- Tool results are deduplicated to avoid showing the same resource multiple times
- If `live_doc_id` is already known from any source (other skills, user input, previous calls), use it directly — do NOT fetch the LiveDoc list again
- Multi-language support: Fully supports Simplified Chinese, Traditional Chinese, Japanese, and English
- The API returns results in the same language as the query when possible

## Decision Flowchart

```
User sends a message
        |
        v
Have live_doc_id from ANY source?
   NO  --> proceed WITHOUT --live-doc-id; API auto-assigns; capture data.live_doc_short_id from response
   YES --> continue (reuse it)
        |
        v
Have thread_short_id from previous call?
   NO  --> This is a NEW conversation
              --> Step 4: determine skill-id by analyzing user intent
              --> skill-id found (twitter-writer / logo-and-branding / ecommerce-product-image)?
                    YES --> Step 4.5: fetch style library for matching category
                              --> styles available?
                                    YES --> present to user, wait for selection
                                              --> user picked a style?
                                                    YES --> build --ext '{"brand_style_requirement":"..."}'
                                                    NO  --> no --ext
                                    NO  --> no --ext
                    NO  --> no --ext, no --skill-id
              --> Step 5: run WITHOUT --thread-id (with --skill-id and --ext if determined above)
   YES --> Does user's intent require a skill-id not matching current thread?
              YES --> NEW conversation (same live-doc-id, with --skill-id, repeat Step 4.5)
              NO  --> Is user explicitly starting a new topic?
                        YES --> NEW conversation (same live-doc-id, no --thread-id)
                        NO  --> FOLLOW-UP (pass --thread-id, NO --ext)
        |
        v
Run script (WITH --json, Bash timeout >= 600000ms) --> parse JSON, output data.answer verbatim + render data.image_urls as Markdown images
        |
        v
Extract thread_short_id + live_doc_id from stderr [state] line
        |
        v
Do NOT repeat or summarize the answer (already shown)
```

## Style Library Script (`run_style_library.mjs`)

Fetch the style library list for a given category. Returns user styles first, then recommended styles.

```bash
node .agents/skills/felo-superAgent/scripts/run_style_library.mjs --category TWITTER --accept-language en
```

**Options:**
- `--category <category>` (REQUIRED) — One of: `TWITTER`, `INSTAGRAM`, `LEMON8`, `NOTECOM`, `WEBSITE`, `IMAGE`
- `--accept-language <lang>` — Language for labels/tags (e.g. `en`, `zh-Hans`, `ja`). Default: `en`. Always pass this to match the user's language.
- `--json` / `-j` — Output raw JSON
- `--timeout <seconds>` — Request timeout (default 60)

**Default text output format (one block per style, blank line between):**

For TWITTER category:
```
Style name: darioamodei
Style labels: Thoughtful long-form essays
Style DNA: # Dario Amodei (@DarioAmodei) Tweet Writing Style DNA
...（full styleDna content）
```

Fields included per entry (fields with null/empty values are omitted):
- `Style name` — always present (`name` field)
- `Style labels` — from `content.labels` (TWITTER) or `content.tags` (other categories), in the requested language, comma-separated; omitted if not present
- `Style DNA` — from `content.styleDna` (TWITTER type); omitted if not present
- `Cover file ID` — from `coverFileId`; omitted if null/empty

User-created styles appear before recommended styles.

## References

- [SuperAgent API (Felo Open Platform)](https://openapi.felo.ai/docs/api-reference/v2/superagent.html)
- [Felo Open Platform](https://openapi.felo.ai/docs/)
- [Get API Key](https://felo.ai) (Settings -> API Keys)

