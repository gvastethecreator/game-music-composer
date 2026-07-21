#!/usr/bin/env python3
"""Build a reproducible Neo-SPC skill ZIP for the static showcase."""
from __future__ import annotations

import argparse
import hashlib
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT.parent / "snes-midi-composer-showcase" / "downloads" / "neospc-music-composer.zip"
MANIFEST = ROOT / "MANIFEST.sha256"
ARCHIVE_ROOT = "neospc-music-composer"
SKIP_DIRS = {"__pycache__", ".git", ".scratch"}
SKIP_SUFFIXES = {".pyc", ".pyo"}


def source_files() -> list[Path]:
    return [
        path
        for path in sorted(ROOT.rglob("*"), key=lambda item: item.as_posix())
        if path.is_file()
        and not any(part in SKIP_DIRS for part in path.relative_to(ROOT).parts)
        and path.suffix.lower() not in SKIP_SUFFIXES
    ]


def build_manifest() -> tuple[int, str]:
    files = [path for path in source_files() if path != MANIFEST]
    lines = [f"{hashlib.sha256(path.read_bytes()).hexdigest()}  ./{path.relative_to(ROOT).as_posix()}" for path in files]
    content = "\n".join(lines) + "\n"
    staging = MANIFEST.with_name(f".{MANIFEST.name}.tmp")
    staging.write_text(content, encoding="utf-8", newline="\n")
    staging.replace(MANIFEST)
    return len(files), hashlib.sha256(content.encode("utf-8")).hexdigest()


def build(output: Path) -> tuple[int, str]:
    files = source_files()
    output.parent.mkdir(parents=True, exist_ok=True)
    staging = output.with_name(f".{output.name}.tmp")
    with zipfile.ZipFile(staging, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for path in files:
            relative = path.relative_to(ROOT).as_posix()
            info = zipfile.ZipInfo(f"{ARCHIVE_ROOT}/{relative}", date_time=(1980, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, path.read_bytes(), compresslevel=9)
    staging.replace(output)
    digest = hashlib.sha256(output.read_bytes()).hexdigest()
    return len(files), digest


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    manifest_count, manifest_digest = build_manifest()
    count, digest = build(args.output.resolve())
    print(f"manifest {manifest_count} files · sha256 {manifest_digest}")
    print(f"packed {count} files -> {args.output.resolve()}")
    print(f"sha256 {digest}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
