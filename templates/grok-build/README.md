# Grok Build 範本

在 GitHub Actions 執行 Grok CLI（grok），讓有 SuperGrok 訂閱的學員也能輕鬆使用 Grok 作為小龍蝦的執行引擎。

## 兩種認證方式（二選一）

### 方法一：SuperGrok 訂閱 + OAuth（強烈推薦，如果你有訂閱）

如果你已經訂閱 SuperGrok（或 X Premium+），可以**不用額外付 API 額度**，直接用你的訂閱透過 OAuth 登入。

#### 步驟（只需做一次）
1. 在**你自己的電腦**安裝 Grok CLI：
   ```bash
   curl -fsSL https://x.ai/cli/install.sh | bash
   ```

2. 使用 **device code** 方式登入（適合沒有直接瀏覽器的終端機）：
   ```bash
   grok login --device-auth
   ```

3. 終端機會顯示一個網址和代碼，例如：
   ```
   Visit https://auth.x.ai/device and enter code: ABCD-1234
   ```

4. 用手機或任何瀏覽器打開該網址，輸入代碼，並用你的 SuperGrok 帳號登入完成授權。

5. 登入成功後，取出 auth.json 內容：
   ```bash
   cat ~/.grok/auth.json
   ```

6. 複製**整個 JSON 內容**，這就是你要設定的 secret。

> ⚠️ 請妥善保管，這個 token 代表你的 SuperGrok 登入狀態。

### 方法二：傳統 XAI_API_KEY（需要額度）

如果你沒有 SuperGrok 訂閱，或想用純 API Key 方式：

1. 前往 [xAI Console](https://console.x.ai) 註冊/登入。
2. 去 API Keys 頁面建立金鑰（`xai-...` 開頭）。
3. 複製金鑰。

## 安裝範本後的 GitHub 設定

透過 Telegram 龍蝦堡機器人安裝本範本後，請在你的 GitHub repo 設定以下 **Secrets**（Settings → Secrets and variables → Actions）：

**推薦（有 SuperGrok 訂閱的使用者）：**
- Secret 名稱：`GROK_AUTH_JSON`
- 值：把上面 `cat ~/.grok/auth.json` 拿到的**完整 JSON 內容**（從 { 開始到 } 結束）整個貼進去。

**傳統 API Key 方式：**
- Secret 名稱：`XAI_API_KEY`
- 值：貼上從 https://console.x.ai 取得的完整金鑰（`xai-...` 開頭）。

**注意**：GitHub Secret 名稱只能包含英文字母、數字或底線（_），不能有空格或 "or"。

可選（Repository variables）：
- `GROK_MODEL`：例如 `grok-build`（預設值）

設定完成後，workflow 會自動根據你提供的 secret 選擇正確的認證方式。

## 本機測試（SuperGrok OAuth）

```bash
# 先用 device code 登入（上面步驟）
grok login --device-auth

# 測試 headless 模式
grok -p "用繁體中文簡單說說你好" -m grok-build --yolo
```

## 注意事項
- Grok 會自動讀取 repo 根目錄的 `AGENTS.md`，並遵守小龍蝦任務規範（繁體中文、驗證優先、一定要輸出 `artifacts/.../result.md` 等）。
- 建議在本機也維持最新版 Grok CLI（`grok update`）。
- 如果 token 過期，可以重新跑一次 `grok login --device-auth` 取得新的 auth.json，再更新 secret 即可。
- 這個範本的設計參考 Antigravity GCP，把 OAuth token 的取得流程本地化一次，之後 CI 就能無痛使用你的 SuperGrok 訂閱。
