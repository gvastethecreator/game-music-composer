"""Instrumental groove writers for Studio genre packs.
These are finite sketches, not a claim to cover a tradition.
No source songs or sampled drum breaks are used. Percussion is synthesized.
"""
from __future__ import annotations

import copy
import math
from types import SimpleNamespace

import generate_neospc100_v3 as core

VERSION = "2.0.0"
GENRES = {
    "bachata", "trip_hop", "trap", "reggaeton",
    "salsa", "cumbia", "bossa_nova", "funk", "house", "dnb",
    "synthwave", "lofi", "metal", "tango",
}
STRICT_FOUR_FOUR = GENRES - {"metal"}


def compose(spec, category, label):
    from phrase_composer import compose as phrase, fit

    w = spec["writing"]
    genre = w["grammar"]
    if genre not in GENRES:
        raise ValueError("Unsupported genre grammar")
    if genre in STRICT_FOUR_FOUR and spec["meter"] != "4/4":
        raise ValueError("These genre blueprints use a four-quarter bar")
    if genre == "metal" and spec["meter"] not in {"4/4", "7/8"}:
        raise ValueError("Metal blueprints use 4/4 or 7/8")
    reduction = copy.deepcopy(spec)
    reduction["writing"]["grammar"] = "arp"
    reduction["writing"]["percussion"] = False
    reduction["writing"]["answer_role"] = None
    score = phrase(reduction, category, label)
    lead, harmony, bass = w["roles"]
    events = [e for e in score["events"] if e["role"] == "lead"]
    bl = core.METERS[spec["meter"]]
    total = score["beats"]
    v = w["variant"]
    chords = score["chord_plan"]
    sections = score["form"]
    bps = spec["bpm"] / 60
    swing = w.get("swing", 0)
    bass_steps = w["bass_pattern"]
    harmony_steps = w["comp_pattern"]
    kicks = w["kick_pattern"]

    def place(beat, lane):
        barpos = beat % bl
        if genre in {"trip_hop", "lofi"} and abs(barpos * 2 - round(barpos * 2)) < 1e-5 and round(barpos * 2) % 2:
            beat += swing * 0.5
        delay_ms = 16 if genre == "trip_hop" and lane in ("snare", "rim") else -3 if genre == "bachata" and lane == harmony else 8 if genre == "lofi" and lane in ("snare", "hat") else 0
        return round(max(0, min(total - 0.002, beat + delay_ms * bps / 1000)), 5)

    def note(lane, pitch, beat, dur, role, vel=80, pan=0):
        if beat >= total:
            return
        pitch = fit(pitch, lane)
        dur = min(dur, total - beat)
        event = core.event_note(lane, pitch, beat, dur, 0.05 if role == "lead" else 0.028, pan, 0.08, role, velocity=vel)
        event.update(
            velocity_norm=round(vel / 127, 4),
            velocity_gain=round((vel / 100) ** 1.3, 4),
            performance_beat=place(beat, lane),
            performance_duration=round(dur * 0.93, 5),
            attack=0.004,
            release=0.10 if genre in {"trap", "reggaeton", "dnb", "metal"} else 0.16,
        )
        events.append(event)
        return event

    def drum(lane, beat, vel=80, pan=0, midi=None, cents=0):
        if beat >= total:
            return
        event = core.event_drum(lane, beat, 0.047, pan, 0.025, velocity=vel)
        event.update(velocity_norm=round(vel / 127, 4), velocity_gain=round((vel / 100) ** 1.3, 4), performance_beat=place(beat, lane))
        if midi is not None:
            event["midi"] = midi
        if cents:
            event["tuning_cents"] = cents
        events.append(event)

    for e in events:
        e["performance_beat"] = place(e["beat"], lead)
        e["velocity"] = max(55, e["velocity"] - (7 if genre in {"trip_hop", "lofi"} else 0))
        e["velocity_gain"] = round((e["velocity"] / 100) ** 1.3, 4)

    drop_bars = set(w["drop_bars"])
    events[:] = [e for e in events if int(math.floor(e["beat"] / bl + 1e-9)) not in drop_bars]
    ctx = SimpleNamespace(
        note=note, drum=drum, fit=fit, w=w, genre=genre, v=v, bl=bl, lead=lead, harmony=harmony, bass=bass,
        bass_steps=bass_steps, harmony_steps=harmony_steps, kicks=kicks, spec=spec, events=events,
    )
    writer = WRITERS[genre]
    for sec in sections:
        start = sec["start_bar"]
        length = sec["bars"]
        contrast = sec["name"] == "B"
        for j in range(length):
            bar = start + j
            off = bar * bl
            closing = j == length - 1
            root = chords[bar]["root_pc"]
            pcs = chords[bar]["pcs"]
            thin = bar in drop_bars or (contrast and j % 2 == 1)
            center = 60 if genre in {"bachata", "salsa", "cumbia", "tango"} else 56
            voiced = sorted(min((n for n in range(center - 7, center + 13) if n % 12 == pc), key=lambda n: abs(n - center)) for pc in pcs)
            if len(voiced) > 3 and genre not in {"trip_hop", "lofi"}:
                voiced = voiced[:3]
            writer(ctx, bar, off, j, closing, root, voiced, thin, contrast, chords)

    if genre == "bachata":
        scale = core.MODES[spec["mode"]]
        tonic = core.NOTE_PC[spec["key"]]
        for sec in sections:
            bar = sec["start_bar"] + sec["bars"] - 1
            for k, d in enumerate(w["answer"][-4:]):
                pitch = 60 + tonic + scale[d % len(scale)] + 12 * (d // len(scale))
                note(lead, pitch, bar * bl + 2 + k * 0.375, 0.28, "lead", 76 + k * 3, 0.15)
    for e in events:
        if e["kind"] == "note":
            e["duration"] = min(e["duration"], total - e["beat"])
            if "performance_duration" in e:
                e["performance_duration"] = min(e["performance_duration"], total - e.get("performance_beat", e["beat"]))
    events.sort(key=lambda e: (e["beat"], e.get("midi", 0)))
    score["events"] = events
    score["arrangement_rests"] = core.apply_written_rests(events, spec, bl)
    for e in events:
        if e["kind"] == "note" and "performance_duration" in e:
            e["performance_duration"] = min(e["performance_duration"], e["duration"], total - e.get("performance_beat", e["beat"]))
    used = list(dict.fromkeys(e["inst"] for e in events))
    score["instrument_map"] = {
        x: {
            "sample": core.INSTRUMENTS[x][0].replace(".wav", ""),
            "file": core.INSTRUMENTS[x][0],
            "root_midi": core.INSTRUMENTS[x][1],
            "label": x.replace("_", " ").title(),
            "color": core.INSTRUMENTS[x][2],
            "family": core.INSTRUMENTS[x][4],
        }
        for x in used
    }
    if genre == "bachata":
        score["instrument_map"]["guitar"]["label"] = "Requinto · synth"
        score["instrument_map"]["muted_guitar"]["label"] = "Segunda · synth"
        score["instrument_map"]["tom"]["label"] = "Bongos · synth"
        score["instrument_map"]["shaker"]["label"] = "Scraper · synth"
    elif genre == "salsa":
        score["instrument_map"].setdefault("tom", {})["label"] = "Conga · synth"
        if "tom" in score["instrument_map"]:
            score["instrument_map"]["tom"]["label"] = "Conga · synth"
        if "wood" in score["instrument_map"]:
            score["instrument_map"]["wood"]["label"] = "Campana · synth"
    elif genre == "cumbia":
        if "shaker" in score["instrument_map"]:
            score["instrument_map"]["shaker"]["label"] = "Guira model · synth"
        if "accordion" in score["instrument_map"]:
            score["instrument_map"]["accordion"]["label"] = "Accordion · sketch"
    elif genre == "tango":
        if "accordion" in score["instrument_map"]:
            score["instrument_map"]["accordion"]["label"] = "Bandoneon stand-in · synth"
    elif genre == "metal":
        if "dist_guitar_l" in score["instrument_map"]:
            score["instrument_map"]["dist_guitar_l"]["label"] = "Palm-mute guitar · synth"
    score["writing_evidence"].update(engine="genre-composer-" + VERSION, grammar=genre, drop_bars=sorted(drop_bars), variant=v, swing=swing)
    score["dna"].update(texture=genre, texture_b=genre + " breakdown", bass=genre + " bass", drums=genre + " percussion")
    score["measured_peak_voices"] = core.peak_polyphony(events, total)
    quiet = genre in {"bachata", "trip_hop", "lofi", "bossa_nova", "tango"}
    score["mix_v3"].update(target_lufs=-17 if quiet else -16, lead_duck_db=0.7, kick_bass_duck_db=1.2)
    score["mix"].update(echo_time=0.28 if genre in {"trip_hop", "lofi"} else 0.16, echo_feedback=0.22 if genre in {"trip_hop", "lofi"} else 0.10)
    return score


def write_bachata(ctx, bar, off, j, closing, root, voiced, thin, contrast, chords):
    for k, pos in enumerate(ctx.harmony_steps):
        if thin and k % 2:
            continue
        pitches = voiced[-2:] if k % 2 else voiced[:2]
        for st, pitch in enumerate(pitches):
            ctx.note(ctx.harmony, pitch, off + pos + st * 0.018, 0.20, "comp", 62 + 9 * (k % 2), -0.25)
    for k, pos in enumerate(ctx.bass_steps):
        next_pos = ctx.bass_steps[k + 1] if k + 1 < len(ctx.bass_steps) else 4
        ctx.note(ctx.bass, 36 + root + (7 if k == 1 else 0), off + pos, min(0.75, next_pos - pos - 0.04), "bass", 83 if k == 0 else 76)
    for k, pos in enumerate((0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5)):
        if thin and k % 2:
            continue
        low = k in (3, 7)
        ctx.drum("tom", off + pos, 72 if low else 51 + (k % 3) * 6, 0.16, 61 if low else 60, 0 if low else 500)
        ctx.drum("shaker", off + pos, 61 if k % 2 == 0 else 43, -0.30)
    if not thin and closing:
        for k in range(3):
            ctx.drum("tom", off + 3.5 + k / 6, 68 + k * 5, 0.16, 60, 500)


def write_trip_hop(ctx, bar, off, j, closing, root, voiced, thin, contrast, chords):
    if j % 2 == 0 or chords[bar]["symbol"] != chords[bar - 1]["symbol"]:
        hold = 5.9 if not closing and bar + 1 < len(chords) and chords[bar + 1]["symbol"] == chords[bar]["symbol"] else 3.65
        for pitch in voiced:
            ctx.note(ctx.harmony, pitch, off + 0.125, hold, "support", 61, -0.28)
    for k, pos in enumerate(ctx.bass_steps):
        ctx.note(ctx.bass, 36 + root + (7 if k % 3 == 2 else 0), off + pos, 1.1 if k == 0 else 0.55, "bass", 87 - 6 * (k % 2))
    if not thin:
        for pos in ctx.kicks:
            ctx.drum("kick", off + pos, 91 if pos == 0 else 73)
        for pos in (1, 3):
            ctx.drum("snare", off + pos, 87 if pos == 3 else 80)
        if bar % 2:
            ctx.drum("snare", off + 2.75, 36)
        for k in range(8):
            if (k + ctx.v) % 8 == 6:
                continue
            ctx.drum("hat", off + k * 0.5, 52 if k % 2 == 0 else 37, 0.22)
        if closing:
            ctx.drum("open_hat", off + 3.5, 47, 0.18)


def write_trap(ctx, bar, off, j, closing, root, voiced, thin, contrast, chords):
    if j % 2 == 0:
        for pitch in voiced[-2:]:
            ctx.note(ctx.harmony, pitch + 12, off + 0.25, 2.5, "support", 51, -0.25)
    for k, pos in enumerate(ctx.bass_steps):
        next_pos = ctx.bass_steps[k + 1] if k + 1 < len(ctx.bass_steps) else 4
        pitch = 24 + root + (12 if closing and k == len(ctx.bass_steps) - 1 else 0)
        ctx.note(ctx.bass, pitch, off + pos, max(0.1, next_pos - pos - 0.08), "bass", 96 - 8 * (k % 2))
    if not thin:
        for pos in ctx.kicks:
            ctx.drum("kick", off + pos, 96 if pos == 0 else 81)
        ctx.drum("snare", off + 2, 94)
        for k in range(8):
            if k == 7 and bar % 2:
                continue
            ctx.drum("hat", off + k * 0.5, 54 if k % 2 == 0 else 39, 0.18)
        if bar % 2:
            division = 3 if ctx.v % 2 else 4
            for k in range(division):
                ctx.drum("hat", off + 3.5 + k * 0.5 / division, 64 - k * 6, (-0.12 if k % 2 else 0.18))
        if closing:
            ctx.drum("open_hat", off + 1.5, 61, -0.13)


def write_reggaeton(ctx, bar, off, j, closing, root, voiced, thin, contrast, chords):
    for k, pos in enumerate(ctx.harmony_steps):
        if thin and k > 0:
            continue
        for pitch in voiced[-2:]:
            ctx.note(ctx.harmony, pitch, off + pos, 0.25 if not contrast else 0.48, "comp", 65, -0.24)
    for k, pos in enumerate(ctx.bass_steps):
        ctx.note(ctx.bass, 36 + root + (7 if ctx.v % 3 == 1 and k == 2 else 0), off + pos, 0.65 if k == 0 else 0.35, "bass", 91 - k * 3)
    if not thin:
        for pos in ctx.kicks:
            ctx.drum("kick", off + pos, 95 if pos in (0, 2) else 72)
        for pos in (0.75, 1.5, 2.75, 3.5):
            ctx.drum("snare", off + pos, 84 if pos % 2 == 1.5 else 77)
        for k in range(8):
            ctx.drum("hat", off + k * 0.5, 47 if k % 2 else 58, 0.20)
        if ctx.v % 2:
            ctx.drum("rim", off + 3.75, 52, -0.18)
        if closing and ctx.v % 3 == 0:
            for pos in (3.5, 3.75):
                ctx.drum("tom", off + pos, 64, 0.25)


def write_salsa(ctx, bar, off, j, closing, root, voiced, thin, contrast, chords):
    for k, pos in enumerate(ctx.harmony_steps):
        if thin and k % 2:
            continue
        pitches = voiced[:2] if k % 2 == 0 else voiced[-2:]
        for st, pitch in enumerate(pitches):
            ctx.note(ctx.harmony, pitch + 12, off + pos + st * 0.02, 0.22, "comp", 64 + 8 * (k % 2), -0.22)
    for k, pos in enumerate(ctx.bass_steps):
        next_pos = ctx.bass_steps[k + 1] if k + 1 < len(ctx.bass_steps) else ctx.bl
        ctx.note(ctx.bass, 36 + root + (5 if k == 1 else 0), off + pos, min(0.7, next_pos - pos - 0.04), "bass", 86 if k == 0 else 74)
    if not thin:
        for pos in (0, 0.75, 1.5, 2.5, 3.5):
            ctx.drum("wood", off + pos, 78 if pos in (0, 2.5) else 62, 0.12)
        for k, pos in enumerate((0, 0.5, 1.5, 2, 3, 3.5)):
            ctx.drum("tom", off + pos, 70 if k % 2 == 0 else 54, 0.18, 61 if k % 3 == 0 else 60)
        if closing:
            ctx.drum("wood", off + 3.75, 84, 0.08)


def write_cumbia(ctx, bar, off, j, closing, root, voiced, thin, contrast, chords):
    hold = 0.9 if not thin else 1.6
    if not thin or j % 2 == 0:
        for pitch in voiced[:2]:
            ctx.note(ctx.harmony, pitch, off, hold, "comp", 70, -0.18)
    for k, pos in enumerate(ctx.bass_steps):
        ctx.note(ctx.bass, 36 + root, off + pos, 0.85 if k == 0 else 0.55, "bass", 88 if k == 0 else 76)
    if not thin:
        for pos in ctx.kicks or (0, 2):
            ctx.drum("kick", off + pos, 90 if pos == 0 else 74)
        for pos in (0.5, 1.5, 2.5, 3.5):
            ctx.drum("shaker", off + pos, 66 if pos % 1 == 0.5 else 48, -0.28)
        if closing:
            ctx.drum("rim", off + 3.5, 70, 0.1)


def write_bossa(ctx, bar, off, j, closing, root, voiced, thin, contrast, chords):
    for k, pos in enumerate(ctx.harmony_steps):
        if thin and k > 1:
            continue
        for pitch in voiced[:2]:
            ctx.note(ctx.harmony, pitch, off + pos, 0.28, "comp", 60, -0.20)
    for k, pos in enumerate(ctx.bass_steps):
        ctx.note(ctx.bass, 36 + root + (7 if k % 2 else 0), off + pos, 0.7 if k == 0 else 0.4, "bass", 80)
    if not thin:
        ctx.drum("rim", off + 1, 72, 0.08)
        ctx.drum("rim", off + 2.5, 64, -0.08)
        for pos in (0.5, 1.5, 2.5, 3.5):
            ctx.drum("shaker", off + pos, 44, 0.22)


def write_funk(ctx, bar, off, j, closing, root, voiced, thin, contrast, chords):
    for k, pos in enumerate(ctx.harmony_steps):
        if thin and k % 2:
            continue
        ctx.note(ctx.harmony, voiced[k % len(voiced)], off + pos, 0.12, "comp", 68, -0.16)
    for k, pos in enumerate(ctx.bass_steps):
        next_pos = ctx.bass_steps[k + 1] if k + 1 < len(ctx.bass_steps) else ctx.bl
        ctx.note(ctx.bass, 36 + root + (12 if k == 2 else 0), off + pos, min(0.35, next_pos - pos - 0.02), "bass", 92 if k == 0 else 78)
    if not thin:
        ctx.drum("snare", off + 1, 90)
        ctx.drum("snare", off + 3, 86)
        for pos in ctx.kicks or (0, 2.5):
            ctx.drum("kick", off + pos, 88 if pos == 0 else 70)
        for k in range(16):
            if thin and k % 2:
                continue
            ctx.drum("hat", off + k * 0.25, 58 if k % 4 == 0 else 40, 0.18)


def write_house(ctx, bar, off, j, closing, root, voiced, thin, contrast, chords):
    if not thin:
        for pitch in voiced[:2]:
            ctx.note(ctx.harmony, pitch, off, 3.6, "support", 52, -0.30)
    for k, pos in enumerate(ctx.bass_steps):
        ctx.note(ctx.bass, 36 + root, off + pos, 1.4, "bass", 90)
    if not thin:
        for pos in (0, 1, 2, 3):
            ctx.drum("kick", off + pos, 96 if pos == 0 else 88)
        for pos in (0.5, 1.5, 2.5, 3.5):
            ctx.drum("hat", off + pos, 70, 0.16)
        if closing:
            ctx.drum("open_hat", off + 3.5, 62, 0.1)


def write_dnb(ctx, bar, off, j, closing, root, voiced, thin, contrast, chords):
    if j % 2 == 0:
        for pitch in voiced[:2]:
            ctx.note(ctx.harmony, pitch, off, 1.8, "support", 48, -0.32)
    ctx.note(ctx.bass, 24 + root, off, 3.6, "bass", 94)
    if not thin:
        for pos in ctx.kicks or (0, 0.75, 1.75, 2.5):
            ctx.drum("kick", off + pos, 93 if pos == 0 else 76)
        ctx.drum("snare", off + 1, 92)
        ctx.drum("snare", off + 3, 90)
        for k in range(8):
            ctx.drum("hat", off + k * 0.5, 56 if k % 2 == 0 else 38, 0.14)


def write_synthwave(ctx, bar, off, j, closing, root, voiced, thin, contrast, chords):
    if not thin:
        for pitch in voiced:
            ctx.note(ctx.harmony, pitch, off, 3.7, "support", 50, -0.34)
    ctx.note(ctx.bass, 36 + root, off, 1.9, "bass", 88)
    ctx.note(ctx.bass, 48 + root, off + 2, 1.8, "bass", 80)
    if not thin:
        ctx.drum("kick", off, 92)
        ctx.drum("kick", off + 2, 84)
        ctx.drum("snare", off + 1, 88)
        ctx.drum("snare", off + 3, 84)
        for k in range(8):
            ctx.drum("hat", off + k * 0.5, 48, 0.2)


def write_lofi(ctx, bar, off, j, closing, root, voiced, thin, contrast, chords):
    if j % 2 == 0 or chords[bar]["symbol"] != chords[bar - 1]["symbol"]:
        for pitch in voiced[:2]:
            ctx.note(ctx.harmony, pitch, off + 0.08, 3.4, "support", 58, -0.26)
    for k, pos in enumerate(ctx.bass_steps):
        ctx.note(ctx.bass, 36 + root, off + pos, 0.9, "bass", 78)
    if not thin:
        ctx.drum("kick", off, 86)
        ctx.drum("kick", off + 2.5, 70)
        ctx.drum("snare", off + 1, 80)
        ctx.drum("snare", off + 2.75, 42)
        for k in range(8):
            if (k + ctx.v) % 5 == 3:
                continue
            ctx.drum("hat", off + k * 0.5, 46 if k % 2 else 34, 0.24)


def write_metal(ctx, bar, off, j, closing, root, voiced, thin, contrast, chords):
    step = 0.25
    count = int(ctx.bl / step)
    if not thin:
        for k in range(count):
            pitch = 40 + root + (0 if k % 4 else 7)
            ctx.note(ctx.harmony, pitch, off + k * step, 0.18, "comp", 82 if k % 2 == 0 else 70, -0.12)
    for k, pos in enumerate(ctx.bass_steps):
        ctx.note(ctx.bass, 28 + root, off + pos, 0.4, "bass", 94)
    if not thin:
        if ctx.v % 2 or ctx.bl == 3.5:
            pattern = (0, 0.5, 1.0, 1.5, 2.0, 2.5) if ctx.bl >= 3.5 else (0, 0.5, 1, 2, 2.5, 3)
            for pos in pattern:
                if pos < ctx.bl - 1e-6:
                    ctx.drum("kick", off + pos, 90 if pos == 0 else 76)
        else:
            ctx.drum("kick", off, 92)
            ctx.drum("kick", off + 2, 84)
        snare_at = (1.5,) if ctx.bl == 3.5 else (1, 3)
        for pos in snare_at:
            if pos < ctx.bl - 1e-6:
                ctx.drum("snare", off + pos, 92)
        if closing:
            ctx.drum("tom", off + ctx.bl - 0.5, 80, 0.2)


def write_tango(ctx, bar, off, j, closing, root, voiced, thin, contrast, chords):
    if not thin or j % 2 == 0:
        for pitch in voiced[:2]:
            ctx.note(ctx.harmony, pitch, off, 1.4, "comp", 68, -0.14)
    for k, pos in enumerate(ctx.bass_steps):
        ctx.note(ctx.bass, 36 + root, off + pos, 0.45 if k else 0.7, "bass", 88 if k == 0 else 74)
    if not thin:
        ctx.drum("kick", off, 80)
        ctx.drum("rim", off + 1.5, 70, 0.06)
        ctx.drum("kick", off + 2, 72)
        if closing:
            ctx.drum("wood", off + 3.5, 66, 0.1)


WRITERS = {
    "bachata": write_bachata,
    "trip_hop": write_trip_hop,
    "trap": write_trap,
    "reggaeton": write_reggaeton,
    "salsa": write_salsa,
    "cumbia": write_cumbia,
    "bossa_nova": write_bossa,
    "funk": write_funk,
    "house": write_house,
    "dnb": write_dnb,
    "synthwave": write_synthwave,
    "lofi": write_lofi,
    "metal": write_metal,
    "tango": write_tango,
}
