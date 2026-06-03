# Antigravity GCP Template

這個範本會在 GitHub Actions 中執行 Antigravity CLI（`agy`），並沿用小龍蝦既有流程：

1. 讀取 `artifacts/{user_comment_id}/user.md` 當任務輸入
2. 執行 AGY 任務
3. 將輸出寫回 `artifacts/{comment_id}/result.md`
4. 推送到 `issue-{number}` 分支並更新 issue comment

## 必要設定

### GitHub Secrets

- `AGY_OAUTH_TOKEN`
  - 內容為 AGY 的 OAuth token 檔案 `~/.gemini/antigravity-cli/antigravity-oauth-token` 全文
  - 必須包含 `token.refresh_token`

### 可選 GitHub Variables

- `AGY_MODEL`（預設：`gemini-2.5-flash`）
- `AGY_PRINT_TIMEOUT`（預設：`20m`）

## 學員設定步驟

1. 安裝 [Google Cloud SDK](https://cloud.google.com/sdk/docs/install) 並登入 GCP：
   ```bash
   gcloud auth login
   gcloud auth application-default login
   ```
2. 安裝 Antigravity CLI 並完成登入（選擇 "Use a Google Cloud project"）：
   ```bash
   curl -fsSL https://antigravity.google/cli/install.sh | bash
   agy
   ```
3. 登入成功後，複製 AGY 的 token 檔案內容：
   ```bash
   cat ~/.gemini/antigravity-cli/antigravity-oauth-token
   ```
4. 到 repo 的 **Settings → Secrets and variables → Actions**（或透過 TG 設定流程自動設定）：
   - 新增 Secret `AGY_OAUTH_TOKEN`：貼上步驟 3 的 JSON 全文
5. 視需求設定 `AGY_MODEL`

## 安全提醒

- 不要把 `antigravity-oauth-token` 直接提交到 repo
- `AGY_OAUTH_TOKEN` 具有帳號級權限，只放在 GitHub Secrets
- 若帳號撤銷授權或 token 失效，重新在本機 `agy` 登入後更新 secret

## 常見錯誤

- `Authentication required` / `authentication timed out`
  - 代表 token 未正確還原，請確認 `AGY_OAUTH_TOKEN` 內容正確且未過期/撤銷
- `AGY_OAUTH_TOKEN must contain token.refresh_token`
  - 代表 secret 內容格式不正確，請確認貼的是 `~/.gemini/antigravity-cli/antigravity-oauth-token` 的完整內容
- `COMMENT_ID or USER_COMMENT_ID is missing`
  - 代表觸發 payload 缺少必要欄位
- `Missing user prompt file`
  - 代表 `artifacts/{user_comment_id}/user.md` 尚未生成或路徑不一致
