# 🛠️ Felo Search（AI 網路搜尋）

> 讓小龍蝦幫你上網查資料！即時搜尋最新消息、新聞、天氣、比價，還會幫你整理成好讀的答案。

## ✨ 這個技能可以做什麼？

- 🔍 **即時搜尋網路**，取得最新、最即時的資訊
- 📰 查詢新聞、時事、趨勢、突發事件
- 🌤️ 查天氣、查價格、查評價、查旅遊資訊
- 🤖 回傳的不是一堆連結，而是 **AI 整理過的答案**，附帶來源引用
- 🌏 支援中文、英文、日文等多語言查詢

## 📦 安裝方式

### 安裝到目前值班的小龍蝦

在 Telegram 對話中輸入：

```
/skills add felo-search
```

### 安裝為全域技能（所有小龍蝦共用）

```
/skills add felo-search -g
```

## ⚙️ 需要的設定

使用前需要設定以下 API Key：

| 名稱 | 說明 |
| --- | --- |
| `FELO_API_KEY` | Felo AI 搜尋 API 金鑰 |

**取得方式：** 到 [felo.ai](https://felo.ai) → **Settings** → **API Keys** 申請取得。

## 💬 提示詞範例

以下是你可以直接複製貼上跟小龍蝦說的話：

```text
今天台北的天氣如何？
最近有什麼科技新聞？
幫我查一下 iPhone 16 跟 Samsung S25 的比較。
這週末台中有什麼好玩的活動？
React 19 有哪些新功能？
```

## 📝 輸出範例

小龍蝦會回傳像這樣的 AI 整理答案：

```
今天台北天氣晴朗，最高溫 32°C，最低溫 26°C。
午後山區有局部雷陣雨的機率，建議攜帶雨具。

來源：
- 中央氣象署 (https://www.cwa.gov.tw)
- Weather.com (https://weather.com)
```

> 💡 小龍蝦不只是丟連結給你，而是讀完資料後用自然語言幫你整理重點！

## ⚠️ 注意事項

- 🌐 最適合查詢**即時性、時效性**的資訊
- 📡 需要網路連線才能使用
- 🔑 如果 API Key 失效，請到 [felo.ai](https://felo.ai) 重新產生

## 🔗 延伸閱讀

- 技術細節請參考 [SKILL.md](./SKILL.md)
- [Felo Open Platform](https://openapi.felo.ai)
- [Felo API 文件](https://openapi.felo.ai/docs)
- [申請 API Key](https://felo.ai)
