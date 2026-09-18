#!/usr/bin/env python3
"""Resolved sound plans, bank registry, SF2 inventory and render receipts.

Canonical JSON stays the score. MIDI, SPC/VGM, compact/multisample WAV and
SoundFonts are adapters. Instrument names only suggest; every substitution is
written into the plan and the receipt.
"""
from __future__ import annotations

import hashlib
import json
import math
import struct
import wave
from pathlib import Path
from typing import Any


VERSION = "1.0.0"
RENDER_ENGINE = "render_mix_v4"
SOUNDFONT_ENGINE = "fluidsynth"
SAMPLE_RATE = 32000
BACKENDS = ("compact", "multisample", "soundfont")
ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
REGISTRY_TEMPLATE = DATA / "bank-registry.template.json"
GM_PROGRAM_HINTS = {
    "bass": 33, "sub": 38, "contrabass": 43, "slap_bass": 36, "strings": 48,
    "violin1": 40, "violin2": 40, "viola": 41, "cello": 42, "choir_a": 52,
    "choir_b": 52, "choir_s": 53, "choir_t": 52, "organ": 19, "accordion": 21,
    "piano": 0, "harpsichord": 6, "vibes": 11, "bell": 14, "harp": 46,
    "guitar": 24, "muted_guitar": 28, "dist_guitar_l": 30, "dist_guitar_r": 30,
    "clav": 7, "flute": 73, "piccolo": 72, "ocarina": 79, "reed": 65,
    "clarinet": 71, "bassoon": 70, "horn": 60, "trumpet": 56, "trombone": 57,
    "brass": 61, "muted_brass": 59, "pulse25": 80, "pulse50": 80,
    "synth_lead": 81, "synth_pad": 88, "drone": 89, "prepared_piano": 2, "pizz": 45,
}
DRUM_HINTS = {
    "kick": True, "snare": True, "hat": True, "open_hat": True, "tom": True,
    "wood": True, "shaker": True, "rim": True, "ride": True, "impact": True,
    "brush": True, "clap": True,
}


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_json(value: Any) -> str:
    payload = json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True, allow_nan=False)
    return sha256_bytes(payload.encode("utf-8"))


def hash_file(path: Path | None) -> str | None:
    if path is None:
        return None
    resolved = Path(path)
    if not resolved.is_file():
        return None
    return sha256_bytes(resolved.read_bytes())


def hash_tree(path: Path | None) -> str | None:
    if path is None:
        return None
    resolved = Path(path)
    if resolved.is_file():
        return hash_file(resolved)
    if not resolved.is_dir():
        return None
    entries = []
    for child in sorted(resolved.rglob("*")):
        if child.is_file():
            rel = child.relative_to(resolved).as_posix()
            entries.append((rel, sha256_bytes(child.read_bytes())))
    return sha256_json(entries)


def load_json(path: Path) -> Any:
    return json.loads(Path(path).read_text(encoding="utf-8-sig"))


def dump_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, ensure_ascii=True) + "\n", encoding="utf-8", newline="\n")


def load_registry(path: Path | None = None) -> dict[str, Any]:
    source = Path(path) if path else REGISTRY_TEMPLATE
    data = load_json(source)
    validate_registry(data)
    return data


def validate_registry(data: Any) -> None:
    if not isinstance(data, dict) or not isinstance(data.get("banks"), list):
        raise ValueError("bank registry needs version and banks")
    seen: set[str] = set()
    for bank in data["banks"]:
        validate_bank_record(bank)
        ident = bank["id"]
        if ident in seen:
            raise ValueError(f"duplicate bank id {ident}")
        seen.add(ident)


