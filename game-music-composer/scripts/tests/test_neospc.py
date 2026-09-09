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
import export_midis_v4  # noqa: E402
import midi_compat  # noqa: E402


class AudioSynthesisTests(unittest.TestCase):
    def test_console_voice_overflow_is_rejected_without_dropping_notes(self):
        try:
            import console_soundpack as console
        except ImportError:
            self.skipTest('Optional audio dependencies are not installed')
        for system,preset,voices in [('megadrive','organ',6),('snes','flute',8)]:
            with self.subTest(system=system):
                notes=[dict(preset=preset,midi=60+i,time=0,duration=.5,velocity=90) for i in range(voices)]
                self.assertEqual(len(console.timeline(notes,system)),voices*2)
                with self.assertRaisesRegex(ValueError,'voice budget exceeded'):
                    console.timeline(notes+[dict(notes[0])],system)

    def test_native_console_files_decode_at_written_pitch_and_release(self):
        try:
            import numpy as np
            import soundfile as sf
            import console_soundpack as console
        except ImportError:
            self.skipTest('Optional audio dependencies are not installed')
        import shutil,subprocess
        if not shutil.which('ffmpeg'):
            self.skipTest('FFmpeg is not installed')
        if 'libgme' not in subprocess.check_output(['ffmpeg','-hide_banner','-formats'],text=True,stderr=subprocess.STDOUT):
            self.skipTest('FFmpeg has no libgme demuxer')
        with tempfile.TemporaryDirectory() as temp:
            for system,preset,extension in [('megadrive','organ','.vgm'),('snes','flute','.spc')]:
                with self.subTest(system=system):
                    note=[dict(preset=preset,midi=60,time=0,duration=.6,velocity=96)]
                    path=Path(temp)/(system+extension)
                    path.write_bytes(console.vgm(note) if system=='megadrive' else console.spc(note,False))
                    wav=path.with_suffix('.wav');console.render_native(path,wav,1.6)
                    x,sr=sf.read(wav);self.assertEqual(x.shape,(51200,2))
                    self.assertTrue(np.isfinite(x).all());self.assertGreater(float(np.max(abs(x))),.005)
                    self.assertLess(float(np.max(abs(x))),.98)
                    segment=x[3200:12800,0];spectrum=np.abs(np.fft.rfft(segment*np.hanning(len(segment))))
                    frequency=np.fft.rfftfreq(len(segment),1/sr)[np.argmax(spectrum)]
                    self.assertAlmostEqual(float(frequency),261.625565,delta=4)
                    self.assertLess(float(np.sqrt(np.mean(x[-3200:]**2))),.001)

    def test_modal_guitar_velocity_changes_spectrum_after_level_matching(self):
        try:
            import numpy as np
            from resonant_timbres import render
        except ImportError:
            self.skipTest('Optional audio dependencies are not installed')
        spectra=[]
        for velocity in (42,115):
            x,_=render('guitar.requinto',60,velocity,1,32000,False,'timber')
            spectrum=np.abs(np.fft.rfft(x[:8192]*np.hanning(8192)))
            spectra.append(spectrum/np.linalg.norm(spectrum))
        self.assertLess(float(np.dot(*spectra)),.98)
        frequencies=np.fft.rfftfreq(8192,1/32000)
        centroids=[float(np.sum(s*frequencies)/np.sum(s)) for s in spectra]
        self.assertGreater(centroids[1],centroids[0]*1.15)

    def test_sustained_sample_wraps_at_the_original_waveform_slope(self):
        try:
            import numpy as np
            from synthesize_soundbanks import synthesize
        except ImportError:
            self.skipTest('Optional audio dependencies are not installed')
        x, loop = synthesize('winds.flute', 72, sample_rate=16000, looped=True)
        a, b = [round(loop[k]*16000) for k in ['start_sec','end_sec']]
        self.assertAlmostEqual(float(x[b-1]), float(x[a-1]), places=6)
        self.assertTrue(np.isfinite(x).all())
        self.assertGreater(float(np.sqrt(np.mean(x[a:b]**2))), .01)

    def test_alternate_attacks_are_distinct_and_repeatable(self):
        try:
            import numpy as np
            from synthesize_soundbanks import synthesize
        except ImportError:
            self.skipTest('Optional audio dependencies are not installed')
        a, _ = synthesize('bass.sub_sine', 36, variation=1, sample_rate=16000)
        b, _ = synthesize('bass.sub_sine', 36, variation=2, sample_rate=16000)
        c, _ = synthesize('bass.sub_sine', 36, variation=1, sample_rate=16000)
        self.assertFalse(np.array_equal(a,b))
        self.assertTrue(np.array_equal(a,c))

    def test_pitch_resampling_suppresses_out_of_band_aliases(self):
        try:
            import numpy as np
            from render_mix_v4 import resample_rate
        except ImportError:
            self.skipTest('Optional audio dependencies are not installed')
        t=np.arange(32000)/32000
        y=resample_rate(np.sin(2*np.pi*12000*t),2)
        self.assertEqual(len(y),16000)
        self.assertLess(float(np.sqrt(np.mean(y[100:-100]**2))), .003)


