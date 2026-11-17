#!/usr/bin/env python3
"""Render reviewed videos. --check verifies output; --release also requires all ten originals."""
import argparse
import hashlib
import html
import json
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
EXPECTED = {
    '831652.mp4', '769680.mp4', '715663.mp4', 'VID-20261007-WA0003.mp4',
    'VID-20261008-WA0017.mp4', 'VID-20261011-WA0107.mp4', 'VID-20261012-WA0033.mp4',
    'VID-20261107-WA0035.mp4', 'VID-20261108-WA0006.mp4', 'VID-20261108-WA0043.mp4',
}
esc = html.escape


def validate(items, intake):
    assert len(intake['files']) == intake['expectedCount'] == 10
    assert {f['filename'] for f in intake['files']} == EXPECTED
    assert len({item['id'] for item in items}) == len(items), 'Duplicate gallery ID'
    assert len({item['original'] for item in items}) == len(items), 'Duplicate original'
    for item in items:
        assert re.fullmatch(r'[a-zA-Z0-9_-]+', item['id']), 'Invalid ID'
        assert item['reviewed'] and item['title'] and item['summary'], 'Review content before titling'
        assert item['category'] in {'screens', 'campaign'}
        assert item['duration'] > 0
        for key in ('src', 'poster'):
            path = (ROOT / item[key]).resolve()
            assert path.is_relative_to(ROOT / 'assets/media'), 'Use a local media asset'
            assert path.is_file() and path.stat().st_size > 0, f'Missing asset: {item[key]}'
            assert path.stat().st_size < 50 * 1024**2, 'Use reviewed external media hosting above 50 MiB'
        media = ROOT / item['src']
        assert media.stat().st_size == item['bytes']
        assert hashlib.sha256(media.read_bytes()).hexdigest() == item['sha256'], 'Changed media requires review'
        assert 'originalSha256' in item
    requested = {item['original']: item for item in items if item['scope'] == 'requested'}
    assert set(requested) <= EXPECTED
    for entry in intake['files']:
        if entry['status'] == 'reviewed':
            assert entry['filename'] in requested, 'Reviewed original has no gallery item'
            assert requested[entry['filename']]['id'] == entry['galleryId']
        else:
            assert entry['status'] == 'missing' and entry['galleryId'] is None
            assert entry['filename'] not in requested
    assert sum((ROOT / item['src']).stat().st_size for item in items) < 400 * 1024**2, 'Media exceeds the repository budget'
    return EXPECTED - set(requested)


def render(item):
    ident = item['id']
    seconds = round(item['duration'])
    duration = f'{seconds // 60}:{seconds % 60:02}'
    title, description, summary = (esc(item[k]) for k in ('title', 'description', 'summary'))
    src, poster = (esc(item[k], quote=True) for k in ('src', 'poster'))
    return f'''      <article class="video-card" data-category="{item['category']}" data-original="{esc(item['original'])}" aria-labelledby="title-{ident}">
        <div class="video-stage">
          <button class="video-launch" type="button" aria-label="ניגון: {title}" aria-controls="video-{ident}">
            <img src="{poster}" alt="" width="{item['width']}" height="{item['height']}" loading="lazy" decoding="async">
            <span class="video-label">{esc(item['label'])}</span>
            <span class="play-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 3.5v17L20 12Z"/></svg></span>
            <span class="video-duration" aria-label="משך הסרטון {seconds} שניות">{duration}</span>
          </button>
          <video id="video-{ident}" class="gallery-video" controls playsinline preload="none" poster="{poster}" data-src="{src}" aria-label="{title}" aria-describedby="summary-{ident}" tabindex="0" hidden></video>
        </div>
        <p class="video-error" role="status" hidden>הסרטון לא נטען. <a href="{src}">נסו לפתוח אותו ישירות</a>.</p>
        <div class="video-meta"><h3 id="title-{ident}">{title}</h3><p>{description}</p>
          <details><summary>על הסרטון ופתיחה ישירה</summary><p id="summary-{ident}">{summary}</p><p><a href="{src}">פתיחת הסרטון המלא</a> · <bdi>{esc(item['original'])}</bdi></p></details>
          <noscript><p><a href="{src}">לצפייה בסרטון: {title}</a></p></noscript>
        </div>
      </article>'''


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--release', action='store_true')
    args = parser.parse_args()
    items = json.loads((ROOT / 'media/gallery.json').read_text())
    intake = json.loads((ROOT / 'media/intake.json').read_text())
    missing = validate(items, intake)
    page = ROOT / 'index.html'
    old = page.read_text()
    cards = '<!-- GALLERY START -->\n' + '\n'.join(render(item) for item in items) + '\n    <!-- GALLERY END -->'
    new = re.sub(r'<!-- GALLERY START -->.*?<!-- GALLERY END -->|<!-- GALLERY -->', lambda m: cards, old, flags=re.S)
    new = re.sub(r'(?<=aria-live="polite">).*?(?=</span>)', f'{len(items)} סרטונים לצפייה', new, flags=re.S)
    if args.check or args.release:
        assert new == old, 'Run python3 scripts/build_gallery.py to update the HTML'
    else:
        page.write_text(new)
    print(f'Gallery valid: {len(items)} actual videos; {10 - len(missing)}/10 requested originals available.')
    if missing:
        print('Missing originals:\n' + '\n'.join(sorted(missing)))
    if args.release and missing:
        print('RELEASE BLOCKED: all ten original files must be obtained, reviewed and added.', file=sys.stderr)
        return 2
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except (AssertionError, KeyError, ValueError) as exc:
        sys.exit(f'Gallery validation failed: {exc}')