def validate_bank_record(bank: Any) -> None:
    if not isinstance(bank, dict):
        raise ValueError("bank record must be an object")
    for field in ("id", "name", "format", "engine", "provenance", "license", "redistribution"):
        if not str(bank.get(field) or "").strip():
            raise ValueError(f"bank record missing {field}")
    presets = bank.get("presets")
    losses = bank.get("known_losses")
    if not isinstance(presets, list) or not isinstance(losses, list):
        raise ValueError("bank record needs presets and known_losses arrays")
    for preset in presets:
        if not isinstance(preset, dict):
            raise ValueError("preset must be an object")
        if not str(preset.get("name") or "").strip():
            raise ValueError("preset missing name")
        for key in ("bank", "program"):
            value = preset.get(key)
            if not isinstance(value, int) or isinstance(value, bool) or value < 0:
                raise ValueError(f"preset {preset.get('name')} has invalid {key}")
        if not isinstance(preset.get("percussion"), bool):
            raise ValueError(f"preset {preset.get('name')} needs percussion boolean")


def bank_by_id(registry: dict[str, Any], ident: str) -> dict[str, Any]:
    for bank in registry.get("banks") or []:
        if bank.get("id") == ident:
            return bank
    raise KeyError(f"unknown bank id {ident}")


def _riff_chunks(data: bytes, offset: int, end: int):
    while offset + 8 <= end:
        ident = data[offset:offset + 4]
        size = struct.unpack_from("<I", data, offset + 4)[0]
        payload = offset + 8
        yield ident, payload, size
        offset = payload + size + (size % 2)


def list_sf2_presets(path: Path) -> list[dict[str, Any]]:
    data = Path(path).read_bytes()
    if data[:4] != b"RIFF" or data[8:12] != b"sfbk":
        raise ValueError(f"{path} is not a SoundFont RIFF sfbk file")
    size = struct.unpack_from("<I", data, 4)[0]
    end = 8 + size
    phdr = b""
    for ident, payload, chunk_size in _riff_chunks(data, 12, end):
        if ident != b"LIST":
            continue
        kind = data[payload:payload + 4]
        if kind != b"pdta":
            continue
        for sub, sub_payload, sub_size in _riff_chunks(data, payload + 4, payload + chunk_size):
            if sub == b"phdr":
                phdr = data[sub_payload:sub_payload + sub_size]
    if len(phdr) < 38 * 2:
        raise ValueError(f"{path} has no pdta/phdr preset list")
    presets = []
    count = len(phdr) // 38
    for index in range(count - 1):
        raw = phdr[index * 38:(index + 1) * 38]
        name = raw[:20].split(b"\0", 1)[0].decode("ascii", "replace").strip() or f"preset_{index}"
        program, bank = struct.unpack_from("<HH", raw, 20)
        presets.append({
            "name": name,
            "bank": int(bank),
            "program": int(program),
            "percussion": int(bank) == 128,
            "lo_key": 0,
            "hi_key": 127,
        })
    if not presets:
        raise ValueError(f"{path} lists no usable presets")
    return presets


def inventory_from_sf2(path: Path, ident: str | None = None) -> dict[str, Any]:
    resolved = Path(path)
    presets = list_sf2_presets(resolved)
    digest = hash_file(resolved)
    return {
        "id": ident or f"sf2-{digest[:12] if digest else resolved.stem}",
        "name": resolved.name,
        "hash": digest,
        "path": str(resolved),
        "format": "sf2",
        "engine": SOUNDFONT_ENGINE,
        "provenance": "operator-supplied local SoundFont; not redistributed by this skill",
        "license": "operator must confirm before any copy or package step",
        "redistribution": "never package .sf2/.sf3/.dls or private-banks/",
        "presets": presets,
        "known_losses": [
            "SF2 layers, modulators and exclusive classes are not rewritten into the canonical score",
            "FluidSynth and SpessaSynth can yield different PCM from the same SF2",
            "unlooped percussion is not given an artificial loop",
        ],
    }


def _pad_even(payload: bytes) -> bytes:
    return payload if len(payload) % 2 == 0 else payload + b"\0"


def _chunk(ident: bytes, payload: bytes) -> bytes:
    return ident + struct.pack("<I", len(payload)) + _pad_even(payload)


def _zname(text: str, width: int) -> bytes:
    raw = text.encode("ascii", "replace")[: width - 1] + b"\0"
    return raw.ljust(width, b"\0")


