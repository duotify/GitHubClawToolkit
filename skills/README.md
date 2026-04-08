# 🦞 龍蝦堡技能庫 — GitHubClawSkills

> 為「龍蝦堡」量身打造的 Agent Skills 技能庫，讓你的小龍蝦學會更多本領！

## 這是什麼？

這個 repo 收錄了所有可以安裝到「龍蝦堡」小龍蝦身上的技能。每個技能都是一個獨立的模組，讓小龍蝦在處理任務時能夠使用額外的工具和能力。

你可以把它想像成一個**技能商店** — 需要什麼能力，就裝什麼技能！

## 📋 技能清單

| 技能名稱 | 說明 | 需要的 Key |
|----------|------|-----------|
| [agent-browser](skills/agent-browser/) | 瀏覽器自動化，開網頁、填表單、截圖 | — |
| [audio-transcriber](skills/audio-transcriber/) | 音訊轉繁體中文逐字稿 | `GEMINI_API_KEY` |
| [deep-researcher](skills/deep-researcher/) | 產生含引用來源的深度研究報告 | `GEMINI_API_KEY` |
| [felo-search](skills/felo-search/) | AI 即時網路搜尋 | `FELO_API_KEY` |
| [felo-slides](skills/felo-slides/) | 一句話產生簡報投影片 | `FELO_API_KEY` |
| [felo-web-fetch](skills/felo-web-fetch/) | 擷取網頁內容（HTML / Markdown / 純文字） | `FELO_API_KEY` |
| [felo-x-search](skills/felo-x-search/) | 搜尋 X（Twitter）的使用者與推文 | `FELO_API_KEY` |
| [find-skills](skills/find-skills/) | 幫你找出最適合任務的技能 | — |
| [google-stitch](skills/google-stitch/) | 用提示詞產生 UI 設計圖 + HTML | `GEMINI_API_KEY` |
| [image-describer](skills/image-describer/) | 用繁體中文描述圖片內容 | `GEMINI_API_KEY` |
| [gemini-nanobanana](skills/gemini-nanobanana/) | AI 圖片生成、編輯與合成 | `GEMINI_API_KEY` |
| [skill-creator](skills/skill-creator/) | 建立、測試與改進新技能 | — |
| [summary](skills/summary/) | 將網頁、PDF、影片、音訊摘要成繁體中文 | `GEMINI_API_KEY` |
| [telegram-notify](skills/telegram-notify/) | 傳送 Telegram 通知訊息 | `TELEGRAM_NOTIFY_BOT_TOKEN` |

## 📦 如何安裝技能？

### 安裝到目前值班的小龍蝦

在 Telegram 對話中輸入：

```
/skills add <技能名稱>
```

例如：`/skills add felo-search`

### 安裝為全域技能（所有小龍蝦共用）

```
/skills add <技能名稱> -g
```

### 查看已安裝的技能

```
/skills list
```

### 搜尋可用技能

```
/skills search <關鍵字>
```

## 🤝 如何貢獻？

歡迎所有學員貢獻新技能或改善現有技能！

1. **Fork** 這個 repo
2. 在 `skills/` 目錄下新增或修改技能
3. 確保你的技能包含 `SKILL.md`（代理使用的技術文件）和 `README.md`（給學員看的說明）
4. 發 **Pull Request** 回來，我們會一起 review！

### 技能目錄結構

```
skills/你的技能名稱/
├── SKILL.md          # 代理的技術文件（觸發條件、執行步驟）
├── README.md         # 學員看的說明（功能、安裝、提示詞範例）
├── scripts/          # 執行腳本（如果需要）
└── references/       # 參考文件（如果需要）
```

## 📄 授權

本專案以 [MIT License](LICENSE) 釋出。
