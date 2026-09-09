#!/usr/bin/env python3
"""Build five independent standalone labs and their offline launcher from skill assets."""
from __future__ import annotations
import argparse
import html
import json
from pathlib import Path
import sys

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'game-music-composer'/'scripts'))
from visualize_score import RESOURCES, build_html, script_json, write_html


def build(output: Path) -> None:
    output.mkdir(parents=True,exist_ok=False)
    (output/'qa'/'results').mkdir(parents=True)
    metadata=json.loads((RESOURCES/'ideas.json').read_text(encoding='utf-8'))
    pages={};meta={};cards=[]
    for ident,mode,title,headline,description,*_ in metadata:
        document=build_html(demo=mode)
        write_html(output/'ideas'/ident/'prototype.html',document)
        pages[ident]=document;meta[ident]={'title':title,'slug':mode}
        cards.append(f'<article><small>{ident} / LABORATORIO</small><h2>{html.escape(title)}</h2><h3>{html.escape(headline)}</h3><p>{html.escape(description)}</p><div class="actions"><button data-open="{ident}">Abrir laboratorio ↗</button><button data-file="{ident}">HTML</button></div></article>')
    style='''<style>:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:#080808;color:#ececec;font:15px/1.65 system-ui,sans-serif}main{max-width:1300px;margin:auto;padding:40px 28px}header,small{font:11px ui-monospace,monospace;color:#b3aa92;letter-spacing:.12em}header{padding:20px 28px;border-bottom:1px solid #41483d}h1{font-size:clamp(36px,5vw,60px);line-height:1.1;letter-spacing:-.05em}h2{font-size:25px;color:#debc85;margin-bottom:5px}h3{font-size:13px}p{color:#aaa;font-size:13px}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px;margin-top:30px}article{border:1px solid #444444;border-radius:12px;background:linear-gradient(#242424,#141414);padding:24px;display:flex;flex-direction:column}article p{flex:1}.actions{display:flex;gap:8px;margin-top:16px}button{font:13px system-ui,sans-serif;border:1px solid #80745b;background:#303030;color:#ebdfc2;border-radius:5px;padding:11px 14px;cursor:pointer}button:focus-visible{outline:2px solid #f4ce8b;outline-offset:3px}.actions button:first-child{background:#e79b24;color:#211507;flex:1}footer{margin-top:30px;border-top:1px solid #454a3e;padding-top:20px;font-size:12px;color:#aaa}#viewer{display:none;position:fixed;inset:0;z-index:3;background:#111111;grid-template-rows:52px 1fr}#viewer.open{display:grid}.bar{display:flex;gap:15px;align-items:center;padding:7px 14px}#download-current{margin-left:auto}#frame{width:100%;height:100%;border:0}#viewer-label{font-size:12px}@media(max-width:950px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:560px){main{padding:24px 16px}.grid{grid-template-columns:1fr}.bar{gap:7px}.bar button{padding:7px;font-size:11px}#viewer-label{max-width:140px;overflow:hidden;white-space:nowrap}}</style>'''
    script='''let current=null;const frame=document.getElementById('frame');function halt(){try{frame.contentWindow.LAB?.stop();}catch{}}function openLab(id){halt();current=id;frame.srcdoc=PAGES[id];document.getElementById('viewer-label').textContent=id+' / '+META[id].title;document.getElementById('viewer').classList.add('open');document.body.style.overflow='hidden';document.getElementById('close').focus();}function closeLab(){halt();frame.srcdoc='';document.getElementById('viewer').classList.remove('open');document.body.style.overflow='';document.querySelector('[data-open="'+current+'"]').focus();current=null;}function save(id){const url=URL.createObjectURL(new Blob([PAGES[id]],{type:'text/html;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=id+'-'+META[id].slug+'.html';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}document.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>openLab(b.dataset.open));document.querySelectorAll('[data-file]').forEach(b=>b.onclick=()=>save(b.dataset.file));document.getElementById('close').onclick=closeLab;document.getElementById('download-current').onclick=()=>{if(current)save(current);};document.addEventListener('visibilitychange',()=>{if(document.hidden)halt();});window.addEventListener('pagehide',halt);'''
    document='<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ensemble Atelier / Game Music Composer</title>'+style+'<header>GAME MUSIC COMPOSER / RONDA 03</header><main><small>INSTRUMENTOS · INTERPRETACIÓN · COMPOSICIÓN</small><h1>Una sala para escuchar.<br>Instrumentos para tocar.</h1><p>Cinco experiencias independientes. 59 identidades, 13 superficies instrumentales y 10 gramáticas de boceto. Sin APIs ni recursos externos.</p><div class="grid">'+''.join(cards)+'</div><footer>Audio sólo por interacción. Vista ampliada con notas tocables. Los sonidos son resíntesis original, no Factory Bank ni emulación acústica certificada. Las sesiones exportan JSON y WAV de boceto; no son masters ni stems.</footer></main><section id="viewer"><div class="bar"><button id="close">← Volver</button><span id="viewer-label"></span><button id="download-current">Guardar HTML</button></div><iframe id="frame" title="Laboratorio musical" allow="autoplay"></iframe></section><script>const PAGES='+script_json(pages)+';const META='+script_json(meta)+';'+script+'</script></html>'
    write_html(output/'index.html',document)


def main() -> int:
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',type=Path,default=Path('.scratch/ensemble-atelier'))
    args=parser.parse_args()
    try:build(args.output)
    except (OSError,ValueError) as exc:
        print(f'Build failed: {exc}',file=sys.stderr);return 2
    print(f'Created five labs and {args.output / "index.html"}');return 0

if __name__=='__main__':raise SystemExit(main())