def write_fixture_sf2(path: Path) -> Path:
    """Tiny legal SF2: looped sine (bank 0/program 0) and unlooped noise drum (bank 128/program 0)."""
    rate = 22050
    sine = [int(16000 * math.sin(2 * math.pi * i / 64)) for i in range(256)]
    noise = []
    seed = 2463534242
    for _ in range(128):
        seed = (seed ^ (seed << 13)) & 0xFFFFFFFF
        seed = (seed ^ (seed >> 17)) & 0xFFFFFFFF
        seed = (seed ^ (seed << 5)) & 0xFFFFFFFF
        noise.append(int(((seed & 0xFFFF) / 65535) * 24000 - 12000))
    pad = [0] * 46
    samples = sine + pad + noise + pad
    smpl = b"".join(struct.pack("<h", max(-32767, min(32767, value))) for value in samples)
    sine_end = len(sine)
    noise_start = sine_end + 46
    noise_end = noise_start + len(noise)

    info = (
        _chunk(b"ifil", struct.pack("<HH", 2, 1))
        + _chunk(b"isng", b"EMU8000\0")
        + _chunk(b"INAM", b"fixture\0")
    )
    sdta = _chunk(b"smpl", smpl)
    phdr = (
        _zname("Tone", 20) + struct.pack("<HHHIII", 0, 0, 0, 0, 0, 0)
        + _zname("Kit", 20) + struct.pack("<HHHIII", 0, 128, 1, 0, 0, 0)
        + _zname("EOP", 20) + struct.pack("<HHHIII", 0, 0, 2, 0, 0, 0)
    )
    pbag = struct.pack("<HHHHHH", 0, 0, 1, 0, 2, 0)
    pmod = struct.pack("<HHHHH", 0, 0, 0, 0, 0)
    pgen = struct.pack("<HHHHHH", 41, 0, 41, 1, 0, 0)
    inst = (
        _zname("Tone", 20) + struct.pack("<H", 0)
        + _zname("Kit", 20) + struct.pack("<H", 1)
        + _zname("EOI", 20) + struct.pack("<H", 2)
    )
    ibag = struct.pack("<HHHHHH", 0, 0, 3, 0, 5, 0)
    imod = struct.pack("<HHHHH", 0, 0, 0, 0, 0)
    igen = struct.pack(
        "<HHHHHHHHHHHH",
        43, 127 << 8,
        54, 1,
        53, 0,
        43, 127 << 8,
        53, 1,
        0, 0,
    )
    shdr = (
        _zname("sine", 20)
        + struct.pack("<IIIIIBbHH", 0, sine_end, 32, 224, rate, 60, 0, 0, 1)
        + _zname("noise", 20)
        + struct.pack("<IIIIIBbHH", noise_start, noise_end, noise_start, noise_start + 8, rate, 60, 0, 0, 1)
        + _zname("EOS", 20)
        + struct.pack("<IIIIIBbHH", 0, 0, 0, 0, 0, 0, 0, 0, 0)
    )
    pdta = (
        _chunk(b"phdr", phdr)
        + _chunk(b"pbag", pbag)
        + _chunk(b"pmod", pmod)
        + _chunk(b"pgen", pgen)
        + _chunk(b"inst", inst)
        + _chunk(b"ibag", ibag)
        + _chunk(b"imod", imod)
        + _chunk(b"igen", igen)
        + _chunk(b"shdr", shdr)
    )
    body = _chunk(b"LIST", b"INFO" + info) + _chunk(b"LIST", b"sdta" + sdta) + _chunk(b"LIST", b"pdta" + pdta)
    dest = Path(path)
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(b"RIFF" + struct.pack("<I", 4 + len(body)) + b"sfbk" + body)
    return dest


def load_map(path: Path | None) -> dict[str, Any]:
    if path is None:
        return {}
    data = load_json(path)
    if isinstance(data, dict) and isinstance(data.get("instruments"), dict):
        data = data["instruments"]
    if not isinstance(data, dict):
        raise ValueError("instrument map must be an object of inst -> {bank, program}")
    return data


