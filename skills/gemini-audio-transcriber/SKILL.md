---
name: gemini-audio-transcriber
description: Use this skill when a user provides an audio file (local file or URL) and wants it transcribed into Traditional Chinese text. Prefer this skill for requests like "transcribe this audio", "convert speech to text", "轉錄這段錄音", "語音轉文字", or when converting meeting recordings, voice memos, or podcast clips to text. The output can be further processed by meeting-note-formatter for structured meeting notes.
---

# 音訊轉繁中逐字稿 Skill

使用 Gemini Interactions API 的原生音訊理解能力，將音訊檔案轉錄為繁體中文逐字稿。支援本機檔案與遠端 URL，當偵測到多位說話者時會自動標記區分。輸出的逐字稿可搭配 `meeting-note-formatter` skill 進一步整理為結構化會議紀錄。

## 需求條件

- `GEMINI_API_KEY` 環境變數必須設定
- 有效的遠端音訊 URL、data URI 或可讀取的本機音訊檔案
- Node.js >= 20.0.0
- 支援格式：`.mp3`、`.wav`、`.ogg`、`.flac`、`.m4a`、`.aac`、`.webm`、`.wma`

## 使用方式

直接執行預建腳本 — **不需要 `npm install` 或額外設定**：

```sh
node .agents/skills/gemini-audio-transcriber/scripts/transcribe.js <audio-path-or-url>
```

### 範例

遠端 URL：

```sh
GEMINI_API_KEY=your_api_key node .agents/skills/gemini-audio-transcriber/scripts/transcribe.js "https://example.com/audio/meeting.mp3"
```

本機檔案：

```sh
GEMINI_API_KEY=your_api_key node .agents/skills/gemini-audio-transcriber/scripts/transcribe.js "./recordings/meeting.m4a"
```

搭配 meeting-note-formatter 使用：

```sh
# 先轉錄音訊
GEMINI_API_KEY=your_api_key node .agents/skills/gemini-audio-transcriber/scripts/transcribe.js "recording.mp3" > transcript.md

# 再用 meeting-note-formatter 整理成會議紀錄
```

## Dry Run

設定 `AUDIO_TRANSCRIBER_DRY_RUN=1` 可在不呼叫 Gemini API 的情況下，預覽輸入解析結果：

```sh
AUDIO_TRANSCRIBER_DRY_RUN=1 node .agents/skills/gemini-audio-transcriber/scripts/transcribe.js "https://example.com/test.mp3"
```

輸出範例：

```json
{
  "source": "remote-url",
  "mimeType": "audio/mpeg",
  "localPath": null,
  "uriPreview": "data:audio/mpeg;base64,..."
}
```

## 輸出格式

- 輸出為繁體中文 Markdown 格式的逐字稿
- 多位說話者時使用「說話者 A」「說話者 B」等標記區分
- 無法辨識的片段標記為「[無法辨識]」
- 結果輸出至 stdout，進度與錯誤訊息輸出至 stderr

## Instructions for the Agent

⚠️ skill 腳本位於 **repo 根目錄**。若 cwd 不在 repo root，先獨立執行 `git rev-parse --show-toplevel` 取得路徑，再 `cd` 到該路徑後執行。禁止使用 `$(...)` 語法。

1. 向使用者取得音訊檔案的 URL 或本機路徑（如果尚未提供）。
2. 確認環境中已設定 `GEMINI_API_KEY`。
3. 執行轉錄腳本：
   ```sh
   node .agents/skills/gemini-audio-transcriber/scripts/transcribe.js "<audio-path-or-url>"
   ```
4. 如果輸入是本機檔案路徑或 `file://` URL，腳本會自動轉換為 Base64 data URI。
5. 將生成的逐字稿呈現給使用者。
6. 如果使用者需要進一步整理為會議紀錄，建議搭配 `meeting-note-formatter` skill 處理轉錄結果。
7. 如果腳本以非零狀態碼退出，將錯誤訊息回報給使用者。

## 限制

- 音訊檔案大小受 Gemini API 限制（建議不超過 20MB）
- 遠端 URL 下載有 30 秒逾時限制
- 轉錄品質取決於音訊清晰度與語言
- 主要針對中文語音最佳化，其他語言仍會嘗試轉錄為繁體中文

## 錯誤處理

- 缺少 `GEMINI_API_KEY` 時，腳本以狀態碼 1 退出並顯示錯誤訊息。
- 缺少音訊輸入或格式無效時，腳本以狀態碼 1 退出並顯示用法說明。
- 無法讀取本機檔案時，腳本以狀態碼 1 退出並回報路徑相關錯誤。
- 遠端 URL 下載逾時或失敗時，腳本以狀態碼 1 退出並回報網路錯誤。
- API 錯誤訊息輸出至 stderr，程序以狀態碼 1 退出。

## 重新建置

如需修改腳本，編輯 `src/transcribe.js` 後重新建置：

```sh
cd .agents/skills/gemini-audio-transcriber
bun install
bun build src/transcribe.js --outfile scripts/transcribe.js --target node --minify
```
