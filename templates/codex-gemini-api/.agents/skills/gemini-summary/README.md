# 🛠️ Summary（內容摘要）

> 丟一個連結或檔案，小龍蝦幫你秒出繁體中文重點摘要 🦞📋

## ✨ 這個技能可以做什麼？

- 🌐 摘要網頁文章 — 貼上網址就搞定
- 📄 摘要 PDF 文件 — 支援網路連結或本機檔案
- 🎬 摘要 YouTube 影片 — 不用看完整部影片也能掌握重點
- 🎙️ 摘要音訊檔案 — 會議錄音、Podcast 都行
- 🤖 自動偵測輸入類型 — 你不用告訴它是什麼格式，它自己判斷

## 📦 安裝方式

在 Telegram 對話中輸入：

```
/skills
```

輸入後會顯示可安裝的技能列表，選擇此技能即可完成安裝。

## ⚙️ 需要的設定

| 設定項目 | 說明 |
| --- | --- |
| `GEMINI_API_KEY` | Google Gemini API 金鑰，摘要功能的核心引擎 |

## 💬 提示詞範例

```text
幫我摘要這篇文章 https://example.com/ai-agents-intro
摘要這份 PDF 的重點 ./reports/quarterly.pdf
幫我看看這個 YouTube 影片在講什麼 https://youtu.be/abc123
把這段會議錄音整理成摘要 ./recordings/meeting.mp3
用繁體中文幫我總結這個網頁，列出關鍵數據
```

## 📝 輸出範例

摘要會以結構化的繁體中文 Markdown 輸出，包含以下段落：

```
📝 內容摘要
這篇文章探討了 AI Agent 在軟體開發中的最新應用趨勢...

📌 來源
https://example.com/ai-agents-intro

💡 核心概述
AI Agent 正在改變開發者的工作方式，從自動化測試到程式碼生成...

🔍 重點條列
• Agent 可以自主完成多步驟任務
• 最新的 LLM 模型大幅提升了推理能力
• 工具整合是 Agent 成功的關鍵

📊 關鍵數據與事實
• 2024 年 AI Agent 市場成長 340%
• 超過 60% 的開發團隊已開始使用 AI 輔助工具

🎯 行動建議
• 建議從小型自動化任務開始嘗試 Agent
• 優先選擇有完善文件的 Agent 框架
```

## ⚠️ 注意事項

- 需要**登入才能看到的頁面**無法摘要（例如付費文章、私人頁面）
- 太大的檔案可能會**超出 API 限制**，建議先裁切再摘要
- 加密的 PDF 無法處理
- 高度依賴 JavaScript 渲染的網頁，摘要品質可能較差

## 🔗 延伸閱讀

- 技術細節請參考 [SKILL.md](SKILL.md)
- 套件設定：[package.json](package.json)
- 核心程式碼：[src/summarize.js](src/summarize.js)
