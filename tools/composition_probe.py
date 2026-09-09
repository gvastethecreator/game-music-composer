#!/usr/bin/env python3
"""Probe one harness control at a time, without changing the source project.

No audio is rendered and no artistic quality is scored. Run against a complete
checkout; each trial invokes its canonical CLI in a fresh temporary directory.
"""
from __future__ import annotations

import argparse
import copy
import hashlib
import json
import math
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any

SCORE_KEYS = ("kind", "inst", "role", "beat", "duration", "midi", "gain", "pan", "send")
PERFORMANCE_KEYS = (
    "performance_beat", "performance_duration", "performance_gain", "performance_pan",
    "velocity", "velocity_gain", "start_offset_ms", "tuning_cents", "attack", "release",
    "performance_vibrato_depth", "vibrato", "vibrato_delay_ms", "sample_offset_ms",
    "brightness_cutoff", "accent",
)


def canonical(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False)


def digest(value: Any) -> str:
    return hashlib.sha256(canonical(value).encode("utf-8")).hexdigest()


def load_json(path: Path) -> Any:
    def reject_constant(value: str) -> None:
        raise ValueError(f"Non-finite JSON number: {value}")
    return json.loads(path.read_text(encoding="utf-8-sig"), parse_constant=reject_constant)


def fingerprints(style: dict[str, Any]) -> dict[str, str]:
    """Separate musical structure, expressive events, patch mapping and mix intent.

Event-list order is normalized, while multiplicity is retained. Performance rows
include their score identity: changed notes can therefore change both layers.
Hash equality is not perceptual equality and is not a novelty/copyright test.
"""
    if not isinstance(style, dict):
        raise ValueError("composition.json must be an object")
    events = style.get("events")
    if not isinstance(events, list) or not events:
        raise ValueError("composition.json must contain a non-empty events list")
    if not all(isinstance(event, dict) for event in events):
        raise ValueError("Every event must be an object")
    def rows(keys: tuple[str, ...]) -> list[dict[str, Any]]:
        return sorted(({k: e[k] for k in keys if k in e} for e in events), key=canonical)
    structure = {k: style[k] for k in (
        "bpm", "beats", "meter", "barLength"
    ) if k in style}
    declared_structure = {k: style[k] for k in ("key", "mode", "voice_budget", "chord_plan") if k in style}
    # Prose changes do not masquerade as performed musical changes.
    declared_structure["form"] = [{k: s[k] for k in ("start_bar", "bars") if k in s}
                                  for s in style.get("form", [])]
    return {
        "score": digest({"structure": structure, "events": rows(SCORE_KEYS)}),
        "performance": digest(rows(SCORE_KEYS + PERFORMANCE_KEYS)),
        "declared_structure": digest(declared_structure),
        "instrument_map": digest(style.get("instrument_map", {})),
        "mix_intent": digest({k: style[k] for k in ("mix", "mix_v2", "mix_v3", "track_mix", "render") if k in style}),
    }


def replace_control(harness: dict[str, Any], path: str, value: Any) -> dict[str, Any]:
    """Replace an existing object key only; never silently create a new control."""
    result = copy.deepcopy(harness)
    parts = path.split(".")
    if not parts or any(not part for part in parts):
        raise ValueError(f"Invalid control path: {path!r}")
    cursor: Any = result
    for part in parts[:-1]:
        if not isinstance(cursor, dict) or part not in cursor:
            raise ValueError(f"Unknown control: {path}")
        cursor = cursor[part]
    if not isinstance(cursor, dict) or parts[-1] not in cursor:
        raise ValueError(f"Unknown control: {path}")
    if canonical(cursor[parts[-1]]) == canonical(value):
        raise ValueError(f"Probe value equals the existing value: {path}")
    canonical(value)  # Reject NaN/Infinity before invoking the CLI.
    cursor[parts[-1]] = value
    return result


