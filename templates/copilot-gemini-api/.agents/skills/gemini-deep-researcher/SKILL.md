---
name: gemini-deep-researcher
description: Use this skill when a user wants a comprehensive research report on any topic with cited sources. Prefer this skill for requests like "research this topic", "give me a deep analysis of", "幫我研究", "深度分析", or when the user needs a well-sourced report for decision-making, presentations, or learning. This skill uses Gemini's Deep Research agent and takes several minutes to complete.
required_env:
  - GEMINI_API_KEY
---

# Deep Researcher — 深度研究報告工具

使用 Gemini Deep Research agent 針對任意主題產出結構完整、附引用來源的繁體中文研究報告。這是唯一使用 `agent`（而非 `model`）並以 `background: true` 搭配輪詢模式運作的 skill。

## 需求條件

- Node.js ≥ 20
- 環境變數 `GEMINI_API_KEY` 或 `GOOGLE_API_KEY`
- 已執行 `bun install && bun run build`（產生 `scripts/research.js`）

## 使用方式

### 命令列引數

```bash
node .agents/skills/gemini-deep-researcher/scripts/research.js "AI 晶片市場趨勢"
```

### 管線輸入

```bash
echo "量子運算對密碼學的影響" | node .agents/skills/gemini-deep-researcher/scripts/research.js
```

### 在其他腳本中使用

```bash
TOPIC="台灣半導體產業供應鏈分析"
node .agents/skills/gemini-deep-researcher/scripts/research.js "$TOPIC" > report.md
```

## Dry Run

設定 `DEEP_RESEARCHER_DRY_RUN=1` 可在不呼叫 API 的情況下預覽將送出的請求：

```bash
DEEP_RESEARCHER_DRY_RUN=1 node .agents/skills/gemini-deep-researcher/scripts/research.js "測試主題"
```

輸出為 JSON，包含 `agent`、`background`、`prompt`、`topic` 欄位。

## 輸出格式

stdout 輸出為 Markdown 格式的研究報告，包含：

1. **摘要** — 200 字以內
2. **背景** — 主題脈絡與重要性
3. **主要發現** — 至少 3 項關鍵資訊
4. **分析** — 深入分析與比較
5. **結論與建議** — 可行建議
6. **參考來源** — 附連結的引用清單

stderr 輸出進度訊息（啟動、輪詢進度、完成）。

## Instructions for the Agent

⚠️ skill 腳本位於 **repo 根目錄**。若 cwd 不在 repo root，先獨立執行 `git rev-parse --show-toplevel` 取得路徑，再 `cd` 到該路徑後執行。禁止使用 `$(...)` 語法。

1. 確認使用者提供了研究主題（文字）。
2. 執行 `node .agents/skills/gemini-deep-researcher/scripts/research.js "<主題>"` 並將 stdout 導向檔案或直接呈現。
3. **注意：此技能使用 Gemini Deep Research agent，通常需要 2–8 分鐘才能完成。** 請提前告知使用者需要等待。
4. 進度訊息會輸出到 stderr，可據此回報等待狀態。
5. 完成後，stdout 的內容即為完整研究報告（Markdown 格式）。
6. 若需要先測試，可用 `DEEP_RESEARCHER_DRY_RUN=1` 執行確認參數正確。
7. 將報告存為 `.md` 檔案或直接呈現給使用者。

## 限制

- **執行時間長**：Deep Research agent 通常需要 2–8 分鐘，最長等待 10 分鐘後逾時。
- **背景處理**：使用 `background: true` 啟動後以輪詢方式取得結果，非即時串流。
- **API 配額**：受 Gemini API 配額限制，頻繁呼叫可能觸發速率限制。
- **語言**：報告固定輸出繁體中文（zh-TW）。

## 錯誤處理

| 情境 | 行為 |
|------|------|
| 未提供主題 | stderr 顯示用法說明，exit code 1 |
| 未設定 API key | stderr 顯示錯誤訊息，exit code 1 |
| 研究任務失敗 | stderr 顯示失敗原因，exit code 1 |
| 超過 10 分鐘 | stderr 顯示逾時錯誤，exit code 1 |
| Dry-run 模式 | stdout 輸出 JSON 預覽，不呼叫 API |
