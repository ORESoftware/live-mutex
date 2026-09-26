#!/usr/bin/env bash
set -euo pipefail

client="clients/shell/live_mutex_client.sh"

if ! grep -Fq '"$RANDOM$RANDOM" "$RANDOM" "$$"' "$client"; then
  echo 'shell UUID fallback must include the current PID ($$)' >&2
  exit 1
fi

echo "shell UUID fallback PID contract: ok"
