#!/usr/bin/env python3
"""Turn a validated Neo-SPC plan and harness into one deterministic score."""
from __future__ import annotations

import copy
import hashlib
import json
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

import generate_neospc100_v3 as engine


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"

MODE_ALIASES = {"major": "ionian", "minor": "aeolian"}
MOTIF_BY_CONTOUR = {
    "arch": ("arch", "heroic", "sigh"),
    "ascending": ("rising_fourth", "heroic", "pentatonic"),
    "descending": ("falling_third", "lament", "sigh"),
    "wave": ("floating", "noir", "modal_call"),
    "terrace": ("chant", "modal_call", "mechanical"),
    "narrow": ("minimal_cell", "step_answer", "chant"),
    "angular": ("chromatic_warning", "mechanical", "sync_hook"),
    "call_response": ("step_answer", "modal_call", "fugue_subject"),
}
MOTIF_BY_PRESET = {
    "up3": "rising_fourth", "up4": "heroic", "down3": "falling_third",
    "down4": "lament", "updown": "arch", "osc1": "floating",
    "osc2": "noir", "repeat1": "minimal_cell", "repeat2": "mechanical",
    "sequence": "fugue_subject", "pedal": "chant", "neighbor": "step_answer",
}
ENSEMBLE_COMP = {
    "compact_band": ("sparse_chords", "minimal_pulse", "pizz_ostinato"),
    "folk_ensemble": ("guitar_pattern", "harp_broken", "pizz_ostinato"),
    "rock_band": ("guitar_riff", "strings_motor", "mechanical_comp"),
    "jazz_combo": ("jazz_shells", "swing_comp", "bossa_comp"),
    "chamber": ("string_quartet", "orchestral_broken", "two_voice_counterpoint"),
    "orchestra": ("orchestral_swell", "strings_motor", "full_orchestra"),
    "choir_orchestra": ("chorale", "processional", "prophecy_fields"),
    "electronic_stack": ("synth_arp", "electro_stabs", "minimal_phase"),
    "hybrid": ("orchestral_swell", "synth_arp", "dark_orchestra"),
}
GROOVE_COMP = {
    "bossa": "bossa_comp", "tango": "tango_comp", "one_drop": "reggae_skank",
    "funk": "funk_comp", "breakbeat": "breakbeat_pulse", "motor": "minimal_pulse",
    "ritual": "ritual_ostinato", "floating": "floating_chords", "waltz": "damaged_waltz",
}
BASS_PRESETS = {
    "root": "pedal", "root5": "root_fifth", "octave": "ostinato",
    "walk4": "walking", "anticipate": "pedal_walk", "dorian_funk": "syncopated",
    "reggae": "root_fifth", "bossa": "melodic", "synth_ostinato": "synth_ostinato",
}
BASS_FAMILIES = {
    "upright": "root_fifth", "finger": "melodic", "picked": "syncopated",
    "analog": "synth_ostinato", "sub": "pedal", "bowed": "descending",
}
DRUM_KITS = {
    "acoustic": "rock", "brush": "brush_jazz", "electronic": "electro_battle",
    "industrial": "industrial", "ritual": "ritual", "orchestral": "orchestral",
    "toy": "toy", "minimal": "ambient_sparse",
}
DRUM_GROOVES = {
    "bossa": "bossa", "samba": "festival", "tango": "tango", "one_drop": "reggae",
    "funk": "slow_groove", "breakbeat": "dnb", "motor": "electronic_light",
    "ritual": "ritual", "floating": "ambient_sparse", "waltz": "waltz",
}
SECONDARY = {"strings": "violin1"}

