#!/usr/bin/env python3
"""Validate Neo-SPC catalog patch assignments against the Factory Bank manifest."""
from __future__ import annotations
import argparse, json
from pathlib import Path


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("catalog", type=Path)
    ap.add_argument("manifest", type=Path)
    ap.add_argument("--output", type=Path)
    args = ap.parse_args()
    catalog = json.loads(args.catalog.read_text(encoding="utf-8"))
    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    patches = {p["id"]: p for p in manifest["patches"]}
    findings = []
    mapped = total = 0
    for cue in catalog.get("styles", []):
        events_by_inst = {}
        for event in cue.get("events", []):
            events_by_inst.setdefault(event.get("inst"), []).append(event)
        for inst, info in cue.get("instrument_map", {}).items():
            total += 1
            patch_id = info.get("factory_patch")
            if not patch_id:
                findings.append({"cue": cue["id"], "instrument": inst, "severity": "info", "issue": "compatibility_fallback"})
                continue
            mapped += 1
            patch = patches.get(patch_id)
            if not patch:
                findings.append({"cue": cue["id"], "instrument": inst, "severity": "error", "issue": "unknown_patch", "patch": patch_id})
                continue
            rng = patch.get("range")
            if rng:
                notes = [int(e["midi"]) for e in events_by_inst.get(inst, []) if e.get("kind") != "drum" and "midi" in e]
                extension = 7
                outside = [n for n in notes if n < rng[0] - extension or n > rng[1] + extension]
                if outside:
                    findings.append({"cue": cue["id"], "instrument": inst, "severity": "warning", "issue": "notes_outside_patch_range", "count": len(outside), "min": min(outside), "max": max(outside), "patch_range": rng, "allowed_extension_semitones": extension})
    report = {
        "catalog": str(args.catalog),
        "bank": manifest.get("name"),
        "bank_version": manifest.get("version"),
        "assignments": total,
        "factory_mapped": mapped,
        "coverage": round(mapped / total, 4) if total else 0,
        "errors": sum(1 for f in findings if f["severity"] == "error"),
        "warnings": sum(1 for f in findings if f["severity"] == "warning"),
        "findings": findings,
    }
    text = json.dumps(report, indent=2)
    if args.output:
        args.output.write_text(text + "\n", encoding="utf-8")
    else:
        print(text)
    return 1 if report["errors"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
