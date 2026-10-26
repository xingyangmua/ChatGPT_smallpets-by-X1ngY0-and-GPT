"""Build a release from this repository and a complete Electron x64 ZIP."""
from pathlib import Path
import argparse, hashlib, json, zipfile

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--electron-archive', required=True, type=Path)
    parser.add_argument('--output', default='dist', type=Path)
    parser.add_argument('--version', default='1.1.0-beta.1')
    args = parser.parse_args()
    repo = Path(__file__).resolve().parents[1]
    source = repo / 'app'
    runtime = args.electron_archive.resolve()
    if not runtime.is_file():
        raise SystemExit('Complete Electron runtime archive missing')
    with zipfile.ZipFile(runtime) as archive:
        required = {'electron.exe', 'LICENSE', 'LICENSES.chromium.html'}
        if not required.issubset(archive.namelist()) or archive.testzip():
            raise SystemExit('Invalid Electron Windows runtime archive')
    args.output.mkdir(parents=True, exist_ok=True)
    name = f'codex_work_pet-windows-x64-v{args.version}.zip'
    bundle = args.output / name
    excluded = {'data', 'backups', 'evidence', 'node_modules', '.git', '__pycache__'}
    files = sorted(p for p in source.rglob('*') if p.is_file()
                   and not excluded.intersection(p.relative_to(source).parts)
                   and p.suffix.lower() not in {'.log', '.lnk', '.exe', '.zip'})
    for file in files:
        if file.is_symlink() or file.name in {'auth.json', 'runtime.json', '.env'}:
            raise SystemExit('Private or linked input refused: ' + str(file.relative_to(source)))
    with zipfile.ZipFile(bundle, 'w', zipfile.ZIP_DEFLATED, compresslevel=1) as archive:
        for file in files:
            archive.write(file, file.relative_to(source).as_posix())
        archive.write(runtime, 'electron-runtime.zip', compress_type=zipfile.ZIP_STORED)
    with zipfile.ZipFile(bundle) as archive:
        if archive.testzip():
            raise SystemExit('Archive CRC failure')
    digest = hashlib.file_digest(bundle.open('rb'), 'sha256').hexdigest()
    manifest = {'project': 'codex_work_pet', 'version': args.version, 'tag': 'v'+args.version,
                'platform': 'windows-x64', 'assetName': name, 'sha256': digest}
    for folder in (repo, args.output):
        (folder / 'release.json').write_text(json.dumps(manifest, indent=2)+'\n', encoding='utf-8')
    (args.output / 'SHA256SUMS.txt').write_text(digest+'  '+name+'\n', encoding='utf-8')
    print(json.dumps({'ok': True, 'file': str(bundle), 'sha256': digest}))

if __name__ == '__main__':
    main()