def _preset_match(presets: list[dict[str, Any]], bank: int, program: int) -> dict[str, Any] | None:
    for preset in presets:
        if int(preset["bank"]) == bank and int(preset["program"]) == program:
            return preset
    return None


def suggest_assignment(inst: str, info: dict[str, Any], inventory: dict[str, Any]) -> dict[str, Any]:
    percussion = bool(DRUM_HINTS.get(inst) or info.get("family") == "drums" or info.get("kind") == "drum")
    presets = inventory.get("presets") or []
    if percussion:
        kit = next((row for row in presets if row.get("percussion")), None)
        if kit:
            return {**kit, "suggested": True}
        raise KeyError(f"no percussion preset in bank {inventory.get('id')} for {inst}")
    hinted = GM_PROGRAM_HINTS.get(inst, GM_PROGRAM_HINTS.get(str(info.get("family") or ""), 0))
    match = _preset_match(presets, 0, hinted) or next((row for row in presets if not row.get("percussion")), None)
    if not match:
        raise KeyError(f"no tonal preset in bank {inventory.get('id')} for {inst}")
    return {**match, "suggested": True}


def resolve_track_assignment(
    inst: str,
    info: dict[str, Any],
    inventory: dict[str, Any],
    mapping: dict[str, Any],
    *,
    allow_fallback: bool,
) -> tuple[dict[str, Any], list[str]]:
    notes: list[str] = []
    override = mapping.get(inst)
    presets = inventory.get("presets") or []
    if override:
        bank = int(override.get("bank", 0))
        program = int(override.get("program", 0))
        found = _preset_match(presets, bank, program)
        if found is None:
            if presets and not allow_fallback:
                raise KeyError(f"{inst} map {bank}:{program} is not in bank {inventory.get('id')}")
            found = {
                "name": str(override.get("name") or inst),
                "bank": bank,
                "program": program,
                "percussion": bool(override.get("percussion", bank == 128)),
            }
            notes.append(f"{inst}: mapped {bank}:{program} is not in the inspected preset list")
        percussion = bool(override.get("percussion", found.get("percussion")))
        return {
            "name": str(override.get("name") or found.get("name") or inst),
            "bank": int(found["bank"]),
            "program": int(found["program"]),
            "percussion": percussion,
            "suggested": False,
        }, notes
    if not presets:
        program = GM_PROGRAM_HINTS.get(inst, GM_PROGRAM_HINTS.get(str(info.get("family") or ""), 0))
        percussion = bool(DRUM_HINTS.get(inst))
        notes.append(f"{inst}: GM program {program} is a hint only; bank has no inspected presets")
        return {
            "name": inst,
            "bank": 128 if percussion else 0,
            "program": 0 if percussion else program,
            "percussion": percussion,
            "suggested": True,
        }, notes
    try:
        found = suggest_assignment(inst, info, inventory)
        notes.append(f"{inst}: assigned {found['bank']}:{found['program']} ({found['name']}) from inventory")
        return found, notes
    except KeyError as exc:
        if not allow_fallback:
            raise
        notes.append(str(exc) + "; fallback GM hint")
        program = GM_PROGRAM_HINTS.get(inst, 0)
        percussion = bool(DRUM_HINTS.get(inst))
        return {
            "name": inst,
            "bank": 128 if percussion else 0,
            "program": 0 if percussion else program,
            "percussion": percussion,
            "suggested": True,
        }, notes


def score_digest(style: dict[str, Any]) -> str:
    payload = {
        "id": style.get("id"),
        "bpm": style.get("bpm"),
        "meter": style.get("meter"),
        "beats": style.get("beats"),
        "events": style.get("events"),
        "instrument_map": style.get("instrument_map"),
        "sound_palette": style.get("sound_palette"),
        "track_mix": style.get("track_mix"),
        "mix": style.get("mix"),
        "mix_v3": style.get("mix_v3", style.get("mix_v2")),
    }
    return sha256_json(payload)


