---
name: gemini-summary
description: Use this skill when a user provides a web page URL, PDF file, video, or audio file and wants a Traditional Chinese summary. Prefer this skill for requests like "summarize this URL", "summarize this PDF", "summarize this video", "summarize this audio", "幫我摘要這篇", "這份報告重點是什麼", "幫我總結這段影片", "幫我摘要這段錄音", or when analyzing articles, documents, presentations, YouTube videos, audio recordings, or any content that needs a zh-TW summary. Automatically detects input type (web page, PDF, video, audio) — no manual type selection needed.
required_env:
  - GEMINI_API_KEY
---

# 內容摘要 Skill

統一的摘要工具，自動偵測輸入類型（網頁 / PDF / 影片 / 音訊），使用 Gemini Interactions API 產出結構化的繁體中文（zh-TW）Markdown 摘要。

## 需求條件

- **GEMINI_API_KEY**：有效的 Google Gemini API 金鑰（設為環境變數）
- **Node.js** ≥ 20.0.0
- `scripts/summarize.js` 為預先建置的零依賴 bundle，不需 `npm install`

## 支援的輸入類型

| 類型 | 輸入格式 | 使用模型 |
|------|----------|----------|
| 網頁 | `https://example.com/article` | gemini-3-pro-preview |
| PDF | 本地 `./report.pdf` 或遠端 URL | gemini-3-pro-preview |
| 影片 | YouTube URL、影片 URL、本地影片檔、data URI | gemini-3.1-pro-preview |
| 音訊 | 本地音訊檔或遠端 URL | gemini-3-pro-preview |

### 自動偵測邏輯

- `data:` 開頭 → 影片
- HTTP/HTTPS URL：`.pdf` → PDF；影片副檔名或 YouTube 域名 → 影片；音訊副檔名 → 音訊；其他 → 網頁
- 本地檔案：`.pdf` → PDF；影片副檔名 → 影片；音訊副檔名 → 音訊
- 支援的影片格式：`.mp4`, `.mkv`, `.webm`, `.mov`, `.avi`, `.3gp`, `.m4v`, `.mpeg`, `.mpg`, `.ogv`
- 支援的音訊格式：`.mp3`, `.wav`, `.aac`, `.ogg`, `.flac`, `.m4a`, `.aiff`, `.wma`, `.opus`

## 使用方式

直接執行預建好的腳本，不需要先安裝依賴：

> ⚠️ **路徑安全**：skill 腳本位於 **repo 根目錄**的 `.agents/skills/` 下。若 cwd 不在 repo root，請先執行 `git rev-parse --show-toplevel` 取得絕對路徑，再 `cd` 到該路徑後執行。**禁止**在指令中使用 `$(...)` 語法（會被 Copilot CLI 安全過濾器擋下）。

```sh
node .agents/skills/gemini-summary/scripts/summarize.js <input>
```

### 範例

```sh
# 網頁摘要
node .agents/skills/gemini-summary/scripts/summarize.js "https://example.com/posts/agentic-workflows"

# PDF 摘要（本地檔案）
node .agents/skills/gemini-summary/scripts/summarize.js "./reports/quarterly.pdf"

# PDF 摘要（遠端 URL）
node .agents/skills/gemini-summary/scripts/summarize.js "https://example.com/report.pdf"

# 影片摘要（YouTube）
node .agents/skills/gemini-summary/scripts/summarize.js "https://youtu.be/abc123"

# 影片摘要（本地檔案）
node .agents/skills/gemini-summary/scripts/summarize.js "./clips/demo.mp4"

# 音訊摘要（本地檔案）
node .agents/skills/gemini-summary/scripts/summarize.js "./recordings/meeting.mp3"

# 音訊摘要（遠端 URL）
node .agents/skills/gemini-summary/scripts/summarize.js "https://example.com/podcast.mp3"
```

### 手動指定類型

自動偵測通常足夠，但可用 `--type` 覆蓋：

