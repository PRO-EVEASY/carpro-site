# CockpitPro video intake and release status

The gallery redesign is a **draft**. One of the ten requested originals is available. Do not merge this work into `main` until all ten have been obtained, reviewed, encoded and verified. The existing repository videos are not substitutes for the missing originals.

`intake.json` is the complete ten-file checklist. `gallery.json` describes only media that actually exists and has been visually reviewed. `scripts/build_gallery.py --release` exits with status 2 while any requested original is missing. There are no invented titles or video placeholders for unavailable files.

## Source review (17 November 2026)

| Original | Availability | Observed content |
| --- | --- | --- |
| 831652.mp4 | Available, reviewed and encoded | 3.20-second portrait CockpitPro advertisement. White vehicle, Hebrew application-installation message, 500 ₪ and a compatibility qualifier. No running application or verified vehicle model is demonstrated. |
| 769680.mp4 | Missing | Not viewed; no title assigned. |
| 715663.mp4 | Missing | Not viewed; no title assigned. |
| VID-20261007-WA0003.mp4 | Missing | Not viewed; no title assigned. |
| VID-20261008-WA0017.mp4 | Missing | Not viewed; no title assigned. |
| VID-20261011-WA0107.mp4 | Missing | Not viewed; no title assigned. |
| VID-20261012-WA0033.mp4 | Missing | Not viewed; no title assigned. |
| VID-20261107-WA0035.mp4 | Missing | Not viewed; no title assigned. |
| VID-20261108-WA0006.mp4 | Missing | Not viewed; no title assigned. |
| VID-20261108-WA0043.mp4 | Missing | Not viewed; no title assigned. |

The conversation reader provided recent text and an unrelated APK attachment, but no video attachments. The available `831652.mp4` was found locally. The other nine names were absent from the available upload cache, Downloads, Desktop and Movies search, and from the macOS filename index. A broad Documents traversal did not complete; this is not proof the files do not exist elsewhere. Original and optimized SHA-256 values are recorded in `gallery.json`; no private local paths or credentials are published.

Existing media was also inspected: `eveasy.mp4` shows an application menu and a map with two round instruments, between advertising sequences; `amazing.mp4` is a short animated vehicle/light sequence. They are explicitly labeled as archive/animation. The archive's embedded older phone number is explained in its text description; current site contact links remain unchanged. `eveasynew.mp4` remains in the repository and is not counted as a requested upload.

Visual summaries were written from contact-sheet inspection. Audio is preserved, but has not been transcribed; these summaries are not closed captions. Speech-bearing incoming videos still need accurate captions after review.

## Media handling

- `831652.mp4`: full duration, H.264, yuv420p, 30 fps and AAC, 244,163 bytes instead of 3,523,214 bytes. Original left untouched. MP4 `moov` precedes `mdat` for progressive playback.
- Existing videos are remuxed without re-encoding into fast-start MP4s. Nothing is cropped or shortened. Poster images come from the corresponding real video.
- All players have native controls, `playsinline`, descriptive labels and text summaries. Sources are attached only on click; posters use lazy loading. Playing a video pauses the others, changing filters pauses hidden players, and leaving the page pauses playback. No autoplay or looping.
- The three available preview items are **one requested original plus two existing site videos**, not three of ten uploads. Full, direct video links work without JavaScript.
- No externally hosted media or secrets are required for the currently available files. Missing files have unknown sizes, so capacity for the full collection is not yet established.

GitHub blocks Git files larger than 100 MiB; the release checks use a stricter 50 MiB per-asset budget and 400 MiB total video budget. Published GitHub Pages sites must stay below 1 GB and have a soft 100 GB/month bandwidth limit. If incoming video cannot fit comfortably after full-duration encoding, use an authorized public media CDN with durable HTTPS URLs and byte-range support, keeping credentials outside the repository. Git LFS pointers are not a replacement for a working public media URL.

Sources: [GitHub file limits](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github), [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits).

## Completing the collection

1. Obtain the nine missing originals and retain their exact names and hashes.
2. Inspect the full content before assigning a title/category; record only what is visible. Review speech and prepare captions where needed.
3. Encode the full duration with H.264/AAC, yuv420p and `-movflags +faststart`; keep the longest edge at most 1280 without upscaling. Extract a relevant poster. Keep originals outside this public repository.
4. Add reviewed records to `gallery.json` and update their matching `intake.json` entries. For external media, extend URL validation only for the selected public host and test content type, range requests, seeking and playback.
5. Rebuild, check and compare against current `main` before publication:

```sh
python3 scripts/build_gallery.py
python3 scripts/build_gallery.py --check
python3 scripts/check_site.py
python3 scripts/build_gallery.py --release
git diff --check
```

Verify phone/desktop layout, all ten players, seeking, fullscreen, keyboard focus, filters, captions and reduced motion. Preserve the ADB homepage section, `./adb-studio.html`, WhatsApp, Telegram and current prices. This change does not start or modify the ADB backend, accounts or provider configuration.
