# Antigravity GCP Template

這個範本會在 GitHub Actions 中執行 Antigravity CLI（`agy`），並沿用小龍蝦既有流程：

1. 讀取 `artifacts/{user_comment_id}/user.md` 當任務輸入
2. 執行 AGY 任務
3. 將輸出寫回 `artifacts/{comment_id}/result.md`
4. 推送到 `issue-{number}` 分支並更新 issue comment

## 必要設定

### GitHub Secret

- `AGY_GOOGLE_ADC_JSON`
  - 內容為 GCP **Application Default Credentials** JSON 全文
  - 產生方式：本機執行 `gcloud auth application-default login`，完成登入後複製 `~/.config/gcloud/application_default_credentials.json` 的內容
  - 必須包含 `refresh_token`

### 必要 GitHub Variables

- `GOOGLE_CLOUD_PROJECT` — 你的 GCP 專案 ID（例：`gen-lang-client-0487760146`）

### 可選 GitHub Variables

- `AGY_MODEL`（預設：`gemini-2.5-flash`）
- `AGY_PRINT_TIMEOUT`（預設：`20m`）

## 學員設定步驟

1. 安裝 [Google Cloud SDK](https://cloud.google.com/sdk/docs/install)
2. 登入 GCP（使用有 $300 免費試用額度的帳號）：
   ```bash
   gcloud auth login
   gcloud config set project YOUR_PROJECT_ID
   ```
3. 產生 Application Default Credentials：
   ```bash
   gcloud auth application-default login
   ```
4. 複製產生的 JSON 檔案內容：
   ```bash
   cat ~/.config/gcloud/application_default_credentials.json
   ```
5. 到 repo 的 **Settings → Secrets and variables → Actions**：
   - 新增 Secret `AGY_GOOGLE_ADC_JSON`：貼上步驟 4 的 JSON 全文
   - 新增 Variable `GOOGLE_CLOUD_PROJECT`：填入你的 GCP 專案 ID
6. 視需求設定 `AGY_MODEL`

## 安全提醒

- 不要把 `application_default_credentials.json` 直接提交到 repo
- `AGY_GOOGLE_ADC_JSON` 具有帳號級權限，只放在 GitHub Secrets
- 若帳號撤銷授權或 token 失效，重新執行 `gcloud auth application-default login` 並更新 secret

## 常見錯誤

- `Authentication required` / `authentication timed out`
  - 代表 ADC 未正確設定，請確認 `AGY_GOOGLE_ADC_JSON` 內容正確且未過期/撤銷
- `AGY_GOOGLE_ADC_JSON must include refresh_token`
  - 代表 secret 內容格式不正確，請重新執行 `gcloud auth application-default login`
- `COMMENT_ID or USER_COMMENT_ID is missing`
  - 代表觸發 payload 缺少必要欄位
- `Missing user prompt file`
  - 代表 `artifacts/{user_comment_id}/user.md` 尚未生成或路徑不一致
