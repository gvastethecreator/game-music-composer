#!/usr/bin/env python3
"""Build pinned CC0 chamber recordings and two original synthesized palettes."""
import argparse,hashlib,json,re,sys,urllib.request,urllib.parse,copy
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import numpy as np,soundfile as sf
import build_soundbanks as builder
sys.path.insert(0,str(builder.SKILL/"scripts"))
import studio_timbres
REV="440300901dfe9275fd84e0b7763af1f8443ae62e"
BASE="https://raw.githubusercontent.com/sgossner/VSCO-2-CE/"+REV+"/"
FOLDERS={
"keys.lofi_piano":"Keys/Upright Nr1", "keys.prepared":"Keys/Upright Nr1",
"winds.flute":"Woodwinds/Flute/susvib", "winds.piccolo":"Woodwinds/Piccolo/Sus",
"winds.oboe":"Woodwinds/Oboe/Sus", "winds.clarinet":"Woodwinds/Clarinet/susLong",
"winds.bassoon":"Woodwinds/Bassoon/sus", "brass.horn":"Brass/F Horn/sus",
"brass.ensemble":"Brass/Trumpet/sus", "brass.trumpet":"Brass/Trumpet/sus", "brass.muted":"Brass/Trumpet/harmonM-sus",
"strings.soft":"Strings/Violin Section/susVib", "strings.bright":"Strings/Violin Section/susVib",
"strings.pizzicato":"Strings/Violin Section/Pizz", "strings.tremolo":"Strings/Violin Section/Trem",
"plucks.harp":"Strings/Harp", "bass.upright_pluck":"Strings/Solo Contrabass/Pizz", "bass.upright_soft":"Strings/Solo Contrabass/Pizz",
"bass.bowed_contrabass":"Strings/Solo Contrabass/SusVib", "mallets.marimba":"Percussion/Marimba"}

def finalize(out):
    manifest=builder.read(out/"original-sample-bank/sample-bank.json")
    manifest.update(provenance="Adapted CC0 VSCO 2 CE recordings and original project synthesis. See soundbank-provenance.json.",rendering_note="Compact projection of Chamber. Production masters use the multisample palettes.")
    builder.write(out/"original-sample-bank/sample-bank.json",manifest)
    receipt=builder.read(out/"verification.json")
    receipt["palette_generator_sha256"]=builder.sha(builder.SKILL/"scripts/studio_timbres.py")
    receipt["files"]={p.relative_to(out).as_posix():builder.sha(p) for p in out.rglob("*") if p.is_file() and p.name not in ("previous-banks.zip","verification.json")}
    builder.write(out/"verification.json",receipt)

