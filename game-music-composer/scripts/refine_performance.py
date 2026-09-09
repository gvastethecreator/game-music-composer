#!/usr/bin/env python3
"""Opt-in, non-destructive phrase/role performance refinement for Neo-SPC JSON.

This changes performance timing/duration/velocity, never pitches or written onsets.
It neither recomposes a weak idea nor certifies the sound of a renderer.
"""
from __future__ import annotations

import argparse
import copy
import hashlib
import json
import math
from pathlib import Path
import sys
from typing import Any

PROFILES = {
    "chamber": {"lead_ms": 5, "bass_ms": 0, "support_ms": 2, "phrase_ms": 3, "arc": .09},
    "pocket": {"lead_ms": 16, "bass_ms": -4, "support_ms": 6, "phrase_ms": 2, "arc": .07},
    "ritual": {"lead_ms": 0, "bass_ms": 0, "support_ms": 0, "phrase_ms": 0, "arc": .12},
}
PERFORMANCE_FIELDS = ("performance_beat", "performance_duration", "performance_gain",
                      "start_offset_ms", "velocity", "velocity_norm", "velocity_gain")
STRUCTURE_FIELDS = ("kind", "inst", "role", "midi", "beat", "duration")


def canonical(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False)


def digest(value: Any) -> str:
    return hashlib.sha256(canonical(value).encode()).hexdigest()


def number(value: Any, name: str, minimum: float, maximum: float) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        raise ValueError(f"{name}: expected a finite number, not a boolean")
    if not minimum <= value <= maximum:
        raise ValueError(f"{name}: expected {minimum} <= value <= {maximum}")
    return float(value)


def structural_hash(style: dict[str, Any]) -> str:
    return digest(sorted(({k: e[k] for k in STRUCTURE_FIELDS if k in e}
                          for e in style["events"]), key=canonical))


def peak_symbolic(events: list[dict[str, Any]], total: float) -> int:
    """Exact sweep under the existing symbolic .12-beat drum proxy, NOT synth voices."""
    points = []
    for e in events:
        start = e.get("performance_beat", e["beat"]) % total
        duration = .12 if e["kind"] == "drum" else e.get("performance_duration", e.get("duration", .25))
        if duration > total:
            raise ValueError("A note lasts longer than one loop; this refinement requires a shorter region")
        end = start + duration
        points.extend([(start, 1), (min(total, end), -1)])
        if end > total:
            points.extend([(0, 1), (end - total, -1)])
    count = peak = 0
    for _, delta in sorted(points):
        count += delta
        peak = max(peak, count)
    return peak


