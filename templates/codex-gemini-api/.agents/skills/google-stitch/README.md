# 🛠️ Google Stitch（UI 設計圖產生器）

> 用一句話描述你想要的畫面，小龍蝦就幫你生出設計圖＋HTML 程式碼！

## ✨ 這個技能可以做什麼？

- 🎨 只要輸入一段文字描述，就能自動產生 UI 設計圖（PNG/JPG）
- 💻 同時產生對應的 HTML 程式碼，可以直接在瀏覽器預覽
- 📐 支援自訂長寬比（1:1、16:9 等）和解析度（512px ~ 4K）
- 📁 設計圖與 HTML 會自動存檔到輸出資料夾，方便後續使用
- ⚡ 背後使用 Google Gemini 模型，一次呼叫搞定設計＋程式碼

## 📦 安裝方式

在 Telegram 對話中輸入：

```
/skills
```

輸入後會顯示可安裝的技能列表，選擇此技能即可完成安裝。

## ⚙️ 需要的設定

| 設定項目 | 說明 |
| --- | --- |
| `GEMINI_API_KEY` | Google Gemini 的 API 金鑰（**必填**） |

## 💬 提示詞範例

以下是你可以直接複製貼上給小龍蝦的提示詞：

```text
幫我設計一個深色風格的 SaaS 產品首頁，要有 hero 區塊、客戶 logo 和定價卡片
設計一個電商網站的 hero section，暖色調米色背景，右邊放商品照片，比例 16:9
幫我畫一個手機 App 的 onboarding 畫面，三個步驟，用柔和漸層色
產生一個簡潔的登入頁面 wireframe，藍白配色，極簡風格
設計一個 SaaS dashboard 的 mockup，左側導覽列＋右側數據圖表
```

## 📝 輸出範例

小龍蝦會產出兩個檔案，並回報存檔路徑：

```json
{
  "htmlPath": "google-stitch-output/design.html",
  "imagePath": "google-stitch-output/design.png",
  "imageMimeType": "image/png",
  "model": "gemini-3.1-flash-image-preview",
  "prompt": "你輸入的提示詞內容"
}
```

- `design.html` → 可以直接用瀏覽器打開預覽
- `design.png` → 設計圖的圖片檔

## ⚠️ 注意事項

- 產出的 HTML 可能需要手動微調才能達到你想要的效果
- 提示詞越具體、越詳細，設計品質越好（例如指定顏色、風格、排版方式）
- 如果模型沒有回傳圖片或 HTML，對應欄位會顯示 `null`
- 需要有效的 Gemini API 金鑰才能使用

## 🔗 延伸閱讀

- 技術細節請參考 [SKILL.md](SKILL.md)
- 參考文件目錄：[references/](references/)
