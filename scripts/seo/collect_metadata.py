#!/usr/bin/env python3
"""Capture legacy metadata from explicit, reviewed URL mappings (no fuzzy matching)."""
import argparse
import concurrent.futures
import datetime
import json
import subprocess
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse


class Metadata(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.in_title = False
        self.title = ''
        self.description = ''
        self.canonical = ''
        self.noindex = False

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'title':
            self.in_title = True
        if tag == 'meta' and attrs.get('name', '').lower() == 'description':
            self.description = attrs.get('content', '')
        if tag == 'meta' and attrs.get('name', '').lower() == 'robots':
            self.noindex = 'noindex' in attrs.get('content', '').lower()
        if tag == 'link' and attrs.get('rel', '').lower() == 'canonical':
            self.canonical = attrs.get('href', '')

    def handle_endtag(self, tag):
        if tag == 'title':
            self.in_title = False

    def handle_data(self, text):
        if self.in_title:
            self.title += text


def collect(row):
    row = dict(row)
    try:
        url = row['source']
        if urlparse(url).scheme != 'https' or urlparse(url).hostname != 'www.ruralfencingsupplies.com.au':
            raise ValueError('Source must be on the legacy site')
        result = subprocess.run(['curl', '-fsS', '--max-time', '30', url], check=True, capture_output=True, text=True)
        parsed = Metadata()
        parsed.feed(result.stdout)
        if not parsed.title.strip() or not parsed.description.strip() or parsed.noindex:
            raise ValueError('Missing metadata or noindex response; review required')
        if parsed.canonical and urlparse(parsed.canonical).path.rstrip('/') != urlparse(url).path.rstrip('/'):
            raise ValueError('Canonical points to another page; review required')
        row.update(title=parsed.title.strip(), description=parsed.description.strip(), status='ready')
    except (ValueError, subprocess.SubprocessError) as error:
        row.update(status='review', reason=str(error))
    return row


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--map', required=True)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    rows = json.loads(Path(args.map).read_text())
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        result = list(executor.map(collect, rows))
    payload = {'captured_at': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'rows': result}
    Path(args.output).write_text(json.dumps(payload, indent=2, ensure_ascii=False) + '\n')
    print(f"Captured {sum(r['status'] == 'ready' for r in result)}/{len(result)} rows; review the output before import.")


if __name__ == '__main__':
    main()
