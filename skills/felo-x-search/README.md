# 🛠️ Felo X Search（X/Twitter 搜尋）

> 讓小龍蝦幫你搜尋 X（Twitter）上的使用者、推文和回覆，掌握社群最新動態！

## ✨ 這個技能可以做什麼？

- 用關鍵字搜尋 X（Twitter）上的推文內容
- 查詢特定使用者的個人檔案（粉絲數、簡介等）
- 取得某位使用者的近期推文時間軸
- 查看特定推文底下的回覆討論
- 結果會整理成好讀的 Markdown 格式，包含互動數據（按讚數、轉推數等）

## 📦 安裝方式

### 安裝到目前值班的小龍蝦

在 Telegram 對話中輸入：

```
/skills add felo-x-search
```

### 安裝為全域技能（所有小龍蝦共用）

```
/skills add felo-x-search -g
```

## ⚙️ 需要的設定

| 設定項目 | 說明 |
| --- | --- |
| `FELO_API_KEY` | Felo 平台的 API 金鑰，可到 [felo.ai](https://felo.ai) 申請 |

## 💬 提示詞範例

```text
幫我搜尋 X 上關於「生成式 AI」的最新推文
查一下 @OpenAI 這個帳號的資料和最近發了什麼文
找找看 X 上有哪些人在討論台灣的科技新創
幫我看這則推文底下的回覆：https://x.com/xxx/status/1234567890
搜尋這週 X 上關於 AI 法規的討論
```

## 📝 輸出範例

小龍蝦會回傳整理好的搜尋結果，像這樣：

```markdown
🔍 找到 5 則相關推文

### @OpenAI (OpenAI)
We're releasing GPT-5 today...
❤️ 12,345 | 🔁 3,456 | 💬 789
🕐 2024-01-15 10:30

### @GoogleAI (Google AI)
Exciting progress in multimodal AI...
❤️ 8,901 | 🔁 2,345 | 💬 567
🕐 2024-01-15 09:15
```

## ⚠️ 注意事項

- 此技能透過 Felo API 搜尋，並非直接連接 Twitter API，資料新鮮度取決於 Felo 的索引速度
- 搜尋結果可能不包含所有推文，特別是非常即時的內容
- 私人帳號的推文無法被搜尋到
- 需要先設定好 `FELO_API_KEY` 才能使用

## 🔗 延伸閱讀

- 技術細節請參考 [SKILL.md](SKILL.md)
- [Felo X Search API 文件](https://openapi.felo.ai/docs/api-reference/v2/x-search.html)
- [Felo 開放平台](https://openapi.felo.ai/docs/)
