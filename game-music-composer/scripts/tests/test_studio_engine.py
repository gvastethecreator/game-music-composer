"""Studio engine commands: create, create-import and create-render."""
from __future__ import annotations

import importlib.util
import json
import sys
import tempfile
import unittest
import wave
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SCRIPTS))

import neospc  # noqa: E402
import studio_engine  # noqa: E402

NODE = studio_engine.node_version()


@unittest.skipUnless(NODE and NODE >= (18,), "Node.js 18+ is required for the studio engine")
class StudioEngineCommands(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.out = Path(self.tmp.name)

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def create(self, *extra: str) -> int:
        return neospc.main(["create", str(self.out / "song"), "--preset", "lofi", "--seed", "DUSK", *extra])

    def test_create_writes_valid_outputs_deterministically(self) -> None:
        self.assertEqual(self.create(), 0)
        song = self.out / "song"
        composition = json.loads((song / "composition.json").read_text(encoding="utf-8"))
        self.assertFalse([i for i in neospc.validate_composition(composition) if i.level == "error"])
        self.assertEqual(composition["category"], "lofi")
        self.assertTrue((song / "engine.mid").read_bytes().startswith(b"MThd"))
        project = (song / "project.json").read_text(encoding="utf-8")
        self.assertEqual(self.create(), 2, "refuses to overwrite without --force")
        self.assertEqual(self.create("--force"), 0)
        self.assertEqual((song / "project.json").read_text(encoding="utf-8"), project, "same preset and seed give the same song")

    def test_variation_changes_the_song(self) -> None:
        self.assertEqual(self.create(), 0)
        base = json.loads((self.out / "song" / "project.json").read_text(encoding="utf-8"))["state"]["patterns"]
        self.assertEqual(self.create("--variation", "V1", "--force"), 0)
        varied = json.loads((self.out / "song" / "project.json").read_text(encoding="utf-8"))["state"]["patterns"]
        self.assertNotEqual(base, varied)

    def test_create_import_keeps_every_note(self) -> None:
        self.assertEqual(self.create(), 0)
        composition = self.out / "song" / "composition.json"
        target = self.out / "imported.json"
        self.assertEqual(neospc.main(["create-import", str(composition), str(target)]), 0)
        state = json.loads(target.read_text(encoding="utf-8"))["state"]
        clip_notes = sum(len(c["notes"]) for c in state["studio"]["clips"].values())
        self.assertEqual(clip_notes, len(json.loads(composition.read_text(encoding="utf-8"))["events"]))

    @unittest.skipUnless(importlib.util.find_spec("playwright"), "Playwright is required for create-render")
    def test_create_render_writes_audible_wav(self) -> None:
        self.assertEqual(self.create(), 0)
        wav_path = self.out / "engine.wav"
        self.assertEqual(neospc.main(["create-render", str(self.out / "song" / "project.json"), str(wav_path)]), 0)
        with wave.open(str(wav_path)) as wav:
            self.assertEqual((wav.getnchannels(), wav.getsampwidth(), wav.getframerate()), (2, 2, 44100))
            frames = wav.readframes(wav.getnframes())
        self.assertTrue(any(frames[i] for i in range(0, len(frames), 997)), "render is not silent")


if __name__ == "__main__":
    unittest.main()
