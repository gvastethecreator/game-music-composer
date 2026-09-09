#!/usr/bin/env python3
"""Canonical, dependency-free CLI for Neo-SPC composition projects."""
from __future__ import annotations

import argparse
import copy
import json
import re
import shutil
import subprocess
import sys
import unicodedata
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Iterable


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
SCHEMAS = ROOT / "schemas"
TEMPLATES = ROOT / "templates"
SCRIPTS = ROOT / "scripts"

HARNESS_SPEC_PATH = DATA / "generation-harness-v3.json"
PLAN_TEMPLATE_PATH = TEMPLATES / "neospc-composition-plan.json"
BENCHMARK_PATH = DATA / "neospc100-benchmark-v4.1.json"
FACTORY_MANIFEST_PATH = DATA / "factory-bank-manifest.json"
CALIBRATION_PATH = DATA / "instrument-calibration.json"
SAMPLE_DIR = ROOT / "resources" / "original-sample-bank"

RUNTIME_JSON_PATHS = (
    DATA / "category-benchmark-contracts.json",
    DATA / "chord-progression-library.json",
    DATA / "factory-bank-manifest.json",
    DATA / "factory-bank-role-map.json",
    DATA / "fast-tempo-detail-rules.json",
    DATA / "generation-harness-v3.json",
    DATA / "instrument-calibration.json",
    DATA / "mix-audit-v2.2.json",
    DATA / "mix-bus-profiles.json",
    DATA / "neospc100-benchmark-v4.1.json",
    DATA / "pattern-preset-library.json",
    DATA / "scale-library.json",
    DATA / "voice-architecture-profiles.json",
    DATA / "voice-budget-modes.json",
    SCHEMAS / "composition-plan.schema.json",
    SCHEMAS / "generation-harness-v3.schema.json",
    SCHEMAS / "neospc-composition.schema.json",
    PLAN_TEMPLATE_PATH,
)

VOICE_PROFILES = {
    8: "legacy_8",
    12: "compact_12",
    16: "expanded_16",
    24: "ensemble_24",
    32: "symphonic_32",
}
KEYS = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"]
HARNESS_SECTIONS = (
    "brief",
    "harmony",
    "form",
    "melody",
    "counterpoint",
    "rhythm",
    "arp",
    "bassline",
    "drums",
    "orchestration",
    "texture",
    "humanize",
    "mix",
    "render",
    "review",
)
CATEGORY_PRESETS = {
    "bachata": ("folk_ensemble", "guitar", "guitar", "bossa", "acoustic"),
    "trip_hop": ("jazz_combo", "piano", "vibes", "funk", "brush"),
    "trap": ("electronic_stack", "bell", "synth_lead", "motor", "electronic"),
    "reggaeton": ("hybrid", "synth_lead", "guitar", "motor", "electronic"),
    "adventure": ("folk_ensemble", "flute", "guitar", "floating", "acoustic"),
    "action": ("hybrid", "brass", "strings", "motor", "orchestral"),
    "horror": ("choir_orchestra", "reed", "strings", "ritual", "minimal"),
    "towns": ("folk_ensemble", "ocarina", "flute", "bossa", "acoustic"),
    "emotion": ("chamber", "piano", "strings", "floating", "brush"),
    "mystery": ("chamber", "vibes", "reed", "motor", "minimal"),
    "fantasy": ("choir_orchestra", "flute", "brass", "ritual", "orchestral"),
    "electronic": ("electronic_stack", "synth_lead", "vibes", "motor", "electronic"),
    "urban": ("jazz_combo", "reed", "vibes", "funk", "brush"),
    "classical": ("chamber", "strings", "flute", "floating", "orchestral"),
}


@dataclass(frozen=True)
class Issue:
    level: str
    code: str
    path: str
    message: str


def load_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise ValueError(f"File does not exist: {path}") from exc
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid JSON in {path}: line {exc.lineno}, column {exc.colno}: {exc.msg}") from exc


def slugify(value: str) -> str:
    plain = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"_+", "_", re.sub(r"[^a-z0-9]+", "_", plain.lower())).strip("_") or "new_cue"


