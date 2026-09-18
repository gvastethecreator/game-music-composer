from __future__ import annotations

import json
import shutil
import struct
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPTS = Path(__file__).resolve().parents[1]
SKILL = SCRIPTS.parent
sys.path.insert(0, str(SCRIPTS))

import export_midis_v4  # noqa: E402
import package_skill  # noqa: E402
import sound_plan  # noqa: E402


def _cue():
    return {
        "id": "probe",
        "title": "Probe",
        "category": "mystery",
        "bpm": 120,
        "meter": "4/4",
        "barLength": 4,
        "beats": 4,
        "events": [
            {"inst": "piano", "role": "lead", "kind": "note", "midi": 60, "beat": 0, "duration": 1, "velocity": 90},
            {"inst": "kick", "role": "kick", "kind": "drum", "midi": 36, "beat": 0, "duration": 0.2, "velocity": 100},
        ],
        "instrument_map": {
            "piano": {"family": "keys", "kind": "note"},
            "kick": {"family": "drums", "kind": "drum"},
        },
    }


class SoundBackendTests(unittest.TestCase):
    def test_registry_template_validates(self):
        registry = sound_plan.load_registry()
        self.assertEqual(registry["banks"][0]["id"], "compact")
        self.assertEqual(sound_plan.bank_by_id(registry, "factory-chamber")["format"], "wav-multisample")

    def test_inspect_generated_sf2_lists_tone_and_kit(self):
        with tempfile.TemporaryDirectory() as temp:
            path = sound_plan.write_fixture_sf2(Path(temp) / "fixture.sf2")
            presets = sound_plan.list_sf2_presets(path)
        names = {(row["name"], row["bank"], row["program"], row["percussion"]) for row in presets}
        self.assertIn(("Tone", 0, 0, False), names)
        self.assertIn(("Kit", 128, 0, True), names)

    def test_non_gm_map_is_explicit_and_missing_preset_errors(self):
        style = _cue()
        with tempfile.TemporaryDirectory() as temp:
            inventory = sound_plan.inventory_from_sf2(sound_plan.write_fixture_sf2(Path(temp) / "f.sf2"))
        mapping = {"piano": {"bank": 3, "program": 17}}
        with self.assertRaisesRegex(KeyError, "3:17"):
            sound_plan.resolve_plan(style, inventory, mapping, allow_fallback=False)
        plan = sound_plan.resolve_plan(style, inventory, mapping, allow_fallback=True)
        piano = next(row for row in plan["tracks"] if row["inst"] == "piano")
        self.assertEqual(piano["source"]["bank"], 3)
        self.assertEqual(piano["source"]["program"], 17)
        self.assertTrue(any("3:17" in note for note in plan["substitutions"]))

    def test_midi_writes_bank_msb_lsb_and_program_from_plan(self):
        style = _cue()
        inventory = {"id": "custom", "presets": [{"name": "Toy", "bank": 3, "program": 17, "percussion": False}]}
        mapping = {"piano": {"bank": 3, "program": 17}, "kick": {"bank": 128, "program": 0, "percussion": True}}
        plan = sound_plan.resolve_plan(style, inventory, mapping, allow_fallback=True)
        with tempfile.TemporaryDirectory() as temp:
            report = export_midis_v4.export(style, Path(temp), sound_plan=plan)
            data = (Path(temp) / "probe.mid").read_bytes()
        piano = next(row for row in report["lanes"] if row["inst"] == "piano")
        kick = next(row for row in report["lanes"] if row["inst"] == "kick")
        self.assertEqual((piano["bank"], piano["program"], piano["channel"]), (3, 17, 0))
        self.assertEqual(kick["channel"], 9)
        self.assertIn(b"\xb0\x00\x03", data)
        self.assertIn(b"\xb0\x20\x00", data)
        self.assertIn(b"\xc0\x11", data)

    def test_non_gm_percussion_stays_off_channel_10(self):
        style = _cue()
        inventory = {"id": "kit", "presets": [{"name": "ToyDrum", "bank": 5, "program": 2, "percussion": True}]}
        mapping = {"kick": {"bank": 5, "program": 2, "percussion": True}}
        plan = sound_plan.resolve_plan(style, inventory, mapping, allow_fallback=True)
        with tempfile.TemporaryDirectory() as temp:
            report = export_midis_v4.export(style, Path(temp), sound_plan=plan)
        kick = next(row for row in report["lanes"] if row["inst"] == "kick")
        self.assertNotEqual(kick["channel"], 9)
        self.assertEqual((kick["bank"], kick["program"]), (5, 2))

    def test_multi_port_with_plan_is_rejected_unless_adapted(self):
        style = {
            "id": "many_lanes",
            "title": "Many",
            "category": "classical",
            "bpm": 120,
            "meter": "4/4",
            "barLength": 4,
            "beats": 4,
            "events": [
                {"inst": f"lane_{i:02}", "role": "lead", "kind": "note", "midi": 60, "beat": 0, "duration": 1, "velocity": 90}
                for i in range(16)
            ],
        }
        plan = sound_plan.resolve_plan(style, {"id": "compact", "presets": []}, allow_fallback=True)
        with tempfile.TemporaryDirectory() as temp:
            with self.assertRaisesRegex(ValueError, "multi-port"):
                export_midis_v4.export(style, Path(temp), sound_plan=plan)
            with self.assertRaisesRegex(ValueError, "cannot adapt"):
                export_midis_v4.export(style, Path(temp), sound_plan=plan, adapt_ports=True)

    def test_receipt_fingerprint_changes_with_bank_or_score(self):
        style = _cue()
        fields = sound_plan.fingerprint_fields(
            style,
            backend="compact",
            bank_id="compact",
            bank_hash="aaa",
            engine="render_mix_v4",
            engine_version="1.0.0",
            effects={"chorus": 0, "reverb": 0},
            sample_rate=32000,
        )
        digest = sound_plan.fingerprint_digest(fields)
        other_bank = dict(fields)
        other_bank["bank_hash"] = "bbb"
        other_score = dict(fields)
        mutated = dict(style)
        mutated["events"] = list(style["events"]) + [dict(style["events"][0], beat=1)]
        other_score["score"] = sound_plan.score_digest(mutated)
        self.assertNotEqual(digest, sound_plan.fingerprint_digest(other_bank))
        self.assertNotEqual(digest, sound_plan.fingerprint_digest(other_score))
        with tempfile.TemporaryDirectory() as temp:
            out = Path(temp)
            (out / "probe.ogg").write_bytes(b"ogg")
            (out / "probe.mp3").write_bytes(b"mp3")
            sound_plan.write_receipt(
                sound_plan.receipt_path(out, "probe"),
                sound_plan.build_receipt(style, fields, skipped=False, outputs=["probe.ogg"], fallback=None),
            )
            self.assertTrue(sound_plan.should_skip_outputs(out, "probe", digest))
            self.assertFalse(sound_plan.should_skip_outputs(out, "probe", sound_plan.fingerprint_digest(other_bank)))

    def test_missing_soundfont_errors_without_allow_fallback(self):
        with self.assertRaises(FileNotFoundError):
            sound_plan.resolve_backend("soundfont", factory_dir=None, sound_plan=None, bank=None, allow_fallback=False)
        backend, bank_id, fallback = sound_plan.resolve_backend(
            "soundfont", factory_dir=None, sound_plan=None, bank=None, allow_fallback=True
        )
        self.assertEqual(backend, "compact")
        self.assertEqual(bank_id, "compact")
        self.assertIn("compact", fallback)

    def test_fluidsynth_optional_skips_without_binary(self):
        if shutil.which("fluidsynth"):
            import render_soundfont

            version = render_soundfont.fluidsynth_version()
            self.assertTrue(version)
            return
        self.skipTest("fluidsynth is not on PATH; soundfont render is optional")

    def test_package_skips_soundfonts_and_private_banks(self):
        self.assertIn(".sf2", package_skill.SKIP_SUFFIXES)
        self.assertIn(".sf3", package_skill.SKIP_SUFFIXES)
        self.assertIn(".dls", package_skill.SKIP_SUFFIXES)
        self.assertIn("private-banks", package_skill.SKIP_DIRS)
        self.assertIn("spessasynth", package_skill.SKIP_DIRS)
        names = [path.suffix.lower() for path in package_skill.source_files()]
        self.assertNotIn(".sf2", names)

    def test_atelier_bundles_soundfont_engine_without_cdn(self):
        from visualize_score import JS_ORDER

        self.assertIn("soundfont-engine.js", JS_ORDER)
        text = (SKILL / "resources" / "ensemble-atelier" / "soundfont-engine.js").read_text(encoding="utf-8")
        self.assertNotIn("http://", text)
        self.assertNotIn("https://", text)

    def test_console_nes_and_snes_overflow_and_filter_zero(self):
        try:
            import numpy as np
            import console_soundpack as console
        except ImportError:
            self.skipTest("Optional audio dependencies are not installed")
        pulse = [dict(preset="pulse", midi=60, time=0, duration=0.4, velocity=90) for _ in range(2)]
        self.assertEqual(len(console.timeline(pulse, "nes")), 4)
        with self.assertRaisesRegex(ValueError, "voice budget exceeded"):
            console.timeline(pulse + [dict(pulse[0])], "nes")
        with self.assertRaisesRegex(ValueError, "voice budget exceeded"):
            notes = [dict(preset="flute", midi=60, time=0, duration=0.4, velocity=90) for _ in range(9)]
            console.timeline(notes, "snes")
        with self.assertRaisesRegex(ValueError, "filter-zero"):
            console.encode_brr(np.zeros(16, dtype=np.float32), False, 1)
        data = console.nes_vgm(pulse[:1] + [dict(preset="triangle", midi=48, time=0, duration=0.4, velocity=80)])
        self.assertEqual(data[:4], b"Vgm ")
        self.assertEqual(struct.unpack_from("<I", data, 0x84)[0], 1789773)
        self.assertIn(0xB4, data)

    def test_external_brr_directory_enters_spc(self):
        try:
            import numpy as np
            import console_soundpack as console
        except ImportError:
            self.skipTest("Optional audio dependencies are not installed")
        with tempfile.TemporaryDirectory() as temp:
            folder = Path(temp)
            payload = console.encode_brr(np.zeros(32, dtype=np.float32), False, 0)
            (folder / "tone.brr").write_bytes(payload)
            (folder / "directory.json").write_text(
                json.dumps({"piano": {"file": "tone.brr", "root_hz": 261.625565, "loop": False, "adsr1": 0x8F, "adsr2": 0x89}}),
                encoding="utf-8",
            )
            bank = console.load_brr_directory(folder)
            spc = console.spc(
                [dict(preset="piano", midi=60, time=0, duration=0.3, velocity=90)],
                echo=False,
                brr_bank=bank,
                brr_filter=0,
            )
        self.assertTrue(spc.startswith(b"SNES-SPC700 Sound File Data v0.30"))
        self.assertGreater(len(spc), 0x100 + 0x8000)

    def test_unlooped_sample_pads_with_silence_not_invented_loop(self):
        try:
            import numpy as np
            from render_mix_v4 import make_note, SR
        except ImportError:
            self.skipTest("Optional audio dependencies are not installed")
        src = np.ones(int(0.05 * SR), dtype=np.float32)
        meta = {"root_midi": 60}
        y = make_note(src, meta, 60, 0.4, 0.001, 0.001)
        tail = y[int(0.08 * SR) :]
        self.assertGreater(len(tail), 10)
        self.assertLess(float(np.max(np.abs(tail))), 0.02)

    def test_role_collapse_is_written_on_the_plan(self):
        plan = sound_plan.resolve_plan(_cue(), {"id": "compact", "presets": []}, allow_fallback=True)
        self.assertIn("requested_roles", plan["role_collapse"])
        self.assertEqual(plan["listening_approval"], "pending")


if __name__ == "__main__":
    unittest.main()