def main():
    ap=argparse.ArgumentParser();ap.add_argument("output",type=Path);a=ap.parse_args();out=a.output.resolve()
    cache=builder.ROOT/".scratch/recorded-sources-v3";cache.mkdir(exist_ok=True)
    tree=json.loads(urllib.request.urlopen("https://api.github.com/repos/sgossner/VSCO-2-CE/git/trees/"+REV+"?recursive=1").read())["tree"]
    files=[r["path"] for r in tree if r["path"].endswith(".wav")];manifest=builder.read(builder.SKILL/"data/factory-bank-manifest.json")
    choices={};sources={}
    for patch in manifest["patches"]:
        folder=FOLDERS.get(patch["id"])
        if not folder:continue
        options=[]
        for path in files:
            if str(Path(path).parent).replace("\\","/")!=folder:continue
            m=re.search(r"_([A-G])(#?)([0-7])_",Path(path).name)
            if not m:continue
            root=(int(m[3])+(1 if "Upright Nr1" in folder else 2))*12+dict(C=0,D=2,E=4,F=5,G=7,A=9,B=11)[m[1]]+bool(m[2])
            velocity=54 if any(k in path for k in ("_v1_","_pp_","_v1.")) else 108
            options.append((path,root,velocity))
        if not options:raise ValueError(folder)
        for root in patch.get("roots",[patch.get("note",60)]):
            for vel in (54,108):
                for rr in (1,2):
                    ranked=sorted(options,key=lambda z:(abs(z[1]-root)*10+abs(z[2]-vel)/10,z[0]))
                    same=[z for z in ranked if z[1:]==ranked[0][1:]]
                    selected=same[(rr-1)%len(same)];choices[(patch["id"],root,vel,rr)]=selected
                    sources[selected[0]]={"path":selected[0],"root_midi":selected[1],"url":BASE+urllib.parse.quote(selected[0]),"license":"CC0-1.0"}
    def fetch(row):
        dest=cache/(hashlib.sha256(row["path"].encode()).hexdigest()[:20]+".wav")
        if not dest.exists():dest.write_bytes(urllib.request.urlopen(row["url"],timeout=60).read())
        row["sha256"]=builder.sha(dest);row["cache_file"]=dest.name
    with ThreadPoolExecutor(max_workers=6) as pool:list(pool.map(fetch,sources.values()))
    builder.write(cache/"sources.json",{"revision":REV,"sources":list(sources.values())})
    loaded={}
    def recorded(patch,root,vel,rr):
        keys=[k for k in choices if k[0]==patch]
        if not keys:return None
        key=min(keys,key=lambda k:abs(k[1]-root)*100+abs(k[2]-vel)+abs(k[3]-rr))
        path,midi,_=choices[key];row=sources[path]
        if path not in loaded:
            x,sr=sf.read(cache/row["cache_file"],dtype="float32");x=x.mean(axis=1) if x.ndim>1 else x;loaded[path]=(x,sr,midi)
        return loaded[path]
    builder.VERSION=studio_timbres.VERSION
    builder.synthesize=lambda p,m,v,r,s,l:studio_timbres.render(p,m,v,r,s,l,"chamber",recorded(p,m,v,r))
    builder.build(out)
    factory=builder.read(out/"factory-bank-manifest.json")
    factory.update(name="Chamber / Recorded + Synth",origin="VSCO 2 CE CC0 recordings by Versilian Studios; original synthesis for other patches.")
    for patch in factory["patches"]:patch["source_kind"]="recorded" if patch["id"] in FOLDERS else "synthesized"
    builder.write(out/"factory-bank-manifest.json",factory)
    jsfile=out/"data/factory-bank.js";data=json.loads(jsfile.read_text().split("=",1)[1].rstrip(";\n"));data.update(name=factory["name"],origin=factory["origin"])
    for patch in factory["patches"]:data["patches"][patch["id"]]["source_kind"]=patch["source_kind"]
    builder.js(jsfile,"NEOSPC_FACTORY_BANK",data)
    banks={}
    for palette in ("velvet","circuit"):
        bank=copy.deepcopy(data);bank.update(name="Velvet / Tines + Tape" if palette=="velvet" else "Circuit / Dual Oscillator",samples={},sample_sources={},origin="Original CC0 synthesis: studio_timbres.py")
        for patch in bank["patches"].values():
            chunk={};chunk_name="data/banks/"+palette+"_"+patch["id"].replace(".","_")+".js"
            for reg in patch["profiles"]["neo16"]["regions"]:
                reg["file"]=palette+"/"+reg["file"];file=out/reg["file"];file.parent.mkdir(parents=True,exist_ok=True)
                vel=54 if reg["hivel"]==79 else 108
                y,loop=studio_timbres.render(patch["id"],reg["root"],vel,reg["rr"],32000,bool(reg["loop"]),palette)
                assert np.isfinite(y).all() and 0<np.max(np.abs(y))<.9
                sf.write(file,y,32000,subtype="PCM_16");reg["loop"]=loop
                chunk[reg["file"]]=builder.embedded(file);bank["sample_sources"][reg["file"]]=chunk_name
            (out/chunk_name).write_text("Object.assign(window.NEOSPC_PALETTES."+palette+".samples,"+json.dumps(chunk,separators=(",",":"))+");\n",encoding="utf-8",newline="\n")
        banks[palette]=bank;print("Built",palette,flush=True)
    builder.js(out/"data/studio-palettes.js","NEOSPC_PALETTES",banks)
    provenance={"version":"3.0.0","license":"CC0-1.0","author":"Versilian Studios / Sam Gossner (recordings); Game Music Composer (synthesis and mapping)","source_page":"https://versilian-studios.com/vsco-community/","revision":REV,"recordings":list(sources.values()),"palettes":["chamber","velvet","circuit"]}
    builder.write(out/"soundbank-provenance.json",provenance)
    receipt=builder.read(out/"verification.json")
    receipt["palette_generator_sha256"]=builder.sha(builder.SKILL/"scripts/studio_timbres.py")
    receipt["files"]={p.relative_to(out).as_posix():builder.sha(p) for p in out.rglob("*") if p.is_file() and p.name not in ("previous-banks.zip","verification.json")}
    builder.write(out/"verification.json",receipt)
    finalize(out)
    print("Ready",len(sources),"recordings; 3 x 50 patches",flush=True)
if __name__=="__main__":main()
