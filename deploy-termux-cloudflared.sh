#!/data/data/com.termux/files/usr/bin/bash
# CockpitPro ADB Studio — password-protected Cloudflare Quick Tunnel preview
# Termux / Android; serves static preview only. Does NOT generate or issue ADB keys.
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

cat > "$ROOT/auth_server.py" <<'PY'
import base64
import hmac
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit

html_file = os.environ["PREVIEW_HTML_FILE"]
username = os.environ["PREVIEW_LOGIN_USER"]
password = os.environ["PREVIEW_LOGIN_PASSWORD"]
expected = "Basic " + base64.b64encode(f"{username}:{password}".encode()).decode()

class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_args):
        pass

    def serve_page(self, head=False):
        if not hmac.compare_digest(self.headers.get("Authorization", ""), expected):
            self.send_response(401)
            self.send_header("WWW-Authenticate", 'Basic realm="CockpitPro Preview", charset="UTF-8"')
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", "0")
            self.end_headers()
            return
        path = urlsplit(self.path).path
        if path not in ("/", "/index.html"):
            self.send_error(404, "Not Found")
            return
        data = open(html_file, "rb").read()
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "no-referrer")
        self.end_headers()
        if not head:
            self.wfile.write(data)

    def do_GET(self):
        self.serve_page()

    def do_HEAD(self):
        self.serve_page(head=True)

    def do_POST(self):
        self.send_error(405, "Method Not Allowed")

server = ThreadingHTTPServer(("127.0.0.1", int(os.environ["PORT"])), Handler)
server.serve_forever()
PY
export PREVIEW_HTML_FILE="$ROOT/index.html"
export PREVIEW_LOGIN_USER="procar"
export PREVIEW_LOGIN_PASSWORD
PREVIEW_LOGIN_PASSWORD="$(python -c 'import secrets; print(secrets.token_urlsafe(24))')"
export PORT
echo "Starting password-protected preview on http://127.0.0.1:$PORT ..."
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
echo "CockpitPro ADB Studio Preview"
echo "Login username: $PREVIEW_LOGIN_USER"
echo "Login password: $PREVIEW_LOGIN_PASSWORD"
echo "========================================="
echo "Do NOT share the password or terminal output."
echo "Cloudflare Quick Tunnel URL will appear below."
echo "Press Ctrl+C to stop both processes."
echo
# cloudflared in Termux 2026.6.1 does not support --allowed-mail.
# Public hostname is protected by the origin HTTP Basic Authentication above.
cloudflared tunnel --url "http://127.0.0.1:$PORT"