def role_collapse(style: dict[str, Any], assignments: dict[str, Any]) -> dict[str, Any]:
    roles = sorted({str(event.get("role") or "support") for event in style.get("events") or []})
    presets = sorted({
        f"{row.get('bank')}:{row.get('program')}:{row.get('name')}"
        for row in assignments.values()
    })
    return {
        "requested_roles": len(roles),
        "roles": roles,
        "effective_presets": len(presets),
        "presets": presets,
    }


def resolve_plan(
    style: dict[str, Any],
    inventory: dict[str, Any],
    mapping: dict[str, Any] | None = None,
    *,
    backend: str = "soundfont",
    allow_fallback: bool = False,
) -> dict[str, Any]:
    mapping = mapping or {}
    tracks = []
    substitutions: list[str] = []
    assignments: dict[str, Any] = {}
    lanes = sorted({str(event.get("inst")) for event in style.get("events") or [] if event.get("inst")})
    instrument_map = style.get("instrument_map") or {}
    for inst in lanes:
        events = [event for event in style["events"] if event.get("inst") == inst]
        role = max(
            {str(event.get("role") or "support") for event in events},
            key=lambda name: sum(1 for event in events if str(event.get("role") or "support") == name),
        )
        info = instrument_map.get(inst) or {}
        assignment, notes = resolve_track_assignment(inst, info, inventory, mapping, allow_fallback=allow_fallback)
        substitutions.extend(notes)
        assignments[inst] = assignment
        tracks.append({
            "inst": inst,
            "role": role,
            "source": {
                "bank_id": inventory.get("id"),
                "preset": assignment.get("name"),
                "bank": assignment.get("bank"),
                "program": assignment.get("program"),
                "percussion": assignment.get("percussion"),
            },
            "interpretation": {
                "gate": "score duration; unlooped percussion is not given an artificial loop",
                "cc": "CC7/CC10/CC11 from the MIDI adapter when that adapter runs",
            },
            "constraints": {
                "console_voices": "console writers keep their own budgets; an SF2 never enters an SPC",
            },
        })
    return {
        "version": VERSION,
        "backend": backend,
        "bank": {
            "id": inventory.get("id"),
            "name": inventory.get("name"),
            "hash": inventory.get("hash"),
            "format": inventory.get("format"),
            "engine": inventory.get("engine"),
        },
        "score_id": style.get("id"),
        "score_digest": score_digest(style),
        "tracks": tracks,
        "substitutions": substitutions,
        "role_collapse": role_collapse(style, assignments),
        "allow_fallback": allow_fallback,
        "listening_approval": "pending",
    }


def fingerprint_fields(
    style: dict[str, Any],
    *,
    backend: str,
    bank_id: str,
    bank_hash: str | None,
    engine: str,
    engine_version: str,
    effects: dict[str, Any],
    sample_rate: int,
    map_hash: str | None = None,
    sound_plan_hash: str | None = None,
) -> dict[str, Any]:
    return {
        "score": score_digest(style),
        "map": map_hash,
        "bank_id": bank_id,
        "bank_hash": bank_hash,
        "backend": backend,
        "engine": engine,
        "engine_version": engine_version,
        "effects": effects,
        "sample_rate": sample_rate,
        "sound_plan": sound_plan_hash,
    }


def fingerprint_digest(fields: dict[str, Any]) -> str:
    return sha256_json(fields)


def receipt_path(outdir: Path, style_id: str) -> Path:
    return Path(outdir) / f"{style_id}.receipt.json"


def load_receipt(path: Path) -> dict[str, Any] | None:
    resolved = Path(path)
    if not resolved.is_file():
        return None
    try:
        data = load_json(resolved)
    except (OSError, ValueError, json.JSONDecodeError):
        return None
    return data if isinstance(data, dict) else None


def write_receipt(path: Path, receipt: dict[str, Any]) -> None:
    dump_json(path, receipt)


def receipt_matches(receipt: dict[str, Any] | None, digest: str) -> bool:
    return bool(receipt) and receipt.get("fingerprint") == digest


