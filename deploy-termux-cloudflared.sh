#!/data/data/com.termux/files/usr/bin/bash
# CockpitPro ADB Studio — authenticated Cloudflare Quick Tunnel preview
# Run on Android Termux. Does not start or expose an ADB key-generation backend.
set -Eeuo pipefail

PORT="${PORT:-8765}"
ROOT="${HOME}/cockpitpro-adb-preview"
BASE="https://raw.githubusercontent.com/PRO-EVEASY/carpro-site/feature/adb-studio-preview-2026-11"

for cmd in curl python cloudflared; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Missing $cmd. Install it with: pkg install python curl cloudflared -y"
    exit 1
  fi
done

mkdir -p "$ROOT"
echo "Fetching latest ADB Studio preview from GitHub branch..."
curl -fLSs --retry 2 --max-time 40 "$BASE/adb-studio.html" -o "$ROOT/index.html"
test -s "$ROOT/index.html"
chmod 600 "$ROOT/index.html"

if [ -z "${ALLOWED_EMAIL:-}" ]; then
  printf 'Enter your email to restrict tunnel access (required): '
  IFS= read -r ALLOWED_EMAIL
fi
case "$ALLOWED_EMAIL" in
  *@*.*) ;;
  *) echo "Invalid email. Tunnel not started."; exit 1 ;;
esac

echo "Starting local preview on 127.0.0.1:$PORT..."
python -m http.server "$PORT" --bind 127.0.0.1 --directory "$ROOT" > "$ROOT/server.log" 2>&1 &
SERVER_PID=$!
cleanup() { kill "$SERVER_PID" 2>/dev/null || true; }
trap cleanup EXIT INT TERM

READY=0
for i in 1 2 3 4 5; do
  if curl -fsS --max-time 2 -o /dev/null "http://127.0.0.1:$PORT/"; then READY=1; break; fi
  sleep 1
done
if [ "$READY" != "1" ]; then
  echo "Local preview did not start. Inspect $ROOT/server.log"
  exit 1
fi

echo "Local preview ready at http://127.0.0.1:$PORT/"
echo "Creating an email-restricted Cloudflare Quick Tunnel."
echo "The URL is temporary and changes after restarting."
echo "Press Ctrl+C to stop."
cloudflared tunnel --url "http://127.0.0.1:$PORT" --allowed-mail "$ALLOWED_EMAIL"
