# CockpitPro ADB Studio — preview

This branch adds `adb-studio.html` and changes the ADB button on the home page to point to it.

## Scope
- Responsive, dark themed authorized-service workspace
- Local machine-code string and QR display (not an authorization key)
- Local SHA-256 metadata inspection for uploaded files
- Placeholder interface for authorization requests and USB tooling
- No vendor authorization generation or valid key download until a licensed server-side integration is verified

## Private backend (not deployed)
GitHub Pages serves static HTML, so proxy endpoints, supplier credentials, and issuance logic **cannot be securely placed in this repository**. The upstream proxy is never to be added to frontend JavaScript, GitHub commits, or client-visible configuration.

Use an owned server reachable through TLS, with:
- Authenticated API and server-side access control
- A separate vendor adapter that uses documented licensed endpoints
- Secrets and proxy credentials stored outside source control
- Rate limiting and audit logs without raw key contents
- No production dependencies on arbitrary public proxies
- Key downloads only after verification that a genuine signed artifact was returned

## Manual QA
1. Verify `adb-studio.html` renders on desktop and mobile.
2. Enter a numeric hardware serial and date; confirm payload updates.
3. Inspect a local `.key` file; confirm only file name, size, SHA-256 are displayed.
4. Confirm request generation displays a clear not-connected message, not a fake success.
5. Confirm `index.html` links to `adb-studio.html` on the preview branch.

No changes to the production branch until reviewed.
