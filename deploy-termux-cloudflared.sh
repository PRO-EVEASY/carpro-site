#!/data/data/com.termux/files/usr/bin/bash
# CockpitPro ADB Studio — password-protected Cloudflare Quick Tunnel preview
# Termux / Android. Issuance depends on private configuration; default is off.
# For an offline macOS preview with issuance blocked, use preview-local.command.
set -Eeuo pipefail
PORT="${PORT:-8765}"
ROOT="$HOME/cockpitpro-adb-preview"
BASE="https://raw.githubusercontent.com/PRO-EVEASY/carpro-site/feature/adb-studio-preview-2026-11"
for cmd in curl python cloudflared; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Missing $cmd. Install: pkg install python curl cloudflared -y"
    exit 1
  fi
done
umask 077
mkdir -p "$ROOT"
echo "Downloading CockpitPro ADB Studio preview..."
curl -fLsS --retry 2 --max-time 45 "$BASE/adb-studio.html" -o "$ROOT/index.html"
test -s "$ROOT/index.html"

echo "Downloading private API backend..."
curl -fLsS --retry 2 --max-time 45 "$BASE/adb_studio_server.py" -o "$ROOT/auth_server.py"
test -s "$ROOT/auth_server.py"

echo "Downloading local QR library..."
mkdir -p "$ROOT/assets/vendor"
for asset in qrcode.min.js LICENSE-qrcode.txt LICENSE-dijkstrajs.txt; do
  curl -fLsS --retry 2 --max-time 45 "$BASE/assets/vendor/$asset" -o "$ROOT/assets/vendor/$asset"
  test -s "$ROOT/assets/vendor/$asset"
done

# Only the local private file contains upstream addresses/credentials.
ENV_FILE="$HOME/.cockpitpro-adb.env"
if [ -f "$ENV_FILE" ]; then
  chmod 600 "$ENV_FILE"
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
  echo "Private configuration loaded from $ENV_FILE"
else
  echo "No private upstream configuration found; preview mode remains available."
fi

export PREVIEW_HTML_FILE="$ROOT/index.html"
export PREVIEW_LOGIN_USER="procar"
export PREVIEW_LOGIN_PASSWORD
PREVIEW_LOGIN_PASSWORD="$(python -c 'import secrets; print(secrets.token_urlsafe(24))')"
export PORT
echo "Starting password-protected ADB Studio on http://127.0.0.1:$PORT ..."
python "$ROOT/auth_server.py" > "$ROOT/server.log" 2>&1 &
SERVER_PID=$!
cleanup() { kill "$SERVER_PID" 2>/dev/null || true; }
trap cleanup EXIT INT TERM

READY=0
for i in 1 2 3 4 5 6 7 8; do
  HTTP_CODE="$(curl -sS --max-time 2 -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/" 2>/dev/null || true)"
  if [ "$HTTP_CODE" = "401" ]; then READY=1; break; fi
  sleep 1
done
if [ "$READY" != "1" ]; then
  echo "Server did not start. Check: cat '$ROOT/server.log'"
  exit 1
fi

echo
echo "========================================="
echo "CockpitPro ADB Studio · Private API"
echo "Login username: $PREVIEW_LOGIN_USER"
echo "Login password: $PREVIEW_LOGIN_PASSWORD"
echo "========================================="
echo "Do NOT share the password or terminal output."
echo "Cloudflare Quick Tunnel URL will appear below."
echo "Issuance enabled: ${ADBAUTH_ENABLE_ISSUE:-0} (server-side only)"
echo "Press Ctrl+C to stop both processes."
echo
# cloudflared in Termux 2026.6.1 does not support --allowed-mail.
# Public hostname is protected by the origin HTTP Basic Authentication above.
cloudflared tunnel --url "http://127.0.0.1:$PORT"
