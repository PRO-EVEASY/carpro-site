"""Private configuration and launcher tests; no provider/network calls."""
import argparse
import contextlib
import io
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import preview_local
from provider_local import configure_account, load_settings


class PrivateConfigTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.config = Path(self.temp.name) / "provider.env"

    def write_config(self, extra="", endpoint="https://provider.example.invalid/issue"):
        self.config.write_text(
            f"export ADBAUTH_PROVIDER_URL='{endpoint}'\n"
            "ADBAUTH_USERNAME='synthetic test account' # comment\n" + extra
        )
        self.config.chmod(0o600)

    def test_termux_quoted_assignments_and_optional_proxy(self):
        self.write_config("ADBAUTH_ENABLE_ISSUE=0\n")
        result = load_settings(self.config)
        self.assertEqual(result["ADBAUTH_USERNAME"], "synthetic test account")
        self.assertEqual(result["ADBAUTH_PROXY_URL"], "")
        self.assertNotIn("ADBAUTH_ENABLE_ISSUE", result)

    def test_shell_commands_are_never_executed(self):
        marker = Path(self.temp.name) / "must-not-exist"
        self.write_config(f"ADBAUTH_PROXY_URL=$(touch {marker})\n")
        with self.assertRaises(ValueError):
            load_settings(self.config)
        self.assertFalse(marker.exists())

    def test_extra_fields_and_duplicates_rejected(self):
        for extra in ("PATH=/tmp\n", "ADBAUTH_USERNAME=duplicate\n", "source another.env\n"):
            self.write_config(extra)
            with self.assertRaises(ValueError):
                load_settings(self.config)

    def test_private_permissions_required(self):
        self.write_config()
        self.config.chmod(0o644)
        with self.assertRaisesRegex(ValueError, "permissions 600"):
            load_settings(self.config)

    def test_endpoint_and_proxy_validation(self):
        for endpoint in ("http://provider.example.invalid", "https://name:secret@example.invalid", "https://example.invalid:99999", "https://[bad"):
            self.write_config(endpoint=endpoint)
            with self.assertRaises(ValueError) as error:
                load_settings(self.config)
            self.assertNotIn(endpoint, str(error.exception))
        self.write_config("ADBAUTH_PROXY_URL='file:///tmp/config'\n")
        with self.assertRaises(ValueError):
            load_settings(self.config)

    def test_missing_required_values_fail_closed(self):
        self.config.write_text("ADBAUTH_PROXY_URL=''\n")
        self.config.chmod(0o600)
        with self.assertRaises(ValueError):
            load_settings(self.config)

    def test_local_account_entry_preserves_route_and_private_permissions(self):
        self.write_config()
        with patch("provider_local.getpass.getpass", return_value="private-test-account'quoted"), \
             contextlib.redirect_stdout(io.StringIO()) as output:
            configure_account(self.config)
        settings = load_settings(self.config)
        self.assertEqual(settings["ADBAUTH_USERNAME"], "private-test-account'quoted")
        self.assertEqual(settings["ADBAUTH_PROVIDER_URL"], "https://provider.example.invalid/issue")
        self.assertEqual(self.config.stat().st_mode & 0o777, 0o600)
        self.assertNotIn(settings["ADBAUTH_USERNAME"], output.getvalue())

    def test_blank_account_does_not_enable_live_mode(self):
        self.config.write_text("ADBAUTH_PROVIDER_URL='https://provider.example.invalid/issue'\nADBAUTH_USERNAME=''\n")
        self.config.chmod(0o600)
        with patch("provider_local.getpass.getpass", return_value=""), self.assertRaises(ValueError):
            configure_account(self.config)
        with self.assertRaises(ValueError):
            load_settings(self.config)


class LauncherEnvironmentTests(unittest.TestCase):
    def run_launcher(self, live):
        with tempfile.TemporaryDirectory() as directory:
            expected = {"previewOnly": not live, "generationEnabled": live}
            class FakeProcess:
                returncode = None
                def poll(self):
                    return self.returncode
                def wait(self, **_kwargs):
                    self.returncode = 0
                    return 0
            class FakeOpener:
                def open(self, *_args, **_kwargs):
                    return io.BytesIO(json.dumps(expected).encode())
            settings = {"ADBAUTH_PROVIDER_URL": "https://provider.example.invalid/issue",
                        "ADBAUTH_USERNAME": "synthetic-test-account", "ADBAUTH_PROXY_URL": ""}
            args = argparse.Namespace(port=8766 if live else 8765, no_browser=True, quiet_login=True)
            with patch.object(preview_local, "__file__", str(Path(directory) / "preview_local.py")), \
                 patch.object(preview_local.subprocess, "Popen", return_value=FakeProcess()) as launch, \
                 patch.object(preview_local, "build_opener", return_value=FakeOpener()), \
                 patch.object(preview_local.signal, "signal"), \
                 patch.object(preview_local.time, "sleep"), \
                 patch.dict(os.environ, {"ADBAUTH_ENABLE_ISSUE": "1", "HTTPS_PROXY": "untrusted-inherited-value"}), \
                 contextlib.redirect_stdout(io.StringIO()):
                preview_local.run_server(args, provider_settings=settings if live else None)
                env = launch.call_args.kwargs["env"]
                self.assertNotIn("HTTPS_PROXY", env)
                self.assertEqual(env["ADBAUTH_PREVIEW_ONLY"], "0" if live else "1")
                self.assertEqual(env["ADBAUTH_ENABLE_ISSUE"], "1" if live else "0")
                if live:
                    self.assertEqual(env["ADBAUTH_USERNAME"], settings["ADBAUTH_USERNAME"])
                else:
                    self.assertNotIn("ADBAUTH_USERNAME", env)
                private = Path(directory) / (".local-provider" if live else ".local-preview")
                self.assertEqual(private.stat().st_mode & 0o777, 0o700)
                self.assertEqual((private / "login.json").stat().st_mode & 0o777, 0o600)

    def test_preview_ignores_inherited_live_settings(self):
        self.run_launcher(live=False)

    def test_provider_mode_uses_only_explicit_private_settings(self):
        self.run_launcher(live=True)


if __name__ == "__main__":
    unittest.main()
