#!/usr/bin/env python3
"""Dry FluidSynth render from a resolved sound plan. No Neo-SPC bus mix."""
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path

import export_midis_v4
import sound_plan


def fluidsynth_version() -> str | None:
    binary = shutil.which("fluidsynth")
    if not binary:
        return None
    result = subprocess.run([binary, "--version"], capture_output=True, text=True, check=False)
    text = (result.stdout or result.stderr or "").strip().splitlines()
    return text[0] if text else binary


def render_cue(style: dict, outdir: Path, sf2: Path, plan: dict, *, adapt_ports: bool, sample_rate: int) -> dict:
    midi_dir = outdir / "midi"
    export_midis_v4.export(style, midi_dir, sound_plan=plan, adapt_ports=adapt_ports)
    midi_path = midi_dir / f"{style['id']}.mid"
    wav = outdir / f"{style['id']}.wav"
    command = [
        shutil.which("fluidsynth"),
        "-ni",
        "-F", str(wav),
        "-r", str(sample_rate),
        "-R", "0",
        "-C", "0",
        str(sf2),
        str(midi_path),
    ]
    result = subprocess.run(command, capture_output=True, text=True, check=False)
    if result.returncode:
        raise RuntimeError("FluidSynth failed: " + (result.stderr or result.stdout or "")[-2000:])
    ffmpeg = shutil.which("ffmpeg")
    outputs = [wav.name, midi_path.name]
    if ffmpeg:
        ogg = outdir / f"{style['id']}.ogg"
        mp3 = outdir / f"{style['id']}.mp3"
        subprocess.run([ffmpeg, "-y", "-loglevel", "error", "-i", str(wav), "-c:a", "libvorbis", "-q:a", "5", str(ogg)], check=True)
        subprocess.run([ffmpeg, "-y", "-loglevel", "error", "-i", str(wav), "-c:a", "libmp3lame", "-q:a", "4", str(mp3)], check=True)
        outputs.extend([ogg.name, mp3.name])
    return {"id": style["id"], "outputs": outputs, "midi": str(midi_path)}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("catalog", type=Path)
    parser.add_argument("outdir", type=Path)
    parser.add_argument("--bank", type=Path, help="Local SF2. Never packaged with the skill.")
    parser.add_argument("--sound-plan", type=Path)
    parser.add_argument("--map", type=Path)
    parser.add_argument("--adapt-ports", action="store_true")
    parser.add_argument("--allow-fallback", action="store_true")
    parser.add_argument("--sample-rate", type=int, default=32000)
    args = parser.parse_args()
    if shutil.which("fluidsynth") is None:
        print("fluidsynth is not on PATH; soundfont render is optional.", file=sys.stderr)
        return 2
    if args.bank is None or not args.bank.is_file():
        print("soundfont render needs an existing --bank PATH.sf2", file=sys.stderr)
        return 2
    catalog = json.loads(args.catalog.read_text(encoding="utf-8-sig"))
    inventory = sound_plan.inventory_from_sf2(args.bank)
    mapping = sound_plan.load_map(args.map)
    plan = json.loads(args.sound_plan.read_text(encoding="utf-8-sig")) if args.sound_plan else sound_plan.plan_from_catalog(
        catalog, inventory, mapping, backend="soundfont", allow_fallback=args.allow_fallback
    )
    args.outdir.mkdir(parents=True, exist_ok=True)
    version = fluidsynth_version()
    effects = {"chorus": 0, "reverb": 0, "bus_mix": False}
    reports = []
    for style in catalog["styles"]:
        cue_plan = sound_plan.resolve_plan(style, inventory, mapping, backend="soundfont", allow_fallback=args.allow_fallback)
        fields = sound_plan.fingerprint_fields(
            style,
            backend="soundfont",
            bank_id=inventory["id"],
            bank_hash=inventory.get("hash"),
            engine=sound_plan.SOUNDFONT_ENGINE,
            engine_version=version or "fluidsynth",
            effects=effects,
            sample_rate=args.sample_rate,
            map_hash=sound_plan.hash_file(args.map),
            sound_plan_hash=sound_plan.hash_file(args.sound_plan) or sound_plan.sha256_json(plan),
        )
        digest = sound_plan.fingerprint_digest(fields)
        wav = args.outdir / f"{style['id']}.wav"
        if sound_plan.should_skip_outputs(args.outdir, style["id"], digest, required=(".wav",)):
            reports.append({"id": style["id"], "skipped": True, "bank_id": inventory["id"]})
            continue
        rendered = render_cue(style, args.outdir, args.bank, cue_plan, adapt_ports=args.adapt_ports, sample_rate=args.sample_rate)
        receipt = sound_plan.build_receipt(
            style,
            fields,
            skipped=False,
            outputs=rendered["outputs"],
            fallback=None,
            extras={
                "fluidsynth_version": version,
                "role_collapse": cue_plan["role_collapse"],
                "midi": Path(rendered["midi"]).name,
            },
        )
        sound_plan.write_receipt(sound_plan.receipt_path(args.outdir, style["id"]), receipt)
        reports.append({"id": style["id"], "skipped": False, "bank_id": inventory["id"], "role_collapse": cue_plan["role_collapse"]})
        print(style["id"], "soundfont", cue_plan["role_collapse"]["requested_roles"], "->", cue_plan["role_collapse"]["effective_presets"], flush=True)
        del digest, wav
    summary = {
        "version": 1,
        "backend": "soundfont",
        "bank_id": inventory["id"],
        "bank_hash": inventory.get("hash"),
        "fluidsynth_version": version,
        "effects": effects,
        "sample_rate": args.sample_rate,
        "cues": reports,
        "listening_approval": "pending",
        "parity_note": "The same SF2 through FluidSynth and SpessaSynth is not the same PCM.",
    }
    (args.outdir / "render-receipt.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    print("exported", len(reports))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
