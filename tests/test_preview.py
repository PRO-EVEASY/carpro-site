"""Local-only regression checks. No real provider endpoints or keys are used."""
import base64
import http.client
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import time
import unittest

ROOT = Path(__file__).resolve().parents[1]
AUTH = "Basic " + base64.b64encode(b"test-preview:local-test-password-only").decode()


class PreviewTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        cls.sentinel = Path(cls.temp.name) / "curl-was-called"
        curl = Path(cls.temp.name) / "curl"
        curl.write_text('#!/bin/sh\ntouch "${0%/*}/curl-was-called"\nexit 99\n')
        curl.chmod(0o700)
        with socket.socket() as probe:
            probe.bind(("127.0.0.1", 0))
            cls.port = probe.getsockname()[1]
        cls.env = {
            "PATH": cls.temp.name + os.pathsep + os.defpath,
            "PREVIEW_LOGIN_USER": "test-preview",
            "PREVIEW_LOGIN_PASSWORD": "local-test-password-only",
            # These deliberately invalid values must be ignored in preview mode.
            "ADBAUTH_PROVIDER_URL": "invalid-provider-must-not-be-read",
            "ADBAUTH_PROXY_URL": "invalid-proxy-must-not-be-read",
            "ADBAUTH_USERNAME": "nonexistent-test-account",
            "ADBAUTH_ENABLE_ISSUE": "1",
            "ADBAUTH_PREVIEW_ONLY": "1",
            "PORT": str(cls.port),
            "PYTHONDONTWRITEBYTECODE": "1",
        }
        # Use another cwd and omit PREVIEW_HTML_FILE to check the portable default.
        cls.server = subprocess.Popen(
            [sys.executable, str(ROOT / "adb_studio_server.py")],
            env=cls.env, cwd=cls.temp.name, stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE, text=True,
        )
        for _ in range(50):
            if cls.server.poll() is not None:
                raise RuntimeError(cls.server.stderr.read())
            try:
                with socket.create_connection(("127.0.0.1", cls.port), timeout=0.1):
                    return
            except OSError:
                time.sleep(0.05)
        cls.server.terminate()
        cls.server.wait(timeout=5)
        raise RuntimeError("Test server did not start")

    @classmethod
    def tearDownClass(cls):
        cls.server.terminate()
        cls.server.wait(timeout=5)
        cls.server.stderr.close()
        cls.temp.cleanup()

    def request(self, path, method="GET", body=None, auth=AUTH, headers=None):
        request_headers = dict(headers or {})
        if auth is not None:
            request_headers["Authorization"] = auth
        conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=2)
        try:
            conn.request(method, path, body=body, headers=request_headers)
            response = conn.getresponse()
            return response.status, dict(response.getheaders()), response.read()
        finally:
            conn.close()

    def test_auth_required_on_page_api_and_asset(self):
        for path in ("/", "/api/status", "/assets/vendor/qrcode.min.js"):
            for method in ("GET", "HEAD"):
                with self.subTest(path=path, method=method):
                    status, headers, body = self.request(path, method=method, auth=None)
                    self.assertEqual(status, 401)
                    self.assertIn("Basic", headers["WWW-Authenticate"])
                    self.assertEqual(body, b"")

    def test_wrong_and_non_ascii_auth_rejected(self):
        for auth in ("Basic wrong", "Basic caf\xe9"):
            self.assertEqual(self.request("/api/status", auth=auth)[0], 401)

    def test_inherited_live_settings_cannot_enable_preview(self):
        status, headers, body = self.request("/api/status")
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(body), {
            "ok": True, "server": "CockpitPro ADB Studio", "previewOnly": True,
            "providerConfigured": False, "proxyConfigured": False,
            "generationEnabled": False,
        })
        self.assertEqual(headers["Cache-Control"], "no-store")
        self.assertEqual(headers["X-Frame-Options"], "DENY")

    def test_public_page_aliases_and_local_qr_bundle(self):
        for path in ("/", "/index.html", "/adb-studio.html"):
            status, headers, body = self.request(path)
            self.assertEqual(status, 200)
            self.assertIn(b'/assets/vendor/qrcode.min.js', body)
            self.assertNotIn(b"cdn.jsdelivr.net", body)
            self.assertEqual(int(headers["Content-Length"]), len(body))
        status, headers, body = self.request("/assets/vendor/qrcode.min.js")
        self.assertEqual(status, 200)
        self.assertIn("javascript", headers["Content-Type"])
        self.assertGreater(len(body), 1000)
        self.assertIn(b"QRCode", body)

    def test_private_files_and_path_traversal_not_served(self):
        for path in ("/.env", "/.local-preview/login.json", "/.git/config",
                     "/adb_studio_server.py", "/../adb_studio_server.py",
                     "/assets/vendor/../../.local-preview/login.json",
                     "/assets/vendor/%2e%2e/%2e%2e/.env"):
            with self.subTest(path=path):
                self.assertEqual(self.request(path)[0], 404)

    def test_direct_generation_request_blocked_without_calling_curl(self):
        status, _, body = self.request("/api/generate", "POST",
            body=json.dumps({"serial": "12345678", "date": "20261117"}),
            headers={"Content-Type": "application/json", "X-CockpitPro-Action": "generate-key"})
        self.assertEqual(status, 503)
        self.assertEqual(json.loads(body), {"error": "preview_only"})
        self.assertFalse(self.sentinel.exists(), "Preview tried to run curl")

    def test_generation_still_requires_auth_and_request_headers(self):
        self.assertEqual(self.request("/api/generate", "POST", body="{}", auth=None)[0], 401)
        self.assertEqual(self.request("/api/generate", "POST", body="{}")[0], 403)
        self.assertEqual(self.request("/api/generate", "POST", body="{}",
            headers={"X-CockpitPro-Action": "generate-key"})[0], 415)

    def test_head_matches_get_and_has_no_body(self):
        for path in ("/", "/api/status", "/assets/vendor/qrcode.min.js", "/missing"):
            get_status, get_headers, get_body = self.request(path)
            status, headers, body = self.request(path, "HEAD")
            self.assertEqual(status, get_status)
            self.assertEqual(headers["Content-Length"], get_headers["Content-Length"])
            self.assertEqual(int(headers["Content-Length"]), len(get_body))
            self.assertEqual(body, b"")

    def test_preflight_does_not_enable_cross_origin_access(self):
        status, headers, _ = self.request("/api/generate", "OPTIONS", auth=None)
        self.assertEqual(status, 405)
        self.assertNotIn("Access-Control-Allow-Origin", headers)

    def test_configuration_errors_are_clear(self):
        for update, message in (({"PREVIEW_LOGIN_PASSWORD": ""}, "PREVIEW_LOGIN_PASSWORD"),
                                ({"PORT": "bad"}, "PORT must be"),
                                ({"PORT": "65536"}, "PORT must be"),
                                ({"PREVIEW_HTML_FILE": "missing.html"}, "Preview HTML file")):
            result = subprocess.run([sys.executable, str(ROOT / "adb_studio_server.py")],
                env={**self.env, **update}, capture_output=True, text=True, timeout=3)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn(message, result.stderr)
            self.assertNotIn("Traceback", result.stderr)


if __name__ == "__main__":
    unittest.main()
