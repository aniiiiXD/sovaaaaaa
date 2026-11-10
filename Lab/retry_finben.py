"""Retry incomplete FinBen snapshots using the locally authenticated official CLI.

Keeps the original pinned revisions and verifies each file before updating the
acquisition manifest. Does not request access or execute downloaded code.
"""
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import subprocess

from fetch_domain_datasets import write_json

BASE = Path(__file__).resolve().parent / 'solva-fin-sys1'


def retry(dataset):
    target = BASE / 'datasets/raw' / dataset['name']
    repo = dataset['source'].split('/datasets/', 1)[1]
    result = subprocess.run(
        ['hf', 'download', repo, '--repo-type', 'dataset', '--revision',
         dataset['revision'], '--local-dir', str(target), '--quiet',
         '--max-workers', '4'], capture_output=True, text=True, timeout=600,
    )
    problems = []
    for entry in dataset['files']:
        path = target / entry['path']
        if not path.is_file():
            problems.append(entry['path'])
            continue
        actual = hashlib.sha256(path.read_bytes()).hexdigest()
        if ((entry.get('expected_bytes') is not None and
             path.stat().st_size != entry['expected_bytes']) or
                (entry.get('expected_sha256') and
                 actual != entry['expected_sha256'])):
            problems.append(entry['path'])
            continue
        path.with_name(path.name + '.sha256').write_text(actual + '\n')
        entry.update(status='downloaded', bytes=path.stat().st_size, sha256=actual)
        entry.pop('error', None)
    dataset['downloaded_files'] = sum(f['status'] == 'downloaded' for f in dataset['files'])
    dataset['downloaded_bytes'] = sum(f.get('bytes', 0) for f in dataset['files'] if f['status'] == 'downloaded')
    dataset['complete'] = not problems
    status = {'name': dataset['name'], 'checked_at': datetime.now(timezone.utc).isoformat(),
              'complete': dataset['complete'], 'cli_exit_code': result.returncode,
              'unverified_files': problems}
    if result.returncode:
        # Store only known denial categories, never credential/debug tracebacks.
        error = result.stderr
        status['reason'] = ('Account not approved for dataset' if ('not in the authorized list' in error or 'repository requires approval' in error)
                            else 'Token lacks gated-repository permission' if 'fine-grained token' in error
                            else 'Access request pending' if 'awaiting a review' in error
                            else 'Download failed; inspect with hf download')
    return status


def main():
    manifest_path = BASE / 'reports/download_manifest.json'
    manifest = json.loads(manifest_path.read_text())
    pending = [d for d in manifest if d['name'].startswith('finben/') and not d['complete']]
    checks = []
    with ThreadPoolExecutor(max_workers=3) as pool:
        jobs = {pool.submit(retry, d): d['name'] for d in pending}
        for job in as_completed(jobs):
            try:
                status = job.result()
            except Exception as exc:
                status = {'name': jobs[job], 'complete': False, 'reason': type(exc).__name__}
            checks.append(status)
            print(status['name'], 'COMPLETE' if status['complete'] else status.get('reason', 'Incomplete'), flush=True)
    write_json(manifest_path, manifest)
    write_json(BASE / 'reports/finben_retry.json', checks)
    remaining = [d for d in manifest if d['name'].startswith('finben/') and not d['complete']]
    lines = ['# FinBen access requirements', '',
             'Authenticated CLI checks and verified downloads are recorded in `finben_retry.json` and `download_manifest.json`.', '',
             f'{len(remaining)} components remain incomplete. Request access on their pages; manual approvals need a publisher response.', '',
             '| Dataset | Access gate |', '|---|---|']
    lines += [f"| [{d['name']}]({d['source']}) | {d.get('gated', False)} |" for d in remaining]
    (BASE / 'reports/ACCESS_REQUIRED.md').write_text('\n'.join(lines) + '\n')


if __name__ == '__main__':
    main()
