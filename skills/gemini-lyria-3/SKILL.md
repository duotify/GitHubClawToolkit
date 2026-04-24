---
name: gemini-lyria-3
description: Use this skill when the user wants to generate music or audio tracks from lyrics or text prompts using Gemini Lyria-3, including AI music composition, audio generation, track creation, and requests like "幫我作一首歌", "生成音樂", "根據這段歌詞產生音軌", or "compose a track".
required_env:
  - GEMINI_API_KEY
---

# Gemini Lyria-3 音樂生成 Skill

使用 Google Lyria-3 模型，從歌詞或文字提示詞生成 AI 音樂音軌，並將結果儲存為音訊檔案。

## 需求條件

- **GEMINI_API_KEY**：有效的 Google Gemini API 金鑰（設為環境變數）
- **Node.js** ≥ 20.0.0
- `scripts/generate-track.js` 為預先建置的零依賴 bundle，不需 `npm install`

## 使用方式

> ⚠️ **路徑安全**：skill 腳本位於 **repo 根目錄**的 `.agents/skills/` 下。若 cwd 不在 repo root，請先獨立執行 `git rev-parse --show-toplevel` 取得絕對路徑，再 `cd` 到該路徑後執行。**禁止**在指令中使用 `$(...)` 語法（會被 Copilot CLI 安全過濾器擋下）。

腳本透過環境變數接收所有參數：

| 環境變數 | 必填 | 說明 |
|----------|------|------|
| `GEMINI_API_KEY` | ✅ | Google Gemini API 金鑰 |
| `PROMPT_FILE` | ✅ | 包含歌詞或提示詞的文字檔路徑 |
| `ISSUE_DIR` | ✅ | 音訊檔案輸出目錄 |
| `NAME_PREFIX` | ❌ | 輸出檔案名稱前綴（預設：`track`） |
| `LYRIA_MODEL` 或 `MODEL` | ❌ | 使用的模型（預設：`lyria-3-pro-preview`） |

### 範例

```sh
# 先取得 repo root（獨立執行，不使用 $()）
git rev-parse --show-toplevel

# 再 cd 到 repo root 後執行：
PROMPT_FILE="./lyrics.txt" \
ISSUE_DIR="./music-output" \
node .agents/skills/gemini-lyria-3/scripts/generate-track.js
```

## 輸出格式

腳本執行後：
- 每個生成的音軌儲存為音訊檔案（格式依 API 回傳的 MIME type 決定，通常為 `.mp3`）
- stdout 輸出每個儲存的相對路徑，格式為 `Saved: <path>`
- stderr 輸出進度訊息與錯誤

成功後請以下列格式回報結果：

```
🎵 音樂生成完成！

- [track-0.mp3](https://github.com/{GITHUB_REPO}/blob/{BRANCH}/{path}?raw=true)

<!-- githubclaw-artifacts: {"audio":[{"branch":"{BRANCH}","path":"{path}"}],"html":[]} -->
```

## Instructions for the Agent

⚠️ skill 腳本位於 **repo 根目錄**。若 cwd 不在 repo root，先獨立執行 `git rev-parse --show-toplevel` 取得路徑，再 `cd` 到該路徑後執行。禁止使用 `$(...)` 語法。

1. 確認使用者提供了歌詞內容或文字提示詞。
2. 將歌詞或提示詞寫入暫時文字檔（例如 `./lyrics.txt`）。
3. 設定 `ISSUE_DIR` 為音訊輸出目錄（建議使用 `./music-output` 或 issue 的 artifacts 目錄）。
4. 確認環境中已設定 `GEMINI_API_KEY`。
5. 執行腳本：
   ```sh
   PROMPT_FILE="./lyrics.txt" ISSUE_DIR="./music-output" node .agents/skills/gemini-lyria-3/scripts/generate-track.js
   ```
6. 解析 stdout 中 `Saved: <path>` 行取得生成的音軌路徑。
7. 以 Markdown 連結格式回報每個音軌，加上 `githubclaw-artifacts` metadata 供 Telegram relay 使用。
8. 若 exit code 非 0，檢查 stderr 錯誤訊息，不要自行編造結果。

## 錯誤處理

| 錯誤訊息 | 說明 |
|---------|------|
| `缺少 GEMINI_API_KEY` | 未設定 API 金鑰環境變數 |
| `缺少 PROMPT_FILE 環境變數` | 未指定歌詞/提示詞檔案路徑 |
| `缺少 ISSUE_DIR 環境變數` | 未指定輸出目錄 |
| `... 內容為空，無法生成音樂` | 歌詞/提示詞檔案為空 |
| `API 未回傳任何音訊資料` | API 沒有回傳音訊，請確認模型與 API Key |