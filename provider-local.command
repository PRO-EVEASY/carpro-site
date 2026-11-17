#!/bin/bash
# Opt-in local provider mode. Uses a private file, never inherited vendor values.
set -euo pipefail
SCRIPT_DIR="$(cd -- "$(dirname -- "$0")" && pwd)"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command -v python3 >/dev/null 2>&1; then
  echo "Python 3 is required. Install it, then run this launcher again."
  exit 1
fi
exec python3 "$SCRIPT_DIR/provider_local.py" "$@"
