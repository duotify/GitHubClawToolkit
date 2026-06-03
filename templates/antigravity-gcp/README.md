# Antigravity GCP 範本

在 GitHub Actions 執行 Antigravity CLI（agy），透過 GCP 免費試用額度串接 AI 模型。

## 前置條件

- Google Cloud 帳號（已啟用免費試用 $300 額度）
- 本機已安裝 Antigravity CLI（`agy`）
- GitHub 專案已由龍蝦堡建立

## 設定步驟

### 1. 建立 GCP 專案

1. 前往 [Google Cloud Console](https://console.cloud.google.com/)
2. 建立新專案（或使用現有專案）
3. 確認專案已綁定帳單（免費試用帳單即可）
4. 記下 **Project ID**（在專案資訊卡片上，不是顯示名稱）

### 2. 本機登入 AGY 取得 OAuth Token

在終端機執行：

```bash
agy --print "hello"
```

首次執行會跳出瀏覽器要求 Google 帳號授權，完成登入後 AGY 會將憑證寫入：

```
~/.gemini/antigravity-cli/antigravity-oauth-token
```

確認檔案存在並取得內容：

```bash
cat ~/.gemini/antigravity-cli/antigravity-oauth-token
```

輸出會是一段 JSON，類似：

```json
{
  "auth_method": "oauth",
  "token": {
    "access_token": "ya29.a0...",
    "refresh_token": "1//0e...",
    "token_type": "Bearer",
    "expiry": "2025-..."
  }
}
```

> ⚠️ 請複製**整份 JSON 內容**，不是只有 refresh_token。

### 3. 設定 GitHub Repository Secrets & Variables

前往你的 GitHub repo → **Settings** → **Secrets and variables** → **Actions**

#### Secrets（必填）

| Name | 值 | 說明 |
|------|-----|------|
| `AGY_OAUTH_TOKEN` | 整份 `antigravity-oauth-token` JSON 內容 | AGY 認證憑證 |
| `AGY_GCP_PROJECT` | 你的 GCP Project ID | 也可改用 Variable 設定 |

#### Variables（必填）

| Name | 值 | 說明 |
|------|-----|------|
| `AGY_MODEL` | 例如 `Gemini 3.5 Flash (Medium)` | 執行時使用的模型 |

#### Variables（選填）

| Name | 預設值 | 說明 |
|------|--------|------|
| `AGY_PRINT_TIMEOUT` | `20m` | AGY 執行逾時時間 |

### 4. 套用範本

在 Telegram 龍蝦堡對話中使用 `/template` 指令套用 `antigravity-gcp` 範本，即可開始使用。

## 可用模型

| 模型名稱 |
|----------|
| Gemini 3.5 Flash (Medium) |
| Gemini 3.5 Flash (High) |
| Gemini 3.5 Flash (Low) |
| Gemini 3.1 Pro (Low) |
| Gemini 3.1 Pro (High) |
| Claude Sonnet 4.6 (Thinking) |
| Claude Opus 4.6 (Thinking) |
| GPT-OSS 120B (Medium) |

可在 Telegram 使用 `/status` 查看目前模型，並透過「🤖 切換模型」按鈕更換。

## 常見問題

### Token 過期怎麼辦？

AGY OAuth Token 含有 refresh_token，正常情況下會自動續期。若出現認證錯誤：

1. 本機重新執行 `agy --print "hello"` 完成登入
2. 複製新的 `~/.gemini/antigravity-cli/antigravity-oauth-token` 內容
3. 更新 GitHub Secret `AGY_OAUTH_TOKEN`

### 出現 "Missing required configuration: AGY_GCP_PROJECT" 錯誤

確認已在 repo 的 Secrets 或 Variables 設定 `AGY_GCP_PROJECT`，值為 GCP Project ID。

### AGY 執行成功但沒有輸出

通常是 `AGY_MODEL` 設定的模型名稱有誤，請確認使用上方「可用模型」表格中的完整名稱。
