# Antigravity GCP 範本

在 GitHub Actions 執行 Antigravity CLI（agy），透過 GCP 免費試用額度串接 AI 模型。

## 取得 AGY_OAUTH_TOKEN

### 前置條件

- Google Cloud 帳號（已啟用免費試用 $300 額度）
- 本機已安裝 Antigravity CLI（`agy`）

### 步驟（Linux / WSL）

1. 在終端機執行：

```bash
agy --print "hello"
```

2. 瀏覽器會跳出 Google 帳號授權頁面。

> ⚠️ **重要：請選擇「Use a Google Cloud Project」**，不要登入個人的 Google AI Pro 帳號。選擇你建立好的 GCP 專案來授權。

3. 授權完成後，AGY 會將憑證寫入以下路徑：

```
~/.gemini/antigravity-cli/antigravity-oauth-token
```

4. 取得 token 內容：

```bash
cat ~/.gemini/antigravity-cli/antigravity-oauth-token
```

### 步驟（macOS）

macOS 會將 token 儲存在 Keychain。完成登入後，在終端機執行以下指令，輸出的 JSON 即為 `AGY_OAUTH_TOKEN`：

```bash
security find-generic-password -s gemini -a antigravity -w \
  | sed 's/^go-keyring-base64://' \
  | base64 -d \
  | python3 -m json.tool
```

### 步驟（Windows）

Windows 版 `agy` 會把 OAuth 憑證存在系統的 Credential Manager（`gemini:antigravity`），不會產生 `antigravity-oauth-token` 檔案。請先完成登入，再用 PowerShell 匯出 JSON。

1. 在 PowerShell 執行 `agy`，完成 Google 授權。

> ⚠️ **重要：請選擇「Use a Google Cloud Project」**，不要登入個人的 Google AI Pro 帳號。選擇你建立好的 GCP 專案來授權。

2. 在 PowerShell 貼上以下指令（一次貼上整行），輸出即為 `AGY_OAUTH_TOKEN` 所需的 JSON：

```powershell
if(-not('AgyCred'-as[type])){Add-Type 'using System;using System.Runtime.InteropServices;using System.Text;public class AgyCred{[StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)]public struct R{public int F,T;public string N,C;public System.Runtime.InteropServices.ComTypes.FILETIME L;public int S;public IntPtr B,P,A;public string X,U;}[DllImport("advapi32.dll",CharSet=CharSet.Unicode)]public static extern bool CredRead(string t,int y,int z,out IntPtr p);[DllImport("advapi32.dll")]public static extern bool CredFree(IntPtr p);}'};$p=[IntPtr]::Zero;try{if(-not[AgyCred]::CredRead('gemini:antigravity',1,0,[ref]$p)){throw 'agy credential not found'};$r=[Runtime.InteropServices.Marshal]::PtrToStructure($p,[type][AgyCred+R]);$b=New-Object byte[] $r.S;[Runtime.InteropServices.Marshal]::Copy($r.B,$b,0,$r.S);[Text.Encoding]::UTF8.GetString($b).Trim([char]0)}finally{if($p-ne[IntPtr]::Zero){[AgyCred]::CredFree($p)|Out-Null}}
```

### 複製 JSON 到 GitHub Secret

不論使用哪個平台，輸出都會是一段 JSON，類似：

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

複製**整份 JSON 內容**，這就是 `AGY_OAUTH_TOKEN` 的值。

> ⚠️ 請複製完整的 JSON，不是只有 refresh_token 欄位。

## 取得 AGY_GCP_PROJECT

1. 前往 [Google Cloud Console](https://console.cloud.google.com/)
2. 選擇你在登入 AGY 時授權的專案
3. 在專案資訊卡片（Dashboard）或網址列中找到 **Project ID**

> ⚠️ 要填的是 **Project ID**（例如 `my-project-123456`），不是專案顯示名稱。

Project ID 也可以在 Cloud Console 左上角專案選擇器中看到，每個專案名稱下方灰色小字就是 ID。
