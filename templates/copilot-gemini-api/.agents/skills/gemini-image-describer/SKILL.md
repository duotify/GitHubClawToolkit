---
name: gemini-image-describer
description: Use this skill when a user provides an image (local file or URL) and wants a detailed Traditional Chinese description of the image content. Prefer this skill for requests like "describe this image", "what's in this picture", "OCR this screenshot", "辨識這張圖", "描述這張照片", or when extracting text from screenshots or photos.
required_env:
  - GEMINI_API_KEY
---

# Image Describer Skill

此技能使用 Gemini Interactions API 的原生圖片理解能力，分析圖片並產生繁體中文（zh-TW）Markdown 描述，包含圖片場景描述、文字辨識（OCR）與關鍵物件列表。支援本地檔案路徑、遠端 URL 與 data URI。

## 需求條件

- `GEMINI_API_KEY` 環境變數必須已設定
- 有效的遠端圖片 URL、data URI 或可讀取的本地圖片檔案路徑
- Node.js >= 20.0.0

## 使用方式

直接執行預建置腳本 — **不需要 `npm install` 或其他額外設定**：

```sh
node .agents/skills/gemini-image-describer/scripts/describe.js <image-path-or-url>
```

### 範例

```sh
GEMINI_API_KEY=your_api_key node .agents/skills/gemini-image-describer/scripts/describe.js "https://example.com/photo.jpg"
```

```sh
GEMINI_API_KEY=your_api_key node .agents/skills/gemini-image-describer/scripts/describe.js "./photos/screenshot.png"
```

```sh
GEMINI_API_KEY=your_api_key node .agents/skills/gemini-image-describer/scripts/describe.js "data:image/png;base64,iVBOR..."
```

## Dry Run

設定 `IMAGE_DESCRIBER_DRY_RUN=1` 可在不呼叫 Gemini API 的情況下，預覽解析後的輸入 metadata：

```sh
IMAGE_DESCRIBER_DRY_RUN=1 node .agents/skills/gemini-image-describer/scripts/describe.js "https://example.com/photo.jpg"
```

## 輸出格式

輸出為繁體中文 Markdown，包含以下區段：

- **圖片描述** — 整體場景與內容描述
- **文字辨識（OCR）** — 圖片中可辨識的文字
- **關鍵物件** — 畫面中的關鍵物件列表

## Instructions for the Agent

⚠️ skill 腳本位於 **repo 根目錄**。若 cwd 不在 repo root，先獨立執行 `git rev-parse --show-toplevel` 取得路徑，再 `cd` 到該路徑後執行。禁止使用 `$(...)` 語法。

⚠️ **必須執行腳本**，不可用自身視覺能力直接回答圖片內容。所有圖片分析結果必須來自腳本輸出。

1. 向使用者取得圖片 URL 或本地檔案路徑（若尚未提供）。
2. 確認環境中已設定 `GEMINI_API_KEY`。
3. **必須**執行描述腳本，並將輸出直接寫入 `artifacts/{issue-comment-id}/result.md`：
   ```sh
   mkdir -p artifacts/{issue-comment-id}
   node .agents/skills/gemini-image-describer/scripts/describe.js "<image-path-or-url>" > artifacts/{issue-comment-id}/result.md
   ```
4. 若輸入為本地檔案路徑或 `file://` URL，腳本會自動轉換為 Base64 data URI。
5. 讀取 `artifacts/{issue-comment-id}/result.md` 並將內容呈現給使用者。
6. 若腳本以非零代碼結束，回報 stderr 錯誤訊息，不可自行補充圖片描述。

## 限制

- 支援的圖片格式：JPEG、PNG、GIF、WebP、BMP、SVG
- 本地大型圖片檔案會轉為 Base64，可能消耗較多記憶體
- 遠端 URL 必須可被 Gemini API 直接存取
- OCR 準確度取決於圖片品質與文字清晰度

## 錯誤處理

- 若 `GEMINI_API_KEY` 未設定，腳本會以代碼 1 結束並印出錯誤訊息。
- 若圖片輸入缺失或無效，腳本會以代碼 1 結束並印出用法說明。
- 若本地檔案無法讀取，腳本會以代碼 1 結束並回報路徑相關錯誤。
- API 錯誤會輸出到 stderr，程序以代碼 1 結束。

## 實作備註

- `scripts/describe.js` 是預建置的零依賴 bundle（由 Bun 從 `src/describe.js` 建置）。
- 模型：`gemini-3-flash-preview`（快速、平衡，適合圖片理解）。
- 遠端 URL 直接作為 `image` part 的 `uri` 傳入。
- 本地檔案轉換為 Base64 `data:<mime>;base64,...` URI 後傳送。
- 設定 `IMAGE_DESCRIBER_DRY_RUN=1` 可預覽解析後的輸入 metadata，不呼叫 Gemini API。
- 輸出以串流方式寫入 stdout，即時顯示。
- 需要 Node.js >= 20.0.0。

## 從原始碼重新建置

若需修改腳本，編輯 `src/describe.js` 後重新建置：

```sh
cd .agents/skills/gemini-image-describer
bun install
bun build src/describe.js --outfile scripts/describe.js --target node --minify
```
