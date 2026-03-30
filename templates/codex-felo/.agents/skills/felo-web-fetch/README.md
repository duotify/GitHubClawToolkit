# 🛠️ Felo Web Fetch（網頁內容擷取）

> 給小龍蝦一個網址，牠就幫你把網頁內容抓回來，轉成乾淨的文字或 Markdown！

## ✨ 這個技能可以做什麼？

- 輸入網址，自動擷取網頁的主要內容
- 可選擇輸出為 HTML、Markdown 或純文字格式
- 支援用 CSS 選擇器只抓取頁面中的特定區塊
- 提供閱讀模式（readability），自動過濾廣告和雜訊
- 適合做資料蒐集、文章整理、網頁內容備份等用途

## 📦 安裝方式

在 Telegram 對話中輸入：

```
/skills
```

輸入後會顯示可安裝的技能列表，選擇此技能即可完成安裝。

## ⚙️ 需要的設定

| 設定項目 | 說明 |
| --- | --- |
| `FELO_API_KEY` | Felo 平台的 API 金鑰，可到 [felo.ai](https://felo.ai) 申請 |

## 💬 提示詞範例

```text
幫我把這個網頁的內容抓下來轉成 Markdown：https://example.com/article
擷取這篇文章的純文字內容：https://news.example.com/today
把這個網頁的主要內容整理出來，忽略廣告和側邊欄
抓取 https://blog.example.com 的文章內容，只要 <article> 區塊的部分
```

## 📝 輸出範例

小龍蝦會回傳整理好的網頁內容，像這樣：

```markdown
# 文章標題

這是從網頁中擷取出來的主要內容，已經自動去除了導覽列、
廣告和其他干擾元素，只保留你需要的文字。

## 第一段重點
內容內容內容...

## 第二段重點
內容內容內容...
```

## ⚠️ 注意事項

- 公開網頁效果最好；需要登入的頁面可能無法正常擷取
- 某些動態載入的網頁（如大量使用 JavaScript 的 SPA）可能需要等待較久
- 擷取結果的品質取決於原始網頁的結構
- 需要先設定好 `FELO_API_KEY` 才能使用

## 🔗 延伸閱讀

- 技術細節請參考 [SKILL.md](SKILL.md)
- [Felo Web Extract API 文件](https://openapi.felo.ai/docs/api-reference/v2/web-extract.html)
- [Felo 開放平台](https://openapi.felo.ai/docs/)