FACTORY_FALLBACKS = {
    "flute": "winds.flute", "piccolo": "winds.flute", "ocarina": "winds.ocarina",
    "reed": "winds.oboe", "bassoon": "winds.clarinet", "clarinet": "winds.clarinet",
    "muted_brass": "brass.muted", "horn": "brass.french_horn", "trumpet": "brass.trumpet",
    "trombone": "brass.ensemble", "brass": "brass.ensemble", "violin1": "strings.bright",
    "violin2": "strings.bright", "viola": "strings.soft", "cello": "strings.cello",
    "contrabass": "bass.bowed_contrabass", "strings": "strings.soft", "choir_s": "choir.ah",
    "choir_a": "choir.ah", "choir_t": "choir.oo", "choir_b": "choir.oo",
    "drone": "texture.dark_drone", "organ": "keys.electric_piano", "accordion": "keys.electric_piano",
    "harp": "plucks.harp", "pizz": "strings.pizzicato", "piano": "keys.lofi_piano",
    "prepared_piano": "keys.lofi_piano", "harpsichord": "keys.harpsichord", "vibes": "mallets.vibraphone",
    "bell": "synth.fm_bell", "guitar": "plucks.dulcimer", "muted_guitar": "plucks.dulcimer",
    "dist_guitar_l": "synth.saw_lead", "dist_guitar_r": "synth.saw_lead", "bass": "bass.upright_soft",
    "synth_bass": "bass.analog_round", "slap_bass": "bass.slap", "triangle_bass": "bass.sub_sine",
    "clav": "keys.harpsichord", "pulse25": "chip.pulse25", "pulse50": "chip.pulse50",
    "synth_pad": "synth.glass_pad", "synth_lead": "synth.saw_lead", "sub": "bass.sub_sine",
    "kick": "drums.kick_deep", "snare": "drums.snare_body", "hat": "drums.hat_closed",
    "open_hat": "drums.hat_open", "tom": "drums.tom_low", "wood": "drums.rim",
    "rim": "drums.rim", "shaker": "drums.shaker", "ride": "drums.hat_open",
    "impact": "drums.kick_punch", "brush": "drums.shaker",
}


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def choose(options: tuple[str, ...], seed: int, slot: str) -> str:
    digest = hashlib.sha256(f"{seed}:{slot}".encode("utf-8")).digest()
    return options[int.from_bytes(digest[:4], "big") % len(options)]


def choose_comp_b(comp: str, seed: int, ensemble_profile: str) -> str:
    alt = engine.COMP_ANSWER.get(comp)
    if alt and alt != comp:
        return alt
    options = tuple(item for item in ENSEMBLE_COMP.get(ensemble_profile, ()) if item != comp)
    if options:
        return choose(options, seed, "comp_b")
    return comp


def category_labels() -> dict[str, str]:
    data = load_json(DATA / "category-benchmark-contracts.json")
    return {item["id"]: item["label"] for item in data["categories"]}


def input_mismatches(plan: dict[str, Any], harness: dict[str, Any]) -> list[str]:
    identity = plan["musical_identity"]
    expected_mode = MODE_ALIASES.get(str(identity["mode"]), str(identity["mode"]))
    pairs = (
        ("category", plan["category"], harness["brief"]["category"]),
        ("voice budget", plan["voice_budget"], harness["brief"]["voice_budget"]),
        ("loop bars", sum(section["bars"] for section in plan["form"]), harness["brief"]["loop_bars"]),
        ("meter", identity["meter"], harness["rhythm"]["meter"]),
        ("key", engine.NOTE_PC[identity["key"]], harness["harmony"]["key"]),
        ("mode", expected_mode, harness["harmony"]["scale_id"]),
    )
    return [f"{name} differs between composition-plan.json ({left}) and generation-harness.json ({right})" for name, left, right in pairs if left != right]


def benchmark_factory_map() -> dict[str, str]:
    benchmark = load_json(DATA / "neospc100-benchmark-v4.1.json")
    choices: dict[str, Counter[str]] = defaultdict(Counter)
    for style in benchmark["styles"]:
        for inst, info in style.get("instrument_map", {}).items():
            if info.get("factory_patch"):
                choices[inst][info["factory_patch"]] += 1
    return {inst: counts.most_common(1)[0][0] for inst, counts in choices.items()}


def apply_factory_assignments(style: dict[str, Any]) -> None:
    exact = benchmark_factory_map()
    manifest = load_json(DATA / "factory-bank-manifest.json")
    patches = {patch["id"]: patch for patch in manifest["patches"]}
    for inst, info in style["instrument_map"].items():
        patch_id = exact.get(inst, FACTORY_FALLBACKS.get(inst))
        if not patch_id or patch_id not in patches:
            continue
        patch = patches[patch_id]
        info.update({
            "factory_patch": patch_id,
            "factory_label": patch["label"],
            "factory_profile": "neo16",
            "factory_source": "benchmark_consensus" if inst in exact else "role_fallback",
        })


