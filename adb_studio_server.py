#!/usr/bin/env python3
"""CockpitPro ADB Studio authenticated local/Termux API.
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
from http.cookies import SimpleCookie
from urllib.parse import urlsplit
from customer_access import CustomerAccess, AccessError, SESSION_SECONDS

BASE = Path(os.environ.get("PREVIEW_HTML_FILE", Path(__file__).with_name("adb-studio.html"))).resolve()
USER = os.environ.get("PREVIEW_LOGIN_USER", "")
PASSWORD = os.environ.get("PREVIEW_LOGIN_PASSWORD", "")
if not USER or not PASSWORD or ":" in USER:
    raise SystemExit("Set PREVIEW_LOGIN_USER and PREVIEW_LOGIN_PASSWORD, or run ./preview-local.command")
if not BASE.is_file():
    raise SystemExit("Preview HTML file was not found; check PREVIEW_HTML_FILE")
AUTH = "Basic " + base64.b64encode(f"{USER}:{PASSWORD}".encode()).decode()
# The local launcher forces this mode. Ignore even inherited live configuration.
PREVIEW_ONLY = os.environ.get("ADBAUTH_PREVIEW_ONLY", "0") == "1"
PROVIDER = "" if PREVIEW_ONLY else os.environ.get("ADBAUTH_PROVIDER_URL", "").strip()
PROXY = "" if PREVIEW_ONLY else os.environ.get("ADBAUTH_PROXY_URL", "").strip()
VENDOR_USERNAME = "" if PREVIEW_ONLY else os.environ.get("ADBAUTH_USERNAME", "").strip()
ISSUE_ENABLED = not PREVIEW_ONLY and os.environ.get("ADBAUTH_ENABLE_ISSUE", "0") == "1"
CUSTOMERS = CustomerAccess(os.environ['ADBAUTH_CUSTOMER_DB']) if not PREVIEW_ONLY and os.environ.get('ADBAUTH_CUSTOMER_DB') else None
try:
    PORT = int(os.environ.get("PORT", "8765"))
    if not 1 <= PORT <= 65535:
        raise ValueError
except ValueError:
    raise SystemExit("PORT must be a number between 1 and 65535") from None

# Serve only these public assets, never a directory or private runtime files.
PUBLIC_FILES = {
    "/": (BASE, "text/html; charset=utf-8"),
    "/index.html": (BASE, "text/html; charset=utf-8"),
    "/adb-studio.html": (BASE, "text/html; charset=utf-8"),
    "/login": (BASE.parent / 'customer-login.html', 'text/html; charset=utf-8'),
    "/admin": (BASE.parent / 'customer-admin.html', 'text/html; charset=utf-8'),
    "/assets/vendor/qrcode.min.js": (
        BASE.parent / "assets/vendor/qrcode.min.js", "text/javascript; charset=utf-8"
    ),
}

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
        if self.command != "HEAD":
            self.wfile.write(body)

    def common_headers(self):
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Content-Security-Policy", "frame-ancestors 'none'")
        self.send_header("Permissions-Policy", "camera=(), microphone=(), geolocation=()")

    def allowed(self):
        self.customer = None
        if self.is_admin():
            return True
        if CUSTOMERS:
            self.customer = CUSTOMERS.authenticate(self.session_token())
            if self.customer:
                return True
            path = urlsplit(self.path).path
            if path in ('/', '/index.html', '/adb-studio.html') and self.command in ('GET', 'HEAD'):
                self.send_response(302)
                self.send_header('Location', '/login')
                self.send_header('Content-Length', '0')
                self.common_headers()
                self.end_headers()
            else:
                self.send_data({'error': 'login_required'}, 401)
            return False
        return self.require_admin()

    def is_admin(self):
        return hmac.compare_digest(self.headers.get('Authorization', '').encode(), AUTH.encode())

    def require_admin(self):
        if self.is_admin():
            return True
        self.send_response(401)
        self.send_header("WWW-Authenticate", 'Basic realm="CockpitPro ADB Studio", charset="UTF-8"')
        self.send_header("Content-Length", "0")
        self.common_headers()
        self.end_headers()
        return False

    def session_token(self):
        try:
            cookie = SimpleCookie(self.headers.get('Cookie', ''))
            return cookie['cp_adb_session'].value if 'cp_adb_session' in cookie else ''
        except Exception:
            return ''

    def json_body(self, action):
        header = self.headers.get('X-CockpitPro-Action')
        if header is not None and header != action:
            raise AccessError('invalid_request', 403)
        if self.headers.get('Content-Type', '').split(';')[0].lower() != 'application/json':
            raise AccessError('invalid_content_type', 415)
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if not 1 <= length <= 2048:
                raise ValueError
            result = json.loads(self.rfile.read(length))
            if not isinstance(result, dict):
                raise ValueError
            # JSON is not a CORS-safelisted content type. Cross-origin requests
            # require a preflight, which this server refuses. The body intent
            # also works through forwarding layers that strip custom headers.
            if header != action and result.get('intent') != action:
                raise AccessError('invalid_request', 403)
            return result
        except (ValueError, TypeError):
            raise AccessError('invalid_request', 400) from None

    def cookie_response(self, token, max_age):
        secure = '; Secure' if self.headers.get('X-Forwarded-Proto', '').lower() == 'https' else ''
        body = b'{"ok": true}'
        self.send_response(200)
        self.send_header('Set-Cookie', f'cp_adb_session={token}; Path=/; HttpOnly; SameSite=Strict; Max-Age={max_age}{secure}')
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.common_headers()
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = urlsplit(self.path).path
        if path in ('/admin', '/api/admin/customers'):
            if not self.require_admin():
                return
            self.customer = None
            if path == '/api/admin/customers':
                self.send_data(CUSTOMERS.list_customers() if CUSTOMERS else {'error': 'customer_access_disabled'}, 200 if CUSTOMERS else 503)
                return
        elif path == '/login' and CUSTOMERS:
            self.customer = None
        elif not self.allowed():
            return
        if path == "/api/status":
            result = {
                "ok": True,
                "server": "CockpitPro ADB Studio",
                "previewOnly": PREVIEW_ONLY,
                "providerConfigured": bool(PROVIDER and VENDOR_USERNAME),
                "proxyConfigured": bool(PROXY),
                "generationEnabled": bool(PROVIDER and VENDOR_USERNAME and ISSUE_ENABLED),
            }
            if self.customer:
                # Customers see only their own quota, never the upstream account balance.
                result['customer'] = self.customer
                result['generationEnabled'] = result['generationEnabled'] and self.customer['remainingKeys'] > 0
            elif CUSTOMERS:
                result['admin'] = True
            self.send_data(result)
            return
        if path not in PUBLIC_FILES:
            self.send_data({"error": "not_found"}, 404)
            return
        file, content_type = PUBLIC_FILES[path]
        try:
            page = file.read_bytes()
        except OSError:
            self.send_data({"error": "not_found"}, 404)
            return
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(page)))
        self.common_headers()
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(page)

    def do_POST(self):
        global last_issue
        path = urlsplit(self.path).path
        if CUSTOMERS and path in ('/api/login', '/api/logout', '/api/admin/customers'):
            try:
                if path == '/api/login':
                    values = self.json_body('customer-login')
                    # cloudflared is loopback-only; its address is the edge-supplied client address.
                    address = self.headers.get('CF-Connecting-IP', self.client_address[0])[:128]
                    token, _customer = CUSTOMERS.login(values.get('customerId'), values.get('code'), address)
                    self.cookie_response(token, SESSION_SECONDS)
                elif path == '/api/logout':
                    self.json_body('customer-logout')
                    CUSTOMERS.logout(self.session_token())
                    self.cookie_response('', 0)
                else:
                    if not self.require_admin():
                        return
                    values = self.json_body('manage-customers')
                    action = values.get('action')
                    if action == 'create':
                        self.send_data(CUSTOMERS.provision(values.get('name'), values.get('quota')))
                    elif action == 'reset_authenticator':
                        self.send_data(CUSTOMERS.provision(customer_id=values.get('customerId')))
                    elif action == 'release_uncertain':
                        CUSTOMERS.release_uncertain(values.get('requestId'))
                        self.send_data({'ok': True})
                    else:
                        CUSTOMERS.update(values.get('customerId'), action, values.get('amount'))
                        self.send_data({'ok': True})
            except AccessError as error:
                self.send_data({'error': error.code}, error.status)
            return
        if not self.allowed():
            return
        if urlsplit(self.path).path != "/api/generate":
            self.send_data({"error": "not_found"}, 404)
            return
        # Required custom header ensures cross-site HTML forms cannot trigger issuance.
        if self.headers.get("X-CockpitPro-Action") != "generate-key" and not CUSTOMERS:
            self.send_data({"error": "invalid_request"}, 403)
            return
        if self.headers.get("Content-Type", "").split(";")[0].lower() != "application/json":
            self.send_data({"error": "invalid_content_type"}, 415)
            return
        if PREVIEW_ONLY:
            self.send_data({"error": "preview_only"}, 503)
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
            if CUSTOMERS and self.headers.get('X-CockpitPro-Action') != 'generate-key' and values.get('intent') != 'generate-key':
                self.send_data({'error': 'invalid_request'}, 403)
                return
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

        reservation = None
        if self.customer:
            try:
                reservation = CUSTOMERS.reserve(self.customer['id'], serial, date)
            except AccessError as error:
                self.send_data({'error': error.code}, error.status)
                return
            if 'cached' in reservation:
                current = CUSTOMERS.customer(self.customer['id'])
                self.send_data({'ok': True, 'authorizationCode': reservation['cached'],
                                'remainingUses': current['remainingKeys'], 'filename': 'adbauth.key'})
                return
        def release_reservation():
            if reservation and reservation.get('issue_id'):
                CUSTOMERS.finish(reservation['issue_id'], certain_failure=True)

        # Reserve the customer quota atomically before a provider call.
        with issue_lock:
            if time.monotonic() - last_issue < 20:
                release_reservation()
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
                if reservation:
                    CUSTOMERS.finish(reservation['issue_id'], certain_failure=result.returncode in (5, 6, 7))
                self.send_data({"error": "upstream_connect_failed"}, 502)
                return
            body, marker, code = result.stdout.rpartition("\n--CP-HTTP:")
            if not marker or code.strip() != "200":
                if reservation:
                    CUSTOMERS.finish(reservation['issue_id'])
                self.send_data({"error": "upstream_unavailable"}, 502)
                return
            response = json.loads(body)
            if response in (1, "1"):
                release_reservation()
                self.send_data({"error": "vendor_user_not_found"}, 422)
                return
            if response in (2, "2"):
                release_reservation()
                self.send_data({"error": "vendor_no_remaining_uses"}, 422)
                return
            if not isinstance(response, dict) or not isinstance(response.get("data"), str) or not response["data"].strip():
                if reservation:
                    CUSTOMERS.finish(reservation['issue_id'])
                self.send_data({"error": "upstream_response_invalid"}, 502)
                return
            key_text = response["data"]
            if len(key_text.encode("utf-8")) > 16384:
                if reservation:
                    CUSTOMERS.finish(reservation['issue_id'])
                self.send_data({"error": "upstream_response_invalid"}, 502)
                return
            remaining = response.get('num')
            if reservation:
                CUSTOMERS.finish(reservation['issue_id'], key_text=key_text)
                remaining = CUSTOMERS.customer(self.customer['id'])['remainingKeys']
            self.send_data({
                "ok": True,
                "authorizationCode": key_text,
                "remainingUses": remaining,
                "filename": "adbauth.key"
            })
        except (subprocess.TimeoutExpired, ValueError, json.JSONDecodeError):
            if reservation:
                CUSTOMERS.finish(reservation['issue_id'])
            self.send_data({"error": "upstream_timeout_or_invalid_json"}, 502)

    def do_HEAD(self):
        self.do_GET()

    def do_OPTIONS(self):
        self.send_data({"error": "not_supported"}, 405)

if __name__ == "__main__":
    try:
        server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    except OSError:
        raise SystemExit(f"Cannot listen on 127.0.0.1:{PORT}; stop the existing preview or choose another PORT") from None
    print(f"CockpitPro ADB Studio listening at http://127.0.0.1:{PORT}", flush=True)
    if PREVIEW_ONLY:
        print("Local preview only: provider access and key generation are disabled.", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
