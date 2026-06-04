# Grok Build 範本

在 GitHub Actions 執行 Grok CLI（grok），透過 xAI API 串接 Grok 模型作為小龍蝦的執行引擎。

## 取得 XAI_API_KEY

### 前置條件
- xAI 帳號（可至 https://console.x.ai 註冊）
- （選用）本機已安裝 Grok CLI（`grok`），方便測試

### 步驟
1. 前往 [xAI Console](https://console.x.ai) 登入或註冊帳號。

2. 在儀表板或 API Keys 區段建立新的 API Key（通常會以 `xai-` 開頭）。

3. 複製完整的金鑰字串，這就是 `XAI_API_KEY` 的值。

> ⚠️ **請妥善保管金鑰**，不要分享給他人。金鑰具有對應帳戶的存取權限。

## 本機測試 Grok CLI（選用但建議）

1. 安裝 Grok CLI：
   ```bash
   curl -fsSL https://x.ai/cli/install.sh | bash
   ```

2. 設定環境變數並測試：
   ```bash
   export XAI_API_KEY="xai-你的金鑰"
   grok -p "你好，請用繁體中文簡單回覆"
   ```

3. 確認能正常回應後，即表示金鑰有效，可用於後續範本設定。

## 安裝範本後的 GitHub 設定

透過 Telegram 龍蝦堡機器人安裝本範本後，系統通常會引導你建立 GitHub repo 並設定必要 secret。

請務必在 repo 的 **Settings → Secrets and variables → Actions** 中加入：

- `XAI_API_KEY`（必填）：放入你在 console.x.ai 取得的完整金鑰。

可選（若 TG 安裝流程未自動設定）：
- `GROK_MODEL`（Repository variable）：例如 `grok-build`（預設推薦用於 coding 任務的模型）。

設定完成後，即可開始派發 Issue 給小龍蝦執行任務，Grok 將作為主要執行引擎。

## 注意事項
- Grok 會自動讀取 repo 根目錄的 `AGENTS.md`，並遵守其中的小龍蝦任務規範（繁體中文、驗證優先、產出物路徑等）。
- 建議在本機也維持最新版 Grok CLI（可用 `grok update` 更新）。
- 如遇認證問題，請確認金鑰是否有效、帳戶是否有額度，或嘗試重新產生金鑰。
