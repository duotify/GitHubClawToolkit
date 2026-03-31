---
name: felo-x-search
description: "Search X (Twitter) data using Felo X Search API. Use when users ask about X/Twitter users, tweets, trending topics on X, tweet replies, or when explicit commands like /felo-x-search are used. Supports user lookup, user search, user tweets, tweet search, and tweet replies."
---

# Felo X Search Skill

## When to Use

Trigger this skill when the user wants to:

- Look up X (Twitter) user profiles by username
- Search for X users by keyword
- Get tweets from a specific X user
- Search tweets by keyword or advanced query
- Get replies to specific tweets

Trigger keywords (examples):

- English: twitter, tweet, X user, X search, tweets from, replies to, trending on X
- 简体中文: 推特, 推文, X用户, X搜索, 推文回复
- 日本語: ツイッター, ツイート, Xユーザー, X検索

Explicit commands: `/felo-x-search`, "search X", "search twitter"

Do NOT use for:

- General web search (use `felo-search`)
- Webpage extraction (use `felo-web-extract`)
- Generating slides (use `felo-slides`)

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

**Packaged CLI** (after `npm install -g felo-ai`):

```bash
felo x [query] [options]
```

**Script** (from repo):

```bash
node .agents/skills/felo-x-search/scripts/run_x_search.mjs [query] [options]
```

### Usage Pattern

The `x` command uses parameter combinations to infer intent — no subcommands needed.

**With query (search mode):**

| Usage | Behavior |
|-------|----------|
| `felo x "AI news"` | Search tweets (default) |
| `felo x -q "AI news"` | Same as above |
| `felo x "OpenAI" --user` | Search users |

**With --id (lookup mode):**

| Usage | Behavior |
|-------|----------|
| `felo x --id "1234567890"` | Get tweet replies (default) |
| `felo x --id "elonmusk" --user` | Get user info |
| `felo x --id "elonmusk" --user --tweets` | Get user tweets |

### Options

| Option | Description |
|--------|-------------|
| `[query]` | Positional arg, search keyword (equivalent to -q) |
| `-q, --query <text>` | Search keyword |
| `--id <values>` | Tweet IDs or usernames (comma-separated) |
| `--user` | Switch to user mode |
| `--tweets` | Get user tweets (with --id --user) |
| `-l, --limit <n>` | Number of results |
| `--cursor <str>` | Pagination cursor |
| `--include-replies` | Include replies (with --tweets) |
| `--query-type <type>` | Query type filter (tweet search) |
| `--since-time <val>` | Start time filter |
| `--until-time <val>` | End time filter |
| `-j, --json` | Output raw JSON |
| `-t, --timeout <seconds>` | Timeout in seconds (default: 30) |

### Option B: Call API with curl

```bash
# Search tweets
curl -X POST "https://openapi.felo.ai/v2/x/tweet/search" \
  -H "Authorization: Bearer $FELO_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query": "AI news", "limit": 20}'

# Search users
curl -X POST "https://openapi.felo.ai/v2/x/user/search" \
  -H "Authorization: Bearer $FELO_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query": "artificial intelligence"}'

# Get user info
curl -X POST "https://openapi.felo.ai/v2/x/user/info" \
  -H "Authorization: Bearer $FELO_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"usernames": ["elonmusk", "OpenAI"]}'

# Get user tweets
curl -X POST "https://openapi.felo.ai/v2/x/user/tweets" \
  -H "Authorization: Bearer $FELO_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"username": "elonmusk", "limit": 20}'

# Get tweet replies
curl -X POST "https://openapi.felo.ai/v2/x/tweet/replies" \
  -H "Authorization: Bearer $FELO_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"tweet_ids": ["1234567890"]}'
```

## Output Format

### User Info (default, non-JSON)

```markdown
## @elonmusk (Elon Musk 🔵)
- User ID: `44196397`
- Followers: 100.0M
- Following: 500
- Total Tweets: 30.0K
- Bio: ...
- Location: Mars
- Account Created: 2009-06-02T00:00:00Z

---
```

### Tweet (default, non-JSON)

```markdown
### @elonmusk(Elon Musk ✓)
- Posted: 2026-03-09T12:00:00Z ｜ Tweet ID: `1234567890`

Tweet content here...

Engagement: 5.0K likes ｜ 1.0K retweets ｜ 200 replies

---
```

## Error Handling

### Common Error Codes

- `INVALID_API_KEY` — API Key is invalid or revoked
- `X_SEARCH_FAILED` — X search request failed (check parameters or downstream error)

### Missing API Key

If `FELO_API_KEY` is not set, display setup instructions and stop.

## API Reference (summary)

- **Base URL**: `https://openapi.felo.ai`. Override with `FELO_API_BASE` env if needed.
- **Auth**: `Authorization: Bearer YOUR_API_KEY`
- **Endpoints**:
  - `POST /v2/x/user/info` — Batch get user profiles
  - `POST /v2/x/user/search` — Search users
  - `POST /v2/x/user/tweets` — Get user tweets
  - `POST /v2/x/tweet/search` — Search tweets
  - `POST /v2/x/tweet/replies` — Get tweet replies

## Important Notes

- ⚠️ **路徑安全**：skill 腳本位於 repo root 的 `.agents/skills/` 下。若 cwd 不在 repo root，先執行 `git rev-parse --show-toplevel` 取得路徑再 `cd`。禁止用 `$(...)` 語法。
- Always check `FELO_API_KEY` before calling; if missing, return setup instructions.
- Format output as readable Markdown by default; use `--json` for raw API response.
- Use pagination cursors (`next_cursor`) for fetching more results.
- For tweet search, advanced query syntax is supported (same as X advanced search).

## References

- [Felo X Search API](https://openapi.felo.ai/docs/api-reference/v2/x-search.html)
- [Felo Open Platform](https://openapi.felo.ai/docs/)
