#!/bin/bash
set -e

# Cross-platform compatibility
if ! command -v curl &> /dev/null; then
  echo "ERROR: curl is required but not installed"
  exit 1
fi

# Check if API key is set
if [ -z "$FELO_API_KEY" ]; then
  echo "ERROR: FELO_API_KEY not set"
  echo ""
  echo "To use this skill, you need to set up your Felo API Key:"
  echo ""
  echo "1. Get your API key from https://felo.ai (Settings → API Keys)"
  echo "2. Set the environment variable:"
  echo ""
  echo "   Linux/macOS/WSL:"
  echo "   export FELO_API_KEY=\"your-api-key-here\""
  echo ""
  echo "   Windows (PowerShell):"
  echo "   \$env:FELO_API_KEY=\"your-api-key-here\""
  echo ""
  echo "   Windows (CMD):"
  echo "   set FELO_API_KEY=your-api-key-here"
  echo ""
  echo "3. Restart Claude Code or reload the environment"
  exit 1
fi

# Get query from first argument
QUERY="$1"

if [ -z "$QUERY" ]; then
  echo "ERROR: No query provided"
  echo "Usage: search.sh \"your search query\""
  exit 1
fi

# Escape JSON string: replace backslash, then quotes, then control chars
# Compatible with sed on Linux, macOS, and Windows (Git Bash/WSL)
ESCAPED_QUERY=$(printf '%s\n' "$QUERY" | sed 's/\\/\\\\/g; s/"/\\"/g; s/	/\\t/g')

# Call Felo API
curl -s -X POST https://openapi.felo.ai/v2/chat \
  -H "Authorization: Bearer $FELO_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"query\": \"$ESCAPED_QUERY\"}"
