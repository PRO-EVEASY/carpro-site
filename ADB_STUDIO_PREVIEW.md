# CockpitPro ADB Studio — local macOS preview and Termux

## Local development on macOS

Run `./preview-local.command` from this checkout, or double-click it in Finder.
Python 3 is the only runtime dependency. The launcher finds Homebrew Python on
Apple Silicon and Intel Macs; no Python packages, VPN, proxy, vendor account,
Cloudflare installation or tunnel are needed.

The launcher opens `http://127.0.0.1:8765` after the server is ready. Sign in with
the local username and random password displayed in Terminal. Keep the Terminal
window open; press Ctrl+C to stop. The same local login is reused after a restart.
Use `./preview-local.command --port 8766` if another app uses the default port.
`--no-browser --quiet-login` runs without opening a browser or printing the password.

The login is stored only in `.local-preview/login.json` (mode 600 inside a mode
700 directory). Git ignores that directory and the server never serves it. To
rotate the login, stop the preview and remove that file before restarting.

**This launcher always blocks real key generation.** It creates a clean server
environment, does not load a private env file, forces `ADBAUTH_PREVIEW_ONLY=1`, and
forces `ADBAUTH_ENABLE_ISSUE=0`. In preview-only mode the backend also ignores any
inherited provider account or proxy settings. A direct `POST /api/generate` is
rejected with `503` / `preview_only` before any provider call. There is no mock key
or downloadable authorization file in this mode.

The interface labels this as a local preview. Hardware/date payloads, QR codes
and browser-only file hashing can be exercised without a provider connection.
The QR library is bundled locally with its licenses; no CDN is required.
Only the page, the QR bundle and the API are served, not the repository directory.

The server listens only on the Mac's loopback address. It stays available while
the process is running and the Mac is awake; this is not a 24/7 customer service.
The existing Termux/Cloudflare launcher below is a separate deployment path.

Run the local regression checks with:

```bash
python3 -m unittest discover -s tests -v
bash -n preview-local.command deploy-termux-cloudflared.sh
```

The tests use synthetic settings and reject every issuance attempt. They never
contact a provider or generate a key. Live issuance, Termux deployment and
production publishing require separate verification and approval.

## Optional local provider mode

The separate `./provider-local.command` enables real issuance on this Mac at
`http://127.0.0.1:8766`. It does not expose a public hostname or start a tunnel.
It requires the existing private provider configuration, by default at
`.local-provider/provider.env`, or an explicit `--config /absolute/private/path`.
The configuration must belong to the current user and have permissions 600.
Never place its contents in this document, chat, frontend or a tracked file.

The supported settings are `ADBAUTH_PROVIDER_URL` (HTTPS), `ADBAUTH_USERNAME`,
and optional `ADBAUTH_PROXY_URL`. A Termux `ADBAUTH_ENABLE_ISSUE` assignment is
accepted for compatibility; choosing the provider launcher explicitly enables
issuance regardless of that old flag. The preview launcher remains blocked.
Configuration is parsed as literal assignments, never sourced as shell code.

`./provider-local.command --check-config` validates the local file without a
network request or starting a server. Starting normally also makes no provider
request until a device is submitted. A configured status does not prove that
the provider login, connection or API contract works; those need a successful
authorized provider response. Cloudflare credentials are not provider credentials.

Provider mode gets its own local `operator` login in `.local-provider/login.json`.
That directory is private and ignored by Git. Provider account access and live
issuance have not yet been verified in this checkout.

If the endpoint and route are already prepared privately, use
`./provider-local.command --configure-account` to enter the supplier account ID
in Terminal without displaying it or putting it in command history. This saves
the private configuration with mode 600 and starts local provider mode. It does
not submit a device or issue a key automatically. Local config validation and
network reachability do not verify account access or authorization-key validity.

## Optional USB bridge through the phone VPN

