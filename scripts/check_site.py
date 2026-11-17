#!/usr/bin/env python3
"""Check the public homepage, assets and preserved entry points without starting the ADB backend."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, unquote
import subprocess

ROOT = Path(__file__).resolve().parents[1]


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = set()
        self.refs = []
        self.videos = []
        self.hrefs = set()

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if 'id' in attrs:
            assert attrs['id'] not in self.ids, f'Duplicate ID: {attrs["id"]}'
            self.ids.add(attrs['id'])
        for key in ('src', 'href', 'poster', 'data-src'):
            if attrs.get(key):
                self.refs.append(attrs[key])
        if 'href' in attrs:
            self.hrefs.add(attrs['href'])
        if tag == 'video':
            self.videos.append(attrs)
        if tag == 'img':
            assert 'alt' in attrs and 'width' in attrs and 'height' in attrs


page = Page()
page.feed((ROOT / 'index.html').read_text())
for ref in page.refs:
    parsed = urlsplit(ref)
    if parsed.scheme or parsed.netloc:
        assert parsed.scheme in ('https', 'tel'), f'Unexpected URL: {ref}'
        continue
    if parsed.path:
        path = (ROOT / unquote(parsed.path)).resolve()
        assert path.is_relative_to(ROOT) and path.is_file(), f'Broken asset/link: {ref}'
    if parsed.fragment and not parsed.path:
        assert parsed.fragment in page.ids, f'Broken anchor: {ref}'
assert './adb-studio.html' in page.hrefs
assert 'https://wa.me/972533022636' in page.hrefs
assert 'tel:0533022636' in page.hrefs
assert 'https://t.me/pertz2641' in page.hrefs
for video in page.videos:
    assert 'controls' in video and 'playsinline' in video and video.get('preload') == 'none'
    assert 'src' not in video and 'data-src' in video
    assert 'autoplay' not in video and 'loop' not in video
    assert video.get('aria-label') and video.get('aria-describedby') in page.ids
assert 'combo-cockpit.mp4' not in (ROOT / 'index.html').read_text()
subprocess.run(['node', '--check', str(ROOT / 'assets/gallery.js')], check=True)
print(f'Homepage check passed: {len(page.videos)} players; all local links/assets resolve; entry points present.')
