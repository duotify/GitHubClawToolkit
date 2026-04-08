#!/usr/bin/env bash
# Send a message to a Telegram chat via Bot API.
#
# Usage:
#   TELEGRAM_NOTIFY_BOT_TOKEN=<token> ./send-telegram.sh <chat_id> "Your message"
#   TELEGRAM_NOTIFY_BOT_TOKEN=<token> ./send-telegram.sh <chat_id> "Your message" HTML
#
# Environment variables:
#   TELEGRAM_NOTIFY_BOT_TOKEN — Dedicated Bot Token for notifications (required)
#
# Arguments:
#   $1  — chat ID (required, numeric or @channelname)
#   $2  — message text (required)
#   $3  — parse mode: HTML, Markdown, MarkdownV2, or empty for plain text (optional)

set -euo pipefail

CHAT_ID="${1:-}"
MESSAGE="${2:-}"
PARSE_MODE="${3:-}"

BOT_TOKEN="${TELEGRAM_NOTIFY_BOT_TOKEN:-}"

if [ -z "$BOT_TOKEN" ]; then
  echo "Error: TELEGRAM_NOTIFY_BOT_TOKEN must be set." >&2
  exit 1
fi

if [ -z "$CHAT_ID" ]; then
  echo "Error: chat ID argument cannot be empty." >&2
  exit 1
fi

if [ -z "$MESSAGE" ]; then
  echo "Error: message argument cannot be empty." >&2
  exit 1
fi

if [ -n "${PARSE_MODE:-}" ]; then
  payload=$(jq -n \
    --arg chat_id "${CHAT_ID}" \
    --arg text "${MESSAGE}" \
    --arg parse_mode "${PARSE_MODE}" \
    '{"chat_id": $chat_id, "text": $text, "parse_mode": $parse_mode}')
else
  payload=$(jq -n \
    --arg chat_id "${CHAT_ID}" \
    --arg text "${MESSAGE}" \
    '{"chat_id": $chat_id, "text": $text}')
fi

tg_response_file=$(mktemp)
http_code=$(curl -s -o "$tg_response_file" -w "%{http_code}" \
  -X POST "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
  -H "Content-Type: application/json" \
  -d "$payload")

if [ "$http_code" = "200" ]; then
  echo "Telegram notification sent successfully."
  rm -f "$tg_response_file"
else
  echo "Telegram notification failed (HTTP ${http_code}):" >&2
  cat "$tg_response_file" >&2
  rm -f "$tg_response_file"
  exit 1
fi
