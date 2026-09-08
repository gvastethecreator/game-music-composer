#!/usr/bin/env python3
"""Build and relocate-smoke the portable Neo-SPC skill ZIP."""
from __future__ import annotations

import argparse
import hashlib
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT / "dist" / "game-music-composer.zip"
MANIFEST = ROOT / "MANIFEST.sha256"
ARCHIVE_ROOT = "game-music-composer"
SKIP_DIRS = {"__pycache__", ".git", ".pytest_cache", ".scratch", "dist", "work"}
SKIP_SUFFIXES = {".pyc", ".pyo"}
TEXT_SUFFIXES = {".json", ".md", ".py", ".sha256", ".txt", ".yaml", ".yml"}
FORBIDDEN_PATH = b"/mnt" + b"/data"


def source_files() -> list[Path]:
    return [
        path
        for path in sorted(ROOT.rglob("*"), key=lambda item: item.as_posix())
        if path.is_file()
        and not any(part in SKIP_DIRS for part in path.relative_to(ROOT).parts)
        and path.suffix.lower() not in SKIP_SUFFIXES
    ]


def package_hygiene_issues() -> list[str]:
    issues: list[str] = []
    for required in (ROOT / "SKILL.md", ROOT / "LICENSE", ROOT / "agents" / "openai.yaml"):
        if not required.is_file():
            issues.append(f"missing required distributable file: {required.relative_to(ROOT).as_posix()}")
    for path in source_files():
        if path.suffix.lower() not in TEXT_SUFFIXES:
            continue
        if FORBIDDEN_PATH in path.read_bytes():
            issues.append(f"non-portable Linux mount path in {path.relative_to(ROOT).as_posix()}")
    return issues


def assert_package_hygiene() -> None:
    issues = package_hygiene_issues()
    if issues:
        raise ValueError("Package hygiene failed:\n- " + "\n- ".join(issues))


def build_manifest() -> tuple[int, str]:
    assert_package_hygiene()
    files = [path for path in source_files() if path != MANIFEST]
    lines = [f"{hashlib.sha256(path.read_bytes()).hexdigest()}  ./{path.relative_to(ROOT).as_posix()}" for path in files]
    content = "\n".join(lines) + "\n"
    if not (MANIFEST.is_file() and MANIFEST.read_text(encoding="utf-8") == content):
        staging = MANIFEST.with_name(f".{MANIFEST.name}.tmp")
        staging.write_text(content, encoding="utf-8", newline="\n")
        staging.replace(MANIFEST)
    return len(files), hashlib.sha256(content.encode("utf-8")).hexdigest()


def build(output: Path) -> tuple[int, str]:
    assert_package_hygiene()
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


def run_relocation_smoke(archive_path: Path) -> None:
    with tempfile.TemporaryDirectory(prefix="neospc-relocation-") as temp:
        destination = Path(temp)
        with zipfile.ZipFile(archive_path) as archive:
            names = archive.namelist()
            if not names or any(not name.startswith(f"{ARCHIVE_ROOT}/") or ".." in Path(name).parts for name in names):
                raise ValueError("Archive contains an unsafe or malformed member path.")
            if any("__pycache__" in name or name.endswith((".pyc", ".pyo")) for name in names):
                raise ValueError("Archive contains generated Python bytecode.")
            archive.extractall(destination)
        relocated = destination / ARCHIVE_ROOT
        commands = (
            [sys.executable, "scripts/neospc.py", "doctor", "--strict"],
            [sys.executable, "-m", "unittest", "discover", "-s", "scripts/tests", "-v"],
        )
        for command in commands:
            result = subprocess.run(command, cwd=relocated, check=False)
            if result.returncode:
                raise RuntimeError(f"Relocation smoke failed ({result.returncode}): {' '.join(command)}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--smoke", action="store_true", help="Extract the ZIP into a temporary directory and run doctor plus the unit suite there.")
    args = parser.parse_args()
    output = args.output.resolve()
    manifest_count, manifest_digest = build_manifest()
    count, digest = build(output)
    print(f"manifest {manifest_count} files · sha256 {manifest_digest}")
    print(f"packed {count} files -> {output}")
    print(f"sha256 {digest}")
    if args.smoke:
        run_relocation_smoke(output)
        print("relocation smoke: PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
