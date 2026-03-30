import os
import re
from urllib.parse import urljoin, urlparse
from urllib.request import urlopen, Request

BASE = 'https://www.oldiesforfuture.org/'
OUT = r'tmp/scrape-test/oldiesforfuture-mirror'
os.makedirs(OUT, exist_ok=True)

ALLOWED_EXT = {'.css','.js','.png','.jpg','.jpeg','.webp','.svg','.gif','.ico','.json','.woff','.woff2','.ttf','.eot','.otf','.map'}


def fetch(url: str) -> bytes:
    req = Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urlopen(req, timeout=30) as r:
        return r.read()


def to_local_path(url: str) -> str | None:
    p = urlparse(url)
    if p.netloc and p.netloc != urlparse(BASE).netloc:
        return None
    path = p.path.lstrip('/')
    if not path:
        return None
    ext = os.path.splitext(path)[1].lower()
    if ext not in ALLOWED_EXT and not path.endswith('index.html'):
        return None
    return path


index_url = urljoin(BASE, 'index.html')
index_bytes = fetch(index_url)
index_path = os.path.join(OUT, 'index.html')
with open(index_path, 'wb') as f:
    f.write(index_bytes)

html = index_bytes.decode('utf-8', errors='ignore')

candidates = set()
for m in re.findall(r'(?:src|href)=[\"\']([^\"\']+)[\"\']', html, flags=re.IGNORECASE):
    if m.startswith(('#', 'mailto:', 'tel:', 'javascript:')):
        continue
    candidates.add(urljoin(BASE, m))

for m in re.findall(r'srcset=[\"\']([^\"\']+)[\"\']', html, flags=re.IGNORECASE):
    for part in m.split(','):
        u = part.strip().split()[0] if part.strip() else ''
        if u:
            candidates.add(urljoin(BASE, u))

downloaded = 0
failed = 0
css_files = []
for u in sorted(candidates):
    local = to_local_path(u)
    if not local:
        continue
    target = os.path.join(OUT, local.replace('/', os.sep))
    os.makedirs(os.path.dirname(target), exist_ok=True)
    try:
        data = fetch(u)
        with open(target, 'wb') as f:
            f.write(data)
        downloaded += 1
        if target.lower().endswith('.css'):
            css_files.append(target)
    except Exception:
        failed += 1

# Download url(...) references from CSS
for css_path in css_files:
    try:
        with open(css_path, 'r', encoding='utf-8', errors='ignore') as f:
            css = f.read()
        css_rel = os.path.relpath(css_path, OUT).replace('\\', '/')
        css_base = urljoin(BASE, css_rel)
        for raw in re.findall(r'url\(([^)]+)\)', css):
            raw = raw.strip().strip('"').strip("'")
            if not raw or raw.startswith(('data:', '#')):
                continue
            u = urljoin(css_base, raw)
            local = to_local_path(u)
            if not local:
                continue
            target = os.path.join(OUT, local.replace('/', os.sep))
            if os.path.exists(target):
                continue
            os.makedirs(os.path.dirname(target), exist_ok=True)
            try:
                data = fetch(u)
                with open(target, 'wb') as f:
                    f.write(data)
                downloaded += 1
            except Exception:
                failed += 1
    except Exception:
        failed += 1

file_total = 0
for _, _, files in os.walk(OUT):
    file_total += len(files)

print(f'OUT_DIR={OUT}')
print(f'FILES_TOTAL={file_total}')
print(f'ASSETS_DOWNLOADED={downloaded}')
print(f'DOWNLOAD_FAILED={failed}')
