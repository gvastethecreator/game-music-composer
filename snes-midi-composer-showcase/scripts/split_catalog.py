#!/usr/bin/env python3
"""Split the full benchmark into a light catalog index and lazy cue scripts."""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path


SHOWCASE = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = SHOWCASE.parent / "snes-midi-composer-skill" / "data" / "neospc100-benchmark-v4.1.json"
INDEX_PATH = SHOWCASE / "data" / "catalog.js"
CUE_DIR = SHOWCASE / "data" / "cues"
SUMMARY_FIELDS = (
    "id",
    "title",
    "category",
    "category_label",
    "subcategory",
    "kicker",
    "description",
    "bpm",
    "beats",
    "bars",
    "meter",
    "barLength",
    "key",
    "mode",
    "voice_budget",
    "measured_peak_voices",
    "tags",
    "metrics",
    "composition_quality",
)


def compact(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    args = parser.parse_args()
    catalog = json.loads(args.source.read_text(encoding="utf-8"))
    styles = catalog.get("styles", [])
    if len(styles) != 100:
        raise SystemExit(f"Expected 100 styles, found {len(styles)}")
    CUE_DIR.mkdir(parents=True, exist_ok=True)
    summaries = []
    expected: set[str] = set()
    for style in styles:
        cue_id = str(style["id"])
        if not re.fullmatch(r"[a-z0-9_]+", cue_id):
            raise SystemExit(f"Unsafe cue id: {cue_id}")
        summaries.append({field: style[field] for field in SUMMARY_FIELDS if field in style})
        path = CUE_DIR / f"{cue_id}.js"
        payload = f"window.NEOSPC_CUES=window.NEOSPC_CUES||{{}};window.NEOSPC_CUES[{json.dumps(cue_id)}]={compact(style)};\n"
        path.write_text(payload, encoding="utf-8")
        expected.add(path.name)
    for stale in CUE_DIR.glob("*.js"):
        if stale.name not in expected:
            stale.unlink()
    index = {key: value for key, value in catalog.items() if key != "styles"}
    index["styles"] = summaries
    INDEX_PATH.write_text(f"window.NEOSPC_CATALOG={compact(index)};\n", encoding="utf-8")
    print(f"split {len(styles)} cues")
    print(f"index {INDEX_PATH.stat().st_size} bytes")
    print(f"cue scripts {sum(path.stat().st_size for path in CUE_DIR.glob('*.js'))} bytes")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
