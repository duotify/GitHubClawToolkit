# Felo SuperAgent Skill for Claude Code

**AI conversation with real-time streaming output, supporting continuous multi-turn conversation.**

Use the Felo Open Platform SuperAgent API in Claude Code to initiate conversations with SuperAgent, receive real-time SSE streaming responses, and manage conversation state across turns.

---

## Features

- **Streaming conversation** — create a conversation and receive AI responses in real-time via SSE
- **LiveDoc association** — each conversation is linked to a LiveDoc for resource tracking
- **Continuous conversation** — continue asking questions in an existing thread using `--thread-id`
- **Brand style support** — pass a writing style via `--ext` to guide output (used by `felo-twitter-writer` and other skills)
- **Style library** — fetch saved brand styles from the API with `run_style_library.mjs`
- **LiveDoc management** — list LiveDocs and view resources within a specific LiveDoc
- **Multi-language** — supports `--accept-language` (e.g., zh, en, ja, ko)
- **Tool invocation** — image generation, research reports, documents, PPT, HTML, Twitter/X search, and more

**Use cases:**

- Need SuperAgent streaming answers
- Need conversation associated with LiveDoc for traceable resources
- Multi-turn/continuous conversation (reuse the same LiveDoc)
- Tweet writing, logo design, or e-commerce product images with brand style guidance

**Not suitable for:**

- Simple one-off real-time information retrieval → use `felo-search`
- Only need to fetch webpage content → use `felo-web-fetch`
- Only need to generate PPT → use `felo-slides`
- Need LiveDoc knowledge base features → use `felo-livedoc`

---

## Quick Start

### 1. Installation

**Via ClawHub:**

```bash
clawhub install felo-superAgent
```

**Manual install:**

```bash
# Linux/macOS
cp -r felo-superAgent ~/.claude/skills/

# Windows (PowerShell)
Copy-Item -Recurse felo-superAgent "$env:USERPROFILE\.claude\skills\"
```

### 2. Configure API Key

