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
| `ISSUE_DIR` | ✅ | 音訊檔案輸出目錄，**必須使用 `artifacts/{issue-comment-id}`**（即 result.md 所在目錄，comment_id 從任務提示詞的 `artifacts/XXXXX/result.md` 取得） |
| `BRANCH` | ❌ | 目前 Git 分支名稱（填入後 metadata 自動完整，否則需手動補 branch） |
| `NAME_PREFIX` | ❌ | 輸出檔案名稱前綴（預設：`track`） |
| `LYRIA_MODEL` 或 `MODEL` | ❌ | 使用的模型（預設：`lyria-3-pro-preview`） |

### 範例

```sh
# 先取得 repo root（獨立執行，不使用 $()）
git rev-parse --show-toplevel

# 再 cd 到 repo root 後執行（COMMENT_ID 從任務提示詞取得，BRANCH 填入當前分支）：
PROMPT_FILE="./lyrics.txt" \
ISSUE_DIR="artifacts/4311701680" \
BRANCH="issue-2" \
node .agents/skills/gemini-lyria-3/scripts/generate-track.js
```

## 輸出格式

腳本執行成功後，stdout 會輸出：
1. 每個儲存的相對路徑，格式為 `Saved: <path>`
2. 一個 `=== 複製以下內容到 result.md ===` 區塊，包含：
   - 音訊路徑的 backtick 格式（例如 `` `artifacts/4311701680/track-0.mp3` ``）
   - 完整的 `githubclaw-artifacts` metadata block

**直接將腳本輸出的「複製以下內容」區塊放進 result.md。** 不要修改、也不要替換成「已附上音訊」等文字。

## Instructions for the Agent

⚠️ skill 腳本位於 **repo 根目錄**。若 cwd 不在 repo root，先獨立執行 `git rev-parse --show-toplevel` 取得路徑，再 `cd` 到該路徑後執行。禁止使用 `$(...)` 語法。

1. 確認使用者提供了歌詞內容或文字提示詞。
2. 將歌詞或提示詞寫入暫時文字檔（例如 `./lyrics.txt`）。
3. 從任務提示詞（`artifacts/{COMMENT_ID}/result.md`）取得 COMMENT_ID；執行 `git branch --show-current` 取得 BRANCH（獨立執行，不用 `$()`）。
4. 確認環境中已設定 `GEMINI_API_KEY`。
5. 執行腳本，**`ISSUE_DIR` 必須設為 `artifacts/{COMMENT_ID}`**（不可用 `./music-output`）：
   ```sh
   PROMPT_FILE="./lyrics.txt" ISSUE_DIR="artifacts/4311701680" BRANCH="issue-2" node .agents/skills/gemini-lyria-3/scripts/generate-track.js
   ```
6. 從 stdout 的「複製以下內容到 result.md」區塊，取得 backtick 路徑與 `githubclaw-artifacts` metadata。
7. 將這些內容原封不動放入 result.md，連同任務結果說明一起回報。
   - ✅ 正確：`` `artifacts/4311701680/track-0.mp3` ``
   - ❌ 錯誤：「已附上音訊」、「已附上圖片」、只寫 `track-0.mp3`
8. 若 exit code 非 0，檢查 stderr 錯誤訊息，不要自行編造結果。

## 錯誤處理

| 錯誤訊息 | 說明 |
|---------|------|
| `缺少 GEMINI_API_KEY` | 未設定 API 金鑰環境變數 |
| `缺少 PROMPT_FILE 環境變數` | 未指定歌詞/提示詞檔案路徑 |
| `缺少 ISSUE_DIR 環境變數` | 未指定輸出目錄 |
| `... 內容為空，無法生成音樂` | 歌詞/提示詞檔案為空 |
| `API 未回傳任何音訊資料` | API 沒有回傳音訊，請確認模型與 API Key |


