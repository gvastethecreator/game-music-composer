from __future__ import annotations
import importlib.util
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
SCRIPTS=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(SCRIPTS))
import visualize_score as viewer
CUE={'id':'fixture','title':'Fixture','bpm':96,'beats':8,'barLength':4,'meter':'4/4','events':[{'kind':'note','inst':'flute','role':'lead','midi':62,'beat':0,'duration':1,'velocity':80}],'instrument_map':{'flute':{}}}

class ViewerTests(unittest.TestCase):
    def test_five_standalone_demos(self):
        for mode in viewer.DEMOS:
            with self.subTest(mode=mode):
                doc=viewer.build_html(demo=mode)
                self.assertIn('AtelierStage',doc);self.assertIn('window.__GMC_INITIAL__=null',doc)
                self.assertNotIn('__STYLE__',doc);self.assertNotIn('<script src=',doc)
                self.assertNotIn('href="https://fonts',doc)
    def test_import_keeps_data_and_selects_catalog_cue(self):
        other={**CUE,'id':'other'}
        self.assertEqual(viewer.select_cue({'styles':[CUE,other]},1),other)
        self.assertEqual(viewer.select_cue({'score':CUE}),CUE)
        self.assertIn('window.__GMC_INITIAL__=',viewer.build_html(CUE))
    def test_script_injection_and_separators_escaped(self):
        title='</script><script>alert(1)</script>&\u2028\u2029'
        cue={**CUE,'title':title};doc=viewer.build_html(cue)
        self.assertNotIn(title,doc);self.assertIn('\\u003c/script\\u003e',doc)
        self.assertEqual(json.loads(viewer.script_json(cue)),cue)
    def test_invalid_shapes_indexes_and_nonfinite_rejected(self):
        for data,index in [(None,0),({},0),({'styles':[]},0),({'styles':[CUE]},2),(CUE,-1),(CUE,True),(CUE,1),({**CUE,'bpm':float('nan')},0),({**CUE,'events':[None]},0)]:
            with self.subTest(data=data,index=index),self.assertRaises(ValueError):viewer.select_cue(data,index)
    def test_no_import_into_generator_demo(self):
        with self.assertRaises(ValueError):viewer.build_html(CUE,demo='cycles')
    def test_never_overwrites(self):
        with tempfile.TemporaryDirectory() as temp:
            path=Path(temp)/'keep.html';path.write_text('keep')
            with self.assertRaises(FileExistsError):viewer.write_html(path,'replacement')
            self.assertEqual(path.read_text(),'keep')
    def test_all_assets_relocatable(self):
        with tempfile.TemporaryDirectory() as temp:
            target=Path(temp)/'assets';shutil.copytree(viewer.RESOURCES,target)
            self.assertEqual(viewer.build_html(CUE),viewer.build_html(CUE,resources=target))
    def test_cli_from_different_cwd(self):
        with tempfile.TemporaryDirectory() as temp:
            output=Path(temp)/'preview.html'
            result=subprocess.run([sys.executable,str(SCRIPTS/'visualize_score.py'),'--output',str(output),'--demo','pocket'],cwd=temp,capture_output=True)
            self.assertEqual(result.returncode,0,result.stderr.decode());self.assertGreater(output.stat().st_size,100000)
    def test_load_json_rejects_nan(self):
        with tempfile.TemporaryDirectory() as temp:
            source=Path(temp)/'bad.json';source.write_text('{"x":NaN}')
            with self.assertRaises(ValueError):viewer.load_json(source)

if __name__=='__main__':unittest.main()