```sh
node .agents/skills/gemini-summary/scripts/summarize.js --type pdf "https://example.com/download?file=report"
node .agents/skills/gemini-summary/scripts/summarize.js --type audio "https://example.com/download?file=recording"
```

### Dry Run

設定 `SUMMARY_DRY_RUN=1` 可在不呼叫 Gemini API 的情況下，預覽輸入偵測結果（JSON 格式）：

```sh
SUMMARY_DRY_RUN=1 node .agents/skills/gemini-summary/scripts/summarize.js "https://youtu.be/abc123"
```

## 輸出格式

輸出為繁體中文 Markdown，包含以下區段：

```markdown
**📝 內容摘要**

**📌 來源**
- 類型：網頁 / PDF文件 / 影片 / 音訊
- 標題：{title}
- 網址：{url}

**💡 核心概述**
{請以流暢的段落整理脈絡，包含：主題背景、關鍵論點與結論}

**🔍 重點條列**
- {重點 1：包含具體的細節、範例或解釋}
- {重點 2：包含具體的細節、範例或解釋}
- ...

**📊 關鍵數據與事實**
（如有關鍵數字、金額、日期或事實才以條列呈現，若無則省略）
- 項目：數值/日期/事實

**🎯 行動建議**
{具體建議或「目前無明確行動建議」}
```

## Instructions for the Agent

⚠️ skill 腳本位於 **repo 根目錄**。若 cwd 不在 repo root，先獨立執行 `git rev-parse --show-toplevel` 取得路徑，再 `cd` 到該路徑後執行。禁止使用 `$(...)` 語法。

1. 確認使用者提供了 URL、PDF 檔案路徑、影片來源、或音訊檔案。
2. 確認環境中已設定 `GEMINI_API_KEY`。
3. 執行指令：
   ```sh
   node .agents/skills/gemini-summary/scripts/summarize.js "<input>"
   ```
4. 腳本會自動偵測輸入類型並選擇適當的處理方式與模型。
5. 結果以串流方式輸出到 stdout，進度與錯誤訊息輸出到 stderr。
6. 如果 exit code 為 1，表示發生錯誤，請檢查 stderr 的錯誤訊息，不要自行編造摘要。
7. 可先用 `SUMMARY_DRY_RUN=1` 測試輸入偵測是否正確。
8. 如果自動偵測不符預期，可用 `--type url|pdf|video|audio` 手動指定。

## 限制

### 網頁
- 只支援單一網址
- 不支援登入頁或高度依賴前端渲染的頁面
- 正文長度截斷至 120K 字元

### PDF
- 過大的 PDF（超過數十 MB）可能無法處理
- 掃描式 PDF 品質可能較低，建議使用有文字圖層的 PDF
- 無法處理加密 PDF

### 影片
- 遠端 URL 有 30 秒逾時限制
- 本地檔案會轉為 Base64 data URI，過大的檔案可能超出記憶體限制

### 音訊
- 遠端 URL 有 30 秒逾時限制
- 過大的音訊檔案可能超出 Gemini Files API 限制
- 支援格式：`.mp3`, `.wav`, `.aac`, `.ogg`, `.flac`, `.m4a`, `.aiff`, `.wma`, `.opus`

## 錯誤處理

| 錯誤訊息 | 說明 |
|---------|------|
| `缺少 GEMINI_API_KEY` | 未設定 API 金鑰環境變數 |
| `無法辨識輸入類型` | 輸入不是支援的 URL、PDF 或影片格式 |
| `fetch failed` | 網頁抓取失敗（網路或狀態碼問題） |
| `無法讀取檔案` | 本地檔案無法存取 |
| `下載失敗（HTTP xxx）` | 遠端 URL 回傳非 200 狀態碼 |
| `抓取逾時（30 秒）` | 遠端資源下載超過 30 秒 |

## 重建方式

`scripts/summarize.js` 是已提交的預建可執行產物；`src/summarize.js` 是可維護的原始碼。重建方式：

```sh
cd .agents/skills/gemini-summary
bun install
bun run build
```
