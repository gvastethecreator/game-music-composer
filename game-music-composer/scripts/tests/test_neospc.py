from __future__ import annotations

import copy
import contextlib
import io
import json
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPTS = Path(__file__).resolve().parents[1]
SKILL = SCRIPTS.parent
sys.path.insert(0, str(SCRIPTS))

import generate_neospc100_v3 as engine  # noqa: E402
import neospc  # noqa: E402
import package_skill  # noqa: E402
import professor_review  # noqa: E402
import release_gate  # noqa: E402


class NeoSpcCliTests(unittest.TestCase):
    def test_doctor_and_benchmark_pass(self) -> None:
        self.assertEqual(neospc.doctor_issues(), [])
        benchmark = neospc.load_json(neospc.BENCHMARK_PATH)
        self.assertEqual(neospc.validate_catalog(benchmark), [])
        self.assertEqual(len(benchmark["styles"]), 100)

    def test_release_boundary_is_portable_and_archived(self) -> None:
        self.assertEqual(release_gate.path_lint_issues(), [])
        self.assertEqual(release_gate.archive_issues(), [])
        self.assertEqual(release_gate.manifest_issues(), [])

    def test_init_creates_valid_plan_and_harness(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            output = Path(temp) / "glass-harbor"
            output_log = io.StringIO()
            with contextlib.redirect_stdout(output_log):
                code = neospc.main(
                    [
                        "init",
                        str(output),
                        "--title",
                        "Glass Harbor",
                        "--category",
                        "mystery",
                        "--game-context",
                        "puzzle",
                        "--game-function",
                        "logic puzzle reveal",
                        "--mood",
                        "mysterious",
                        "--bpm",
                        "88",
                        "--meter",
                        "5/4",
                        "--key",
                        "D",
                        "--mode",
                        "dorian",
                        "--voices",
                        "12",
                    ]
                )
            self.assertEqual(code, 0)
            self.assertIn('neospc.py" validate "', output_log.getvalue())
            self.assertIn('generation-harness.json" --strict', output_log.getvalue())
            self.assertNotIn("unittest validate", output_log.getvalue())
            plan = neospc.load_json(output / "composition-plan.json")
            harness = neospc.load_json(output / "generation-harness.json")
            self.assertEqual(plan["id"], "glass_harbor")
            self.assertEqual(plan["game_function"], "logic puzzle reveal")
            self.assertEqual(plan["voice_profile"], "compact_12")
            self.assertNotIn("State the ", plan["emotional_thesis"])
            self.assertNotIn("describe", plan["musical_identity"]["silence_budget"].lower())
            self.assertEqual(neospc.validate_plan(plan), [])
            self.assertEqual(neospc.validate_harness(harness), [])

    def test_invalid_plan_reports_actionable_paths(self) -> None:
        plan = neospc.load_json(neospc.PLAN_TEMPLATE_PATH)
        plan["category"] = "unknown"
        plan["musical_identity"]["bpm"] = 999
        issues = neospc.validate_plan(plan)
        self.assertEqual({issue.code for issue in issues}, {"unknown_category", "invalid_bpm"})
        self.assertIn("$.category", {issue.path for issue in issues})
        self.assertIn("$.musical_identity.bpm", {issue.path for issue in issues})

        plan = neospc.load_json(neospc.PLAN_TEMPLATE_PATH)
        plan["musical_identity"]["loop_strategy"] = "describe pickup, cadence and seam behavior"
        issues = neospc.validate_plan(plan)
        self.assertIn("placeholder_text", {issue.code for issue in issues})
        self.assertIn("$.musical_identity.loop_strategy", {issue.path for issue in issues})

    def test_symbolic_review_uses_library_scale_ids(self) -> None:
        style = {
            "key": "D",
            "mode": "aeolian",
            "beats": 4,
            "barLength": 4,
            "events": [
                {"kind": "note", "midi": midi, "beat": index * 0.5, "duration": 0.4, "role": "lead", "inst": "lead"}
                for index, midi in enumerate((62, 64, 65, 67, 69, 70, 72))
            ],
        }
        self.assertEqual(professor_review.harmonic_metrics(style)["scale_fit"], 1.0)

    def test_compose_creates_a_deterministic_factory_ready_score(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            project = Path(temp) / "ash-crown"
            self.assertEqual(
                neospc.main(
                    [
                        "init", str(project), "--title", "Ash Crown", "--category", "action",
                        "--subcategory", "Boss Battle", "--game-context", "boss", "--mood", "tense",
                        "--bpm", "132", "--meter", "7/8", "--key", "D", "--mode", "harmonic_minor",
                        "--voices", "16", "--seed", "9137",
                    ]
                ),
                0,
            )
            self.assertEqual(neospc.main(["compose", str(project)]), 0)
            first = (project / "composition.json").read_bytes()
            self.assertEqual(neospc.main(["compose", str(project), "--force"]), 0)
            self.assertEqual(first, (project / "composition.json").read_bytes())

            composition = neospc.load_json(project / "composition.json")
            catalog = neospc.load_json(project / "catalog.json")
            harness = neospc.load_json(project / "generation-harness.json")
            self.assertEqual(composition["generation"]["seed"], 9137)
            self.assertEqual(composition["generation"]["progression_id"], "boss_01")
            self.assertEqual(composition["generation"]["drums"], "boss")
            self.assertLessEqual(composition["measured_peak_voices"], composition["voice_budget"])
            self.assertTrue(all(info.get("factory_patch") for info in composition["instrument_map"].values()))
            velocities = [event["velocity"] for event in composition["events"]]
            self.assertGreater(len(set(velocities)), 12)
            self.assertTrue(all(1 <= velocity <= 127 for velocity in velocities))
            self.assertEqual(harness["orchestration"]["ensemble_profile"], "hybrid")
            self.assertEqual(neospc.validate_composition(composition), [])
            self.assertEqual(neospc.validate_catalog(catalog), [])

    def test_compose_refuses_overwrite_and_mismatched_inputs(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            project = Path(temp) / "glass-harbor"
            self.assertEqual(neospc.main(["init", str(project), "--title", "Glass Harbor"]), 0)
            self.assertEqual(neospc.main(["compose", str(project)]), 0)
            error_log = io.StringIO()
            with contextlib.redirect_stderr(error_log):
                self.assertEqual(neospc.main(["compose", str(project)]), 2)
            self.assertIn("Pass --force", error_log.getvalue())

            harness = neospc.load_json(project / "generation-harness.json")
            harness["rhythm"]["meter"] = "3/4"
            neospc.atomic_json_write(project / "generation-harness.json", harness)
            error_log = io.StringIO()
            with contextlib.redirect_stderr(error_log):
                self.assertEqual(neospc.main(["compose", str(project), "--force"]), 1)
            self.assertIn("meter differs", error_log.getvalue())

    def test_compose_supports_every_category_preset(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            for category in sorted(neospc.category_ids()):
                project = root / category
                output_log = io.StringIO()
                with contextlib.redirect_stdout(output_log):
                    self.assertEqual(neospc.main(["init", str(project), "--title", f"{category.title()} Study", "--category", category]), 0)
                    self.assertEqual(neospc.main(["compose", str(project)]), 0)
                composition = neospc.load_json(project / "composition.json")
                self.assertEqual(composition["category"], category)
                self.assertLessEqual(composition["measured_peak_voices"], composition["voice_budget"])
                self.assertTrue(all(info.get("factory_patch") for info in composition["instrument_map"].values()))
                self.assertEqual(neospc.validate_composition(composition), [])

    def test_review_midi_and_bank_pipeline_on_one_cue(self) -> None:
        source = neospc.load_json(neospc.BENCHMARK_PATH)
        catalog = copy.deepcopy(source)
        catalog["styles"] = [catalog["styles"][0]]
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            catalog_path = root / "catalog.json"
            review_path = root / "review.json"
            midi_dir = root / "midi"
            bank_path = root / "bank.json"
            catalog_path.write_text(json.dumps(catalog), encoding="utf-8")

            self.assertEqual(neospc.main(["review", str(catalog_path), str(review_path)]), 0)
            self.assertEqual(neospc.main(["export-midi", str(catalog_path), str(midi_dir)]), 0)
            audit_log = io.StringIO()
            with contextlib.redirect_stdout(audit_log):
                self.assertEqual(neospc.main(["audit-bank", str(catalog_path), "--output", str(bank_path)]), 0)

            review = json.loads(review_path.read_text(encoding="utf-8"))
            bank = json.loads(bank_path.read_text(encoding="utf-8"))
            midi = midi_dir / f"{catalog['styles'][0]['id']}.mid"
            self.assertEqual(len(review["tracks"]), 1)
            self.assertEqual(review["reviewer"], "Neo-SPC Symbolic Review")
            self.assertIn("human listening excluded", review["method"])
            self.assertEqual(bank["errors"], 0)
            self.assertIn(f"{bank['factory_mapped']}/{bank['assignments']} assignments mapped", audit_log.getvalue())
            self.assertTrue(midi.read_bytes().startswith(b"MThd"))
            self.assertTrue((midi_dir / "midi-report.json").is_file())

    def test_package_is_reproducible_and_excludes_cache(self) -> None:
        import zipfile

        with tempfile.TemporaryDirectory() as temp:
            first = Path(temp) / "first.zip"
            second = Path(temp) / "second.zip"
            count_a, digest_a = package_skill.build(first)
            count_b, digest_b = package_skill.build(second)
            self.assertGreater(count_a, 60)
            self.assertLess(count_a, 100)
            self.assertEqual(count_a, count_b)
            self.assertEqual(digest_a, digest_b)
            with zipfile.ZipFile(first) as archive:
                names = archive.namelist()
                unpacked_bytes = sum(info.file_size for info in archive.infolist())
            self.assertIn("game-music-composer/SKILL.md", names)
            self.assertIn("game-music-composer/LICENSE", names)
            self.assertIn("game-music-composer/agents/openai.yaml", names)
            self.assertFalse(any("__pycache__" in name or ".pytest_cache" in name or name.endswith(".pyc") for name in names))
            self.assertNotIn("game-music-composer/data/neospc100-benchmark-v3.json", names)
            self.assertNotIn("game-music-composer/data/neospc100-benchmark.json", names)
            self.assertLess(unpacked_bytes, 25 * 1024 * 1024)


def _probe_spec(**overrides):
    spec = dict(
        slug="probe", title="Probe", subcategory="Study", bpm=88, meter="4/4", bars=16,
        key="C", mode="major", budget=16, prog="home", motif="rising_fourth",
        lead="flute", secondary=None, comp="sparse_chords", bass="pedal", drums="none",
        form="A A2 B A3", energy=.5, tension=.3, tags=[], notes="", seed=7,
        category="adventure", architecture="period", rest_ratio=.22,
    )
    spec.update(overrides)
    return spec


class PhraseGrammarTests(unittest.TestCase):
    def test_period_is_antecedent_then_consequent(self):
        phrases = engine.phrase_plan(_probe_spec(bars=16, architecture="period"))
        self.assertEqual([p.kind for p in phrases], ["antecedent", "consequent", "antecedent", "consequent"])
        self.assertEqual([p.bars for p in phrases], [4, 4, 4, 4])
        self.assertEqual([p.closing for p in phrases], [False, True, False, True])

    def test_sentence_is_two_plus_two_plus_four(self):
        phrases = engine.phrase_plan(_probe_spec(bars=8, architecture="sentence"))
        self.assertEqual([p.kind for p in phrases], ["presentation", "presentation", "continuation"])
        self.assertEqual([p.bars for p in phrases], [2, 2, 4])
        self.assertEqual([p.closing for p in phrases], [False, False, True])

    def test_consequent_harmony_closes_on_tonic_antecedent_does_not(self):
        spec = _probe_spec()
        spec["category"] = "adventure"
        chords = engine.chord_plan(spec)
        key_pc = engine.NOTE_PC[spec["key"]]
        self.assertNotEqual(chords[3]["root_pc"], key_pc)
        self.assertEqual(chords[7]["root_pc"], key_pc)
        self.assertNotEqual([c["symbol"] for c in chords[:4]], [c["symbol"] for c in chords[4:8]])

    def test_motif_skeleton_stays_on_tonic_and_consequent_cadences_home(self):
        spec = _probe_spec()
        spec["category"] = "adventure"
        bar_len = engine.METERS[spec["meter"]]
        chords = engine.chord_plan(spec)
        sections = engine.form_sections(spec)
        melody = engine.motif_events(spec, bar_len, chords, sections)
        lead = sorted((event for event in melody if event.get("role") == "lead"), key=lambda event: event["beat"])
        self.assertGreaterEqual(len(lead), 8)
        self.assertEqual(lead[0]["midi"] % 12, engine.NOTE_PC[spec["key"]])
        cadences = sorted((event for event in lead if event.get("cadence")), key=lambda event: event["beat"])
        self.assertGreaterEqual(len(cadences), 2)
        self.assertNotEqual(cadences[0]["midi"] % 12, engine.NOTE_PC[spec["key"]])
        self.assertEqual(cadences[1]["midi"] % 12, engine.NOTE_PC[spec["key"]])

    def test_contrast_section_uses_answer_motif_contour(self):
        spec = _probe_spec(form=[
            {"name": "A", "function": "statement", "bars": 4},
            {"name": "B", "function": "contrast", "bars": 4},
            {"name": "A3", "function": "return", "bars": 8},
        ])
        spec["category"] = "adventure"
        bar_len = engine.METERS[spec["meter"]]
        chords = engine.chord_plan(spec)
        sections = engine.form_sections(spec)
        melody = engine.motif_events(spec, bar_len, chords, sections)

        def intervals(start_bar, bars):
            notes = [
                event for event in melody
                if event.get("role") == "lead" and start_bar * bar_len <= event["beat"] < (start_bar + bars) * bar_len
            ]
            notes.sort(key=lambda event: event["beat"])
            return tuple(notes[index + 1]["midi"] - notes[index]["midi"] for index in range(min(3, len(notes) - 1)))

        self.assertNotEqual(intervals(0, 4), intervals(4, 4))


def _lead_line(spec):
    bar_len = engine.METERS[spec["meter"]]
    melody = engine.motif_events(spec, bar_len, engine.chord_plan(spec), engine.form_sections(spec))
    lead = sorted((event for event in melody if event.get("role") == "lead"), key=lambda event: event["beat"])
    return lead, bar_len


def _review_style(style_id, cells):
    events = []
    for bar, cell in enumerate(cells):
        for index, midi in enumerate(cell):
            beat = bar * 4 + index
            events.append({
                "kind": "note", "role": "lead", "inst": "flute", "midi": midi,
                "beat": beat, "duration": 0.6, "performance_beat": beat, "performance_duration": 0.6, "gain": 0.04,
            })
        events.append({
            "kind": "note", "role": "bass", "inst": "bass", "midi": 36,
            "beat": bar * 4, "duration": 3.5, "performance_beat": bar * 4, "performance_duration": 3.5, "gain": 0.04,
        })
    return {
        "id": style_id, "title": style_id, "category": "adventure", "subcategory": "Study",
        "beats": 64, "bars": 16, "barLength": 4, "key": "C", "mode": "major",
        "events": events,
        "chord_plan": [{"bar": index, "symbol": "I", "root_pc": 0, "pcs": [0, 4, 7]} for index in range(16)],
        "voice_budget": 16,
        "form": [
            {"name": "A", "start_bar": 0, "bars": 4}, {"name": "A2", "start_bar": 4, "bars": 4},
            {"name": "B", "start_bar": 8, "bars": 4}, {"name": "A3", "start_bar": 12, "bars": 4},
        ],
        "musical_direction": {"loop_strategy": "loop"},
    }


class MelodyHarnessTests(unittest.TestCase):
    def test_contour_tilts_degrees_without_moving_the_first_note(self):
        cell = [0, 1, 2, 1, 0]
        self.assertEqual(engine.apply_contour(cell, "ascending")[0], 0)
        self.assertGreater(engine.apply_contour(cell, "ascending")[-1], engine.apply_contour(cell, "descending")[-1])

    def test_tessitura_shifts_the_singing_center(self):
        low, _ = _lead_line(_probe_spec(tessitura=0.15, range_semitones=10))
        high, _ = _lead_line(_probe_spec(tessitura=0.85, range_semitones=10))
        self.assertGreater(sum(event["midi"] for event in high) / len(high) - sum(event["midi"] for event in low) / len(low), 4)

    def test_max_leap_caps_most_melodic_intervals(self):
        lead, _ = _lead_line(_probe_spec(max_leap=4, range_semitones=16))
        intervals = [abs(lead[index + 1]["midi"] - lead[index]["midi"]) for index in range(len(lead) - 1)]
        self.assertGreaterEqual(sum(interval <= 4 for interval in intervals) / len(intervals), 0.75)

    def test_descending_contour_falls_where_ascending_rises(self):
        def slope(contour):
            lead, bar_len = _lead_line(_probe_spec(contour=contour, range_semitones=16))
            notes = [event for event in lead if event["beat"] < 3 * bar_len]
            return notes[-1]["midi"] - notes[0]["midi"]

        self.assertGreater(slope("ascending"), slope("descending"))

    def test_contrast_section_changes_accompaniment_texture(self):
        spec = _probe_spec(comp="sparse_chords", comp_b="harp_broken")
        events = []
        engine.add_accompaniment(events, spec, engine.METERS[spec["meter"]], engine.chord_plan(spec))
        bar_len = engine.METERS[spec["meter"]]
        harp_b = [event for event in events if event["inst"] == "harp" and 8 * bar_len <= event["beat"] < 12 * bar_len]
        piano_a = [event for event in events if event["inst"] == "piano" and event["beat"] < 8 * bar_len]
        self.assertGreater(len(harp_b), 0)
        self.assertGreater(len(piano_a), 0)
        self.assertFalse(any(event["inst"] == "harp" and event["beat"] < 8 * bar_len for event in events))


class ReviewIdentityTests(unittest.TestCase):
    def test_tiled_catalog_neighbors_fail_identity(self):
        cell = [[60, 64, 67, 64]] * 16
        clone_a = _review_style("tile_a", cell)
        clone_b = _review_style("tile_b", cell)
        report = professor_review.review(clone_a, siblings=[clone_a, clone_b])
        self.assertIn("legality_score", report)
        self.assertIn("strengthen_identity", report["required_actions"])
        self.assertLess(report["identity_score"], 6.8)
        self.assertNotEqual(report["status"], "approved")

    def test_varied_cue_keeps_identity_without_corpus_hits(self):
        cells = (
            [[60, 64, 67, 72]] * 4
            + [[62, 64, 65, 67]] * 4
            + [[71, 69, 67, 65]] * 4
            + [[60, 67, 64, 60]] * 4
        )
        report = professor_review.review(_review_style("unique", cells), siblings=[])
        self.assertGreaterEqual(report["identity_score"], 6.8)
        self.assertNotIn("strengthen_identity", report["required_actions"])


if __name__ == "__main__":
    unittest.main()
