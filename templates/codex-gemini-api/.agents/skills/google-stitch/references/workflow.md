# google-stitch skill workflow

這個 skill 是 repo 內 `google-stitch` tool 的薄包裝，目的是讓 agent 能直接用 `.agents/skills` 的方式產生設計圖與 HTML，而不必重新實作 Gemini 呼叫。

## 實作來源

- runtime wrapper：`.agents/skills/google-stitch/scripts/generate.js`
- underlying tool bundle：`.github/scripts/tools/google-stitch.mjs`

## 執行流程

1. 解析 CLI 參數
2. 組出 tool request：
   - `prompt`
   - `aspectRatio`
   - `imageSize`
   - `model`
3. 從環境讀取：
   - `GEMINI_API_KEY`
   - 或 `GOOGLE_API_KEY`
4. 呼叫 `tool.handler(request, { secrets: { apiKey } })`
5. 將結果寫成檔案：
   - HTML → `design.html`
   - 圖片 → `design.png` / `design.jpg` / `design.webp`
6. 回傳 stdout JSON，方便 agent 繼續使用

## CLI flags

| flag | 說明 |
| --- | --- |
| `--prompt` | 必填，設計提示詞 |
| `--aspect-ratio` | 圖片比例 |
| `--image-size` | 解析度：`512` / `1K` / `2K` / `4K` |
| `--model` | `gemini-3.1-flash-image-preview` 或 `gemini-3-pro-image-preview` |
| `--output-dir` | 預設輸出目錄 |
| `--html-out` | HTML 檔完整路徑 |
| `--image-out` | 圖片檔完整路徑 |

## Dry run

設定：

```sh
GOOGLE_STITCH_DRY_RUN=1
```

會只輸出解析後的 request 與輸出路徑，不會真的呼叫 Gemini API。

## 輸出行為

- 若模型只回傳圖片，腳本只會寫出 `imagePath`
- 若模型只回傳 HTML，腳本只會寫出 `htmlPath`
- 若兩者都有，兩個檔案都會建立

## 注意事項

- 這個 wrapper 依賴已提交的 tool bundle，因此在本 repo 中可零安裝使用。
- 若未來 `tools/src/google-stitch` 的 contract 改變，這裡要同步更新。
