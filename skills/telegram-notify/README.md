# 🛠️ Telegram Notify（Telegram 通知）

> 讓小龍蝦在事情做完時，自動發 Telegram 訊息通知你 🦞📲

## ✨ 這個技能可以做什麼？

- 📬 發送 Telegram 訊息通知 — build 完成、部署成功、任務結束都能即時通知
- 🏗️ CI/CD 狀態推播 — 自動化流程跑完自動發通知到群組
- 🎨 支援多種格式 — 純文字、HTML、MarkdownV2 任你選
- ⚡ 超輕量設計 — 只用 shell script + curl，不需要安裝任何套件

## 📦 安裝方式

在 Telegram 對話中輸入：

```
/skills
```

輸入後會顯示可安裝的技能列表，選擇此技能即可完成安裝。

## ⚙️ 需要的設定

| 設定項目 | 說明 |
| --- | --- |
| `TELEGRAM_NOTIFY_BOT_TOKEN` | 專用於通知的 Telegram Bot Token（透過 @BotFather 取得） |

> 💡 **如何取得 Bot Token？**
> 1. 在 Telegram 搜尋 [@BotFather](https://t.me/BotFather)，輸入 `/newbot` 建立一個新的 Bot
> 2. BotFather 會給你一組 **Bot Token**（像 `123456:ABCDEF...`）
> 3. 把這個值設定到小龍蝦的 `TELEGRAM_NOTIFY_BOT_TOKEN` 安全變數裡就完成了！

## 📋 收件人設定（AGENTS.md）

安裝此技能後，你可以在 `AGENTS.md` 中新增一個「Telegram 通知收件人」章節，定義**預設收件人**和 **CSV 對應表**：

~~~markdown
## 10) Telegram 通知收件人

### 10.1 預設通知對象
未指定收件人時，預設發送通知給：`Will`

### 10.2 收件人對應表（CSV）
請使用 CSV，每行一筆，格式固定為：`chat_id,名稱`

```text
123456789,Will
-100987654321,Team
```
~~~

這樣你就可以直接說「幫我發通知給 Will」，小龍蝦會自動從 CSV 對應表找到對應的 Chat ID 發送。

## 💬 提示詞範例

```text
幫我發一則 Telegram 通知，說 build 已經成功完成
幫我發通知給 Will，說部署跑完了
部署跑完之後，發 Telegram 訊息通知 Team
發一則訊息給 Will，說今天的自動測試全部通過
用 HTML 格式發送部署報告給 Team
通知 Will：資料庫備份已完成
```

## 📝 輸出範例

**成功時：**

```
Telegram notification sent successfully.
```

**失敗時** 會顯示錯誤細節，例如：

```
Error: TELEGRAM_NOTIFY_BOT_TOKEN must be set.
```

## ⚠️ 注意事項

- 必須先透過 **@BotFather** 建立 Telegram Bot 並取得 token
- Bot 需要先被**加入目標群組**，才能發送訊息到該群組
- 當 `TELEGRAM_NOTIFY_BOT_TOKEN` 未設定時，步驟會靜默跳過（不會報錯中斷流程）
- 收件人的 Chat ID 必須在 `AGENTS.md` 的 CSV 對應表中定義，否則無法解析
- CSV 格式固定為 `chat_id,名稱`，名稱不可包含逗點
- 使用 MarkdownV2 格式時，特殊字元（如 `.`、`-`、`!`）需要用 `\` 跳脫

## 🔗 延伸閱讀

- 技術細節請參考 [SKILL.md](SKILL.md)
- Telegram Bot 建立教學：[@BotFather](https://t.me/BotFather)
- Telegram Bot API 文件：[sendMessage API](https://core.telegram.org/bots/api#sendmessage)
