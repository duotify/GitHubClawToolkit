---
name: google-stitch
description: Use this skill when users want to generate UI mockups, landing pages, wireframes, design concepts, marketing sections, or page prototypes from a prompt and need both a design image and matching HTML. Prefer this skill whenever the user asks for「設計圖 + HTML」、「UI 原型」、「Landing Page 草稿」、「prompt 生成介面」或 Google Stitch / Stitch with Google style workflows.
---

# Google Stitch 設計生成 Skill

此技能會重用 repo 內已經存在的 `google-stitch` tool bundle，從提示詞一次產出：

- 設計圖片（寫入本地檔案）
- 對應 HTML（寫入本地檔案）
- stdout JSON 結果，方便後續自動化流程接續

## 需求條件

- `GEMINI_API_KEY` 或 `GOOGLE_API_KEY`
- Node.js `>=20.0.0`
- repo 內已存在 `.github/scripts/google-stitch.mjs`

## 使用方式

直接執行 skill 腳本：

```sh
node .agents/skills/google-stitch/scripts/generate.js --prompt "一個現代 SaaS 產品首頁，深色主題，含 pricing cards 與 CTA 區塊"
```

### 常用範例

```sh
node .agents/skills/google-stitch/scripts/generate.js \
  --prompt "設計一個電商首頁 Hero 區塊，米白背景、精品感、右側產品主視覺" \
  --aspect-ratio 16:9 \
  --image-size 2K \
  --output-dir /tmp/stitch-hero
```

```sh
GOOGLE_STITCH_DRY_RUN=1 node .agents/skills/google-stitch/scripts/generate.js \
  --prompt "手機版登入頁，極簡、白底、藍色主按鈕"
```

## 輸出結果

預設會把結果存到 `./google-stitch-output/`：

- `design.html`
- `design.png` 或 `design.jpg`

stdout 會輸出 JSON，例如：

```json
{
  "htmlPath": "/abs/path/google-stitch-output/design.html",
  "imagePath": "/abs/path/google-stitch-output/design.png",
  "imageMimeType": "image/png",
  "model": "gemini-3.1-flash-image-preview",
  "prompt": "..."
}
```

## Instructions for the Agent

⚠️ skill 腳本位於 **repo 根目錄**。若 cwd 不在 repo root，先獨立執行 `git rev-parse --show-toplevel` 取得路徑，再 `cd` 到該路徑後執行。禁止使用 `$(...)` 語法。

1. 當使用者要從提示詞直接生成設計稿、介面草圖、Landing Page、區塊設計或對應 HTML 時，優先使用此技能。
2. 確認環境中已有 `GEMINI_API_KEY` 或 `GOOGLE_API_KEY`。
3. 執行：
   ```sh
   node .agents/skills/google-stitch/scripts/generate.js --prompt "<user prompt>"
   ```
4. 若使用者有指定尺寸、比例、模型或輸出位置，分別加上：
   - `--aspect-ratio`
   - `--image-size`
   - `--model`
   - `--output-dir`
5. 腳本完成後，回報輸出的 HTML 與圖片路徑；若需要，也可讀取 HTML 檔內容再貼回對話。
6. 若只是先確認參數、路徑或流程，不要真的呼叫 API，改用 `GOOGLE_STITCH_DRY_RUN=1`。
7. 若腳本以非零代碼結束，回傳 stderr 錯誤，不要捏造設計結果。

## 限制

- 這個 skill 依賴 repo 內的 `google-stitch` tool bundle，因此應在本 repo 內使用。
- HTML 由模型生成，可能需要人工微調。
- 圖片與 HTML 的風格一致性取決於 prompt 品質。
- 若模型沒有回傳 fenced ` ```html ` 區塊，HTML 檔不會被寫出。

## 錯誤處理

- 缺少 prompt：顯示 usage 並結束。
- 缺少 API key：明確提示設定 `GEMINI_API_KEY` 或 `GOOGLE_API_KEY`。
- 模型未回傳圖片：只輸出 HTML 路徑（若有）。
- 模型未回傳 HTML：只輸出圖片路徑（若有）。

## 參考資料

- 詳細參數與流程：[`references/workflow.md`](references/workflow.md)
