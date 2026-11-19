#!/usr/bin/env python3
"""Run an authenticated, offline development preview on macOS or Linux."""
import argparse
import base64
import fcntl
import json
import os
from pathlib import Path
import secrets
import signal
import subprocess
import sys
import time
from urllib.error import URLError
from urllib.request import ProxyHandler, Request, build_opener
import webbrowser


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--no-browser", action="store_true")
    parser.add_argument("--quiet-login", action="store_true", help="Only print the private login file location")
    args = parser.parse_args()
    if not 1 <= args.port <= 65535:
        parser.error("--port must be between 1 and 65535")
    run_server(args)


def run_server(args, provider_settings=None):
    live = provider_settings is not None
    root = Path(__file__).resolve().parent
    os.umask(0o077)
    private = root / (".local-provider" if live else ".local-preview")
    username = "operator" if live else "preview"
    private.mkdir(mode=0o700, exist_ok=True)
    private.chmod(0o700)
    lock = (private / "launcher.lock").open("w")
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        raise SystemExit("This checkout already has a local preview running. Stop it with Ctrl+C first.") from None

    login_file = private / "login.json"
    if login_file.exists():
        try:
            login = json.loads(login_file.read_text())
            if login["username"] != username or not isinstance(login["password"], str) or len(login["password"]) < 24:
                raise ValueError
        except (ValueError, KeyError, TypeError):
            raise SystemExit(f"Invalid local login file. Remove {private.name}/login.json to create a new one.") from None
    else:
        login = {"username": username, "password": secrets.token_urlsafe(24)}
        with login_file.open("x") as stream:
            json.dump(login, stream)
            stream.write("\n")
    login_file.chmod(0o600)

    # Build a fresh environment: no inherited supplier credentials, proxies,
    # Python injection variables or shell configuration reach the server.
    env = {
        "PATH": os.defpath,
        "PREVIEW_HTML_FILE": str(root / "adb-studio.html"),
        "PREVIEW_LOGIN_USER": login["username"],
        "PREVIEW_LOGIN_PASSWORD": login["password"],
        "ADBAUTH_PREVIEW_ONLY": "1",
        "ADBAUTH_ENABLE_ISSUE": "0",
        "PORT": str(args.port),
        "PYTHONUNBUFFERED": "1",
        "PYTHONDONTWRITEBYTECODE": "1",
    }
    if live:
        # Only the provider launcher passes validated private settings. The
        # preview launcher never accepts these from the shell or a config file.
        for name in ("ADBAUTH_PROVIDER_URL", "ADBAUTH_USERNAME", "ADBAUTH_PROXY_URL"):
            env[name] = provider_settings.get(name, "")
        env["ADBAUTH_PREVIEW_ONLY"] = "0"
        env["ADBAUTH_ENABLE_ISSUE"] = "1"
        env['ADBAUTH_CUSTOMER_DB'] = str(private / 'customers.sqlite')
        ingress_file = private / 'public-studio.json'
        if ingress_file.exists():
            ingress = json.loads(ingress_file.read_text()).get('ingress_proxy', 'cloudflare')
            if ingress not in ('cloudflare', 'tailscale'):
                raise SystemExit('Unsupported private ingress configuration')
            env['ADBAUTH_INGRESS_PROXY'] = ingress
    url = f"http://127.0.0.1:{args.port}"
    auth = "Basic " + base64.b64encode(f"{login['username']}:{login['password']}".encode()).decode()
    opener = build_opener(ProxyHandler({}))
    request = Request(url + "/api/status", headers={"Authorization": auth})
    def stop(_signal, _frame):
        raise KeyboardInterrupt
    signal.signal(signal.SIGTERM, stop)
    process = subprocess.Popen([sys.executable, str(root / "adb_studio_server.py")], env=env, cwd=root)
    try:
        for _ in range(50):
            if process.poll() is not None:
                raise SystemExit("The local preview could not start. See the message above.")
            try:
                with opener.open(request, timeout=0.3) as response:
                    status = json.load(response)
                if status.get("previewOnly") is (not live) and status.get("generationEnabled") is live:
                    break
            except (OSError, URLError, ValueError):
                pass
            time.sleep(0.1)
        else:
            raise SystemExit("The local preview did not become ready.")
        # Recheck after the HTTP probe so an occupied port cannot report success.
        time.sleep(0.1)
        if process.poll() is not None:
            raise SystemExit("The local preview could not start; the port may be occupied.")
        print(f"\nLocal ADB Studio: {url}", flush=True)
        if live:
            print("Provider configuration loaded. Real issuance is enabled on this Mac only.", flush=True)
            print("No provider request is made until you submit a device. Provider access is not yet verified.", flush=True)
        else:
            print("Key generation is blocked. No provider account, VPN or tunnel is used.", flush=True)
        if args.quiet_login:
            print(f"Private local login: {login_file}", flush=True)
        else:
            print(f"Username: {login['username']}\nPassword: {login['password']}", flush=True)
        print("Keep this window open. Press Ctrl+C to stop the preview.", flush=True)
        if not args.no_browser:
            webbrowser.open(url + '/admin' if live and getattr(args, 'admin', False) else url)
        if process.wait() != 0:
            raise SystemExit("The local preview server stopped unexpectedly.")
    except KeyboardInterrupt:
        print("\nStopping local preview.", flush=True)
    finally:
        if process.poll() is None:
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()
        lock.close()


if __name__ == "__main__":
    main()
