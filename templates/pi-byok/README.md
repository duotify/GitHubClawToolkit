# Pi BYOK

使用 Pi Coding Agent 作為小龍蝦執行引擎的 BYOK 範本。支援 Cloudflare Workers AI、Anthropic、OpenAI、Gemini、Groq、Pioneer 等 provider。

## 使用 Pioneer

1. 在 GitHub repository secrets 新增 `PIONEER_API_KEY`（從 [pioneer.ai](https://pioneer.ai) → Settings → API Keys 取得）。
2. 將小龍蝦工作區的 `.pi/settings.json` 改成：

   ```json
   {
     "defaultProvider": "pioneer",
     "defaultModel": "gpt-5.5",
     "quietStartup": true
   }
   ```

3. 觸發 `issue-N.yml` workflow 即可。本地測試可用：

   ```bash
   PI_CODING_AGENT_DIR=.pi PIONEER_API_KEY=your-api-key npx -y @mariozechner/pi-coding-agent@0.70.6 --list-models pioneer
   ```

4. 執行結果會寫入 `artifacts/{comment_id}/result.md`。

## Pioneer 可用模型

| Model ID | 說明 |
|----------|------|
| `gpt-5.5` | GPT-5.5 |
| `claude-sonnet-4-6` | Claude Sonnet 4.6 |
| `claude-opus-4-7` | Claude Opus 4.7 |
| `deepseek-ai/DeepSeek-V4-Pro` | DeepSeek V4 Pro |
| `moonshotai/Kimi-K2.6` | Kimi K2.6 |

模型清單可透過 Pioneer API 查詢最新支援：

```bash
curl -sS "https://api.pioneer.ai/base-models?supports_inference=true" \
  -H "X-API-Key: $PIONEER_API_KEY" \
  | jq -r '.models[] | select(.task_type == "decoder") | "\(.id)\t\(.context_window)"'
```

## 技術細節

- Pioneer 設定放在 `.pi/models.json`，使用 `https://api.pioneer.ai/v1` OpenAI-compatible endpoint。
- Auth 透過 `X-API-Key` header 與 Pi 的 custom headers 機制注入。
- Workflow 中 `PI_CODING_AGENT_DIR=.pi` 確保 Pi 載入 template 的 `models.json`。
