# 🛠️ Telegram Notify（Telegram 通知）

> 讓小龍蝦在事情做完時，自動發 Telegram 訊息通知你 🦞📲

## ✨ 這個技能可以做什麼？

- 📬 發送 Telegram 訊息通知 — build 完成、部署成功、任務結束都能即時通知
- 🏗️ CI/CD 狀態推播 — 自動化流程跑完自動發通知到群組
- 🎨 支援多種格式 — 純文字、HTML、MarkdownV2 任你選
- ⚡ 超輕量設計 — 只用 shell script + curl，不需要安裝任何套件

## 📦 安裝方式

### 安裝到目前值班的小龍蝦

在 Telegram 對話中輸入：

```
/skills add telegram-notify
```

### 安裝為全域技能（所有小龍蝦共用）

```
/skills add telegram-notify -g
```

## ⚙️ 需要的設定

| 設定項目 | 說明 |
| --- | --- |
| `TELEGRAM_BOT_TOKEN` | Telegram Bot 的 token（透過 @BotFather 取得） |
| `TELEGRAM_CHAT_ID` | 要發送訊息的聊天室 ID 或頻道名稱 |

> 💡 **如何取得這些設定？**
> 1. 在 Telegram 搜尋 [@BotFather](https://t.me/BotFather)，輸入 `/newbot` 建立一個新的 Bot
> 2. BotFather 會給你一組 **Bot Token**（像 `123456:ABCDEF...`）
> 3. 把 Bot 加到你的群組，然後用 API 查出 **Chat ID**
> 4. 把這兩個值設定到小龍蝦的環境變數裡就完成了！

## 💬 提示詞範例

```text
幫我發一則 Telegram 通知，說 build 已經成功完成
部署跑完之後，發 Telegram 訊息通知我
發一則訊息到我們的 Telegram 群組，說今天的自動測試全部通過
用 HTML 格式發送部署報告到 Telegram
通知 Telegram 群組：資料庫備份已完成
```

## 📝 輸出範例

**成功時：**

```
Telegram notification sent successfully.
```

**失敗時** 會顯示錯誤細節，例如：

```
Error: TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID must be set
```

## ⚠️ 注意事項

- 必須先透過 **@BotFather** 建立 Telegram Bot 並取得 token
- Bot 需要先被**加入目標群組**，才能發送訊息到該群組
- 當 `TELEGRAM_BOT_TOKEN` 或 `TELEGRAM_CHAT_ID` 未設定時，步驟會靜默跳過（不會報錯中斷流程）
- 使用 MarkdownV2 格式時，特殊字元（如 `.`、`-`、`!`）需要用 `\` 跳脫

## 🔗 延伸閱讀

- 技術細節請參考 [SKILL.md](SKILL.md)
- Telegram Bot 建立教學：[@BotFather](https://t.me/BotFather)
- Telegram Bot API 文件：[sendMessage API](https://core.telegram.org/bots/api#sendmessage)
