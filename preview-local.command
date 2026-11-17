#!/bin/bash
# macOS Finder/Terminal launcher. Python standard library only; no tunnel.
set -euo pipefail
SCRIPT_DIR="$(cd -- "$(dirname -- "$0")" && pwd)"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command -v python3 >/dev/null 2>&1; then
  echo "Python 3 is required. Install it, then run this launcher again."
  exit 1
fi
exec python3 "$SCRIPT_DIR/preview_local.py" "$@"
