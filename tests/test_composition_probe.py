from __future__ import annotations
import copy
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
import composition_probe as probe

STYLE = {"id":"a", "bpm":96, "beats":8, "events":[
    {"kind":"note","inst":"lead","role":"lead","beat":0,"duration":1,"midi":62,"velocity":80},
    {"kind":"note","inst":"bass","role":"bass","beat":0,"duration":2,"midi":38,"velocity":70}],
    "instrument_map":{"lead":{"sample":"test"}}, "mix":{"drive":0}}

class FingerprintTests(unittest.TestCase):
    def test_identity_metadata_does_not_masquerade_as_new_music(self):
        changed=copy.deepcopy(STYLE);changed.update(id="b",title="New title",generation={"seed":12})
        self.assertEqual(probe.fingerprints(STYLE),probe.fingerprints(changed))

    def test_event_order_is_normalized(self):
        changed=copy.deepcopy(STYLE);changed["events"].reverse()
        self.assertEqual(probe.fingerprints(STYLE),probe.fingerprints(changed))

    def test_duplicate_events_remain_visible(self):
        changed=copy.deepcopy(STYLE);changed["events"].append(copy.deepcopy(changed["events"][0]))
        self.assertNotEqual(probe.fingerprints(STYLE)["score"],probe.fingerprints(changed)["score"])

    def test_pitch_change_is_musical(self):
        changed=copy.deepcopy(STYLE);changed["events"][0]["midi"]+=1
        self.assertNotEqual(probe.fingerprints(STYLE)["score"],probe.fingerprints(changed)["score"])

    def test_velocity_does_not_change_symbolic_score(self):
        changed=copy.deepcopy(STYLE);changed["events"][0]["velocity"]+=1
        before,after=probe.fingerprints(STYLE),probe.fingerprints(changed)
        self.assertEqual(before["score"],after["score"])
        self.assertNotEqual(before["performance"],after["performance"])

    def test_patch_metadata_not_claimed_as_score_change(self):
        changed=copy.deepcopy(STYLE);changed["instrument_map"]["lead"]["factory_patch"]="other"
        before,after=probe.fingerprints(STYLE),probe.fingerprints(changed)
        self.assertEqual(before["score"],after["score"])
        self.assertNotEqual(before["instrument_map"],after["instrument_map"])

    def test_mix_intent_not_claimed_as_score_change(self):
        changed=copy.deepcopy(STYLE);changed["mix"]["drive"]=.1
        before,after=probe.fingerprints(STYLE),probe.fingerprints(changed)
        self.assertEqual(before["score"],after["score"])
        self.assertNotEqual(before["mix_intent"],after["mix_intent"])

    def test_empty_invalid_events_rejected(self):
        for value in ({},{"events":[]},{"events":[None]}):
            with self.assertRaises(ValueError):probe.fingerprints(value)

    def test_non_finite_data_rejected(self):
        changed=copy.deepcopy(STYLE);changed["events"][0]["midi"]=float("nan")
        with self.assertRaises(ValueError):probe.fingerprints(changed)

    def test_section_prose_is_not_music(self):
        changed=copy.deepcopy(STYLE);changed["form"]=[{"name":"A","function":"epic","start_bar":0,"bars":2}]
        changed2=copy.deepcopy(changed);changed2["form"][0].update(name="Heroic",function="sad")
        self.assertEqual(probe.fingerprints(changed),probe.fingerprints(changed2))

    def test_key_label_is_not_a_note_change(self):
        changed=copy.deepcopy(STYLE);changed["key"]="F#"
        before,after=probe.fingerprints(STYLE),probe.fingerprints(changed)
        self.assertEqual(before["score"],after["score"])
        self.assertNotEqual(before["declared_structure"],after["declared_structure"])

class ControlTests(unittest.TestCase):
    def test_replace_is_non_mutating(self):
        source={"melody":{"rest_ratio":.2}}
        self.assertEqual(probe.replace_control(source,"melody.rest_ratio",.4)["melody"]["rest_ratio"],.4)
        self.assertEqual(source["melody"]["rest_ratio"],.2)

    def test_unknown_path_equal_value_invalid_value_rejected(self):
        source={"melody":{"rest_ratio":.2}}
        for path,value in (("wrong.key",1),("melody.missing",1),("melody.rest_ratio",.2),("melody..rest_ratio",1),("melody.rest_ratio",float("inf"))):
            with self.subTest(path=path),self.assertRaises(ValueError):probe.replace_control(source,path,value)

    def test_boolean_and_integer_not_confused(self):
        self.assertEqual(probe.replace_control({"x":True},"x",1),{"x":1})

class AdapterTests(unittest.TestCase):
    def fixture(self, temporary):
        root=Path(temporary);skill=root/"skill";project=root/"project"
        (skill/"scripts").mkdir(parents=True);project.mkdir()
        (project/"composition-plan.json").write_text('{"id":"test"}')
        (project/"generation-harness.json").write_text('{"melody":{"pitch":62,"decorative":0}}')
        # Canonical CLI protocol fixture, NOT the real Neo-SPC composition engine.
        (skill/"scripts"/"neospc.py").write_text('''import json,sys\nfrom pathlib import Path\np=Path(sys.argv[2])\nh=json.loads((p/"generation-harness.json").read_text())\ns={"bpm":96,"events":[{"kind":"note","inst":"lead","beat":0,"duration":1,"midi":h["melody"]["pitch"]}]}\n(p/"composition.json").write_text(json.dumps(s))\n''')
        return skill,project

    def test_adapter_changed_unchanged_and_not_comparable(self):
        with tempfile.TemporaryDirectory() as temp:
            skill,project=self.fixture(temp);original=(project/"generation-harness.json").read_bytes()
            result=probe.run_probe(project,skill,[{"control":"melody.pitch","value":64},{"control":"melody.decorative","value":1},{"control":"absent.control","value":1}])
            self.assertTrue(result["baseline_repeatable"])
            self.assertEqual([r["status"] for r in result["cases"]],["changed","unchanged_in_fixture","not_comparable"])
            self.assertEqual((project/"generation-harness.json").read_bytes(),original)
            self.assertFalse((project/"composition.json").exists())

    def test_unstable_baseline_aborts_comparisons(self):
        with tempfile.TemporaryDirectory() as temp:
            skill,project=self.fixture(temp);script=skill/"scripts"/"neospc.py"
            script.write_text(script.read_text().replace('s={"bpm":96', 'counter=Path(__file__).with_suffix(".counter")\nv=int(counter.read_text())+1 if counter.exists() else 1\ncounter.write_text(str(v))\nh["melody"]["pitch"]=v\ns={"bpm":96'))
            result=probe.run_probe(project,skill,[{"control":"melody.pitch","value":64}])
            self.assertFalse(result["baseline_repeatable"])
            self.assertEqual(result["status"],"baseline_not_repeatable")
            self.assertEqual(result["cases"],[])

    def test_bad_case_schema_and_timeout_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            skill,project=self.fixture(temp)
            with self.assertRaises(ValueError):probe.run_probe(project,skill,[{"typo":1}])
            with self.assertRaises(ValueError):probe.run_probe(project,skill,[],float("nan"))

    def test_existing_evidence_is_not_overwritten(self):
        with tempfile.TemporaryDirectory() as temp:
            target=Path(temp)/"report.json";target.write_text("keep")
            import subprocess
            result=subprocess.run([sys.executable,str(Path(probe.__file__)),"--project",temp,"--cases",str(target),"--out",str(target)],capture_output=True)
            self.assertEqual(result.returncode,2);self.assertEqual(target.read_text(),"keep")

if __name__=="__main__":unittest.main()