def refine_style(style: dict[str, Any], profile: str = "chamber", amount: float = .5,
                 seed: int = 2207) -> dict[str, Any]:
    if profile not in PROFILES:
        raise ValueError(f"Unknown profile: {profile}")
    number(amount, "amount", 0, 1)
    number(seed, "seed", 0, 2147483647)
    if not isinstance(seed, int):
        raise ValueError("seed must be an integer")
    if not isinstance(style, dict) or not isinstance(style.get("events"), list) or not style["events"]:
        raise ValueError("Expected a composition with a non-empty events list")
    if style.get("performance_refinement"):
        raise ValueError("Already refined. Re-run from the original input, not an earlier refinement")
    if len(style["events"]) > 50000:
        raise ValueError("At most 50000 events per cue")
    canonical(style)  # reject non-finite values even in fields not otherwise touched
    bpm = number(style.get("bpm"), "bpm", 30, 260)
    total = number(style.get("beats"), "beats", .25, 10000)
    bar = number(style.get("barLength"), "barLength (quarter-note beats)", .25, 32)
    budget = style.get("voice_budget", 32)
    number(budget, "voice_budget", 1, 32)
    if not isinstance(budget, int):
        raise ValueError("voice_budget must be an integer")
    for i, e in enumerate(style["events"]):
        if not isinstance(e, dict) or e.get("kind") not in {"note", "drum"} or not isinstance(e.get("inst"), str):
            raise ValueError(f"events[{i}]: expected a note/drum with instrument id")
        number(e.get("beat"), f"events[{i}].beat", 0, total - 1e-8)
        number(e.get("duration", .12), f"events[{i}].duration", .001, total)
        if e["kind"] == "note":
            number(e.get("midi"), f"events[{i}].midi", 0, 127)
            if not isinstance(e["midi"], int):
                raise ValueError("MIDI pitches must be integers")
        number(e.get("performance_beat", e["beat"]), "performance_beat", 0, total - 1e-8)
        number(e.get("performance_duration", e.get("duration", .12)), "performance_duration", .001, total)
        number(e.get("velocity", 80), "velocity", 1, 127)
        number(e.get("velocity_gain", 1), "velocity_gain", 0, 20)
        number(e.get("performance_gain", 1), "performance_gain", 0, 20)
    result = copy.deepcopy(style)
    if amount == 0:
        return result
    profile_data = PROFILES[profile]
    original_hash = structural_hash(style)
    # Compute an onset-shift ceiling per instrument, including the wraparound gap.
    limits = {}
    for inst in {e["inst"] for e in style["events"]}:
        starts = sorted({e["beat"] for e in style["events"] if e["inst"] == inst})
        gaps = [b-a for a,b in zip(starts,starts[1:])] + [total-starts[-1]+starts[0]]
        limits[inst] = min(.025, min(gaps) * 60/bpm * .24)
    boundary_adjustments = 0
    for e in result["events"]:
        beat = e["beat"]
        phrase = int(beat / (bar * 4))
        phase = (beat % (bar * 4)) / (bar * 4)
        arc = math.sin(math.pi * phase)
        role = e.get("role", "support")
        melodic = role in {"lead", "counter", "riff"}
        group = "lead" if melodic else "bass" if role == "bass" else "support"
        anchor = e["kind"] == "drum"
        base_ms = 0 if anchor else profile_data[group + "_ms"]
        # One deterministic timing gesture per instrument/phrase. Chord members agree.
        raw = int(digest([seed, e["inst"], phrase])[:8], 16) / 0xffffffff * 2 - 1
        target_shift = (base_ms + (0 if anchor else raw * profile_data["phrase_ms"])) / 1000
        target_shift = max(-limits[e["inst"]], min(limits[e["inst"]], target_shift))
        # Native timing wraps early downbeats to the end of the loop. Blend
        # their signed offsets, not the distant absolute positions on the loop.
        previous_offset = (e.get("performance_beat", beat) - beat + total/2) % total - total/2
        mixed_offset = (1-amount)*previous_offset + amount*target_shift*bpm/60
        mixed = beat + mixed_offset
        boundary_adjustments += int(mixed < 0 or mixed >= total)
        e["performance_beat"] = round(mixed % total, 8) % total
        e["start_offset_ms"] = round(mixed_offset*60/bpm*1000, 5)
        if e["kind"] == "note":
            gate = (.88 + .09*arc) if melodic else .96 if role == "bass" else .94
            target_dur = max(.01, e.get("duration", .25)*gate)
            e["performance_duration"] = round((1-amount)*e.get("performance_duration", e.get("duration", .25)) + amount*target_dur, 8)
        old_velocity = e.get("velocity", 80)
        gain = 1 + amount*profile_data["arc"]*(arc-.45)*(0.4 if anchor else 1)
        velocity = max(1, min(127, round(old_velocity*gain)))
        ratio = velocity/old_velocity
        e.update(velocity=velocity, velocity_norm=round(velocity/127, 6),
                 velocity_gain=round(e.get("velocity_gain", 1)*ratio, 6),
                 performance_gain=round(e.get("performance_gain", 1)*ratio, 6))
    peak = peak_symbolic(result["events"], total)
    if peak > budget:
        raise ValueError(f"Refined cue requires {peak} symbolic voices; budget {budget}. No notes were deleted. Reduce amount or revise the arrangement")
    if structural_hash(result) != original_hash:
        raise AssertionError("Refinement changed the written score")
    result["measured_peak_voices"] = peak
    result["performance_refinement"] = {
        "version": 1, "profile": profile, "amount": amount, "seed": seed,
        "input_sha256": digest(style), "structure_sha256": original_hash,
        "structural_events_preserved": True, "boundary_adjustments": boundary_adjustments,
        "symbolic_voice_model": "exact sweep; drums=.12 beat; excludes audio release/sample tails",
        "listening_review": "pending", "render_parity": "not_verified",
        "note": "Opt-in phrase/role heuristic, not a genre authenticity model or artistic approval",
    }
    return result


def refine(data: Any, **kwargs: Any) -> dict[str, Any]:
    if not isinstance(data, dict):
        raise ValueError("Expected a composition or catalog object")
    if "styles" in data:
        if not isinstance(data["styles"], list) or not 1 <= len(data["styles"]) <= 100:
            raise ValueError("Expected 1..100 complete styles")
        result = copy.deepcopy(data)
        result["styles"] = [refine_style(s, **kwargs) for s in data["styles"]]
        return result
    return refine_style(data, **kwargs)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--profile", choices=sorted(PROFILES), default="chamber")
    parser.add_argument("--amount", type=float, default=.5)
    parser.add_argument("--seed", type=int, default=2207)
    args = parser.parse_args()
    try:
        if args.output.exists():
            raise ValueError("Output exists. Choose a new filename; source and evidence are never overwritten")
        if args.input.stat().st_size > 25*1024*1024:
            raise ValueError("Input exceeds 25 MB")
        result = refine(json.loads(args.input.read_text(encoding="utf-8-sig")),
                        profile=args.profile, amount=args.amount, seed=args.seed)
        text = json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False) + "\n"
        args.output.parent.mkdir(parents=True, exist_ok=True)
        with args.output.open("x", encoding="utf-8", newline="\n") as handle:
            handle.write(text)
        print(f"Written: {args.output}. Structure preserved; listening review pending. Validate and render into a NEW directory")
        return 0
    except (ValueError, OSError) as exc:
        print(f"Refinement failed: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
