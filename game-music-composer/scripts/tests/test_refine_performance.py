import copy
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import refine_performance as R

BASE = {"id": "fixture", "bpm": 96, "beats": 16, "barLength": 4, "voice_budget": 8,
        "events": [{"kind": "note", "inst": "piano", "role": "lead", "beat": float(i),
                    "duration": .7, "midi": 60+i%5, "velocity": 82, "velocity_gain": 1.1}
                   for i in range(16)]}

class RefineTests(unittest.TestCase):
    def test_profiles_deterministic_non_mutating_and_structural_invariants(self):
        for profile in R.PROFILES:
            with self.subTest(profile=profile):
                original = copy.deepcopy(BASE)
                a = R.refine(BASE, profile=profile)
                self.assertEqual(BASE, original)
                self.assertEqual(a, R.refine(BASE, profile=profile))
                self.assertEqual(R.structural_hash(a), R.structural_hash(BASE))
                self.assertEqual(a['performance_refinement']['listening_review'], 'pending')

    def test_zero_is_exact_noop(self):
        self.assertEqual(R.refine(BASE, amount=0), BASE)

    def test_refuse_cumulative_refinement(self):
        with self.assertRaisesRegex(ValueError, 'Already refined'):
            R.refine(R.refine(BASE))

    def test_role_placement_affects_actual_performance_fields(self):
        s = R.refine(BASE, profile='pocket', amount=1)
        self.assertGreater(s['events'][4]['performance_beat'], 4)
        self.assertNotEqual(s['events'][8]['velocity_gain'], BASE['events'][8]['velocity_gain'])
        self.assertLess(s['events'][4]['performance_duration'], .7)

    def test_anchor_drums_stay_on_grid(self):
        base = copy.deepcopy(BASE)
        base['events'].append({'kind':'drum', 'inst':'kick', 'role':'kick', 'beat':1.0,'velocity':90})
        self.assertEqual(R.refine(base, amount=1)['events'][-1]['performance_beat'], 1)

    def test_chord_members_share_timing(self):
        s=copy.deepcopy(BASE);s['events'].append({**s['events'][2], 'midi':72})
        r=R.refine(s, amount=1)
        self.assertEqual(r['events'][2]['performance_beat'],r['events'][-1]['performance_beat'])

    def test_input_order_does_not_change_local_performance(self):
        a=R.refine(BASE);b=copy.deepcopy(BASE);b['events'].reverse();b=R.refine(b)
        self.assertEqual(a['events'],list(reversed(b['events'])))

    def test_catalog_and_metadata_preserved(self):
        out=R.refine({'styles':[BASE], 'project':'keep'})
        self.assertEqual(out['project'],'keep');self.assertEqual(len(out['styles']),1)

    def test_dense_conflict_fails_without_deleting_notes(self):
        base=copy.deepcopy(BASE);base['events']=[{**BASE['events'][0], 'inst':f'p{i}'} for i in range(9)]
        with self.assertRaisesRegex(ValueError, 'No notes were deleted'):
            R.refine(base)
        self.assertEqual(len(base['events']),9)

    def test_sweep_detects_short_overlap_and_loop_tail(self):
        e=[{'kind':'note','inst':'a','beat':0,'duration':.01},{'kind':'note','inst':'b','beat':15.99,'duration':.02}]
        self.assertEqual(R.peak_symbolic(e,16),2)

    def test_wrapped_early_downbeat_blends_across_loop_seam(self):
        base = copy.deepcopy(BASE)
        base['events'][0].update(inst='bass', role='bass', performance_beat=15.99)
        refined = R.refine(base, profile='pocket', amount=.5)
        event = refined['events'][0]
        self.assertGreater(event['performance_beat'], 15.97)
        self.assertLess(event['start_offset_ms'], 0)
        self.assertLess(abs(event['start_offset_ms']), 25)
        self.assertEqual(R.structural_hash(refined), R.structural_hash(base))

    def test_bad_inputs(self):
        for key,value in [('bpm',True),('beats',float('nan')),('barLength',0),('voice_budget',8.5)]:
            b=copy.deepcopy(BASE);b[key]=value
            with self.subTest(key=key),self.assertRaises(ValueError):R.refine(b)
        for options in [{'amount':float('inf')},{'seed':True},{'seed':1.2},{'profile':'unknown'}]:
            with self.subTest(options=options),self.assertRaises(ValueError):R.refine(BASE,**options)

    def test_output_never_overwrites(self):
        with tempfile.TemporaryDirectory() as tmp:
            src=Path(tmp)/'input.json';out=Path(tmp)/'out.json';src.write_text(json.dumps(BASE));out.write_text('keep')
            run=subprocess.run([sys.executable,R.__file__,str(src),str(out)],capture_output=True)
            self.assertEqual(run.returncode,2);self.assertEqual(out.read_text(),'keep')

    def test_cli_writes_valid_json(self):
        with tempfile.TemporaryDirectory() as tmp:
            src=Path(tmp)/'input.json';out=Path(tmp)/'out.json';src.write_text(json.dumps(BASE))
            run=subprocess.run([sys.executable,R.__file__,str(src),str(out),'--profile','pocket'],capture_output=True)
            self.assertEqual(run.returncode,0,run.stderr)
            self.assertTrue(json.loads(out.read_text())['performance_refinement']['structural_events_preserved'])

if __name__ == '__main__':unittest.main()
