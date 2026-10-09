#!/usr/bin/env python3
"""Capture the legacy site's Information Pages, excluding catalogue and external links."""
import concurrent.futures
import datetime
import hashlib
import json
import subprocess
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlparse

BASE = 'https://www.ruralfencingsupplies.com.au/'
SEED = BASE + 'Information-Automatic-Gates'

class Capture(HTMLParser):
    def __init__(self, target):
        super().__init__(convert_charrefs=True)
        self.target, self.depth = target, 0
        self.text, self.links, self.images = [], [], []
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'div' and attrs.get('id') == self.target:
            self.depth = 1
            return
        if not self.depth:
            return
        if tag == 'div': self.depth += 1
        if tag in ('p', 'h1', 'h2', 'h3', 'li', 'tr', 'br'): self.text.append('\n')
        if tag == 'a' and attrs.get('href'): self.links.append(urljoin(BASE, attrs['href']))
        if tag == 'img' and attrs.get('src'):
            self.images.append({'url': urljoin(BASE, attrs['src']), 'alt': attrs.get('alt', '')})
    def handle_endtag(self, tag):
        if self.depth and tag == 'div': self.depth -= 1
        if self.depth and tag in ('p', 'h1', 'h2', 'h3', 'li', 'tr'): self.text.append('\n')
    def handle_data(self, data):
        if self.depth: self.text.append(data)

def fetch(url):
    return subprocess.run(['curl', '-fsSL', '--max-time', '30', '--retry', '1', url], check=True, capture_output=True).stdout.decode('utf-8', errors='replace')

def capture(url):
    html = fetch(url)
    parser = Capture('ezPageDefault')
    parser.feed(html)
    text = '\n'.join(line.strip() for line in ''.join(parser.text).splitlines() if line.strip())
    if not text: raise ValueError('No information-page content: ' + url)
    return {'source': url, 'sha256': hashlib.sha256(html.encode()).hexdigest(), 'text': text,
            'links': list(dict.fromkeys(parser.links)), 'images': parser.images}

def main():
    nav = Capture('ezpagesContent')
    nav.feed(fetch(SEED))
    urls = list(dict.fromkeys(url for url in nav.links if urlparse(url).hostname == urlparse(BASE).hostname and urlparse(url).path != '/index.php'))
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        pages = list(pool.map(capture, urls))
    output = Path(__file__).with_name('legacy-information-snapshot.json')
    output.write_text(json.dumps({'captured_at': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'seed': SEED, 'pages': pages}, indent=2, ensure_ascii=False) + '\n')
    print(f'Captured {len(pages)} information pages in {output}')

if __name__ == '__main__': main()
