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


class NeoSpcCliTests(unittest.TestCase):
    def test_doctor_and_benchmark_pass(self) -> None:
        self.assertEqual(neospc.doctor_issues(), [])
        benchmark = neospc.load_json(neospc.BENCHMARK_PATH)
        self.assertEqual(neospc.validate_catalog(benchmark), [])
        self.assertEqual(len(benchmark["styles"]), 100)

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
            self.assertEqual(neospc.main(["audit-bank", str(catalog_path), "--output", str(bank_path)]), 0)

            review = json.loads(review_path.read_text(encoding="utf-8"))
            bank = json.loads(bank_path.read_text(encoding="utf-8"))
            midi = midi_dir / f"{catalog['styles'][0]['id']}.mid"
            self.assertEqual(len(review["tracks"]), 1)
            self.assertEqual(bank["errors"], 0)
            self.assertTrue(midi.read_bytes().startswith(b"MThd"))
            self.assertTrue((midi_dir / "midi-report.json").is_file())

    def test_package_is_reproducible_and_excludes_cache(self) -> None:
        import zipfile

        with tempfile.TemporaryDirectory() as temp:
            first = Path(temp) / "first.zip"
            second = Path(temp) / "second.zip"
            count_a, digest_a = package_skill.build(first)
            count_b, digest_b = package_skill.build(second)
            self.assertGreater(count_a, 100)
            self.assertEqual(count_a, count_b)
            self.assertEqual(digest_a, digest_b)
            with zipfile.ZipFile(first) as archive:
                names = archive.namelist()
            self.assertIn("neospc-music-composer/SKILL.md", names)
            self.assertIn("neospc-music-composer/agents/openai.yaml", names)
            self.assertFalse(any("__pycache__" in name or name.endswith(".pyc") for name in names))


if __name__ == "__main__":
    unittest.main()
