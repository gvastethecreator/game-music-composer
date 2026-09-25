/* GMC studio engine · musical core.
   Composition, harmony, arpeggiation, performance, clips, sections, automation,
   synthesis and export ported from UMBRA 8 (same author). Everything runs in this
   closure: no globals, no DOM, no network. The host supplies optional hooks. */
(function(root){
'use strict';
const host={notify(){},render(){},restart(){},history(){},persist(){},update(){}};
let engine=null,previewEngine=null;
// Host bridges for inherited edit operations. UMBRA's own UI is not part of GMC.
function setStatus(){}
function toast(text,error=false){host.notify(text,error);}
// Persisting syncs the edited section frame and invalidates the phrase cache (UMBRA 7).
function persist(){if(state.studio)saveSection7();ui7.revision++;scoreMemo7.clear();host.persist(state);}
function renderAll(){host.render(state);}
function invalidateLive(){}
function clearLive(){}
function releasePreview(){}
function stopBankPreview7(){}
function restartIfPlaying(was){host.restart(was);}
function updateHistoryButtons(){host.history(ui.undo.length,ui.redo.length);}
function undo(){if(!ui.undo.length||ui.rendering)return false;ui.redo.push(clone(state));state=ui.undo.pop();ui.bar=Math.min(ui.bar,state.bars-1);ui.note=null;scoreMemo7.clear();updateHistoryButtons();renderAll();persist();return true;}
function redo(){if(!ui.redo.length||ui.rendering)return false;ui.undo.push(clone(state));state=ui.redo.pop();ui.bar=Math.min(ui.bar,state.bars-1);ui.note=null;scoreMemo7.clear();updateHistoryButtons();renderAll();persist();return true;}
// Undo keeps at most 32 states and 32 MB of serialized text.
function trimUndo7(){let bytes=0;for(let i=ui.undo.length-1;i>=0;i--){bytes+=JSON.stringify(ui.undo[i]).length;if(bytes>32*1024*1024||ui.undo.length-i>32){ui.undo.splice(0,i+1);break;}}}
function checkpoint(){ui.undo.push(clone(state));trimUndo7();ui.redo=[];updateHistoryButtons();}
function rememberUndo(before){if(sameJSON(before,state))return;ui.undo.push(before);trimUndo7();ui.redo=[];updateHistoryButtons();}
function changed({recompose=false,respectLocks=true,restart=false}={}){if(recompose)generateAll({respectLocks});host.update(state,{restart});persist();}
// A fresh composition from a preset and seed, leaving the session untouched.
function composeFresh(seed,presetId='nocturne'){const original=state,originalBar=ui.bar,originalNote=ui.note;try{state=defaultState();applyPreset(presetId,true);state.seed=String(seed).slice(0,64)||'UMBRA';generateAll({respectLocks:false});return clone(state);}finally{state=original;ui.bar=originalBar;ui.note=originalNote;}}
// One reversible transaction: failures restore the previous session exactly.
function commit7(fn,{restart=false,message=null}={}){if(ui.rendering)return false;const before=clone(state),undoBefore=ui.undo.slice(),redoBefore=ui.redo.slice();checkpoint();try{fn();ui7.revision++;saveSection7();host.update(state,{restart});persist();if(message)toast(message);return true;}catch(err){state=before;ui.undo=undoBefore;ui.redo=redoBefore;ui7.revision++;scoreMemo7.clear();updateHistoryButtons();toast(err.message,true);return false;}}





'use strict';
/* UMBRA 2.0 — standalone. No libraries, external assets, fetches or telemetry.
   Sections: score/state -> deterministic composer -> synthesis -> clock -> UI -> file formats.
   Project schema: { schema:'umbra-project', version:1, state:{...} }.
   Musical meter is intentionally 4/4, with 16 steps per bar. */
// ── 1. Score model, musical dictionaries and deterministic composition ──────────
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const mod=(n,m)=>((n%m)+m)%m;
const clone=o=>JSON.parse(JSON.stringify(o));
const noteNames=['C','C♯','D','E♭','E','F','F♯','G','A♭','A','B♭','B'];
const noteName=(n,oct=false)=>noteNames[mod(n,12)]+(oct?Math.floor(n/12)-1:'');
const midiHz=n=>440*Math.pow(2,(n-69)/12);
const scaleDefs={
 minor:{name:'Menor natural',short:'AEOLIAN',notes:[0,2,3,5,7,8,10]},
 major:{name:'Mayor',short:'IONIAN',notes:[0,2,4,5,7,9,11]},
 dorian:{name:'Dórica',short:'DORIAN',notes:[0,2,3,5,7,9,10]},
 phrygian:{name:'Frigia',short:'PHRYGIAN',notes:[0,1,3,5,7,8,10]},
 lydian:{name:'Lidia',short:'LYDIAN',notes:[0,2,4,6,7,9,11]},
 mixolydian:{name:'Mixolidia',short:'MIXOLYDIAN',notes:[0,2,4,5,7,9,10]},
 harmonic:{name:'Menor armónica',short:'HARMONIC',notes:[0,2,3,5,7,8,11]},
 melodic:{name:'Menor melódica',short:'MELODIC',notes:[0,2,3,5,7,9,11]},
 pentminor:{name:'Pentatónica menor',short:'PENT. MIN',notes:[0,3,5,7,10],harmony:'minor'},
 pentmajor:{name:'Pentatónica mayor',short:'PENT. MAJ',notes:[0,2,4,7,9],harmony:'major'},
 whole:{name:'Tonos enteros',short:'WHOLE TONE',notes:[0,2,4,6,8,10]}
};
const progressions={
 nocturne:{name:'Nocturna · I–VI–III–VII',degrees:[0,5,2,6]},
 home:{name:'Retorno · I–IV–V–I',degrees:[0,3,4,0]},
 falling:{name:'Descendente · I–VII–VI–V',degrees:[0,6,5,4]},
 drift:{name:'Deriva · I–IV–I–VI',degrees:[0,3,0,5]},
 soul:{name:'Circular · II–V–I–VI',degrees:[1,4,0,5]},
 lift:{name:'Apertura · I–V–VI–IV',degrees:[0,4,5,3]},
 modal:{name:'Modal · I–II–I–VII',degrees:[0,1,0,6]},
 orbit:{name:'Órbita · I–III–VI–IV',degrees:[0,2,5,3]},
 pedal:{name:'Pedal · I–I–IV–I',degrees:[0,0,3,0]},
 tension:{name:'Suspenso · I–VI–IV–V',degrees:[0,5,3,4]},
 custom:{name:'Personalizada · editar tarjetas',degrees:[0,5,2,6]}
};
const sounds={
 kickRound:{name:'Bombo redondo',engine:'SENO · PITCH ENVELOPE',kind:'kick'},
 kick808:{name:'Bombo 808 largo',engine:'SUB · COLA RESONANTE',kind:'kick'},
 kickTight:{name:'Bombo compacto',engine:'SENO · TRANSITORIO CORTO',kind:'kick'},
 snareDust:{name:'Caja de cinta',engine:'RUIDO + CUERPO TONAL',kind:'snare'},
 snareBrush:{name:'Escobilla sintética',engine:'RUIDO FILTRADO',kind:'snare'},
 clap:{name:'Clap analógico',engine:'RUIDO · MULTIENVOLVENTE',kind:'snare'},
 hatSoft:{name:'Hi-hat suave',engine:'RUIDO PASA ALTOS',kind:'hat'},
 hatMetal:{name:'Hi-hat metálico',engine:'OSCILADORES INARMÓNICOS',kind:'hat'},
 shaker:{name:'Shaker de ruido',engine:'RUIDO · BANDA RESONANTE',kind:'hat'},
 openSoft:{name:'Abierto aterciopelado',engine:'RUIDO · COLA ABIERTA',kind:'open'},
 openMetal:{name:'Abierto metálico',engine:'METAL SINTÉTICO · CHOKE',kind:'open'},
 rim:{name:'Rim seco',engine:'ADITIVA · IMPULSO',kind:'perc'},
 conga:{name:'Conga sintética',engine:'SENO · MEMBRANA',kind:'perc'},
 wood:{name:'Bloque de madera',engine:'ADITIVA · RESONANCIA',kind:'perc'},
 cowbell:{name:'Cencerro analógico',engine:'CUADRADAS INARMÓNICAS',kind:'perc'},
 sub:{name:'Sub cálido',engine:'SENO + TRIÁNGULO',kind:'bass'},
 analog:{name:'Bajo analógico',engine:'SUSTR ACTIVA · SIERRA + SUB',kind:'bass'},
 fmbass:{name:'Bajo FM',engine:'FM · RATIO 2:1',kind:'bass'},
 acid:{name:'Bajo resonante',engine:'SIERRA · FILTRO RESONANTE',kind:'bass'},
 electric:{name:'Piano eléctrico FM',engine:'FM · TINE + FUNDAMENTAL',kind:'keys'},
 softkeys:{name:'Teclas de fieltro',engine:'ADITIVA · ATAQUE SUAVE',kind:'keys'},
 organ:{name:'Órgano de armónicos',engine:'ADITIVA · 4 REGISTROS',kind:'keys'},
 pluck:{name:'Cuerda pulsada',engine:'KARPLUS–STRONG',kind:'keys'},
 tape:{name:'Pad de cinta',engine:'TRIÁNGULOS · DERIVA LENTA',kind:'pad'},
 strings:{name:'Cuerdas analógicas',engine:'SIERRAS DESAFINADAS',kind:'pad'},
 choir:{name:'Vocal sintético',engine:'ARMÓNICOS · FORMANTES',kind:'pad'},
 glass:{name:'Cristal FM',engine:'FM · RATIO INARMÓNICO',kind:'arp'},
 bell:{name:'Campana suave',engine:'FM · PARCIALES METÁLICOS',kind:'arp'},
 marimba:{name:'Marimba sintética',engine:'ADITIVA · PARCIAL 4×',kind:'arp'},
 chip:{name:'Pulso 25%',engine:'TABLA DE ONDA · PULSE',kind:'arp'},
 sinelead:{name:'Seno expresivo',engine:'SENO · VIBRATO',kind:'lead'},
 flute:{name:'Flauta sintética',engine:'ADITIVA + AIRE',kind:'lead'},
 reed:{name:'Viento analógico',engine:'SUSTR ACTIVA · VIBRATO',kind:'lead'}
};
const trackDefs=[
 {id:'kick',name:'Bombo',short:'Bombo',icon:'kick',color:'#d4ad79',midi:36,drum:true,voices:['kickRound','kick808','kickTight'],volume:.80,pan:0,send:.03,delay:0},
 {id:'snare',name:'Caja',short:'Caja',icon:'snare',color:'#d4ad79',midi:38,drum:true,voices:['snareDust','snareBrush','clap','rim'],volume:.61,pan:-.05,send:.13,delay:.06},
 {id:'hat',name:'Hi-hat',short:'Hi-hat',icon:'hat',color:'#d4ad79',midi:42,drum:true,voices:['hatSoft','hatMetal','shaker'],volume:.46,pan:.17,send:.08,delay:.03},
 {id:'open',name:'Abierto',short:'Abierto',icon:'hat',color:'#d4ad79',midi:46,drum:true,voices:['openSoft','openMetal','shaker'],volume:.38,pan:.27,send:.12,delay:.08},
 {id:'perc',name:'Percusión',short:'Perc.',icon:'perc',color:'#d4ad79',midi:75,drum:true,voices:['rim','conga','wood','cowbell'],volume:.48,pan:-.30,send:.17,delay:.22},
 {id:'bass',name:'Bajo',short:'Bajo',icon:'bass',color:'#aabed3',drum:false,voices:['sub','analog','fmbass','acid'],volume:.78,pan:0,send:.02,delay:0},
 {id:'keys',name:'Acordes',short:'Acordes',icon:'keys',color:'#bcb2ff',drum:false,voices:['electric','softkeys','organ','pluck','marimba'],volume:.62,pan:-.12,send:.32,delay:.19},
 {id:'pad',name:'Atmósfera',short:'Pad',icon:'pad',color:'#bcb2ff',drum:false,voices:['tape','strings','choir','organ'],volume:.47,pan:.05,send:.58,delay:.10},
 {id:'arp',name:'Arpegio',short:'Arpegio',icon:'arp',color:'#bcb2ff',drum:false,voices:['pluck','glass','bell','marimba','chip','electric'],volume:.46,pan:.24,send:.38,delay:.38},
 {id:'lead',name:'Melodía',short:'Melodía',icon:'lead',color:'#bcb2ff',drum:false,voices:['sinelead','flute','reed','glass','chip','electric'],volume:.48,pan:-.18,send:.36,delay:.30}
];
const trackMap=Object.fromEntries(trackDefs.map(x=>[x.id,x]));
const patternDefs={
 drum:{preset:'Groove del preset',euclid:'Euclidiano / 16',four:'Pulso a negras',half:'Medio tiempo',broken:'Quebrado',sparse:'Espaciado'},
 bass:{sync:'Raíz + síncopas',root:'Raíz sostenida',walking:'Bajo caminante',octaves:'Octavas',pulse:'Pulso constante'},
 keys:{sustain:'Acorde sostenido',stabs:'Acentos sincopados',offbeat:'Contratiempos',broken:'Acorde desgranado'},
 pad:{sustain:'Nube sostenida',breath:'Respiración'},
 arp:{up:'Ascendente',down:'Descendente',pendulum:'Pendular',skip:'Saltos de terceras',random:'Orden sembrado',euclid:'Euclidiano / 16'},
 lead:{phrase:'Motivo + respuesta',call:'Llamada y silencio',sparse:'Notas suspendidas',cascade:'Cascada melódica'}
};
const grooves={
 trip:{kick:[0,6,10],snare:[4,12],hat:[0,2,4,6,8,10,12,14],open:[7,15],perc:[3,11]},
 dub:{kick:[8],snare:[8],hat:[2,6,10,14],open:[14],perc:[5,13]},
 house:{kick:[0,4,8,12],snare:[4,12],hat:[0,2,4,6,8,10,12,14],open:[2,6,10,14],perc:[3,10]},
 bossa:{kick:[0,6,8,14],snare:[0,3,6,10,14],hat:[0,2,4,6,8,10,12,14],open:[14],perc:[2,5,9,12]},
 ambient:{kick:[0],snare:[],hat:[2,10],open:[],perc:[7]},
 garage:{kick:[0,7,10],snare:[4,12],hat:[0,3,6,8,11,14],open:[6,14],perc:[3,9,15]},
 electro:{kick:[0,6,8,11],snare:[4,12],hat:[2,6,10,14],open:[14],perc:[3,10,15]},
 broken:{kick:[0,5,10],snare:[4,11,12],hat:[0,2,5,7,8,10,13,15],open:[7,14],perc:[3,6,11]},
 soul:{kick:[0,7,10],snare:[4,12],hat:[0,2,4,6,8,10,12,14],open:[14],perc:[3,11]},
 ritual:{kick:[0,6,10],snare:[8],hat:[3,7,11,15],open:[15],perc:[0,3,6,10,13]},
 cinema:{kick:[0],snare:[],hat:[],open:[],perc:[6,13]},
 chip:{kick:[0,6,8],snare:[4,12],hat:[0,2,4,6,8,10,12,14],open:[14],perc:[7,15]}
};
const presets=[
 {id:'nocturne',name:'Nocturno magnético',desc:'Trip-hop lento. Teclas oscuras, sub redondo y una batería con espacio para respirar.',genre:'trip',bpm:82,root:2,scale:'minor',progression:'nocturne',voicing:'ninth',density:54,complexity:45,variation:38,human:56,swing:25,voices:['kickRound','snareDust','hatSoft','openSoft','rim','sub','electric','tape','pluck','flute'],patterns:{bass:'sync',keys:'stabs',arp:'pendulum',lead:'phrase'},master:{reverb:27,delay:23,duck:16,cutoff:12500}},
 {id:'dub',name:'Ecos bajo el agua',desc:'Dub profundo. Contratiempos de órgano, bajo lento y repeticiones filtradas en estéreo.',genre:'dub',bpm:74,root:4,scale:'dorian',progression:'pedal',voicing:'seventh',density:45,complexity:37,variation:44,human:45,swing:14,voices:['kickRound','rim','shaker','openSoft','conga','sub','organ','tape','marimba','sinelead'],patterns:{bass:'sync',keys:'offbeat',arp:'skip',lead:'sparse'},master:{reverb:31,delay:43,feedback:47,duck:12,cutoff:9500}},
 {id:'micro',name:'Geometría nocturna',desc:'Microhouse contenido. Bombo estable, pequeñas síncopas y acordes cortos de fieltro.',genre:'house',bpm:118,root:7,scale:'dorian',progression:'soul',voicing:'seventh',density:61,complexity:57,variation:36,human:29,swing:29,voices:['kickTight','clap','hatMetal','openMetal','wood','analog','softkeys','strings','glass','sinelead'],patterns:{bass:'octaves',keys:'stabs',arp:'euclid',lead:'call'},master:{reverb:16,delay:19,duck:35,cutoff:15000}},
 {id:'bossa',name:'Patio de mercurio',desc:'Bossa electrónica. Cuerda pulsada, congas sintéticas y melodías de flauta entre silencios.',genre:'bossa',bpm:100,root:0,scale:'major',progression:'soul',voicing:'ninth',density:58,complexity:58,variation:45,human:65,swing:8,voices:['kickRound','rim','shaker','openSoft','conga','fmbass','pluck','tape','marimba','flute'],patterns:{bass:'walking',keys:'stabs',arp:'skip',lead:'phrase'},master:{reverb:22,delay:13,duck:8,cutoff:15500}},
 {id:'ambient',name:'Horizonte de vidrio',desc:'Ambient luminoso. Acordes largos, resonancias de cristal y percusión apenas insinuada.',genre:'ambient',bpm:66,root:5,scale:'lydian',progression:'drift',voicing:'ninth',density:28,complexity:25,variation:52,human:42,swing:0,voices:['kickRound','snareBrush','shaker','openSoft','wood','sub','softkeys','strings','glass','sinelead'],patterns:{bass:'root',keys:'sustain',arp:'pendulum',lead:'sparse'},master:{reverb:63,delay:37,duck:0,cutoff:13000}},
 {id:'garage',name:'Andén de madrugada',desc:'UK garage. Bombo desplazado, hats con swing y pequeñas frases que se contestan.',genre:'garage',bpm:132,root:6,scale:'minor',progression:'nocturne',voicing:'seventh',density:63,complexity:69,variation:45,human:40,swing:48,voices:['kickTight','snareDust','hatMetal','openMetal','rim','fmbass','electric','tape','glass','reed'],patterns:{bass:'sync',keys:'stabs',arp:'skip',lead:'call'},master:{reverb:20,delay:22,duck:29,cutoff:15500}},
 {id:'electro',name:'Circuito oblicuo',desc:'Electro de líneas limpias. Bajo resonante, percusión metálica y un arpegio anguloso.',genre:'electro',bpm:126,root:9,scale:'phrygian',progression:'modal',voicing:'triad',density:57,complexity:64,variation:39,human:17,swing:10,voices:['kick808','clap','hatMetal','openMetal','cowbell','acid','organ','strings','chip','reed'],patterns:{bass:'pulse',keys:'offbeat',arp:'skip',lead:'call'},master:{reverb:17,delay:21,duck:30,cutoff:15000}},
 {id:'broken',name:'Órbita imperfecta',desc:'Broken beat. Percusión entrelazada, piano eléctrico y bajo que esquiva las negras.',genre:'broken',bpm:108,root:10,scale:'dorian',progression:'orbit',voicing:'ninth',density:66,complexity:74,variation:61,human:69,swing:24,voices:['kickRound','snareDust','shaker','openSoft','conga','fmbass','electric','choir','marimba','flute'],patterns:{bass:'sync',keys:'broken',arp:'euclid',lead:'phrase'},master:{reverb:23,delay:21,duck:16,cutoff:14200}},
 {id:'soul',name:'Terciopelo lunar',desc:'Neo-soul de bolsillo. Novenas, notas fantasma y un motivo breve sobre un pulso relajado.',genre:'soul',bpm:86,root:3,scale:'major',progression:'soul',voicing:'ninth',density:48,complexity:52,variation:46,human:76,swing:35,voices:['kickRound','snareBrush','hatSoft','openSoft','rim','sub','electric','tape','pluck','sinelead'],patterns:{bass:'walking',keys:'stabs',arp:'pendulum',lead:'phrase'},master:{reverb:25,delay:18,duck:10,cutoff:11800}},
 {id:'ritual',name:'Círculo de ceniza',desc:'Ritual modal. Pulsos euclidianos, madera resonante y una voz sintética suspendida.',genre:'ritual',bpm:94,root:2,scale:'phrygian',progression:'modal',voicing:'sus',density:57,complexity:62,variation:58,human:53,swing:6,voices:['kick808','snareBrush','shaker','openSoft','wood','sub','organ','choir','bell','reed'],patterns:{bass:'root',keys:'sustain',perc:'euclid',arp:'euclid',lead:'sparse'},master:{reverb:45,delay:30,duck:13,cutoff:10500}},
 {id:'cinema',name:'Arquitectura vacía',desc:'Cine oscuro. Menor armónica, bajos espaciados y capas que aparecen sin apurarse.',genre:'cinema',bpm:62,root:1,scale:'harmonic',progression:'tension',voicing:'triad',density:31,complexity:32,variation:49,human:43,swing:0,voices:['kick808','snareBrush','hatSoft','openSoft','conga','sub','softkeys','choir','bell','flute'],patterns:{bass:'root',keys:'sustain',arp:'down',lead:'sparse'},master:{reverb:58,delay:29,duck:5,cutoff:10500}},
 {id:'chip',name:'Satélite de bolsillo',desc:'Chiptune expresivo. Pulsos estrechos, acordes desgranados y contornos melódicos claros.',genre:'chip',bpm:112,root:7,scale:'mixolydian',progression:'lift',voicing:'triad',density:65,complexity:54,variation:58,human:17,swing:0,voices:['kickTight','snareDust','hatSoft','openSoft','wood','analog','organ','tape','chip','chip'],patterns:{bass:'octaves',keys:'broken',arp:'up',lead:'cascade'},master:{reverb:14,delay:14,duck:20,cutoff:17000}}
];
function hash(str){let h=2166136261;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
function rng(seed){let a=typeof seed==='number'?seed:hash(String(seed));return()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
const chance=(r,p)=>r()<p;
const choose=(r,a)=>a[Math.floor(r()*a.length)];
function seedRandom(){try{const a=new Uint32Array(1);crypto.getRandomValues(a);return a[0].toString(36).toUpperCase();}catch{return Date.now().toString(36).toUpperCase();}}
function baseTrack(d){return{id:d.id,sound:d.voices[0],pattern:d.drum?'preset':Object.keys(patternDefs[d.id])[0],volume:d.volume,pan:d.pan,send:d.send,delay:d.delay,tone:d.id==='bass'?48:d.drum?62:57,decay:49,texture:35,attack:d.id==='pad'?55:10,octave:0,density:82,pulses:d.id==='arp'?7:5,rotation:0,mute:false,solo:false,locked:false,revision:0};}
function defaultState(){return{preset:'nocturne',genre:'trip',bpm:82,root:2,scale:'minor',progression:'nocturne',degrees:[0,5,2,6],voicing:'ninth',bars:8,structure:'loop',seed:'AFTER-HOURS',mutation:0,density:54,complexity:45,variation:38,human:56,swing:25,master:{volume:72,cutoff:12500,reverb:27,delay:23,feedback:33,division:.75,duck:16},tracks:trackDefs.map(baseTrack),patterns:{}};}
let state=defaultState();
const ui={selected:'keys',bar:0,view:'live',follow:true,loop:true,playing:false,starting:false,step:-1,absStep:0,section:0,note:null,rollLow:48,rollRows:29,undo:[],redo:[],rendering:false,storage:true};
function scaleNotes(s=state,harmony=false){const def=scaleDefs[s.scale];return harmony&&def.harmony?scaleDefs[def.harmony].notes:def.notes;}
function scaleMidi(degree,octave=4,s=state,harmony=false){const a=scaleNotes(s,harmony);return s.root+12*(octave+1)+a[mod(degree,a.length)]+12*Math.floor(degree/a.length);}
function nearestScale(midi,s=state){let best=midi,delta=Infinity;for(let n=24;n<=108;n++)if(scaleNotes(s).includes(mod(n-s.root,12))&&Math.abs(n-midi)<delta){best=n;delta=Math.abs(n-midi);}return best;}
function nearestIn(midi,notes){return notes.reduce((a,b)=>Math.abs(b-midi)<Math.abs(a-midi)?b:a,notes[0]);}
function chordDegree(bar,s=state){return mod(s.degrees[Math.min(3,Math.floor(bar/(s.bars/4)))],scaleNotes(s,true).length);}
function chordRoot(bar,s=state,oct=2){return scaleMidi(chordDegree(bar,s),oct,s,true);}
function chordRaw(degree,s=state){if(s.scale==='whole'){const ints=s.voicing==='triad'?[0,4,8]:s.voicing==='seventh'?[0,4,8,10]:s.voicing==='ninth'?[0,4,8,10,14]:[0,2,8];const root=s.root+48+2*mod(degree,6);return ints.map(n=>root+n);}const offsets=s.voicing==='triad'?[0,2,4]:s.voicing==='seventh'?[0,2,4,6]:s.voicing==='ninth'?[0,2,4,6,8]:[0,1,4];return offsets.map(x=>scaleMidi(degree+x,3,s,true));}
function chordLabel(degree,s=state){
 const n=chordRaw(degree,s),r=n[0],ints=n.map(x=>mod(x-r,12)),minor=ints[1]===3,dim=minor&&ints[2]===6,aug=ints[1]===4&&ints[2]===8;
 if(s.voicing==='sus')return noteName(r)+(ints[1]===1?'sus♭2':ints[1]===3?'sus♯2':'sus2')+(ints[2]===6?'(♭5)':ints[2]===8?'(♯5)':'');
 let quality=dim?'dim':aug?'+':minor?'m':'';
 if(s.voicing==='triad')return noteName(r)+quality;
 const seventh=ints[3],ninth=s.voicing==='ninth'?ints[4]:null,ext=ninth===2?'9':'7';
 if(dim)quality=seventh===9?'dim'+ext:seventh===10?'m'+ext+'♭5':'dim(maj'+ext+')';
 else if(seventh===11)quality+=minor?'(maj'+ext+')':'maj'+ext;
 else if(seventh===10)quality+=ext;
 else if(seventh===9)quality+=ninth===2?'6/9':'6';
 else quality+='(add'+ext+')';
 if(ninth!==null&&ninth!==2)quality+=ninth===1?'(♭9)':ninth===3?'(♯9)':'(add '+ninth+')';
 return noteName(r)+quality;
}
function chordVoicings(s=state){let prev=[57,60,64,67,71].slice(0,chordRaw(0,s).length);const out=[];for(let i=0;i<4;i++){const raw=chordRaw(mod(s.degrees[i],scaleNotes(s,true).length),s);let best=raw,bestScore=Infinity;for(let inv=0;inv<raw.length;inv++)for(let oct=-1;oct<=2;oct++){const v=raw.slice(inv).concat(raw.slice(0,inv).map(n=>n+12)).map(n=>n+12*oct).sort((a,b)=>a-b);if(v[0]<48||v.at(-1)>85)continue;const score=v.reduce((a,n,j)=>a+Math.abs(n-prev[Math.min(j,prev.length-1)]),0)+Math.abs(v.reduce((a,b)=>a+b)/v.length-64)*.3;if(score<bestScore){best=v;bestScore=score;}}out.push(best);prev=best;}return out;}
function roman(degree,s=state){const names=['I','II','III','IV','V','VI','VII'];const r=chordRaw(degree,{...s,voicing:'triad'}),minor=mod(r[1]-r[0],12)===3;return minor?names[degree%7].toLowerCase():names[degree%7];}
function emptyPattern(bars){return Array.from({length:bars},()=>Array(16).fill(null));}
function euclidean(pulses,steps=16,rotation=0){pulses=clamp(Math.round(pulses),0,steps);const result=[];for(let i=0;i<steps;i++)if(mod((i-rotation)*pulses,steps)<pulses)result.push(i);return result;}
function put(p,bar,step,n,v=.75,d=1){if(step<0||step>15)return;p[bar][step]={n:Array.isArray(n)?n:[n],v:clamp(v,.1,1),d:clamp(d,.2,16)};}
function generateTrack(tr,s=state){
 const def=trackMap[tr.id],r=rng(s.seed+'|'+s.mutation+'|'+tr.id+'|'+tr.revision),p=emptyPattern(s.bars),c=s.complexity/100,vary=s.variation/100,density=clamp(s.density/100*(tr.density/82),0,1),groove=grooves[s.genre]||grooves.trip,voicings=chordVoicings(s);
 if(density===0)return p;
 const motif=[0];for(let i=1;i<8;i++)motif.push(clamp(motif[i-1]+choose(r,[-2,-1,1,1,2,3]),-2,8));
 const rhythmMotif=choose(r,[[0,3,6,10,13],[0,2,7,8,12],[1,4,6,11,14],[0,4,7,10,12]]);
 for(let b=0;b<s.bars;b++){
  const deg=chordDegree(b,s),ch=voicings[harmonyIndex(b,s)],root=chordRoot(b,s),last=b===s.bars-1,fill=b%4===3;
  if(def.drum){
   let steps=tr.pattern==='euclid'?euclidean(tr.pulses,16,tr.rotation):tr.pattern==='four'?[0,4,8,12]:tr.pattern==='half'?(tr.id==='snare'?[8]:[0,8]):tr.pattern==='broken'?[0,3,7,10,14]:tr.pattern==='sparse'?[b%2?8:0]:(groove[tr.id]||[]).slice();
   if((s.genre==='ambient'||s.genre==='cinema')&&['kick','perc'].includes(tr.id)&&b%2)steps=[];
   for(const st of steps){
    const anchor=tr.id==='kick'?(st===0||s.genre==='dub'):tr.id==='snare'?st===4||st===12||st===8:false;
    const keep=tr.pattern==='euclid'?true:anchor?density>.05:chance(r,clamp(density*1.65,.02,1));
    if(!keep)continue;
    const base=tr.id==='kick'?.92:tr.id==='snare'?.83:st%4===0?.60:st%4===2?.71:.45;
    put(p,b,st,def.midi,base*(.88+r()*.18),tr.id==='open'?2.5:1);
   }
   if(tr.pattern!=='euclid'&&tr.pattern!=='sparse'){
    if(chance(r,c*density*.55)&&['kick','snare','perc'].includes(tr.id)){const step=choose(r,fill?[10,13,14,15]:[3,7,9,11,15]);if(!p[b][step])put(p,b,step,def.midi,tr.id==='snare'?.25:.45,.8);}
    if(tr.id==='hat'&&density>.62)for(const st of [3,7,11,15])if(chance(r,c*.7))put(p,b,st,def.midi,.28+r()*.15,.5);
    if(fill&&chance(r,vary)&&tr.id==='snare')for(const st of [14,15])if(chance(r,.3+c*.5))put(p,b,st,def.midi,.28+(st-14)*.15,.7);
   }
   continue;
  }
  if(tr.id==='bass'){
   let steps=tr.pattern==='root'?[0]:tr.pattern==='walking'?[0,4,8,12]:tr.pattern==='pulse'?[0,2,4,6,8,10,12,14]:tr.pattern==='octaves'?[0,3,6,8,11,14]:[0,...(groove.kick||[]).filter(x=>x>0),...((b%2||c>.5)?[14]:[])];
   steps=[...new Set(steps)].sort((a,b)=>a-b);
   steps.forEach((st,j)=>{if(j&&density<.4&&chance(r,.45))return;let n=root;while(n>47)n-=12;while(n<30)n+=12;
    if(tr.pattern==='walking'){n=ch[j%ch.length]-24;while(n<28)n+=12;while(n>52)n-=12;}
    else if(tr.pattern==='octaves'&&j%2)n+=12;
    else if(j>0&&chance(r,.22+c*.18))n=ch[(j%2?2:1)%ch.length]-24;while(n<28)n+=12;
    if(st>=14&&chance(r,vary+.15)){const next=chordRoot((b+1)%s.bars,s);n=nearestScale(next+(next>n?-2:2),s);while(n>52)n-=12;}
    const next=steps[j+1]??16;put(p,b,st,n,j===0?.91:.64+r()*.16,tr.pattern==='root'?14:Math.max(.6,(next-st)*(.61+r()*.2)));});
  }
  else if(tr.id==='keys'){
   let steps=tr.pattern==='sustain'?[0]:tr.pattern==='offbeat'?[2,6,10,14]:tr.pattern==='broken'?[0,3,6,10,13]:s.genre==='bossa'?[0,3,6,10,14]:choose(r,[[0,6,10],[0,7,12],[0,6],[2,8,14]]);
   steps.forEach((st,j)=>{if(j>0&&!chance(r,clamp(density+.36,.1,1)))return;const notes=tr.pattern==='broken'?(j%2?[ch[j%ch.length],ch[(j+2)%ch.length]]:[ch[0],ch[Math.min(2,ch.length-1)]]):ch;const dur=tr.pattern==='sustain'?14:tr.pattern==='offbeat'?1.2:tr.pattern==='broken'?2.4:3.4;
    put(p,b,st,notes,.64+r()*.12,dur);});
  }
  else if(tr.id==='pad'){
   if(tr.pattern==='breath'){put(p,b,0,ch.map(n=>n-12),.58,6.5);if(density>.4)put(p,b,10,ch,.36,4.5);}
   else if(b%2===0||density>.40||chance(r,density*1.4))put(p,b,0,ch.slice(0,Math.min(ch.length,2+Math.ceil(density*3))),.61,Math.min(15.7,9+density*12));
  }
  else if(tr.id==='arp'){
   let steps=tr.pattern==='euclid'?euclidean(tr.pulses,16,tr.rotation):density>.67?[0,2,4,6,8,10,12,14]:density>.38?[0,3,6,8,11,14]:[2,8,13];
   if(s.genre==='ambient')steps=[2,7,13];
   const pool=ch.concat(ch.slice(0,2).map(n=>n+12));
   steps.forEach((st,j)=>{if(tr.pattern!=='euclid'&&chance(r,(1-clamp(density,0,1))*.30)&&j>0)return;let idx=tr.pattern==='down'?pool.length-1-j%pool.length:tr.pattern==='pendulum'?Math.abs((j+b)%(2*pool.length-2)-(pool.length-1)):tr.pattern==='skip'?(j*2+b)%pool.length:tr.pattern==='random'?Math.floor(r()*pool.length):j%pool.length;
    let n=pool[idx];if(b%4===2&&chance(r,vary*.22))n+=12;while(n>96)n-=12;while(n<48)n+=12;put(p,b,st,n,.45+(st%4===0?.14:0)+r()*.10,1.2+(s.genre==='ambient'?1.5:0));});
  }
  else if(tr.id==='lead'){
   let steps=tr.pattern==='sparse'?(b%2?[6]:[0,10]):tr.pattern==='call'?(b%2?[]:[0,3,8,12]):tr.pattern==='cascade'?[0,2,4,6,8,11,14]:rhythmMotif.slice();
   if(tr.pattern==='phrase'&&b%4===2)steps=steps.slice(0,2);
   if(tr.pattern==='phrase'&&b%2===1)steps=steps.slice(0,3+(vary>.55?1:0)).map(st=>Math.min(15,st+(c>.6?1:0)));
   steps.forEach((st,j)=>{if(j>0&&!chance(r,clamp(density+.34,.05,1)))return;const direction=b%2?-1:1;let relative=motif[j%motif.length]*direction+(b%2?4:0);if(b>=4&&chance(r,vary*.35))relative+=choose(r,[-1,1]);let n=scaleMidi(relative,4,s);
    if(st%4===0){const chordPool=ch.flatMap(x=>[x,x+12]);n=nearestIn(n,chordPool);}
    if(last&&j===steps.length-1)n=scaleMidi(0,4,s);
    n=st%4===0?clamp(n,48,96):nearestScale(clamp(n,55,88),s);const next=steps[j+1]??16;let dur=tr.pattern==='sparse'?6.2:Math.max(.7,(next-st)*(.62+r()*.19));put(p,b,st,n,.57+(j===0?.11:0)+r()*.12,dur);});
  }
 }
 // A shared open/closed hat step is intentionally handled by the audio choke, not erased here.
 return p;
}
function generateAll({respectLocks=true}={}){for(const tr of state.tracks){if(respectLocks&&tr.locked&&state.patterns[tr.id]){const old=state.patterns[tr.id];state.patterns[tr.id]=Array.from({length:state.bars},(_,i)=>clone(old[i%old.length]));}else state.patterns[tr.id]=generateTrack(tr);}ui.bar=Math.min(ui.bar,state.bars-1);ui.note=null;}
function applyPreset(id,initial=false){const p=presets.find(x=>x.id===id)||presets[0];const old=initial?null:state;const next=defaultState();Object.assign(next,Object.fromEntries(['bpm','root','scale','progression','voicing','density','complexity','variation','human','swing','genre'].map(k=>[k,p[k]])));next.preset=p.id;next.degrees=progressions[p.progression].degrees.slice();next.seed=old?old.seed:'AFTER-HOURS';next.master={...next.master,...p.master};next.bars=old?old.bars:8;next.structure=old?old.structure:'loop';next.tracks.forEach((t,i)=>{t.sound=p.voices[i];t.pattern=p.patterns[t.id]||t.pattern;if(p.genre==='ambient'||p.genre==='cinema'){if(t.id==='kick')t.volume=.44;if(t.id==='arp')t.volume=.32;if(t.id==='pad')t.volume=.60;}if(p.genre==='dub'&&t.id==='keys'){t.delay=.57;t.send=.29;}if(p.genre==='chip'&&t.id==='pad')t.volume=.24;});state=next;generateAll({respectLocks:false});}
function totalBars(s=state){return s.bars*(s.structure==='journey'?4:1);}
function stepSeconds(s=state){return 60/s.bpm/4;}
function totalSeconds(s=state){return totalBars(s)*16*stepSeconds(s);}
function audible(tr,s=state){return !tr.mute&&(!s.tracks.some(t=>t.solo)||tr.solo);}
function arrangementLevel(id,absoluteBar,s=state){if(s.structure!=='journey')return 1;const section=Math.floor(absoluteBar/s.bars)%4,local=absoluteBar%s.bars;if(section===0){if(id==='pad'||id==='keys')return .75;if(id==='bass')return local>=s.bars/2?.80:0;if(id==='kick')return local>=s.bars/2?.75:0;if(id==='snare')return local>=s.bars*.75?.7:0;if(id==='hat')return local>=s.bars/4?.55:0;if(id==='lead')return local>=s.bars*.75?.65:0;if(id==='arp')return .65;return local>=s.bars/2?.5:0;}if(section===2){if(id==='kick'||id==='snare'||id==='open')return 0;if(id==='bass')return .6;if(id==='hat')return .35;if(id==='pad')return 1.12;return .7;}return section===3?1.04:1;}
// The same event transform is shared by live audio, offline WAV and MIDI.
function scoreEvents(absStep,s=state){const total=totalBars(s)*16,wrapped=mod(absStep,total),absoluteBar=Math.floor(wrapped/16),bar=absoluteBar%s.bars,step=wrapped%16,dt=stepSeconds(s),events=[];for(const tr of s.tracks){const e=s.patterns[tr.id]?.[bar]?.[step];if(!e||!audible(tr,s)||tr.volume<=0)continue;const section=arrangementLevel(tr.id,absoluteBar,s);if(section<=0)continue;const rand=rng(s.seed+'|feel|'+tr.id+'|'+wrapped),feel=s.human/100;const barDrift=(rng(s.seed+'|bar|'+tr.id+'|'+absoluteBar)()-.5)*.010*feel;const lag=tr.id==='snare'?.010*feel:0;const jitter=(rand()-.5)*.019*feel+barDrift+lag;const swing=step%2?dt*.58*s.swing/100:0;const velocity=clamp(e.v*section*(1+(rand()-.5)*.19*feel),.04,1);events.push({id:tr.id,tr,n:e.n.map(n=>clamp(n+(trackMap[tr.id].drum?0:tr.octave*12),12,119)),v:velocity,d:e.d*dt,offset:swing+jitter,strum:tr.id==='keys'?.008*feel:0,hash:hash(s.seed+'|audio|'+tr.id+'|'+wrapped)});}return events;}
// ── 2. Audio graph and synthesis. Every timbre is created from scratch. ────────
class SynthEngine{
 constructor(ctx,s,{offline=false}={}){
  this.ctx=ctx;this.state=s;this.offline=offline;this.nodes=[];this.channels={};this.voices=new Set();this.pluckCache=new Map();this.openHats=new Set();this.disposed=false;
  const N=(method,...args)=>{const node=ctx[method](...args);this.nodes.push(node);return node;};this.N=N;
  this.sum=N('createGain');this.highpass=N('createBiquadFilter');this.highpass.type='highpass';this.highpass.frequency.value=25;this.highpass.Q.value=.55;
  this.masterFilter=N('createBiquadFilter');this.masterFilter.type='lowpass';this.masterFilter.Q.value=.55;
  this.compressor=N('createDynamicsCompressor');this.compressor.threshold.value=-12;this.compressor.knee.value=15;this.compressor.ratio.value=3;this.compressor.attack.value=.004;this.compressor.release.value=.18;
  this.master=N('createGain');this.safety=N('createWaveShaper');const curve=new Float32Array(4097);for(let i=0;i<curve.length;i++){const x=i/(curve.length-1)*2-1;curve[i]=.985*Math.tanh(x*1.12)/Math.tanh(1.12);}this.safety.curve=curve;this.safety.oversample='2x';
  this.analyser=N('createAnalyser');this.analyser.fftSize=1024;this.analyser.smoothingTimeConstant=.75;
  this.output=N('createGain');this.sum.connect(this.highpass).connect(this.masterFilter).connect(this.compressor).connect(this.master).connect(this.safety).connect(this.analyser).connect(this.output).connect(ctx.destination);
  this.musicDuck=N('createGain');this.musicDuck.connect(this.sum);
  // Reverb impulse: seeded, stereo, decaying noise plus early reflections.
  this.reverbInput=N('createGain');this.convolver=N('createConvolver');this.convolver.normalize=true;this.convolver.buffer=this.createImpulse();
  this.reverbHP=N('createBiquadFilter');this.reverbHP.type='highpass';this.reverbHP.frequency.value=280;
  this.reverbLP=N('createBiquadFilter');this.reverbLP.type='lowpass';this.reverbLP.frequency.value=6400;
  this.reverbWet=N('createGain');this.reverbInput.connect(this.convolver).connect(this.reverbHP).connect(this.reverbLP).connect(this.reverbWet).connect(this.sum);
  // Stable, filtered, cross-fed stereo delay; feedback is clamped below unity.
  this.delayInput=N('createGain');this.delayL=N('createDelay',3);this.delayR=N('createDelay',3);
  this.delayFilterL=N('createBiquadFilter');this.delayFilterR=N('createBiquadFilter');for(const f of [this.delayFilterL,this.delayFilterR]){f.type='lowpass';f.frequency.value=3800;f.Q.value=.5;}
  this.feedbackL=N('createGain');this.feedbackR=N('createGain');this.panL=N('createStereoPanner');this.panR=N('createStereoPanner');this.panL.pan.value=-.72;this.panR.pan.value=.72;
  this.delayWet=N('createGain');this.delayInput.connect(this.delayL);this.delayL.connect(this.delayFilterL).connect(this.panL).connect(this.delayWet);this.delayFilterL.connect(this.feedbackL).connect(this.delayR);this.delayR.connect(this.delayFilterR).connect(this.panR).connect(this.delayWet);this.delayFilterR.connect(this.feedbackR).connect(this.delayL);this.delayWet.connect(this.sum);
  this.noise=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*2),ctx.sampleRate);const nd=this.noise.getChannelData(0),nr=rng('umbra-white-noise');for(let i=0;i<nd.length;i++)nd[i]=(nr()*2-1)*.8;
  this.pulseWave=this.makePulse(.25);
  for(const tr of s.tracks){const input=N('createGain'),filter=N('createBiquadFilter'),gain=N('createGain'),pan=N('createStereoPanner'),rev=N('createGain'),del=N('createGain');filter.type='lowpass';filter.Q.value=.55;input.connect(filter).connect(gain).connect(pan);pan.connect(trackMap[tr.id].drum?this.sum:this.musicDuck);pan.connect(rev).connect(this.reverbInput);pan.connect(del).connect(this.delayInput);this.channels[tr.id]={input,filter,gain,pan,rev,del,level:0};}
  this.initV2(s);this.update(s,true);
 }
 set(param,value,immediate=false){if(this.disposed)return;const now=this.ctx.currentTime;if(immediate){param.setValueAtTime(value,now);}else{param.cancelScheduledValues(now);param.setTargetAtTime(value,now,.022);}}
 update(s,immediate=false){if(this.disposed)return;this.state=s;const m=s.master;this.set(this.master.gain,m.volume/100*.68,immediate);this.set(this.masterFilter.frequency,Math.min(m.cutoff,this.ctx.sampleRate*.47),immediate);this.set(this.reverbWet.gain,m.reverb/100*1.5,immediate);this.set(this.delayWet.gain,m.delay/100*.9,immediate);const delayTime=60/s.bpm*m.division;this.set(this.delayL.delayTime,delayTime,immediate);this.set(this.delayR.delayTime,delayTime,immediate);this.set(this.feedbackL.gain,clamp(m.feedback/100,0,.65),immediate);this.set(this.feedbackR.gain,clamp(m.feedback/100,0,.65),immediate);for(const tr of s.tracks){const ch=this.channels[tr.id];this.set(ch.gain.gain,audible(tr,s)?tr.volume:0,immediate);this.set(ch.pan.pan,tr.pan,immediate);this.set(ch.rev.gain,tr.send,immediate);this.set(ch.del.gain,tr.delay,immediate);const cutoff=tr.id==='bass'?180+(tr.tone/100)**2*9000:900+(tr.tone/100)**1.7*19000;this.set(ch.filter.frequency,Math.min(this.ctx.sampleRate*.46,cutoff),immediate);}}
 makePulse(duty){const re=new Float32Array(65),im=new Float32Array(65);for(let n=1;n<65;n++){re[n]=2*Math.sin(2*Math.PI*n*duty)/(Math.PI*n);im[n]=2*(1-Math.cos(2*Math.PI*n*duty))/(Math.PI*n);}return this.ctx.createPeriodicWave(re,im);}
 createImpulse(){const len=Math.ceil(this.ctx.sampleRate*2.7),buf=this.ctx.createBuffer(2,len,this.ctx.sampleRate);for(let c=0;c<2;c++){const r=rng('umbra-space-'+c),a=buf.getChannelData(c);let last=0;for(let i=0;i<len;i++){last=.58*last+.42*(r()*2-1);const env=Math.pow(1-i/len,3.2);a[i]=last*env*(i<300?i/300:1);}for(const [delay,amp]of[[.025,.22],[.048,.17],[.079,.12],[.113,.09]]){const idx=Math.floor((delay+c*.003)*this.ctx.sampleRate);a[idx]+=amp;}}return buf;}
 pluckBuffer(midi,tr){const key=[midi,Math.round(tr.texture/10),Math.round(tr.decay/10)].join(':');if(this.pluckCache.has(key))return this.pluckCache.get(key);const sr=this.ctx.sampleRate,freq=midiHz(midi),period=sr/freq-.5,N=Math.max(3,Math.floor(period)),frac=period-N,ap=(1-frac)/(1+frac),r=rng('pluck|'+key),ring=new Float32Array(N);let mean=0;for(let i=0;i<N;i++){ring[i]=r()*2-1;mean+=ring[i];}mean/=N;for(let i=0;i<N;i++)ring[i]-=mean;const buf=this.ctx.createBuffer(1,Math.ceil(sr*4),sr),a=buf.getChannelData(0),loss=Math.pow(.001,1/(freq*(1.5+tr.decay*.025)));let index=0,last=0,px=0,py=0;for(let i=0;i<a.length;i++){const x=ring[index],avg=.5*(x+last);const y=ap*(avg-py)+px;px=avg;py=y;last=x;ring[index]=y*loss;index=(index+1)%N;a[i]=x*.70;}if(this.pluckCache.size>=48)this.pluckCache.delete(this.pluckCache.keys().next().value);this.pluckCache.set(key,buf);return buf;}
 voice(id,t,end){const v={id,t,end,nodes:[],sources:[],done:false};v.node=(method,...args)=>{const n=this.ctx[method](...args);v.nodes.push(n);return n;};v.osc=(type,freq,destination,gain=1,detune=0)=>{const o=v.node('createOscillator');if(type==='pulse')o.setPeriodicWave(this.pulseWave);else o.type=type;o.frequency.setValueAtTime(Math.min(Math.max(.01,freq),this.ctx.sampleRate*.47),t);o.detune.setValueAtTime(detune,t);if(gain!==1){const g=v.node('createGain');g.gain.value=gain;o.connect(g).connect(destination);}else o.connect(destination);v.sources.push(o);o.start(t);o.stop(end);return o;};v.noise=(dest,offset=0,gain=1)=>{const n=v.node('createBufferSource');n.buffer=this.noise;n.loop=true;if(gain!==1){const g=v.node('createGain');g.gain.value=gain;n.connect(g).connect(dest);}else n.connect(dest);v.sources.push(n);n.start(t,mod(offset,1.5));n.stop(end);return n;};v.cleanup=()=>{if(v.done)return;v.done=true;for(const n of v.nodes)try{n.disconnect();}catch{}this.voices.delete(v);this.openHats.delete(v);};v.finish=()=>{let remaining=v.sources.length;for(const src of v.sources)src.onended=()=>{if(--remaining<=0)v.cleanup();};if(!remaining)v.cleanup();};this.voices.add(v);return v;}
 drum(id,tr,t,velocity,h){
  const sound=tr.sound,type=sounds[sound].kind,scale=.45+tr.decay/100*1.6,texture=tr.texture/100;
  let duration=type==='kick'?(sound==='kick808'?.8:sound==='kickTight'?.20:.40):type==='snare'?(sound==='snareBrush'?.32:.20):type==='open'?.43:type==='hat'?.075:.15;duration*=scale;
  const end=t+duration+.04,v=this.voice(id,t,end),amp=v.node('createGain');amp.connect(this.channels[id].input);
  const env=(gain,peak,att,dec,at=t)=>{att=Math.min(dec*.35,att+tr.attack/100*.018);gain.setValueAtTime(.00001,at);gain.linearRampToValueAtTime(peak,at+att);gain.exponentialRampToValueAtTime(.00001,at+Math.max(att+.003,dec));};
  const band=(type,freq,q=0.7)=>{const f=v.node('createBiquadFilter');f.type=type;f.frequency.value=Math.min(freq,this.ctx.sampleRate*.47);f.Q.value=q;return f;};
  if(type==='kick'){
   env(amp.gain,.82*velocity,.002,duration);const target=sound==='kick808'?43:sound==='kickTight'?55:48;
   const o=v.osc('sine',target*3.5,amp);o.frequency.exponentialRampToValueAtTime(target,t+(sound==='kickTight'?.029:.054));o.frequency.exponentialRampToValueAtTime(target*.92,t+duration);
   if(texture>.05){const click=v.node('createGain'),hp=band('highpass',1600);env(click.gain,.085*velocity*texture,.0007,.014);v.noise(hp,h%1000/1000);hp.connect(click).connect(this.channels[id].input);}
   if(!this.offline)this.channels[id].level=Math.max(this.channels[id].level,velocity);
  }else if(type==='snare'){
   const hp=band('highpass',(sound==='snareBrush'?1000:650)+texture*850),lp=band('lowpass',(sound==='snareBrush'?4300:6900)+texture*5000);hp.connect(lp).connect(amp);v.noise(hp,h%1000/1000);
   if(sound==='clap'){
    amp.gain.setValueAtTime(.00001,t);for(const off of [0,.010,.021]){amp.gain.linearRampToValueAtTime(.40*velocity,t+off+.001+tr.attack/100*.005);amp.gain.exponentialRampToValueAtTime(.016,t+off+.009);}amp.gain.linearRampToValueAtTime(.31*velocity,t+.033);amp.gain.exponentialRampToValueAtTime(.00001,t+duration);
   }else env(amp.gain,(sound==='snareBrush'?.31:.48)*velocity,.0015,duration);
   if(sound!=='snareBrush'&&sound!=='clap'){const body=v.node('createGain');env(body.gain,.21*velocity,.001,.115*scale);body.connect(this.channels[id].input);const o=v.osc('triangle',188,body);o.frequency.exponentialRampToValueAtTime(155,t+.09);}
  }else if(type==='hat'||type==='open'){
   if(type==='hat'&&id==='hat')for(const open of this.openHats)if(open.t<=t&&open.end>t){open.amp.gain.cancelScheduledValues(t);open.amp.gain.setTargetAtTime(.00001,t,.006);}
   const hp=band('highpass',(sound==='shaker'?2800:4900)+texture*4200),lp=band('lowpass',Math.min(14000,this.ctx.sampleRate*.46));hp.connect(lp).connect(amp);v.noise(hp,(h%1000)/1000,.76);
   if(sound.includes('Metal'))for(const f of [3277,4511,6123])v.osc('square',f,hp,.045+texture*.055);
   env(amp.gain,(type==='open'?.22:sound==='shaker'?.22:.27)*velocity,sound==='shaker'?.007:.001,duration);
   if(type==='open'){v.amp=amp;this.openHats.add(v);}
  }else{
   env(amp.gain,(sound==='conga'?.45:sound==='cowbell'?.14:.26)*velocity,.001,duration);
   if(sound==='conga'){const o=v.osc('sine',260,amp,.85);o.frequency.exponentialRampToValueAtTime(155+(h%3)*21,t+.032);v.osc('sine',330+texture*170,amp,.10+texture*.20);}
   else if(sound==='cowbell'){const bp=band('bandpass',1200,.7);bp.connect(amp);v.osc('square',540,bp,.60);v.osc('square',740+texture*160,bp,.28+texture*.25);}
   else if(sound==='wood'){v.osc('sine',650+(h%3)*33,amp,.75);v.osc('sine',1170+texture*450,amp,.15+texture*.3);}
   else{v.osc('sine',960,amp,.8);v.osc('triangle',1450+texture*600,amp,.20+texture*.32);}
  }
  v.finish();
 }
 tonal(id,tr,midi,t,velocity,duration,h){
  const sound=tr.sound,kind=sounds[sound].kind,f=midiHz(midi),pad=kind==='pad',bass=kind==='bass';duration=Math.max(.035,duration);
  const release=pad?.38+tr.decay/100*2.05:bass?.035+tr.decay/100*.23:['bell','glass'].includes(sound)?.3+tr.decay/100*1.6:.08+tr.decay/100*.95;
  const attack=Math.min(duration*.4,pad?.04+tr.attack/100*1.15:.0015+tr.attack/100*.11);
  const end=t+duration+release+.02,v=this.voice(id,t,end),amp=v.node('createGain'),filter=v.node('createBiquadFilter');filter.type='lowpass';filter.Q.value=.65;filter.frequency.value=Math.min(this.ctx.sampleRate*.45,bass?500+(tr.tone/100)**2*5400:1300+(tr.tone/100)**2*15000);filter.connect(amp).connect(this.channels[id].input);
  const peak=(pad?.095:bass?.44:sound==='pluck'?.24:.18)*velocity,pluck=['electric','softkeys','pluck','marimba','glass','bell'].includes(sound);amp.gain.setValueAtTime(.00001,t);amp.gain.linearRampToValueAtTime(peak,t+attack);amp.gain.exponentialRampToValueAtTime(peak*(pluck?.17:pad?.88:.77),t+duration);amp.gain.exponentialRampToValueAtTime(.00001,t+duration+release);
  const fm=(ratio,index,amount=1)=>{const carrier=v.osc('sine',f,filter,amount),modGain=v.node('createGain');modGain.gain.setValueAtTime(f*index,t);modGain.gain.exponentialRampToValueAtTime(Math.max(.001,f*index*.035),t+Math.min(duration+.1,.6+tr.decay*.004));modGain.connect(carrier.frequency);v.osc('sine',f*ratio,modGain);return carrier;};
  const vibrato=(osc,rate=5.1,cents=4)=>{const depth=v.node('createGain');depth.gain.setValueAtTime(0,t);depth.gain.linearRampToValueAtTime(cents,t+Math.min(.30,duration));depth.connect(osc.detune);v.osc('sine',rate,depth);};
  if(sound==='sub'){v.osc('sine',f,filter,.95-tr.texture*.003);v.osc('triangle',f,filter,.05+tr.texture*.003);}
  else if(sound==='analog'||sound==='acid'){
   v.osc('sawtooth',f,filter,.38+tr.texture*.004);v.osc('sine',f/2,filter,.42-tr.texture*.002);filter.Q.value=.6+tr.texture*.025;if(sound==='acid'){filter.Q.value=3+tr.texture*.065;filter.frequency.setValueAtTime(450+tr.tone*65,t);filter.frequency.exponentialRampToValueAtTime(130+tr.tone*7,t+Math.min(.24,duration));}else{filter.frequency.setValueAtTime(650+tr.tone*28,t);filter.frequency.exponentialRampToValueAtTime(180+tr.tone*8,t+Math.min(.26,duration));}}
  else if(sound==='fmbass'){fm(2,.5+tr.texture*.022,.8);v.osc('sine',f,filter,.2);}
  else if(sound==='electric'){fm(2,.42+tr.texture*.026,.82);const tine=v.node('createGain');tine.gain.setValueAtTime(.18,t);tine.gain.exponentialRampToValueAtTime(.003,t+.15);tine.connect(filter);v.osc('sine',f*4,tine);}
  else if(sound==='softkeys'){v.osc('triangle',f,filter,.7);v.osc('sine',f*2,filter,.18);const partial=v.node('createGain');partial.gain.setValueAtTime(.025+tr.texture*.0022,t);partial.gain.exponentialRampToValueAtTime(.001,t+.21);partial.connect(filter);v.osc('sine',f*3.002,partial);filter.frequency.value=1600+tr.tone*30;}
  else if(sound==='organ'){for(const [ratio,g]of[[1,.56],[2,.24],[3,.11],[4,.065]])v.osc('sine',f*ratio,filter,g*(ratio===1?1:(.35+tr.texture*.018)));}
  else if(sound==='pluck'){const src=v.node('createBufferSource');src.buffer=this.pluckBuffer(midi,tr);src.connect(filter);v.sources.push(src);src.start(t);src.stop(Math.min(end,t+src.buffer.duration));}
  else if(sound==='tape'){v.osc('triangle',f,filter,.43,-4);v.osc('triangle',f,filter,.43,4);const o=v.osc('sine',f,filter,.15);vibrato(o,.31,3+tr.texture*.06);filter.frequency.value=900+tr.tone*32;}
  else if(sound==='strings'){for(const detune of [-7,0,7]){const o=v.osc('sawtooth',f,filter,.21,detune*(.45+tr.texture*.018));if(detune===0)vibrato(o,.24,4);}v.osc('sine',f,filter,.26);filter.frequency.value=750+tr.tone*38;}
  else if(sound==='choir'){const formA=v.node('createBiquadFilter'),formB=v.node('createBiquadFilter');formA.type=formB.type='bandpass';formA.frequency.value=700+tr.texture*4;formB.frequency.value=1350+tr.texture*6;formA.Q.value=2;formB.Q.value=2.2;const gA=v.node('createGain'),gB=v.node('createGain');gA.gain.value=.40;gB.gain.value=.28;formA.connect(gA).connect(filter);formB.connect(gB).connect(filter);const o=v.osc('sawtooth',f,formA);o.connect(formB);v.osc('sine',f,filter,.43);vibrato(o,4.8,5);}
  else if(sound==='glass'){fm(3.51,1.15+tr.texture*.013,.69);v.osc('sine',f,filter,.22);}
  else if(sound==='bell'){fm(2.01,1.1+tr.texture*.023,.75);const hi=v.node('createGain');hi.gain.setValueAtTime(.14,t);hi.gain.exponentialRampToValueAtTime(.001,t+.24);hi.connect(filter);v.osc('sine',f*5.43,hi);}
  else if(sound==='marimba'){v.osc('sine',f,filter,.82);const partial=v.node('createGain');partial.gain.setValueAtTime(.25+tr.texture*.002,t);partial.gain.exponentialRampToValueAtTime(.001,t+.12);partial.connect(filter);v.osc('sine',f*4,partial);}
  else if(sound==='chip'){v.osc('pulse',f,filter,.30+tr.texture*.005);v.osc('triangle',f,filter,.45-tr.texture*.003);filter.frequency.value=2500+tr.tone*110;}
  else if(sound==='flute'){const o=v.osc('sine',f,filter,.76);v.osc('sine',f*2,filter,.12);v.osc('sine',f*3,filter,.055);vibrato(o,5.2,4+tr.texture*.03);const air=v.node('createBiquadFilter');air.type='bandpass';air.frequency.value=f*2;air.Q.value=.8;air.connect(filter);v.noise(air,h%1000/1000,.027);}
  else if(sound==='reed'){const o=v.osc('sawtooth',f,filter,.43);v.osc('triangle',f,filter,.34);filter.frequency.value=1100+tr.tone*27;filter.Q.value=1.4;vibrato(o,4.7,4+tr.texture*.04);}
  else{const o=v.osc('sine',f,filter,.90);v.osc('sine',f*2,filter,.07);vibrato(o,5.3,3+tr.texture*.04);}
  v.finish();
 }
 schedule(e,time){if(this.disposed)return;const t=Math.max(this.offline?0:this.ctx.currentTime+.0002,time+e.offset);if(e.id==='kick'&&this.state.master.duck>0){const g=this.musicDuck.gain,amount=this.state.master.duck/100;g.cancelScheduledValues(t);g.setValueAtTime(1,t);g.linearRampToValueAtTime(1-amount*.82,t+.007);g.exponentialRampToValueAtTime(1,t+Math.min(.27,stepSeconds(this.state)*2.6));}if(trackMap[e.id].drum)this.drum(e.id,e.tr,t,e.v,e.hash);else e.n.forEach((n,i)=>this.tonal(e.id,e.tr,n,t+i*e.strum,e.v,e.d,e.hash+i));return t;}
 dispose(){if(this.disposed)return;this.disposed=true;for(const v of this.voices){for(const src of v.sources)try{src.stop();}catch{}v.cleanup();}this.voices.clear();this.openHats.clear();for(const n of this.nodes)try{n.disconnect();}catch{}this.nodes=[];this.pluckCache.clear();}
}
// ── 5. Validated projects, offline WAV, and Standard MIDI Files ────────────────
function validateProject(payload){
 if(!payload||typeof payload!=='object'||payload.schema!=='umbra-project'||![1,2,3,4,5,6,7,8].includes(payload.version)||!payload.state)throw new Error('No es un proyecto UMBRA v1–v8 válido. Elegí un JSON exportado por este estudio.');
 const src=payload.state,result=defaultState();
 const num=(v,min,max,name,integer=false)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max||(integer&&!Number.isInteger(v)))throw new Error('Valor inválido en '+name+'.');return v;};
 const member=(v,allowed,name)=>{if(!allowed.includes(v))throw new Error('Opción inválida en '+name+'.');return v;};
 for(const k of ['density','complexity','variation','human'])result[k]=num(src[k],0,100,k);
 result.swing=num(src.swing,0,65,'swing');result.bpm=num(src.bpm,45,190,'tempo',true);result.root=num(src.root,0,11,'tonalidad',true);result.mutation=num(src.mutation,0,100000,'variación',true);
 result.scale=member(src.scale,Object.keys(scaleDefs),'escala');result.genre=member(src.genre,Object.keys(grooves),'groove');result.preset=member(src.preset,presets.map(p=>p.id),'preset');result.progression=member(src.progression,Object.keys(progressions),'progresión');result.voicing=member(src.voicing,['triad','seventh','ninth','sus','sus4','sixth','add9','eleventh','power'],'acordes');result.bars=member(src.bars,[1,2,3,4,6,8,12,16,24,32,48,64],'compases');result.structure=member(src.structure,['loop','journey'],'estructura');
 if(typeof src.seed!=='string'||!src.seed.length||src.seed.length>64)throw new Error('La semilla debe tener entre 1 y 64 caracteres.');result.seed=src.seed;
 if(!Array.isArray(src.degrees)||src.degrees.length<2||src.degrees.length>12)throw new Error('La progresión debe contener entre 2 y 12 acordes.');result.degrees=src.degrees.map(v=>num(v,0,6,'grado',true));
 if(!src.master||typeof src.master!=='object')throw new Error('Falta la mezcla master.');for(const[k,min,max]of[['volume',0,100],['cutoff',500,20000],['reverb',0,80],['delay',0,70],['feedback',0,65],['duck',0,80]])result.master[k]=num(src.master[k],min,max,'master.'+k);result.master.division=member(src.master.division,[.5,.75,1,1.5],'tiempo del delay');
 if(!Array.isArray(src.tracks)||src.tracks.length!==trackDefs.length)throw new Error('El proyecto debe contener las diez pistas.');const seen=new Set();
 result.tracks=trackDefs.map(def=>{const t=src.tracks.find(x=>x&&x.id===def.id);if(!t||seen.has(t.id))throw new Error('Falta una pista o está repetida.');seen.add(t.id);const out=baseTrack(def);out.sound=member(t.sound,def.voices,'timbre de '+def.name);out.pattern=member(t.pattern,Object.keys(patternDefs[def.drum?'drum':def.id]),'patrón de '+def.name);
  for(const[k,min,max,integer]of[['volume',0,1.25],['pan',-1,1],['send',0,1],['delay',0,1],['tone',0,100],['decay',0,100],['texture',0,100],['attack',0,100],['octave',-2,2,true],['density',0,100],['pulses',0,16,true],['rotation',0,15,true],['revision',0,100000,true]])out[k]=num(t[k],min,max,def.id+'.'+k,integer);
  for(const k of ['mute','solo','locked']){if(typeof t[k]!=='boolean')throw new Error('Estado inválido de '+def.name+'.');out[k]=t[k];}return out;});
 if(!src.patterns||typeof src.patterns!=='object')throw new Error('Faltan los patrones.');result.patterns={};for(const def of trackDefs){const p=src.patterns[def.id];if(!Array.isArray(p)||p.length!==result.bars)throw new Error('Cantidad de compases inválida en '+def.name+'.');result.patterns[def.id]=p.map(bar=>{if(!Array.isArray(bar)||bar.length!==16)throw new Error('Cada compás debe tener 16 pasos.');return bar.map(e=>{if(e===null)return null;if(!e||!Array.isArray(e.n)||!e.n.length||e.n.length>12)throw new Error('Evento musical inválido.');const notes=e.n.map(n=>num(n,12,119,'nota MIDI',true));if(new Set(notes).size!==notes.length)throw new Error('Un evento contiene notas duplicadas.');return{n:notes,v:num(e.v,.01,1,'velocidad'),d:num(e.d,.2,16,'duración')};});});}
 return result;
}
function projectBlob(){return new Blob([JSON.stringify({schema:'umbra-project',version:8,createdAt:new Date().toISOString(),state},null,2)],{type:'application/json'});}
function filename(ext,s=state){return 'UMBRA_'+s.seed.replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,40)+'_v'+String(s.mutation).padStart(2,'0')+'_'+s.bpm+'bpm.'+ext;}
const yieldUI=()=>new Promise(resolve=>setTimeout(resolve,0));
async function renderOffline(s,{loops=1,tail='tail',sampleRate=44100,onProgress=()=>{}}={}){
 const Offline=window.OfflineAudioContext||window.webkitOfflineAudioContext;if(!Offline)throw new Error('Este navegador no permite renderizar audio offline.');const cycle=totalSeconds(s),preroll=tail==='loop'?1:0,offset=.08,renderSeconds=offset+cycle*(loops+preroll)+(tail==='tail'?6:.03);if(renderSeconds>180.05)throw new Error('El render supera el límite de 180 segundos. Reducí la cantidad de vueltas o compases.');
 let noteBudget=0;for(let i=0;i<totalBars(s)*16;i++)for(const e of scoreEvents(i,s))noteBudget+=e.n.length;if(noteBudget*(loops+preroll)>18000)throw new Error('El arreglo supera 18.000 voces por render. Reducí repeticiones, ratchets o pistas arpegiadas.');const context=new Offline(2,Math.ceil(renderSeconds*sampleRate),sampleRate),en=new SynthEngine(context,s,{offline:true}),steps=totalBars(s)*16*(loops+preroll),dt=stepSeconds(s);
 try{for(let step=0;step<steps;step++){en.automate7(step,offset+step*dt);for(const e of scoreEvents(step,s))en.schedule(e,offset+step*dt);if(step%256===0){onProgress('Programando compás '+(Math.floor(step/16)+1)+' / '+Math.ceil(steps/16));await yieldUI();}}
 if(tail==='loop')for(const e of scoreEvents(steps,s))en.schedule(e,offset+steps*dt);
 onProgress('Renderizando síntesis y efectos…');const buffer=await context.startRendering();const start=Math.round((offset+cycle*preroll)*sampleRate),frames=Math.min(buffer.length-start,Math.round((cycle*loops+(tail==='tail'?6:0))*sampleRate));return{buffer,start,frames,sampleRate,seconds:frames/sampleRate};
 }finally{en.dispose();}
}
async function encodeWav({buffer,start=0,frames=buffer.length-start,sampleRate=buffer.sampleRate},onProgress=()=>{}){
 const channels=2,bytes=frames*channels*2,ab=new ArrayBuffer(44+bytes),view=new DataView(ab),write=(offset,text)=>{for(let i=0;i<text.length;i++)view.setUint8(offset+i,text.charCodeAt(i));};write(0,'RIFF');view.setUint32(4,36+bytes,true);write(8,'WAVE');write(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,channels,true);view.setUint32(24,sampleRate,true);view.setUint32(28,sampleRate*4,true);view.setUint16(32,4,true);view.setUint16(34,16,true);write(36,'data');view.setUint32(40,bytes,true);
 const left=buffer.getChannelData(0),right=buffer.getChannelData(Math.min(1,buffer.numberOfChannels-1));let peak=0,energy=0,bad=0;onProgress('Codificando WAV estéreo…');for(let i=0;i<frames;i++){const l=left[start+i],r=right[start+i];if(!Number.isFinite(l)||!Number.isFinite(r)){bad++;continue;}peak=Math.max(peak,Math.abs(l),Math.abs(r));energy+=l*l+r*r;view.setInt16(44+i*4,Math.round(clamp(l,-1,1)*(l<0?32768:32767)),true);view.setInt16(46+i*4,Math.round(clamp(r,-1,1)*(r<0?32768:32767)),true);if(i&&i%1000000===0)await yieldUI();}if(bad)throw new Error('Se detectó una muestra no válida en el render. El archivo no se guardó.');return{blob:new Blob([ab],{type:'audio/wav'}),peak,rms:Math.sqrt(energy/(frames*2)),frames,sampleRate};
}
function midiFile(s=state,loops=1){
 const ppq=480,stepTicks=ppq/4,tracks=[],encodeText=text=>[...new TextEncoder().encode(text)],u32=n=>[(n>>>24)&255,(n>>>16)&255,(n>>>8)&255,n&255],u16=n=>[(n>>>8)&255,n&255];
 const vlq=value=>{let n=Math.max(0,Math.round(value)),bytes=[n&127];while((n>>>=7)>0)bytes.unshift((n&127)|128);return bytes;};
 const meta=(type,data)=>[255,type,...vlq(data.length),...data];
 const chunk=events=>{events.sort((a,b)=>a.tick-b.tick||a.order-b.order);let previous=0;const data=[];for(const e of events){const tick=Math.max(previous,Math.round(e.tick));data.push(...vlq(tick-previous),...e.bytes);previous=tick;}data.push(0,255,47,0);return[77,84,114,107,...u32(data.length),...data];};
 const tempo=Math.round(60000000/s.bpm),endTicks=totalBars(s)*4*ppq*loops;
 tracks.push(chunk([{tick:0,order:0,bytes:meta(3,encodeText('UMBRA - '+s.seed))},{tick:0,order:1,bytes:meta(81,[(tempo>>>16)&255,(tempo>>>8)&255,tempo&255])},{tick:0,order:2,bytes:meta(88,[4,2,24,8])},{tick:0,order:3,bytes:meta(1,encodeText(noteNames[s.root]+' '+scaleDefs[s.scale].name+' | generated locally'))},{tick:endTicks,order:9,bytes:meta(1,[])}]));
 const program={reese:38,rubber:39,organbass:32,velvetEP:4,pianoModal:0,dulcimer:15,nylon:24,pwmPad:90,airPad:89,supersaw:81,fmPluck:10,kalimba:108,brass:62,syncLead:80,sub:38,analog:38,fmbass:39,acid:38,electric:4,softkeys:0,organ:16,pluck:24,tape:89,strings:48,choir:52,glass:10,bell:14,marimba:12,chip:80,sinelead:80,flute:73,reed:68};
 const buckets=Object.fromEntries(trackDefs.map(t=>[t.id,[]]));for(let step=0;step<totalBars(s)*16*loops;step++)for(const e of scoreEvents(step,s)){for(let i=0;i<e.n.length;i++){const start=clamp(Math.round(step*stepTicks+(e.offset+i*e.strum)/stepSeconds(s)*stepTicks),0,endTicks-1),end=clamp(Math.round(start+e.d/stepSeconds(s)*stepTicks),start+1,endTicks);let pitch=e.n[i];if(trackMap[e.id].drum){pitch=({clapWide:39,ride:51,tom:45,tabla:66,claves:75,metalPerc:56,hatGrain:42,hat909:42,open909:46})[e.tr.sound]??(e.tr.sound==='rim'?37:e.tr.sound==='clap'?39:e.tr.sound==='conga'?64:e.tr.sound==='cowbell'?56:e.tr.sound==='wood'?76:trackMap[e.id].midi);}buckets[e.id].push({start,end,pitch,velocity:clamp(Math.round(e.v*e.tr.volume*106),1,127)});}}
 for(let index=0;index<trackDefs.length;index++){const d=trackDefs[index],tr=s.tracks.find(t=>t.id===d.id),channel=d.drum?9:index-5,events=[{tick:0,order:0,bytes:meta(3,encodeText(d.name))}];if(!d.drum){events.push({tick:0,order:1,bytes:[192|channel,program[tr.sound]??0]},{tick:0,order:2,bytes:[176|channel,10,clamp(Math.round((tr.pan+1)*63.5),0,127)]},{tick:0,order:2,bytes:[176|channel,7,100]});}
  const notes=buckets[d.id].sort((a,b)=>a.start-b.start),previous=new Map();for(const n of notes){const prev=previous.get(n.pitch);if(prev&&prev.end>n.start)prev.end=Math.max(prev.start+1,n.start);previous.set(n.pitch,n);}for(const n of notes){events.push({tick:n.start,order:5,bytes:[144|channel,n.pitch,n.velocity]},{tick:n.end,order:4,bytes:[128|channel,n.pitch,0]});}events.push({tick:endTicks,order:9,bytes:[176|channel,123,0]});tracks.push(chunk(events));}
 const header=[77,84,104,100,...u32(6),...u16(1),...u16(tracks.length),...u16(ppq)],size=header.length+tracks.reduce((n,t)=>n+t.length,0),bytes=new Uint8Array(size);bytes.set(header);let at=header.length;for(const t of tracks){bytes.set(t,at);at+=t.length;}return new Blob([bytes],{type:'audio/midi'});
}
// Read-only inspection helpers for testing and future integrations.
// ── 6. UMBRA 2: musical vocabulary and per-track arpeggiation ────────────────
const genreNames={trip:'Trip-hop',dub:'Dub',house:'Microhouse',bossa:'Bossa electrónica',ambient:'Ambient',garage:'UK garage',electro:'Electro',broken:'Broken beat',soul:'Neo-soul',ritual:'Ritual modal',cinema:'Cinemático',chip:'Chiptune',techno:'Techno',dubtechno:'Dub techno',minimal:'Minimal',melodic:'Melodic house',trance:'Trance',dnb:'Drum & bass',jungle:'Jungle',liquid:'Liquid DnB',halftime:'Halftime',trap:'Trap',lofi:'Lo-fi hip-hop',synthwave:'Synthwave',disco:'Nu-disco',funk:'Electro-funk',jazz:'Jazz de cámara',afro:'Afro house',reggaeton:'Dembow electrónico',footwork:'Footwork',idm:'IDM',breakbeat:'Breakbeat'};
Object.assign(scaleDefs,{
 locrian:{name:'Locria',short:'LOCRIAN',notes:[0,1,3,5,6,8,10]},
 doubleharmonic:{name:'Doble armónica',short:'DOUBLE HARM.',notes:[0,1,4,5,7,8,11]},
 hungarian:{name:'Menor húngara',short:'HUNGARIAN',notes:[0,2,3,6,7,8,11]},
 hirajoshi:{name:'Hirajōshi',short:'HIRAJŌSHI',notes:[0,2,3,7,8],harmony:'minor'},
 insen:{name:'Insen',short:'INSEN',notes:[0,1,5,7,10],harmony:'phrygian'},
 blues:{name:'Blues menor',short:'BLUES',notes:[0,3,5,6,7,10],harmony:'minor'},
 lydianDom:{name:'Lidia dominante',short:'LYD. DOM.',notes:[0,2,4,6,7,9,10]},
 phrygianDom:{name:'Frigia dominante',short:'PHRYG. DOM.',notes:[0,1,4,5,7,8,10]}
});
// Explicit semitone roots are relative to the tonic. Explicit qualities do not
// claim to be diatonic; they make borrowed chords and secondary dominants real.
const Q={maj:[0,4,7],min:[0,3,7],dim:[0,3,6],aug:[0,4,8],maj7:[0,4,7,11],min7:[0,3,7,10],dom7:[0,4,7,10],dim7:[0,3,6,9],half:[0,3,6,10],maj9:[0,4,7,11,14],min9:[0,3,7,10,14],dom9:[0,4,7,10,14],six:[0,4,7,9],min6:[0,3,7,9],sus2:[0,2,7],sus4:[0,5,7],power:[0,7,12],alt:[0,4,8,10,13]};
const qualityLabels={auto:'Diatónico / acorde global',maj:'Mayor',min:'Menor',dim:'Disminuido',aug:'Aumentado',maj7:'Maj 7',min7:'Menor 7',dom7:'Dominante 7',dim7:'Disminuido 7',half:'Semidisminuido',maj9:'Maj 9',min9:'Menor 9',dom9:'Dominante 9',six:'Sexta',min6:'Menor 6',sus2:'Sus 2',sus4:'Sus 4',power:'Quinta',alt:'Dominante alterado'};
const fixedProgress=(name,items)=>({name,degrees:items.map((_,i)=>[0,3,4,5,1,2,6][i%7]),chords:items.map(([root,quality])=>({root,quality}))});
Object.assign(progressions,{
 pendulum:{name:'Péndulo modal · I–IV',degrees:[0,3]},
 pedal2:{name:'Pedal abierto · I–VII',degrees:[0,6]},
 dorianLift:{name:'Dórica · i9–IV9',...fixedProgress('Dórica · i9–IV9',[[0,'min9'],[5,'dom9']])},
 minorTwoFive:fixedProgress('Jazz menor · iiø–V7–i9–VImaj7',[[2,'half'],[7,'alt'],[0,'min9'],[8,'maj7']]),
 jazzTurn:fixedProgress('Turnaround · Imaj7–VI7–ii7–V7',[[0,'maj7'],[9,'dom7'],[2,'min7'],[7,'dom7']]),
 backdoor:fixedProgress('Backdoor · Imaj9–iv7–♭VII9–Imaj9',[[0,'maj9'],[5,'min7'],[10,'dom9'],[0,'maj9']]),
 tritone:fixedProgress('Sustitución · ii9–♭II7–Imaj9–VI7',[[2,'min9'],[1,'dom7'],[0,'maj9'],[9,'dom7']]),
 andalusian:fixedProgress('Andaluza · i–♭VII–♭VI–V',[[0,'min'],[10,'maj'],[8,'maj'],[7,'maj']]),
 borrowed:fixedProgress('Intercambio modal · I–iv–♭VI–V7',[[0,'maj'],[5,'min'],[8,'maj'],[7,'dom7']]),
 chromatic:fixedProgress('Mediantes cromáticas · i–♭VI–iii–V',[[0,'min'],[8,'maj'],[4,'min'],[7,'maj']]),
 neo:fixedProgress('Cine / transformaciones · i–VI–vi–III',[[0,'min'],[8,'maj'],[8,'min'],[4,'maj']]),
 dream:fixedProgress('Sueño suspendido · Imaj9–IIImaj7–IVmaj9–iv6',[[0,'maj9'],[4,'maj7'],[5,'maj9'],[5,'min6']]),
 chainDom:fixedProgress('Dominantes encadenados · III7–VI7–II7–V7',[[4,'dom7'],[9,'dom7'],[2,'dom7'],[7,'dom7']]),
 gospel:fixedProgress('Ascenso gospel · I6–III7–vi7–IVmaj9',[[0,'six'],[4,'dom7'],[9,'min7'],[5,'maj9']]),
 houseSoul:fixedProgress('House / novenas · i9–♭IIImaj9–♭VII9–iv9',[[0,'min9'],[3,'maj9'],[10,'dom9'],[5,'min9']]),
 susOrbit:fixedProgress('Órbita sus · Isus2–♭VIsus2–IVsus4–Vsus4',[[0,'sus2'],[8,'sus2'],[5,'sus4'],[7,'sus4']]),
 phrygianGate:fixedProgress('Puerta frigia · i–♭II–i–♭VII',[[0,'min'],[1,'maj'],[0,'min'],[10,'min']]),
 fifths:{name:'Ciclo de quintas · 8 acordes',degrees:[0,3,6,2,5,1,4,0]},
 pop8:{name:'Viaje pop · 8 acordes',degrees:[0,4,5,3,0,4,3,4]},
 minor8:{name:'Relato menor · 8 acordes',degrees:[0,5,3,4,0,2,5,4]},
 jazz8:fixedProgress('Jazz circular · 8 acordes',[[0,'maj7'],[9,'dom7'],[2,'min7'],[7,'dom7'],[4,'min7'],[9,'dom7'],[2,'min7'],[7,'alt']]),
 blues12:fixedProgress('Blues dominante · 12 acordes',[[0,'dom7'],[5,'dom7'],[0,'dom7'],[0,'dom7'],[5,'dom7'],[5,'dom7'],[0,'dom7'],[0,'dom7'],[7,'dom7'],[5,'dom7'],[0,'dom7'],[7,'dom7']]),
 minorBlues:fixedProgress('Blues menor · 12 acordes',[[0,'min7'],[0,'min7'],[0,'min7'],[0,'min7'],[5,'min7'],[5,'min7'],[0,'min7'],[0,'min7'],[8,'dom7'],[7,'dom7'],[0,'min7'],[7,'alt']]),
 slowMajor:{name:'Contemplativa · I–III–IV–I',degrees:[0,2,3,0]},
 subdominant:{name:'Subdominante · IV–I–II–V',degrees:[3,0,1,4]},
 rising:{name:'Ascenso diatónico · I–II–III–IV',degrees:[0,1,2,3]}
});
Object.assign(grooves,{
 techno:{kick:[0,4,8,12],snare:[4,12],hat:[0,2,4,6,8,10,12,14],open:[2,6,10,14],perc:[3,6,11,14]},
 dubtechno:{kick:[0,4,8,12],snare:[12],hat:[2,6,10,14],open:[6,14],perc:[3,9]},
 minimal:{kick:[0,4,8,12],snare:[4,12],hat:[2,5,6,10,14],open:[14],perc:[3,7,11,15]},
 melodic:{kick:[0,4,8,12],snare:[4,12],hat:[2,6,10,14],open:[6,14],perc:[1,7,11]},
 trance:{kick:[0,4,8,12],snare:[4,12],hat:[0,2,4,6,8,10,12,14],open:[2,6,10,14],perc:[3,7,11,15]},
 dnb:{kick:[0,6,10],snare:[4,12],hat:[0,2,3,4,6,8,10,11,12,14],open:[6,14],perc:[7,15]},
 jungle:{kick:[0,6,10,15],snare:[4,9,12],hat:[0,2,3,6,8,10,13,14,15],open:[7,14],perc:[3,7,11]},
 liquid:{kick:[0,6,8],snare:[4,12],hat:[0,2,4,6,8,10,12,14],open:[6,14],perc:[3,10,15]},
 halftime:{kick:[0,7,11],snare:[8],hat:[0,3,6,8,11,14],open:[14],perc:[5,13]},
 trap:{kick:[0,6,11],snare:[8],hat:[0,2,4,6,7,8,10,12,14,15],open:[6,14],perc:[3,13]},
 lofi:{kick:[0,7,10],snare:[4,12],hat:[0,2,4,6,8,10,12,14],open:[14],perc:[3,11]},
 synthwave:{kick:[0,4,8,12],snare:[4,12],hat:[0,2,4,6,8,10,12,14],open:[14],perc:[7,15]},
 disco:{kick:[0,4,8,12],snare:[4,12],hat:[0,2,4,6,8,10,12,14],open:[2,6,10,14],perc:[1,3,7,9,11,15]},
 funk:{kick:[0,3,6,10,14],snare:[4,12],hat:[0,2,3,4,6,8,10,11,12,14],open:[6,14],perc:[3,7,10,15]},
 jazz:{kick:[0,10],snare:[4,11],hat:[2,6,10,14],open:[14],perc:[0,4,7,8,12,15]},
 afro:{kick:[0,4,8,12],snare:[4,12],hat:[2,6,10,14],open:[6,14],perc:[0,3,6,8,11,14]},
 reggaeton:{kick:[0,8],snare:[3,6,11,14],hat:[0,2,4,6,8,10,12,14],open:[6,14],perc:[1,7,9,15]},
 footwork:{kick:[0,3,6,8,11],snare:[4,10,12],hat:[0,2,5,8,10,13],open:[7,15],perc:[1,6,9,14]},
 idm:{kick:[0,5,9,14],snare:[4,11],hat:[0,1,4,7,10,12,15],open:[6,13],perc:[2,5,8,11,14]},
 breakbeat:{kick:[0,6,8,14],snare:[4,12],hat:[0,2,4,6,8,10,12,14],open:[7,14],perc:[3,10,15]}
});
const newSounds={
 kick909:['Bombo 909 · pegada','SENO + GOLPE + CLICK','kick'],kickDeep:['Bombo profundo · sub','SENO · SATURACIÓN SUAVE','kick'],kickPunch:['Bombo de impacto','MEMBRANA + TRANSITORIO','kick'],
 snare909:['Caja 909 · crujiente','DOS MEMBRANAS + RUIDO','snare'],snareRoom:['Caja acústica sintética','MODAL · CUERPO + BORDONERA','snare'],clapWide:['Clap abierto','RUIDO · RÁFAGAS DIFUSAS','snare'],
 hat909:['Hi-hat 909 sintético','6 OSCILADORES + RUIDO','hat'],hatGrain:['Hi-hat arenoso','RUIDO MODULADO','hat'],open909:['Abierto 909 sintético','6 OSCILADORES · CHOKE','open'],
 ride:['Ride modal','8 PARCIALES INARMÓNICOS','perc'],tom:['Tom afinado','MEMBRANA · DOS PARCIALES','perc'],tabla:['Tabla sintética','MEMBRANA FM','perc'],claves:['Claves resonantes','IMPULSO · MADERA','perc'],metalPerc:['Percusión de metal','ADITIVA INARMÓNICA','perc'],
 reese:['Bajo Reese','SIERRAS · BATIDOS + SUB','bass'],rubber:['Bajo elástico','FM + FILTRO DINÁMICO','bass'],organbass:['Bajo de registros','ADITIVA · SENO + OCTAVAS','bass'],
 velvetEP:['Piano eléctrico aterciopelado','FM · DINÁMICA DE LÁMINAS','keys'],pianoModal:['Piano modal','ADITIVA · CUERDAS DESAFINADAS','keys'],dulcimer:['Cuerdas percutidas','PARCIALES · ATAQUE DE MAZO','keys'],nylon:['Cuerda pulsada cálida','KARPLUS–STRONG · AMORTIGUACIÓN','keys'],
 pwmPad:['Pad de pulsos','PULSOS · DERIVA ESTÉREO','pad'],airPad:['Pad de aire','TRIÁNGULOS + RUIDO FILTRADO','pad'],supersaw:['Ensamble de sierras','5 VOCES · DESAFINACIÓN','pad'],
 fmPluck:['Pluck FM dinámico','FM · ÍNDICE PERCUSIVO','arp'],kalimba:['Kalimba modal','ADITIVA · LÁMINAS','arp'],brass:['Metal analógico','SIERRAS · FILTRO EXPRESIVO','lead'],syncLead:['Lead de armónicos','PULSOS + ARMÓNICOS','lead']
};
for(const [id,[name,engine,kind]] of Object.entries(newSounds))sounds[id]={name,engine,kind};
const extras={kick:['kick909','kickDeep','kickPunch'],snare:['snare909','snareRoom','clapWide'],hat:['hat909','hatGrain'],open:['open909'],perc:['ride','tom','tabla','claves','metalPerc'],bass:['reese','rubber','organbass'],keys:['velvetEP','pianoModal','dulcimer','nylon','fmPluck','kalimba'],pad:['pwmPad','airPad','supersaw'],arp:['fmPluck','kalimba','dulcimer','nylon','velvetEP'],lead:['brass','syncLead','fmPluck','pianoModal','kalimba']};
const trackColors={kick:'#e8ae79',snare:'#e4c086',hat:'#b7a57e',open:'#e1bd9c',perc:'#c69278',bass:'#83b9eb',keys:'#c2a5f8',pad:'#b1a4df',arp:'#e799c7',lead:'#84d0de'};
for(const d of trackDefs){d.voices.push(...extras[d.id]);d.color=trackColors[d.id];}
const arpModes={up:'Ascendente',down:'Descendente',updown:'Ida y vuelta',downup:'Vuelta e ida',converge:'Hacia el centro',diverge:'Hacia los extremos',thirds:'Saltos de terceras',pinky:'Pedal superior',thumb:'Pedal inferior',random:'Aleatorio sembrado',walk:'Paseo acotado',chord:'Acorde repetido'};
const arpRates={'4':{name:'1/4',step:4},'8':{name:'1/8',step:2},'16':{name:'1/16',step:1},'32':{name:'1/32',step:.5},'8t':{name:'1/8 · tresillo',step:4/3},'16t':{name:'1/16 · tresillo',step:2/3},'8d':{name:'1/8 · puntillo',step:3}};
const makeArp=(enabled=false)=>({enabled,source:'chord',mode:'updown',rate:'8',octaves:2,gate:62,probability:87,accent:26,pulses:16,rotation:0,ratchet:1,reset:'chord',length:16});
const v1DefaultState=defaultState,v1BaseTrack=baseTrack;
baseTrack=function(d){return{...v1BaseTrack(d),tune:0,drive:d.drum?9:5,highpass:d.id==='bass'||d.id==='kick'?24:d.drum?100:110,lowEQ:0,highEQ:0,chorus:d.id==='pad'?28:d.id==='keys'?12:0,phaser:0,tremolo:0,autoPan:0,spread:d.id==='bass'?0:28,resonance:10,arpLock:null,arp:makeArp(d.id==='arp')};};
defaultState=function(){const s=v1DefaultState();s.master={...s.master,reverbKind:'plate',predelay:18,damping:6400,delayTone:3800,chorusRate:.35,chorusDepth:45,phaserRate:.2,drumDrive:16,drumCrush:24,glue:30,lowEQ:0,highEQ:0};s.chordEdits=null;return s;};
function harmonyIndex(bar,s=state){return clamp(Math.floor(mod(bar,s.bars)*s.degrees.length/s.bars),0,s.degrees.length-1);}
function chordSpecs(s=state){return s.chordEdits||progressions[s.progression]?.chords||null;}
chordDegree=function(bar,s=state){return mod(s.degrees[harmonyIndex(bar,s)],scaleNotes(s,true).length);};
const v1ChordRaw=chordRaw;
chordRaw=function(degree,s=state){if(['triad','seventh','ninth','sus'].includes(s.voicing))return v1ChordRaw(degree,s);const offsets={sus4:[0,3,4],sixth:[0,2,4,5],add9:[0,2,4,8],eleventh:[0,2,4,6,8,10],power:[0,4,7]}[s.voicing];if(s.scale==='whole'){const r=scaleMidi(degree,3,s,true);return(s.voicing==='power'?[0,8,12]:s.voicing==='sixth'?[0,4,8,9]:s.voicing==='sus4'?[0,5,8]:s.voicing==='eleventh'?[0,4,8,10,14,17]:[0,4,8,14]).map(x=>r+x);}return offsets.map(x=>scaleMidi(degree+x,3,s,true));};
function rawAt(i,s=state){const spec=chordSpecs(s)?.[i];return spec&&Q[spec.quality]?Q[spec.quality].map(x=>s.root+48+spec.root+x):chordRaw(mod(s.degrees[i],scaleNotes(s,true).length),s);}
chordRoot=function(bar,s=state,oct=2){return rawAt(harmonyIndex(bar,s),s)[0]+12*(oct-3);};
chordVoicings=function(s=state){let prev=[57,60,64,67,71,74];const out=[];for(let i=0;i<s.degrees.length;i++){const raw=rawAt(i,s);let best=raw,bestScore=Infinity;for(let inv=0;inv<raw.length;inv++)for(let oct=-2;oct<=2;oct++){const notes=raw.slice(inv).concat(raw.slice(0,inv).map(n=>n+12)).map(n=>n+oct*12).sort((a,b)=>a-b);if(notes[0]<46||notes.at(-1)>88||new Set(notes).size!==notes.length)continue;const score=notes.reduce((a,n,j)=>a+Math.abs(n-prev[Math.min(j,prev.length-1)]),0)+Math.abs(notes.reduce((a,b)=>a+b)/notes.length-64)*.3;if(score<bestScore){best=notes;bestScore=score;}}out.push(best);prev=best;}return out;};
function labelAt(i,s=state){const n=rawAt(i,s),root=n[0],a=n.map(x=>mod(x-root,12)),spec=chordSpecs(s)?.[i];if(spec&&Q[spec.quality])return noteName(root)+({maj:'',min:'m',dim:'dim',aug:'+',maj7:'maj7',min7:'m7',dom7:'7',dim7:'dim7',half:'ø7',maj9:'maj9',min9:'m9',dom9:'9',six:'6',min6:'m6',sus2:'sus2',sus4:'sus4',power:'5',alt:'7alt'}[spec.quality]);if(['triad','seventh','ninth','sus'].includes(s.voicing))return chordLabel(s.degrees[i],s);return noteName(root)+(s.voicing==='power'?'5':s.voicing==='sus4'?'sus4':(a[1]===3?'m':'')+(s.voicing==='add9'?'add9':s.voicing==='sixth'?'6':'11'));}
const v1ApplyPreset=applyPreset;
applyPreset=function(id,initial=false){v1ApplyPreset(id,initial);const p=presets.find(x=>x.id===state.preset);state.chordEdits=null;state.bars=Math.max(state.bars,p.bars||4);if(state.bars<state.degrees.length)state.bars=state.degrees.length<=8?8:12;state.tracks.forEach(t=>{if(p.arp&&t.id==='arp')Object.assign(t.arp,p.arp);if(p.trackOptions?.[t.id]){const opts=p.trackOptions[t.id];Object.assign(t,{...opts,arp:{...t.arp,...opts.arp}});}if(t.id==='arp'&&!p.arp){t.arp.mode={pendulum:'updown',skip:'thirds',random:'random',down:'down',up:'up'}[t.pattern]||'updown';t.arp.rate=p.genre==='ambient'||p.genre==='cinema'?'4':'8';t.arp.probability=65;t.arp.octaves=1;}if(['ambient','cinema'].includes(p.genre)&&['snare','hat','open','perc'].includes(t.id))t.volume*=.65;});generateAll({respectLocks:false});};
const addPreset=(id,name,bpm,root,scale,progression,voices,patterns,opts={})=>presets.push({id,name,genre:id,desc:opts.desc||genreNames[id]+'. Síntesis, armonía y ritmo diseñados para este carácter.',bpm,root,scale,progression,voicing:opts.voicing||'seventh',density:opts.density||62,complexity:opts.complexity||58,variation:42,human:opts.human??25,swing:opts.swing??10,voices,patterns,master:{reverb:20,delay:22,duck:28,cutoff:16500,...opts.master},arp:{mode:'updown',rate:'16',octaves:2,gate:55,probability:78,...opts.arp},...opts});
addPreset('techno','01 / Acero orbital',132,2,'minor','pedal2',['kick909','clapWide','hat909','open909','metalPerc','rubber','fmPluck','pwmPad','fmPluck','syncLead'],{bass:'pulse',keys:'offbeat',arp:'up',lead:'call'},{desc:'Techno: bombo con pegada, stabs breves y un ostinato que cambia de registro.',density:72,human:9,master:{drumDrive:27,drumCrush:42,duck:46,reverb:17},arp:{rate:'16',mode:'thumb',octaves:2,pulses:11,gate:40},trackOptions:{lead:{volume:.22},keys:{volume:.43}}});
addPreset('dubtechno','02 / Hormigón sumergido',122,5,'dorian','dorianLift',['kickDeep','rim','hatGrain','openSoft','wood','sub','velvetEP','airPad','nylon','sinelead'],{bass:'root',keys:'offbeat',arp:'pendulum',lead:'sparse'},{density:47,swing:20,master:{reverb:42,delay:47,feedback:54,delayTone:2300,duck:36},arp:{rate:'8d',mode:'down',octaves:1,probability:56},trackOptions:{keys:{delay:.65,chorus:26},pad:{volume:.33}}});
addPreset('minimal','03 / Piezas diminutas',126,7,'dorian','pendulum',['kickTight','snare909','hatGrain','open909','claves','rubber','kalimba','tape','fmPluck','glass'],{bass:'sync',keys:'stabs',arp:'euclid',lead:'call'},{density:48,swing:35,arp:{rate:'16',mode:'random',octaves:1,pulses:5,gate:30},master:{reverb:12,delay:20}});
addPreset('melodic','04 / Líneas de fuga',122,2,'minor','minor8',['kick909','clapWide','hat909','open909','tom','analog','velvetEP','supersaw','fmPluck','brass'],{bass:'octaves',keys:'sustain',arp:'up',lead:'phrase'},{bars:8,arp:{rate:'16',mode:'updown',octaves:2,gate:72,probability:96},master:{reverb:32,duck:38},trackOptions:{pad:{volume:.31,chorus:35},lead:{volume:.32}}});
addPreset('trance','05 / Fotones',138,9,'minor','nocturne',['kickPunch','clapWide','hat909','open909','metalPerc','analog','fmPluck','supersaw','syncLead','brass'],{bass:'pulse',keys:'offbeat',arp:'up',lead:'call'},{density:73,human:4,swing:0,arp:{rate:'16',mode:'converge',octaves:2,gate:75,probability:100},master:{reverb:30,delay:28,duck:49},trackOptions:{pad:{volume:.26,spread:46},arp:{volume:.32}}});
addPreset('dnb','06 / Contracorriente',172,1,'minor','phrygianGate',['kickPunch','snare909','hat909','open909','ride','reese','fmPluck','airPad','kalimba','reed'],{bass:'sync',keys:'stabs',arp:'skip',lead:'call'},{density:72,complexity:78,human:19,swing:5,arp:{rate:'8',mode:'thirds',octaves:1},master:{reverb:14,drumCrush:43,duck:22},trackOptions:{bass:{drive:19},pad:{volume:.27},perc:{volume:.27}}});
addPreset('jungle','07 / Fragmentos selváticos',164,7,'minor','pedal2',['kickPunch','snareRoom','hatGrain','open909','ride','reese','organ','airPad','fmPluck','flute'],{bass:'root',keys:'offbeat',arp:'random',lead:'call'},{density:78,complexity:86,swing:21,human:43,arp:{rate:'16t',mode:'walk',octaves:2,probability:58,pulses:9},master:{drumCrush:51,drumDrive:24,reverb:23},trackOptions:{perc:{volume:.24}}});
addPreset('liquid','08 / Agua de neón',172,5,'dorian','jazz8',['kickDeep','snareRoom','hatSoft','openSoft','ride','sub','velvetEP','airPad','nylon','flute'],{bass:'sync',keys:'sustain',arp:'pendulum',lead:'phrase'},{density:57,human:38,swing:4,arp:{rate:'8',mode:'updown',octaves:1,gate:73,probability:73},master:{reverb:38,delay:26},trackOptions:{keys:{chorus:27},perc:{volume:.21}}});
addPreset('halftime','09 / Masa suspendida',144,2,'phrygian','phrygianGate',['kickDeep','snare909','hatGrain','open909','tabla','reese','fmPluck','choir','kalimba','sinelead'],{bass:'root',keys:'stabs',arp:'euclid',lead:'sparse'},{density:46,swing:12,arp:{rate:'8t',mode:'diverge',pulses:7,octaves:2},master:{reverb:32,drumCrush:36,duck:30}});
addPreset('trap','10 / Gravedad baja',140,6,'harmonic','andalusian',['kick808','clapWide','hat909','open909','tom','sub','pianoModal','airPad','kalimba','glass'],{bass:'sync',keys:'broken',arp:'down',lead:'call'},{density:65,complexity:78,swing:14,arp:{rate:'16',mode:'down',octaves:1,gate:43,probability:68,ratchet:2},master:{drumDrive:17,duck:31,reverb:26},trackOptions:{arp:{volume:.25},bass:{decay:72}}});
addPreset('lofi','11 / Polvo solar',78,3,'major','backdoor',['kickRound','snareBrush','hatGrain','openSoft','rim','organbass','velvetEP','tape','nylon','flute'],{bass:'walking',keys:'stabs',arp:'pendulum',lead:'phrase'},{density:43,swing:41,human:76,arp:{rate:'8',mode:'pinky',octaves:1,probability:52},master:{cutoff:9600,reverb:26,delay:16,duck:9},trackOptions:{keys:{drive:18,chorus:32,tone:42},hat:{tone:44}}});
addPreset('synthwave','12 / Autopista violeta',104,9,'minor','pop8',['kick909','snare909','hatMetal','open909','tom','analog','softkeys','supersaw','syncLead','brass'],{bass:'octaves',keys:'sustain',arp:'up',lead:'phrase'},{swing:0,human:10,arp:{rate:'16',mode:'up',octaves:2,gate:64,probability:100},master:{reverb:33,delay:24,duck:32},trackOptions:{pad:{chorus:48,volume:.29},lead:{phaser:22}}});
addPreset('disco','13 / Disco de mercurio',118,0,'dorian','houseSoul',['kick909','clapWide','hatSoft','open909','conga','rubber','velvetEP','pwmPad','kalimba','brass'],{bass:'octaves',keys:'offbeat',arp:'skip',lead:'phrase'},{swing:14,human:42,arp:{rate:'8',mode:'thirds',octaves:1,probability:79},master:{reverb:18,duck:25},trackOptions:{keys:{phaser:26},bass:{tone:64}}});
addPreset('funk','14 / Resorte cromado',108,4,'mixolydian','blues12',['kickPunch','snareRoom','hat909','openSoft','cowbell','rubber','velvetEP','pwmPad','nylon','brass'],{bass:'sync',keys:'stabs',arp:'skip',lead:'phrase'},{bars:12,density:66,swing:24,human:57,arp:{rate:'16',mode:'thumb',octaves:1,pulses:9,gate:37},master:{reverb:14,drumCrush:30},trackOptions:{keys:{phaser:35}}});
addPreset('jazz','15 / Cuarteto imposible',112,0,'major','jazz8',['kickRound','snareBrush','hatSoft','openSoft','ride','organbass','pianoModal','airPad','dulcimer','flute'],{bass:'walking',keys:'stabs',arp:'random',lead:'phrase'},{density:45,swing:62,human:79,arp:{rate:'8t',mode:'walk',octaves:1,probability:45},master:{reverb:23,duck:0},trackOptions:{kick:{volume:.42},pad:{volume:.19},arp:{volume:.25},perc:{volume:.26}}});
addPreset('afro','16 / Madera eléctrica',120,7,'dorian','dorianLift',['kickDeep','clapWide','shaker','openSoft','tabla','sub','nylon','airPad','kalimba','flute'],{bass:'sync',keys:'offbeat',perc:'euclid',arp:'euclid',lead:'call'},{density:68,swing:14,human:46,arp:{rate:'16',mode:'converge',pulses:7,rotation:2,octaves:2,gate:48},master:{reverb:30,delay:29,duck:27},trackOptions:{perc:{pulses:11},arp:{autoPan:18}}});
addPreset('reggaeton','17 / Asfalto cálido',96,2,'minor','andalusian',['kickPunch','snare909','hat909','open909','claves','sub','nylon','airPad','fmPluck','brass'],{bass:'sync',keys:'stabs',arp:'up',lead:'phrase'},{density:64,swing:5,human:23,arp:{rate:'8',mode:'thumb',octaves:1,gate:43},master:{reverb:15,drumCrush:39,duck:30}});
addPreset('footwork','18 / Pasos imposibles',160,5,'pentminor','pedal2',['kick808','snare909','hat909','open909','rim','rubber','fmPluck','tape','kalimba','chip'],{bass:'pulse',keys:'stabs',arp:'skip',lead:'call'},{density:73,complexity:84,swing:7,human:14,arp:{rate:'16t',mode:'thirds',octaves:2,probability:65,pulses:11},master:{reverb:15,delay:18,duck:27}});
addPreset('idm','19 / Jardín de errores',116,2,'hirajoshi','chromatic',['kickTight','snare909','hatGrain','openMetal','metalPerc','rubber','dulcimer','pwmPad','fmPluck','glass'],{bass:'sync',keys:'broken',arp:'random',lead:'cascade'},{density:61,complexity:89,swing:17,human:35,arp:{rate:'16',mode:'walk',octaves:3,probability:66,pulses:11,ratchet:2},master:{reverb:34,delay:36,duck:20},trackOptions:{arp:{phaser:29,autoPan:38,volume:.30}}});
addPreset('breakbeat','20 / Tensión elástica',132,9,'minor','minor8',['kickPunch','snareRoom','hat909','open909','ride','reese','velvetEP','supersaw','fmPluck','brass'],{bass:'sync',keys:'stabs',arp:'pendulum',lead:'call'},{density:68,complexity:75,swing:12,human:32,arp:{rate:'16',mode:'updown',octaves:2,pulses:13,gate:48},master:{reverb:23,drumCrush:45,duck:28},trackOptions:{perc:{volume:.23},pad:{volume:.28}}});
// Default sounds also benefit from the new synthesis and channel strips.
for(const p of presets.slice(0,12)){if(p.id==='nocturne'){p.voices[6]='velvetEP';p.voices[1]='snareRoom';p.trackOptions={keys:{chorus:24},snare:{drive:12}};}if(p.id==='ambient')p.voices[7]='airPad';}
function orderedArp(pool,index,mode,r){const n=pool.length;if(n===1)return[pool[0]];let i=mod(index,n);switch(mode){case'down':i=n-1-i;break;case'updown':i=mod(index,2*n-2);if(i>=n)i=2*n-2-i;break;case'downup':i=mod(index,2*n-2);if(i>=n)i=2*n-2-i;i=n-1-i;break;case'converge':{const k=mod(index,n);i=k%2===0?k/2:n-1-Math.floor(k/2);break;}case'diverge':{const order=[];for(let k=0;k<n;k++)order.push(k%2===0?k/2:n-1-Math.floor(k/2));i=order[n-1-mod(index,n)];break;}case'thirds':i=mod(index*2+Math.floor(index/n),n);break;case'pinky':i=index%2?n-1:mod(Math.floor(index/2),n-1);break;case'thumb':i=index%2?1+mod(Math.floor(index/2),n-1):0;break;case'random':i=Math.floor(r()*n);break;case'walk':{let pos=Math.floor(n/2);for(let j=0;j<=mod(index,64);j++)pos=clamp(pos+(r()<.5?-1:1),0,n-1);i=pos;break;}case'chord':return pool.slice(0,6);}return[pool[i]];}
const v1ScoreEvents=scoreEvents;
scoreEvents=function(absStep,s=state){
 const base=v1ScoreEvents(absStep,s).filter(e=>!e.tr.arp?.enabled||trackMap[e.id].drum),wrapped=mod(absStep,totalBars(s)*16),absBar=Math.floor(wrapped/16),bar=absBar%s.bars,st=wrapped%16,dt=stepSeconds(s),voicings=chordVoicings(s);
 for(const tr of s.tracks){const a=tr.arp;if(trackMap[tr.id].drum||!a?.enabled||!audible(tr,s)||tr.volume<=0||tr.density<=0||s.density<=0)continue;const level=arrangementLevel(tr.id,absBar,s);if(level<=0)continue;const seed=tr.locked&&tr.arpLock?tr.arpLock.seed:s.seed,mutation=tr.locked&&tr.arpLock?tr.arpLock.mutation:s.mutation;
  let chord=a.source==='pattern'?[...new Set((s.patterns[tr.id]?.[bar]||[]).flatMap(e=>e?.n||[]))].sort((x,y)=>x-y):voicings[harmonyIndex(bar,s)].slice();if(!chord.length)continue;
  if(tr.id==='bass'){while(Math.min(...chord)>40)chord=chord.map(x=>x-12);}else if(tr.id==='arp'||tr.id==='lead'){while(Math.min(...chord)<58)chord=chord.map(x=>x+12);}
  const pool=[...new Set(Array.from({length:a.octaves},(_,o)=>chord.map(x=>x+o*12)).flat())].filter(n=>n>=24&&n<=108).sort((x,y)=>x-y);if(!pool.length)continue;
  const interval=arpRates[a.rate].step;const chordStart=Math.ceil(harmonyIndex(bar,s)*s.bars/s.degrees.length)*16;const phase=a.reset==='bar'?st:a.reset==='chord'?bar*16+st-chordStart:wrapped;
  const first=Math.ceil((phase-1e-7)/interval),last=Math.ceil((phase+1-1e-7)/interval);
  for(let index=first;index<last;index++){const pos=index*interval-phase;if(pos<-.00001||pos>=1-.00001)continue;const j=mod(index,a.length),rnd=rng(seed+'|arp|'+mutation+'|'+tr.id+'|'+bar+'|'+index+'|'+tr.revision);if(mod((j-a.rotation)*a.pulses,16)>=a.pulses||rnd()>a.probability/100*clamp(s.density/60,0,1)*clamp(tr.density/82,0,1))continue;
   const notes=orderedArp(pool,j,a.mode,a.mode==='walk'?rng(seed+'|arp-walk|'+mutation+'|'+tr.id+'|'+tr.revision):rnd).map(n=>clamp(n+tr.octave*12,12,119));const v=clamp((.55+(j%4===0?a.accent/100*.45:0)+(rnd()-.5)*.08)*level,.05,1),feel=s.human/100,drift=(rnd()-.5)*.01*feel;const swing=st%2?dt*.58*s.swing/100:0;
   for(let k=0;k<a.ratchet;k++)base.push({id:tr.id,tr,n:notes,v:v*Math.pow(.87,k),d:Math.max(.016,interval*dt/a.ratchet*a.gate/100),offset:pos*dt+swing+drift+k*interval*dt/a.ratchet,strum:0,hash:hash(seed+'|arpSound|'+tr.id+'|'+wrapped+'|'+index+'|'+k),arp:true});
  }
 }
 return base.sort((a,b)=>a.offset-b.offset);
};

// ── 7. Sound engine v2: layered drums, expressive oscillators, channel FX ─────
const driveCurves=new Map();
function driveCurve(amount){const key=Math.round(amount);if(driveCurves.has(key))return driveCurves.get(key);const a=new Float32Array(2049),k=1+key*.055;for(let i=0;i<a.length;i++){const x=i/(a.length-1)*2-1;a[i]=key===0?x:Math.tanh(x*k)/Math.tanh(k);}driveCurves.set(key,a);return a;}
const oldEngineUpdate=SynthEngine.prototype.update,oldEngineDispose=SynthEngine.prototype.dispose;
SynthEngine.prototype.initV2=function(s){
 const N=this.N,now=this.ctx.currentTime;this.fxOsc=[];
 const lfo=(rate,dest,depth)=>{const o=N('createOscillator'),g=N('createGain');o.type='sine';o.frequency.value=rate;g.gain.value=depth;o.connect(g).connect(dest);o.start(now);this.fxOsc.push(o);return{o,g};};
 // Drum parallel bus. Dry and compressed paths share color but not dynamics.
 this.drumInput=N('createGain');this.drumDrive=N('createWaveShaper');this.drumDrive.oversample='2x';this.drumMakeup=N('createGain');this.drumDry=N('createGain');this.drumComp=N('createDynamicsCompressor');this.drumComp.threshold.value=-25;this.drumComp.knee.value=12;this.drumComp.ratio.value=6;this.drumComp.attack.value=.010;this.drumComp.release.value=.12;this.drumCrush=N('createGain');this.drumInput.connect(this.drumDrive).connect(this.drumMakeup);this.drumMakeup.connect(this.drumDry).connect(this.sum);this.drumMakeup.connect(this.drumComp).connect(this.drumCrush).connect(this.sum);
 // Stereo modulated delays; the low cut keeps the sub out of the wet image.
 this.chorusInput=N('createGain');const chp=N('createBiquadFilter');chp.type='highpass';chp.frequency.value=220;this.chorusInput.connect(chp);this.chorusLFO=[];
 for(let side=0;side<2;side++){const d=N('createDelay',.1),p=N('createStereoPanner'),g=N('createGain');d.delayTime.value=side?.026:.018;p.pan.value=side?.85:-.85;g.gain.value=.36;chp.connect(d).connect(p).connect(g).connect(this.sum);(this.returnNodes7||=[]).push(g);this.chorusLFO.push(lfo(side?.39:.33,d.delayTime,.003));}
 // Four-stage all-pass network, in parallel with the track's dry signal.
 this.phaserInput=N('createGain');let prev=this.phaserInput;this.phaserLFO=[];for(const f of [280,640,1450,3300]){const p=N('createBiquadFilter');p.type='allpass';p.frequency.value=f;p.Q.value=.6;prev.connect(p);prev=p;this.phaserLFO.push(lfo(.18,p.frequency,f*.62));}const phaserOut=N('createGain');phaserOut.gain.value=.45;prev.connect(phaserOut).connect(this.sum);(this.returnNodes7||=[]).push(phaserOut);
 this.masterLow=N('createBiquadFilter');this.masterLow.type='lowshelf';this.masterLow.frequency.value=130;this.masterHigh=N('createBiquadFilter');this.masterHigh.type='highshelf';this.masterHigh.frequency.value=5200;this.highpass.disconnect();this.highpass.connect(this.masterLow).connect(this.masterHigh).connect(this.masterFilter);
 this.preDelay=N('createDelay',.15);this.reverbInput.disconnect();this.reverbInput.connect(this.preDelay).connect(this.convolver);this.revFade=N('createGain');this.convolver.disconnect();this.convolver.connect(this.revFade).connect(this.reverbHP);this.revStyle=s.master.reverbKind;
 for(const tr of s.tracks){const ch=this.channels[tr.id];ch.hp=N('createBiquadFilter');ch.hp.type='highpass';ch.hp.Q.value=.55;ch.saturator=N('createWaveShaper');ch.saturator.oversample='2x';ch.makeup=N('createGain');ch.lowEQ=N('createBiquadFilter');ch.lowEQ.type='lowshelf';ch.lowEQ.frequency.value=180;ch.highEQ=N('createBiquadFilter');ch.highEQ.type='highshelf';ch.highEQ.frequency.value=4400;ch.input.disconnect();ch.input.connect(ch.hp).connect(ch.saturator).connect(ch.makeup).connect(ch.lowEQ).connect(ch.highEQ).connect(ch.filter);
  ch.chorus=N('createGain');ch.phaser=N('createGain');ch.pan.connect(ch.chorus).connect(this.chorusInput);ch.pan.connect(ch.phaser).connect(this.phaserInput);
  ch.trem=N('createGain');ch.gain.disconnect();ch.gain.connect(ch.trem).connect(ch.pan);ch.tremLfo=lfo(s.bpm/60*2,ch.trem.gain,0);ch.panLfo=lfo(s.bpm/60/4,ch.pan.pan,0);
  if(trackMap[tr.id].drum){ch.pan.disconnect(this.sum);ch.pan.connect(this.drumInput);}
 }
};
SynthEngine.prototype.createImpulse=function(){
 const kind=this.state.master.reverbKind||'plate',length={room:.75,plate:1.9,hall:3.1,cavern:3.9}[kind]||1.9,sr=this.ctx.sampleRate,buf=this.ctx.createBuffer(2,Math.ceil(sr*length),sr);
 for(let c=0;c<2;c++){const rand=rng('umbra2-'+kind+'-'+c),a=buf.getChannelData(c);let lp=0;for(let i=0;i<a.length;i++){const t=i/sr,x=rand()*2-1;lp=lp*.55+x*.45;const decay=Math.exp(-6.8*t/length),fade=Math.min(1,t/(kind==='plate'?.012:.035));a[i]=(kind==='plate'?x*.52+lp*.48:lp)*decay*fade*.62;}for(const [delay,g] of [[.009,.28],[.021,.23],[.037,.18],[.061,.13],[.097,.10]]){const at=Math.round((delay*(kind==='room'?.65:1)+c*.003)*sr);if(at<a.length)a[at]+=g;}}
 return buf;
};
SynthEngine.prototype.switchReverb=function(kind){if(kind===this.revStyle||this.disposed)return;this.revStyle=kind;const old=this.convolver,oldGain=this.revFade,newConv=this.N('createConvolver'),newGain=this.N('createGain'),now=this.ctx.currentTime;newConv.buffer=this.createImpulse();newGain.gain.value=0;this.preDelay.connect(newConv).connect(newGain).connect(this.reverbHP);oldGain.gain.setTargetAtTime(0,now,.025);newGain.gain.setTargetAtTime(1,now,.025);this.convolver=newConv;this.revFade=newGain;if(!this.offline)setTimeout(()=>{try{this.preDelay.disconnect(old);old.disconnect();oldGain.disconnect();}catch{}this.nodes=this.nodes.filter(n=>n!==old&&n!==oldGain);},180);};
SynthEngine.prototype.update=function(s,immediate=false){oldEngineUpdate.call(this,s,immediate);if(!this.drumInput||this.disposed)return;const m=s.master,set=(p,v)=>this.set(p,v,immediate);
 this.switchReverb(m.reverbKind);set(this.preDelay.delayTime,m.predelay/1000);set(this.reverbLP.frequency,m.damping);set(this.delayFilterL.frequency,m.delayTone);set(this.delayFilterR.frequency,m.delayTone);
 if(this.lastDrumDrive!==m.drumDrive){this.drumDrive.curve=driveCurve(m.drumDrive);this.lastDrumDrive=m.drumDrive;}set(this.drumMakeup.gain,1/(1+m.drumDrive*.025));set(this.drumDry.gain,1-m.drumCrush/100*.3);set(this.drumCrush.gain,m.drumCrush/100*1.7);
 set(this.compressor.threshold,-6-m.glue*.22);set(this.compressor.ratio,1.4+m.glue*.045);set(this.compressor.attack,.013);set(this.compressor.release,.16);set(this.masterLow.gain,m.lowEQ);set(this.masterHigh.gain,m.highEQ);
 this.chorusLFO.forEach((x,i)=>{set(x.o.frequency,m.chorusRate*(i?1.07:.97));set(x.g.gain,.0003+m.chorusDepth/100*.005);});this.phaserLFO.forEach(x=>set(x.o.frequency,m.phaserRate));
 for(const tr of s.tracks){const ch=this.channels[tr.id];if(ch.lastDrive!==tr.drive){ch.saturator.curve=driveCurve(tr.drive);ch.lastDrive=tr.drive;}set(ch.makeup.gain,1/(1+tr.drive*.025));set(ch.hp.frequency,tr.highpass);set(ch.lowEQ.gain,tr.lowEQ);set(ch.highEQ.gain,tr.highEQ);set(ch.filter.Q,.5+tr.resonance*.04);set(ch.chorus.gain,tr.chorus/100);set(ch.phaser.gain,tr.phaser/100);set(ch.trem.gain,1-tr.tremolo/200);set(ch.tremLfo.g.gain,tr.tremolo/200);set(ch.tremLfo.o.frequency,s.bpm/60*2);set(ch.panLfo.g.gain,tr.autoPan/100*Math.max(0,1-Math.abs(tr.pan))*.8);set(ch.panLfo.o.frequency,s.bpm/60/4);}
};
SynthEngine.prototype.dispose=function(){for(const o of this.fxOsc||[])try{o.stop();}catch{}this.fxOsc=[];oldEngineDispose.call(this);};
// Layered drums: no recorded samples, no downloads. Each transient is synthesized.
SynthEngine.prototype.drum=function(id,tr,t,velocity,h){
 const sound=tr.sound,kind=sounds[sound].kind,decay=.45+tr.decay*.016,tex=tr.texture/100,tune=Math.pow(2,tr.tune/12),rand=rng(h);let dur=kind==='kick'?(sound==='kick808'?.9:sound==='kickDeep'?.68:sound==='kickTight'?.21:sound==='kickPunch'?.31:.43):kind==='snare'?(sound==='snareRoom'?.29:.22):kind==='open'?(sound==='open909'?.39:.50):kind==='hat'?(sound==='hat909'?.053:.068):sound==='ride'?1.3:sound==='tom'?.36:.20;dur*=decay;const v=this.voice(id,t,t+dur+.04),out=this.channels[id].input;
 const amp=(peak,a,d,dest=out,offset=0)=>{const g=v.node('createGain'),at=t+offset;g.gain.setValueAtTime(.00001,t);g.gain.setValueAtTime(.00001,at);g.gain.linearRampToValueAtTime(Math.max(.00002,peak*velocity),at+Math.max(.0004,a));g.gain.exponentialRampToValueAtTime(.00001,at+Math.max(a+.003,d));g.connect(dest);return g;};
 const filter=(type,f,q=.7)=>{const n=v.node('createBiquadFilter');n.type=type;n.frequency.value=Math.min(f,this.ctx.sampleRate*.46);n.Q.value=q;return n;};
 if(kind==='kick'){
  const root=(sound==='kick808'?42:sound==='kickDeep'?39:sound==='kick909'?51:sound==='kickPunch'?56:sound==='kickTight'?57:46)*tune*(.996+rand()*.008),g=amp(.82,.0015+tr.attack*.00013,dur),o=v.osc('sine',root*(sound==='kickPunch'?5.2:3.9),g);o.frequency.exponentialRampToValueAtTime(root,t+(sound==='kickTight'?.024:sound==='kick909'?.041:.060));o.frequency.exponentialRampToValueAtTime(root*.97,t+dur);
  const knock=amp(.11+tex*.12,.0008,.027),hp=filter('bandpass',380*tune,.85);hp.connect(knock);v.osc('triangle',root*4,hp,.7);v.noise(hp,rand(),.15);
  const click=amp((.016+tex*.06)*(sound==='kickDeep'?.4:1),.0006,.011),lp=filter('lowpass',3300+tr.tone*48),high=filter('highpass',1100);high.connect(lp).connect(click);v.noise(high,rand());
 }else if(kind==='snare'){
  const isClap=sound==='clap'||sound==='clapWide',brush=sound==='snareBrush',noiseOut=v.node('createGain'),hp=filter('highpass',brush?750:isClap?820:600),lp=filter('lowpass',brush?4100:6500+tex*4400);hp.connect(lp).connect(noiseOut).connect(out);v.noise(hp,rand());
  if(isClap){noiseOut.gain.setValueAtTime(.00001,t);for(const [off,g] of [[0,.39],[.009,.28],[.021,.35],[.034,.26]]){noiseOut.gain.linearRampToValueAtTime(g*velocity,t+off+.0008);noiseOut.gain.exponentialRampToValueAtTime(.007,t+off+.007);}noiseOut.gain.linearRampToValueAtTime(.23*velocity,t+.045);noiseOut.gain.exponentialRampToValueAtTime(.00001,t+dur);if(sound==='clapWide'){const bp=filter('bandpass',1800,1.1),g=amp(.13,.004,dur*.85,out,.008);bp.connect(g);v.noise(bp,rand());}}
  else{const peak=(brush?.29:sound==='snare909'?.51:.39)*velocity;noiseOut.gain.setValueAtTime(.00001,t);noiseOut.gain.linearRampToValueAtTime(peak,t+.002+tr.attack*.0001);noiseOut.gain.exponentialRampToValueAtTime(.00001,t+dur);const root=(sound==='snareRoom'?178:sound==='snare909'?190:184)*tune;for(const [f,g,d] of [[root,brush?.05:.23,.12],[root*1.68,brush?.02:.11,.065]]){const body=amp(g,.001,d*decay),o=v.osc('sine',f*1.19,body);o.frequency.exponentialRampToValueAtTime(f,t+.024);}if(!brush){const snap=amp(.10+tex*.07,.001,.021),bp=filter('bandpass',2600,1);bp.connect(snap);v.noise(bp,rand());}}
 }else if(kind==='hat'||kind==='open'){
  if(kind==='hat'&&id==='hat')for(const old of this.openHats)if(old.t<=t&&old.end>t){old.amp.gain.cancelScheduledValues(t);old.amp.gain.setTargetAtTime(.00001,t,.004);}
  const g=amp(kind==='open'?.25:sound==='shaker'?.22:.29,sound==='shaker'?.007:.0008,dur),hp=filter('highpass',(sound==='shaker'?3200:sound==='hatGrain'?4200:6100)*Math.pow(tune,.2)),lp=filter('lowpass',Math.min(16000,7800+tr.tone*100));hp.connect(lp).connect(g);const metallic=/Metal|909/.test(sound);v.noise(hp,rand(),metallic?.40:sound==='hatGrain'?.9:.75);
  if(metallic)for(const f of (/909/.test(sound)?[1771,2513,3181,4397,5683,7237]:[2053,2633,3379,4093,5477,6551]))v.osc('square',f*Math.pow(tune,.5),hp,.025+tex*.02);
  if(sound==='hatGrain'){const grain=amp(.06,.001,.026),bp=filter('bandpass',3600,1.5);bp.connect(grain);v.noise(bp,rand());}
  if(kind==='open'){v.amp=g;this.openHats.add(v);}
 }else if(sound==='ride'||sound==='metalPerc'){
  const ratios=sound==='ride'?[1,1.483,1.932,2.547,3.149,4.213,5.027,6.311]:[1,1.47,2.19,3.57,5.12];for(let i=0;i<ratios.length;i++){const g=amp((sound==='ride'?.07:.12)/Math.pow(i+1,.5),.001,dur*(1-i*.075));v.osc('sine',(sound==='ride'?810:430)*tune*ratios[i],g);}const air=amp(.055,.001,dur*.4),hp=filter('highpass',6200);hp.connect(air);v.noise(hp,rand());
 }else if(['tom','conga','tabla'].includes(sound)){
  const f=(sound==='tom'?112:sound==='tabla'?174:193)*tune*(.98+rand()*.04),body=amp(.47,.001,dur),o=v.osc('sine',f*1.6,body);o.frequency.exponentialRampToValueAtTime(f,t+.034);const harmonic=amp(.10+tex*.09,.001,dur*.55);v.osc('sine',f*(sound==='tabla'?2.81:1.59),harmonic);const tap=amp(.12,.0006,.018),bp=filter('bandpass',850,1.1);bp.connect(tap);v.noise(bp,rand());if(sound==='tabla'){const mg=v.node('createGain');mg.gain.setValueAtTime(f*.28,t);mg.gain.exponentialRampToValueAtTime(.01,t+.08);mg.connect(o.frequency);v.osc('sine',f*1.48,mg);}
 }else if(sound==='cowbell'){
  const g=amp(.20,.001,dur),bp=filter('bandpass',1250*tune,.8);bp.connect(g);v.osc('square',540*tune,bp,.58);v.osc('square',800*tune,bp,.42);
 }else{
  const f=(sound==='wood'?640:sound==='claves'?1230:970)*tune,g=amp(sound==='claves'?.29:.26,.0007,dur);v.osc('sine',f,g,.73);v.osc('sine',f*(sound==='claves'?2.51:1.52),g,.20);const a=amp(.05,.0005,.012),bp=filter('bandpass',2400,1);bp.connect(a);v.noise(bp,rand());
 }
 v.finish();
};
const v1Tonal=SynthEngine.prototype.tonal;
SynthEngine.prototype.tonal=function(id,tr,midi,t,velocity,duration,h){
 const sound=tr.sound,tuned=midi+tr.tune; // Fractional semitone tuning is intentionally audio-only.
 if(!newSounds[sound]){const expressive={...tr,tone:clamp(tr.tone*(.69+.40*velocity),0,100),texture:clamp(tr.texture*(.8+.4*velocity),0,100)};v1Tonal.call(this,id,expressive,tuned,t,velocity,duration,h);return;}
 const kind=sounds[sound].kind,pad=kind==='pad',bass=kind==='bass',f=midiHz(tuned),tex=tr.texture/100,dyn=velocity,pluck=['velvetEP','pianoModal','dulcimer','nylon','fmPluck','kalimba'].includes(sound);duration=Math.max(.025,duration);const release=pad?.25+tr.decay*.019:bass?.025+tr.decay*.003:pluck?.09+tr.decay*.010:.06+tr.decay*.006,attack=Math.min(duration*.35,pad?.025+tr.attack*.012:.001+tr.attack*.001);
 const end=t+duration+release+.03,v=this.voice(id,t,end),amp=v.node('createGain'),filter=v.node('createBiquadFilter');filter.type='lowpass';filter.Q.value=.6;filter.frequency.value=Math.min(this.ctx.sampleRate*.46,(bass?360:900)+Math.pow(tr.tone/100,1.8)*(bass?8500:17000)*(.6+.6*dyn));const peak=(bass?.39:pad?.12:pluck?.25:.20)*velocity;filter.connect(amp).connect(this.channels[id].input);amp.gain.setValueAtTime(.00001,t);amp.gain.linearRampToValueAtTime(peak,t+attack);amp.gain.exponentialRampToValueAtTime(Math.max(.00002,peak*(pad?.88:bass?.75:pluck?.19:.72)),t+duration);amp.gain.exponentialRampToValueAtTime(.00001,t+duration+release);
 const osc=(type,ratio=1,g=.5,det=0,pan=0)=>{if(!pan||bass)return v.osc(type,f*ratio,filter,g,det);const p=v.node('createStereoPanner');p.pan.value=pan;p.connect(filter);return v.osc(type,f*ratio,p,g,det);};
 const partial=(ratio,g,d,det=0)=>{if(f*ratio>this.ctx.sampleRate*.45)return;const gain=v.node('createGain');gain.gain.setValueAtTime(g,t);gain.gain.exponentialRampToValueAtTime(.0001,t+Math.min(d,duration+release));gain.connect(filter);v.osc('sine',f*ratio,gain,1,det);};
 const fm=(ratio,index,g=.8)=>{const o=osc('sine',1,g),mg=v.node('createGain');mg.gain.setValueAtTime(f*index*(.3+.9*dyn),t);mg.gain.exponentialRampToValueAtTime(Math.max(.002,f*index*.025),t+Math.min(duration+release,.12+tr.decay*.008));mg.connect(o.frequency);v.osc('sine',f*ratio,mg);return o;};
 const vib=(o,rate,cents)=>{const mg=v.node('createGain');mg.gain.value=cents;mg.connect(o.detune);v.osc('sine',rate,mg);};const spread=tr.spread/100;
 if(sound==='reese'){osc('sawtooth',1,.28,-7-tex*7);osc('sawtooth',1,.28,7+tex*7);osc('sine',1,.48);filter.frequency.setValueAtTime(450+tr.tone*32,t);filter.frequency.exponentialRampToValueAtTime(200+tr.tone*10,t+Math.min(duration,.32));}
 else if(sound==='rubber'){fm(1,.9+tex*3.5,.72);osc('sine',1,.28);filter.Q.value=1.4+tex*3;filter.frequency.setValueAtTime(800+tr.tone*50*dyn,t);filter.frequency.exponentialRampToValueAtTime(180+tr.tone*7,t+Math.min(duration,.24));}
 else if(sound==='organbass'){for(const [r,g] of [[1,.68],[2,.23],[3,.09],[4,.05]])osc('sine',r,g);partial(2,.16,.065);}
 else if(sound==='velvetEP'){fm(1.001,.6+tex*2.5,.62);osc('sine',1,.25,-1.5);partial(2.001,.16*dyn,.18+tr.decay*.012,2.3);partial(6.91,.10*dyn*dyn,.16);partial(9.18,.04*tex,.06);filter.frequency.value=2200+tr.tone*62*dyn;}
 else if(sound==='pianoModal'){for(const [ratio,g,d] of [[1,.55,3.2],[2.001,.23,1.9],[3.004,.12,1.2],[4.011,.08,.7],[5.024,.04,.3],[7.044,.025,.15]]){partial(ratio,g*(ratio===1?1:.35+.9*dyn),d*(.5+tr.decay/70));if(ratio<3)partial(ratio,g*.24,2,2+spread*5);}const hammer=v.node('createBiquadFilter');hammer.type='bandpass';hammer.frequency.value=Math.min(f*5,5500);hammer.Q.value=.9;const g=v.node('createGain');g.gain.setValueAtTime(.05*dyn,t);g.gain.exponentialRampToValueAtTime(.0001,t+.02);hammer.connect(g).connect(filter);v.noise(hammer,(h%999)/999);}
 else if(sound==='dulcimer'){for(const [r,g,d]of[[1,.52,2.2],[2.003,.27,1.5],[3.017,.15,.9],[4.035,.09,.45],[5.061,.06,.23]])partial(r,g,d,-2);partial(1,.25,1.9,3+spread*6);}
 else if(sound==='nylon'){const src=v.node('createBufferSource');src.buffer=this.pluckBuffer(tuned,{...tr,texture:22,decay:tr.decay});src.connect(filter);v.sources.push(src);src.start(t);src.stop(Math.min(end,t+src.buffer.duration));filter.frequency.value=1000+tr.tone*55;partial(1,.06,.2);}
 else if(sound==='pwmPad'){for(const [d,p]of[[-6,-spread],[6,spread]]){const o=osc('pulse',1,.23,d,p);vib(o,.21+tex*.2,3);}osc('triangle',1,.38);filter.frequency.value=850+tr.tone*48;}
 else if(sound==='airPad'){for(const [d,p]of[[-4,-spread],[4,spread]]){const o=osc('triangle',1,.36,d,p);vib(o,.19,2);}osc('sine',2,.10);const air=v.node('createBiquadFilter');air.type='bandpass';air.frequency.value=1400+tr.tone*25;air.Q.value=1.8;air.connect(filter);v.noise(air,(h%999)/999,.05+tex*.045);}
 else if(sound==='supersaw'){[-1,-.5,0,.5,1].forEach((x,i)=>{const o=osc('sawtooth',1,.15,x*(5+tex*15),x*spread);if(i===2)vib(o,.27,2);});osc('sine',1,.2);filter.frequency.value=900+tr.tone*65;}
 else if(sound==='fmPluck'){fm(2.004,.8+tex*4.2,.77);partial(1,.19,.30);partial(3,.10*dyn,.05);filter.frequency.setValueAtTime(1700+tr.tone*100*dyn,t);filter.frequency.exponentialRampToValueAtTime(900+tr.tone*18,t+Math.min(.24,duration));}
 else if(sound==='kalimba'){for(const[r,g,d]of[[1,.70,1.1],[2.76,.23,.21],[5.41,.09,.095],[8.93,.04,.04]])partial(r,g,d*(.6+tr.decay*.018));}
 else if(sound==='brass'){osc('sawtooth',1,.38,-3,-spread*.3);const o=osc('sawtooth',1,.32,3,spread*.3);osc('triangle',1,.22);vib(o,5.1,4+tex*4);filter.Q.value=1.0+tex*1.8;filter.frequency.setValueAtTime(400,t);filter.frequency.linearRampToValueAtTime(1300+tr.tone*60*dyn,t+Math.min(.08,duration*.3));filter.frequency.exponentialRampToValueAtTime(750+tr.tone*18,t+duration);}
 else if(sound==='syncLead'){const o=osc('pulse',1,.32);osc('sawtooth',2,.13,-4,-spread*.35);osc('sine',1,.35);vib(o,5.3,2+tex*6);filter.Q.value=1.2+tex*2;filter.frequency.setValueAtTime(1600+tr.tone*90,t);filter.frequency.exponentialRampToValueAtTime(800+tr.tone*20,t+duration);}
 v.finish();
};
// Voice budget applies only to realtime playback; offline export never drops notes.
const v1Voice=SynthEngine.prototype.voice;
SynthEngine.prototype.voice=function(id,t,end){if(!this.offline&&this.voices.size>192){let oldest=null;for(const x of this.voices)if(x.t<=t&&(!oldest||x.end<oldest.end))oldest=x;if(oldest){for(const s of oldest.sources)try{s.stop(Math.max(t,this.ctx.currentTime)+.008);}catch{}oldest.cleanup();}}return v1Voice.call(this,id,t,end);};

// ── 9. v2 controls, migration and lifecycle integration ─────────────────────
trackMap.arp.voices.push('syncLead','brass');
const harmonyMemo=new Map(),uncachedVoicings=chordVoicings;
chordVoicings=function(s=state){const key=JSON.stringify([s.root,s.scale,s.voicing,s.degrees,s.progression,s.chordEdits]);if(harmonyMemo.has(key))return harmonyMemo.get(key);const v=uncachedVoicings(s);if(harmonyMemo.size>96)harmonyMemo.delete(harmonyMemo.keys().next().value);harmonyMemo.set(key,v);return v;};
function fitHarmonyBars(){if(state.bars<state.degrees.length)state.bars=[4,8,12,16,24,32].find(x=>x>=state.degrees.length);}
const oldValidate=validateProject;
validateProject=function(payload){const out=oldValidate(payload),src=payload.state,num=(v,def,min,max,integer=false)=>{if(v===undefined)return def;if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max||integer&&!Number.isInteger(v))throw new Error('Parámetro v2 fuera de rango.');return v;},member=(v,def,opts)=>{if(v===undefined)return def;if(!opts.includes(v))throw new Error('Opción v2 inválida.');return v;};
 for(const[key,min,max]of[['predelay',0,80],['damping',1200,12000],['delayTone',700,12000],['chorusRate',.05,3],['chorusDepth',0,85],['phaserRate',.03,3],['drumDrive',0,70],['drumCrush',0,80],['glue',0,80],['lowEQ',-9,9],['highEQ',-9,9]])out.master[key]=num(src.master[key],out.master[key],min,max);out.master.reverbKind=member(src.master.reverbKind,'plate',['room','plate','hall','cavern']);
 for(const tr of out.tracks){const from=src.tracks.find(t=>t.id===tr.id);for(const[key,min,max]of[['tune',-12,12],['drive',0,70],['highpass',20,2000],['lowEQ',-12,12],['highEQ',-12,12],['chorus',0,80],['phaser',0,75],['tremolo',0,85],['autoPan',0,80],['spread',0,85],['resonance',0,65]])tr[key]=num(from[key],tr[key],min,max);if(from.arpLock!==undefined&&from.arpLock!==null){if(!from.arpLock||typeof from.arpLock.seed!=='string'||!from.arpLock.seed.length||from.arpLock.seed.length>64)throw new Error('Semilla bloqueada inválida.');tr.arpLock={seed:from.arpLock.seed,mutation:num(from.arpLock.mutation,0,0,100000,true)};}const a=from.arp;if(a!==undefined){if(!a||typeof a!=='object'||typeof a.enabled!=='boolean')throw new Error('Arpegiador inválido.');tr.arp.enabled=a.enabled;for(const[key,min,max]of[['octaves',1,4],['gate',10,140],['probability',10,100],['accent',0,80],['pulses',1,16],['rotation',0,15],['ratchet',1,3],['length',1,32]])tr.arp[key]=num(a[key],tr.arp[key],min,max,true);tr.arp.source=member(a.source,'chord',['chord','pattern']);tr.arp.mode=member(a.mode,'updown',Object.keys(arpModes));tr.arp.rate=member(a.rate,'8',Object.keys(arpRates));tr.arp.reset=member(a.reset,'chord',['chord','bar','free']);}else if(payload.version===1){tr.arp.enabled=false;}}
 if(src.chordEdits!==undefined&&src.chordEdits!==null){if(!Array.isArray(src.chordEdits)||src.chordEdits.length!==out.degrees.length)throw new Error('Ediciones de acordes inválidas.');out.chordEdits=src.chordEdits.map(x=>{if(!x||typeof x!=='object')throw new Error('Acorde inválido.');return{root:num(x.root,0,0,11,true),quality:member(x.quality,'auto',Object.keys(qualityLabels))};});}else out.chordEdits=null;
 if(out.bars<out.degrees.length)throw new Error('La frase tiene menos compases que acordes.');return out;
};
const REF_PROGRESSIONS=[{"id": "ref_major_01", "name": "Hopeful", "spanish": "Esperanzadora", "mode": "major", "formula": "I | V | vi | IV", "group": "Captura · mayor", "complexity": 16, "source": "user-screenshot", "adapted": false, "note": ""}, {"id": "ref_major_02", "name": "Yearning", "spanish": "Anhelo", "mode": "major", "formula": "I | V | vi | V", "group": "Captura · mayor", "complexity": 16, "source": "user-screenshot", "adapted": false, "note": ""}, {"id": "ref_major_03", "name": "Nostalgic", "spanish": "Nostálgica", "mode": "major", "formula": "I | V | ii | IV", "group": "Captura · mayor", "complexity": 16, "source": "user-screenshot", "adapted": false, "note": ""}, {"id": "ref_major_04", "name": "Optimistic", "spanish": "Optimista", "mode": "major", "formula": "I | vi | IV | V", "group": "Captura · mayor", "complexity": 16, "source": "user-screenshot", "adapted": false, "note": ""}, {"id": "ref_major_05", "name": "Cheerful", "spanish": "Alegre", "mode": "major", "formula": "I | IV | V | IV", "group": "Captura · mayor", "complexity": 16, "source": "user-screenshot", "adapted": false, "note": ""}, {"id": "ref_major_06", "name": "Reflective", "spanish": "Reflexiva", "mode": "major", "formula": "I | IV | vi | V", "group": "Captura · mayor", "complexity": 16, "source": "user-screenshot", "adapted": false, "note": ""}, {"id": "ref_major_07", "name": "Smooth", "spanish": "Fluida", "mode": "major", "formula": "I | vi | ii | V", "group": "Captura · mayor", "complexity": 16, "source": "user-screenshot", "adapted": false, "note": ""}, {"id": "ref_major_08", "name": "Confident", "spanish": "Segura", "mode": "major", "formula": "I | vi | IV | V", "group": "Captura · mayor", "complexity": 16, "source": "user-screenshot", "adapted": false, "note": ""}, {"id": "ref_major_09", "name": "Triumphant", "spanish": "Triunfal", "mode": "major", "formula": "IV | I | V | V", "group": "Captura · mayor", "complexity": 16, "source": "user-screenshot", "adapted": false, "note": ""}, {"id": "ref_major_10", "name": "Satisfying", "spanish": "Resolutiva", "mode": "major", "formula": "IV | I | V | vi", "group": "Captura · mayor", "complexity": 16, "source": "user-screenshot", "adapted": false, "note": ""}, {"id": "ref_major_11", "name": "Dramatic", "spanish": "Dramática", "mode": "major", "formula": "I | VI | I | V", "group": "Captura · mayor", "complexity": 16, "source": "user-screenshot", "adapted": false, "note": ""}, {"id": "ref_major_12", "name": "Longing", "spanish": "Añoranza", "mode": "major", "formula": "vi | V | IV | V", "group": "Captura · mayor", "complexity": 16, "source": "user-screenshot", "adapted": false, "note": ""}, {"id": "ref_major_13", "name": "Surprising", "spanish": "Sorpresiva", "mode": "major", "formula": "I | bVI | V | V", "group": "Captura · mayor", "complexity": 16, "source": "user-screenshot", "adapted": false, "note": ""}, {"id": "ref_major_14", "name": "Serene", "spanish": "Serena", "mode": "major", "formula": "I | II | V/vi | vi", "group": "Captura · mayor", "complexity": 35, "source": "user-screenshot", "adapted": false, "note": ""}, {"id": "ref_major_15", "name": "Bittersweet", "spanish": "Agridulce", "mode": "major", "formula": "IV | iv | I | I", "group": "Captura · mayor", "complexity": 35, "source": "user-screenshot", "adapted": false, "note": ""}, {"id": "ref_major_16", "name": "Warm", "spanish": "Cálida", "mode": "major", "formula": "IV | bVII | I | I", "group": "Captura · mayor", "complexity": 35, "source": "user-screenshot", "adapted": false, "note": ""}, {"id": "ref_major_17", "name": "Comforting", "spanish": "Reconfortante", "mode": "major", "formula": "IV | ii/bVII | I | I", "group": "Captura · mayor", "complexity": 35, "source": "user-screenshot", "adapted": false, "note": ""}, {"id": "ref_major_18", "name": "Gentle", "spanish": "Delicada", "mode": "major", "formula": "I | ii7 | I | IV", "group": "Captura · mayor", "complexity": 35, "source": "user-screenshot", "adapted": false, "note": ""}, {"id": "ref_major_19", "name": "Dreamy", "spanish": "Soñadora", "mode": "major", "formula": "I | vi | IV | iv/bvi", "group": "Captura · mayor", "complexity": 35, "source": "user-screenshot", "adapted": false, "note": ""}, {"id": "ref_major_20", "name": "Contemplative", "spanish": "Contemplativa", "mode": "major", "formula": "I | vi | IV | Vsus4", "group": "Captura · mayor", "complexity": 35, "source": "user-screenshot", "adapted": false, "note": ""}, {"id": "ref_major_21", "name": "Bold", "spanish": "Audaz", "mode": "major", "formula": "I | iii7 | vi | IV", "group": "Captura · mayor", "complexity": 35, "source": "user-screenshot", "adapted": false, "note": ""}, {"id": "ref_major_22", "name": "Dynamic", "spanish": "Dinámica", "mode": "major", "formula": "bVII | ii | Isus4 | I", "group": "Captura · mayor", "complexity": 35, "source": "user-screenshot", "adapted": false, "note": ""}, {"id": "ref_major_23", "name": "Joyful", "spanish": "Jubilosa", "mode": "major", "formula": "I | II | iii | V", "group": "Captura · mayor", "complexity": 35, "source": "user-screenshot", "adapted": false, "note": ""}, {"id": "ref_major_24", "name": "Lush", "spanish": "Frondosa", "mode": "major", "formula": "I | I | bII/bVI | bVII", "group": "Captura · mayor", "complexity": 35, "source": "user-screenshot", "adapted": true, "note": "Separación de acordes normalizada: en la captura falta un guion. Revisá la fórmula antes de aplicar."}, {"id": "ref_major_25", "name": "Sweet", "spanish": "Dulce", "mode": "major", "formula": "IV | IVsus2 | I | I", "group": "Captura · mayor", "complexity": 35, "source": "user-screenshot", "adapted": false, "note": ""}, {"id": "ref_major_26", "name": "Romantic", "spanish": "Romántica", "mode": "major", "formula": "IΔ | IΔ | ii | V", "group": "Captura · mayor", "complexity": 78, "source": "user-screenshot", "adapted": false, "note": ""}, {"id": "ref_major_27", "name": "Warm", "spanish": "Cálida · séptimas", "mode": "major", "formula": "ii7 | V7 | IΔ | IΔ", "group": "Captura · mayor", "complexity": 78, "source": "user-screenshot", "adapted": false, "note": ""}, {"id": "ref_major_28", "name": "Longing", "spanish": "Añoranza · extendida", "mode": "major", "formula": "ii9 | V13 | IΔ | IΔ", "group": "Captura · mayor", "complexity": 78, "source": "user-screenshot", "adapted": false, "note": ""}, {"id": "ref_major_29", "name": "Soulful", "spanish": "Soul", "mode": "major", "formula": "I7 | IV7 | I7 | V", "group": "Captura · mayor", "complexity": 78, "source": "user-screenshot", "adapted": false, "note": ""}, {"id": "ref_major_30", "name": "Complex", "spanish": "Compleja", "mode": "major", "formula": "I7 | vi7 | V | viadd9", "group": "Captura · mayor", "complexity": 78, "source": "user-screenshot", "adapted": false, "note": ""}, {"id": "ref_major_31", "name": "Enchanting", "spanish": "Encantadora", "mode": "major", "formula": "I7 | #V9 | IV7 | Vadd11", "group": "Captura · mayor", "complexity": 78, "source": "user-screenshot", "adapted": false, "note": ""}, {"id": "ref_major_32", "name": "Hopeful", "spanish": "Esperanzadora · color", "mode": "major", "formula": "I7 | vi | IV7 | Vsus4", "group": "Captura · mayor", "complexity": 78, "source": "user-screenshot", "adapted": false, "note": ""}, {"id": "ref_major_33", "name": "Grand", "spanish": "Grandiosa", "mode": "major", "formula": "IΔ | VII7 | iii | V", "group": "Captura · mayor", "complexity": 78, "source": "user-screenshot", "adapted": false, "note": ""}, {"id": "ref_major_34", "name": "Rich", "spanish": "Rica", "mode": "major", "formula": "IΔ9 | VII7 | iii9 | VΔ", "group": "Captura · mayor", "complexity": 78, "source": "user-screenshot", "adapted": false, "note": ""}, {"id": "ref_major_35", "name": "Ethereal", "spanish": "Etérea", "mode": "major", "formula": "I | Isus2Δ | II | vii/ii", "group": "Captura · mayor", "complexity": 78, "source": "user-screenshot", "adapted": false, "note": ""}, {"id": "ref_major_36", "name": "Mystical", "spanish": "Mística", "mode": "major", "formula": "Iadd9 | vi | IVadd9 | Vadd9", "group": "Captura · mayor", "complexity": 78, "source": "user-screenshot", "adapted": false, "note": ""}, {"id": "ref_major_37", "name": "Yearning", "spanish": "Anhelo · pedal", "mode": "major", "formula": "I9 | iv11/i | I9 | iv11/i", "group": "Captura · mayor", "complexity": 78, "source": "user-screenshot", "adapted": false, "note": ""}, {"id": "ref_major_38", "name": "Restless", "spanish": "Inquieta", "mode": "major", "formula": "I7 | I7 | vii°7 | ii7b5", "group": "Captura · mayor", "complexity": 78, "source": "user-screenshot", "adapted": false, "note": ""}, {"id": "ref_major_39", "name": "Bittersweet", "spanish": "Agridulce · extendida", "mode": "major", "formula": "I | iv/i | v/bvii | bVIIsus2add6", "group": "Captura · mayor", "complexity": 78, "source": "user-screenshot", "adapted": true, "note": "Separación de acordes normalizada: en la captura falta un guion. Revisá la fórmula antes de aplicar."}, {"id": "ref_major_40", "name": "Distant", "spanish": "Distante", "mode": "major", "formula": "Isus2 7 | iv9 | bVIIsus2add6 | bIIIΔ", "group": "Captura · mayor", "complexity": 78, "source": "user-screenshot", "adapted": false, "note": ""}, {"id": "ref_major_41", "name": "Playful", "spanish": "Juguetona", "mode": "major", "formula": "Vadd4 | Vadd9 | IIsus4Δ9 | iii7", "group": "Captura · mayor", "complexity": 78, "source": "user-screenshot", "adapted": false, "note": ""}, {"id": "ref_minor_01", "name": "Melancholic", "spanish": "Melancólica", "mode": "minor", "formula": "i | v | bVI | iv", "group": "Captura · menor", "complexity": 16, "source": "user-screenshot", "adapted": false, "note": ""}, {"id": "ref_minor_02", "name": "Tense", "spanish": "Tensa", "mode": "minor", "formula": "i | v | bVI | v", "group": "Captura · menor", "complexity": 16, "source": "user-screenshot", "adapted": false, "note": ""}, {"id": "ref_minor_03", "name": "Sad", "spanish": "Triste", "mode": "minor", "formula": "i | iv | v | iv", "group": "Captura · menor", "complexity": 16, "source": "user-screenshot", "adapted": false, "note": ""}, {"id": "ref_minor_04", "name": "Dramatic", "spanish": "Dramática", "mode": "minor", "formula": "i | iv | bVI | v", "group": "Captura · menor", "complexity": 16, "source": "user-screenshot", "adapted": false, "note": ""}, {"id": "ref_minor_05", "name": "Anxious", "spanish": "Ansiosa", "mode": "minor", "formula": "i | bVI | ii° | v", "group": "Captura · menor", "complexity": 16, "source": "user-screenshot", "adapted": false, "note": ""}, {"id": "ref_minor_06", "name": "Emotional", "spanish": "Emotiva", "mode": "minor", "formula": "i | bVI | iv | v", "group": "Captura · menor", "complexity": 16, "source": "user-screenshot", "adapted": false, "note": ""}, {"id": "ref_minor_07", "name": "Somber", "spanish": "Sombría", "mode": "minor", "formula": "iv | i | v | v", "group": "Captura · menor", "complexity": 16, "source": "user-screenshot", "adapted": false, "note": ""}, {"id": "ref_minor_08", "name": "Tragic", "spanish": "Trágica", "mode": "minor", "formula": "i | bVI | i | v", "group": "Captura · menor", "complexity": 16, "source": "user-screenshot", "adapted": false, "note": ""}, {"id": "ref_minor_09", "name": "Epic", "spanish": "Épica", "mode": "minor", "formula": "bVI | v | iv | v", "group": "Captura · menor", "complexity": 16, "source": "user-screenshot", "adapted": false, "note": ""}, {"id": "ref_minor_10", "name": "Brooding", "spanish": "Introspectiva oscura", "mode": "minor", "formula": "i | v | IVsus4 | IV", "group": "Captura · menor", "complexity": 16, "source": "user-screenshot", "adapted": false, "note": ""}, {"id": "ref_minor_11", "name": "Ominous", "spanish": "Ominosa", "mode": "minor", "formula": "i | iv | bIII | V/II", "group": "Captura · menor", "complexity": 16, "source": "user-screenshot", "adapted": false, "note": ""}, {"id": "ref_minor_12", "name": "Expansive", "spanish": "Expansiva", "mode": "minor", "formula": "i | bVI | bIII | bVII", "group": "Captura · menor", "complexity": 16, "source": "user-screenshot", "adapted": false, "note": ""}, {"id": "ref_minor_13", "name": "Atmospheric", "spanish": "Atmosférica", "mode": "minor", "formula": "i | bIII | v | IV", "group": "Captura · menor", "complexity": 16, "source": "user-screenshot", "adapted": false, "note": ""}, {"id": "ref_minor_14", "name": "Enigmatic", "spanish": "Enigmática", "mode": "minor", "formula": "i | v | bIIIadd6 | ii°", "group": "Captura · menor", "complexity": 35, "source": "user-screenshot", "adapted": false, "note": ""}, {"id": "ref_minor_15", "name": "Exotic", "spanish": "Exótica", "mode": "minor", "formula": "i11 | bVI°add#5 | bVI7 | bIII7", "group": "Captura · menor", "complexity": 78, "source": "user-screenshot", "adapted": false, "note": ""}, {"id": "ref_minor_16", "name": "Listful", "spanish": "Ensoñación", "mode": "minor", "formula": "i11 | bVIIΔ9 | i11 | bVIIΔ9", "group": "Captura · menor", "complexity": 78, "source": "user-screenshot", "adapted": false, "note": ""}, {"id": "ref_minor_17", "name": "Hypnotic", "spanish": "Hipnótica", "mode": "minor", "formula": "i | bVII | bVIΔ | Vaug7", "group": "Captura · menor", "complexity": 78, "source": "user-screenshot", "adapted": false, "note": ""}, {"id": "ref_minor_18", "name": "Sorrowful", "spanish": "Afligida", "mode": "minor", "formula": "i7 | iv7 | bVII | i7", "group": "Captura · menor", "complexity": 78, "source": "user-screenshot", "adapted": false, "note": ""}, {"id": "ref_minor_19", "name": "Complex", "spanish": "Compleja", "mode": "minor", "formula": "i7 | vadd9 | ii° | bVIsus4", "group": "Captura · menor", "complexity": 78, "source": "user-screenshot", "adapted": false, "note": ""}, {"id": "ref_minor_20", "name": "Poignant", "spanish": "Conmovedora", "mode": "minor", "formula": "i7 | v | bVI | i7", "group": "Captura · menor", "complexity": 78, "source": "user-screenshot", "adapted": false, "note": ""}, {"id": "ref_minor_21", "name": "Introspective", "spanish": "Introspectiva", "mode": "minor", "formula": "i7 | bVI7 | bIII | i7", "group": "Captura · menor", "complexity": 78, "source": "user-screenshot", "adapted": false, "note": ""}, {"id": "ref_minor_22", "name": "Seductive", "spanish": "Seductora", "mode": "minor", "formula": "i9 | ii7 | i7 | IV7", "group": "Captura · menor", "complexity": 78, "source": "user-screenshot", "adapted": false, "note": ""}, {"id": "ref_minor_23", "name": "Dark", "spanish": "Oscura", "mode": "minor", "formula": "i11 | iv11/i | i11 | v7#5", "group": "Captura · menor", "complexity": 78, "source": "user-screenshot", "adapted": false, "note": ""}, {"id": "ref_minor_24", "name": "Pensive", "spanish": "Pensativa", "mode": "minor", "formula": "i9 | V9 | i11 | v7", "group": "Captura · menor", "complexity": 78, "source": "user-screenshot", "adapted": false, "note": ""}, {"id": "ref_minor_25", "name": "Anticipatory", "spanish": "Anticipación", "mode": "minor", "formula": "i | i | ii° | V", "group": "Captura · menor", "complexity": 78, "source": "user-screenshot", "adapted": false, "note": ""}, {"id": "ref_minor_26", "name": "Wistful", "spanish": "Nostalgia tenue", "mode": "minor", "formula": "i | bVII/II | bIIIadd9 | IV", "group": "Captura · menor", "complexity": 78, "source": "user-screenshot", "adapted": false, "note": ""}, {"id": "ref_minor_27", "name": "Hopeful", "spanish": "Esperanzadora", "mode": "minor", "formula": "i | bVII | ii/IV | Vsus4", "group": "Captura · menor", "complexity": 78, "source": "user-screenshot", "adapted": false, "note": ""}, {"id": "ref_minor_28", "name": "Celestial", "spanish": "Celestial", "mode": "minor", "formula": "i | Isus2 | bVI | bVIIsus4", "group": "Captura · menor", "complexity": 78, "source": "user-screenshot", "adapted": false, "note": ""}, {"id": "ref_minor_29", "name": "Floating", "spanish": "Flotante", "mode": "minor", "formula": "i | Vsus4 | bVI | IVsus2", "group": "Captura · menor", "complexity": 78, "source": "user-screenshot", "adapted": false, "note": ""}, {"id": "ref_minor_30", "name": "Serene", "spanish": "Serena", "mode": "minor", "formula": "i | Isus2 | bVI | Vsus4", "group": "Captura · menor", "complexity": 78, "source": "user-screenshot", "adapted": false, "note": ""}, {"id": "ref_minor_31", "name": "Regal", "spanish": "Regia", "mode": "minor", "formula": "i | bVIIsus4 | bVI M7 | V", "group": "Captura · menor", "complexity": 78, "source": "user-screenshot", "adapted": false, "note": ""}, {"id": "ref_minor_32", "name": "Evocative", "spanish": "Evocadora", "mode": "minor", "formula": "i | bIII | iv | vii°addb6", "group": "Captura · menor", "complexity": 78, "source": "user-screenshot", "adapted": false, "note": ""}, {"id": "ref_minor_33", "name": "Nostalgic", "spanish": "Nostálgica", "mode": "minor", "formula": "i | bIII | IVsus2 | IV", "group": "Captura · menor", "complexity": 78, "source": "user-screenshot", "adapted": false, "note": ""}, {"id": "ref_minor_34", "name": "Velvety", "spanish": "Aterciopelada", "mode": "minor", "formula": "i | bVIadd9 | bIII | bVII", "group": "Captura · menor", "complexity": 78, "source": "user-screenshot", "adapted": false, "note": ""}, {"id": "ref_minor_35", "name": "Foreboding", "spanish": "Presagio", "mode": "minor", "formula": "i | bVIΔ | v7 | i7", "group": "Captura · menor", "complexity": 78, "source": "user-screenshot", "adapted": false, "note": ""}, {"id": "ref_minor_36", "name": "Alluring", "spanish": "Atrayente", "mode": "minor", "formula": "iadd9 | bVI | bIII | bVIIadd9", "group": "Captura · menor", "complexity": 78, "source": "user-screenshot", "adapted": false, "note": ""}, {"id": "ref_minor_37", "name": "Adventurous", "spanish": "Aventurera", "mode": "minor", "formula": "i | v/bvii | IV/VI | IV/II", "group": "Captura · menor", "complexity": 78, "source": "user-screenshot", "adapted": false, "note": ""}, {"id": "ref_minor_38", "name": "Transcendent", "spanish": "Trascendente", "mode": "minor", "formula": "i | i/biii | bVI | bVIsus2/bVII", "group": "Captura · menor", "complexity": 78, "source": "user-screenshot", "adapted": false, "note": ""}, {"id": "ref_minor_39", "name": "Intense", "spanish": "Intensa", "mode": "minor", "formula": "i | bVII9/I | bVIΔ/I | Isus2 7", "group": "Captura · menor", "complexity": 78, "source": "user-screenshot", "adapted": false, "note": ""}, {"id": "ref_minor_40", "name": "Passionate", "spanish": "Apasionada", "mode": "minor", "formula": "i | bVII | bVIΔ | Vaug7", "group": "Captura · menor", "complexity": 78, "source": "user-screenshot", "adapted": false, "note": ""}, {"id": "ref_minor_41", "name": "Sophisticated", "spanish": "Sofisticada", "mode": "minor", "formula": "i7 | bIII M7 | v9 | bVIIΔ/IV", "group": "Captura · menor", "complexity": 78, "source": "user-screenshot", "adapted": false, "note": ""}, {"id": "ref_minor_42", "name": "Colourful", "spanish": "Colorida", "mode": "minor", "formula": "iadd9 | iv9 | bVI M7#11 | V7b9", "group": "Captura · menor", "complexity": 78, "source": "user-screenshot", "adapted": false, "note": ""}];
// ── 10. UMBRA 3 · explicit harmony, reference library, and performance scores ──
// Original implementation. No Image-Line models, binaries, scores or assets are bundled.
const v3Meta={version:'3.0.0',sources:[
 'https://www.image-line.com/fl-studio-learning/fl-studio-online-manual/html/pianoroll_chordprogression.htm',
 'https://www.image-line.com/fl-studio-learning/fl-studio-online-manual/html/pianoroll_arpeggiate.htm',
 'https://www.image-line.com/fl-studio-learning/fl-studio-online-manual/html/pianoroll_chp.htm']};
const MAJOR_INTERVALS=[0,2,4,5,7,9,11],ROMANS=['I','II','III','IV','V','VI','VII'];
const QUALITY_SUFFIX={auto:'',maj:'',min:'m',dim:'dim',aug:'+',maj7:'maj7',min7:'m7',dom7:'7',dim7:'dim7',half:'ø7',maj9:'maj9',min9:'m9',dom9:'9',six:'6',min6:'m6',sus2:'sus2',sus4:'sus4',power:'5',alt:'7alt',custom:''};
Object.assign(Q,{min11:[0,3,7,10,14,17],dom11:[0,4,7,10,14,17],dom13:[0,4,7,10,14,17,21],maj13:[0,4,7,11,14,17,21],minMaj7:[0,3,7,11],add9:[0,4,7,14],minAdd9:[0,3,7,14],sus7:[0,5,7,10],custom:[0,4,7]});
Object.assign(qualityLabels,{min11:'Menor 11',dom11:'Dominante 11',dom13:'Dominante 13',maj13:'Mayor 13',minMaj7:'Menor / Maj 7',add9:'Mayor add9',minAdd9:'Menor add9',sus7:'7 sus4',custom:'Fórmula / intervalos propios'});
Object.assign(QUALITY_SUFFIX,{min11:'m11',dom11:'11',dom13:'13',maj13:'maj13',minMaj7:'m(maj7)',add9:'add9',minAdd9:'madd9',sus7:'7sus4'});
function normalizeMusic(text){return String(text).normalize('NFKC').replaceAll('♭','b').replaceAll('♯','#').replace(/[△∆]/g,'Δ').replaceAll('º','°').trim();}
function parseRootToken(text,tonic=0,romanOnly=false){
 const t=normalizeMusic(text).replace(/\s/g,'');
 const m=t.match(/^([b#]{0,2})(VII|III|VI|IV|II|V|I|vii|iii|vi|iv|ii|v|i)$/);
 if(m){const degree=ROMANS.indexOf(m[2].toUpperCase()),shift=[...m[1]].reduce((n,x)=>n+(x==='#'?1:-1),0);return{root:mod(MAJOR_INTERVALS[degree]+shift,12),degree,minor:m[2]===m[2].toLowerCase()};}
 if(!romanOnly){const n=t.match(/^([A-G])([b#]{0,2})$/);if(n)return{root:mod(({C:0,D:2,E:4,F:5,G:7,A:9,B:11})[n[1]]+[...n[2]].reduce((s,x)=>s+(x==='#'?1:-1),0)-tonic,12),degree:0,minor:false};}
 throw new Error('Raíz no reconocida: «'+text+'».');
}
function parseChordToken(token,{tonic=0,slashMode='bass'}={}){
 const source=normalizeMusic(token);let text=source.replace(/\s+/g,'').replace(/[()]/g,'').replace(/6\/9/g,'6add9');
 // Explicit secondary functions use > (V7>ii); / can be selected as bass or secondary.
 const secondary=text.includes('>')||(slashMode==='secondary'&&text.includes('/'));
 const split=text.split(secondary?/>|\//:/\//);if(split.length>2||!split[0])throw new Error('Barra o función secundaria inválida: '+source);
 text=split[0];const romanMatch=text.match(/^([b#]{0,2})(VII|III|VI|IV|II|V|I|vii|iii|vi|iv|ii|v|i)/);
 const namedMatch=romanMatch?null:text.match(/^([A-G])([b#]{0,2})/);
 if(!romanMatch&&!namedMatch)throw new Error('Acorde no reconocido: «'+source+'». Usá Cmaj7 o IΔ7.');
 const prefix=romanMatch?romanMatch[0]:namedMatch[0],r=parseRootToken(prefix,tonic),originalTail=text.slice(prefix.length);
 let tail=originalTail,minor=r.minor,dim=false,aug=false,major7=false,half=false;const altered=/alt$/.test(tail);if(altered)tail=tail.replace(/alt$/,'');
 if(/^minor|^min/i.test(tail)){minor=true;tail=tail.replace(/^minor|^min/i,'');}else if(/^m(?!aj)/.test(tail)){minor=true;tail=tail.slice(1);}
 tail=tail.replace(/major/gi,'maj').replace(/minor/gi,'min');
 if(/Δ|maj|M(?=7|9|11|13|$)/.test(tail)){major7=true;tail=tail.replace(/Δ|maj|M/g,'');}
 if(/dim|°/.test(tail)){dim=true;minor=true;tail=tail.replace(/dim|°/g,'');}
 if(/ø|half/.test(tail)){half=true;dim=true;minor=true;tail=tail.replace(/ø|half/g,'');}
 if(/aug|\+/.test(tail)){aug=true;tail=tail.replace(/aug|\+/g,'');}
 let intervals=[0,minor?3:4,dim?6:aug?8:7],suffix=(half?'ø':dim?'dim':aug?'+':minor?'m':'');
 const add=[];tail=tail.replace(/add([b#]?)(2|4|5|6|7|9|11|13)/g,(_,acc,num)=>{const degree=Number(num),base={2:2,4:5,5:7,6:9,7:10,9:14,11:17,13:21}[degree];add.push(base+(acc==='#'?1:acc==='b'?-1:0));return'';});
 let sus='';tail=tail.replace(/sus(2|4)/g,(_,n)=>{sus=n;intervals[1]=n==='2'?2:5;return'';});
 const alters=[];tail=tail.replace(/([b#])(5|6|9|11|13)/g,(_,acc,n)=>{alters.push([Number(n),acc==='#'?1:-1]);return'';});
 let ext=tail.match(/^(13|11|9|7|6|5)?$/);if(!ext)throw new Error('Extensión no reconocida en «'+source+'»: '+tail);
 ext=ext[1]?Number(ext[1]):major7||half?7:0;
 if(ext===5)intervals=[0,7,12];
 if(ext===6)intervals.push(9);
 if(ext>=7){intervals.push(major7?11:dim&&!half?9:10);if(ext>=9)intervals.push(14);if(ext>=11)intervals.push(17);if(ext>=13)intervals.push(21);}
 for(const[n,alter]of alters){const base={5:7,6:9,9:14,11:17,13:21}[n];intervals=intervals.filter(x=>n===5?![6,7,8].includes(x):x!==base);intervals.push(base+alter);}
 intervals=[...new Set(intervals.concat(add))].sort((a,b)=>a-b);
 if(sus)suffix='sus'+sus;else if(ext===5)suffix='5';
 if(ext&&ext!==5)suffix+=(major7?'maj':'')+ext;
 for(const[n,alter]of alters)suffix+=(alter>0?'♯':'♭')+n;
 const additions=[...originalTail.matchAll(/add([b#]?)(2|4|5|6|7|9|11|13)/g)];for(const x of additions)suffix+='add'+x[1].replace('b','♭').replace('#','♯')+x[2];
 if(altered){intervals=Q.alt.slice();suffix='7alt';}
 let root=r.root,bass=null;
 if(split[1]){const to=parseRootToken(split[1],tonic);if(secondary)root=mod(root+to.root,12);else bass=to.root;}
 const quality=Object.keys(Q).find(k=>k!=='custom'&&JSON.stringify(Q[k])===JSON.stringify(intervals))||'custom';
 return{root,quality,intervals,suffix,roman:source,degree:r.degree,bass,inversion:0,layout:'auto',locked:false};
}
function parseProgression(text,options={}){
 let norm=normalizeMusic(text).replace(/[–—]/g,'-');
 let parts=norm.split(/[|,;\n]+/).map(x=>x.trim()).filter(Boolean);
 if(parts.length===1&&norm.includes('-'))parts=norm.split(/-/).map(x=>x.trim()).filter(Boolean);
 if(parts.length===1&&parts[0].includes(' '))parts=parts[0].replace(/\s+(?=[b#]?(?:VII|III|VI|IV|II|V|I|vii|iii|vi|iv|ii|v|i|[A-G])(?:\b|[0-9Δ]))/g,'|').split('|').map(x=>x.trim());
 if(parts.length<2||parts.length>12)throw new Error('Escribí entre 2 y 12 acordes, separados por | o comas.');
 return parts.map((p,i)=>{try{return parseChordToken(p,options);}catch(err){throw new Error('Acorde '+(i+1)+': '+err.message);}});
}
for(const row of REF_PROGRESSIONS){const chords=parseProgression(row.formula);progressions[row.id]={name:row.name+' · '+row.formula.replaceAll(' | ','–'),degrees:chords.map(c=>c.degree),chords,meta:row};}
const legacyRawAt=rawAt,legacyLabelAt=labelAt;
rawAt=function(i,s=state){const spec=chordSpecs(s)?.[i];if(spec?.intervals?.length)return spec.intervals.map(x=>s.root+48+spec.root+x);return legacyRawAt(i,s);};
labelAt=function(i,s=state){const spec=chordSpecs(s)?.[i];if(spec&&spec.quality!=='auto'){const suffix=spec.suffix??QUALITY_SUFFIX[spec.quality]??'';return noteName(s.root+spec.root)+suffix+(spec.bass!==null&&spec.bass!==undefined?'/'+noteName(s.root+spec.bass):'');}return legacyLabelAt(i,s);};
chordRoot=function(bar,s=state,oct=2){const i=harmonyIndex(bar,s),spec=chordSpecs(s)?.[i];return spec&&spec.bass!==null&&spec.bass!==undefined?s.root+12*(oct+1)+spec.bass:rawAt(i,s)[0]+12*(oct-3);};
function specAt(index,s=state){const existing=chordSpecs(s)?.[index];if(existing)return{inversion:0,layout:'auto',bass:null,locked:false,...clone(existing)};return{root:mod(rawAt(index,s)[0]-s.root,12),quality:'auto',bass:null,inversion:0,layout:'auto',locked:false,degree:s.degrees[index]};}
const v2Voicings=chordVoicings;
const voicingMemo3=new Map();
chordVoicings=function(s=state){
 const h=s.harmony||{layout:'auto',register:0},specs=chordSpecs(s),key=JSON.stringify([s.root,s.scale,s.voicing,s.degrees,s.progression,s.chordEdits,h.layout,h.register]);
 if(voicingMemo3.has(key))return voicingMemo3.get(key);
 const compact=v2Voicings(s),out=compact.map((input,i)=>{const spec=specs?.[i],layout=spec?.layout&&spec.layout!=='auto'?spec.layout:h.layout||'auto';let notes=input.slice();
  if(layout==='block'){notes=rawAt(i,s).slice();while(notes[0]>60)notes=notes.map(n=>n-12);while(notes[0]<48)notes=notes.map(n=>n+12);}
  if(layout==='open'&&notes.length>2)notes=notes.map((n,j)=>j%2?n+12:n).sort((a,b)=>a-b);
  if(layout==='octave')notes.push(notes[0]+12);
  if(layout==='stacked')notes=notes.concat(notes.map(n=>n+12));
  let inv=spec?.inversion||0;while(inv>0&&notes.length){notes.push(notes.shift()+12);notes.sort((a,b)=>a-b);inv--;}while(inv<0&&notes.length){notes.unshift(notes.pop()-12);notes.sort((a,b)=>a-b);inv++;}
  notes=notes.map(n=>n+(h.register||0)*12);
  if(spec&&spec.bass!==null&&spec.bass!==undefined){let b=s.root+48+spec.bass+(h.register||0)*12;while(b>=notes[0])b-=12;notes.unshift(b);}
  return [...new Set(notes.map(n=>{while(n<24)n+=12;while(n>108)n-=12;return n;}))].sort((a,b)=>a-b).slice(0,12);
 });if(voicingMemo3.size>64)voicingMemo3.delete(voicingMemo3.keys().next().value);voicingMemo3.set(key,out);return out;
};
function harmonyRanges(s=state){return s.degrees.map((_,i)=>({i,start:Math.ceil(i*s.bars/s.degrees.length)*16,end:Math.ceil((i+1)*s.bars/s.degrees.length)*16}));}
function ensureHarmony(){if(!state.harmony)state.harmony={layout:'auto',register:0,adventure:35};if(!state.library)state.library={progressions:[],performances:[],favorites:[]};}
function commitHarmony(specs,{id='custom',mode=null,tonic=null,preserveLocks=true}={}){
 checkpoint();ensureHarmony();if(tonic!==null)state.root=tonic;const old=state.degrees.map((_,i)=>specAt(i));
 state.chordEdits=specs.map((x,i)=>preserveLocks&&old[i]?.locked?old[i]:clone(x));state.degrees=state.chordEdits.map(x=>x.degree??0);state.progression=id;
 if(mode)state.scale=mode;fitHarmonyBars();
 // The harmonic change never destroys drum programming or locked melodic material.
 for(const tr of state.tracks){if(trackMap[tr.id].drum||tr.locked){const prev=state.patterns[tr.id];state.patterns[tr.id]=Array.from({length:state.bars},(_,i)=>clone(prev[i%prev.length]));}else state.patterns[tr.id]=generateTrack(tr);}
 ui.bar=Math.min(ui.bar,state.bars-1);ui.note=null;changed({restart:true});
}
function reworkHarmony(one=null){ensureHarmony();const r=rng(state.seed+'|harmonic|'+state.mutation+'|'+(state.harmonyRevision||0));const nextRevision=(state.harmonyRevision||0)+1;const minor=scaleNotes(state,true)[2]===3,adv=state.harmony.adventure;
 const choices=REF_PROGRESSIONS.filter(x=>x.mode===(minor?'minor':'major')&&(adv<35?x.complexity<40:adv>70?x.complexity>40:true));const choice=choose(r,choices),source=progressions[choice.id].chords;const result=state.degrees.map((_,i)=>one!==null&&one!==i?specAt(i):clone(source[i%source.length]));
 commitHarmony(result);state.harmonyRevision=nextRevision;persist();toast(one===null?'Armonía renovada. Acordes y pistas bloqueados conservados.':'Alternativa aplicada al acorde '+(one+1)+'.');
}
// New inversions and low registers can push a breathing pad below the editor range.
// Fold only out-of-range generated notes by octaves; never alter a user's edited events.
const generateV2For3=generateTrack;
generateTrack=function(tr,s=state){const out=generateV2For3(tr,s);for(const bar of out)for(const e of bar)if(e){if(e.n.some(n=>!Number.isFinite(n)))throw new Error('La armonía produjo una nota no válida.');e.n=[...new Set(e.n.map(n=>{while(n<24)n+=12;while(n>108)n-=12;return n;}))];}return out;};

// Patterns are original relative scores (16 units = one nominal bar).
// p selects a chord-tone index, not a chromatic semitone. Chop scores never transpose.
const ARP_LIBRARY={},CHOP_LIBRARY={};
function arpTemplate(id,name,group,pitches,times=null,gate=.85,opts={}){const ts=times||pitches.map((_,i)=>i*16/pitches.length);ARP_LIBRARY[id]={id,name,group,kind:'arp',reference:opts.reference!==false,description:opts.description||'Contorno relativo a las voces del acorde; se transpone con la armonía.',events:pitches.map((p,i)=>({t:ts[i],p,d:Math.min(4,(ts[i+1]??16)-ts[i])*gate,v:i%4===0?1:.82})),...opts};}
function chopTemplate(id,name,group,times,durations=null,opts={}){CHOP_LIBRARY[id]={id,name,group,kind:'chop',reference:opts.reference!==false,description:opts.description||'Redispara las voces a su altura original, respetando las ventanas de corte.',events:times.map((t,i)=>({t,d:durations?.[i]??Math.min((times[i+1]??16)-t,2)*.78,v:i%4===0?1:.82})),...opts};}
arpTemplate('up3','Up 3','Dirección',[0,1,2,0,1,2,0,1]);
arpTemplate('up4','Up 4','Dirección',[0,1,2,3,0,1,2,3]);
arpTemplate('down3','Down 3','Dirección',[2,1,0,2,1,0,2,1]);
arpTemplate('down4','Down 4','Dirección',[3,2,1,0,3,2,1,0]);
arpTemplate('downslow','Down slow','Dirección',[3,2,1,0],null,1.15);
arpTemplate('updown','Up-down','Dirección',[0,1,2,3,2,1,0,1]);
const oscillations=[[0,2,0,2,1,3,1,3],[0,3,1,2,0,3,1,2],[1,0,2,0,3,0,2,0],[0,4,1,5,2,6,1,5],[3,0,3,1,3,2,3,1],[0,2,4,2,1,3,5,3]];
oscillations.forEach((p,i)=>arpTemplate('oscillate'+(i+1),'Oscillate '+(i+1),'Oscilación',p));
[[0,0,1,1,2,2,3,3],[0,0,0,2,2,1,1,3],[0,1,1,2,3,3,2,1]].forEach((p,i)=>arpTemplate('repeats'+(i+1),'Repeats '+(i+1),'Repetición',p));
[[0,3,6,8,11,14],[0,2,5,7,10,12,15],[0,1,4,6,9,10,14],[0,4,5,8,10,13,15]].forEach((ts,i)=>arpTemplate('rhythm'+(i+1),'Rhythm '+(i+1),'Ritmo',ts.map((_,j)=>[0,2,1,3][(j+i)%4]),ts,.64));
[[1,3,6,9,11,14],[2,5,7,10,13,15],[1,4.5,6,9.5,12,14.5]].forEach((ts,i)=>arpTemplate('synco'+(i+1),'Synco '+(i+1),'Síncopa',ts.map((_,j)=>(j*2+i)%5),ts,.6));
arpTemplate('flourish1','Flourish 1','Floritura',[0,1,2,3,4,5,4,2],[0,6,8,10,12,13,14,15],.7);
arpTemplate('flourish2','Flourish 2','Floritura',[5,4,3,2,1,0,2,4],[0,1,2,3,4,8,11,14],.6);
arpTemplate('flourish3','Flourish 3','Floritura',[0,2,4,1,3,5,2,6],[0,2,4,8,10,12,13.333333,14.666667],.8);
arpTemplate('supersaw1','SuperSaw 1','Capas',[0,2,1,3,0,2,1,4],null,.95,{stack:2});
arpTemplate('supersaw2','SuperSaw 2','Capas',[0,0,1,0,2,0,3,2],null,.45,{stack:2});
arpTemplate('supersaw3','SuperSaw 3','Capas',[0,3,1,4,2,5],[0,3,6,8,11,14],.85,{stack:3});
arpTemplate('supersaw4','SuperSaw 4','Capas',[0,1,3,2],null,1.4,{stack:3});
arpTemplate('house1','House 1','House',[0,2,1,3],[2,6,10,14],.65);
arpTemplate('house2','House 2','House',[0,1,2,1,3,2],[0,3,6,8,11,14],.5);
arpTemplate('house3','House 3','House',[0,2,4,1,3,2],[1,4,6.5,9,12,14.5],.7);
arpTemplate('house4','House 4','House',[0,0,3,2,1,1,4,2],[0,2,5,6,8,10,13,14],.5);
arpTemplate('slow','Slow','Lento',[0,2,1,3],null,1.8);
arpTemplate('morph1','Morph 1','Transformación',[0,2,1,4,2,5,3,1],null,.8,{morphHint:28});
arpTemplate('morph2','Morph 2','Transformación',[0,3,1,5,2,6,4,1],[0,1.5,4,5.5,8,10,12.5,15],.7,{morphHint:46});
arpTemplate('umbra_helix','Hélice 3:4','UMBRA / laboratorio',[0,2,4,1,3,5,2,4,6,1,3,0],null,.8,{reference:false});
arpTemplate('umbra_pendulum','Péndulo de vidrio','UMBRA / laboratorio',[0,4,1,3,2,5],[0,2.666667,5.333333,8,10.666667,13.333333],1.1,{reference:false});
arpTemplate('umbra_ghost','Notas fantasma','UMBRA / laboratorio',[0,0,2,3,1,4,4,2],[0,3.5,4,6,8,11.5,12,14],.48,{reference:false});
arpTemplate('umbra_fracture','Fractura','UMBRA / laboratorio',[0,3,1,4,2,5,0,6],[0,1,3,6,8,9,12,14.5],.65,{reference:false});
arpTemplate('umbra_six','Seis contra cuatro','UMBRA / laboratorio',[0,1,2,4,3,1],[0,2.666667,5.333333,8,10.666667,13.333333],.7,{reference:false});
arpTemplate('umbra_answer','Pregunta / respuesta','UMBRA / laboratorio',[0,2,4,3,1],[0,2,4,10,13],.9,{reference:false});
arpTemplate('umbra_bloom','Floración','UMBRA / laboratorio',[0,1,3,2,5,4,6,7],[0,4,7,9,11,13,14,15],.9,{reference:false});
arpTemplate('umbra_split','Espejo roto','UMBRA / laboratorio',[0,5,1,4,2,3,0,6],null,.65,{reference:false});
chopTemplate('3notes','3notes','Pulsos',[0,6,10],[3.5,2,4]);
chopTemplate('6notes1','6notes1','Pulsos',[0,2,5,8,10,13]);
chopTemplate('6notes2','6notes2','Pulsos',[0,3,6,8,11,14],[1.1,1.1,1.5,1.1,1.1,1.5]);
chopTemplate('6notes3','6notes3','Pulsos',[0,2.666667,5.333333,8,10.666667,13.333333],[2,2,2,2,2,2]);
chopTemplate('trance1','Trance1','Trance',[0,1,2,4,5,6,8,9,10,12,13,14],Array(12).fill(.5));
chopTemplate('trance2','Trance2','Trance',[0,2,3,6,7,8,10,11,14,15],Array(10).fill(.7));
chopTemplate('stab1','Stab1','Stabs',[2,6,10,14],Array(4).fill(.8));
chopTemplate('stab2','Stab2','Stabs',[0,3,6,10,13],[1.4,.8,1.4,1.1,.8]);
chopTemplate('stab3','Stab3','Stabs',[0,1.5,6,8,9.5,14],[.65,.65,1,.65,.65,1]);
chopTemplate('pad1','Pad1','Pads',[0,8],[7.25,7.25]);
chopTemplate('pad2','Pad2','Pads',[0,6,12],[4.8,4.8,3.5]);
chopTemplate('pad3','Pad3','Pads',[0,4,10],[3.5,5.25,5.25]);
chopTemplate('pad4','Pad4','Pads',[0,8,12],[7.75,3.5,3.5]);
chopTemplate('pad5','Pad5','Pads',[0,3,8,11],[2.7,4.5,2.7,4.5]);
chopTemplate('pad6','Pad6','Pads',[0,10],[9.5,5.5]);
chopTemplate('double','Double','Divisiones',[0,8],[6.6,6.6]);
chopTemplate('treble','Treble','Divisiones',[0,16/3,32/3],[4.2,4.2,4.2]);
chopTemplate('quad','Quad','Divisiones',[0,4,8,12],[3,3,3,3]);
chopTemplate('umbra_tresillo','Tresillo 3–3–2','UMBRA / laboratorio',[0,6,12],[4.4,4.4,2.7],{reference:false});
chopTemplate('umbra_dub','Dub gate','UMBRA / laboratorio',[2,5,6,10,13,14],[1,.35,.7,1,.35,.7],{reference:false});
chopTemplate('umbra_garage','Garage desplazado','UMBRA / laboratorio',[0,3,6.5,10,13,15],[1.4,1,1,.75,.8,.55],{reference:false});
chopTemplate('umbra_stutter','Stutter 1/32','UMBRA / laboratorio',[0,.5,1,6,6.5,7,10,10.5,14,14.5],Array(10).fill(.27),{reference:false});
chopTemplate('umbra_reverse','Densidad ascendente','UMBRA / laboratorio',[0,8,12,14,15,15.5],[5.5,2.8,1.3,.65,.3,.25],{reference:false});
chopTemplate('umbra_breath','Respiración asimétrica','UMBRA / laboratorio',[0,9,13],[7.8,2.5,2.2],{reference:false});
chopTemplate('umbra_euclid','Euclídeo 5/16','UMBRA / laboratorio',[0,4,7,10,13],[1.6,1.6,1.6,1.6,1.6],{reference:false});
chopTemplate('umbra_triplet','Tresillos cortados','UMBRA / laboratorio',Array.from({length:12},(_,i)=>i*4/3),Array(12).fill(.65),{reference:false});
chopTemplate('umbra_sparse','Vacío / impacto','UMBRA / laboratorio',[0,7,14],[4.5,.6,1.3],{reference:false});
chopTemplate('umbra_shuffle','Shuffle de acordes','UMBRA / laboratorio',[0,2.6,4,6.6,8,10.6,12,14.6],Array(8).fill(.72),{reference:false});
const makePerformance=()=>({mode:'legacy',arpPreset:'classic',chopPreset:'stab1',source:'chord',phrase:16,speed:1,density:100,bias:100,morph:0,repeats:0,onBeat:50,subcycles:1,skew:0,reverse:false,alternate:false,holdBass:false,strum:0,human:15,revision:0});
const v2BaseTrack3=baseTrack;
baseTrack=function(d){return{...v2BaseTrack3(d),performance:makePerformance()};};
const v2Default3=defaultState;
defaultState=function(){const s=v2Default3();s.harmony={layout:'auto',register:0,adventure:35};s.harmonyRevision=0;s.library={progressions:[],performances:[],favorites:[]};return s;};
const v2Apply3=applyPreset;
applyPreset=function(id,initial=false){const lib=state?.library?clone(state.library):null;v2Apply3(id,initial);if(lib)state.library=lib;};
function effectiveMode(tr){const p=tr.performance;if(!p||p.mode==='legacy')return tr.arp.enabled?'arp':'original';return p.mode;}
function usesPerformance(tr){const mode=effectiveMode(tr);return !trackMap[tr.id].drum&&(mode==='chop'||mode==='hybrid'||(mode==='arp'&&tr.performance?.arpPreset!=='classic'));}
const performanceMemo=new Map();
function performanceKey(tr,s){return JSON.stringify([s.seed,s.mutation,s.root,s.scale,s.voicing,s.progression,s.degrees,s.chordEdits,s.harmony,s.bars,s.density,s.patterns[tr.id],tr.performance,tr.arp,tr.arpLock,tr.locked,tr.revision,tr.density,tr.octave]);}
function performanceTimeline(tr,s=state){
 if(!usesPerformance(tr))return [];
 const key=performanceKey(tr,s);if(performanceMemo.has(key))return performanceMemo.get(key);
 const p=tr.performance||makePerformance(),a=tr.arp,mode=effectiveMode(tr),ranges=harmonyRanges(s),voicings=chordVoicings(s),end=s.bars*16;
 const seed=tr.locked&&tr.arpLock?tr.arpLock.seed:s.seed,mutation=tr.locked&&tr.arpLock?tr.arpLock.mutation:s.mutation;
 const randFor=(...parts)=>rng([seed,'perform',mutation,tr.id,tr.revision,p.revision,...parts].join('|'));
 const poolAt=time=>{const bar=Math.min(s.bars-1,Math.floor(time/16)),idx=harmonyIndex(bar,s);let notes=p.source==='notes'?[...new Set((s.patterns[tr.id]?.[bar]||[]).flatMap(e=>e?.n||[]))].sort((x,y)=>x-y):voicings[idx].slice();if(!notes.length)return[];
  if(tr.id==='bass')while(notes[0]>40)notes=notes.map(n=>n-12);else if(tr.id==='arp'||tr.id==='lead')while(notes[0]<58)notes=notes.map(n=>n+12);
  return [...new Set(Array.from({length:a.octaves},(_,o)=>notes.map(n=>n+12*o)).flat())].filter(n=>n>=24&&n<=108).sort((x,y)=>x-y);
 };
 const result=[],arpScore=[];
 const keep=(event,time,index,chord,kind)=>{const r=randFor(chord,index,kind),strength=Math.abs(mod(time,4))<.06?1:0,beat=p.onBeat===50?1:p.onBeat>50?(strength?1:1-(p.onBeat-50)/75):(strength?1-(50-p.onBeat)/75:1);return r()<p.density/100*beat*clamp(s.density/60,0,1)*clamp(tr.density/82,0,1);};
 if(mode==='hybrid'&&p.arpPreset==='classic'){
  // Reuse the original algorithm exactly before slicing; no second interpretation of its reset, rate or Euclidean controls.
  const legacy=clone(s);legacy.structure='loop';legacy.swing=0;legacy.human=0;for(const t of legacy.tracks){t.mute=false;t.solo=t.id===tr.id;if(t.id===tr.id){t.volume=.65;t.arp.enabled=true;t.arp.source=p.source==='notes'?'pattern':'chord';}}
  const dt=stepSeconds(legacy);for(let st=0;st<end;st++)for(const e of v2Score3(st,legacy))if(e.id===tr.id&&st+e.offset/dt<end)arpScore.push({at:st+e.offset/dt,n:e.n,v:e.v,d:e.d/dt,kind:'arp'});
 }else if(mode==='arp'||mode==='hybrid'){
  const template=ARP_LIBRARY[p.arpPreset];
  for(const range of ranges){let start=range.start,limit=range.end;
   const classic=!template;const cycle=classic?a.length*arpRates[a.rate].step:p.phrase*p.speed;
   for(let base=start,ci=0;base<limit-1e-6;base+=cycle,ci++){
    const atoms=classic?Array.from({length:a.length},(_,j)=>({t:j*16/a.length,p:j,d:16/a.length*.9,v:j%4===0?1:.82})):template.events;
    let previous=null;
    for(let j=0;j<atoms.length;j++){let atom=atoms[j],local=atom.t/16*cycle;const r=randFor(range.i,ci,j,'arp'),m=p.morph/100;
     if(p.bias<100&&r()>(p.bias/100)){local=Math.floor(r()*Math.max(4,cycle));atom={...atom,p:Math.floor(r()*6)};}
     if(range.i>0&&r()<m*.32)local=clamp(local+(r()<.5?-1:1)*Math.min(1,cycle/16),0,cycle-.05);
     const time=base+local;if(time>=limit-.0001||!keep(atom,time,ci*32+j,range.i,'arp'))continue;
     if(r()>a.probability/100)continue;let pool=poolAt(time);if(!pool.length)continue;
     let index=atom.p;if(range.i>0&&r()<m)index+=range.i%3;
     if(p.reverse!==!!(p.alternate&&Math.floor(base/cycle)%2))index=pool.length-1-index;
     if(previous!==null&&r()<p.repeats/100)index=previous;previous=index;
     let n=classic?orderedArp(pool,j,a.mode,r):Array.from({length:template.stack||1},(_,k)=>pool[mod(index+k*2,pool.length)]);
     n=[...new Set(n)].map(x=>clamp(x+tr.octave*12,12,119));
     const unit=atom.d/16*cycle,ratchet=a.ratchet,window=Math.min(unit,limit-time);
     for(let k=0;k<ratchet;k++){const at=time+k*window/ratchet;if(at>=limit)continue;arpScore.push({at,n,v:clamp(.65*atom.v*(1+(j%4===0?a.accent/180:0))*Math.pow(.85,k),.03,1),d:Math.min(limit-at,Math.max(.035,unit*a.gate/100/ratchet)),kind:'arp'});}
    }
   }
  }
 }
 const windows=[];
 if(mode==='chop'||mode==='hybrid'){
  const template=CHOP_LIBRARY[p.chopPreset]||CHOP_LIBRARY.stab1;
  for(const range of ranges){const cycle=p.phrase*p.speed/p.subcycles;
   for(let base=range.start,ci=0;base<range.end-1e-6;base+=cycle,ci++)for(let j=0;j<template.events.length;j++){
    let atom=template.events[j],fraction=atom.t/16;const r=randFor(range.i,ci,j,'chop');
    if(p.bias<100&&r()>p.bias/100)fraction=Math.floor(r()*16)/16;
    const power=Math.pow(2,-p.skew/65);fraction=Math.pow(fraction,power);
    if(p.reverse!==!!(p.alternate&&Math.floor(base/cycle)%2))fraction=Math.max(0,1-fraction-atom.d/16);
    let at=base+fraction*cycle;if(range.i>0&&r()<p.morph/100*.5)at=clamp(at+(r()<.5?-.5:.5)*cycle/16,base,base+cycle-.04);
    if(at>=range.end-.0001||!keep(atom,at,ci*32+j,range.i,'chop'))continue;
    windows.push({at,d:Math.max(.035,Math.min(atom.d/16*cycle*a.gate/100,range.end-at)),v:atom.v,idx:range.i});
   }
  }
  let sources;
  if(mode==='hybrid')sources=arpScore;
  else if(p.source==='notes')sources=(s.patterns[tr.id]||[]).flatMap((b,i)=>b.flatMap((e,j)=>e?[{at:i*16+j,n:e.n.map(n=>clamp(n+tr.octave*12,12,119)),d:Math.min(e.d,end-i*16-j),v:e.v}]:[]));
  else sources=ranges.map(x=>({at:x.start,d:x.end-x.start,n:voicings[x.i].map(n=>clamp(n+tr.octave*12,12,119)),v:.72}));
  // Interval intersection preserves each source pitch and never creates a note outside it.
  for(const w of windows)for(const source of sources){if(source.at>=w.at+w.d||source.at+source.d<=w.at)continue;const at=Math.max(w.at,source.at),stop=Math.min(w.at+w.d,source.at+source.d),length=stop-at;if(length<.025)continue;
   const ratchet=mode==='chop'?a.ratchet:1;for(let k=0;k<ratchet;k++)result.push({at:at+k*length/ratchet,n:source.n.slice(),v:clamp(source.v*w.v*Math.pow(.86,k),.02,1),d:Math.max(.025,length/ratchet*.96),kind:'chop'});
  }
 }else result.push(...arpScore);
 if(p.holdBass&&p.source==='chord'&&(mode==='arp'||mode==='hybrid'))for(const range of ranges)result.push({at:range.start,n:[clamp(chordRoot(Math.floor(range.start/16),s,2)+tr.octave*12,12,119)],v:.42,d:range.end-range.start-.08,kind:'pedal'});
 result.sort((a,b)=>a.at-b.at||a.n[0]-b.n[0]);
 // Exact duplicate intersections are merged; fast ratchets retain their timing.
 const seen=new Set(),final=result.filter(e=>{if(!Number.isFinite(e.at)||!e.n.length)return false;const k=[Math.round(e.at*100000),e.n.join(','),Math.round(e.d*100000)].join(':');if(seen.has(k))return false;seen.add(k);return true;});
 if(performanceMemo.size>40)performanceMemo.delete(performanceMemo.keys().next().value);performanceMemo.set(key,final);return final;
}
const v2Score3=scoreEvents;
scoreEvents=function(absStep,s=state){
 const base=v2Score3(absStep,s).filter(e=>!usesPerformance(e.tr)),wrapped=mod(absStep,totalBars(s)*16),absBar=Math.floor(wrapped/16),bar=absBar%s.bars,step=wrapped%16,local=bar*16+step,dt=stepSeconds(s);
 for(const tr of s.tracks){if(!usesPerformance(tr)||!audible(tr,s)||tr.volume<=0||s.density<=0||tr.density<=0)continue;const level=arrangementLevel(tr.id,absBar,s);if(level<=0)continue;const p=tr.performance;
  for(const e of performanceTimeline(tr,s)){if(e.at<local-1e-5||e.at>=local+1-1e-5)continue;const r=rng(s.seed+'|performanceFeel|'+tr.id+'|'+e.at),feel=p.human/100,drift=(r()-.5)*.014*feel;const swung=mod(Math.floor(e.at+1e-6),2)?dt*.58*s.swing/100:0;
   base.push({id:tr.id,tr,n:e.n,v:clamp(e.v*level*(1+(r()-.5)*.15*feel),.02,1),d:Math.max(.012,e.d*dt),offset:(e.at-local)*dt+swung+drift,strum:p.strum/1000/Math.max(1,e.n.length-1),hash:hash(s.seed+'|perform-audio|'+tr.id+'|'+e.at),arp:effectiveMode(tr)!=='chop',performance:true});
  }
 }
 return base.sort((a,b)=>a.offset-b.offset);
};
function setPerformanceMode(mode){const tr=state.tracks.find(t=>t.id===ui.selected);if(trackMap[tr.id].drum)return;checkpoint();tr.performance.mode=mode;tr.arp.enabled=mode==='arp'||mode==='hybrid';if(tr.performance.source==='notes')tr.arp.source='pattern';else tr.arp.source='chord';changed();}
function applyPerformanceTemplate(kind,id){const tr=state.tracks.find(t=>t.id===ui.selected);checkpoint();const p=tr.performance;if(kind==='arp'){p.arpPreset=id;p.mode=effectiveMode(tr)==='hybrid'?'hybrid':'arp';tr.arp.enabled=true;}else{p.chopPreset=id;p.mode=effectiveMode(tr)==='hybrid'?'hybrid':'chop';tr.arp.enabled=p.mode==='hybrid';}
 p.density=100;p.bias=100;p.morph=ARP_LIBRARY[id]?.morphHint||0;p.revision=0;tr.arp.gate=100;tr.arp.probability=100;changed();}

// ── 11. Focused UI. Browsing and auditioning never overwrite a composition. ───
function candidateHarmony(row){
 if(row.user)return clone(row.specs);
 if(row.legacy){const p=progressions[row.id];if(p.chords)return clone(p.chords);const s={...state,degrees:p.degrees,progression:row.id,chordEdits:null};return p.degrees.map((degree,i)=>({root:mod(rawAt(i,s)[0]-s.root,12),quality:'custom',intervals:rawAt(i,s).map(n=>n-rawAt(i,s)[0]),suffix:labelAt(i,s).replace(noteName(rawAt(i,s)[0]),''),degree,roman:roman(degree,s),bass:null,inversion:0,layout:'auto',locked:false}));}
 return parseProgression(row.formula,{tonic:libraryUI.root,slashMode:libraryUI.slashMode});
}
function candidatePerformance(row){const s=clone(state),id=trackMap[ui.selected].drum?'keys':ui.selected,tr=s.tracks.find(t=>t.id===id);s.structure='loop';for(const t of s.tracks){t.solo=t.id===id;t.mute=false;}tr.volume=Math.max(.48,tr.volume);
 if(row.user){tr.performance=clone(row.performance);tr.arp=clone(row.arp);}
 else{tr.performance={...makePerformance(),mode:row.kind==='arp'?'arp':'chop',arpPreset:row.kind==='arp'?row.id:'up3',chopPreset:row.kind==='chop'?row.id:'stab1',morph:row.morphHint||0};tr.arp={...makeArp(row.kind==='arp'),gate:100,probability:100,octaves:2};}
 return{s,tr};
}
function refreshHarmonyMaterial(){for(const tr of state.tracks)if(!trackMap[tr.id].drum&&!tr.locked)state.patterns[tr.id]=generateTrack(tr);changed({restart:true});}
// ── 12. Versioned projects and constrained user recipes ─────────────────────
function number3(v,def,min,max,int=false){if(v===undefined)return def;if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max||int&&!Number.isInteger(v))throw new Error('Parámetro UMBRA 3 fuera de rango.');return v;}
function member3(v,def,options){if(v===undefined)return def;if(!options.includes(v))throw new Error('Opción UMBRA 3 no reconocida.');return v;}
function bool3(v,def=false){if(v===undefined)return def;if(typeof v!=='boolean')throw new Error('Interruptor de proyecto inválido.');return v;}
function text3(v,def='',limit=100){if(v===undefined)return def;if(typeof v!=='string'||v.length>limit)throw new Error('Texto de proyecto demasiado largo o inválido.');return v;}
function validateSpec3(x){if(!x||typeof x!=='object')throw new Error('Acorde explícito inválido.');const out={root:number3(x.root,0,0,11,true),quality:member3(x.quality,'auto',Object.keys(qualityLabels)),bass:x.bass===null||x.bass===undefined?null:number3(x.bass,0,0,11,true),inversion:number3(x.inversion,0,-6,6,true),layout:member3(x.layout,'auto',['auto','block','open','octave','stacked']),locked:bool3(x.locked),degree:number3(x.degree,0,0,6,true)};
 if(x.intervals!==undefined){if(!Array.isArray(x.intervals)||x.intervals.length<2||x.intervals.length>12)throw new Error('El acorde debe contener de 2 a 12 intervalos.');out.intervals=x.intervals.map(v=>number3(v,0,0,36,true));if(!out.intervals.includes(0)||new Set(out.intervals).size!==out.intervals.length)throw new Error('Intervalos duplicados o sin raíz.');out.intervals.sort((a,b)=>a-b);}
 if(x.suffix!==undefined)out.suffix=text3(x.suffix,'',70);if(x.roman!==undefined)out.roman=text3(x.roman,'',100);return out;}
function validatePerformance3(x){const d=makePerformance();if(x===undefined)return d;if(!x||typeof x!=='object')throw new Error('Interpretación inválida.');const out={...d};for(const [key,opts]of [['mode',['legacy','original','arp','chop','hybrid']],['arpPreset',['classic',...Object.keys(ARP_LIBRARY)]],['chopPreset',Object.keys(CHOP_LIBRARY)],['source',['chord','notes']],['phrase',[4,8,16,32]],['speed',[.5,1,2,4]]])out[key]=member3(x[key],d[key],opts);
 for(const[key,min,max,int]of [['density',0,100,true],['bias',0,100,true],['morph',0,100,true],['repeats',0,100,true],['onBeat',0,100,true],['human',0,100,true],['subcycles',1,4,true],['skew',-75,75,true],['strum',0,120,true],['revision',0,1000000,true]])out[key]=number3(x[key],d[key],min,max,int);for(const key of ['reverse','alternate','holdBass'])out[key]=bool3(x[key],false);return out;}
function validateArpRecipe3(a){if(!a||typeof a!=='object')throw new Error('Arpegiador personal inválido.');const out=makeArp();out.enabled=bool3(a.enabled);for(const[key,opts]of [['source',['chord','pattern']],['mode',Object.keys(arpModes)],['rate',Object.keys(arpRates)],['reset',['chord','bar','free']]])out[key]=member3(a[key],out[key],opts);for(const[key,min,max]of[['octaves',1,4],['gate',10,140],['probability',10,100],['accent',0,80],['pulses',1,16],['rotation',0,15],['ratchet',1,3],['length',1,32]])out[key]=number3(a[key],out[key],min,max,true);return out;}
const validateV2For3=validateProject;
validateProject=function(payload){const out=validateV2For3(payload),src=payload.state;if(src.chordEdits)out.chordEdits=src.chordEdits.map(validateSpec3);const h=src.harmony||{};out.harmony={layout:member3(h.layout,'auto',['auto','block','open','octave','stacked']),register:number3(h.register,0,-1,1,true),adventure:number3(h.adventure,35,0,100,true)};out.harmonyRevision=number3(src.harmonyRevision,0,0,1000000,true);
 for(const t of out.tracks){const from=src.tracks.find(x=>x.id===t.id);t.performance=validatePerformance3(from.performance);if(from.performance===undefined&&t.arp.source==='pattern')t.performance.source='notes';if(t.performance.mode!=='legacy')t.arp.enabled=['arp','hybrid'].includes(t.performance.mode);}
 const lib=src.library||{};out.library={progressions:[],performances:[],favorites:[]};for(const k of ['progressions','performances','favorites'])if(lib[k]!==undefined&&(!Array.isArray(lib[k])||lib[k].length>(k==='favorites'?256:64)))throw new Error('Biblioteca personal inválida o demasiado grande.');
 const ids=new Set();for(const x of lib.progressions||[]){if(!x||!Array.isArray(x.specs)||x.specs.length<2||x.specs.length>12)throw new Error('Progresión personal inválida.');const id=text3(x.id,'',80);if(!/^user_h_[A-Za-z0-9_-]+$/.test(id)||ids.has(id))throw new Error('ID de preset inválido o repetido.');ids.add(id);out.library.progressions.push({id,name:text3(x.name,'',70),mode:member3(x.mode,'major',['major','minor','modal']),specs:x.specs.map(validateSpec3)});}
 for(const x of lib.performances||[]){if(!x)throw new Error('Preset de interpretación inválido.');const id=text3(x.id,'',80);if(!/^user_p_[A-Za-z0-9_-]+$/.test(id)||ids.has(id))throw new Error('ID de preset inválido o repetido.');ids.add(id);out.library.performances.push({id,name:text3(x.name,'',70),kind:member3(x.kind,'arp',['arp','chop']),performance:validatePerformance3(x.performance),arp:validateArpRecipe3(x.arp)});}
 out.library.favorites=[...new Set((lib.favorites||[]).map(x=>text3(x,'',80)))];return out;};
// UMBRA 4 — deterministic, domain-bounded randomization. No writes until validation succeeds.
const randomDefaults=()=>({scope:'unlocked',amount:38,groups:{rhythm:true,melody:true,sound:false,performance:false,trackFX:false,mix:false,harmony:false,groove:false,tempo:false,masterFX:false},respectLocks:true,genre:'auto',keepKey:false,keepTempo:false,newBars:8});
const RAND_GROUPS={rhythm:'Batería y percusión',melody:'Bajo, acordes y melodía',sound:'Timbres',performance:'Arpegios y chops',trackFX:'Efectos de pista',mix:'Volumen y panorama',harmony:'Progresión y acordes',groove:'Swing y humanización',tempo:'Tempo',masterFX:'Efectos master'};
const GENRE_TONE_POOLS={
 bass:['sub','analog','fmbass','reese','rubber','organbass'],keys:['velvetEP','pianoModal','softkeys','organ','nylon','dulcimer','fmPluck'],pad:['tape','strings','airPad','pwmPad','supersaw','choir'],arp:['fmPluck','kalimba','nylon','glass','marimba','pluck','bell'],lead:['sinelead','flute','brass','reed','fmPluck','kalimba']
};
const baseDefault4=defaultState;defaultState=function(){const s=baseDefault4();s.session={name:'',randomSeed:'',action:0,lastKind:''};return s;};
const baseValidate4=validateProject;validateProject=function(payload){const s=baseValidate4(payload),x=payload.state.session||{};s.session={name:text3(x.name,'',80),randomSeed:text3(x.randomSeed,'',64),action:number3(x.action,0,0,10000000,true),lastKind:member3(x.lastKind,'',['','variation','song','chaos'])};return s;};
const sameJSON=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function safeConfig(c){const d=randomDefaults();return{scope:member3(c.scope,d.scope,['unlocked','selected']),amount:number3(c.amount,d.amount,1,100,true),groups:Object.fromEntries(Object.keys(RAND_GROUPS).map(k=>[k,bool3(c.groups?.[k],d.groups[k])])),respectLocks:bool3(c.respectLocks,true),genre:member3(c.genre,'auto',['auto',...Object.keys(genreNames)]),keepKey:bool3(c.keepKey,false),keepTempo:bool3(c.keepTempo,false),newBars:member3(c.newBars,8,[4,8,16])};}
function jitter(r,value,min,max,strength,step=1){const delta=(r()*2-1)*(max-min)*strength*.34;return clamp(Math.round((value+delta)/step)*step,min,max);}
function pickOther(r,list,current){const rest=list.filter(x=>x!==current);return choose(r,rest.length?rest:list);}
function syncArpMode(tr){if(tr.performance.mode!=='legacy')tr.arp.enabled=['arp','hybrid'].includes(tr.performance.mode);tr.arp.source=tr.performance.source==='notes'?'pattern':'chord';}
function randomTimbre(tr,r,strength,newSong=false){const def=trackMap[tr.id],pool=def.drum?def.voices:GENRE_TONE_POOLS[tr.id].filter(x=>def.voices.includes(x));if(newSong||r()<.35+strength*.65)tr.sound=pickOther(r,pool,tr.sound);for(const[k,min,max]of[['tone',24,82],['texture',8,65],['attack',def.drum?0:tr.id==='pad'?25:0,def.drum?15:tr.id==='pad'?74:28],['decay',18,tr.id==='pad'?82:70]])tr[k]=jitter(r,tr[k],min,max,strength);}
function randomPerformance(tr,r,strength,newSong=false){if(trackMap[tr.id].drum||tr.id==='bass'&&newSong)return;const p=tr.performance,a=tr.arp;const mode=tr.id==='pad'?'chop':choose(r,['arp','arp','chop','hybrid']);p.mode=mode;p.source='chord';p.arpPreset=pickOther(r,Object.keys(ARP_LIBRARY),p.arpPreset);p.chopPreset=pickOther(r,Object.keys(CHOP_LIBRARY),p.chopPreset);p.phrase=tr.id==='pad'?32:choose(r,[8,16,16,32]);p.speed=1;p.density=clamp(Math.round(75+r()*22),60,100);p.bias=clamp(Math.round(85+r()*15),75,100);p.morph=clamp(Math.round(r()*45*strength),0,45);p.subcycles=1;p.skew=0;p.reverse=r()<.2;p.alternate=r()<.25;p.holdBass=false;p.strum=Math.round(r()*25);p.human=Math.round(12+r()*28);p.revision++;a.octaves=tr.id==='pad'?1:choose(r,[1,1,2]);a.gate=tr.id==='pad'?95:Math.round(48+r()*48);a.ratchet=1;a.probability=Math.round(75+r()*25);syncArpMode(tr);}
function copyHarmony(target,source){for(const k of ['root','scale','progression','degrees','chordEdits','voicing','harmony','harmonyRevision'])target[k]=clone(source[k]);}
function applyRandomHarmony(s,base,cfg,r,isSong){const locks=base.degrees.map((_,i)=>specAt(i,base)).map(x=>cfg.respectLocks&&x.locked);const hasLock=locks.some(Boolean);if(hasLock){s.root=base.root;s.scale=base.scale;s.voicing=base.voicing;s.harmony=clone(base.harmony);}const isMinor=scaleNotes(s,true)[2]===3;const rows=REF_PROGRESSIONS.filter(x=>x.mode===(isMinor?'minor':'major')&&(cfg.amount>70||x.complexity<60));const row=choose(r,rows),source=progressions[row.id].chords;const count=hasLock?base.degrees.length:Math.min(source.length,s.bars);s.chordEdits=Array.from({length:count},(_,i)=>locks[i]?clone(specAt(i,base)):clone(source[i%source.length]));s.degrees=s.chordEdits.map(x=>x.degree??0);s.progression=hasLock?'custom':row.id;if(s.bars<count)s.bars=base.bars;}
function makeRandomCandidate(before,config,seed,kind='variation',selected=ui.selected){
 const cfg=safeConfig(config);if(typeof seed!=='string'||!seed.trim()||seed.length>64)throw new Error('Escribí una semilla de 1 a 64 caracteres.');const r=rng(seed+'|UMBRA4|'+kind),strength=cfg.amount/100,eligible=t=>!(cfg.respectLocks&&t.locked)&&(cfg.scope!=='selected'||t.id===selected);
 let after=clone(before),song=kind==='song';
 if(song){let options=presets.filter(p=>cfg.genre==='auto'?p.genre!==before.genre:p.genre===cfg.genre);if(!options.length)options=presets.slice();const preset=choose(r,options);after=composeFresh(seed,preset.id);after.library=clone(before.library);after.bars=cfg.respectLocks&&before.tracks.some(t=>t.locked)||cfg.respectLocks&&before.degrees.some((_,i)=>specAt(i,before).locked)?before.bars:Math.max(cfg.newBars,after.degrees.length);if(![4,8,12,16,24,32].includes(after.bars))after.bars=16;
  after.root=cfg.keepKey?before.root:pickOther(r,Array.from({length:12},(_,i)=>i),before.root);after.scale=cfg.keepKey?before.scale:after.scale;after.bpm=cfg.keepTempo?before.bpm:clamp(after.bpm+Math.round((r()-.5)*10),45,190);after.structure=r()<.28?'journey':'loop';after.density=clamp(Math.round(after.density+(r()-.5)*16),27,78);after.complexity=clamp(Math.round(after.complexity+(r()-.5)*20),18,85);after.human=clamp(Math.round(after.human+(r()-.5)*18),0,85);after.swing=clamp(Math.round(after.swing+(r()-.5)*14),0,60);if(r()<.72)applyRandomHarmony(after,before,cfg,r,true);
  else if(cfg.respectLocks&&before.degrees.some((_,i)=>specAt(i,before).locked))copyHarmony(after,before);
  for(const tr of after.tracks){const old=before.tracks.find(t=>t.id===tr.id);tr.mute=old.mute;tr.solo=old.solo;tr.locked=false;tr.arpLock=null;if(cfg.respectLocks&&old.locked){Object.assign(tr,clone(old));continue;}if(r()<.6)randomTimbre(tr,r,.48,true);tr.volume=clamp(tr.volume*(.86+r()*.25),.12,trackMap[tr.id].drum?.88:.62);if(tr.id==='arp')randomPerformance(tr,r,.5,true);else if(tr.id==='keys'&&r()<.45)randomPerformance(tr,r,.3,true);tr.revision=Math.floor(r()*10000);}
  after.master.volume=before.master.volume;after.master.feedback=Math.min(after.master.feedback,48);after.master.drumDrive=Math.min(after.master.drumDrive,32);after.master.drumCrush=Math.min(after.master.drumCrush,46);
  const titlesA=['Órbita','Luz','Materia','Memoria','Noche','Horizonte','Pulso','Estación','Silencio','Cristal','Sombra','Tiempo'];const titlesB=['de mercurio','en suspensión','oblicua','del subsuelo','de madrugada','entre líneas','de neón','en tránsito','sin gravedad','de vidrio','bajo el agua','distante'];after.session={name:choose(r,titlesA)+' '+choose(r,titlesB),randomSeed:seed,action:(before.session?.action||0)+1,lastKind:'song'};
  if(after.degrees.length>after.bars){after.chordEdits=after.degrees.slice(0,after.bars).map((_,i)=>specAt(i,after));after.degrees=after.degrees.slice(0,after.bars);after.progression='custom';}
  for(const tr of after.tracks)after.patterns[tr.id]=cfg.respectLocks&&tr.locked?clone(before.patterns[tr.id]):generateTrack(tr,after);
 }else{
  const g=cfg.groups;if(!Object.values(g).some(Boolean))throw new Error('Elegí al menos un grupo de parámetros.');let hasChanges=false;
  // Global rhythm or harmony must be explicitly selected. Never change the global music seed for a local variation.
  if(g.tempo){after.bpm=jitter(r,after.bpm,45,190,strength);if(after.bpm===before.bpm)after.bpm=clamp(after.bpm+(after.bpm===190?-1:1),45,190);}
  if(g.groove){after.swing=jitter(r,after.swing,0,65,strength);after.human=jitter(r,after.human,0,100,strength);}
  if(g.harmony)applyRandomHarmony(after,before,cfg,r,false);
  if(g.masterFX)for(const[k,min,max,step]of[['reverb',0,65,1],['delay',0,48,1],['feedback',0,48,1],['cutoff',2500,19000,100],['duck',0,60,1],['drumDrive',0,32,1],['drumCrush',0,50,1]])after.master[k]=jitter(r,after.master[k],min,max,strength,step);
  for(const tr of after.tracks){if(!eligible(tr))continue;const drum=trackMap[tr.id].drum,changeNotes=drum?g.rhythm:g.melody;
   if(g.sound)randomTimbre(tr,r,strength);
   if(g.performance&&!drum)randomPerformance(tr,r,strength);
   if(g.trackFX){for(const[k,min,max]of[['drive',0,32],['chorus',0,46],['phaser',0,36],['tremolo',0,36],['autoPan',0,38]])tr[k]=jitter(r,tr[k],min,max,strength);tr.send=jitter(r,tr.send,0,.62,strength,.01);tr.delay=jitter(r,tr.delay,0,.48,strength,.01);}
   if(g.mix){tr.volume=jitter(r,tr.volume,0,trackMap[tr.id].drum?1:.8,strength,.01);tr.pan=['kick','bass'].includes(tr.id)?tr.pan:jitter(r,tr.pan,-.7,.7,strength,.01);}
   if(changeNotes){tr.revision++;if(r()<strength*.65)tr.pattern=pickOther(r,Object.keys(patternDefs[drum?'drum':tr.id]),tr.pattern);tr.density=jitter(r,tr.density,28,100,strength);after.patterns[tr.id]=generateTrack(tr,after);}
   else if(g.harmony&&!drum)after.patterns[tr.id]=generateTrack(tr,after);
  }
  after.session={...(before.session||{}),randomSeed:seed,action:(before.session?.action||0)+1,lastKind:'variation'};
 }
 // Validate the entire prospective project, including recipes and generated music, before touching the session.
 after=validateProject({schema:'umbra-project',version:4,state:after});
 const delta=diffRandom(before,after);if(!delta.total)throw new Error(cfg.respectLocks&&before.tracks.every(t=>t.locked)?'Todas las pistas están bloqueadas. Desbloqueá una o elegí un parámetro global.':'Esta selección no produjo cambios musicales. Probá otro grupo, otra pista o una intensidad mayor.');return{state:after,delta,seed,kind,config:cfg};
}
function diffRandom(a,b){const tracks=[];let total=0;for(const t of b.tracks){const old=a.tracks.find(x=>x.id===t.id),fields=Object.keys(t).filter(k=>!sameJSON(old[k],t[k])),notes=!sameJSON(a.patterns[t.id],b.patterns[t.id]);if(fields.length||notes){tracks.push({id:t.id,fields,notes});total+=fields.length+(notes?1:0);}}const globals=[];for(const k of ['preset','genre','bpm','root','scale','progression','degrees','voicing','bars','structure','seed','mutation','density','complexity','variation','human','swing','chordEdits','harmony'])if(!sameJSON(a[k],b[k]))globals.push(k);const master=Object.keys(b.master).filter(k=>!sameJSON(a.master[k],b.master[k]));total+=globals.length+master.length;return{tracks,globals,master,total};}
// UMBRA 4 — Workbench controls as a view over the existing musical model.
// Workbench owns gestures; UMBRA owns state, audio, undo and persistence.
// Adapt the original slider factory, keeping its callbacks and all musical controls.
const engineInitBefore4=SynthEngine.prototype.initV2;
SynthEngine.prototype.initV2=function(s){engineInitBefore4.call(this,s);if(this.offline)return;for(const t of s.tracks){const ch=this.channels[t.id];ch.dawAnalyser=this.N('createAnalyser');ch.dawAnalyser.fftSize=256;ch.dawSamples=new Float32Array(256);ch.pan.connect(ch.dawAnalyser);}};
// UMBRA 5 · Carbon surfaces, a single Workbench Main rig, and bounded visual preferences.
const V5='5.0.0';
const PALETTE5={kick:'#e2a075',snare:'#dec273',hat:'#bfc781',open:'#87c2a2',perc:'#db9194',bass:'#78a8e6',keys:'#b39de3',pad:'#8e9dd9',arp:'#dd94c3',lead:'#73c9c9'};
Object.assign(trackColors,PALETTE5);for(const d of trackDefs)d.color=PALETTE5[d.id];
const visualPresets5={
 studio:{name:'Estudio',bloom:23,particles:12,links:0,ripples:20,trail:30},
 prism:{name:'Prisma',bloom:57,particles:55,links:15,ripples:64,trail:63},
 aurora:{name:'Aurora',bloom:66,particles:34,links:63,ripples:37,trail:86},
 orbit:{name:'Órbita',bloom:43,particles:68,links:32,ripples:90,trail:53}
};
const viewDefaults5=()=>({scene:'prism',bloom:57,particles:55,links:15,ripples:64,trail:63,quality:'full',lighting:true,lightStrength:85});
function validateView5(x={}){if(!x||typeof x!=='object'||Array.isArray(x))throw new Error('Preferencias visuales inválidas.');const d=viewDefaults5(),o={...d};o.scene=member3(x.scene,d.scene,Object.keys(visualPresets5));o.quality=member3(x.quality,d.quality,['off','lite','full']);o.lighting=bool3(x.lighting,true);for(const k of ['bloom','particles','links','ripples','trail','lightStrength'])o[k]=number3(x[k],d[k],0,100,true);return o;}
const defBefore5=defaultState;defaultState=function(){const s=defBefore5();s.visual=viewDefaults5();s.chaosRecord=null;return s;};
// Deep seeded transformation. Candidate construction is pure; applying is one undoable transaction.
const chaosDefaults5=()=>({mode:'reinvent',intensity:76,coherence:82,respectLocks:true,keepTempo:false,keepKey:false,keepGenre:false,keepMix:false});
function validateChaosConfig5(x={}){if(!x||typeof x!=='object')throw new Error('Opciones de Caos inválidas.');return{mode:member3(x.mode,'reinvent',['mutate','reinvent','fracture']),intensity:number3(x.intensity,76,20,100,true),coherence:number3(x.coherence,82,0,100,true),...Object.fromEntries(['respectLocks','keepTempo','keepKey','keepGenre','keepMix'].map(k=>[k,bool3(x[k],k==='respectLocks')]))};}
function validateChaosRecord5(x){if(x===null||x===undefined)return null;if(typeof x!=='object')throw new Error('Registro de Caos inválido.');return{seed:text3(x.seed,'',64),mode:member3(x.mode,'reinvent',['mutate','reinvent','fracture']),intensity:number3(x.intensity,76,20,100,true),coherence:number3(x.coherence,82,0,100,true),noteChanges:number3(x.noteChanges,0,0,1000000,true),hybridGenre:member3(x.hybridGenre,'',['',...Object.keys(genreNames)]),operations:(Array.isArray(x.operations)?x.operations:[]).slice(0,16).map(o=>text3(o,'',80))};}
const validateBefore5=validateProject;validateProject=function(p){const s=validateBefore5(p);s.visual=validateView5(p.state.visual);s.chaosRecord=validateChaosRecord5(p.state.chaosRecord);return s;};
function int5(r,min,max){return Math.floor(min+r()*(max-min+1));}
function quantize5(n,pcs,low,high){n=clamp(Math.round(n),low,high);for(let d=0;d<=12;d++)for(const sign of [1,-1]){const x=n+d*sign;if(x>=low&&x<=high&&pcs.includes(mod(x,12)))return x;}return n;}
function shiftDegree5(n,steps,s){const pcs=scaleNotes(s).map(x=>mod(x+s.root,12)),pool=[];for(let p=24;p<=108;p++)if(pcs.includes(mod(p,12)))pool.push(p);const idx=pool.reduce((best,x,i)=>Math.abs(x-n)<Math.abs(pool[best]-n)?i:best,0);return pool[clamp(idx+steps,0,pool.length-1)];}
function transformNotes5(pattern,tr,s,cfg,r){const drum=trackMap[tr.id].drum,amount=cfg.intensity/100,coherent=cfg.coherence/100,out=emptyPattern(s.bars),changed={count:0};const reflect=!drum&&r()<amount*.58,rotate=choose(r,drum?[0,1,2,3,5]:[1,2,3,4,6,8]),degreeShift=choose(r,[-3,-2,-1,1,2,3]),retro=r()<amount*.63;
 const band=tr.id==='bass'?[29,60]:tr.id==='pad'?[43,86]:tr.id==='keys'?[43,90]:[52,96];
 for(let b=0;b<s.bars;b++){const source=pattern[b%pattern.length]||[],idx=harmonyIndex(b,s),raw=rawAt(idx,s),chordPCs=[...new Set(raw.map(n=>mod(n,12)))],scalePCs=scaleNotes(s).map(n=>mod(n+s.root,12)),shift=(b%4===3&&r()<amount)?rotate+2:rotate,axis=tr.id==='bass'?chordRoot(b,s,2)+7:raw[Math.min(1,raw.length-1)]+8;
  for(let st=0;st<16;st++){const e=source[st];if(!e)continue;const anchor=drum&&tr.id==='kick'&&st===0;if(!anchor&&r()<amount*.13){changed.count+=e.n.length;continue;}
   let target=anchor?st:mod((retro?15-st:st)+shift,16);if(drum&&tr.id==='snare'&&cfg.mode!=='fracture'&&r()<coherent*.7)target=st;
   let ns=drum?e.n.slice():e.n.map(n=>{let x=shiftDegree5(n,degreeShift,s);if(reflect)x=axis*2-x;if(b%4===3&&r()<amount*.25)x+=choose(r,[-12,12]);const strong=target%4===0,pcs=strong&&r()<coherent?chordPCs:[...new Set([...scalePCs,...chordPCs])];if(r()<coherent)x=quantize5(x,pcs,...band);else x=clamp(Math.round(x)+choose(r,[-2,-1,1,2]),...band);return x;});
   ns=[...new Set(ns)].sort((a,b)=>a-b).slice(0,tr.id==='bass'?1:tr.id==='pad'?6:4);const factor=choose(r,drum?[.8,1,1.2]:tr.id==='pad'?[.75,1,1.2]:[.5,.75,1,1.5]);const event={n:ns,v:clamp(Math.round((e.v*(.82+r()*.32))*100)/100,.2,.86),d:Math.round(clamp(e.d*factor,.25,Math.min(16,16-target))*4)/4};
   const existing=out[b][target];if(existing){existing.n=[...new Set([...existing.n,...ns])].slice(0,drum?1:4);existing.v=Math.max(existing.v,event.v);existing.d=Math.min(existing.d,event.d);}else out[b][target]=event;
   if(target!==st||!sameJSON(event,e))changed.count+=ns.length;
   if(!drum&&tr.id!=='pad'&&r()<amount*.2){const ghost=mod(target+choose(r,[1,2,3]),16);if(!out[b][ghost]){const n=quantize5(ns[0]+choose(r,[-2,2,4,7]),scalePCs,...band);out[b][ghost]={n:[n],v:clamp(event.v*.68,.18,.6),d:.5};changed.count++;}}
  }
  if(!out[b].some(Boolean)&&r()<.9){const n=drum?trackMap[tr.id].midi:quantize5(tr.id==='bass'?chordRoot(b,s,2):raw[0],chordPCs,...band);out[b][0]={n:[n],v:.52,d:drum?.5:2};changed.count++;}
 }
 return{pattern:out,changes:changed.count,operations:[...(retro?['retrogradación']:[]),'rotación rítmica',...(drum?[]:['desplazamiento de grados',...(reflect?['inversión melódica']:[])]),'nuevas duraciones y acentos']};
}
function chaosHarmony5(s,before,cfg,r){const locks=before.degrees.map((_,i)=>cfg.respectLocks&&specAt(i,before).locked),has=locks.some(Boolean),len=has?before.degrees.length:Math.min(s.bars,choose(r,[4,4,6,8]));
 if(has){s.root=before.root;s.scale=before.scale;s.voicing=before.voicing;s.harmony=clone(before.harmony);}else s.harmony={layout:choose(r,['auto','auto','block','open']),register:choose(r,[0,0,0,1]),adventure:cfg.intensity};
 const diatonic=r()<cfg.coherence/100,ref=choose(r,REF_PROGRESSIONS.filter(x=>x.mode===(scaleNotes(s,true)[2]===3?'minor':'major'))),source=progressions[ref.id].chords,degreeOrder=[0,choose(r,[1,2,3,5]),choose(r,[2,3,5,6]),4];
 s.chordEdits=Array.from({length:len},(_,i)=>{if(locks[i])return clone(specAt(i,before));const degree=mod(degreeOrder[i%4]+(i>=4&&r()<.5?1:0),scaleNotes(s,true).length);if(!diatonic){const x=clone(source[i%source.length]);x.locked=false;if(r()<cfg.intensity/150)x.inversion=choose(r,[0,1,2]);return x;}const raw=chordRaw(degree,s),root=mod(raw[0]-s.root,12),intervals=[...new Set(raw.map(n=>n-raw[0]))],quality=Object.keys(Q).find(k=>k!=='custom'&&sameJSON(Q[k],intervals))||'custom';return{root,quality,intervals,degree,locked:false,bass:null,inversion:r()<.38?1:0,layout:'auto',suffix:QUALITY_SUFFIX[quality]||'',roman:ROMANS[degree]+(quality==='maj7'?'Δ7':quality.includes('7')?'7':'')};});
 s.degrees=s.chordEdits.map(x=>x.degree??0);s.progression='custom';return has;
}
function makeChaosCandidate5(before,rawConfig={},seed='UMBRA-CHAOS'){
 const cfg=validateChaosConfig5(rawConfig);if(typeof seed!=='string'||!seed.trim()||seed.length>64)throw new Error('Escribí una semilla de 1 a 64 caracteres.');
 const r=rng(seed+'|UMBRA5-CAOS|'+cfg.mode),a=cfg.intensity/100,locks=before.tracks.filter(t=>cfg.respectLocks&&t.locked),chordLocks=cfg.respectLocks&&before.degrees.some((_,i)=>specAt(i,before).locked);
 if(locks.length===before.tracks.length)throw new Error('Todas las pistas están bloqueadas. Desbloqueá alguna o desactivá «Respetar bloqueos».');
 let after;if(cfg.mode==='mutate')after=clone(before);else{const opts={...randomDefaults(),respectLocks:cfg.respectLocks,keepKey:cfg.keepKey,keepTempo:cfg.keepTempo,genre:cfg.keepGenre?before.genre:'auto',newBars:choose(r,[4,8,8,16]),amount:cfg.intensity};after=makeRandomCandidate(before,opts,seed,'song').state;}
 after.visual=clone(before.visual||viewDefaults5());after.library=clone(before.library);after.seed=seed;after.mutation=0;
 if(locks.length||chordLocks)after.bars=before.bars;else if(cfg.mode!=='mutate')after.bars=choose(r,a>.8?[4,8,12,16]:[4,8,8,16]);
 if(!cfg.keepGenre&&cfg.mode==='fracture')after.genre=pickOther(r,Object.keys(grooves),before.genre);if(cfg.keepGenre)after.genre=before.genre;
 if(!cfg.keepKey&&!chordLocks){after.root=pickOther(r,Array.from({length:12},(_,i)=>i),before.root);const safeScales=['major','minor','dorian','phrygian','lydian','mixolydian','harmonic','melodic','pentminor','pentmajor'];const scales=cfg.mode==='fracture'||a>.88?Object.keys(scaleDefs):safeScales.filter(k=>scaleDefs[k]);after.scale=pickOther(r,scales,before.scale);}else{after.root=before.root;after.scale=before.scale;}
 if(cfg.keepTempo)after.bpm=before.bpm;else if(cfg.mode==='mutate'){after.bpm=clamp(before.bpm+choose(r,[-19,-12,-7,8,13,21]),45,190);}else if(after.bpm===before.bpm)after.bpm=clamp(after.bpm+(after.bpm>=184?-7:7),45,190);
 after.structure=cfg.mode==='mutate'?before.structure:(r()<.3?'journey':'loop');after.density=int5(r,44,Math.round(60+17*a));after.complexity=int5(r,35,Math.round(55+42*a));after.variation=int5(r,40,95);after.human=int5(r,8,Math.round(18+35*a));after.swing=int5(r,0,Math.round(18+24*a));after.voicing=choose(r,['triad','seventh','seventh','ninth','add9','sixth']);chaosHarmony5(after,before,cfg,r);
 const hybrid=cfg.mode==='fracture'?pickOther(r,Object.keys(grooves),after.genre):'',operations=new Set(['notas y duraciones','tonalidad y escala','armonía','timbres','arpegios y chops']);let noteChanges=0;
 for(const tr of after.tracks){const old=before.tracks.find(x=>x.id===tr.id),def=trackMap[tr.id];if(cfg.respectLocks&&old.locked){Object.assign(tr,clone(old));after.patterns[tr.id]=clone(before.patterns[tr.id]);continue;}
  tr.locked=cfg.respectLocks?old.locked:false;tr.arpLock=null;tr.mute=old.mute;tr.solo=old.solo;tr.revision=int5(r,1,50000);tr.pattern=pickOther(r,Object.keys(patternDefs[def.drum?'drum':tr.id]),old.pattern);tr.sound=pickOther(r,def.voices,old.sound);tr.density=int5(r,52,96);tr.tone=int5(r,30,80);tr.texture=int5(r,14,67);tr.attack=def.drum?int5(r,0,6):tr.id==='pad'?int5(r,25,65):int5(r,0,12);tr.decay=tr.id==='pad'?int5(r,35,74):int5(r,20,64);tr.octave=0;tr.tune=0;tr.pulses=int5(r,4,13);tr.rotation=int5(r,0,15);
  tr.drive=int5(r,2,Math.round(12+19*a));tr.chorus=tr.id==='bass'||tr.id==='kick'?0:int5(r,0,38);tr.phaser=int5(r,0,22);tr.tremolo=def.drum?0:int5(r,0,26);tr.autoPan=['kick','bass'].includes(tr.id)?0:int5(r,0,34);tr.lowEQ=choose(r,[-1,0,0,1]);tr.highEQ=choose(r,[-2,-1,0,0,1,2]);tr.resonance=int5(r,4,28);tr.spread=tr.id==='bass'?0:int5(r,14,52);tr.highpass=['kick','bass'].includes(tr.id)?24:tr.id==='hat'||tr.id==='open'?650:100;
  tr.send=cfg.keepMix?old.send:tr.id==='bass'||tr.id==='kick'?.02:Math.round(r()*.34*100)/100;tr.delay=cfg.keepMix?old.delay:tr.id==='bass'||def.drum?Math.round(r()*.09*100)/100:Math.round(r()*.3*100)/100;
  tr.volume=cfg.keepMix?old.volume:(def.drum?tr.id==='kick'?.69:tr.id==='snare'?.44:.30:tr.id==='bass'?.55:tr.id==='pad'?.23:tr.id==='lead'?.23:.34)*(.85+r()*.17);tr.pan=cfg.keepMix?old.pan:['kick','bass'].includes(tr.id)?0:Math.round((r()-.5)*.65*100)/100;
  const generatorState=hybrid&&def.drum?{...after,genre:hybrid}:after;const source=generateTrack(tr,generatorState),tx=transformNotes5(source,tr,after,cfg,r);after.patterns[tr.id]=tx.pattern;noteChanges+=tx.changes;tx.operations.forEach(x=>operations.add(x));
  if(!def.drum){tr.arp={...makeArp(false),gate:int5(r,45,102),probability:int5(r,72,100),octaves:tr.id==='bass'||tr.id==='pad'?1:choose(r,[1,1,2]),rate:choose(r,['8','8','16','8t','8d']),mode:choose(r,Object.keys(arpModes)),pulses:int5(r,5,16),rotation:int5(r,0,15),ratchet:a>.85&&r()<.18?2:1};const mode=tr.id==='bass'?'original':tr.id==='pad'?choose(r,['original','chop']):choose(r,['original','arp','chop','hybrid']);tr.performance={...makePerformance(),mode,source:tr.id==='pad'?'chord':'notes',arpPreset:choose(r,Object.keys(ARP_LIBRARY)),chopPreset:choose(r,Object.keys(CHOP_LIBRARY)),phrase:tr.id==='pad'?32:choose(r,[8,16,16,32]),speed:1,density:int5(r,70,100),bias:int5(r,65,100),morph:int5(r,5,Math.round(25+40*a)),repeats:int5(r,0,42),reverse:r()<.45,alternate:r()<.5,subcycles:1,skew:mode==='chop'||mode==='hybrid'?int5(r,-28,28):0,onBeat:int5(r,35,70),human:int5(r,8,34),strum:tr.id==='keys'?int5(r,0,35):0};syncArpMode(tr);if(usesPerformance(tr)&&performanceTimeline(tr,after).length<3){tr.performance.mode='original';tr.arp.enabled=false;}}
 }
 if(cfg.keepMix)after.master=clone(before.master);else{after.master={...after.master,volume:before.master.volume,reverbKind:choose(r,['room','plate','plate','hall']),reverb:int5(r,12,38),delay:int5(r,8,31),feedback:int5(r,14,41),division:choose(r,[.5,.75,1,1.5]),duck:int5(r,8,40),cutoff:int5(r,100,190)*100,predelay:int5(r,8,32),damping:int5(r,25,85)*100,delayTone:int5(r,18,62)*100,drumDrive:int5(r,8,26),drumCrush:int5(r,15,42),glue:int5(r,18,44),chorusRate:.32,phaserRate:.16,lowEQ:0,highEQ:0};}
 // Keep the generator inside the existing offline voice budget; do not silently cut a held track.
 let estimate=0;for(let st=0;st<after.bars*16;st++)for(const e of scoreEvents(st,{...after,structure:'loop'}))estimate+=e.n.length;if(estimate*(after.structure==='journey'?4:1)>14000){after.structure='loop';operations.add('densidad limitada para render');}
 after.session={name:choose(r,['Obsidiana','Fósforo','Interferencia','Carbón','Vértigo','Prisma'])+' '+choose(r,['en órbita','fragmentado','de medianoche','en expansión','sin centro','de cristal']),randomSeed:seed,action:(before.session?.action||0)+1,lastKind:'chaos'};after.chaosRecord={seed,mode:cfg.mode,intensity:cfg.intensity,coherence:cfg.coherence,noteChanges,hybridGenre:hybrid,operations:[...operations].slice(0,16)};
 after=validateProject({schema:'umbra-project',version:8,state:after});const delta=diffRandom(before,after);if(!delta.total)throw new Error('No quedan parámetros disponibles para transformar.');return{state:after,delta,seed,kind:'chaos',config:cfg,notes:noteChanges,operations:[...operations],hybrid};
}
// Render-only layer. All onsets come from the scheduled audio queue; no drawing function writes notes.
// Piano editor retains all original hit-test geometry. Effects decorate the source notes only.
// UMBRA 5 controls: two visible entry points, details on demand, independent of the music engine.
const randomCandidateBefore5=makeRandomCandidate;makeRandomCandidate=function(before,...args){const c=randomCandidateBefore5(before,...args);c.state.visual=clone(before.visual||viewDefaults5());c.state.chaosRecord=clone(before.chaosRecord||null);return c;};
const presetBefore5=applyPreset;applyPreset=function(...args){const v=clone(state?.visual||viewDefaults5());presetBefore5(...args);state.visual=v;};
/* UMBRA 7 — project model. All timing below uses sixteenth-note units (16 = 4/4 bar).
   Existing UMBRA 1–6 state remains valid. Clips are opt-in and never discard a source. */
const VERSION7='7.0.0';
const ui7={ready:false,revision:0,view:'live',selection:new Set(),drag:null,tool:'select',grid:1,zoom:2,start:0,clipboard:[],destination:'session',bank:'A',lane:null,preview:null,previewTimer:null,abort:false,exporting:false,textScale:100,lastPaint:0,context:null};
const routesDefault7=()=>[
 {macro:'energy',target:'notes.velocity',depth:.45}, {macro:'energy',target:'master.cutoff',depth:.7},
 {macro:'tension',target:'notes.tension',depth:.65}, {macro:'space',target:'all.send',depth:.65},
 {macro:'space',target:'all.delay',depth:.5}, {macro:'movement',target:'notes.gate',depth:-.45},
 {macro:'movement',target:'all.phaser',depth:.4}];
const emptyStudio7=()=>({schema:1,clips:{},bindings:{},sections:[],selectedSection:null,playMode:'phrase',automation:[],macros:{energy:50,tension:0,space:50,movement:0},routes:routesDefault7(),bank:{A:null,B:null,C:null,D:null},fill:false,soundAB:{}});
function studio7(s=state){if(!s.studio)s.studio=emptyStudio7();return s.studio;}
function id7(prefix='id'){return prefix+'_'+seedRandom();}
const frameFields7=['preset','genre','root','scale','progression','degrees','voicing','bars','seed','mutation','density','complexity','variation','human','swing','harmony','harmonyRevision','chordEdits','tracks','patterns'];
function frame7(s=state){const out={};for(const k of frameFields7)if(s[k]!==undefined)out[k]=clone(s[k]);out.bindings=clone(studio7(s).bindings);return out;}
function saveSection7(s=state){const st=studio7(s),sec=st.sections.find(x=>x.id===st.selectedSection);if(sec){sec.frame=frame7(s);sec.bars=s.bars;}}
function sectionRanges7(s=state){const st=studio7(s);let at=0;return st.sections.map(sec=>{const bars=sec.id===st.selectedSection?s.bars:sec.bars,len=bars*16*(sec.repeat||1),r={...sec,start:at,end:at+len,bars};at+=len;return r;});}
function frameState7(sec,s=state){const st=studio7(s),selected=sec.id===st.selectedSection,f=selected?s:sec.frame;return {...s,...f,bpm:s.bpm,master:s.master,structure:'loop',studio:{...st,bindings:selected?st.bindings:f.bindings||{},sections:[],selectedSection:null,playMode:'phrase'},_frame7:sec.id};}
function locateFrame7(step,s=state){const st=studio7(s);if(st.playMode==='song'&&st.sections.length){const ranges=sectionRanges7(s),len=ranges.at(-1).end,at=mod(step,len),sec=ranges.find(x=>at>=x.start&&at<x.end)||ranges[0];return {frame:frameState7(sec,s),local:mod(at-sec.start,sec.bars*16),absolute:at,cycle:Math.floor(step/len)*(sec.repeat||1)+Math.floor((at-sec.start)/(sec.bars*16)),section:sec};}const len=s.bars*16;return{frame:s,local:mod(step,len),absolute:mod(step,totalBars(s)*16),cycle:Math.floor(step/len),section:null};}
const defaultBefore7=defaultState;defaultState=function(){return{...defaultBefore7(),studio:emptyStudio7()};};
const totalBarsBefore7=totalBars;totalBars=function(s=state){return s.studio?.playMode==='song'&&s.studio.sections.length?sectionRanges7(s).at(-1).end/16:totalBarsBefore7(s);};
function makeNote7(x,i=0,prefix='n'){return{id:x.id||prefix+'_'+i,t:x.t??0,p:x.p??60,d:x.d??1,v:x.v??.75,prob:x.prob??1,every:x.every??1,phase:x.phase??0,fill:!!x.fill,ratchet:x.ratchet??1,flam:x.flam??0,anchor:!!x.anchor};}
function rawNotes7(tr,s=state){return(s.patterns[tr.id]||[]).flatMap((bar,b)=>bar.flatMap((e,t)=>e?e.n.map((p,i)=>makeNote7({t:b*16+t,p,d:e.d,v:e.v},b*256+t*12+i,tr.id)):[]));}
function boundClip7(track=ui.selected,s=state){const st=studio7(s);return st.clips[st.bindings[track]]||null;}
function notesForTrack7(track=ui.selected,s=state){return boundClip7(track,s)?.notes||rawNotes7(s.tracks.find(t=>t.id===track),s);}
function createClip7(track,notes,{name='Clip',length=state.bars*16,timing='raw',origin=null,recipe=null}={},s=state){const st=studio7(s);if(Object.keys(st.clips).length>=160)throw Error('Límite de 160 clips. Usá Limpiar clips sin uso desde Ctrl K.');if(notes.length>8192)throw Error('Un clip admite hasta 8.192 notas.');const id=id7('clip');const c={id,track,name,length,timing,notes:notes.map((n,i)=>makeNote7({...n,id:id+'_'+i},i,id)),origin,recipe};st.clips[id]=c;return c;}
function ensureClip7(track=ui.selected,s=state){let c=boundClip7(track,s);if(c)return c;const tr=s.tracks.find(t=>t.id===track);c=createClip7(track,rawNotes7(tr,s),{name:trackMap[track].name+' · original',length:s.bars*16,recipe:{arp:clone(tr.arp),performance:clone(tr.performance)}},s);c.notes=rawNotes7(tr,s);studio7(s).bindings[track]=c.id;return c;}
function projection7(c,bars){const p=emptyPattern(bars);for(let b=0;b<bars;b++)for(const n of c.notes){let offset=mod(b*16,c.length);if(n.t<offset||n.t>=offset+16)continue;const st=clamp(Math.floor(n.t-offset),0,15),e=p[b][st];if(e){if(!e.n.includes(n.p)&&e.n.length<12)e.n.push(n.p);}else p[b][st]={n:[n.p],v:n.v,d:clamp(n.d,.2,16)};}return p;}
function syncProjection7(track=ui.selected,s=state){const c=boundClip7(track,s);if(c)s.patterns[track]=projection7(c,s.bars);}
function projectSnapshot7(s=state){const out=clone(s);saveSection7(out);if(out.studio)out.studio.bank={A:null,B:null,C:null,D:null};return out;}
function cleanSelection7(){const ids=new Set(notesForTrack7().map(n=>n.id));ui7.selection=new Set([...ui7.selection].filter(id=>ids.has(id)));}
const presetBefore7=applyPreset;applyPreset=function(...args){const bank=state.studio?.bank?clone(state.studio.bank):{A:null,B:null,C:null,D:null};presetBefore7(...args);studio7().bank=bank;};
function changeBinding7(id,track=ui.selected){const st=studio7(),tr=state.tracks.find(t=>t.id===track);commit7(()=>{if(id&&st.clips[id]?.track===track){st.bindings[track]=id;const c=st.clips[id];if(c.recipe){tr.arp=clone(c.recipe.arp);tr.performance=clone(c.recipe.performance);}if(c.timing==='baked'){tr.arp.enabled=false;tr.performance.mode='original';}syncProjection7(track);}else delete st.bindings[track];ui7.selection.clear();},{message:'Clip seleccionado.'});}
function duplicateClip7(track=ui.selected){commit7(()=>{const c=ensureClip7(track),copy=createClip7(track,c.notes,{...c,id:undefined,name:c.name+' · copia'});studio7().bindings[track]=copy.id;ui7.selection.clear();},{message:'Copia independiente creada.'});}
function deleteClip7(){const c=boundClip7();if(!c)return;commit7(()=>{delete studio7().bindings[ui.selected];ui7.selection.clear();},{message:'Clip desacoplado. Sigue disponible en la biblioteca.'});}
function validateStudio7(x,s,depth=0){if(x===undefined)return emptyStudio7();if(!x||typeof x!=='object'||Array.isArray(x))throw Error('Proyecto Studio inválido.');const d=emptyStudio7(),num=(v,lo,hi,integer=false)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<lo||v>hi||integer&&!Number.isInteger(v))throw Error('Valor Studio fuera de rango.');return v;};
 const text=(v,max=120)=>{if(typeof v!=='string'||v.length>max)throw Error('Texto Studio inválido.');return v;},enumV=(v,opts)=>{if(!opts.includes(v))throw Error('Opción Studio inválida.');return v;},key=(v)=>{text(v,90);if(!/^[a-zA-Z0-9_-]+$/.test(v)||['__proto__','constructor','prototype'].includes(v))throw Error('Identificador Studio inválido.');return v;};
 const clips=Object.entries(x.clips||{});if(clips.length>160)throw Error('Máximo de 160 clips por sesión.');let noteCount=0;for(const[id,c]of clips){key(id);if(!c||c.id!==id||!trackMap[c.track]||!Array.isArray(c.notes)||c.notes.length>8192)throw Error('Clip inválido.');noteCount+=c.notes.length;if(noteCount>80000)throw Error('La sesión supera 80.000 notas.');const length=num(c.length,1,1024),ids=new Set();const notes=c.notes.map(n=>{if(!n||ids.has(n.id))throw Error('ID de nota repetido.');ids.add(key(n.id));return {id:n.id,t:num(n.t,0,length-1e-7),p:num(n.p,12,119,true),d:num(n.d,.01,2048),v:num(n.v,.01,1),prob:num(n.prob??1,0,1),every:num(n.every??1,1,16,true),phase:num(n.phase??0,0,15,true),fill:bool3(n.fill),ratchet:num(n.ratchet??1,1,8,true),flam:num(n.flam??0,0,120),anchor:bool3(n.anchor)};});d.clips[id]={id,track:c.track,name:text(c.name),length,timing:enumV(c.timing||'raw',['raw','baked']),notes,origin:c.origin?{label:text(c.origin.label||'',100),seed:text(c.origin.seed||'',64),sourceClip:c.origin.sourceClip?key(c.origin.sourceClip):null}:null,recipe:c.recipe?{arp:validateArpRecipe3(c.recipe.arp),performance:validatePerformance3(c.recipe.performance)}:null};}
 const bindings=b=>{const out={};for(const[t,id]of Object.entries(b||{})){if(!trackMap[t]||!d.clips[id]||d.clips[id].track!==t)throw Error('Referencia de clip inválida.');out[t]=id;}return out;};d.bindings=bindings(x.bindings);
 if(!Array.isArray(x.sections)||x.sections.length>24)throw Error('Máximo de 24 secciones.');const sections=new Set();for(const sec of x.sections){key(sec.id);if(sections.has(sec.id))throw Error('Sección duplicada.');sections.add(sec.id);const f=sec.frame;if(!f||f.studio)throw Error('Sección inválida.');const base={...s,...f,studio:undefined};const validated=validateLegacy7({schema:'umbra-project',version:7,state:base});if(sec.bars!==validated.bars)throw Error('Duración de sección inconsistente.');const frame={};for(const k of frameFields7)if(validated[k]!==undefined)frame[k]=clone(validated[k]);frame.bindings=bindings(f.bindings);d.sections.push({id:sec.id,name:text(sec.name,70),bars:num(sec.bars,1,64,true),repeat:num(sec.repeat||1,1,8,true),frame});}
 d.selectedSection=x.selectedSection===null||x.selectedSection===undefined?null:key(x.selectedSection);if(d.selectedSection&&!sections.has(d.selectedSection))throw Error('Sección seleccionada inexistente.');d.playMode=enumV(x.playMode||'phrase',['phrase','song']);
 if(!Array.isArray(x.automation)||x.automation.length>64)throw Error('Máximo de 64 automatizaciones.');const laneIds=new Set();for(const a of x.automation){key(a.id);if(laneIds.has(a.id)||!targets7()[a.target]||!Array.isArray(a.points)||a.points.length>512)throw Error('Automatización inválida.');laneIds.add(a.id);d.automation.push({id:a.id,target:a.target,enabled:bool3(a.enabled,true),shape:enumV(a.shape||'linear',['linear','step']),points:a.points.map(pt=>({t:num(pt.t,0,24576),v:num(pt.v,0,1)})).sort((p,q)=>p.t-q.t)});}
 for(const k of Object.keys(d.macros))d.macros[k]=num(x.macros?.[k]??d.macros[k],0,100);if(!Array.isArray(x.routes)||x.routes.length>16)throw Error('Asignaciones macro inválidas.');d.routes=x.routes.map(r=>({macro:enumV(r.macro,Object.keys(d.macros)),target:enumV(r.target,Object.keys(routeTargets7)),depth:num(r.depth,-1,1)}));d.fill=bool3(x.fill);
 for(const [t,ab]of Object.entries(x.soundAB||{})){if(!trackMap[t])continue;d.soundAB[t]={};for(const slot of ['A','B'])if(ab[slot]){const tr=validateLegacy7({schema:'umbra-project',version:7,state:{...s,studio:undefined,tracks:s.tracks.map(z=>z.id===t?ab[slot]:z)}}).tracks.find(z=>z.id===t);d.soundAB[t][slot]=tr;}}
 if(depth===0)for(const slot of ['A','B','C','D'])if(x.bank?.[slot]){const b=x.bank[slot];if(!b.project||b.project.studio?.bank&&Object.values(b.project.studio.bank).some(Boolean))throw Error('Los bancos no pueden contener bancos anidados.');const bs=validateLegacy7({schema:'umbra-project',version:7,state:b.project});bs.studio=validateStudio7(b.project.studio,bs,1);d.bank[slot]={name:text(b.name,70),favorite:bool3(b.favorite),project:bs};}return d;}
const validateLegacy7=validateProject;validateProject=function(payload){const s=validateLegacy7(payload);s.studio=validateStudio7(payload.state.studio,s);return s;};

// Undoable collection of disconnected clip archives. Sources of active baked clips remain protected.
function collectUnusedClips7(){commit7(()=>{const st=studio7(),keep=new Set(Object.values(st.bindings));for(const sec of st.sections)for(const id of Object.values(sec.frame.bindings||{}))keep.add(id);const visit=id=>{const origin=st.clips[id]?.origin?.sourceClip;if(origin&&!keep.has(origin)){keep.add(origin);visit(origin);}};for(const id of [...keep])visit(id);let removed=0;for(const id of Object.keys(st.clips))if(!keep.has(id)){delete st.clips[id];removed++;}toast(removed+' clips sin uso eliminados. Deshacer permite recuperarlos.');});}

/* One score for realtime audio, visualisation, bake, MIDI and offline rendering. */
const legacyScore7=scoreEvents,scoreMemo7=new Map();
function phraseKey7(s){const st=studio7(s);return JSON.stringify([s.seed,s.mutation,s.bpm,s.root,s.scale,s.progression,s.degrees,s.voicing,s.harmony,s.chordEdits,s.bars,s.structure,s.human,s.swing,s.density,s.tracks,s.patterns,st.bindings,Object.values(st.bindings).map(id=>st.clips[id])]);}
function phraseTimeline7(s=state){const key=phraseKey7(s);if(scoreMemo7.has(key))return scoreMemo7.get(key);const st=studio7(s),base={...s,studio:{...st,sections:[],playMode:'phrase'}},dt=stepSeconds(s),length=totalBarsBefore7(base)*16,events=[];const replaced=new Set(Object.keys(st.bindings));
 for(let i=0;i<length;i++)for(const e of legacyScore7(i,base)){if(replaced.has(e.id))continue;events.push({...e,at:i+e.offset/dt,span:e.d/dt,bucket:i});}
 for(const id of replaced){const tr=s.tracks.find(t=>t.id===id),c=st.clips[st.bindings[id]];if(!tr||!c||!audible(tr,s)||tr.volume<=0)continue;const isDrum=trackMap[id].drum,mode=effectiveMode(tr),processed=!isDrum&&mode!=='original',source=tr.performance?.source==='notes'||tr.arp?.source==='pattern';
  if(processed&&!(mode==='chop'&&source)){
   const proxy={...base,patterns:{...s.patterns,[id]:projection7(c,s.bars)}};
   for(let i=0;i<length;i++)for(const e of legacyScore7(i,proxy))if(e.id===id)events.push({...e,at:i+e.offset/dt,span:e.d/dt,bucket:i});continue;
  }
  let notes=[];for(let turn=0;turn*c.length<length;turn++)for(const n of c.notes){const at=n.t+turn*c.length;if(at<length)notes.push({...n,t:at,turn});}
  if(processed&&mode==='chop'&&source){const p=tr.performance,pattern=CHOP_LIBRARY[p.chopPreset]||CHOP_LIBRARY.stab1,cycle=p.phrase*p.speed/p.subcycles,wins=[];
   for(let b=0;b<length;b+=cycle)for(const a of pattern.events){let f=Math.pow(a.t/16,Math.pow(2,-p.skew/65));if(p.reverse!==!!(p.alternate&&Math.floor(b/cycle)%2))f=Math.max(0,1-f-a.d/16);const at=b+f*cycle;if(at<length&&rng(s.seed+'|clipchop|'+id+'|'+at)()<p.density/100)wins.push({t:at,d:a.d/16*cycle*tr.arp.gate/100,v:a.v});}
   notes=notes.flatMap(n=>wins.filter(w=>w.t<n.t+n.d&&w.t+w.d>n.t).map(w=>({...n,t:Math.max(n.t,w.t),d:Math.min(n.t+n.d,w.t+w.d)-Math.max(n.t,w.t),v:n.v*w.v}))).filter(n=>n.d>.015);
  }
  for(const n of notes){const bar=Math.floor(n.t/16),level=arrangementLevel(id,bar,base);if(level<=0)continue;const feel=c.timing==='baked'?0:s.human/100,r=rng(s.seed+'|independent|'+id+'|'+n.id+'|'+bar),swing=c.timing==='baked'?0:Math.floor(n.t)%2?dt*.58*s.swing/100:0,offset=(r()-.5)*.012*feel+swing;
   const flam=n.flam/1000/dt,ratchet=n.ratchet||1,limit=ratchet>1?Math.min(n.d,length-n.t):n.d;for(let k=0;k<ratchet;k++){const at=n.t+k*limit/ratchet+offset/dt,d=limit/ratchet;const e={id,tr,n:[clamp(n.p+(isDrum?0:tr.octave*12),12,119)],v:clamp(n.v*level*(1+(r()-.5)*.1*feel)*Math.pow(.86,k),.01,1),at,span:d,offset:0,d:d*dt,strum:0,hash:hash(s.seed+'|note|'+id+'|'+n.id+'|'+n.t+'|'+k),independent:true,condition:{prob:n.prob,every:n.every,phase:n.phase,fill:n.fill,turn:n.turn,period:c.length,anchor:n.anchor}};events.push(e);if(flam>0&&k===0)events.push({...e,at:at+flam,span:Math.min(d,.3),d:Math.min(d,.3)*dt,v:e.v*.48,hash:e.hash+31});}
  }
 }
 events.sort((a,b)=>a.at-b.at||a.id.localeCompare(b.id));if(scoreMemo7.size>20)scoreMemo7.delete(scoreMemo7.keys().next().value);scoreMemo7.set(key,events);return events;}
const routeTargets7={'notes.velocity':'Notas · intensidad','notes.gate':'Notas · duración','notes.tension':'Notas · tensión cromática','notes.octave':'Notas · registro','master.cutoff':'Master · filtro','all.send':'Pistas · reverb','all.delay':'Pistas · delay','all.phaser':'Pistas · phaser','all.chorus':'Pistas · chorus','all.pan':'Pistas · panorámica'};
let targetDefsCache7=null;
function targets7(){if(targetDefsCache7)return targetDefsCache7;const t={'master.cutoff':{label:'Master / Filtro',min:200,max:20000,log:true},'master.reverb':{label:'Master / Reverb',min:0,max:80},'master.delay':{label:'Master / Delay',min:0,max:65}};for(const [id,label]of Object.entries({energy:'Energía',tension:'Tensión',space:'Espacio',movement:'Movimiento'}))t['macro.'+id]={label:'Macro / '+label,min:0,max:100};for(const tr of trackDefs)for(const [p,label,min,max,log]of[['volume','Volumen',0,1.25,false],['pan','Pan',-1,1,false],['cutoff','Filtro',100,20000,true],['send','Reverb',0,.85,false],['delay','Delay',0,.8,false],['phaser','Phaser',0,75,false],['chorus','Chorus',0,80,false]])t[tr.id+'.'+p]={label:tr.name+' / '+label,min,max,log};return targetDefsCache7=Object.freeze(t);}
function norm7(value,def){return clamp(def.log?Math.log(value/def.min)/Math.log(def.max/def.min):(value-def.min)/(def.max-def.min),0,1);}
function denorm7(value,def){return def.log?def.min*Math.pow(def.max/def.min,value):def.min+value*(def.max-def.min);}
function curveValue7(lane,at,fallback){const ps=lane.points;if(!ps.length)return fallback;if(at<=ps[0].t)return ps[0].v;let i=0;while(i<ps.length-1&&ps[i+1].t<=at)i++;if(i===ps.length-1||lane.shape==='step')return ps[i].v;const a=ps[i],b=ps[i+1];return a.v+(b.v-a.v)*(at-a.t)/Math.max(.0001,b.t-a.t);}
function autoValue7(target,at,base,s=state){const st=studio7(s),def=targets7()[target],lane=st.automation.find(a=>a.target===target&&a.enabled);return lane?denorm7(curveValue7(lane,mod(at,totalBars(s)*16),norm7(base,def)),def):base;}
function macroValue7(id,at,s=state){return autoValue7('macro.'+id,at,studio7(s).macros[id],s);}
function macroDelta7(id,at,s){const v=macroValue7(id,at,s);return (v-(id==='energy'||id==='space'?50:0))/100;}
function routeAmount7(target,at,s=state){return studio7(s).routes.filter(r=>r.target===target).reduce((sum,r)=>sum+macroDelta7(r.macro,at,s)*r.depth,0);}
scoreEvents=function(absStep,s=state){const st=studio7(s),readVolume=new Set(st.automation.filter(a=>a.enabled&&a.target.endsWith('.volume')).map(a=>a.target.split('.')[0]));if(!s.tracks.some(t=>t.volume===0&&readVolume.has(t.id))&&st.playMode!=='song'&&!Object.keys(st.bindings).length&&!st.automation.some(a=>a.enabled&&a.target.startsWith('macro.'))&&st.routes.every(r=>st.macros[r.macro]===(r.macro==='energy'||r.macro==='space'?50:0)))return legacyScore7(absStep,s);const loc=locateFrame7(absStep,s),originalFrame=loc.frame,f=readVolume.size?{...originalFrame,tracks:originalFrame.tracks.map(t=>t.volume===0&&readVolume.has(t.id)?{...t,volume:1}:t)}:originalFrame,dt=stepSeconds(s),events=phraseTimeline7(f),length=f.bars*16,offset=loc.section?loc.local:mod(absStep,totalBarsBefore7(f)*16),cycle=loc.section?loc.cycle:Math.floor(absStep/length),out=[];const qt=Math.floor(absStep/16)*16;
 for(const e of events){const bucket=e.bucket!==undefined?e.bucket:Math.max(0,Math.floor(e.at+1e-7));if(bucket!==offset)continue;
  const cond=e.condition;if(cond){const rep=cycle*Math.max(1,Math.ceil(length/cond.period))+(cond.turn||0);if(mod(rep,cond.every)!==mod(cond.phase,cond.every))continue;const fill=studio7(s).fill||(loc.section&&/cierre|fill|transición/i.test(loc.section.name)&&loc.local>=length-16);if(cond.fill&&!fill)continue;if(cond.prob<=0||rng(s.seed+'|prob7|'+e.hash+'|'+absStep)()>cond.prob)continue;}
  const ev={...e,tr:e.tr,n:e.n.slice(),offset:(e.at-offset)*dt,d:e.span*dt};delete ev.bucket;
  const velocity=routeAmount7('notes.velocity',qt,s),gate=routeAmount7('notes.gate',qt,s),tension=routeAmount7('notes.tension',qt,s),oct=routeAmount7('notes.octave',qt,s);if(velocity)ev.v=clamp(ev.v*(1+velocity),.01,1);if(gate)ev.d=Math.max(.015,ev.d*(1+gate));
  if(!trackMap[e.id].drum&&!cond?.anchor){if(oct)ev.n=ev.n.map(n=>clamp(n+Math.round(oct*2)*12,12,119));if(tension>0){const r=rng(s.seed+'|tension|'+e.hash+'|'+qt);if(r()<tension)ev.n=ev.n.map(n=>clamp(n+(r()<.5?1:-1),12,119));}}
  out.push(ev);
 }
 return out.sort((a,b)=>a.offset-b.offset);
};
function bake7(track=ui.selected,{replace=true}={}){commit7(()=>{const s=projectSnapshot7(state);s.studio.playMode='phrase';s.structure='loop';s.studio.routes=s.studio.routes.filter(r=>!r.target.startsWith('notes.'));const dt=stepSeconds(s),tr=s.tracks.find(t=>t.id===track),notes=[];for(let st=0;st<s.bars*16;st++)for(const e of scoreEvents(st,s))if(e.id===track)for(let i=0;i<e.n.length;i++)notes.push(makeNote7({t:clamp(st+(e.offset+i*e.strum)/dt,0,s.bars*16-.001),p:e.n[i]-(trackMap[track].drum?0:tr.octave*12),d:e.d/dt,v:e.v},notes.length));
 const source=ensureClip7(track);const c=createClip7(track,notes,{name:trackMap[track].short+' · interpretado',length:s.bars*16,timing:'baked',origin:{label:effectiveMode(tr),seed:s.seed,sourceClip:source.id},recipe:{arp:{...clone(tr.arp),enabled:false},performance:{...clone(tr.performance),mode:'original'}}});if(replace){studio7().bindings[track]=c.id;const dst=state.tracks.find(t=>t.id===track);dst.arp.enabled=false;dst.performance.mode='original';syncProjection7(track);ui7.selection.clear();}},{message:'Interpretación convertida en notas independientes. La fuente sigue guardada.'});}
function transform7(kind,{amount=.65,selection=true}={}){commit7(()=>{const c=ensureClip7(),tr=state.tracks.find(t=>t.id===ui.selected),chosen=c.notes.filter(n=>(!selection||!ui7.selection.size||ui7.selection.has(n.id))&&!n.anchor),r=rng(state.seed+'|transform7|'+kind+'|'+state.mutation);state.mutation++;if(!chosen.length)return;const start=Math.min(...chosen.map(n=>n.t)),end=Math.max(...chosen.map(n=>n.t+n.d)),pivot=chosen.reduce((v,n)=>v+n.p,0)/chosen.length,dt=stepSeconds(),transitionEnd=selection&&ui7.selection.size?Math.min(c.length,end):c.length;
 for(const n of chosen){if(kind==='pitches')n.p=trackMap[tr.id].drum?n.p:clamp(nearestScale(n.p+Math.round((r()-.5)*14*amount)),24,108);if(kind==='rhythm')n.t=clamp(Math.round((n.t+(r()-.5)*5*amount)/ui7.grid)*ui7.grid,0,c.length-.0625);if(kind==='articulation'){n.v=clamp(n.v+(r()-.5)*.55*amount,.06,1);n.d=clamp(n.d*(.6+r()*.85),.0625,c.length-n.t);}if(kind==='invert'&&!trackMap[tr.id].drum)n.p=clamp(nearestScale(2*pivot-n.p),24,108);if(kind==='reverse')n.t=clamp(start+end-n.t-n.d,0,c.length-.0625);if(kind==='quantize')n.t=clamp(Math.round(n.t/ui7.grid)*ui7.grid,0,c.length-.0625);if(kind==='humanize'){n.t=clamp(n.t+(r()-.5)*.025/dt,0,c.length-.0625);n.v=clamp(n.v+(r()-.5)*.14,.03,1);}if(kind==='transition'&&n.t>=Math.max(start,transitionEnd-32)){n.d=Math.min(n.d,1);n.v=clamp(n.v*(.7+.3*(n.t-(transitionEnd-32))/32),.1,1);if(!trackMap[tr.id].drum)n.p=nearestScale(n.p+(n.t>=transitionEnd-16?2:0));}}
 if(kind==='answer'){const shift=Math.ceil((end-start)/4)*4;for(const n of chosen){const t=n.t+shift;if(t<c.length)c.notes.push({...clone(n),id:id7('n'),t,p:trackMap[tr.id].drum?n.p:clamp(nearestScale(n.p+(r()<.5?-2:2)),24,108),v:n.v*.82,anchor:false});}}
 if(kind==='transition'&&!trackMap[tr.id].drum){const pitch=chordRoot(state.bars-1,state,tr.id==='bass'?2:4);c.notes.push(makeNote7({id:id7('n'),t:Math.max(start,transitionEnd-2),p:clamp(pitch,24,108),d:1.8,v:.7}));}
 c.notes.sort((a,b)=>a.t-b.t);syncProjection7();},{message:'Transformación aplicada; anclas conservadas.'});}
function reconcileCandidate7(before,c,kind='variation'){const old=studio7(before);if(kind==='song'||c.kind==='song'){const st=emptyStudio7();st.bank=clone(old.bank);const free=Object.keys(st.bank).find(k=>!st.bank[k]);if(free)st.bank[free]={name:before.session?.name||'Antes de generar',favorite:false,project:projectSnapshot7(before)};if(c.config?.respectLocks!==false)for(const t of before.tracks)if(t.locked&&old.bindings[t.id]){const id=old.bindings[t.id];st.clips[id]=clone(old.clips[id]);st.bindings[t.id]=id;}c.state.studio=st;}else{c.state.studio=clone(old);for(const tr of before.tracks){const after=c.state.tracks.find(t=>t.id===tr.id);if((!tr.locked||c.config?.respectLocks===false)&&(!sameJSON(before.patterns[tr.id],c.state.patterns[tr.id])||before.bars!==c.state.bars)){delete c.state.studio.bindings[tr.id];}}saveSection7(c.state);}return c;}
const randomBefore7=makeRandomCandidate;makeRandomCandidate=function(before,...args){return reconcileCandidate7(before,randomBefore7(before,...args),args[2]);};
const chaosBefore7=makeChaosCandidate5;makeChaosCandidate5=function(before,...args){return reconcileCandidate7(before,chaosBefore7(before,...args),'variation');};

const generateAllBefore7=generateAll;generateAll=function(options={}){if(state.studio)for(const t of state.tracks)if(!(options.respectLocks!==false&&t.locked))delete state.studio.bindings[t.id];return generateAllBefore7(options);};

/* Expressive voices and sample-clock automation. Native audio nodes remain the DSP engine. */
const expressionDefault7=()=>({enabled:false,body:1,attack:1,wire:1,dynamic:60,glide:85,legato:true});
for(const[id,name,kind,channel]of [['kick7','Bombo · cuerpo / transitorio','kick','kick'],['snare7','Caja · membrana / bordonera','snare','snare'],['mono7','Bajo mono · legato','bass','bass'],['ep7','Piano eléctrico · expresión','keys','keys']]){sounds[id]={name,kind,engine:'UMBRA 7 · SÍNTESIS EXPRESIVA'};trackMap[channel].voices.push(id);}trackMap.arp.voices.push('ep7');trackMap.lead.voices.push('ep7');
const baseTrackBefore7=baseTrack;baseTrack=function(d){return{...baseTrackBefore7(d),expression:expressionDefault7()};};
function validateExpression7(src){const e={...expressionDefault7(),...src};for(const[k,lo,hi]of[['body',0,2],['attack',0,2],['wire',0,2],['dynamic',0,100],['glide',0,500]])if(!Number.isFinite(e[k])||e[k]<lo||e[k]>hi)throw Error('Expresión de instrumento inválida.');if(typeof e.enabled!=='boolean'||typeof e.legato!=='boolean')throw Error('Interruptor de expresión inválido.');return e;}
const validateStudioBeforeAudio7=validateProject;validateProject=function(p){const s=validateStudioBeforeAudio7(p);function restore(dst,src){dst.tracks.forEach(t=>t.expression=validateExpression7(src.tracks.find(x=>x.id===t.id)?.expression));for(const sec of dst.studio.sections){const original=src.studio.sections.find(x=>x.id===sec.id);sec.frame.tracks.forEach(t=>t.expression=validateExpression7(original.frame.tracks.find(x=>x.id===t.id)?.expression));}for(const [track,bank]of Object.entries(dst.studio.soundAB))for(const slot of ['A','B'])if(bank[slot])bank[slot].expression=validateExpression7(src.studio.soundAB?.[track]?.[slot]?.expression);for(const slot of ['A','B','C','D'])if(dst.studio.bank[slot])restore(dst.studio.bank[slot].project,src.studio.bank[slot].project);}restore(s,p.state);return s;};
const drumBefore7=SynthEngine.prototype.drum;
SynthEngine.prototype.drum=function(id,tr,t,velocity,h){const ex={...expressionDefault7(),...tr.expression};if(!['kick7','snare7'].includes(tr.sound)&&!ex.enabled)return drumBefore7.call(this,id,tr,t,velocity,h);if(!['kick','snare'].includes(id))return drumBefore7.call(this,id,tr,t,velocity,h);
 const tune=Math.pow(2,tr.tune/12),decay=.18+tr.decay*.007,end=t+decay+.08,v=this.voice(id,t,end),out=this.channels[id].input;
 const envelope=(peak,attack,duration)=>{const g=v.node('createGain');g.gain.setValueAtTime(.00001,t);g.gain.linearRampToValueAtTime(Math.max(.00001,peak*velocity),t+attack);g.gain.exponentialRampToValueAtTime(.00001,t+duration);g.connect(out);return g;};
 if(id==='kick'){const g=envelope(.85*ex.body,.0015,decay),o=v.osc('sine',170*tune,g);o.frequency.exponentialRampToValueAtTime(43*tune,t+.044);o.frequency.exponentialRampToValueAtTime(40*tune,end-.02);const punch=envelope(.14*ex.attack,.001,.032);const b=v.node('createBiquadFilter');b.type='bandpass';b.frequency.value=650+tr.tone*16;b.Q.value=.7;b.connect(punch);v.noise(b,(h%997)/997);v.osc('triangle',110*tune,punch,.25);}
 else {const g=envelope(.25*ex.body,.0015,Math.min(decay,.22)),o=v.osc('sine',225*tune,g);o.frequency.exponentialRampToValueAtTime(176*tune,t+.027);v.osc('sine',299*tune,g,.38);const wire=envelope(.36*ex.wire,.001,.08+tr.decay*.006),hp=v.node('createBiquadFilter'),lp=v.node('createBiquadFilter');hp.type='highpass';hp.frequency.value=1100;lp.type='lowpass';lp.frequency.value=2400+tr.tone*90;hp.connect(lp).connect(wire);v.noise(hp,(h%991)/991);const click=envelope(.06*ex.attack,.001,.017);v.noise(click,(h%577)/577);}
 v.finish();};
const tonalBefore7=SynthEngine.prototype.tonal;
SynthEngine.prototype.tonal=function(id,tr,midi,t,velocity,duration,h){const ex={...expressionDefault7(),...tr.expression};if(tr.sound==='mono7'){
 if(!this.mono7)this.mono7={};let m=this.mono7[id];if(!m){const osc=this.N('createOscillator'),sub=this.N('createOscillator'),mix=this.N('createGain'),lp=this.N('createBiquadFilter'),gain=this.N('createGain');osc.type='sawtooth';sub.type='sine';mix.gain.value=.16;lp.type='lowpass';lp.Q.value=.7;gain.gain.value=0;osc.connect(mix);sub.connect(mix);mix.connect(lp).connect(gain).connect(this.channels[id].input);osc.start(this.ctx.currentTime);sub.start(this.ctx.currentTime);this.fxOsc.push(osc,sub);m=this.mono7[id]={osc,sub,lp,gain,end:0,freq:110,peak:0};}
 const freq=midiHz(midi+tr.tune),legato=ex.legato&&m.end>=t-.008,glide=Math.min(duration*.8,ex.glide/1000),peak=.9*velocity;m.osc.frequency.cancelScheduledValues(t);m.sub.frequency.cancelScheduledValues(t);for(const [o,f]of [[m.osc,freq],[m.sub,freq/2]]){o.frequency.setValueAtTime(legato?m.freq*(o===m.sub?.5:1):f,t);o.frequency.exponentialRampToValueAtTime(f,t+Math.max(.001,legato?glide:.001));}
 m.gain.gain.cancelScheduledValues(t);m.gain.gain.setValueAtTime(legato?m.peak:.00001,t);m.gain.gain.linearRampToValueAtTime(peak,t+(legato?.013:.004+tr.attack*.0004));m.gain.gain.setValueAtTime(peak,t+duration);m.gain.gain.exponentialRampToValueAtTime(.00001,t+duration+.045);m.lp.frequency.cancelScheduledValues(t);m.lp.frequency.setValueAtTime(350+tr.tone*55*(.5+velocity*.5),t);m.lp.frequency.exponentialRampToValueAtTime(170+tr.tone*13,t+Math.max(.05,duration));m.end=t+duration;m.freq=freq;m.peak=peak;return;
 }
 if(tr.sound==='ep7'){const f=midiHz(midi+tr.tune),dyn=ex.dynamic/100,d=.25+tr.decay*.018,end=t+duration+d,v=this.voice(id,t,end),g=v.node('createGain'),lp=v.node('createBiquadFilter');lp.type='lowpass';lp.frequency.value=Math.min(this.ctx.sampleRate*.46,1200+tr.tone*90*(.4+velocity*dyn));g.gain.setValueAtTime(.00001,t);g.gain.linearRampToValueAtTime(.27*velocity,t+.003);g.gain.exponentialRampToValueAtTime(.036*velocity,t+duration);g.gain.exponentialRampToValueAtTime(.00001,end-.005);lp.connect(g).connect(this.channels[id].input);const carrier=v.osc('sine',f,lp,.73),mg=v.node('createGain');mg.gain.setValueAtTime(f*(.22+velocity*velocity*dyn*4.5),t);mg.gain.exponentialRampToValueAtTime(f*.03,t+Math.min(.7,duration+.1));mg.connect(carrier.frequency);v.osc('sine',f*1.003,mg);v.osc('sine',f,lp,.22,-1.7);const strike=v.node('createGain');strike.gain.setValueAtTime(.08*velocity*velocity,t);strike.gain.exponentialRampToValueAtTime(.00001,t+.09);strike.connect(lp);v.osc('sine',f*6.91,strike);v.finish();return;}
 return tonalBefore7.call(this,id,tr,midi,t,velocity,duration,h);
};
function baseParameter7(target,frame){if(target.startsWith('macro.'))return studio7(frame).macros[target.split('.')[1]];const [id,key]=target.split('.');if(id==='master')return frame.master[key];const tr=frame.tracks.find(t=>t.id===id);return key==='cutoff'?(id==='bass'?180+Math.pow(tr.tone/100,2)*9000:900+Math.pow(tr.tone/100,1.7)*19000):tr[key];}
function processedParameter7(target,at,s=state,frame=null){frame=frame||locateFrame7(at,s).frame;let value=autoValue7(target,at,baseParameter7(target,frame),s);const [id,key]=target.split('.');if(target==='master.cutoff')value*=Math.pow(2,routeAmount7(target,at,s)*3);if(id!=='master'&&id!=='macro'){const change=routeAmount7('all.'+key,at,s);if(key==='pan')value+=change;else if(['send','delay'].includes(key))value+=change*.6;else if(['chorus','phaser'].includes(key))value+=change*60;}const def=targets7()[target];return clamp(value,def.min,def.max);}
SynthEngine.prototype.automate7=function(step,time){const s=this.state,st=studio7(s),loc=locateFrame7(step,s),f=loc.frame,dt=stepSeconds(s),frameChanged=this.frame7!==f._frame7;this.frame7=f._frame7;const active=st.automation.some(x=>x.enabled)||st.routes.some(r=>macroDelta7(r.macro,step,s)!==0);if(!active&&!loc.section&&!this.autoWas7)return;this.autoWas7=active;
 const parameter=(target)=>{const[id,k]=target.split('.');if(id==='master')return k==='cutoff'?this.masterFilter.frequency:k==='reverb'?this.reverbWet.gain:this.delayWet.gain;const ch=this.channels[id];return k==='volume'?ch.gain.gain:k==='pan'?ch.pan.pan:k==='cutoff'?ch.filter.frequency:k==='send'?ch.rev.gain:k==='delay'?ch.del.gain:k==='phaser'?ch.phaser.gain:ch.chorus.gain;};
 // Emit only changed values. Re-scheduling every static channel parameter for every
 // subdivision produces huge AudioParam histories in long offline arrangements.
 if(!this.autoValues7)this.autoValues7=new Map();
 for(const target of Object.keys(targets7())){if(target.startsWith('macro.'))continue;const [id,key]=target.split('.'),p=parameter(target);if(!p)continue;const factor=id==='master'&&key==='reverb'?1.5/100:id==='master'&&key==='delay'?.9/100:key==='phaser'||key==='chorus'?1/100:1;
  let previous=this.autoValues7.get(target);const directStep=st.automation.some(a=>a.enabled&&a.target===target&&a.shape==='step');
  for(let j=0;j<=4;j++){let value=processedParameter7(target,step+j/4,s,f);if(key==='volume'&&!audible(f.tracks.find(x=>x.id===id),f))value=0;value*=factor;if(key==='cutoff')value=Math.min(value,this.ctx.sampleRate*.49);const at=Math.max(0,time+j*dt/4);
   if(previous===undefined){p.setValueAtTime(value,at);previous=value;continue;}
   if(Math.abs(value-previous)<1e-8)continue;
   const stepMacro=st.routes.some(r=>(r.target===target||r.target==='all.'+key)&&st.automation.some(a=>a.enabled&&a.target==='macro.'+r.macro&&a.shape==='step'));
   if(j===0||directStep||stepMacro)p.setValueAtTime(value,at);else{p.setValueAtTime(previous,Math.max(0,time+(j-1)*dt/4));p.linearRampToValueAtTime(value,at);}previous=value;
  }this.autoValues7.set(target,previous);
 }
 if(frameChanged&&loc.section){for(const tr of f.tracks){const ch=this.channels[tr.id];for(const [param,v]of [[ch.hp.frequency,tr.highpass],[ch.lowEQ.gain,tr.lowEQ],[ch.highEQ.gain,tr.highEQ],[ch.filter.Q,.5+tr.resonance*.04]])param.setValueAtTime(v,Math.max(0,time));}}
};
// Manual editing cancels native parameter schedules; the next audio step must reassert Read lanes.
const updateBeforeAutomation7=SynthEngine.prototype.update;
SynthEngine.prototype.update=function(...args){this.autoValues7?.clear();return updateBeforeAutomation7.apply(this,args);};
// The master is still driven when tapping stems. Returns receive the full original session.
const initBefore7=SynthEngine.prototype.initV2;
/* Version bank and independent song sections. Snapshots never contain recursive banks. */
function storeBank7(slot,project=null,name=null){if(!['A','B','C','D'].includes(slot))return;commit7(()=>{const current=studio7(),p=project?projectSnapshot7(project):projectSnapshot7(state);current.bank[slot]={name:name||p.session?.name||'Versión '+slot,favorite:current.bank[slot]?.favorite||false,project:p};},{message:'Versión '+slot+' guardada. La sesión sigue intacta.'});}
function loadBank7(slot){const saved=studio7().bank[slot];if(!saved)return;stopBankPreview7();commit7(()=>{const bank=clone(studio7().bank),next=clone(saved.project);next.studio.bank=bank;next.master.volume=state.master.volume;state=next;ui.bar=0;ui7.selection.clear();},{restart:true,message:'Versión '+slot+' cargada. Deshacer recupera la anterior.'});}
function copyPhraseIntoTrack7(source,destination,track,adapt='keep'){const st=studio7(destination),src={...source,structure:'loop',studio:{...studio7(source),playMode:'phrase'}},srcTr=src.tracks.find(t=>t.id===track),dstTr=destination.tracks.find(t=>t.id===track),dt=stepSeconds(src),ns=[];
 for(let i=0;i<src.bars*16;i++)for(const e of scoreEvents(i,src))if(e.id===track)for(let j=0;j<e.n.length;j++){let pitch=e.n[j];if(!trackMap[track].drum){if(adapt!=='keep')pitch+=destination.root-src.root;if(adapt==='scale')pitch=nearestScale(pitch,destination);}ns.push(makeNote7({t:clamp(i+(e.offset+j*e.strum)/dt,0,src.bars*16-.001),p:clamp(pitch-srcTr.octave*12,12,119),d:e.d/dt,v:e.v},ns.length));}
 const tr={...clone(srcTr),mute:dstTr.mute,solo:dstTr.solo,locked:dstTr.locked};tr.arp.enabled=false;tr.performance.mode='original';destination.tracks=destination.tracks.map(t=>t.id===track?tr:t);const c=createClip7(track,ns,{name:trackMap[track].short+' · comp',length:src.bars*16,timing:'baked',origin:{label:'Comping',seed:src.seed,sourceClip:null},recipe:{arp:clone(tr.arp),performance:clone(tr.performance)}},destination);st.bindings[track]=c.id;syncProjection7(track,destination);}
function ensureSections7(){const st=studio7();if(st.sections.length)return;const sec={id:id7('sec'),name:'Tema A',bars:state.bars,repeat:1,frame:frame7()};st.sections.push(sec);st.selectedSection=sec.id;state.structure='loop';}
function freezeFrame7(frame,name,action='copy'){const st=studio7(),s={...state,...clone(frame),structure:'loop',studio:{...st,bindings:clone(frame.bindings),routes:st.routes.filter(r=>!r.target.startsWith('notes.')),sections:[],selectedSection:null,playMode:'phrase'}},dt=stepSeconds(s),buckets=Object.fromEntries(trackDefs.map(t=>[t.id,[]]));for(let i=0;i<s.bars*16;i++)for(const e of scoreEvents(i,s))for(let j=0;j<e.n.length;j++)buckets[e.id].push(makeNote7({t:clamp(i+(e.offset+j*e.strum)/dt,0,s.bars*16-.001),p:clamp(e.n[j]-(trackMap[e.id].drum?0:e.tr.octave*12),12,119),d:e.d/dt,v:e.v},buckets[e.id].length));
 for(const tr of s.tracks){if(tr.locked)continue;const current=boundClip7(tr.id,s),notes=current&&effectiveMode(tr)==='original'?clone(current.notes):buckets[tr.id],r=rng(s.seed+'|section|'+name+'|'+tr.id),length=s.bars*16;
 if(action==='develop'&&['lead','arp','perc'].includes(tr.id)){for(const n of notes.slice().filter(n=>n.t>=length-32&&n.t<length-16&&!n.anchor)){if(n.t+8<length)notes.push({...n,id:id7('n'),t:n.t+8,p:trackMap[tr.id].drum?n.p:nearestScale(n.p+2,s),v:n.v*.75});}}
 if(action==='contrast'){for(const n of notes)if(!n.anchor){if(!trackMap[tr.id].drum)n.p=clamp(nearestScale(n.p+([0,2,4][Math.floor(r()*3)])*(tr.id==='bass'?-1:1),s),24,108);n.t=mod(n.t+(trackMap[tr.id].drum?2:1),length);}if(['keys','lead'].includes(tr.id))tr.sound=trackMap[tr.id].voices[Math.floor(r()*trackMap[tr.id].voices.length)];}
 if(action==='reduce'||action==='intro'){for(let i=notes.length-1;i>=0;i--){const n=notes[i];if(n.anchor)continue;if(['snare','open'].includes(tr.id)||tr.id==='kick'&&n.t<length/2||r()<.3)notes.splice(i,1);else n.v*=.8;}if(['pad','keys'].includes(tr.id))for(const n of notes)n.d=Math.min(length-n.t,n.d*1.3);}
 if(action==='close'){for(let i=notes.length-1;i>=0;i--)if(!notes[i].anchor&&notes[i].t>length-4)notes.splice(i,1);if(!trackMap[tr.id].drum)notes.push(makeNote7({id:id7('n'),t:length-4,p:clamp(s.root+(tr.id==='bass'?36:60),24,108),d:3.8,v:.65}));else if(tr.id==='perc'||tr.id==='snare')notes.push(...[length-8,length-6,length-5].map((t,i)=>makeNote7({id:id7('n'),t,p:trackMap[tr.id].midi,d:.3,v:.4+i*.1})));}
 tr.arp.enabled=false;tr.performance.mode='original';const c=createClip7(tr.id,notes,{name:name+' / '+trackMap[tr.id].short,length,timing:'baked',origin:{label:action,seed:s.seed,sourceClip:current?.id||null},recipe:{arp:clone(tr.arp),performance:clone(tr.performance)}});s.studio.bindings[tr.id]=c.id;s.patterns[tr.id]=projection7(c,s.bars);}
 return frame7(s);}
function addSection7(action='copy'){commit7(()=>{ensureSections7();saveSection7();const st=studio7();if(st.sections.length>=12)throw Error('Esta vista admite hasta 12 secciones.');const current=st.sections.find(s=>s.id===st.selectedSection),labels={copy:current.name+' · copia',develop:'Desarrollo',contrast:'Tema B',reduce:'Ruptura',close:'Cierre',intro:'Intro'},name=labels[action]||'Sección';let f=action==='copy'?clone(current.frame):freezeFrame7(current.frame,name,action);
 if(action==='copy'){for(const [track,id]of Object.entries(f.bindings)){const c=st.clips[id],copy=createClip7(track,c.notes,{...c,name:c.name+' · copia'});f.bindings[track]=copy.id;}}
 const sec={id:id7('sec'),name,bars:f.bars,repeat:1,frame:f};st.sections.splice(st.sections.indexOf(current)+1,0,sec);},{message:'Sección independiente creada.'});renderSong7();}
function structureSong7(){commit7(()=>{ensureSections7();saveSection7();const st=studio7(),source=frame7(),names=[['Intro','intro'],['Tema A','copy'],['Variación A′','develop'],['Ruptura','reduce'],['Tema B','contrast'],['Cierre','close']];if(st.sections.length>1){toast('La estructura se añade después de las secciones existentes.');}const sections=names.map(([name,action])=>{const f=freezeFrame7(source,name,action);return{id:id7('sec'),name,bars:f.bars,repeat:1,frame:f};});if(st.sections.length+6>12)throw Error('No hay espacio para seis secciones más.');if(st.sections.length===1){st.sections=[];st.selectedSection=null;}st.sections.push(...sections);st.playMode='song';const sec=sections[0];for(const k of frameFields7)if(sec.frame[k]!==undefined)state[k]=clone(sec.frame[k]);st.bindings=clone(sec.frame.bindings);st.selectedSection=sec.id;ui.bar=0;},{restart:true,message:'Intro, temas, ruptura y cierre creados con material independiente.'});}
function setSongMode7(mode){commit7(()=>{if(mode==='song')ensureSections7();studio7().playMode=mode;},{restart:true});}
function dropClip7(from,to,track,copy=true){if(from===to)return;commit7(()=>{saveSection7();const st=studio7(),a=st.sections.find(x=>x.id===from),b=st.sections.find(x=>x.id===to);if(!a||!b)return;if(b.frame.tracks.find(t=>t.id===track).locked)throw Error('La pista de destino está bloqueada.');const fs=frameState7(a),src=ensureClip7(track,fs),cloneClip=createClip7(track,src.notes,{...src,name:b.name+' / '+trackMap[track].short});b.frame.bindings[track]=cloneClip.id;const tr=b.frame.tracks.find(t=>t.id===track);if(cloneClip.recipe){tr.arp=clone(cloneClip.recipe.arp);tr.performance=clone(cloneClip.recipe.performance);}if(!copy){const silent=createClip7(track,[],{name:'Silencio',length:a.bars*16,timing:'baked'});a.frame.bindings[track]=silent.id;}for(const sec of [a,b]){const clip=st.clips[sec.frame.bindings[track]];sec.frame.patterns[track]=projection7(clip,sec.bars);if(clip.timing==='baked'){const t=sec.frame.tracks.find(t=>t.id===track);t.arp.enabled=false;t.performance.mode='original';}}const active=st.sections.find(x=>x.id===st.selectedSection);st.bindings=clone(active.frame.bindings);state.tracks=clone(active.frame.tracks);state.patterns=clone(active.frame.patterns);},{message:copy?'Clip copiado como variante independiente.':'Clip movido; el origen queda en silencio.'});}
/* Curves and explicit macro routes. No invisible parameters or audio-clock changes. */
function ensureLane7(target){const st=studio7();let lane=st.automation.find(a=>a.target===target);if(lane){lane.enabled=true;return lane;}if(st.automation.length>=64)throw Error('Máximo de 64 curvas por sesión.');const def=targets7()[target];if(!def)throw Error('Parámetro no automatizable.');const base=baseParameter7(target,state),v=norm7(base,def);lane={id:id7('lane'),target,enabled:true,shape:'linear',points:[{t:0,v},{t:Math.max(1,totalBars()*16-1),v}]};st.automation.push(lane);return lane;}
function automateControl7(target){commit7(()=>{const lane=ensureLane7(target);ui7.lane=lane.id;});setStudioView7('automation');}
function selectedLane7(){const st=studio7();return st.automation.find(x=>x.id===ui7.lane)||st.automation[0]||null;}
function soundTestScore7(track,slot){const s=clone(state),ab=studio7().soundAB[track]?.[slot];if(!ab)return null;s.studio=emptyStudio7();s.structure='loop';s.bars=1;s.density=100;s.master.reverb=0;s.master.delay=0;s.tracks=s.tracks.map(t=>({...t,...(t.id===track?clone(ab):{}),mute:t.id!==track,solo:false,arp:{...t.arp,enabled:false},performance:{...t.performance,mode:'original'}}));s.patterns=Object.fromEntries(trackDefs.map(d=>[d.id,emptyPattern(1)]));for(const t of [0,4,8,12])s.patterns[track][0][t]={n:[trackMap[track].drum?trackMap[track].midi:track==='bass'?40:64],d:3,v:.7};return s;}
/* Long offline renders keep one continuous graph and add only two bars ahead.
   Suspending the native offline clock is not audio slicing: delay, reverb, LFO and
   compressor state remain intact. Short legacy renders retain their original path. */
const offlineBefore7=renderOffline;
renderOffline=async function(s,{loops=1,tail='tail',sampleRate=44100,onProgress=()=>{},cancelled=()=>false}={}){
 const steps=totalBars(s)*16*(loops+(tail==='loop'?1:0)),Offline=window.OfflineAudioContext||window.webkitOfflineAudioContext;
 if(steps<=128||!Offline||typeof Offline.prototype.suspend!=='function'||typeof Offline.prototype.resume!=='function')return offlineBefore7(s,{loops,tail,sampleRate,onProgress});
 const cycle=totalSeconds(s),preroll=tail==='loop'?1:0,offset=.08,dt=stepSeconds(s),seconds=offset+cycle*(loops+preroll)+(tail==='tail'?6:.03);
 if(seconds>180.05)throw Error('El render supera 180 segundos, incluido el preroll.');
 let budget=0;for(let i=0;i<totalBars(s)*16;i++)for(const e of scoreEvents(i,s))budget+=e.n.length;
 if(budget*(loops+preroll)>18000)throw Error('El render supera 18.000 voces. Reducí repeticiones, ratchets o duración.');
 const context=new Offline(2,Math.ceil(seconds*sampleRate),sampleRate),en=new SynthEngine(context,s,{offline:true}),batch=32;let rendering=null;
 const schedule=(from,to)=>{for(let i=from;i<to;i++){en.automate7(i,offset+i*dt);for(const e of scoreEvents(i,s))en.schedule(e,offset+i*dt);}};
 try{
  let next=Math.min(batch,steps);schedule(0,next);let pause=next<steps?context.suspend(offset+next*dt-.04):null;rendering=context.startRendering();
  while(pause){await pause;if(cancelled())throw Error('Exportación cancelada.');for(const v of en.voices)if(v.end<context.currentTime-.01)v.cleanup();const to=Math.min(next+batch,steps);schedule(next,to);next=to;
   if(next===steps&&tail==='loop')for(const e of scoreEvents(steps,s))en.schedule(e,offset+steps*dt);
   pause=next<steps?context.suspend(offset+next*dt-.04):null;onProgress('Renderizando compás '+Math.min(Math.floor(next/16),steps/16)+' / '+Math.ceil(steps/16));await context.resume();
  }
  const buffer=await rendering,start=Math.round((offset+cycle*preroll)*sampleRate),frames=Math.min(buffer.length-start,Math.round((cycle*loops+(tail==='tail'?6:0))*sampleRate));return{buffer,start,frames,sampleRate,seconds:frames/sampleRate};
 }catch(e){if(context.state==='suspended')context.resume().catch(()=>{});rendering?.catch(()=>{});throw e;}finally{en.dispose();}
};
/* MIDI and a local ZIP writer. No external dependency, remote service or sample assets. */
function midi7(s,loops=1){const ppq=960,stepTicks=ppq/4,total=totalBars(s)*16*loops,end=Math.round(total*stepTicks),enc=new TextEncoder(),u16=n=>[(n>>8)&255,n&255],u32=n=>[(n>>>24)&255,(n>>>16)&255,(n>>>8)&255,n&255],vlq=n=>{let a=[n&127];while((n>>>=7)>0)a.unshift((n&127)|128);return a;},meta=(type,text)=>{const b=typeof text==='string'?Array.from(enc.encode(text)):text;return[255,type,...vlq(b.length),...b];},chunk=evs=>{evs.sort((a,b)=>a.t-b.t||a.order-b.order);let last=0,out=[];for(const e of evs){const t=Math.max(last,Math.round(e.t));out.push(...vlq(t-last),...e.data);last=t;}out.push(0,255,47,0);return new Uint8Array([77,84,114,107,...u32(out.length),...out]);};
 const tempo=Math.round(60000000/s.bpm),head=[{t:0,order:0,data:meta(3,'UMBRA 8 · '+(s.session?.name||s.seed))},{t:0,order:1,data:meta(81,[(tempo>>16)&255,(tempo>>8)&255,tempo&255])},{t:0,order:1,data:meta(88,[4,2,24,8])}];if(studio7(s).playMode==='song')for(let loop=0;loop<loops;loop++)for(const sec of sectionRanges7(s))head.push({t:(loop*totalBars(s)*16+sec.start)*stepTicks,order:2,data:meta(6,sec.name)});head.push({t:end,order:8,data:meta(1,'End')});const chunks=[chunk(head)],buckets=Object.fromEntries(trackDefs.map(t=>[t.id,[]])),dt=stepSeconds(s);
 for(let st=0;st<total;st++)for(const e of scoreEvents(st,s))for(let j=0;j<e.n.length;j++){const start=clamp(Math.round((st+(e.offset+j*e.strum)/dt)*stepTicks),0,end-1),finish=clamp(Math.round(start+e.d/dt*stepTicks),start+1,end),pitch=trackMap[e.id].drum?({clap:39,clapWide:39,ride:51,tom:45,tabla:66,claves:75,metalPerc:56,rim:37,conga:64,cowbell:56,wood:76})[e.tr.sound]??trackMap[e.id].midi:e.n[j];buckets[e.id].push({start,finish,pitch,v:clamp(Math.round(e.v*e.tr.volume*106),1,127)});}
 const programs={electric:4,softkeys:0,organbass:32,pluck:24,tape:89,choir:52,bell:14,marimba:12,chip:80,sinelead:80,reed:68,fmPluck:10,brass:62,syncLead:80,mono7:38,ep7:4,velvetEP:4,pianoModal:0,nylon:24,reese:38,rubber:39,sub:38,analog:38,fmbass:39,acid:38,flute:73,glass:10,kalimba:108,dulcimer:15,supersaw:81,airPad:89,pwmPad:90,strings:48,organ:16};
 for(let i=0;i<trackDefs.length;i++){const def=trackDefs[i],tr=s.tracks.find(t=>t.id===def.id),ch=def.drum?9:i-5,events=[{t:0,order:0,data:meta(3,def.name)}];if(!def.drum){events.push({t:0,order:1,data:[192|ch,programs[tr.sound]??0]},{t:0,order:2,data:[176|ch,10,Math.round((tr.pan+1)*63.5)]},{t:0,order:2,data:[176|ch,7,100]});if(studio7(s).playMode==='song')for(let loop=0;loop<loops;loop++)for(const sec of sectionRanges7(s)){const f=frameState7(sec,s),t=f.tracks.find(z=>z.id===tr.id);events.push({t:(loop*totalBars(s)*16+sec.start)*stepTicks,order:1,data:[192|ch,programs[t.sound]??0]});}
  for(const [key,cc]of [['pan',10],['cutoff',74],['send',91],['chorus',93]])if(studio7(s).automation.some(a=>a.enabled&&a.target===tr.id+'.'+key)){for(let st=0;st<=total;st+=4){const value=processedParameter7(tr.id+'.'+key,st,s),target=targets7()[tr.id+'.'+key];events.push({t:st*stepTicks,order:2,data:[176|ch,cc,Math.round(norm7(value,target)*127)]});}}
 }
 const ns=buckets[tr.id].sort((a,b)=>a.start-b.start),prev=new Map();for(const n of ns){const p=prev.get(n.pitch);if(p&&p.finish>n.start)p.finish=Math.max(p.start+1,n.start);prev.set(n.pitch,n);}for(const n of ns)events.push({t:n.start,order:5,data:[144|ch,n.pitch,n.v]},{t:n.finish,order:4,data:[128|ch,n.pitch,0]});events.push({t:end,order:9,data:[176|ch,123,0]});chunks.push(chunk(events));}
 return new Blob([new Uint8Array([77,84,104,100,...u32(6),...u16(1),...u16(chunks.length),...u16(ppq)]),...chunks],{type:'audio/midi'});}
midiFile=midi7;
const crcTable7=Uint32Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=(n&1)?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc7(bytes){let crc=0xffffffff;for(let i=0;i<bytes.length;i++)crc=crcTable7[(crc^bytes[i])&255]^(crc>>>8);return(crc^0xffffffff)>>>0;}
async function zip7(files){const parts=[],central=[],enc=new TextEncoder();let offset=0,size=0;for(const f of files){const name=enc.encode(f.name),data=new Uint8Array(await f.blob.arrayBuffer()),crc=crc7(data),local=new Uint8Array(30+name.length),v=new DataView(local.buffer);v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint32(14,crc,true);v.setUint32(18,data.length,true);v.setUint32(22,data.length,true);v.setUint16(26,name.length,true);local.set(name,30);parts.push(local,data);const c=new Uint8Array(46+name.length),cv=new DataView(c.buffer);cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);cv.setUint16(8,0x800,true);cv.setUint32(16,crc,true);cv.setUint32(20,data.length,true);cv.setUint32(24,data.length,true);cv.setUint16(28,name.length,true);cv.setUint32(42,offset,true);c.set(name,46);central.push(c);offset+=local.length+data.length;size+=c.length;await yieldUI();}
 const end=new Uint8Array(22),ev=new DataView(end.buffer);ev.setUint32(0,0x06054b50,true);ev.setUint16(8,files.length,true);ev.setUint16(10,files.length,true);ev.setUint32(12,size,true);ev.setUint32(16,offset,true);return new Blob([...parts,...central,end],{type:'application/zip'});}
async function createSession7(source,{mode='wet',sampleRate=44100,onProgress=()=>{},cancelled=()=>false}={}){if(!['dry','wet','both'].includes(mode)||!Number.isInteger(sampleRate)||sampleRate<8000||sampleRate>96000)throw Error('Formato de sesión inválido.');const s=projectSnapshot7(source),plan=exportSessionPlan7(s,mode,sampleRate);if(plan.seconds>180||plan.mb>350)throw Error('La sesión excede 180 s o 350 MB estimados. Acortá el arreglo o elegí un solo tipo de stem.');const files=[],reports=[],json=(name,obj)=>files.push({name,blob:new Blob([JSON.stringify(obj,null,2)],{type:'application/json'})});const savedProject=clone(source);saveSection7(savedProject);json('project.umbra.json',{schema:'umbra-project',version:8,state:savedProject});files.push({name:'notes.mid',blob:midiFile(s)});const taps=[{tap:null,name:'00_MASTER.wav'},...trackDefs.flatMap((t,i)=>{const stem=String(i+1).padStart(2,'0')+'_'+t.id;return (mode==='both'?['dry','wet']:[mode]).map(type=>({tap:type+':'+t.id,name:type+'/'+stem+'.wav'}));}),{tap:'returns',name:'FX_RETURNS.wav'},{tap:'drum-bus',name:'DRUM_BUS_alternative.wav'}];
 for(let i=0;i<taps.length;i++){if(cancelled())throw Error('Exportación cancelada.');const x=taps[i];onProgress('Render '+(i+1)+'/'+taps.length+' · '+x.name,i/taps.length);const render=await renderOffline({...s,_renderTap7:x.tap},{loops:1,tail:'tail',sampleRate,onProgress:text=>onProgress(text+' · '+x.name,i/taps.length),cancelled}),wav=await encodeWav(render);if(cancelled())throw Error('Exportación cancelada.');files.push({name:x.name,blob:wav.blob});reports.push({file:x.name,seconds:render.seconds,sampleRate,frames:render.frames,peak:wav.peak,rms:wav.rms,reference:x.tap===null,scale:x.tap?.length?.5:1});await yieldUI();}
 const manifest={schema:'umbra-stems',version:1,appVersion:'8.0.0',sound:s.sound8||{engine:'legacy',finish:'none',amount:65},bpm:s.bpm,key:noteNames[s.root],scale:scaleDefs[s.scale].name,bars:totalBars(s),sections:sectionRanges7(s).map(x=>({name:x.name,startBar:x.start/16,bars:(x.end-x.start)/16})),sampleRate,channels:2,pcmBits:16,mode,reports,notes:'Dry = síntesis antes del canal. Wet = canal post-fader antes de buses/retornos. Los stems y retornos están atenuados 6.0206 dB (x0.5) para margen. El master no. No son una descomposición bit-exacta del master no lineal.'};json('session.json',manifest);
 files.push({name:'READ-ME.txt',blob:new Blob(['UMBRA 7 — SESIÓN\n\nTodos los archivos parten del mismo punto, con igual longitud y 6 s de cola.\n\n00_MASTER.wav es la mezcla de referencia.\nDry: síntesis antes de filtros/FX/volumen del canal.\nWet: salida de canal antes de ducking, buses compartidos y master.\nFX_RETURNS.wav: reverberación, delay, chorus y phaser de la mezcla completa.\nDRUM_BUS_alternative.wav: bus completo de batería. Alternativa a sumar los stems de batería; no sumes ambos.\nLos stems/retornos se escalan x0.5 para margen. Compensación de referencia: +6.0206 dB.\nNo hay garantía de reconstrucción exacta al sumar: ducking, compresión y saturación compartida dependen de la mezcla. Usá el master de referencia.\n\nMIDI conserva notas, tempo, marcadores y CC aproximados para algunas curvas. Los timbres, las colas, el legato de audio y los efectos requieren instrumentos propios en el DAW.\nEl proyecto conserva las asignaciones y curvas completas.\n'],{type:'text/plain'})});onProgress('Empaquetando ZIP…',.98);return{blob:await zip7(files),manifest};}
/* UMBRA 8 · revisioned sound. Old projects opt into none of these changes.
   Signal path stays native Web Audio. No samples or external DSP dependencies. */
const soundDefaults8=()=>({engine:'studio',finish:'balanced',amount:65});
const legacySound8=()=>({engine:'legacy',finish:'none',amount:65});
const soundFinish8={none:{name:'Neutro',low:0,mid:0,high:0,edge:0,width:1,trim:0},balanced:{name:'Equilibrado',low:.2,mid:-1.4,high:.25,edge:-1.0,width:1.02,trim:-.35},warm:{name:'Cálido',low:.75,mid:-.7,high:-1.65,edge:-.8,width:.96,trim:-.25},open:{name:'Abierto',low:0,mid:-1.1,high:1.15,edge:-.5,width:1.18,trim:-.65}};
function validateSound8(x){if(x===undefined)return legacySound8();if(!x||typeof x!=='object'||!['studio','legacy'].includes(x.engine)||!Object.hasOwn(soundFinish8,x.finish)||!Number.isFinite(x.amount)||x.amount<0||x.amount>100)throw Error('Ajustes de sonido v8 inválidos.');return{engine:x.engine,finish:x.finish,amount:x.amount};}
const defaultStateBefore8=defaultState;defaultState=function(){return{...defaultStateBefore8(),sound8:soundDefaults8()};};
const validateBefore8=validateProject;validateProject=function(payload){const out=validateBefore8(payload);function restore(dst,src){dst.sound8=validateSound8(src.sound8);for(const slot of ['A','B','C','D'])if(dst.studio?.bank[slot])restore(dst.studio.bank[slot].project,src.studio.bank[slot].project);}restore(out,payload.state);return out;};
const applyPresetBefore8=applyPreset;applyPreset=function(...args){const sound=clone(state?.sound8||soundDefaults8());applyPresetBefore8(...args);state.sound8=sound;};
const randomBefore8=makeRandomCandidate;makeRandomCandidate=function(before,...args){const c=randomBefore8(before,...args);c.state.sound8=clone(before.sound8||legacySound8());return c;};
const chaosBefore8=makeChaosCandidate5;makeChaosCandidate5=function(before,...args){const c=chaosBefore8(before,...args);c.state.sound8=clone(before.sound8||legacySound8());return c;};
const modernCurve8=new Float32Array(4097);for(let i=0;i<modernCurve8.length;i++){const x=i/(modernCurve8.length-1)*2-1,a=Math.abs(x);modernCurve8[i]=Math.sign(x)*(a<=.78?a:.78+.18*Math.tanh((a-.78)/.18));}
const initBefore8=SynthEngine.prototype.initV2;
SynthEngine.prototype.initV2=function(s){initBefore8.call(this,s);const N=this.N;this.finish8={};const f=this.finish8;f.direct=N('createGain');f.wet=N('createGain');f.low=N('createBiquadFilter');f.mid=N('createBiquadFilter');f.edge=N('createBiquadFilter');f.high=N('createBiquadFilter');f.low.type='lowshelf';f.low.frequency.value=160;f.mid.type='peaking';f.mid.frequency.value=330;f.mid.Q.value=.75;f.edge.type='peaking';f.edge.frequency.value=3400;f.edge.Q.value=.7;f.high.type='highshelf';f.high.frequency.value=5400;
 this.compressor.disconnect(this.master);this.compressor.connect(f.direct).connect(this.master);this.compressor.connect(f.low).connect(f.mid).connect(f.edge).connect(f.high);
 // Mid/side, with side lows attenuated. Only the master path is affected; stems keep their taps.
 const split=N('createChannelSplitter',2),merge=N('createChannelMerger',2),mid=N('createGain'),side=N('createGain'),neg=N('createGain');f.sideHP=N('createBiquadFilter');f.width=N('createGain');f.sideHP.type='highpass';f.sideHP.frequency.value=150;f.sideHP.Q.value=.5;neg.gain.value=-1;f.high.connect(split);
 for(const [channel,dest,level]of[[0,mid,.5],[1,mid,.5],[0,side,.5],[1,side,-.5]]){const g=N('createGain');g.gain.value=level;split.connect(g,channel);g.connect(dest);}
 side.connect(f.sideHP).connect(f.width);mid.connect(merge,0,0);mid.connect(merge,0,1);f.width.connect(merge,0,0);f.width.connect(neg).connect(merge,0,1);merge.connect(f.wet).connect(this.master);f.legacyCurve=this.safety.curve;f.direct.gain.value=1;f.wet.gain.value=0;this.soundRevision8=null;
};
const updateSoundBefore8=SynthEngine.prototype.update;
SynthEngine.prototype.update=function(s,immediate=false){updateSoundBefore8.call(this,s,immediate);const f=this.finish8;if(!f||this.disposed)return;const spec=s.sound8||legacySound8(),preset=soundFinish8[spec.finish]||soundFinish8.none,amount=spec.amount/100,active=spec.finish!=='none'&&amount>0,set=(p,v)=>this.set(p,v,immediate);
 set(f.direct.gain,active?0:1);set(f.wet.gain,active?Math.pow(10,preset.trim*amount/20):0);set(f.low.gain,preset.low*amount);set(f.mid.gain,preset.mid*amount);set(f.edge.gain,preset.edge*amount);set(f.high.gain,preset.high*amount);set(f.width.gain,1+(preset.width-1)*amount);
 if(this.soundRevision8!==spec.engine){this.safety.curve=spec.engine==='studio'?modernCurve8:f.legacyCurve;this.soundRevision8=spec.engine;}
};
function studioAudio8(engine){return engine.state.sound8?.engine==='studio';}
// Natural envelope: a long gate does not stretch the physical decay of a plucked tine.
function piano8(engine,id,tr,midi,t,velocity,duration,h){const f=midiHz(midi+tr.tune),dynamic=(tr.expression?.dynamic??62)/100,vel=clamp(velocity,.01,1),decay=(.7+tr.decay*.018)*Math.pow(440/f,.17),release=.07+tr.decay*.007,hold=Math.max(.012,duration),end=t+hold+release+.012,v=engine.voice(id,t,end),out=engine.channels[id].input,amp=v.node('createGain'),filter=v.node('createBiquadFilter');filter.type='lowpass';filter.Q.value=.55;filter.frequency.value=Math.min(engine.ctx.sampleRate*.44,1400+tr.tone*65*(.45+vel*.55));filter.connect(amp).connect(out);
 const peak=.215*Math.pow(vel,1.10),gate=peak*Math.exp(-hold/decay),attack=Math.min(.003+tr.attack*.0004,hold*.35);amp.gain.setValueAtTime(.000001,t);amp.gain.linearRampToValueAtTime(peak,t+attack);amp.gain.exponentialRampToValueAtTime(Math.max(.000002,gate),t+hold);amp.gain.exponentialRampToValueAtTime(.000001,t+hold+release);
 const carrier=v.osc('sine',f,filter,.68),mod=v.node('createGain');mod.gain.setValueAtTime(f*(.10+vel*vel*dynamic*1.55)*(tr.sound==='ep7'?1.07:.78)*(.62+tr.texture*.009),t);mod.gain.exponentialRampToValueAtTime(Math.max(.0001,f*.018),t+Math.min(hold+release,.09+decay*.3));mod.connect(carrier.frequency);v.osc('sine',f*1.001,mod);v.osc('sine',f,filter,.24,-.8);v.osc('sine',f*2.001,filter,.07*(.3+.7*vel));
 for(const [ratio,strength,seconds]of[[6.91,tr.sound==='ep7'?.048:.027,.085],[9.17,tr.sound==='ep7'?.016:.008,.042]])if(f*ratio<engine.ctx.sampleRate*.44){const g=v.node('createGain');g.gain.setValueAtTime(strength*vel*vel,t);g.gain.exponentialRampToValueAtTime(.000001,t+seconds);g.connect(filter);v.osc('sine',f*ratio,g);}
 v.finish();}
function heldExp8(from,to,start,end,time){return time<=start?from:time>=end?to:from*Math.pow(to/from,(time-start)/(end-start));}
function monoBass8(engine,id,tr,midi,t,velocity,duration){const ex={...expressionDefault7(),...tr.expression},N=engine.N;engine.mono8??={};let m=engine.mono8[id];if(!m){const saw=N('createOscillator'),sub=N('createOscillator'),sg=N('createGain'),bg=N('createGain'),lp=N('createBiquadFilter'),amp=N('createGain');saw.type='sawtooth';sub.type='sine';sg.gain.value=.145;bg.gain.value=.13;lp.type='lowpass';lp.Q.value=.7;amp.gain.value=0;saw.connect(sg).connect(lp);sub.connect(bg).connect(lp);lp.connect(amp).connect(engine.channels[id].input);saw.start(engine.ctx.currentTime);sub.start(engine.ctx.currentTime);engine.fxOsc.push(saw,sub);m=engine.mono8[id]={saw,sub,sg,bg,lp,amp,gate:-10,start:-10,release:.065,peak:.000001,from:110,target:110,glideEnd:-10,attackEnd:-10};}
 m.sg.gain.setValueAtTime(.095+tr.texture*.001,t);m.bg.gain.setValueAtTime(.17-tr.texture*.0007,t);m.lp.Q.setValueAtTime(.5+tr.texture*.006,t);
 const f=midiHz(midi+tr.tune),legato=ex.legato&&m.gate>=t-.004,from=heldExp8(m.from,m.target,m.start,m.glideEnd,t),current=t<m.gate?m.peak:Math.max(.000001,m.peak*Math.exp(-(t-m.gate)/m.release*11.5)),peak=.81*Math.pow(velocity,.95),glide=legato?Math.min(Math.max(.001,ex.glide/1000),duration*.8):.001;
 for(const [o,ratio]of[[m.saw,1],[m.sub,.5]]){o.frequency.cancelScheduledValues(t);o.frequency.setValueAtTime((legato?from:f)*ratio,t);o.frequency.exponentialRampToValueAtTime(f*ratio,t+glide);}
 m.amp.gain.cancelScheduledValues(t);m.amp.gain.setValueAtTime(legato?Math.max(.000001,current):.000001,t);m.amp.gain.linearRampToValueAtTime(peak,t+Math.min(duration*.35,legato?.012:.003+tr.attack*.00035));m.amp.gain.setValueAtTime(peak,t+duration);m.amp.gain.exponentialRampToValueAtTime(.000001,t+duration+m.release);
 m.lp.frequency.cancelScheduledValues(t);m.lp.frequency.setValueAtTime(280+tr.tone*40*(.45+velocity*.55),t);m.lp.frequency.exponentialRampToValueAtTime(180+tr.tone*12,t+Math.max(.03,duration));Object.assign(m,{start:t,gate:t+duration,peak,from:legato?from:f,target:f,glideEnd:t+glide});}
const tonalSoundBefore8=SynthEngine.prototype.tonal;
SynthEngine.prototype.tonal=function(id,tr,midi,t,velocity,duration,h){if(!studioAudio8(this))return tonalSoundBefore8.call(this,id,tr,midi,t,velocity,duration,h);if(['ep7','velvetEP'].includes(tr.sound))return piano8(this,id,tr,midi,t,velocity,duration,h);if(tr.sound==='mono7')return monoBass8(this,id,tr,midi,t,velocity,duration);return tonalSoundBefore8.call(this,id,tr,midi,t,velocity,duration,h);};
const drumSoundBefore8=SynthEngine.prototype.drum;
SynthEngine.prototype.drum=function(id,tr,t,velocity,h){if(!studioAudio8(this))return drumSoundBefore8.call(this,id,tr,t,velocity,h);const hat=(id==='hat'||id==='open')&&tr.sound!=='shaker',expressive=(id==='kick'&&tr.sound==='kick7')||(id==='snare'&&tr.sound==='snare7');if(!hat&&!expressive)return drumSoundBefore8.call(this,id,tr,t,velocity,h);
 const open=id==='open',r=rng(h+'|studio8'),ex={...expressionDefault7(),...tr.expression},tune=Math.pow(2,tr.tune/12),dur=hat?(open?(tr.sound==='open909'?.23:.29)+tr.decay*.0052:(tr.sound==='hatGrain'?.033:tr.sound==='hat909'?.020:.026)+tr.decay*(tr.sound==='hatGrain'?.00145:.0011)):id==='kick'?.21+tr.decay*.006:.07+tr.decay*.0045,v=this.voice(id,t,t+dur+.025),out=this.channels[id].input;
 const env=(peak,d,attack=.0012,dest=out)=>{const g=v.node('createGain');g.gain.setValueAtTime(.000001,t);g.gain.linearRampToValueAtTime(Math.max(.000001,peak*velocity),t+Math.min(attack,d*.25));g.gain.exponentialRampToValueAtTime(.000001,t+d);g.connect(dest);return g;},filter=(type,f,q=.7)=>{const n=v.node('createBiquadFilter');n.type=type;n.frequency.value=Math.min(f,this.ctx.sampleRate*.44);n.Q.value=q;return n;};
 if(hat){if(!open)for(const old of this.openHats)if(old.t<=t&&old.end>t&&old.amp){const g=old.amp.gain;if(g.cancelAndHoldAtTime)g.cancelAndHoldAtTime(t);else{g.cancelScheduledValues(t);g.setValueAtTime(old.peak8||.04,t);}g.setTargetAtTime(.000001,t,.003);}
 const grain=tr.sound==='hatGrain',soft=/Soft/.test(tr.sound),metal=/Metal|909/.test(tr.sound),peak=open?.21:grain?.23:.245,g=env(peak,dur,.0014),hp=filter('highpass',grain?3300:soft?4100:4800),lp=filter('lowpass',(grain?5100:soft?6600:7800)+tr.tone*53);hp.connect(lp).connect(g);v.noise(hp,r(),grain?.80:.68);if(grain){const grainBody=env(.045,.021),bp=filter('bandpass',3150,1.4);bp.connect(grainBody);v.noise(bp,r());}const mix=v.node('createGain');mix.gain.value=metal?.075:.035;mix.connect(hp);for(const [i,f]of(/909/.test(tr.sound)?[5459,7247,9133,11131]:[4987,6389,7883,9811]).entries())v.osc('sine',f*Math.pow(tune,.20)*(1+(r()-.5)*.003),mix,1/(i+1));if(open){v.amp=g;v.peak8=peak*velocity;this.openHats.add(v);}
 }else if(id==='kick'){const root=42*tune,body=env(.81*ex.body,dur,.0018),o=v.osc('sine',root*3.6,body);o.frequency.exponentialRampToValueAtTime(root,t+.038);o.frequency.exponentialRampToValueAtTime(root*.97,t+dur);const knock=env(.10*ex.attack,.025),bp=filter('bandpass',640,1);bp.connect(knock);v.noise(bp,r(),.7);v.osc('triangle',root*3,knock,.25);
 }else{const body=env(.22*ex.body,Math.min(dur,.16)),o=v.osc('sine',215*tune,body);o.frequency.exponentialRampToValueAtTime(176*tune,t+.024);v.osc('sine',298*tune,body,.35);const wire=env(.33*ex.wire,dur,.0018),hp=filter('highpass',900),lp=filter('lowpass',2800+tr.tone*65);hp.connect(lp).connect(wire);v.noise(hp,r());const snap=env(.048*ex.attack,.019),bp=filter('bandpass',2700,1);bp.connect(snap);v.noise(bp,r());}
 v.finish();};
function changeSound8(patch){if(ui.rendering)return;const prior=state.sound8||legacySound8(),restart=patch.engine&&patch.engine!==prior.engine;commit7(()=>{state.sound8=validateSound8({...prior,...patch});},{restart:!!restart});engine?.update(state);previewEngine?.update(state);syncSoundUI8();}

/* Public release boundary. The former project formats remain readable. */
const VERSION8='8.0.0';
// ── GMC public boundary ──────────────────────────────────────────────────────
// One studio session lives in this closure (state + undo). Pure helpers accept an
// explicit project. The UI never becomes the audio clock: the player schedules
// from AudioContext time with a lookahead window, exactly as UMBRA does.
const ENGINE_VERSION='gmc-studio-engine/1 (UMBRA 8 core)';
const project=(s=state)=>({schema:'umbra-project',version:8,state:clone(s)});
const mix=(s)=>{engine?.update(s);previewEngine?.update(s);};
host.restart=was=>{if(was&&player.playing)player.restart();};
host.update=(s,{restart=false}={})=>{if(restart&&player.playing)player.restart();else mix(s);host.render(s);};

const player={
 playing:false,starting:false,loop:true,step:-1,token:0,timer:null,nextStep:0,nextTime:0,pausedStep:0,finishAt:null,queue:[],onStep:null,onEvent:null,onState:null,
 async context(){const AC=root.AudioContext||root.webkitAudioContext;if(!AC)throw new Error('This browser does not offer Web Audio.');if(!audioContext||audioContext.state==='closed')audioContext=new AC({latencyHint:'interactive'});if(audioContext.state==='suspended')await audioContext.resume();return audioContext;},
 fade(eng){if(!eng)return;const t=eng.ctx.currentTime;try{eng.output.gain.cancelScheduledValues(t);eng.output.gain.setValueAtTime(eng.output.gain.value,t);eng.output.gain.linearRampToValueAtTime(0,t+.035);}catch{}setTimeout(()=>{eng.dispose();if(!player.playing&&!player.starting&&!engine&&!previewEngine&&audioContext?.state==='running')audioContext.suspend().catch(()=>{});},65);},
 async start(){if(this.playing||this.starting||ui.rendering)return;this.starting=true;const token=++this.token;try{const ctx=await this.context();if(token!==this.token)return;this.releasePreview();saveSection7();engine=new SynthEngine(ctx,state);this.playing=ui.playing=true;this.starting=false;this.nextStep=this.pausedStep;this.nextTime=ctx.currentTime+.085;this.queue=[];this.finishAt=null;this.timer=setInterval(()=>this.schedule(),25);this.schedule();this.onState?.('playing');}catch(err){this.starting=false;this.playing=ui.playing=false;this.onState?.('error',err);throw err;}},
 schedule(lookahead=.16){if(!this.playing||!engine)return;const ctx=engine.ctx;if(ctx.state!=='running')return;const dt=stepSeconds(state),length=totalBars(state)*16;
  if(this.finishAt!==null){if(ctx.currentTime>=this.finishAt)this.stop(false);return;}
  if(this.nextTime<ctx.currentTime-.07){this.pause();this.onState?.('underrun');return;}
  while(this.nextTime<ctx.currentTime+lookahead){if(!this.loop&&this.nextStep>=length){this.finishAt=this.nextTime+4;break;}const absolute=mod(this.nextStep,length);engine.automate7(this.nextStep,this.nextTime);const es=scoreEvents(this.nextStep);for(const e of es){const at=engine.schedule(e,this.nextTime);this.onEvent?.(e,at,absolute);}this.queue.push({time:this.nextTime,step:absolute});this.nextStep++;this.nextTime+=dt;}
  while(this.queue.length&&this.queue[0].time<=ctx.currentTime){this.step=ui.absStep=this.queue.shift().step;this.onStep?.(this.step);}},
 pause(){++this.token;this.starting=false;if(!this.playing)return;this.pausedStep=mod(this.step+1,totalBars(state)*16);this.playing=ui.playing=false;clearInterval(this.timer);this.timer=null;this.queue=[];this.fade(engine);engine=null;this.finishAt=null;this.onState?.('paused');},
 stop(reset=true){++this.token;this.starting=false;this.playing=ui.playing=false;clearInterval(this.timer);this.timer=null;this.queue=[];this.fade(engine);engine=null;this.releasePreview();this.finishAt=null;this.pausedStep=0;this.step=-1;ui.absStep=0;if(reset)ui.bar=0;this.onState?.('stopped');},
 toggle(){return this.playing||this.starting?this.pause():this.start();},
 restart(){this.pausedStep=0;if(this.playing){this.stop(false);return this.start();}},
 seekBar(bar){const was=this.playing;this.stop(false);this.pausedStep=clamp(bar,0,totalBars(state)-1)*16;if(was)return this.start();},
 releasePreview(){clearTimeout(this.previewTimer);if(previewEngine){this.fade(previewEngine);previewEngine=null;}},
 // Audition through the current channel mix: muted or zero-volume channels stay silent.
 async preview(trackId,midi=null){if(ui.rendering)return;const ctx=await this.context(),tr=state.tracks.find(t=>t.id===trackId);if(!tr)throw new Error('Unknown track: '+trackId);let en=engine;if(!en){if(!previewEngine||previewEngine.disposed)previewEngine=new SynthEngine(ctx,state);previewEngine.update(state);en=previewEngine;clearTimeout(this.previewTimer);this.previewTimer=setTimeout(()=>this.releasePreview(),6000);}
  const drum=trackMap[trackId].drum,n=midi===null?(drum?[trackMap[trackId].midi]:trackId==='keys'||trackId==='pad'?chordVoicings()[harmonyIndex(ui.bar)]:[scaleMidi(0,trackId==='bass'?2:4)]):[midi];
  en.schedule({id:trackId,tr,n:n.map(x=>x+(drum?0:tr.octave*12)),v:.76,d:trackId==='pad'?1.2:.5,offset:0,strum:.008,hash:hash(state.seed+'preview'+n.join())},ctx.currentTime+.015);return audible(tr)&&tr.volume>0;},
 meters(){const en=engine||previewEngine;if(!en)return null;return{analyser:en.analyser,channels:Object.fromEntries(Object.entries(en.channels).map(([id,ch])=>[id,ch.dawAnalyser||null]))};}
};
let audioContext=null;

let liveBefore=null;
const track=id=>{const t=state.tracks.find(x=>x.id===id);if(!t)throw new Error('Unknown track: '+id);return t;};
// Regenerating one track drops its clip binding so the new pattern is heard.
const regenerate=t=>{if(state.studio)delete state.studio.bindings[t.id];state.patterns[t.id]=generateTrack(t);ui.note=null;};
const session={
 get state(){return state;},
 get selected(){return ui.selected;},
 select(id){if(!trackMap[id])throw new Error('Unknown track: '+id);ui.selected=id;ui7.selection=new Set();},
 get bar(){return ui.bar;},set bar(v){ui.bar=clamp(Math.round(v),0,state.bars-1);},
 get canUndo(){return ui.undo.length>0;},get canRedo(){return ui.redo.length>0;},
 load(payload){const next=validateProject(payload);checkpoint();player.stop();state=next;ui.bar=0;ui.note=null;scoreMemo7.clear();host.render(state);persist();return state;},
 replace(next){state=next;ui.undo=[];ui.redo=[];ui.bar=0;scoreMemo7.clear();updateHistoryButtons();host.render(state);return state;},
 project:()=>project(state),
 undo:()=>{const ok=undo();if(ok)player.playing?player.restart():mix(state);return ok;},
 redo:()=>{const ok=redo();if(ok)player.playing?player.restart():mix(state);return ok;},
 // Simple parameter edit: one undo step, optional recomposition of unlocked tracks.
 edit(fn,{recompose=false,restart=false}={}){if(ui.rendering)return false;checkpoint();fn(state);changed({recompose,restart});return true;},
 commit:(fn,opts)=>commit7(()=>fn(state),opts),
 applyPreset(id){checkpoint();applyPreset(id);changed({restart:true});},
 setSeed(seed){checkpoint();state.seed=String(seed).slice(0,64)||'UMBRA';state.mutation=0;state.tracks.forEach(t=>{if(!t.locked)t.revision=0;});changed({recompose:true,restart:true});},
 newSeed(){this.setSeed(seedRandom());return state.seed;},
 mutate(){if(ui.rendering)return;checkpoint();state.mutation++;changed({recompose:true,restart:true});},
 regenerateTrack(id){checkpoint();const t=track(id);t.revision++;regenerate(t);changed({});},
 // Continuous controls: the first input snapshots the session, commitLive stores one undo step.
 live(fn){if(ui.rendering)return;if(!liveBefore)liveBefore=clone(state);fn(state);mix(state);host.render(state,{live:true});},
 commitLive(){const before=liveBefore;liveBefore=null;if(before){rememberUndo(before);persist();}},
 // Key, scale, progression, voicing, bars and form follow UMBRA's handlers.
 setHarmony(id,value){if(id==='progression'&&progressions[value]?.meta){const entry=progressions[value];commitHarmony(entry.chords,{id:value,mode:entry.meta.mode});return;}if(!['root','scale','progression','voicing','bars','structure'].includes(id))throw new Error('Unknown harmony control: '+id);checkpoint();state[id]=['root','bars'].includes(id)?Number(value):value;if(id==='progression'&&state.progression!=='custom'){state.degrees=progressions[state.progression].degrees.slice();state.chordEdits=null;}fitHarmonyBars();if(id==='scale')state.degrees=state.degrees.map(n=>mod(n,scaleNotes(state,true).length));ui.note=null;changed({recompose:id!=='structure',respectLocks:false,restart:true});},
 setGeneration(key,value){if(!['density','complexity','variation','human','swing'].includes(key))throw new Error('Unknown generation control: '+key);checkpoint();state[key]=clamp(Number(value),0,key==='swing'?65:100);if(['density','complexity','variation'].includes(key))generateAll();changed({});},
 setBpm(value){checkpoint();state.bpm=clamp(Math.round(Number(value)||82),45,190);mix(state);persist();host.render(state);},
 setTrack(id,patch,{regenerate:again=false}={}){checkpoint();Object.assign(track(id),patch);if(again)regenerate(track(id));changed({});},
 toggleLock(id){checkpoint();const t=track(id);t.locked=!t.locked;t.arpLock=t.locked?{seed:state.seed,mutation:state.mutation}:null;persist();host.render(state);},
 toggleFlag(id,key){if(!['mute','solo'].includes(key))throw new Error('Unknown track flag: '+key);checkpoint();const t=track(id);t[key]=!t[key];mix(state);persist();host.render(state);},
 clearTrack(id){checkpoint();if(state.studio)delete state.studio.bindings[id];state.patterns[id]=emptyPattern(state.bars);const t=track(id);t.arp.enabled=false;t.performance.mode='original';ui.note=null;changed({});},
 setMaster(patch){checkpoint();Object.assign(state.master,patch);mix(state);persist();host.render(state);},
 randomCandidate:(config,seed,kind='variation')=>makeRandomCandidate(state,{...randomDefaults(),...config},seed,kind,ui.selected),
 chaosCandidate:(config,seed)=>makeChaosCandidate5(state,{...chaosDefaults5(),...config},seed),
 applyCandidate(candidate){if(ui.rendering)return false;checkpoint();state=candidate.state;ui.bar=Math.min(ui.bar,state.bars-1);ui.note=null;scoreMemo7.clear();host.update(state,{restart:player.playing});persist();return true;},
 ops:{commitHarmony:(...a)=>commitHarmony(...a),reworkHarmony:(...a)=>reworkHarmony(...a),setPerformanceMode:(...a)=>setPerformanceMode(...a),applyPerformanceTemplate:(...a)=>applyPerformanceTemplate(...a),bake:(...a)=>bake7(...a),transform:(...a)=>transform7(...a),ensureClip:(...a)=>ensureClip7(...a),duplicateClip:(...a)=>duplicateClip7(...a),deleteClip:(...a)=>deleteClip7(...a),changeBinding:(...a)=>changeBinding7(...a),collectUnusedClips:()=>collectUnusedClips7(),storeBank:(...a)=>storeBank7(...a),loadBank:(...a)=>loadBank7(...a),structureSong:()=>structureSong7(),setSongMode:(...a)=>setSongMode7(...a),dropClip:(...a)=>dropClip7(...a),copyPhraseIntoTrack:(...a)=>copyPhraseIntoTrack7(...a),automate:(...a)=>automateControl7(...a),ensureLane:(...a)=>ensureLane7(...a),changeSound:(...a)=>changeSound8(...a),syncProjection:(...a)=>syncProjection7(...a),makeNote:(...a)=>makeNote7(...a),refreshHarmonyMaterial:()=>refreshHarmonyMaterial()}
};

async function renderWav(s,opts={}){const rendered=await renderOffline(s,opts);return{...await encodeWav(rendered,opts.onProgress),seconds:rendered.seconds};}
const labels={noteName,chordLabel:(i,s=state)=>labelAt(i,s),roman:(d,s=state)=>roman(d,s)};
const api=Object.freeze({
 version:ENGINE_VERSION,host,session,player,
 catalog:()=>({sounds:Object.keys(sounds).length,presets:presets.length,genres:Object.keys(grooves).length,scales:Object.keys(scaleDefs).length,progressions:Object.keys(progressions).length-1,referenceProgressions:REF_PROGRESSIONS.length,arpTemplates:Object.keys(ARP_LIBRARY).length,chopTemplates:Object.keys(CHOP_LIBRARY).length,arpModes:Object.keys(arpModes).length,arpRates:Object.keys(arpRates).length}),
 data:Object.freeze({presets,sounds,trackDefs,trackMap,genreNames,scaleDefs,progressions,refProgressions:REF_PROGRESSIONS,arpLibrary:ARP_LIBRARY,chopLibrary:CHOP_LIBRARY,arpModes,arpRates,patternDefs,grooves,qualityLabels,routeTargets:routeTargets7,soundFinish:soundFinish8,trackColors,genreTonePools:GENRE_TONE_POOLS}),
 compose:(seed,presetId='nocturne')=>composeFresh(seed,presetId),
 validateProject,project,parseProgression:(text,opts)=>parseProgression(text,opts),parseChord:(token,opts)=>parseChordToken(token,opts),
 scoreEvents:(step,s=state)=>scoreEvents(step,s),totalBars:(s=state)=>totalBars(s),stepSeconds:(s=state)=>stepSeconds(s),totalSeconds:(s=state)=>totalSeconds(s),
 chordVoicings:(s=state)=>chordVoicings(s),harmonyIndex:(bar,s=state)=>harmonyIndex(bar,s),audible:(tr,s=state)=>audible(tr,s),labels,
 SynthEngine,renderOffline:(s,opts)=>renderOffline(s,opts),encodeWav:(r,p)=>encodeWav(r,p),renderWav,midi:(s=state,loops=1)=>midiFile(s,loops),
 sessionPlan:(s,mode,sr)=>exportSessionPlan7(s,mode,sr),createSession:(s,opts)=>createSession7(s,opts),zip:files=>zip7(files),
 debug:Object.freeze({get:name=>DEBUG[name]})
});
const DEBUG={scoreEvents:(...a)=>scoreEvents(...a),totalBars:(...a)=>totalBars(...a),stepSeconds:(...a)=>stepSeconds(...a),generateAll:(...a)=>generateAll(...a),applyPreset:(...a)=>applyPreset(...a),defaultState:()=>defaultState(),structureSong7:()=>structureSong7(),ensureClip7:(...a)=>ensureClip7(...a),syncProjection7:(...a)=>syncProjection7(...a),makeNote7:(...a)=>makeNote7(...a),bake7:(...a)=>bake7(...a),transform7:(...a)=>transform7(...a),makeRandomCandidate:(...a)=>makeRandomCandidate(...a),makeChaosCandidate5:(...a)=>makeChaosCandidate5(...a),randomDefaults:()=>randomDefaults(),chaosDefaults5:()=>chaosDefaults5(),validateProject:(...a)=>validateProject(...a),studio7:(...a)=>studio7(...a),ensureLane7:(...a)=>ensureLane7(...a),reworkHarmony:(...a)=>reworkHarmony(...a),parseProgression:(...a)=>parseProgression(...a),commitHarmony:(...a)=>commitHarmony(...a),midiFile:(...a)=>midiFile(...a),renderOffline:(...a)=>renderOffline(...a),encodeWav:(...a)=>encodeWav(...a),get ARP_LIBRARY(){return ARP_LIBRARY;},get CHOP_LIBRARY(){return CHOP_LIBRARY;},get scoreMemo7(){return scoreMemo7;},get state(){return state;},setState:v=>{state=v;},ui,ui7};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.GMCEngine=api;
})(globalThis);
