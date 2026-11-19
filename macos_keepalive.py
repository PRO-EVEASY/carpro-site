#!/usr/bin/env python3
"""Recover the Mac VPN, web service and saved public ingress without issuing keys."""
import fcntl
import json
import os
from pathlib import Path
import socket
import sqlite3
import subprocess
import time
from urllib.parse import urlsplit
from urllib.request import build_opener, ProxyHandler

PRIVATE = Path(__file__).resolve().parent / '.local-provider'


def run(arguments):
    result = subprocess.run(arguments, capture_output=True, text=True, timeout=12)
    if result.returncode:
        raise RuntimeError('Service command failed')
    return result.stdout


def ensure_vpn(service_id, runner=run):
    def connected():
        lines = runner(['/usr/sbin/scutil', '--nc', 'status', service_id]).splitlines()
        return bool(lines and lines[0].strip() == 'Connected')
    if not connected():
        runner(['/usr/sbin/scutil', '--nc', 'start', service_id])
        return connected()
    return True


def should_restart_backend(failures, last_restart, recent_pending, now):
    return failures >= 2 and now - last_restart >= 60 and not recent_pending


def check_config(config):
    proxy, origin = urlsplit(config['proxy_url']), urlsplit(config['origin'])
    if proxy.scheme != 'http' or proxy.hostname != '127.0.0.1' or not proxy.port:
        raise RuntimeError('Native VPN proxy must remain on loopback')
    if origin.scheme != 'https' or not origin.hostname or not origin.hostname.endswith('.ts.net'):
        raise RuntimeError('Unexpected public ingress')


def save_status(status):
    path = PRIVATE / 'keepalive-status.json'
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps(status, indent=2) + '\n')
    temporary.chmod(0o600)
    os.replace(temporary, path)


def main():
    os.umask(0o077)
    with (PRIVATE / 'keepalive.lock').open('a') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return
        config = json.loads((PRIVATE / 'mac-runtime.json').read_text())
        check_config(config)
        path = PRIVATE / 'keepalive-status.json'
        previous = json.loads(path.read_text()) if path.exists() else {}
        now = int(time.time())
        status = {'checked_at': now, 'last_backend_restart': previous.get('last_backend_restart', 0)}
        errors = []
        try:
            status['vpn_connected'] = ensure_vpn(config['vpn_service_id'])
            proxy = urlsplit(config['proxy_url'])
            with socket.create_connection((proxy.hostname, proxy.port), timeout=2):
                status['native_proxy_listening'] = True
        except (OSError, ValueError, RuntimeError, subprocess.TimeoutExpired):
            errors.append('native_vpn_unavailable')
        try:
            with build_opener(ProxyHandler({})).open('http://127.0.0.1:8766/login', timeout=3) as response:
                status['backend_ready'] = response.status == 200
        except OSError:
            status['backend_ready'] = False
        status['backend_failures'] = 0 if status['backend_ready'] else previous.get('backend_failures', 0) + 1
        if not status['backend_ready']:
            try:
                with sqlite3.connect('file:' + str(PRIVATE / 'customers.sqlite') + '?mode=ro', uri=True) as db:
                    pending = db.execute("SELECT COUNT(*) FROM issues WHERE state='pending' AND created>?", (now - 90,)).fetchone()[0]
                if should_restart_backend(status['backend_failures'], status['last_backend_restart'], pending, now):
                    run(['launchctl', 'kickstart', '-k', f'gui/{os.getuid()}/com.cockpitpro.adbauth.server'])
                    status['last_backend_restart'] = now
            except (OSError, RuntimeError, sqlite3.Error, subprocess.TimeoutExpired):
                errors.append('backend_recovery_deferred')
        if config.get('funnel_enabled'):
            try:
                # Funnel's --bg configuration is persisted by Tailscale itself.
                # On macOS, control the saved VPN profile from launchd rather
                # than invoking the GUI app's CLI bridge from a background job.
                status['ingress_network_connected'] = ensure_vpn(config['tailscale_service_id'])
                with build_opener(ProxyHandler({'https': config['proxy_url']})).open(
                        config['origin'] + '/login', timeout=12) as response:
                    status['public_https_ready'] = response.status == 200 and b'ADBAUTHKEY' in response.read(65536)
                    if not status['public_https_ready']:
                        errors.append('public_ingress_needs_attention')
            except (OSError, ValueError, RuntimeError, subprocess.TimeoutExpired):
                errors.append('public_ingress_needs_attention')
        status['errors'] = errors
        save_status(status)


if __name__ == '__main__':
    main()