1. Open [felo.ai](https://felo.ai) and log in
2. Avatar → **Settings** → **API Keys** → Create and copy key
3. Set environment variable:

```bash
# Linux/macOS
export FELO_API_KEY="your-api-key-here"

# Windows PowerShell
$env:FELO_API_KEY="your-api-key-here"
```

For permanent configuration, add to your shell profile (`~/.bashrc`, `~/.zshrc`) or system environment variables.

### 3. Usage

**Trigger in Claude Code conversation:**

```
/felo-superagent What is the latest news about AI?
/felo-superagent Tell me more
```

**Run script directly:**

```bash
node felo-superAgent/scripts/run_superagent.mjs --query "What is quantum computing?"
node felo-superAgent/scripts/run_superagent.mjs --query "Tell me more" --thread-id <thread_short_id>
```

**CLI commands (after `npm install -g felo-ai`):**

```bash
felo superagent "What is the latest news about AI?"
felo superagent "Tell me more" --thread-id <thread_short_id>
felo livedocs
felo livedoc-resources <livedoc-id>
felo style-library TWITTER --accept-language en
```

---

## Scripts

This skill provides two scripts:

| Script | Description |
|---|---|
| `run_superagent.mjs` | Create/continue a conversation and stream the answer |
| `run_style_library.mjs` | Fetch brand styles from the style library API |

### run_superagent.mjs parameters

| Parameter | Description |
|---|---|
| `--query <text>` | User question (required, 1–2000 characters) |
| `--thread-id <id>` | Existing thread ID for follow-up conversations |
| `--live-doc-id <id>` | Reuse existing LiveDoc short_id |
| `--skill-id <id>` | Skill ID for new conversations (`twitter-writer`, `logo-and-branding`, `ecommerce-product-image`) |
| `--selected-resource-ids <ids>` | Comma-separated resource IDs (new conversations only) |
| `--ext <json>` | Extra parameters as JSON (new conversations only). Used for brand style — see below. |
| `--accept-language <lang>` | Language preference: `en`, `zh`, `ja`, `ko`, etc. |
| `--timeout <seconds>` | Request/stream timeout, default 60 |
| `--json` | Output JSON with `answer`, `thread_short_id`, `live_doc_short_id` |
| `--verbose` | Log stream connection details to stderr |

### run_style_library.mjs parameters

| Parameter | Description |
|---|---|
| `--category <category>` | Style category (required): `TWITTER`, `INSTAGRAM`, `LEMON8`, `NOTECOM`, `WEBSITE`, `IMAGE` |
| `--accept-language <lang>` | Language for labels/tags (e.g. `en`, `zh-Hans`, `ja`). Default: `en` |
| `--json` | Output raw JSON |
| `--timeout <seconds>` | Request timeout, default 60 |

---

## Brand Style (`--ext`)

When starting a new conversation with a skill ID, you can pass a brand style via `--ext` to guide the output. The style is fetched from the style library and serialized as a JSON string.

### Fetch styles

```bash
node felo-superAgent/scripts/run_style_library.mjs --category TWITTER --accept-language en
```

Output (one block per style, blank line between):

```
Style name: darioamodei
Style labels: Thoughtful long-form essays
Style DNA: # Dario Amodei (@DarioAmodei) Tweet Writing Style DNA
...（full content）

Style name: My Bold Voice
Style labels: bold, provocative
Style DNA: # My Bold Voice Style DNA
...（full content）
Cover file ID: file_abc123
```

Fields per entry:

| Field | Source | Notes |
|---|---|---|
| `Style name` | `name` | Always present |
| `Style labels` | `content.labels[lang]` or `content.tags[lang]` | Language-aware, comma-separated; omitted if absent |
| `Style DNA` | `content.styleDna` | Full text (TWITTER type); omitted if absent |
| `Cover file ID` | `coverFileId` | Omitted if null |

User-created styles appear before recommended styles.

### Pass style to SuperAgent

Take the full text block for the chosen style and serialize it into `brand_style_requirement`. Pass the value **completely — do NOT truncate `Style DNA`**:

```bash
node felo-superAgent/scripts/run_superagent.mjs \
  --query "Write a tweet about AI trends" \
  --live-doc-id "LIVE_DOC_ID" \
  --skill-id twitter-writer \
  --ext '{"brand_style_requirement":"Style name: darioamodei\nStyle labels: Thoughtful long-form essays\nStyle DNA: # Dario Amodei (@DarioAmodei) Tweet Writing Style DNA\n\n## 风格速写\nDario writes like a serious intellectual...（full content）"}' \
  --accept-language en
```

Category mapping for skill IDs:

| Skill ID | Style category |
|---|---|
| `twitter-writer` | `TWITTER` |
| `logo-and-branding` | `IMAGE` |
| `ecommerce-product-image` | `IMAGE` |

`--ext` is only valid for new conversations. Never pass it in follow-up mode (`--thread-id`).

---

## Using with Claude Code

### Installation

```bash
# Via ClawHub
clawhub install felo-superAgent

# Manual
cp -r felo-superAgent ~/.claude/skills/
```

### Triggering the skill

Claude Code automatically triggers this skill for SuperAgent conversations. Explicit commands:

```
/felo-superagent What is the latest news about AI?
/felo-superagent Write a tweet about AI trends
/felo-superagent Create a logo for my coffee shop
```

### What Claude manages automatically

- **LiveDoc reuse** — reuses the same LiveDoc across the session; only fetches the list when no ID is available
- **Thread continuity** — passes `--thread-id` for all follow-up messages; only starts a new thread when the user explicitly requests it or a different skill ID is needed
- **Style selection** — for skill-based new conversations (`twitter-writer`, `logo-and-branding`, `ecommerce-product-image`), fetches the matching style library, presents options to the user, and passes the chosen style via `--ext`
- **State extraction** — after every call, extracts `thread_short_id` and `live_doc_short_id` from the stderr `[state]` line for use in the next call

### Example conversation

```
You:    Write a tweet about AI trends

Claude: Here are the available Twitter writing styles — choosing one will make
        the output more accurate:

        [Your styles]
        1. My Bold Voice

        [Recommended styles]
        2. darioamodei

        0. No preference — use default style

You:    2

Claude: [streams the tweet in darioamodei style in real time]

You:    Make it shorter

Claude: [follow-up — no style re-selection, streams updated tweet]
```

---

## Output Format

**Default (streaming plain text):**
Answer streams directly to stdout in real time. Do not summarize or re-output it.

**`--json` (suppresses streaming):**

```json
{
  "status": "ok",
  "data": {
    "answer": "Complete answer content...",
    "thread_short_id": "TvyKouzJirXjFdst4uKRK3",
    "live_doc_short_id": "PvyKouzJirXjFdst4uKRK3",
    "live_doc_url": "https://felo.ai/livedoc/...",
    "image_urls": [{"url": "...", "title": "..."}],
    "discoveries": [{"title": "Research Report"}],
    "documents": [{"title": "Generated Document"}],
    "ppts": [{"title": "Presentation"}],
    "htmls": [{"title": "HTML Page"}],
    "search_x": [{"tweets": [...]}]
  }
}
```

**State line (stderr):**

```
[state] thread_short_id=TvyKouzJirXjFdst4uKRK3 live_doc_short_id=PvyKouzJirXjFdst4uKRK3 live_doc_url=https://felo.ai/livedoc/...
```

Always extract `thread_short_id` and `live_doc_short_id` from this line for use in the next call.

---

## Complete Examples

### Example 1: Simple question

```bash
node felo-superAgent/scripts/run_superagent.mjs \
  --query "What is quantum computing?" \
  --accept-language en
```

### Example 2: Follow-up in thread

```bash
# First question — capture thread_short_id from stderr [state]
node felo-superAgent/scripts/run_superagent.mjs \
  --query "What is machine learning?" \
  --live-doc-id "PvyKouzJirXjFdst4uKRK3"

# Follow-up
node felo-superAgent/scripts/run_superagent.mjs \
  --query "Can you elaborate on neural networks?" \
  --thread-id "TvyKouzJirXjFdst4uKRK3" \
  --live-doc-id "PvyKouzJirXjFdst4uKRK3"
```

### Example 3: Tweet writing with brand style

```bash
# Fetch styles
node felo-superAgent/scripts/run_style_library.mjs --category TWITTER --accept-language en

# New conversation with chosen style
node felo-superAgent/scripts/run_superagent.mjs \
  --query "Write a tweet about AI trends" \
  --live-doc-id "PvyKouzJirXjFdst4uKRK3" \
  --skill-id twitter-writer \
  --ext '{"brand_style_requirement":"Style name: darioamodei\nStyle labels: Thoughtful long-form essays\nStyle DNA: ...（full content）"}' \
  --accept-language en
```

### Example 4: Logo design with brand style

```bash
# Fetch IMAGE styles
node felo-superAgent/scripts/run_style_library.mjs --category IMAGE --accept-language en

# New conversation with chosen style
node felo-superAgent/scripts/run_superagent.mjs \
  --query "Design a logo for my coffee shop called Bean & Brew" \
  --live-doc-id "PvyKouzJirXjFdst4uKRK3" \
  --skill-id logo-and-branding \
  --ext '{"brand_style_requirement":"Style name: Minimalist Modern\nStyle labels: clean, monochrome\nStyle DNA: ...（full content）\nCover file ID: file_333"}' \
  --accept-language en
```

---

## Tool Support

SuperAgent may invoke tools during conversation. The script automatically extracts and displays:

| Tool | Output |
|---|---|
| `generate_images` | Image URLs and titles |
| `generate_discovery` | Research report titles |
| `generate_document` | Document titles |
| `generate_ppt` | PPT titles |
| `generate_html` | HTML page titles |
| `search_x` | Tweet content, author info, metrics |

---

## Error Handling

| Error | Cause | Solution |
|---|---|---|
| `FELO_API_KEY not set` | Missing API key | Set `FELO_API_KEY` env var |
| `HTTP 401: INVALID_API_KEY` | Invalid or revoked key | Generate a new key at felo.ai |
| `SUPER_AGENT_CONVERSATION_CREATE_FAILED` (502) | Upstream error | Retry; contact support if persistent |
| Stream idle timeout | No data for 2 hours | Retry the query |
| Connection hangs | Firewall blocking SSE | Try `--verbose`; check proxy settings |

---

## Advanced Usage

### Custom API base URL

```bash
export FELO_API_BASE="https://custom-api.example.com"
node felo-superAgent/scripts/run_superagent.mjs --query "test"
```

### Resource selection

```bash
node felo-superAgent/scripts/run_superagent.mjs \
  --query "Summarize these documents" \
  --live-doc-id "PvyKouzJirXjFdst4uKRK3" \
  --selected-resource-ids "res1,res2,res3"
```

---

## References

- [SKILL.md](SKILL.md) — full agent instructions, decision logic, and style library format
- [SuperAgent API Documentation](https://openapi.felo.ai/docs/api-reference/v2/superagent.html)
- [Felo Open Platform](https://openapi.felo.ai/docs/)
- [Get API Key](https://felo.ai) (Settings → API Keys)
- [GitHub Repository](https://github.com/Felo-Inc/felo-skills)

