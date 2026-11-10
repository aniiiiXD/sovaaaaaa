"""Check downloaded artifacts, safely unpack release ZIPs, and summarize acquisition."""
import json
from pathlib import Path
import stat
import zipfile

ROOT = Path(__file__).resolve().parent


def main():
    for domain in ('Sova-legal-sys1', 'solva-fin-sys1'):
        base = ROOT / domain
        manifest = json.loads((base / 'reports/download_manifest.json').read_text())
        archives = []
        for dataset in manifest:
            for entry in dataset['files']:
                if entry['status'] != 'downloaded' or not entry['path'].endswith('.zip'):
                    continue
                path = base / 'datasets/raw' / dataset['name'] / entry['path']
                target = path.parent / (path.stem + '_extracted')
                with zipfile.ZipFile(path) as archive:
                    # Dropbox folder ZIPs include a harmless root-directory marker.
                    members = [m for m in archive.infolist() if not (m.is_dir() and m.filename == '/')]
                    for member in members:
                        resolved = (target / member.filename).resolve()
                        if not resolved.is_relative_to(target.resolve()):
                            raise ValueError(f'Unsafe archive path: {member.filename}')
                        if stat.S_ISLNK(member.external_attr >> 16):
                            raise ValueError(f'Archive symlink: {member.filename}')
                    bad = archive.testzip()
                    if bad:
                        raise ValueError(f'Archive CRC failure: {bad}')
                    archive.extractall(target, members=members)
                    archives.append({'path': str(path.relative_to(base)), 'files': len(archive.infolist()),
                                     'unpacked_bytes': sum(x.file_size for x in archive.infolist()), 'crc_ok': True})
        report = ['# Dataset acquisition report', '',
                  'Original releases and splits are preserved under `datasets/raw/`. No training, inference, normalization, or resplitting was run.', '',
                  'File URLs, pinned repository revisions, byte counts, SHA-256 checksums and access failures are recorded in `download_manifest.json`.', '',
                  '| Source | Downloaded files | Total files | Downloaded MB | Status |',
                  '|---|---:|---:|---:|---|']
        for d in manifest:
            report.append(f'| [{d["name"]}]({d["source"]}) | {d["downloaded_files"]} | {d["expected_files"]} | {d["downloaded_bytes"]/1e6:.2f} | {"Complete" if d["complete"] else "Incomplete — see manifest"} |')
        report += ['', '## Original archives', '', 'ZIP CRC checks passed; contents are unpacked alongside each original ZIP in an `_extracted` directory.', '',
                   '## Usage and evaluation notes', '',
                   '- Downloaded does not mean cleared for commercial training or redistribution. Preserve source notices and audit component licenses before product use.',
                   '- Raw downloads are ignored by Git. No nested Git repositories were created.',
                   '- LegalBench-RAG shares source material with CUAD, MAUD and ContractNLI.',
                   '- FinQA, ConvFinQA and T²-RAGBench share source material. FinBen includes further reused datasets.',
                   '- Perform document-level overlap checks across datasets before assigning training/evaluation roles. Do not train on official test sets.',
                   '- FinanceBench download covers the public release only; the full 10,231-question benchmark is not public.', '']
        (base / 'reports/download_report.md').write_text('\n'.join(report))
        (base / 'reports/archive_checks.json').write_text(json.dumps(archives, indent=2)+'\n')
        print(domain, 'downloaded_bytes', sum(d['downloaded_bytes'] for d in manifest),
              'complete_sources', sum(d['complete'] for d in manifest), '/', len(manifest), 'archives', len(archives))


if __name__ == '__main__':
    main()