def event_span(event: dict[str, Any]) -> float:
    if event.get("kind") == "drum":
        return .12
    return max(.04, float(event.get("performance_duration", event.get("duration", .2))))


def first_overflow(events: list[dict[str, Any]], total: float, budget: int) -> set[int]:
    points: list[tuple[float, int, int]] = []
    for index, event in enumerate(events):
        start = float(event.get("performance_beat", event.get("beat", 0))) % total
        end = start + event_span(event)
        spans = ((start, end),) if end <= total else ((start, total), (0, end - total))
        for left, right in spans:
            points.extend(((left, 1, index), (right, -1, index)))
    active: set[int] = set()
    for _, delta, index in sorted(points, key=lambda item: (item[0], item[1])):
        if delta < 0:
            active.discard(index)
        else:
            active.add(index)
            if len(active) > budget:
                return active
    return set()


def enforce_voice_budget(style: dict[str, Any], budget: int) -> int:
    removed = 0
    rank = {"ensemble": 0, "pad": 0, "support": 1, "texture": 1, "arp": 2, "comp": 2, "pulse": 2, "motor": 2, "ostinato": 2, "counter": 3, "riff": 3, "lead": 9, "bass": 8}
    while True:
        overflow = first_overflow(style["events"], float(style["beats"]), budget)
        if not overflow:
            break
        victim = min(
            overflow,
            key=lambda index: (
                rank.get(style["events"][index].get("role", ""), 4),
                float(style["events"][index].get("gain", 0)) * float(style["events"][index].get("performance_gain", 1)),
            ),
        )
        style["events"].pop(victim)
        removed += 1
    style["measured_peak_voices"] = engine.peak_polyphony(style["events"], float(style["beats"]))
    used = {event["inst"] for event in style["events"]}
    style["instrument_map"] = {inst: info for inst, info in style["instrument_map"].items() if inst in used}
    return removed


def build_spec(plan: dict[str, Any], harness: dict[str, Any]) -> dict[str, Any]:
    seed = int(harness["brief"]["seed"])
    harmony = harness["harmony"]
    scale = next(item for item in load_json(DATA / "scale-library.json")["scales"] if item["id"] == harmony["scale_id"])
    progression = next(item for item in load_json(DATA / "chord-progression-library.json")["progressions"] if item["id"] == harmony["progression_id"])
    engine.MODES[scale["id"]] = list(scale["intervals"])
    engine.PROGRESSIONS[progression["id"]] = list(progression["roman"])
    melody = harness["melody"]
    motif = MOTIF_BY_PRESET.get(melody["motif_preset"])
    if not motif:
        motif = choose(MOTIF_BY_CONTOUR[melody["contour"]], seed, "motif")
    orchestration = harness["orchestration"]
    if harness["counterpoint"]["enabled"]:
        comp = "four_voice_fugue" if harness["form"]["architecture"] == "fugue" else choose(("two_voice_counterpoint", "string_quartet"), seed, "counterpoint")
    else:
        comp = GROOVE_COMP.get(harness["rhythm"]["groove_template"])
        if not comp:
            comp = choose(ENSEMBLE_COMP[orchestration["ensemble_profile"]], seed, "ensemble")
        if not harness["arp"]["enabled"] and comp in {"harp_broken", "orchestral_broken", "synth_arp"}:
            comp = "sparse_chords"
    bass = BASS_PRESETS.get(harness["bassline"]["preset"], BASS_FAMILIES[harness["bassline"]["family"]])
    if not harness["drums"]["enabled"]:
        drums = "none"
    elif harness["brief"]["game_context"] == "boss":
        drums = "boss"
    else:
        drums = DRUM_GROOVES.get(harness["rhythm"]["groove_template"], DRUM_KITS[harness["drums"]["kit"]])
    identity = plan["musical_identity"]
    return {
        "slug": plan["id"], "title": plan["title"], "subcategory": plan["subcategory"],
        "bpm": identity["bpm"], "meter": identity["meter"], "bars": harness["brief"]["loop_bars"],
        "key": identity["key"], "mode": scale["id"], "budget": plan["voice_budget"],
        "prog": progression["id"], "motif": motif, "lead": orchestration["primary_lead"],
        "secondary": SECONDARY.get(orchestration["secondary_lead"], orchestration["secondary_lead"]) if orchestration["secondary_lead"] != "none" else None,
        "comp": comp, "comp_b": choose_comp_b(comp, seed, orchestration["ensemble_profile"]),
        "bass": bass, "drums": drums, "form": copy.deepcopy(plan["form"]),
        "energy": harness["brief"]["energy"], "tension": harness["brief"]["tension"],
        "architecture": harness["form"]["architecture"],
        "rest_ratio": melody.get("rest_ratio", 0.22),
        "contour": melody.get("contour", "arch"),
        "tessitura": melody.get("tessitura", 0.55),
        "range_semitones": melody.get("range_semitones", 16),
        "melody_density": melody.get("density", 0.46),
        "max_leap": melody.get("max_leap", 9),
        "stepwise_weight": melody.get("stepwise_weight", 0.66),
        "chord_tone_weight": melody.get("chord_tone_weight", 0.74),
        "pickup_probability": melody.get("pickup_probability", 0.38),
        "sequence_rate": melody.get("sequence_rate", 0.22),
        "motif_transformation": melody.get("motif_transformation", 0.48),
        "tags": ["from-scratch", harness["brief"]["game_context"], harness["brief"]["mood_primary"]],
        "notes": plan["emotional_thesis"], "seed": seed,
    }


