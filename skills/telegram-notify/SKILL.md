---
name: telegram-notify
description: >-
  Send Telegram Bot notifications for development events, CI/CD pipeline status,
  and AGENTS.md progress updates. Use when integrating Telegram messaging into
  GitHub Actions workflows, sending pipeline end summaries, notifying teams
  about automation progress or repository changes. Requires TELEGRAM_NOTIFY_BOT_TOKEN
  environment variable or GitHub Secret. Target Chat IDs are resolved from the
  CSV recipients list defined in AGENTS.md.
---

# Telegram Notify

A skill for integrating Telegram Bot notifications into GitHub Actions workflows and automation scripts.

## When to Use This Skill

- Sending pipeline end notifications via Telegram
- Notifying about AGENTS.md or repository changes
- Alerting teams about CI/CD events (success, failure, progress)
- Integrating Telegram messaging into any automation workflow

## Prerequisites

- A Telegram Bot created via [@BotFather](https://t.me/BotFather)
- Bot Token stored as `TELEGRAM_NOTIFY_BOT_TOKEN` secret in GitHub Actions

## Resolving Recipients from AGENTS.md

AGENTS.md contains a **Telegram 通知收件人** section with:

1. **預設通知對象** — the default recipient name(s) used when the user does not specify who to notify.
2. **收件人對應表（CSV）** — a CSV list where each line is `chat_id,名稱`.

### Resolution Rules

1. If the user says a name (e.g. "發通知給 Will"), look up the Chat ID from the CSV 收件人對應表.
2. If the user does not specify a recipient, use the 預設通知對象 name, then resolve it from the CSV list.
3. If multiple names are specified (comma-separated in the default or explicitly by the user),
   call the send script once per Chat ID.
4. If a name is not found in the table, report the error — do not guess a Chat ID.
5. Parse each CSV row strictly as `chat_id,名稱`; names must not contain commas.

### Example AGENTS.md Section

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

## Getting Your Chat ID

1. Start a chat with your bot (or add it to a group/channel)
2. Send any message to the bot
3. Call `https://api.telegram.org/bot<TOKEN>/getUpdates` to see recent messages
4. Find `"chat":{"id":<number>}` in the response — that is your Chat ID

## Using the Reusable Action

The repository provides `.github/actions/telegram-notify` as a reusable composite action:

```yaml
- name: Build end notification message
  id: msg
  shell: bash
  run: |
    echo "message<<MSGEOF" >> "$GITHUB_OUTPUT"
    echo "✅ Pipeline completed: ${GITHUB_WORKFLOW}" >> "$GITHUB_OUTPUT"
    echo "Repository: ${GITHUB_REPOSITORY}" >> "$GITHUB_OUTPUT"
    echo "Event: ${GITHUB_EVENT_NAME}" >> "$GITHUB_OUTPUT"
    echo "Triggered by: ${GITHUB_ACTOR}" >> "$GITHUB_OUTPUT"
    echo "Status: ${JOB_STATUS}" >> "$GITHUB_OUTPUT"
    echo "Summary: ${EXECUTION_SUMMARY}" >> "$GITHUB_OUTPUT"
    echo "MSGEOF" >> "$GITHUB_OUTPUT"

- name: Send Telegram end notification
  uses: ./.github/actions/telegram-notify
  with:
    bot-token: ${{ secrets.TELEGRAM_NOTIFY_BOT_TOKEN }}
    chat-id: "<resolved from AGENTS.md>"
    message: ${{ steps.msg.outputs.message }}
    button-text: View Workflow Run
    button-url: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}
```

## Using the Helper Script

```bash
export TELEGRAM_NOTIFY_BOT_TOKEN="your_bot_token"
bash .agents/skills/telegram-notify/scripts/send-telegram.sh "123456789" "Your message"
```

## Direct API Call Reference

```bash
CHAT_ID="123456789"
MESSAGE="Your message"
payload=$(jq -n \
  --arg chat_id "${CHAT_ID}" \
  --arg text "${MESSAGE}" \
  '{"chat_id": $chat_id, "text": $text}')

curl -X POST "https://api.telegram.org/bot${TELEGRAM_NOTIFY_BOT_TOKEN}/sendMessage" \
  -H "Content-Type: application/json" \
  -d "$payload"
```

## Message Formatting (MarkdownV2 default)

The reusable action defaults to `parse-mode: MarkdownV2`.

If your message body is HTML (or you pass `parse-mode: HTML`), the action auto-converts it to MarkdownV2-compatible text before sending.

For run links, prefer inline keyboard buttons via:

- `button-text` + `button-url`, or
- `inline-keyboard-json` for custom button layouts.

## Security Notes

- Always store `TELEGRAM_NOTIFY_BOT_TOKEN` as a GitHub Secret, never in code or logs
- Chat IDs are resolved from AGENTS.md at runtime by the agent — they are not secrets
- All notification steps gracefully skip if credentials are not set
- Bot tokens should be rotated if accidentally exposed

## Graceful Degradation

All notification steps silently skip when `TELEGRAM_NOTIFY_BOT_TOKEN` is not set,
so workflows continue to function without Telegram credentials configured.
