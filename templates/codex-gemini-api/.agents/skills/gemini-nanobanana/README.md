# 🛠️ Nano Banana 2（AI 圖片生成）

> 用文字描述你想要的圖片，小龍蝦就幫你畫出來！還能編輯現有圖片、合成多張圖片 🍌

## ✨ 這個技能可以做什麼？

- 🎨 文字生成圖片——描述你要什麼，AI 直接畫給你
- ✏️ 圖片編輯——提供一張參考圖，告訴小龍蝦要改什麼地方
- 🧩 多圖合成——最多可以丟 14 張參考圖片，合成出全新的作品
- 🔍 支援 Google Search grounding，生成需要真實資訊的圖片（例如天氣資訊圖）
- 📐 可自訂長寬比（1:1、16:9 等）和解析度（512px ~ 4K）

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
幫我畫一張太空香蕉人漂浮在土星上方的電影感圖片
生成一張抹茶拿鐵放在大理石桌上的精緻產品照
把這張客廳照片裡的沙發改成深綠色絲絨材質，其他東西不要動
把這三張商品圖合成一張電商 hero banner，比例 16:9
畫一張台北五天天氣預報的資訊圖，用可愛的插畫風格
```

## 📝 輸出範例

小龍蝦會把生成的圖片存檔，並回報結果：

```text
✅ 圖片已產出
📁 檔案路徑：nanobanana-output/nanobanana-01.png
📐 格式：image/png
📏 尺寸：1024 x 1024
💾 大小：1.2 MB
```

圖片會自動儲存到 `nanobanana-output/` 資料夾中。

## ⚠️ 注意事項

- 預設使用的模型是 `gemini-3.1-flash-image-preview`
- 參考圖片最多 14 張，超過會被拒絕
- 長寬比和解析度可以自由搭配，但不是所有組合都會有完美效果
- 生成結果每次可能略有不同，這是 AI 模型的正常現象
- 需要有效的 Gemini API 金鑰才能使用

## 🔗 延伸閱讀

- 技術細節請參考 [SKILL.md](SKILL.md)
- API 參考文件：[references/image-generation-api.md](references/image-generation-api.md)
- 資料來源說明：[references/sources.md](references/sources.md)