def compose_project(plan: dict[str, Any], harness: dict[str, Any], blueprint: dict[str, Any] | None = None) -> tuple[dict[str, Any], dict[str, Any]]:
    mismatches = input_mismatches(plan, harness)
    if mismatches:
        raise ValueError("Project inputs disagree: " + "; ".join(mismatches) + ". Update one source, then validate and compose again.")
    spec = build_spec(plan, harness)
    if blueprint is not None:
        spec["writing"] = copy.deepcopy(blueprint)
        spec["comp"] = blueprint["grammar"]
        spec["comp_b"] = blueprint["grammar"] + "_reduced"
        spec["loop_strategy"] = "Resolve the final phrase and leave a written breath into the opening."
        spec["role_rests"] = []
    labels = category_labels()
    style = engine.compose(spec, plan["category"], labels[plan["category"]])
    removed = enforce_voice_budget(style, int(plan["voice_budget"]))
    apply_factory_assignments(style)
    if blueprint and blueprint.get("patch_overrides"):
        patches = {p["id"]: p for p in json.loads((DATA / "factory-bank-manifest.json").read_text(encoding="utf-8"))["patches"]}
        for inst, patch in blueprint["patch_overrides"].items():
            if inst in style["instrument_map"]:
                style["instrument_map"][inst].update(factory_patch=patch, factory_label=patches[patch]["label"], factory_profile="neo16", factory_source="genre_blueprint")
    style["source_type"] = "generated_local"
    style["generation"] = {
        "workflow": "plan+harness+score-blueprint" if blueprint else "plan+harness-v1", "engine": style.get("writing_evidence", {}).get("engine", "neospc-v3"), "seed": spec["seed"],
        "scale_id": spec["mode"], "progression_id": spec["prog"], "motif": spec["motif"],
        "texture": spec["comp"], "texture_b": spec.get("comp_b"), "bass": spec["bass"], "drums": spec["drums"],
        "architecture": spec.get("architecture"), "contour": spec.get("contour"),
        "tessitura": spec.get("tessitura"), "max_leap": spec.get("max_leap"),
        "trimmed_events_for_voice_budget": removed,
    }
    catalog = {
        "version": "1.0.0-local", "project": plan["title"],
        "voice_model": {"profiles": [8, 12, 16, 24, 32], "selected": plan["voice_budget"]},
        "categories": [{"id": plan["category"], "label": labels[plan["category"]], "count": 1}],
        "styles": [style],
    }
    return style, catalog
