---
name: telegram-notify
description: >-
  Send Telegram Bot notifications for development events, CI/CD pipeline status,
  and AGENTS.md progress updates. Use when integrating Telegram messaging into
  GitHub Actions workflows, sending pipeline end summaries, notifying teams
  about automation progress or repository changes. Requires TELEGRAM_BOT_TOKEN
  and TELEGRAM_CHAT_ID environment variables or GitHub Secrets.
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
- Bot Token stored as `TELEGRAM_BOT_TOKEN` secret in GitHub Actions
- Target Chat ID stored as `TELEGRAM_CHAT_ID` secret or variable

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
    bot-token: ${{ secrets.TELEGRAM_BOT_TOKEN }}
    chat-id: ${{ secrets.TELEGRAM_CHAT_ID }}
    message: ${{ steps.msg.outputs.message }}
    button-text: View Workflow Run
    button-url: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}
```

## Using the Helper Script

```bash
export TELEGRAM_BOT_TOKEN="your_bot_token"
export TELEGRAM_CHAT_ID="your_chat_id"
bash .agents/skills/telegram-notify/scripts/send-telegram.sh "Your message"
```

## Direct API Call Reference

```bash
MESSAGE="Your message"
payload=$(jq -n \
  --arg chat_id "${TELEGRAM_CHAT_ID}" \
  --arg text "${MESSAGE}" \
  '{"chat_id": $chat_id, "text": $text}')

curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
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

- Always store `TELEGRAM_BOT_TOKEN` as a GitHub Secret, never in code or logs
- `TELEGRAM_CHAT_ID` can be stored as a Secret or Repository Variable
- All notification steps gracefully skip if credentials are not set
- Bot tokens should be rotated if accidentally exposed

## Graceful Degradation

All notification steps silently skip when `TELEGRAM_BOT_TOKEN` or `TELEGRAM_CHAT_ID`
are not set, so workflows continue to function without Telegram credentials configured.
