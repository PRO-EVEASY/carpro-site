#!/usr/bin/env python3
"""CockpitPro ADB Studio authenticated Termux API.
Only use with a service account and API access you are authorized to operate.
No proxy addresses, supplier URLs, or credentials belong in this source file.
"""
import base64
from datetime import datetime
import hmac
import json
import os
from pathlib import Path
import re
import subprocess
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit

BASE = Path(os.environ["PREVIEW_HTML_FILE"])
USER = os.environ["PREVIEW_LOGIN_USER"]
PASSWORD = os.environ["PREVIEW_LOGIN_PASSWORD"]
AUTH = "Basic " + base64.b64encode(f"{USER}:{PASSWORD}".encode()).decode()
PROVIDER = os.environ.get("ADBAUTH_PROVIDER_URL", "").strip()
PROXY = os.environ.get("ADBAUTH_PROXY_URL", "").strip()
VENDOR_USERNAME = os.environ.get("ADBAUTH_USERNAME", "").strip()
ISSUE_ENABLED = os.environ.get("ADBAUTH_ENABLE_ISSUE", "0") == "1"
PORT = int(os.environ.get("PORT", "8765"))

# Only a configured HTTPS endpoint can be used; no browser-supplied target URLs.
if PROVIDER:
    parts = urlsplit(PROVIDER)
    if parts.scheme != "https" or not parts.hostname or parts.username or parts.password:
        raise SystemExit("ADBAUTH_PROVIDER_URL must be a credential-free HTTPS URL")
if PROXY and urlsplit(PROXY).scheme not in ("http", "https", "socks5", "socks5h"):
    raise SystemExit("Invalid ADBAUTH_PROXY_URL scheme")

last_issue = 0.0
issue_lock = threading.Lock()

class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_args):
        # Do not log keys, serial numbers, auth headers, or supplier URL.
        pass

    def send_data(self, obj, status=200):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.common_headers()
        self.end_headers()
        self.wfile.write(body)

    def common_headers(self):
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Content-Security-Policy", "frame-ancestors 'none'")
        self.send_header("Permissions-Policy", "camera=(), microphone=(), geolocation=()")

    def allowed(self):
        if hmac.compare_digest(self.headers.get("Authorization", ""), AUTH):
            return True
        self.send_response(401)
        self.send_header("WWW-Authenticate", 'Basic realm="CockpitPro ADB Studio", charset="UTF-8"')
        self.send_header("Content-Length", "0")
        self.common_headers()
        self.end_headers()
        return False

    def do_GET(self):
        if not self.allowed():
            return
        path = urlsplit(self.path).path
        if path == "/api/status":
            self.send_data({
                "ok": True,
                "server": "CockpitPro ADB Studio",
                "providerConfigured": bool(PROVIDER and VENDOR_USERNAME),
                "proxyConfigured": bool(PROXY),
                "generationEnabled": bool(PROVIDER and VENDOR_USERNAME and ISSUE_ENABLED),
            })
            return
        if path not in ("/", "/index.html"):
            self.send_data({"error": "not_found"}, 404)
            return
        page = BASE.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(page)))
        self.common_headers()
        self.end_headers()
        self.wfile.write(page)

    def do_POST(self):
        global last_issue
        if not self.allowed():
            return
        if urlsplit(self.path).path != "/api/generate":
            self.send_data({"error": "not_found"}, 404)
            return
        # Required custom header ensures cross-site HTML forms cannot trigger issuance.
        if self.headers.get("X-CockpitPro-Action") != "generate-key":
            self.send_data({"error": "invalid_request"}, 403)
            return
        if self.headers.get("Content-Type", "").split(";")[0].lower() != "application/json":
            self.send_data({"error": "invalid_content_type"}, 415)
            return
        if not ISSUE_ENABLED or not PROVIDER or not VENDOR_USERNAME:
            self.send_data({"error": "service_not_configured"}, 503)
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        if length < 1 or length > 2048:
            self.send_data({"error": "invalid_size"}, 400)
            return
        try:
            values = json.loads(self.rfile.read(length))
            serial = values.get("serial", "")
            date = values.get("date", "")
            if not isinstance(serial, str) or not re.fullmatch(r"[0-9]{8,32}", serial):
                raise ValueError("Invalid serial")
            if not isinstance(date, str) or not re.fullmatch(r"[0-9]{8}", date):
                raise ValueError("Invalid date")
            datetime.strptime(date, "%Y%m%d")
        except (ValueError, AttributeError, TypeError, json.JSONDecodeError):
            self.send_data({"error": "invalid_serial_or_date"}, 400)
            return

        # One request at a time; don't automatically retry paid/account-limited calls.
        with issue_lock:
            if time.monotonic() - last_issue < 20:
                self.send_data({"error": "rate_limited"}, 429)
                return
            last_issue = time.monotonic()
        uuid = serial + date
        cmd = [
            "curl", "-q", "-sS", "--proto", "=https",
            "--max-time", "22", "--connect-timeout", "8",
            "--max-filesize", "65536",
            "--request", "POST", "--header", "Accept: application/json",
            "--data-urlencode", "uuid=" + uuid,
            "--data-urlencode", "username=" + VENDOR_USERNAME,
            "--write-out", "\n--CP-HTTP:%{http_code}",
        ]
        if PROXY:
            cmd.extend(["--proxy", PROXY])
        cmd.append(PROVIDER)
        try:
            result = subprocess.run(cmd, text=True, capture_output=True, timeout=26, check=False)
            if result.returncode:
                self.send_data({"error": "upstream_connect_failed"}, 502)
                return
            body, marker, code = result.stdout.rpartition("\n--CP-HTTP:")
            if not marker or code.strip() != "200":
                self.send_data({"error": "upstream_unavailable"}, 502)
                return
            response = json.loads(body)
            if response in (1, "1"):
                self.send_data({"error": "vendor_user_not_found"}, 422)
                return
            if response in (2, "2"):
                self.send_data({"error": "vendor_no_remaining_uses"}, 422)
                return
            if not isinstance(response, dict) or not isinstance(response.get("data"), str) or not response["data"].strip():
                self.send_data({"error": "upstream_response_invalid"}, 502)
                return
            key_text = response["data"]
            if len(key_text.encode("utf-8")) > 16384:
                self.send_data({"error": "upstream_response_invalid"}, 502)
                return
            self.send_data({
                "ok": True,
                "authorizationCode": key_text,
                "remainingUses": response.get("num"),
                "filename": "adbauth.key"
            })
        except (subprocess.TimeoutExpired, ValueError, json.JSONDecodeError):
            self.send_data({"error": "upstream_timeout_or_invalid_json"}, 502)

    def do_HEAD(self):
        if not self.allowed():
            return
        self.send_response(200)
        self.common_headers()
        self.end_headers()

    def do_OPTIONS(self):
        self.send_data({"error": "not_supported"}, 405)

if __name__ == "__main__":
    print(f"CockpitPro ADB Studio listening at 127.0.0.1:{PORT}", flush=True)
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
