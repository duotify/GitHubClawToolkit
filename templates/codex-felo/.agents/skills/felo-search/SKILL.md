---
name: felo-search
description: "Felo AI real-time web search for questions requiring current/live information. Triggers on current events, news, trends, real-time data, information queries, location queries, how-to guides, shopping, or when Claude's knowledge may be outdated."
---

# Felo Search Skill

## When to Use

Trigger this skill for questions requiring current or real-time information:

- **Current events & news:** Recent developments, trending topics, breaking news
- **Real-time data:** Weather, stock prices, exchange rates, sports scores
- **Information queries:** "What is...", "Tell me about...", product reviews, comparisons, recommendations
- **Location-based:** Restaurants, travel destinations, local attractions, things to do
- **How-to guides:** Tutorials, step-by-step instructions, best practices
- **Shopping & prices:** Product prices, deals, "where to buy"
- **Trends & statistics:** Market trends, rankings, data analysis
- **Any question where Claude's knowledge may be outdated**

**Trigger words:**
- 简体中文: 最近、什么、哪里、怎么样、如何、查、搜、找、推荐、比较、新闻、天气
- 繁體中文: 最近、什麼、哪裡、怎麼樣、如何、查、搜、找、推薦、比較、新聞、天氣
- 日本語: 最近、何、どこ、どう、検索、探す、おすすめ、比較、ニュース、天気
- English: latest, recent, what, where, how, best, search, find, compare, news, weather

**Explicit commands:** `/felo-search`, "search with felo", "felo search"

**Do NOT use for:**
- Code questions about the user's codebase (unless asking about external libraries/docs)
- Pure mathematical calculations or logical reasoning
- Questions about files in the current project

## Setup

### 1. Get Your API Key

1. Visit [felo.ai](https://felo.ai) and log in (or register)
2. Click your avatar in the top right corner → Settings
3. Navigate to the "API Keys" tab
4. Click "Create New Key" to generate a new API Key
5. Copy and save your API Key securely

### 2. Configure API Key

Set the `FELO_API_KEY` environment variable:

**Linux/macOS:**
```bash
export FELO_API_KEY="your-api-key-here"
```

**Windows (PowerShell):**
```powershell
$env:FELO_API_KEY="your-api-key-here"
```

**Windows (CMD):**
```cmd
set FELO_API_KEY=your-api-key-here
```

For permanent configuration, add it to your shell profile (~/.bashrc, ~/.zshrc) or system environment variables.

## How to Execute

When this skill is triggered, execute the search script using the Bash tool:

```bash
bash .agents/skills/felo-search/scripts/search.sh "USER_QUERY_HERE"
```

> ⚠️ **路徑安全**：skill 腳本位於 **repo 根目錄**的 `.agents/skills/` 下。若 cwd 不在 repo root，請先執行 `git rev-parse --show-toplevel` 取得絕對路徑，再 `cd` 到該路徑後執行。**禁止**在指令中使用 `$(...)` 語法（會被 Copilot CLI 安全過濾器擋下）。

**Notes:**
- Replace `USER_QUERY_HERE` with the actual user query
- The script handles API key validation, JSON escaping, and API calls
- Supports all special characters, Unicode (Chinese, Japanese, etc.), and quotes

### Parse and Format Response

The API returns JSON with this structure:
```json
{
  "answer": "AI-generated answer text",
  "query_analysis": ["optimized query 1", "optimized query 2"]
}
```

Present the response to the user in this format:

```
## Answer
[Display the answer field]

## Query Analysis
Optimized search terms: [list query_analysis items]
```

## Complete Examples

### Example 1: Weather query

**User asks:** "What's the weather in Tokyo today?"

**Expected response format:**
```
## Answer
Tokyo weather today: Sunny, 22°C (72°F). High of 25°C, low of 18°C.
Light winds from the east at 10 km/h. UV index: 6 (high).
Good day for outdoor activities!

## Query Analysis
Optimized search terms: Tokyo weather today, 東京 天気 今日
```

**Bash command:**
```bash
bash .agents/skills/felo-search/scripts/search.sh "What's the weather in Tokyo today?"
```

### Example 2: Local news / events

**User asks:** "What's new in Hangzhou recently?"

**Expected response format:**
```
## Answer
Recent news in Hangzhou: Asian Games venue upgrades completed, West Lake night tours launched, new metro lines opened. Details...

## Query Analysis
Optimized search terms: Hangzhou recent news, Hangzhou events, 杭州 最近 新闻
```

**Bash command:**
```bash
bash .agents/skills/felo-search/scripts/search.sh "What's new in Hangzhou recently"
```

### Example 3: Travel / things to do

**User asks:** "What are the best things to do in Taipei?"

**Bash command:**
```bash
bash .agents/skills/felo-search/scripts/search.sh "What are the best things to do in Taipei"
```

### Example 4: Restaurants / recommendations

**User asks:** "Popular restaurants in Tokyo?"

**Bash command:**
```bash
bash .agents/skills/felo-search/scripts/search.sh "Popular restaurants in Tokyo"
```

## Error Handling

### Common Error Codes

- `INVALID_API_KEY` - API Key is invalid or revoked
  - Solution: Check if your API key is correct and hasn't been revoked
- `MISSING_PARAMETER` - Required parameter is missing
  - Solution: Ensure the query parameter is provided
- `INVALID_PARAMETER` - Parameter value is invalid
  - Solution: Check the query format
- `CHAT_FAILED` - Internal service error
  - Solution: Retry the request or contact Felo support

### Missing API Key

If `FELO_API_KEY` is not set, display this message:

```
❌ Felo API Key not configured

To use this skill, you need to set up your Felo API Key:

1. Get your API key from https://felo.ai (Settings → API Keys)
2. Set the environment variable:

   Linux/macOS:
   export FELO_API_KEY="your-api-key-here"

   Windows (PowerShell):
   $env:FELO_API_KEY="your-api-key-here"

3. Restart Claude Code or reload the environment
```

## API Configuration

**Endpoint:** `https://openapi.felo.ai/v2/chat`

**Authentication:** Bearer token in Authorization header (from `FELO_API_KEY` environment variable)

**Request format:**
```json
{
  "query": "user's search query"
}
```

**Response format:**
```json
{
  "answer": "AI-generated comprehensive answer",
  "query_analysis": ["optimized query 1", "optimized query 2"]
}
```

## Important Notes

- ⚠️ **路徑安全**：skill 腳本位於 repo root 的 `.agents/skills/` 下。若 cwd 不在 repo root，先執行 `git rev-parse --show-toplevel` 取得路徑再 `cd`。禁止用 `$(...)` 語法。
- This skill should be used for any question requiring current information
- Execute immediately using the Bash tool - don't just describe what you would do
- Multi-language support: Fully supports Simplified Chinese, Traditional Chinese (Taiwan), Japanese, and English
- Handle special characters properly: Use the search script which handles JSON escaping via sed
- Parse JSON response: Extract answer and query_analysis fields
- Format nicely: Present results in a clean, readable format with proper markdown
- The API returns results in the same language as the query when possible

## Additional Resources

- [Felo Open Platform Documentation](https://openapi.felo.ai)
- [Get API Key](https://felo.ai) (Settings → API Keys)
- [API Reference](https://openapi.felo.ai/docs)
