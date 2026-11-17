#!/usr/bin/env python3
"""Start local ADB Studio using an existing private provider configuration."""
import argparse
import getpass
import os
from pathlib import Path
import re
import shlex
import tempfile
from urllib.parse import urlsplit

from preview_local import run_server

FIELDS = {"ADBAUTH_PROVIDER_URL", "ADBAUTH_USERNAME", "ADBAUTH_PROXY_URL"}


def load_settings(path, require_account=True):
    """Parse simple Termux env assignments as data; never execute shell code."""
    path = Path(path)
    try:
        metadata = path.stat()
        if metadata.st_uid != os.getuid() or metadata.st_mode & 0o077:
            raise ValueError("The private config must belong to you and have permissions 600.")
        contents = path.read_text(encoding="utf-8")
    except OSError:
        raise ValueError("Private provider config is missing or unreadable. Copy the existing private file to .local-provider/provider.env, or use --config with its local path.") from None
    settings = {}
    for number, line in enumerate(contents.splitlines(), 1):
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        match = re.fullmatch(r"(?:export\s+)?([A-Z_]+)\s*=\s*(.*)", line)
        if not match or match[1] not in FIELDS | {"ADBAUTH_ENABLE_ISSUE"}:
            raise ValueError(f"Unsupported configuration assignment on line {number}.")
        name, raw = match.groups()
        if name in settings or any(token in raw for token in ("$(", "`", "${")):
            raise ValueError(f"Use one literal value per setting (line {number}).")
        try:
            tokens = shlex.split(raw, comments=True, posix=True)
        except ValueError:
            raise ValueError(f"Invalid quoting on line {number}.") from None
        if len(tokens) > 1:
            raise ValueError(f"Quote the configuration value on line {number}.")
        value = tokens[0] if tokens else ""
        if any(ord(character) < 32 or ord(character) == 127 for character in value):
            raise ValueError(f"Control characters are not allowed (line {number}).")
        settings[name] = value.strip()

    if not settings.get("ADBAUTH_PROVIDER_URL") or (require_account and not settings.get("ADBAUTH_USERNAME")):
        raise ValueError("ADBAUTH_PROVIDER_URL and ADBAUTH_USERNAME are required in the private file.")
    try:
        provider = urlsplit(settings["ADBAUTH_PROVIDER_URL"])
        if (provider.scheme != "https" or not provider.hostname or provider.username
                or provider.password or provider.fragment or provider.port == 0):
            raise ValueError
    except ValueError:
        raise ValueError("The provider endpoint must be an HTTPS URL without embedded login or a fragment.") from None
    if settings.get("ADBAUTH_PROXY_URL"):
        try:
            proxy = urlsplit(settings["ADBAUTH_PROXY_URL"])
            if (proxy.scheme not in ("http", "https", "socks5", "socks5h")
                    or not proxy.hostname or proxy.fragment or proxy.port == 0):
                raise ValueError
        except ValueError:
            raise ValueError("The private proxy URL is invalid.") from None
    return {name: settings.get(name, "") for name in FIELDS}


def configure_account(path):
    settings = load_settings(path, require_account=False)
    account = getpass.getpass("Provider account ID (hidden; Enter keeps the current value): ").strip()
    account = account or settings["ADBAUTH_USERNAME"]
    if not account or any(ord(character) < 32 or ord(character) == 127 for character in account):
        raise ValueError("A valid provider account ID is required.")
    settings["ADBAUTH_USERNAME"] = account
    fd, temporary = tempfile.mkstemp(prefix=".provider-", dir=Path(path).parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as stream:
            for name in sorted(FIELDS):
                stream.write(f"{name}={shlex.quote(settings[name])}\n")
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)
    print("Account saved in the private local configuration. Nothing was sent to the provider.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", type=Path, default=Path(__file__).resolve().parent / ".local-provider/provider.env")
    parser.add_argument("--port", type=int, default=8766)
    parser.add_argument("--check-config", action="store_true", help="Validate locally without starting a server or contacting the provider")
    parser.add_argument("--configure-account", action="store_true", help="Enter the provider account privately in Terminal, then start local provider mode")
    parser.add_argument("--no-browser", action="store_true")
    parser.add_argument("--quiet-login", action="store_true")
    parser.add_argument('--admin', action='store_true', help='Open the customer management screen')
    args = parser.parse_args()
    if not 1 <= args.port <= 65535:
        parser.error("--port must be between 1 and 65535")
    try:
        if args.configure_account:
            configure_account(args.config)
        settings = load_settings(args.config)
    except ValueError as error:
        raise SystemExit(str(error)) from None
    if args.check_config:
        print("Private configuration is valid. Provider was not contacted.")
        print("Proxy configured:", bool(settings["ADBAUTH_PROXY_URL"]))
        return
    run_server(args, provider_settings=settings)


if __name__ == "__main__":
    main()