def atomic_json_write(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    staging = path.with_name(f".{path.name}.tmp")
    staging.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    staging.replace(path)


def category_ids() -> set[str]:
    contracts = load_json(DATA / "category-benchmark-contracts.json")
    return {str(item["id"]) for item in contracts["categories"]}


def harness_defaults() -> dict[str, dict[str, Any]]:
    spec = load_json(HARNESS_SPEC_PATH)
    return {
        section: {name: copy.deepcopy(control.get("default")) for name, control in controls.items()}
        for section, controls in spec["sections"].items()
    }


def recommended_progression(mode: str, category: str, game_context: str, mood: str) -> str:
    target_mode = {
        "ionian": "major", "major": "major", "aeolian": "minor", "minor": "minor",
        "harmonic_minor": "minor", "melodic_minor": "minor",
    }.get(mode, mode)
    progressions = load_json(DATA / "chord-progression-library.json")["progressions"]
    scored: list[tuple[int, str]] = []
    for item in progressions:
        genres = set(item.get("genres", []))
        moods = set(item.get("moods", []))
        score = 8 if item.get("mode") == target_mode else 0
        score += 7 if game_context in genres else 0
        score += 5 if category in genres else 0
        score += 4 if mood in moods else 0
        score -= 1 if item["id"].endswith(("_rot1", "_hold")) else 0
        scored.append((score, item["id"]))
    return min((item for item in scored if item[0] == max(score for score, _ in scored)), key=lambda item: item[1])[1]


def apply_brief_presets(plan: dict[str, Any], harness: dict[str, Any], args: argparse.Namespace) -> None:
    ensemble, lead, secondary, groove, kit = CATEGORY_PRESETS[args.category]
    if args.game_context in {"combat", "boss"}:
        ensemble, lead, secondary, groove = "hybrid", "brass", "strings", "motor"
        kit = "orchestral" if args.game_context == "boss" else "acoustic"
    elif args.game_context == "chase":
        ensemble, lead, secondary, groove, kit = "electronic_stack", "synth_lead", "brass", "breakbeat", "electronic"
    elif args.game_context == "stealth":
        ensemble, lead, secondary, groove, kit = "compact_band", "reed", "vibes", "floating", "minimal"
    elif args.game_context == "safe_room":
        ensemble, lead, secondary, groove, kit = "chamber", "piano", "strings", "floating", "minimal"
    harness["orchestration"].update({"ensemble_profile": ensemble, "primary_lead": lead, "secondary_lead": secondary})
    harness["rhythm"]["groove_template"] = groove
    harness["drums"]["kit"] = kit
    harness["form"]["architecture"] = "layered_build" if args.game_context in {"combat", "boss", "chase"} else "period"
    harness["harmony"]["progression_id"] = recommended_progression(harness["harmony"]["scale_id"], args.category, args.game_context, args.mood)
    plan["musical_identity"].update(
        {
            "motif": f"{args.mood} {harness['melody']['contour']} contour",
            "harmonic_language": f"{harness['harmony']['scale_id']} · {harness['harmony']['progression_id']}",
            "bass_behavior": harness["bassline"]["preset"],
            "groove": groove,
            "silence_budget": "Leave a short breath before each phrase return and keep the loop pickup clear.",
            "loop_strategy": f"Use the active cadence in {harness['harmony']['progression_id']} to lead back into the opening pickup.",
        }
    )


def add_issue(issues: list[Issue], level: str, code: str, path: str, message: str) -> None:
    issues.append(Issue(level=level, code=code, path=path, message=message))


def require_fields(value: Any, fields: Iterable[str], base: str, issues: list[Issue]) -> bool:
    if not isinstance(value, dict):
        add_issue(issues, "error", "expected_object", base, "Expected a JSON object.")
        return False
    for field in fields:
        if field not in value:
            add_issue(issues, "error", "missing_field", f"{base}.{field}", "Required field is missing.")
    return True


def validate_plan(plan: Any, base: str = "$") -> list[Issue]:
    issues: list[Issue] = []
    fields = (
        "id",
        "title",
        "category",
        "subcategory",
        "game_function",
        "emotional_thesis",
        "voice_profile",
        "voice_budget",
        "musical_identity",
        "voice_architecture",
        "form",
        "quality_gates",
    )
    if not require_fields(plan, fields, base, issues):
        return issues
    cue_id = str(plan.get("id", ""))
    if not re.fullmatch(r"[a-z0-9_]+", cue_id):
        add_issue(issues, "error", "invalid_id", f"{base}.id", "Use lowercase letters, digits and underscores.")
    if plan.get("category") not in category_ids():
        add_issue(issues, "error", "unknown_category", f"{base}.category", "Use a category from category-benchmark-contracts.json.")
    budget = plan.get("voice_budget")
    if budget not in VOICE_PROFILES:
        add_issue(issues, "error", "invalid_voice_budget", f"{base}.voice_budget", "Choose 8, 12, 16, 24 or 32 voices.")
    elif plan.get("voice_profile") != VOICE_PROFILES[budget]:
        add_issue(issues, "error", "voice_profile_mismatch", f"{base}.voice_profile", f"Expected {VOICE_PROFILES[budget]} for a {budget}-voice budget.")
    identity = plan.get("musical_identity")
    if require_fields(identity, ("meter", "bpm", "key", "mode", "motif", "harmonic_language", "bass_behavior", "groove", "silence_budget", "loop_strategy"), f"{base}.musical_identity", issues):
        bpm = identity.get("bpm")
        if not isinstance(bpm, (int, float)) or isinstance(bpm, bool) or not 30 <= bpm <= 260:
            add_issue(issues, "error", "invalid_bpm", f"{base}.musical_identity.bpm", "BPM must be between 30 and 260.")
        if identity.get("key") not in KEYS:
            add_issue(issues, "error", "invalid_key", f"{base}.musical_identity.key", f"Use one of: {', '.join(KEYS)}.")
        descriptive = {
            f"{base}.emotional_thesis": plan.get("emotional_thesis"),
            **{f"{base}.musical_identity.{field}": identity.get(field) for field in ("motif", "harmonic_language", "bass_behavior", "groove", "silence_budget", "loop_strategy")},
        }
        placeholder_markers = ("describe ", "state the ", "replace ", "name where", "todo", "<")
        for path, value in descriptive.items():
            text = str(value or "").strip().lower()
            if not text or any(marker in text for marker in placeholder_markers):
                add_issue(issues, "error", "placeholder_text", path, "Replace template wording with a concrete musical decision.")
    form = plan.get("form")
    if not isinstance(form, list) or len(form) < 2:
        add_issue(issues, "error", "weak_form", f"{base}.form", "Declare at least two sections.")
    else:
        for index, section in enumerate(form):
            section_path = f"{base}.form[{index}]"
            if require_fields(section, ("name", "function", "bars"), section_path, issues):
                if not isinstance(section.get("bars"), int) or section["bars"] < 1:
                    add_issue(issues, "error", "invalid_section_bars", f"{section_path}.bars", "Section bars must be a positive integer.")
    gates = plan.get("quality_gates")
    if isinstance(gates, dict):
        for name, state in gates.items():
            if not isinstance(state, bool):
                add_issue(issues, "error", "invalid_gate", f"{base}.quality_gates.{name}", "Quality gate state must be true or false.")
    else:
        add_issue(issues, "error", "expected_object", f"{base}.quality_gates", "Expected a JSON object.")
    return issues


def library_values(source: str) -> set[Any]:
    if source == "scale-library.json":
        return {item["id"] for item in load_json(DATA / source)["scales"]}
    if source == "chord-progression-library.json":
        return {item["id"] for item in load_json(DATA / source)["progressions"]}
    if source.startswith("pattern-preset-library.json#"):
        group = source.split("#", 1)[1]
        if group == "melody":
            group = "melody_motion"
        return {item["id"] for item in load_json(DATA / "pattern-preset-library.json")["patterns"].get(group, [])}
    return set()


def validate_control(value: Any, control: dict[str, Any], path: str, issues: list[Issue]) -> None:
    control_type = control.get("type")
    if control_type == "boolean":
        if not isinstance(value, bool):
            add_issue(issues, "error", "invalid_boolean", path, "Expected true or false.")
        return
    if control_type in {"range", "integer"}:
        valid_number = isinstance(value, (int, float)) and not isinstance(value, bool)
        if control_type == "integer":
            valid_number = isinstance(value, int) and not isinstance(value, bool)
        if not valid_number:
            add_issue(issues, "error", "invalid_number", path, f"Expected {control_type} value.")
            return
        if "min" in control and value < control["min"]:
            add_issue(issues, "error", "below_minimum", path, f"Minimum is {control['min']}.")
        if "max" in control and value > control["max"]:
            add_issue(issues, "error", "above_maximum", path, f"Maximum is {control['max']}.")
        return
    if control_type == "enum":
        allowed = set(control.get("values", []))
        if control.get("source"):
            allowed = library_values(str(control["source"]))
        if value not in allowed:
            preview = ", ".join(map(str, list(sorted(allowed, key=str))[:8]))
            add_issue(issues, "error", "invalid_enum", path, f"Value is outside the allowed set. Examples: {preview}.")


def validate_harness(harness: Any, base: str = "$") -> list[Issue]:
    issues: list[Issue] = []
    if not isinstance(harness, dict):
        add_issue(issues, "error", "expected_object", base, "Expected a JSON object.")
        return issues
    spec = load_json(HARNESS_SPEC_PATH)["sections"]
    for section in HARNESS_SECTIONS:
        controls = harness.get(section)
        if not isinstance(controls, dict):
            add_issue(issues, "error", "missing_section", f"{base}.{section}", "Harness section is missing or invalid.")
            continue
        for name, control in spec[section].items():
            path = f"{base}.{section}.{name}"
            if name not in controls:
                add_issue(issues, "error", "missing_control", path, "Harness control is missing.")
                continue
            validate_control(controls[name], control, path, issues)
        unknown = sorted(set(controls) - set(spec[section]))
        for name in unknown:
            add_issue(issues, "warning", "unknown_control", f"{base}.{section}.{name}", "Control is not present in the bundled harness spec.")
    for section in sorted(set(harness) - set(HARNESS_SECTIONS)):
        add_issue(issues, "warning", "unknown_section", f"{base}.{section}", "Section is not present in the bundled harness spec.")
    return issues


def validate_composition(style: Any, base: str = "$") -> list[Issue]:
    issues: list[Issue] = []
    required = (
        "id",
        "title",
        "category",
        "subcategory",
        "bpm",
        "meter",
        "beats",
        "voice_budget",
        "measured_peak_voices",
        "form",
        "chord_plan",
        "events",
        "instrument_map",
    )
    if not require_fields(style, required, base, issues):
        return issues
    if not re.fullmatch(r"[a-z0-9_]+", str(style.get("id", ""))):
        add_issue(issues, "error", "invalid_id", f"{base}.id", "Use lowercase letters, digits and underscores.")
    if style.get("category") not in category_ids():
        add_issue(issues, "error", "unknown_category", f"{base}.category", "Use a bundled benchmark category.")
    bpm = style.get("bpm")
    if not isinstance(bpm, (int, float)) or isinstance(bpm, bool) or not 30 <= bpm <= 260:
        add_issue(issues, "error", "invalid_bpm", f"{base}.bpm", "BPM must be between 30 and 260.")
    beats = style.get("beats")
    if not isinstance(beats, (int, float)) or isinstance(beats, bool) or beats <= 0:
        add_issue(issues, "error", "invalid_loop_length", f"{base}.beats", "Loop length must be greater than zero.")
    budget = style.get("voice_budget")
    peak = style.get("measured_peak_voices")
    if not isinstance(budget, int) or not 8 <= budget <= 32:
        add_issue(issues, "error", "invalid_voice_budget", f"{base}.voice_budget", "Voice budget must be an integer from 8 to 32.")
    if not isinstance(peak, int) or peak < 1:
        add_issue(issues, "error", "invalid_peak", f"{base}.measured_peak_voices", "Measured peak must be a positive integer.")
    elif isinstance(budget, int) and peak > budget:
        add_issue(issues, "error", "voice_budget_exceeded", f"{base}.measured_peak_voices", f"Measured peak {peak} exceeds budget {budget}.")
    instruments = style.get("instrument_map")
    events = style.get("events")
    if not isinstance(instruments, dict) or not instruments:
        add_issue(issues, "error", "missing_instruments", f"{base}.instrument_map", "Declare at least one instrument.")
        instruments = {}
    if not isinstance(events, list) or not events:
        add_issue(issues, "error", "missing_events", f"{base}.events", "Declare at least one note or drum event.")
        events = []
    for index, event in enumerate(events):
        event_path = f"{base}.events[{index}]"
        if not isinstance(event, dict):
            add_issue(issues, "error", "invalid_event", event_path, "Event must be a JSON object.")
            continue
        instrument = event.get("inst")
        if instrument not in instruments:
            add_issue(issues, "error", "unknown_instrument", f"{event_path}.inst", f"Instrument {instrument!r} is not declared in instrument_map.")
        beat = event.get("performance_beat", event.get("beat"))
        if not isinstance(beat, (int, float)) or isinstance(beat, bool):
            add_issue(issues, "error", "invalid_beat", f"{event_path}.beat", "Event beat must be numeric.")
        elif isinstance(beats, (int, float)) and not 0 <= beat < beats:
            add_issue(issues, "error", "event_outside_loop", f"{event_path}.beat", f"Event beat must be inside 0..{beats}.")
        if event.get("kind") != "drum":
            midi = event.get("midi")
            if not isinstance(midi, int) or not 0 <= midi <= 127:
                add_issue(issues, "error", "invalid_midi_note", f"{event_path}.midi", "MIDI note must be an integer from 0 to 127.")
    if not isinstance(style.get("form"), list) or len(style["form"]) < 2:
        add_issue(issues, "error", "weak_form", f"{base}.form", "Declare at least two form sections.")
    return issues


def validate_catalog(catalog: Any, base: str = "$") -> list[Issue]:
    issues: list[Issue] = []
    if not isinstance(catalog, dict) or not isinstance(catalog.get("styles"), list):
        add_issue(issues, "error", "invalid_catalog", base, "Catalog must contain a styles array.")
        return issues
    seen: set[str] = set()
    for index, style in enumerate(catalog["styles"]):
        issues.extend(validate_composition(style, f"{base}.styles[{index}]"))
        cue_id = str(style.get("id", "")) if isinstance(style, dict) else ""
        if cue_id in seen:
            add_issue(issues, "error", "duplicate_id", f"{base}.styles[{index}].id", f"Cue id {cue_id!r} is duplicated.")
        seen.add(cue_id)
    return issues


def detect_kind(value: Any) -> str:
    if isinstance(value, dict) and isinstance(value.get("styles"), list):
        return "catalog"
    if isinstance(value, dict) and "events" in value and "instrument_map" in value:
        return "composition"
    if isinstance(value, dict) and "musical_identity" in value and "voice_architecture" in value:
        return "plan"
    if isinstance(value, dict) and set(HARNESS_SECTIONS).issubset(value):
        return "harness"
    return "unknown"


def validate_value(value: Any, kind: str) -> list[Issue]:
    resolved = detect_kind(value) if kind == "auto" else kind
    validators = {
        "plan": validate_plan,
        "harness": validate_harness,
        "composition": validate_composition,
        "catalog": validate_catalog,
    }
    if resolved not in validators:
        return [Issue("error", "unknown_document", "$", "Could not detect document type. Pass --kind explicitly.")]
    return validators[resolved](value)


def issue_counts(issues: list[Issue]) -> dict[str, int]:
    return {
        "errors": sum(issue.level == "error" for issue in issues),
        "warnings": sum(issue.level == "warning" for issue in issues),
    }


def print_report(label: str, issues: list[Issue], as_json: bool = False) -> None:
    counts = issue_counts(issues)
    if as_json:
        print(json.dumps({"label": label, **counts, "issues": [asdict(issue) for issue in issues]}, indent=2))
        return
    state = "PASS" if not counts["errors"] else "FAIL"
    print(f"{state} {label}: {counts['errors']} error(s), {counts['warnings']} warning(s)")
    for issue in issues:
        print(f"  {issue.level.upper():7} {issue.code:24} {issue.path}: {issue.message}")


def cmd_init(args: argparse.Namespace) -> int:
    genre_tempos = {"bachata": 122, "trip_hop": 78, "trap": 144, "reggaeton": 94}
    args.meter = args.meter or ("4/4" if args.category in genre_tempos else "6/8")
    args.bpm = args.bpm if args.bpm is not None else genre_tempos.get(args.category, 96)
    if args.category in genre_tempos and args.meter != "4/4":
        print("These genre blueprints require 4/4. Choose --meter 4/4.", file=sys.stderr)
        return 2
    output = args.output.resolve()
    plan_path = output / "composition-plan.json"
    harness_path = output / "generation-harness.json"
    occupied = [path for path in (plan_path, harness_path, output / "score-blueprint.json") if path.exists()]
    if occupied and not args.force:
        print(f"Refusing to overwrite {', '.join(str(path) for path in occupied)}. Pass --force to replace them.", file=sys.stderr)
        return 2
    plan = load_json(PLAN_TEMPLATE_PATH)
    plan["id"] = args.id or slugify(args.title)
    plan["title"] = args.title
    plan["category"] = args.category
    plan["subcategory"] = args.subcategory
    plan["game_function"] = args.game_function or args.game_context
    plan["emotional_thesis"] = args.thesis or f"Turn {args.mood} pressure into a clear {args.game_context.replace('_', ' ')} outcome across the loop."
    plan["voice_budget"] = args.voices
    plan["voice_profile"] = VOICE_PROFILES[args.voices]
    identity = plan["musical_identity"]
    identity.update({"meter": args.meter, "bpm": args.bpm, "key": args.key, "mode": args.mode})
    section_bars = args.bars // 4
    for section in plan["form"]:
        section["bars"] = section_bars
    harness = harness_defaults()
    harness["brief"].update(
        {
            "category": args.category,
            "game_context": args.game_context,
            "mood_primary": args.mood,
            "energy": args.energy,
            "tension": args.tension,
            "voice_budget": args.voices,
            "loop_bars": args.bars,
            "seed": args.seed,
        }
    )
    harness["harmony"]["key"] = KEYS.index(args.key)
    scale_ids = library_values("scale-library.json")
    harness["harmony"]["scale_id"] = args.mode if args.mode in scale_ids else "ionian"
    harness["rhythm"]["meter"] = args.meter
    apply_brief_presets(plan, harness, args)
    issues = validate_plan(plan) + validate_harness(harness)
    if any(issue.level == "error" for issue in issues):
        print_report("generated project", issues)
        return 1
    atomic_json_write(plan_path, plan)
    atomic_json_write(harness_path, harness)
    print(f"Created {plan_path}")
    print(f"Created {harness_path}")
    if args.category in {"bachata", "trip_hop", "trap", "reggaeton"}:
        records = [r for r in load_json(DATA / "genre-expansion-contracts.json")["contracts"] if r["category"] == args.category]
        record = records[args.seed % len(records)]
        blueprint = copy.deepcopy(record["native_engine_contract"]["writing"])
        contrast_start = next(i * section_bars for i, section in enumerate(plan["form"]) if section["name"] == "B")
        blueprint["drop_bars"] = [contrast_start] + ([contrast_start + 2] if section_bars >= 4 else [])
        blueprint["patch_overrides"] = record["patch_overrides"]
        atomic_json_write(output / "score-blueprint.json", blueprint)
        print(f"Created {output / 'score-blueprint.json'}")
    print(f'Next: "{sys.executable}" "{Path(__file__).resolve()}" validate "{plan_path}" "{harness_path}" --strict')
    print(f'Then: "{sys.executable}" "{Path(__file__).resolve()}" compose "{output}"')
    return 0


def cmd_compose(args: argparse.Namespace) -> int:
    project = args.project.resolve()
    plan_path = project / "composition-plan.json"
    harness_path = project / "generation-harness.json"
    composition_path = project / "composition.json"
    catalog_path = project / "catalog.json"
    occupied = [path for path in (composition_path, catalog_path) if path.exists()]
    if occupied and not args.force:
        print(f"Refusing to overwrite {', '.join(str(path) for path in occupied)}. Pass --force to replace them.", file=sys.stderr)
        return 2
    try:
        plan = load_json(plan_path)
        harness = load_json(harness_path)
    except ValueError as exc:
        print(str(exc), file=sys.stderr)
        return 2
    issues = validate_plan(plan, "composition-plan.json") + validate_harness(harness, "generation-harness.json")
    if any(issue.level == "error" for issue in issues):
        print_report(str(project), issues)
        return 1
    try:
        from compose_from_plan import compose_project

        blueprint_path = project / "score-blueprint.json"
        blueprint = load_json(blueprint_path) if blueprint_path.exists() else None
        composition, catalog = compose_project(plan, harness, blueprint)
    except (KeyError, StopIteration, TypeError, ValueError) as exc:
        print(f"Could not compose project: {exc}", file=sys.stderr)
        return 1
    output_issues = validate_composition(composition, "composition.json") + validate_catalog(catalog, "catalog.json")
    if any(issue.level == "error" for issue in output_issues):
        print_report("generated composition", output_issues)
        return 1
    atomic_json_write(composition_path, composition)
    atomic_json_write(catalog_path, catalog)
    print(f"Created {composition_path}")
    print(f"Created {catalog_path}")
    print(f"  READY   {len(composition['events'])} events, {len(composition['instrument_map'])} instruments, peak {composition['measured_peak_voices']}/{composition['voice_budget']} voices")
    print(f'Next: "{sys.executable}" "{Path(__file__).resolve()}" export-midi "{catalog_path}" "{project / "midi"}"')
    return 0


def cmd_validate(args: argparse.Namespace) -> int:
    all_issues: list[Issue] = []
    for path in args.paths:
        try:
            value = load_json(path)
            issues = validate_value(value, args.kind)
        except ValueError as exc:
            issues = [Issue("error", "invalid_input", str(path), str(exc))]
        print_report(str(path), issues, args.json)
        all_issues.extend(issues)
    counts = issue_counts(all_issues)
    return 1 if counts["errors"] or (args.strict and counts["warnings"]) else 0


def doctor_issues() -> list[Issue]:
    issues: list[Issue] = []
    required_paths = (
        ROOT / "SKILL.md",
        ROOT / "LICENSE",
        PLAN_TEMPLATE_PATH,
        HARNESS_SPEC_PATH,
        SCHEMAS / "composition-plan.schema.json",
        SCHEMAS / "generation-harness-v3.schema.json",
        SCHEMAS / "neospc-composition.schema.json",
        BENCHMARK_PATH,
        FACTORY_MANIFEST_PATH,
        SCRIPTS / "professor_review.py",
        SCRIPTS / "export_midis_v4.py",
        SCRIPTS / "audit_soundbank_assignments.py",
        SCRIPTS / "compose_from_plan.py",
    )
    for path in required_paths:
        if not path.is_file():
            add_issue(issues, "error", "missing_resource", str(path.relative_to(ROOT)), "Required skill resource is missing.")
    if issues:
        return issues
    for path in RUNTIME_JSON_PATHS:
        try:
            load_json(path)
        except ValueError as exc:
            add_issue(issues, "error", "invalid_json", str(path.relative_to(ROOT)), str(exc))
    if issues:
        return issues
    spec = load_json(HARNESS_SPEC_PATH)
    defaults = harness_defaults()
    issues.extend(validate_harness(defaults, "harness_defaults"))
    issues.extend(validate_plan(load_json(PLAN_TEMPLATE_PATH), "plan_template"))
    benchmark = load_json(BENCHMARK_PATH)
    benchmark_issues = validate_catalog(benchmark, "benchmark")
    issues.extend(benchmark_issues)
    styles = benchmark.get("styles", [])
    expected = sum(c["required_examples"] for c in load_json(DATA / "category-benchmark-contracts.json")["categories"])
    if len(styles) != expected:
        add_issue(issues, "warning", "benchmark_size", "benchmark.styles", f"Expected {expected} benchmark cues; found {len(styles)}.")
    categories = {style.get("category") for style in styles if isinstance(style, dict)}
    missing_categories = category_ids() - categories
    if missing_categories:
        add_issue(issues, "warning", "benchmark_categories", "benchmark.styles", f"Missing categories: {', '.join(sorted(missing_categories))}.")
    workflow_sections = {name for name in spec.get("workflow", []) if name in HARNESS_SECTIONS}
    if any(str(name).startswith("professor_review") for name in spec.get("workflow", [])):
        workflow_sections.add("review")
    if workflow_sections != set(HARNESS_SECTIONS):
        missing = set(HARNESS_SECTIONS) - workflow_sections
        add_issue(issues, "error", "workflow_gap", "generation-harness-v3.workflow", f"Harness workflow omits: {', '.join(sorted(missing))}.")
    return issues


def cmd_doctor(args: argparse.Namespace) -> int:
    issues = doctor_issues()
    print_report("Neo-SPC skill doctor", issues, args.json)
    if not args.json and not any(issue.level == "error" for issue in issues):
        benchmark = load_json(BENCHMARK_PATH)
        patches = load_json(FACTORY_MANIFEST_PATH)["patches"]
        print(f"  READY   {len(benchmark['styles'])} benchmark cues, {len(patches)} Factory Bank patches, {len(HARNESS_SECTIONS)} harness sections")
    counts = issue_counts(issues)
    return 1 if counts["errors"] or (args.strict and counts["warnings"]) else 0


def validate_catalog_path(path: Path) -> bool:
    try:
        issues = validate_catalog(load_json(path))
    except ValueError as exc:
        print(str(exc), file=sys.stderr)
        return False
    errors = [issue for issue in issues if issue.level == "error"]
    if errors:
        print_report(str(path), issues)
        return False
    return True


def run_script(script_name: str, arguments: list[str]) -> int:
    script = SCRIPTS / script_name
    result = subprocess.run([sys.executable, str(script), *arguments], check=False)
    return int(result.returncode)


def cmd_review(args: argparse.Namespace) -> int:
    if not validate_catalog_path(args.catalog):
        return 1
    args.output.parent.mkdir(parents=True, exist_ok=True)
    return run_script("professor_review.py", [str(args.catalog), str(args.output)])


def cmd_export_midi(args: argparse.Namespace) -> int:
    if not validate_catalog_path(args.catalog):
        return 1
    args.output.mkdir(parents=True, exist_ok=True)
    return run_script("export_midis_v4.py", [str(args.catalog), str(args.output)])


def cmd_audit_bank(args: argparse.Namespace) -> int:
    if not validate_catalog_path(args.catalog):
        return 1
    command = [str(args.catalog), str(args.manifest)]
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        command.extend(["--output", str(args.output)])
    code = run_script("audit_soundbank_assignments.py", command)
    if code == 0 and args.output and args.output.is_file():
        report = load_json(args.output)
        mapped = report.get("factory_mapped", "?")
        total = report.get("assignments", "?")
        print(f"READY Factory Bank audit: {mapped}/{total} assignments mapped, {report.get('warnings', '?')} warnings -> {args.output.resolve()}")
    return code


def cmd_render(args: argparse.Namespace) -> int:
    if not validate_catalog_path(args.catalog):
        return 1
    missing = render_dependency_issues()
    if missing:
        print(
            "Rendering is unavailable: " + "; ".join(missing)
            + ". Install Python extras with `python -m pip install -r requirements-render.txt` and make ffmpeg available on PATH, then retry.",
            file=sys.stderr,
        )
        return 2
    args.output.mkdir(parents=True, exist_ok=True)
    return run_script(
        "render_mix_v4.py",
        [str(args.catalog), str(args.sample_dir), str(args.calibration), str(args.output), "--workers", str(args.workers)]
        + (["--factory-dir", str(args.factory_dir)] if args.factory_dir else []),
    )


def render_dependency_issues() -> list[str]:
    missing: list[str] = []
    for module in ("numpy", "soundfile", "pyloudnorm", "scipy"):
        try:
            __import__(module)
        except ImportError:
            missing.append(f"missing Python module {module}")
    if shutil.which("ffmpeg") is None:
        missing.append("ffmpeg is not on PATH")
    return missing


def build_parser() -> argparse.ArgumentParser:
    brief_spec = load_json(HARNESS_SPEC_PATH)["sections"]["brief"]
    parser = argparse.ArgumentParser(
        prog="neospc",
        description="Initialize, compose, validate, review and export Neo-SPC composition projects.",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    doctor = sub.add_parser("doctor", help="Check bundled data, templates, schemas and benchmark integrity.")
    doctor.add_argument("--json", action="store_true", help="Emit machine-readable output.")
    doctor.add_argument("--strict", action="store_true", help="Treat warnings as failures.")
    doctor.set_defaults(func=cmd_doctor)

    init = sub.add_parser("init", help="Create a composition plan and full harness from a concrete brief.")
    init.add_argument("output", type=Path, help="Project directory to create or update.")
    init.add_argument("--title", required=True)
    init.add_argument("--id", help="Optional lowercase cue id. Defaults to a slug of the title.")
    init.add_argument("--category", choices=sorted(category_ids()), default="adventure")
    init.add_argument("--subcategory", default="custom")
    init.add_argument("--game-function", help="Free-text scene or gameplay use. Defaults to the game context.")
    init.add_argument("--game-context", choices=brief_spec["game_context"]["values"], default="exploration")
    init.add_argument("--mood", choices=brief_spec["mood_primary"]["values"], default="hopeful")
    init.add_argument("--thesis", help="Emotional change the cue must support. A concrete default is built from the brief.")
    init.add_argument("--bpm", type=int, default=None)
    init.add_argument("--meter", choices=("4/4", "3/4", "6/8", "9/8", "12/8", "5/4", "7/8", "5/8", "7/4"), default=None)
    init.add_argument("--key", choices=KEYS, default="G")
    init.add_argument("--mode", default="dorian")
    init.add_argument("--voices", type=int, choices=sorted(VOICE_PROFILES), default=16)
    init.add_argument("--bars", type=int, choices=(8, 12, 16, 20, 24, 32), default=16)
    init.add_argument("--energy", type=float, choices=None, default=0.55)
    init.add_argument("--tension", type=float, choices=None, default=0.35)
    init.add_argument("--seed", type=int, default=2207)
    init.add_argument("--force", action="store_true", help="Replace existing generated plan and harness files.")
    init.set_defaults(func=cmd_init)

    compose = sub.add_parser("compose", help="Create a deterministic score and one-cue catalog from a project plan and harness.")
    compose.add_argument("project", type=Path, help="Project directory containing composition-plan.json and generation-harness.json.")
    compose.add_argument("--force", action="store_true", help="Replace existing composition.json and catalog.json files.")
    compose.set_defaults(func=cmd_compose)

    validate = sub.add_parser("validate", help="Validate plans, harnesses, compositions or catalogs.")
    validate.add_argument("paths", nargs="+", type=Path)
    validate.add_argument("--kind", choices=("auto", "plan", "harness", "composition", "catalog"), default="auto")
    validate.add_argument("--json", action="store_true", help="Emit one JSON report per path.")
    validate.add_argument("--strict", action="store_true", help="Treat warnings as failures.")
    validate.set_defaults(func=cmd_validate)

    review = sub.add_parser("review", help="Run the deterministic symbolic score rubric on a catalog.")
    review.add_argument("catalog", type=Path)
    review.add_argument("output", type=Path)
    review.set_defaults(func=cmd_review)

    midi = sub.add_parser("export-midi", help="Export Type-1 MIDI plus an audit report.")
    midi.add_argument("catalog", type=Path)
    midi.add_argument("output", type=Path)
    midi.set_defaults(func=cmd_export_midi)

    bank = sub.add_parser("audit-bank", help="Check Factory Bank assignments and playable ranges.")
    bank.add_argument("catalog", type=Path)
    bank.add_argument("--manifest", type=Path, default=FACTORY_MANIFEST_PATH)
    bank.add_argument("--output", type=Path)
    bank.set_defaults(func=cmd_audit_bank)

    render = sub.add_parser("render", help="Render WAV, OGG and MP3 previews with the original sample bank.")
    render.add_argument("catalog", type=Path)
    render.add_argument("output", type=Path)
    render.add_argument("--sample-dir", type=Path, default=SAMPLE_DIR)
    render.add_argument("--calibration", type=Path, default=CALIBRATION_PATH)
    render.add_argument("--workers", type=int, default=4)
    render.add_argument("--factory-dir", type=Path, help="Complete multisample build directory; respects each score sound_palette.")
    render.set_defaults(func=cmd_render)

    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    if getattr(args, "energy", 0.5) < 0 or getattr(args, "energy", 0.5) > 1:
        print("--energy must be between 0 and 1.", file=sys.stderr)
        return 2
    if getattr(args, "tension", 0.5) < 0 or getattr(args, "tension", 0.5) > 1:
        print("--tension must be between 0 and 1.", file=sys.stderr)
        return 2
    if getattr(args, "id", None) and not re.fullmatch(r"[a-z0-9_]+", args.id):
        print("--id must use lowercase letters, digits and underscores.", file=sys.stderr)
        return 2
    return int(args.func(args))


if __name__ == "__main__":
    raise SystemExit(main())
