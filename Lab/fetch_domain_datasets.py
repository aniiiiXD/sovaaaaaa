"""Fetch original dataset artifacts only; never execute upstream code or alter splits.

Standard-library downloader. Run again to resume verified downloads.
Raw files stay outside Git; manifests include revisions, byte counts and SHA-256.
"""
from __future__ import annotations

import concurrent.futures as futures
import hashlib
import json
import os
from pathlib import Path
import re
import threading
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parent
LEGAL = ROOT / 'Sova-legal-sys1'
FINANCE = ROOT / 'solva-fin-sys1'
COLLECTION = 'TheFinAI/finben-and-pixiu-english-financial-evaluation-658f515911f68f12ea193194'
LOCK = threading.Lock()
NEXT_HF_REQUEST = time.monotonic() + float(os.environ.get('SOVA_HF_START_DELAY', '0'))
CONTENT_LOCKS = {}
CONTENT_FILES = {}
TOKEN = os.environ.get('HF_TOKEN') or os.environ.get('HUGGING_FACE_HUB_TOKEN')
if not TOKEN:
    token_path = Path(os.environ.get('HF_HOME', str(Path.home() / '.cache/huggingface'))) / 'token'
    if token_path.is_file():
        TOKEN = token_path.read_text().strip()


class SafeRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        new = super().redirect_request(req, fp, code, msg, headers, newurl)
        if new and urllib.parse.urlparse(req.full_url).netloc != urllib.parse.urlparse(newurl).netloc:
            new.remove_header('Authorization')
        return new


OPENER = urllib.request.build_opener(SafeRedirect())


def request(url):
    global NEXT_HF_REQUEST
    headers = {'User-Agent': 'SOVA-dataset-acquisition/1.0'}
    if urllib.parse.urlparse(url).netloc == 'huggingface.co' and '/resolve/' in url:
        with LOCK:
            now = time.monotonic()
            delay = max(0.0, NEXT_HF_REQUEST - now)
            NEXT_HF_REQUEST = max(now, NEXT_HF_REQUEST) + 0.14
        if delay:
            time.sleep(delay)
    if TOKEN and urllib.parse.urlparse(url).netloc == 'huggingface.co':
        headers['Authorization'] = 'Bearer ' + TOKEN
    return urllib.request.Request(url, headers=headers)


def get_json(url):
    for attempt in range(4):
        try:
            with OPENER.open(request(url), timeout=60) as response:
                return json.load(response)
        except urllib.error.HTTPError as exc:
            if exc.code in (401, 403, 404) or attempt == 3:
                raise
        except Exception:
            if attempt == 3:
                raise
        time.sleep(1 + attempt)


def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + '.tmp')
    tmp.write_text(json.dumps(data, indent=2) + '\n')
    tmp.replace(path)


