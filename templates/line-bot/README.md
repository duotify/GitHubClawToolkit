---
name: Line Bot
description: 用來建立與部署 LINE Bot 專案的模板
required_env:
  - LINE_CHANNEL_ACCESS_TOKEN
  - LINE_CHANNEL_SECRET
---
  
# line-bot

這個目錄提供一個 GitHub Actions workflow：`install-line-bot.yml`。  
它的用途是把 `duotify/GitHubClawSkills` 裡的 `workers/line-bot` 專案，透過 Bun 建置後部署到 Cloudflare Workers，並同步 LINE Bot 所需的 secrets。

## Description

`line-bot` 主要在做三件事：

1. 下載並建置 `workers/line-bot`
2. 部署成一個 Cloudflare Worker
3. 寫入 LINE Bot 與 GitHub 相關設定，讓 Worker 可以接收 LINE webhook、回覆訊息，並依需求綁定 GitHub Issue

換句話說，這不是一個前端網站，也不是獨立後端服務，而是一個「安裝與部署 LINEBotWorker」的自動化流程。

## 工作流程

workflow 會在手動觸發時執行，並依照輸入參數完成以下步驟：

1. Checkout `duotify/GitHubClawSkills` 的 `workers/line-bot`
2. 安裝 Bun 依賴
3. 執行建置
4. 使用 `wrangler` 部署到 Cloudflare Workers
5. 寫入 Worker secrets
6. 在 GitHub Actions summary 輸出部署結果
7. 先把衍生的 Worker 名稱正規化，再套用到部署與 secret 同步

## 會用到的設定

- `line_bot_id`
- `line_bot_channel_id`
- `line_channel_secret`
- `line_channel_access_token`
- `line_default_reply_message`
- `default_utc_offset`
- `issue_number`

其中 `issue_number` 可以不填：

- 有填：固定綁定指定的 GitHub Issue
- 沒填：會依 LINE source 動態找出或建立唯一 Issue

## 這個 bot 的用途

根據 workflow 內容，這個 LINEBotWorker 的設計目標是：

- 接收 LINE 官方帳號或 LINE Bot 的訊息
- 使用預設回應訊息進行回覆
- 透過 GitHub Issue 做對應或追蹤
- 以 Cloudflare Worker 的形式運行，降低維運成本

## 需要的外部資源

這個 workflow 依賴下列環境與權限：

- GitHub Actions secrets
- Cloudflare API Token
- Cloudflare Account ID
- 可寫入 Cloudflare Workers secrets 的權限
- `CLAW_SYS_GITHUB_TOKEN`

## 注意事項

- 這個目錄本身不包含 LINE Bot 的業務邏輯程式碼，實際邏輯在 `workers/line-bot`
- 部署前請確認 GitHub secrets 已設定完整
- `line_default_reply_message` 與 `issue_number` 都是可選參數，但若流程依賴它們，請確保內容合理
- workflow 會把衍生名稱中的無效字元替換為 `-`，並檢查 `workers.dev` 需要的 63 字元上限