def compose_trial(skill: Path, plan: dict[str, Any], harness: dict[str, Any], timeout: float) -> dict[str, str]:
    with tempfile.TemporaryDirectory(prefix="gmc-probe-") as temporary:
        work = Path(temporary)
        for name, data in (("composition-plan.json", plan), ("generation-harness.json", harness)):
            (work / name).write_text(canonical(data) + "\n", encoding="utf-8")
        completed = subprocess.run(
            [sys.executable, str(skill / "scripts" / "neospc.py"), "compose", str(work)],
            cwd=skill, capture_output=True, text=True, encoding="utf-8", errors="replace",
            timeout=timeout, check=False,
        )
        if completed.returncode:
            details = (completed.stderr or completed.stdout).strip()[-2000:]
            raise ValueError(f"compose exited {completed.returncode}: {details}")
        return fingerprints(load_json(work / "composition.json"))


def run_probe(project: Path, skill: Path, cases: list[dict[str, Any]], timeout: float = 90) -> dict[str, Any]:
    project, skill = project.resolve(), skill.resolve()
    if not math.isfinite(timeout) or timeout <= 0:
        raise ValueError("Timeout must be a positive finite number")
    if not (skill / "scripts" / "neospc.py").is_file():
        raise ValueError("--skill must point to a complete portable skill directory")
    if not isinstance(cases, list) or len(cases) > 64:
        raise ValueError("Expected a list of at most 64 probe cases")
    for case in cases:
        if not isinstance(case, dict) or set(case) != {"control", "value"} or not isinstance(case["control"], str):
            raise ValueError("Each case must contain exactly control (string) and value")
    plan = load_json(project / "composition-plan.json")
    harness = load_json(project / "generation-harness.json")
    baseline = compose_trial(skill, plan, harness, timeout)
    repeated = compose_trial(skill, plan, harness, timeout)
    deterministic = baseline == repeated
    report: dict[str, Any] = {
        "schema_version": 1,
        "scope": "compose-stage-only; no render or perceptual assessment",
        "input_sha256": {"plan": digest(plan), "harness": digest(harness)},
        "baseline_repeatable": deterministic,
        "baseline": baseline,
        "baseline_repeat": repeated,
        "cases": [],
        "interpretation": "Unchanged means unchanged in this fixture at compose stage, not universally unsupported. Structure and mapping changes do not prove audible changes. No quality score is calculated.",
    }
    # A non-repeatable baseline invalidates one-variable comparisons.
    if not deterministic:
        report["status"] = "baseline_not_repeatable"
        return report
    for case in cases:
        row = copy.deepcopy(case)
        try:
            variant = replace_control(harness, case["control"], case["value"])
            actual = compose_trial(skill, plan, variant, timeout)
            changed = [layer for layer in baseline if baseline[layer] != actual[layer]]
            row.update(status="changed" if changed else "unchanged_in_fixture", changed_layers=changed, fingerprints=actual)
        except (ValueError, OSError, subprocess.TimeoutExpired) as exc:
            row.update(status="not_comparable", reason=str(exc))
        report["cases"].append(row)
    report["status"] = "complete"
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project", required=True, type=Path)
    parser.add_argument("--skill", type=Path, default=Path(__file__).resolve().parents[1] / "game-music-composer")
    parser.add_argument("--cases", required=True, type=Path)
    parser.add_argument("--out", required=True, type=Path)
    parser.add_argument("--timeout", type=float, default=90)
    args = parser.parse_args()
    try:
        # Exclusive creation prevents overwriting a source plan, harness or prior evidence.
        if args.out.exists():
            raise ValueError("Output already exists; choose a new evidence filename")
        report = run_probe(args.project, args.skill, load_json(args.cases), args.timeout)
        args.out.parent.mkdir(parents=True, exist_ok=True)
        with args.out.open("x", encoding="utf-8") as handle:
            handle.write(json.dumps(report, indent=2, ensure_ascii=False, allow_nan=False) + "\n")
        print(f"{report['status']}: {args.out}")
        return 0 if report["baseline_repeatable"] else 2
    except (ValueError, OSError, subprocess.TimeoutExpired) as exc:
        print(f"Probe failed: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
