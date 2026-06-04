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

設定完成後，請**繼續執行下一節「啟用 Workflow」**，否則新小龍蝦不會觸發執行。

## 啟用 Workflow（重要！）

GitHub 為了防止惡意範本，**從 Template 建立的 repo 其 workflow 預設是停用的**。

即使 main 分支已經有 `issue-N.yml` 檔案，新建立的小龍蝦也不會自動觸發 workflow。

請依照以下步驟手動啟用一次（只需做一次）：

1. 前往你的 GitHub 儲存庫。
2. 點擊上方分頁的 **Actions**。
3. 在左側或列表中找到工作流程 **🦞 執行小龍蝦任務 #N**（可能顯示為 disabled / 停用）。
4. 點擊進入該 workflow。
5. 在右上角點擊 **Enable workflow**（啟用工作流程）按鈕。

啟用後，之後透過 Telegram `/new` 建立的新小龍蝦，套用這個範本時，workflow 就會正常被觸發執行。

如果你看到 "This workflow has not been enabled yet" 之類的提示，就是這個原因。

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
- **Workflow 啟用** 是必要步驟（見上方「啟用 Workflow」章節），否則即使 main 有 issue-N.yml，新小龍蝦也不會執行。
