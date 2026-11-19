"""Build a reproducible macOS source bundle from the adapter's explicit file list."""
import argparse
import hashlib
import json
from pathlib import Path
from zipfile import ZIP_STORED, ZipFile, ZipInfo


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path, help="Destination ZIP file")
    args = parser.parse_args()
    repo = Path(__file__).resolve().parents[1]
    manifest = repo / "adapters/macos/files.json"
    files = json.loads(manifest.read_text(encoding="utf-8"))
    files += ["Install-macOS.command", "tools/build_macos.py"]
    files.extend(str(p.relative_to(repo)) for p in (manifest.parent / "tests").glob("*.test.mjs"))
    if len(files) != len(set(files)):
        raise ValueError("Duplicate package entry")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(args.output, "w") as archive:
        for name in sorted(files):
            source = repo / name
            if not source.is_file() or source.resolve() != source or repo not in source.parents:
                raise ValueError(f"Invalid package input {name}")
            info = ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
            info.create_system = 3
            executable = name in {"Install-macOS.command", "adapters/macos/manage.sh"}
            info.external_attr = (0o100755 if executable else 0o100644) << 16
            # The portrait is already a PNG. Stored entries also keep the exact
            # archive digest reproducible across macOS and CI zlib versions.
            archive.writestr(info, source.read_bytes(), compress_type=ZIP_STORED)
    with ZipFile(args.output) as archive:
        if archive.testzip() is not None or set(archive.namelist()) != set(files):
            raise ValueError("Archive verification failed")
    print(hashlib.sha256(args.output.read_bytes()).hexdigest(), args.output.name)


if __name__ == "__main__":
    main()
