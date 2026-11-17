# CockpitPro ADB Studio — Termux + Cloudflare Tunnel

## What is ready

- Responsive RTL UI: serial, date in YYYYMMDD format, internal technician label, QR, local file SHA-256 inspector, authorization code and gated `adbauth.key` download
- Authenticated Python backend on `127.0.0.1:8765`
- Cloudflare Quick Tunnel exposing only the authenticated backend
- Supplier adapter reproducing the request shape seen in the supplied website code: `POST` form fields `uuid` and `username`; response `1` means user not found, `2` means zero uses, success JSON contains `data` and `num`
- Private proxy support via a locally configured `ADBAUTH_PROXY_URL`, never included in frontend source
- One request per 20 seconds (no automatic retry); explicit confirmation before issuing

## Private configuration on the Termux device

Create `$HOME/.cockpitpro-adb.env` locally; **never commit this file** or paste its contents in a chat. Keep it readable only by the Termux user (`chmod 600`).

Example showing *placeholders only*:

```bash
ADBAUTH_PROVIDER_URL='https://YOUR-LICENSED-PROVIDER/authorization-endpoint'
ADBAUTH_USERNAME='YOUR_AUTHORIZED_ACCOUNT_ID'
ADBAUTH_PROXY_URL='socks5h://127.0.0.1:1082'
ADBAUTH_ENABLE_ISSUE='0'
```

Set `ADBAUTH_ENABLE_ISSUE='1'` only after confirming that the provider endpoint, account, and trusted egress are authorized for this workflow. Real issuance may consume your account's usage quota. Public free proxies are not appropriate for production authorization traffic. The backend can also connect directly (omit the proxy field), or use a privately operated, secured egress.

Run `bash $HOME/start-adb-studio.sh` after the installer has been downloaded. On each restart the launcher creates new Basic Authentication credentials and a new Quick Tunnel URL.

## Security assumptions

- The Quick Tunnel address is **publicly reachable** and protected only by origin HTTP Basic authentication. Treat as a private test deployment; use Cloudflare Access or equivalent for production.
- The address of your own portal/API is visible in browser tools; the configured supplier address and proxy are not delivered to the browser.
- Frontend files on GitHub remain publicly readable. Never add credentials to client code or this repository.
- Only use supplier APIs for which you have documented authorization. The adapter is based on page code, not a separately verified API contract.
- The server only verifies that the supplier returned a nonempty text code; it does not cryptographically verify a manufacturer signature or key validity.
- Nothing auto-generates `svtasklist.flag` or modifies vehicle security settings.
- Quick Tunnels have no uptime guarantee, and closing Termux disconnects the site.
- Never send a password shown by the launcher to another person; restart to rotate it if exposed.

## How to test without consuming a credit

1. Keep `ADBAUTH_ENABLE_ISSUE='0'` and run the launcher.
2. Open the Cloudflare address, authenticate, and verify the UI displays "not configured" instead of creating a fake key.
3. Inspect local files via the SHA-256 inspector.
4. Only after authorized server config is tested, enable issuance and make **one** deliberate request; check that the returned `num` is correct and that the saved file content matches the returned `data` text.
5. Do not commit real keys or customer identifiers to GitHub.

## Preview branch

This branch is deliberately isolated from `main`; do not merge without reviewing and testing.