class NeoSpcCliTests(unittest.TestCase):
    def test_midi_routes_sixteenth_melodic_lane_to_second_port(self) -> None:
        style = {'id':'many_lanes','title':'Many Lanes','category':'classical','bpm':120,'meter':'4/4','barLength':4,'beats':4,
                 'events':[{'inst':f'lane_{i:02}','role':'lead','kind':'note','midi':60+i,'beat':0,'duration':1,'velocity':90} for i in range(16)]}
        with tempfile.TemporaryDirectory() as temp:
            report = export_midis_v4.export(style, Path(temp))
            self.assertEqual(len({(lane['port'],lane['channel']) for lane in report['lanes']}), 16)
            self.assertEqual((report['lanes'][-1]['port'],report['lanes'][-1]['channel']), (1,0))
            self.assertIn(b'\xff\x21\x01\x01', (Path(temp)/'many_lanes.mid').read_bytes())
        self.assertEqual(midi_compat.MetaMessage('midi_port', port=1).encode(), b'\xff\x21\x01\x01')

    def test_midi_expression_respects_declared_quiet_return(self) -> None:
        style = {'barLength':4,'form':[{'name':'A','start_bar':0,'bars':4,'intensity':.8},{'name':'A3','start_bar':4,'bars':4,'intensity':.3}]}
        self.assertLess(export_midis_v4.expression_value(style,16,'lead'), export_midis_v4.expression_value(style,0,'lead'))

    def test_midi_releases_before_retrigger_on_same_tick(self) -> None:
        style = {'id':'retrigger','title':'Retrigger','category':'classical','bpm':120,'meter':'4/4','barLength':4,'beats':4,
                 'events':[{'inst':'piano','role':'lead','kind':'note','midi':60,'beat':beat,'duration':1,'velocity':90} for beat in [0,1]]}
        with tempfile.TemporaryDirectory() as temp:
            export_midis_v4.export(style, Path(temp))
            data = (Path(temp)/'retrigger.mid').read_bytes()
            self.assertLess(data.index(b'\x80\x3c'), data.rindex(b'\x90\x3c'))

    def test_midi_preserves_explicit_bongo_keys(self):
        style={'id':'bongos','title':'Bongos','category':'bachata','bpm':122,'meter':'4/4','barLength':4,'beats':4,
               'events':[{'inst':'tom','role':'tom','kind':'drum','midi':pitch,'beat':beat,'velocity':80} for beat,pitch in enumerate((60,61))]}
        with tempfile.TemporaryDirectory() as temp:
            export_midis_v4.export(style,Path(temp));data=(Path(temp)/'bongos.mid').read_bytes()
            self.assertIn(b'\x99\x3c\x50',data)
            self.assertIn(b'\x99\x3d\x50',data)

    def test_native_humanizer_keeps_rounded_loop_onsets_inside_cue(self) -> None:
        spec = copy.deepcopy(next(s for s in engine.SPECS['fantasy'] if s['slug'] == 'sleeping_dragon_court'))
        spec.update(seed=1121634134, architecture='period', contour='ascending', rest_ratio=.27, max_leap=7, tessitura=.5800000000000001)
        score = engine.compose(spec, 'fantasy', 'Fantasy')
        self.assertTrue(all(0 <= event['performance_beat'] < score['beats'] for event in score['events']))

    def test_written_role_rest_cuts_crossing_notes_and_preserves_other_roles(self) -> None:
        lead = {'kind':'note','role':'lead','beat':0,'duration':3}
        bass = {'kind':'note','role':'bass','beat':1,'duration':3}
        events = [lead, {'kind':'note','role':'lead','beat':1.5,'duration':.3}, bass]
        report = engine.apply_written_rests(events, {'bars':4,'role_rests':[{'start_bar':1,'end_bar':2,'roles':['lead']}]}, 1)
        self.assertEqual(events, [lead, bass])
        self.assertEqual(lead['duration'], 1)
        self.assertEqual(bass['duration'], 3)
        self.assertEqual(report, {'declared_windows':1,'events_removed':1,'notes_shortened':1})

    def test_authored_contract_drives_phrase_spans_and_harmonic_holds(self) -> None:
        records = engine.load_catalog_contracts()
        spec = copy.deepcopy(next(r['native_engine_contract'] for r in records if r['id'] == 'stars_without_distance'))
        # Explicit fixture: the catalog is allowed to change its authored form.
        spec['bars'] = 20
        spec['phrases'] = [{'bars':b,'kind':'consequent' if i==3 else 'antecedent','closing':i==3} for i,b in enumerate((5,2,8,5))]
        self.assertEqual([(p.start,p.bars) for p in engine.phrase_plan(spec)], [(0,5),(5,2),(7,8),(15,5)])
        chords = engine.chord_plan(spec)
        self.assertEqual(chords[0], chords[1])
        invalid = copy.deepcopy(spec)
        invalid['phrases'][0]['bars'] += 1
        with self.assertRaisesRegex(ValueError, 'fill the cue'):
            engine.phrase_plan(invalid)

    def test_low_choir_stays_within_factory_extension(self) -> None:
        spec = copy.deepcopy(next(s for s in engine.SPECS['classical'] if s['slug'] == 'marble_steps'))
        score = engine.compose(spec, 'classical', 'Classical & Experimental')
        choir = [e['midi'] for e in score['events'] if e['inst'] == 'choir_b']
        self.assertTrue(choir)
        self.assertGreaterEqual(min(choir), 36)

    def test_blueprint_subject_and_answer_are_consumed(self):
        record=engine.load_catalog_contracts()[0]
        spec=copy.deepcopy(record['native_engine_contract'])
        before=engine.compose(spec,record['category'],record['category_label'])
        spec['writing']['degrees'][1]+=2
        after=engine.compose(spec,record['category'],record['category_label'])
        a=[(e['beat'],e.get('midi')) for e in before['events'] if e['role']=='lead']
        b=[(e['beat'],e.get('midi')) for e in after['events'] if e['role']=='lead']
        self.assertNotEqual(a,b)
        self.assertEqual(before['sound_palette'],spec['writing']['palette'])
        self.assertEqual(before['writing_evidence']['answer'],spec['writing']['answer'])
        self.assertTrue(all(e['role'] not in ('pad','ensemble') for e in before['events']))

    def test_unknown_blueprint_grammar_is_rejected(self):
        record=engine.load_catalog_contracts()[0]
        spec=copy.deepcopy(record['native_engine_contract']);spec['writing']['grammar']='invented_style'
        with self.assertRaisesRegex(ValueError,'Unknown writing grammar'):
            engine.compose(spec,record['category'],record['category_label'])

    def test_doctor_and_benchmark_pass(self) -> None:
        self.assertEqual(neospc.doctor_issues(), [])
        benchmark = neospc.load_json(neospc.BENCHMARK_PATH)
        self.assertEqual(neospc.validate_catalog(benchmark), [])
        self.assertEqual(len(benchmark["styles"]), sum(c['required_examples'] for c in neospc.load_json(neospc.DATA / 'category-benchmark-contracts.json')['categories']))

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

    def test_genre_init_composes_its_groove_and_keeps_breakdown_in_contrast(self):
        import compose_from_plan
        for genre in ('bachata','trip_hop','trap','reggaeton'):
            with self.subTest(genre=genre), tempfile.TemporaryDirectory() as temp:
                project=Path(temp)/genre
                self.assertEqual(neospc.main(['init',str(project),'--title','New groove','--category',genre,'--bars','8','--seed','4']),0)
                plan=neospc.load_json(project/'composition-plan.json');harness=neospc.load_json(project/'generation-harness.json');blueprint=neospc.load_json(project/'score-blueprint.json')
                score,_=compose_from_plan.compose_project(plan,harness,blueprint)
                self.assertEqual(score['meter'],'4/4')
                self.assertEqual(blueprint['drop_bars'],[4])
                self.assertTrue(any(e['role']=='lead' and 20<=e['beat']<24 for e in score['events']))
                def onsets(inst):return {e['beat'] for e in score['events'] if e['inst']==inst and e['beat']<4}
                if genre=='bachata':
                    self.assertEqual(score['instrument_map']['guitar']['factory_label'],'Requinto Guitar')
                    self.assertEqual({e['midi'] for e in score['events'] if e['inst']=='tom'},{60,61})
                elif genre=='trip_hop':
                    self.assertTrue(any(e['inst']=='hat' and e['performance_beat']>e['beat']+.04 for e in score['events']))
                    self.assertTrue({1,3}<=onsets('snare'))
                elif genre=='trap':
                    self.assertEqual(onsets('snare'),{2})
                    self.assertEqual(score['instrument_map']['sub']['factory_patch'],'bass.sub_sine')
                else:self.assertEqual(onsets('snare'),{.75,1.5,2.75,3.5})

    def test_genre_init_rejects_unsupported_meter_before_writing(self):
        with tempfile.TemporaryDirectory() as temp:
            project=Path(temp)/'invalid'
            self.assertEqual(neospc.main(['init',str(project),'--title','Invalid','--category','bachata','--meter','3/4']),2)
            self.assertFalse(project.exists())

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
            self.assertEqual(count_a, count_b)
            self.assertEqual(digest_a, digest_b)
            with zipfile.ZipFile(first) as archive:
                names = archive.namelist()
                unpacked_bytes = sum(info.file_size for info in archive.infolist())
            self.assertIn("game-music-composer/SKILL.md", names)
            self.assertIn("game-music-composer/LICENSE", names)
            self.assertIn("game-music-composer/agents/openai.yaml", names)
            # The installed Atelier extension grows the package past 100 files.
            # Check the published inventory and required entrypoints directly.
            manifest_names = ["game-music-composer/" + line.split("  ./", 1)[1]
                              for line in package_skill.MANIFEST.read_text(encoding="utf-8").splitlines()]
            self.assertCountEqual(names, manifest_names + ["game-music-composer/MANIFEST.sha256"])
            for entry in ("scripts/visualize_score.py", "scripts/refine_performance.py",
                          "resources/ensemble-atelier/template.html", "resources/ensemble-atelier/audio.js",
                          "references/canonical-compose-workflow.md"):
                self.assertIn("game-music-composer/" + entry, names)
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
