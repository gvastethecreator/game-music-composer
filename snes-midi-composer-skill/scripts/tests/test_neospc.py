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
            self.assertIn("neospc-music-composer/SKILL.md", names)
            self.assertIn("neospc-music-composer/LICENSE", names)
            self.assertIn("neospc-music-composer/agents/openai.yaml", names)
            self.assertFalse(any("__pycache__" in name or name.endswith(".pyc") for name in names))
            self.assertNotIn("neospc-music-composer/data/neospc100-benchmark-v3.json", names)
            self.assertNotIn("neospc-music-composer/data/neospc100-benchmark.json", names)
            self.assertLess(unpacked_bytes, 25 * 1024 * 1024)


if __name__ == "__main__":
    unittest.main()