If the VPN app already exposes a loopback SOCKS5 listener, use it directly:
`python3 phone_bridge.py --model PHONE_MODEL --remote-port PHONE_SOCKS_PORT`.
Inspect the app's actual listener before choosing its port. The helper stores
the selected phone and ports privately; subsequent launches reuse that phone,
even if another device is also connected. It fails if the selected phone is
missing, rather than silently using another device. No Termux process is needed
when using the VPN app's own SOCKS5 listener.

When the Android phone is connected and USB debugging is authorized, a Termux
SOCKS5 listener can be forwarded to the Mac over USB. In a new Termux session:

```bash
python -m pproxy -l socks5://127.0.0.1:1086
```

Keep Transocks connected and ensure Termux is included in its VPN routing.
The command uses the phone's network directly; it does not specify another
upstream proxy. It requires the `pproxy` package in Termux. The listener binds
only to loopback and is not exposed to the Wi-Fi network.

On the Mac, run `python3 phone_bridge.py`. It forwards only that local port using
ADB and checks the SOCKS5 handshake. A successful handshake verifies the bridge,
not the VPN exit country or provider availability; those require a separate
HTTPS endpoint test. The printed loopback proxy URL belongs only in private
server configuration. No provider requests or keys are generated by the helper.

`python3 phone_bridge.py --stop` removes only the forwarding recorded as owned
by this helper. It does not stop Transocks or Termux or remove unrelated forwards.
This arrangement requires the phone, its VPN and the USB connection to remain
active. The Termux process must also remain active when using the Termux variant.
It does not provide an independent 24/7 server.

## Existing Termux capabilities

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
ADBAUTH_PROXY_URL='YOUR_PRIVATE_PROXY_URL'
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

## Termux smoke checks (issuance disabled)

1. Keep `ADBAUTH_ENABLE_ISSUE='0'` and run the launcher.
2. Open the Cloudflare address, authenticate, and verify the UI displays "not configured" instead of creating a fake key.
3. Inspect local files via the SHA-256 inspector.
4. Leave issuance disabled throughout this check. A real issuance test is separate and may consume a vendor credit.
5. Do not commit real keys, proxy addresses or customer identifiers to GitHub.

## Preview branch

This branch is deliberately isolated from `main`; do not merge without reviewing and testing.


## Customer access and publishing

Local provider mode enables a separate owner-only `/admin` screen using the
existing operator Basic login. Customers never receive the operator password.
The owner creates each customer, sets a key allowance, and privately delivers
the one-time authenticator setup QR. Customer login uses their customer ID and
a six-digit TOTP code that changes every 30 seconds. Accepted codes cannot be
replayed. A new login revokes the prior session; sessions expire after eight
hours. Resetting an authenticator or disabling a customer revokes access.

Customer data, TOTP seeds, session hashes and issuance records stay in the
ignored `.local-provider/customers.sqlite` file with permissions 600. Back it up
privately; never publish it. This is the sole customer database for this server.

Customer allowances are reserved atomically. Repeating a completed request for
the same customer, serial and date returns the stored result without a new
provider call. Ambiguous upstream failures keep their reservation for owner
review. After checking that no key was issued, the owner can release it from
the review section. Explicit provider refusals and failed local connections
release the reservation automatically. Customer responses show only their own
remaining allowance. The existing preview launcher continues to block issuance.

The public homepage can link through `adb-studio.html` to the protected app.
A Quick Tunnel is temporary: the Mac, phone VPN, USB bridge, app server and
tunnel process must remain running. Its public app address may be included in
the entry link; provider addresses, proxy settings and credentials must not.
A stable production connection still requires the domain owner's Cloudflare
account and a named tunnel.


## Authorization download bundle

After a successful provider response, the customer can download one ZIP containing
exactly `adbauth.key` and `svtasklist.flag` at the archive root, or download each
file separately. The key text is preserved exactly. The flag contains the
operator-supplied PnScreen task with null PartNumber/IPCScreenType/IVIScreenType
parameters and action `eu_debugmode`. Packaging happens in the browser without
an additional provider request. ZIP interoperability and CRCs are checked using
Python's independent ZIP reader. Vehicle-side activation is a separate check.