def should_skip_outputs(outdir: Path, style_id: str, digest: str, required: tuple[str, ...] = (".ogg", ".mp3")) -> bool:
    folder = Path(outdir)
    if not all((folder / f"{style_id}{suffix}").is_file() for suffix in required):
        return False
    return receipt_matches(load_receipt(receipt_path(folder, style_id)), digest)


def resolve_backend(
    requested: str | None,
    *,
    factory_dir: Path | None,
    sound_plan: Path | None,
    bank: str | None,
    allow_fallback: bool,
) -> tuple[str, str, str | None]:
    if requested in BACKENDS:
        backend = requested
    elif sound_plan or (bank and str(bank).endswith((".sf2", ".sf3"))):
        backend = "soundfont"
    elif factory_dir:
        backend = "multisample"
    else:
        backend = "compact"
    fallback = None
    if backend == "multisample":
        if factory_dir is None or not Path(factory_dir).is_dir():
            if not allow_fallback:
                raise FileNotFoundError(
                    f"requested Factory Bank directory is missing ({factory_dir}); "
                    "pass --allow-fallback to render compact and annotate the receipt"
                )
            fallback = f"requested factory-dir {factory_dir} missing; using compact"
            backend = "compact"
    if backend == "soundfont":
        if bank and Path(bank).is_file():
            return backend, Path(bank).name, fallback
        if sound_plan:
            return backend, "sound-plan", fallback
        if not allow_fallback:
            raise FileNotFoundError(
                "soundfont backend needs --bank PATH.sf2 or --sound-plan; "
                "pass --allow-fallback to render compact and annotate the receipt"
            )
        fallback = "soundfont requested without a local SF2; using compact"
        backend = "compact"
    bank_id = "factory-chamber" if backend == "multisample" else "compact"
    return backend, bank_id, fallback


def plan_from_catalog(
    catalog: dict[str, Any],
    inventory: dict[str, Any],
    mapping: dict[str, Any] | None = None,
    *,
    backend: str = "soundfont",
    allow_fallback: bool = False,
) -> dict[str, Any]:
    styles = catalog.get("styles") or []
    if not isinstance(styles, list) or not styles:
        raise ValueError("catalog needs a styles array")
    cues = [
        resolve_plan(style, inventory, mapping, backend=backend, allow_fallback=allow_fallback)
        for style in styles
        if isinstance(style, dict)
    ]
    return {
        "version": VERSION,
        "backend": backend,
        "bank": cues[0]["bank"] if cues else inventory,
        "cues": cues,
        "allow_fallback": allow_fallback,
        "listening_approval": "pending",
    }


def track_assignment(plan: dict[str, Any], inst: str) -> dict[str, Any] | None:
    cues = plan.get("cues")
    tracks = plan.get("tracks")
    if tracks is None and isinstance(cues, list) and cues:
        tracks = cues[0].get("tracks")
    for row in tracks or []:
        if row.get("inst") == inst:
            return row.get("source")
    return None


def write_silence_wav(path: Path, seconds: float = 0.05, sample_rate: int = SAMPLE_RATE) -> None:
    frames = max(1, int(seconds * sample_rate))
    with wave.open(str(path), "w") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(sample_rate)
        handle.writeframes(b"\x00\x00" * frames)


def build_receipt(
    style: dict[str, Any],
    fields: dict[str, Any],
    *,
    skipped: bool,
    outputs: list[str],
    fallback: str | None,
    extras: dict[str, Any] | None = None,
) -> dict[str, Any]:
    receipt = {
        "version": 1,
        "id": style.get("id"),
        "fingerprint": fingerprint_digest(fields),
        "fingerprint_fields": fields,
        "backend": fields.get("backend"),
        "bank_id": fields.get("bank_id"),
        "bank_hash": fields.get("bank_hash"),
        "fallback": fallback,
        "skipped": skipped,
        "outputs": outputs,
        "listening_approval": "pending",
        "engine": fields.get("engine"),
        "engine_version": fields.get("engine_version"),
        "sample_rate": fields.get("sample_rate"),
        "effects": fields.get("effects"),
    }
    if extras:
        receipt.update(extras)
    return receipt
