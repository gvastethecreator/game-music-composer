#!/usr/bin/env python3
"""Publish the installed generation harness and libraries into Composer Studio."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SKILL_DATA = ROOT / "game-music-composer" / "data"
STUDIO_DATA = ROOT / "game-music-composer-showcase" / "data"


def _load(name: str) -> object:
    return json.loads((SKILL_DATA / name).read_text(encoding="utf-8"))


def _assign(path: Path, name: str, value: object) -> None:
    payload = json.dumps(value, ensure_ascii=True, separators=(",", ":"))
    path.write_text(f"window.{name}={payload};\n", encoding="utf-8", newline="\n")


def publish() -> None:
    harness = _load("generation-harness-v3.json")
    libraries = {
        "scales": _load("scale-library.json"),
        "progressions": _load("chord-progression-library.json"),
        "patterns": _load("pattern-preset-library.json"),
        "mix_bus": _load("mix-bus-profiles.json"),
        "harness_version": harness.get("version"),
    }
    _assign(STUDIO_DATA / "harness.js", "NEOSPC_HARNESS", harness)
    _assign(STUDIO_DATA / "libraries.js", "NEOSPC_LIBRARIES", libraries)

    catalog_path = STUDIO_DATA / "catalog.js"
    catalog_source = catalog_path.read_text(encoding="utf-8")
    catalog = json.loads(catalog_source.split("=", 1)[1].rstrip().rstrip(";"))
    profiles = list(harness["sections"]["brief"]["voice_budget"]["values"])
    voice_model = catalog.setdefault("voice_model", {})
    voice_model["profiles"] = profiles
    voice_model["recommended"] = harness["sections"]["brief"]["voice_budget"]["default"]
    _assign(catalog_path, "NEOSPC_CATALOG", catalog)
    print(
        "Published harness"
        f" {harness.get('version')},"
        f" {len(libraries['scales']['scales'])} scales,"
        f" voice profiles {profiles}."
    )


if __name__ == "__main__":
    publish()