def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as source:
        for block in iter(lambda: source.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def github(base, name, repo, include):
    tree = get_json(f'https://api.github.com/repos/{repo}/git/trees/HEAD?recursive=1')
    if tree.get('truncated'):
        raise ValueError(f'Truncated repository tree: {repo}')
    files = []
    for entry in tree['tree']:
        p = entry['path']
        if entry['type'] == 'blob' and include(p):
            files.append({'path': p, 'expected_bytes': entry.get('size'),
                          'url': f'https://raw.githubusercontent.com/{repo}/{tree["sha"]}/{urllib.parse.quote(p)}'})
    return {'base': str(base), 'name': name, 'source': f'https://github.com/{repo}',
            'revision': tree['sha'], 'files': files}


def hf(base, name, repo):
    info = get_json(f'https://huggingface.co/api/datasets/{repo}?blobs=true')
    files = []
    for entry in info['siblings']:
        p = entry['rfilename']
        files.append({'path': p, 'expected_bytes': entry.get('size'),
                      'expected_sha256': (entry.get('lfs') or {}).get('sha256'),
                      'url': f'https://huggingface.co/datasets/{repo}/resolve/{info["sha"]}/{urllib.parse.quote(p)}?download=true'})
    return {'base': str(base), 'name': name, 'source': f'https://huggingface.co/datasets/{repo}',
            'revision': info['sha'], 'gated': info.get('gated'),
            'license_metadata': (info.get('cardData') or {}).get('license'), 'files': files}


def download(entry, destination):
    sha = entry.get('expected_sha256')
    if not sha:
        return download_file(entry, destination)
    with LOCK:
        content_lock = CONTENT_LOCKS.setdefault(sha, threading.Lock())
    with content_lock:
        existing = CONTENT_FILES.get(sha)
        if existing and existing != destination and not destination.exists():
            destination.parent.mkdir(parents=True, exist_ok=True)
            # Independent copies preserve the original publisher directory layout.
            import shutil
            shutil.copyfile(existing, destination)
            destination.with_name(destination.name + '.sha256').write_text(sha + '\n')
        result = download_file(entry, destination)
        if result['status'] == 'downloaded':
            CONTENT_FILES[sha] = destination
        return result


def download_file(entry, destination):
    result = dict(entry)
    destination.parent.mkdir(parents=True, exist_ok=True)
    expected = entry.get('expected_bytes')
    sha = entry.get('expected_sha256')
    marker = destination.with_name(destination.name + '.sha256')
    if destination.is_file() and marker.is_file() and (expected is None or destination.stat().st_size == expected):
        actual = digest(destination)
        if actual == marker.read_text().strip() and (not sha or sha == actual):
            return dict(result, status='downloaded', bytes=destination.stat().st_size, sha256=actual)
    part = destination.with_name(destination.name + '.part')
    for attempt in range(4):
        try:
            with OPENER.open(request(entry['url']), timeout=90) as response, part.open('wb') as target:
                for block in iter(lambda: response.read(1024 * 1024), b''):
                    target.write(block)
            if expected is not None and part.stat().st_size != expected:
                raise ValueError(f'Byte count mismatch: expected {expected}, received {part.stat().st_size}')
            actual = digest(part)
            if sha and actual != sha:
                raise ValueError('SHA-256 mismatch')
            with part.open('rb') as check:
                if check.read(100).startswith(b'version https://git-lfs.github.com/spec/v1'):
                    raise ValueError('Git LFS pointer received instead of dataset')
            part.replace(destination)
            marker.write_text(actual + '\n')
            return dict(result, status='downloaded', bytes=destination.stat().st_size, sha256=actual)
        except urllib.error.HTTPError as exc:
            error = f'HTTP {exc.code}'
            if exc.code in (401, 403, 404):
                break
            if exc.code == 429:
                # Respect the publisher's rate-limit window across all workers.
                global NEXT_HF_REQUEST
                delay = int(exc.headers.get('Retry-After', '300')) + 2
                with LOCK:
                    NEXT_HF_REQUEST = max(NEXT_HF_REQUEST, time.monotonic() + delay)
                print(f'RATE LIMIT: pausing Hugging Face resolver requests for {delay}s', flush=True)
        except Exception as exc:
            error = str(exc)
        time.sleep(min(2 ** attempt, 8))
    return dict(result, status='blocked' if error in ('HTTP 401', 'HTTP 403') else 'failed', error=error)


def main():
    for base in (LEGAL, FINANCE):
        (base / 'datasets/raw').mkdir(parents=True, exist_ok=True)
        (base / 'datasets/.gitignore').write_text('raw/\n')
        (base / 'reports').mkdir(exist_ok=True)
    docs = lambda p: Path(p).name.lower().startswith(('readme', 'license', 'copying'))
    plans = [
        lambda: github(LEGAL, 'cuad', 'The-Atticus-Project/cuad', lambda p: p == 'data.zip' or p.endswith('.csv') or docs(p)),
        lambda: hf(LEGAL, 'cuad/full-release', 'theatticusproject/cuad'),
        lambda: github(LEGAL, 'maud', 'The-Atticus-Project/maud', lambda p: p == 'data.zip' or docs(p)),
        lambda: hf(LEGAL, 'maud/full-release', 'theatticusproject/maud'),
        lambda: github(LEGAL, 'acord', 'The-Atticus-Project/acord', lambda p: p.endswith('.zip') or docs(p)),
        lambda: github(LEGAL, 'contractnli', 'stanfordnlp/contract-nli', lambda p: p.endswith('.zip') or docs(p) or p == 'index.md'),
        lambda: github(LEGAL, 'legalbench-rag/source', 'ZeroEntropy-AI/legalbenchrag', docs),
        lambda: github(FINANCE, 'finqa', 'czyssrs/FinQA', lambda p: p.startswith('dataset/') or docs(p)),
        lambda: github(FINANCE, 'convfinqa', 'czyssrs/ConvFinQA', lambda p: p == 'data.zip' or docs(p)),
        lambda: github(FINANCE, 'financebench', 'patronus-ai/financebench', lambda p: p.startswith(('data/', 'pdfs/')) or docs(p)),
        lambda: hf(FINANCE, 't2-ragbench', 'G4KMU/t2-ragbench'),
        lambda: github(FINANCE, 'finben/source', 'The-FinAI/FinBen', lambda p: True),
    ]
    collection = get_json(f'https://huggingface.co/api/collections/{COLLECTION}')
    write_json(FINANCE / 'reports/finben_collection.json', collection)
    for item in collection['items']:
        if item['type'] == 'dataset':
            repo = item['id']
            plans.append(lambda repo=repo: hf(FINANCE, 'finben/' + repo.split('/')[-1], repo))
    datasets = []
    with futures.ThreadPoolExecutor(max_workers=6) as pool:
        for future in futures.as_completed([pool.submit(plan) for plan in plans]):
            try:
                d = future.result()
                datasets.append(d)
                print(f'INDEXED {d["name"]}: {len(d["files"])} files, {sum(f.get("expected_bytes") or 0 for f in d["files"]):,} bytes, gated={d.get("gated",False)}', flush=True)
            except Exception as exc:
                print(f'METADATA ERROR: {exc}', flush=True)
    datasets.append({'base':str(LEGAL),'name':'legalbench-rag','source':'https://github.com/ZeroEntropy-AI/legalbenchrag','revision':'publisher download as retrieved', 'files':[{'path':'legalbench-rag.zip','url':'https://www.dropbox.com/scl/fo/r7xfa5i3hdsbxex1w6amw/AID389Olvtm-ZLTKAPrw6k4?rlkey=5n8zrbk4c08lbit3iiexofmwg&dl=1'}]})
    # Persist discovery before downloading, including access restrictions.
    for base in (LEGAL, FINANCE):
        write_json(base / 'reports/download_plan.json', [d for d in datasets if d['base'] == str(base)])
    results = {id(d): [] for d in datasets}
    jobs = []
    for d in datasets:
        files = d['files']
        if d.get('gated') and not TOKEN:
            # Metadata is public. Do not bypass gated content using viewer caches.
            for entry in files:
                if Path(entry['path']).name.lower() not in ('readme.md', 'license', 'license.txt'):
                    results[id(d)].append(dict(entry,status='blocked',error='Hugging Face account/token and dataset access required'))
                else:
                    jobs.append((d,entry))
        else:
            jobs.extend((d,entry) for entry in files)
    print(f'DOWNLOADING {len(jobs)} files; local HF login present: {bool(TOKEN)}',flush=True)
    # Complete small collections and archive releases before the large PDF snapshot.
    jobs.sort(key=lambda job: (job[0]['name'] == 't2-ragbench', job[0]['name']))
    with futures.ThreadPoolExecutor(max_workers=16) as pool:
        pending = {pool.submit(download,e,Path(d['base'])/'datasets/raw'/d['name']/e['path']):d for d,e in jobs}
        for n,future in enumerate(futures.as_completed(pending),1):
            d = pending[future]
            r = future.result()
            results[id(d)].append(r)
            if r['status'] != 'downloaded':
                print(f'{r["status"].upper()} {d["name"]}/{r["path"]}: {r.get("error")}',flush=True)
            if n % 100 == 0 or n == len(jobs):
                print(f'PROGRESS {n}/{len(jobs)} files',flush=True)
                save_results(datasets,results)
    save_results(datasets,results)


def save_results(datasets,results):
    for base in (LEGAL,FINANCE):
        output=[]
        for d in datasets:
            if d['base'] != str(base):continue
            record={k:v for k,v in d.items() if k not in ('files','base')}
            record['files']=sorted(results[id(d)],key=lambda x:x['path'])
            record['downloaded_bytes']=sum(f.get('bytes',0) for f in record['files'])
            record['expected_files']=len(d['files'])
            record['downloaded_files']=sum(f['status']=='downloaded' for f in record['files'])
            record['complete']=record['downloaded_files']==record['expected_files']
            output.append(record)
        write_json(base/'reports/download_manifest.json',output)


if __name__ == '__main__':
    main()
