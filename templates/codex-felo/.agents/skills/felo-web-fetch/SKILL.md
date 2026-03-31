---
name: felo-web-fetch
description: "Extract webpage content with Felo Web Extract API. Use for turning URLs into html/markdown/text, selecting specific page areas with CSS selectors, and controlling extraction options like crawl mode, cookies, user-agent, and timeout."
---

# Felo Web Fetch Skill

## When to Use

Trigger this skill when users want to extract or convert webpage content from a URL:

- Fetch or scrape content from a webpage URL
- Convert webpage content to `html`, `markdown`, or `text`
- Extract specific blocks using CSS selector
- Get article/main text from a link with readability mode
- Tune extraction behavior with crawl mode (`fast`/`fine`)
- Pass request details such as cookies, user-agent, timeout

Trigger keywords (examples):

- fetch webpage, scrape URL, fetch page content, web fetch, url to markdown
- Explicit: `/felo-web-fetch`, "use felo web fetch", "extract this URL with felo"
- Same intent in other languages (e.g. 网页抓取, 提取网页内容) also triggers this skill

Do NOT use this skill for:

- Real-time Q&A search summaries (use `felo-search`)
- Slide generation tasks (use `felo-slides`)
- Local file parsing in current workspace

## Setup

### 1. Get API key

1. Visit [felo.ai](https://felo.ai)
2. Open Settings -> API Keys
3. Create and copy your API key

### 2. Configure environment variable

Linux/macOS:
```bash
export FELO_API_KEY="your-api-key-here"
```

Windows PowerShell:
```powershell
$env:FELO_API_KEY="your-api-key-here"
```

## How to Execute

### Option A: Use the bundled script or packaged CLI

**Script** (from repo):

```bash
node .agents/skills/felo-web-fetch/scripts/run_web_fetch.mjs --url "https://example.com/article" [options]
```

**Packaged CLI** (after `npm install -g felo-ai`): same options, with short forms allowed:

```bash
felo web-fetch -u "https://example.com" [options]
# Short forms: -u (url), -f (format), -t (timeout, seconds), -j (json)
```

Required parameter:
- `--url`

Core optional parameters:
- `--output-format html|markdown|text`
- `--crawl-mode fast|fine`
- `--target-selector "article.main-content"`
- `--wait-for-selector ".content-ready"`

Other key optional parameters:
- `--cookie "session_id=xxx"` (repeatable)
- `--set-cookies-json '[{"name":"sid","value":"xxx","domain":"example.com"}]'`
- `--user-agent "Mozilla/5.0 ..."`
- `--timeout 60` (HTTP request timeout in seconds)
- `--request-timeout-ms 15000` (API payload `timeout` in ms)
- `--with-readability true`
- `--with-links-summary true`
- `--with-images-summary true`
- `--with-images-readability true`
- `--with-images true`
- `--with-links true`
- `--ignore-empty-text-image true`
- `--with-cache false`
- `--with-stypes true`
- `--json` (print full JSON response)

### How to write instructions (target_selector + output_format)

When the user wants a **specific part** of the page or a **specific output format**, phrase the command like this:

- **Output format**: "Fetch as **text**" / "Get **markdown**" / "Return **html**" → use `--output-format text`, `--output-format markdown`, or `--output-format html`.
- **Target one element**: "Only the **main article**" / "Just the **content inside** `#main`" / "Fetch only **article.main-content**" → use `--target-selector "article.main"` or the selector they give.

Examples:

```bash
# Basic: fetch as Markdown
node .agents/skills/felo-web-fetch/scripts/run_web_fetch.mjs --url "https://example.com" --output-format markdown

# Article-style with readability
node .agents/skills/felo-web-fetch/scripts/run_web_fetch.mjs --url "https://example.com/article" --with-readability true --output-format markdown

# Only the element matching a CSS selector
node .agents/skills/felo-web-fetch/scripts/run_web_fetch.mjs --url "https://example.com" --target-selector "article.main" --output-format markdown

# With cookies and custom user-agent
node .agents/skills/felo-web-fetch/scripts/run_web_fetch.mjs --url "https://example.com/private" --cookie "session_id=abc123" --with-readability true --json

# Full JSON response
node .agents/skills/felo-web-fetch/scripts/run_web_fetch.mjs --url "https://example.com" --output-format text --json
```

### Option B: Call API with curl

```bash
curl -X POST "https://openapi.felo.ai/v2/web/extract" \
  -H "Authorization: Bearer $FELO_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com", "output_format": "markdown", "with_readability": true}'
```

## API Reference (summary)

- **Endpoint**: `POST /v2/web/extract`
- **Base URL**: `https://openapi.felo.ai`. Override with `FELO_API_BASE` env if needed.
- **Auth**: `Authorization: Bearer YOUR_API_KEY`

### Request body (JSON)

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| url | string | Yes | - | Webpage URL to fetch |
| crawl_mode | string | No | fast | `fast` or `fine` |
| output_format | string | No | html | `html`, `text`, `markdown` |
| with_readability | boolean | No | - | Use readability (main content) |
| with_links_summary | boolean | No | - | Include links summary |
| with_images_summary | boolean | No | - | Include images summary |
| target_selector | string | No | - | CSS selector for target element |
| wait_for_selector | string | No | - | Wait for selector before fetch |
| timeout | integer | No | - | Timeout in milliseconds |
| with_cache | boolean | No | true | Use cache |
| set_cookies | array | No | - | Cookie entries |
| user_agent | string | No | - | Custom user-agent |

### Response

Success (200):

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "content": { ... }
  }
}
```

Fetched content is in `data.content`; structure depends on `output_format`.

### Error codes

| HTTP | Code | Description |
|------|------|-------------|
| 400 | - | Parameter validation failed |
| 401 | INVALID_API_KEY | API key invalid or revoked |
| 500/502 | WEB_EXTRACT_FAILED | Fetch failed (server or page error) |

## Output Format

- Default output is extracted content only (for direct use or piping).
- If response content is not a string, script prints JSON.
- Use `--json` when user needs metadata and full response object.

Error response format:

```markdown
## Web Fetch Failed
- Message: <error message>
- Suggested Action: verify URL/parameters and retry
```

## Important Notes

- ⚠️ **路徑安全**：skill 腳本位於 repo root 的 `.agents/skills/` 下。若 cwd 不在 repo root，先執行 `git rev-parse --show-toplevel` 取得路徑再 `cd`。禁止用 `$(...)` 語法。
- Always require URL before running.
- Validate enum values:
  - `output_format`: `html`, `markdown`, `text`
  - `crawl_mode`: `fast`, `fine`
- Use `--target-selector` when users only want a specific part of the page.
- Use `--request-timeout-ms` for page rendering/extraction wait, and `--timeout` for local HTTP timeout.
- For long articles or slow sites, consider increasing `--timeout`.
- API may cache results; use `--with-cache false` only when fresh content is required.

## References

- [Web Extract API](https://openapi.felo.ai/docs/api-reference/v2/web-extract.html)
- [Felo Open Platform](https://openapi.felo.ai/docs/)
