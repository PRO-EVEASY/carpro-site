# Local QR bundle

`qrcode.min.js` is a browser IIFE exposing `QRCode`, built from `qrcode@1.5.4`
(https://github.com/soldair/node-qrcode) and `dijkstrajs@1.0.3` using
`esbuild@0.25.12`. Both runtime libraries use the MIT license; their license files
are included alongside the bundle. No network requests are made by the bundle.

Build in a separate scratch directory, then copy only the bundle and licenses:

```bash
npm install --ignore-scripts --no-audit --no-fund --save-exact qrcode@1.5.4 dijkstrajs@1.0.3 esbuild@0.25.12
./node_modules/.bin/esbuild node_modules/qrcode/lib/browser.js --bundle --minify --platform=browser --format=iife --global-name=QRCode --target=es2017 --outfile=qrcode.min.js
```

The original CDN URL returned HTTP 404. Serving this small bundle locally also
makes the development preview independent of CDN availability. The Python server
explicitly allows only the JavaScript asset, and the Termux downloader fetches it
and the licenses alongside the HTML and server.
