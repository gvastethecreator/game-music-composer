/* Game Music Composer / Brainstormer R02.
   Original exploratory engines. Not the Neo-SPC runtime or Factory Bank.
   Quarter-note beats, C4 = MIDI 60. Pure generators also run in Node. */
(function(root){
'use strict';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const mod=(x,n)=>(x%n+n)%n;
const copy=x=>JSON.parse(JSON.stringify(x));
const names=['C','C♯','D','E♭','E','F','F♯','G','A♭','A','B♭','B'];
const noteName=n=>names[mod(Math.round(n),12)]+(Math.floor(n/12)-1);
function rand(seed=24){let a=seed>>>0;return()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
function hash(s){let h=2166136261;for(const c of String(s)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
const SCALES={dorian:[0,2,3,5,7,9,10],minor:[0,2,3,5,7,8,10],major:[0,2,4,5,7,9,11],pent:[0,2,4,7,9],darkpent:[0,3,5,7,10],lydian:[0,2,4,6,7,9,11]};
const degree=(d,root=62,scale=SCALES.dorian)=>root+12*Math.floor(d/scale.length)+scale[mod(d,scale.length)];
const INST=Object.create(null);
function inst(id,label,surface,sound,range,color,extra={}){INST[id]={id,label,surface,sound,range,color,...extra};}
inst('piano','Piano íntimo','keys','piano',[36,96],'#dcb98c');
inst('epiano','Piano eléctrico','keys','epiano',[36,96],'#ddb478');
inst('organ','Órgano','keys','organ',[36,84],'#abadd8');
inst('accordion','Acordeón','bellows','accordion',[45,82],'#daba87');
inst('harpsichord','Clave','keys','harpsichord',[45,92],'#d1b68a');
inst('prepared_piano','Piano preparado','keys','prepared',[40,86],'#b99bbd');
inst('clav','Clavinet','keys','clav',[45,84],'#b9cb8b');
inst('guitar','Guitarra de nylon','fret','guitar',[40,84],'#caad88',{strings:[40,45,50,55,59,64]});
inst('muted_guitar','Guitarra apagada','fret','muted',[38,78],'#cb9f7f',{strings:[38,43,48,53,57,62]});
inst('dist_guitar_l','Guitarra saturada · L','fret','distorted',[34,76],'#cc8880',{strings:[34,39,44,49,53,58]});
inst('dist_guitar_r','Guitarra saturada · R','fret','distorted',[34,76],'#c38880',{strings:[34,39,44,49,53,58]});
inst('bass','Contrabajo pizzicato','fret','bass',[28,60],'#bb9473',{strings:[28,33,38,43]});
inst('contrabass','Contrabajo','bow','bowed',[28,52],'#b19174',{strings:[28,33,38,43]});
inst('slap_bass','Bajo eléctrico','fret','electricbass',[28,64],'#cdac87',{strings:[28,33,38,43]});
inst('synth_bass','Bajo analógico','synth','analogbass',[24,60],'#a4b9cc');
inst('triangle_bass','Bajo triangular','synth','sub',[24,60],'#abbfb6');
inst('sub','Subgrave','synth','sub',[24,55],'#a3bba6');
inst('harp','Arpa','harp','harp',[48,96],'#c7c996');
inst('pizz','Cuerdas pizzicato','bow','pizz',[43,84],'#b3c796',{strings:[43,50,57,64]});
inst('violin1','Violín I','bow','violin',[60,92],'#b3a7d4',{strings:[55,62,69,76]});
inst('violin2','Violín II','bow','violin',[55,86],'#aaa0c9',{strings:[55,62,69,76]});
inst('viola','Viola','bow','violin',[48,77],'#a09ab8',{strings:[48,55,62,69]});
inst('cello','Cello','bow','cello',[36,65],'#ada0b9',{strings:[36,43,50,57]});
inst('strings','Cuerdas de cámara','bow','strings',[45,88],'#aba9cd',{strings:[43,50,57,64]});
inst('flute','Flauta','wind','flute',[60,88],'#97c6bc');
inst('piccolo','Piccolo','wind','flute',[72,96],'#b2d8ce');
inst('ocarina','Ocarina','wind','ocarina',[60,84],'#9cbfbd');
inst('reed','Reed oscuro','wind','reed',[52,77],'#c4aed2');
inst('bassoon','Fagot','wind','reed',[38,65],'#a695b7');
inst('clarinet','Clarinete','wind','clarinet',[55,82],'#b9a5ca');
inst('muted_brass','Metal con sordina','brass','mutedbrass',[48,78],'#c7aa7c');
inst('horn','Corno','brass','horn',[45,75],'#d1b97f');
inst('trumpet','Trompeta','brass','brass',[55,84],'#dcc48b');
inst('trombone','Trombón','brass','brass',[40,68],'#bbaa7d');
inst('brass','Ensamble de metales','brass','brass',[48,82],'#d5ba83');
inst('choir_s','Coro · soprano','choir','choir',[60,88],'#d6adbf');
inst('choir_a','Coro · alto','choir','choir',[55,80],'#c9a5b7');
inst('choir_t','Coro · tenor','choir','choir',[45,72],'#b09caf');
inst('choir_b','Coro · bajo','choir','choir',[35,60],'#a490a3');
inst('vibes','Vibráfono','mallet','vibes',[48,92],'#90c6c8');
inst('bell','Campana FM','bells','bell',[55,96],'#beafcb');
inst('kalimba','Kalimba sintética','tines','kalimba',[48,88],'#b4c59a');
inst('metallophone','Metalófono sintético','mallet','metal',[48,96],'#91babe');
inst('pulse25','Pulso · 25%','synth','pulse',[42,92],'#a5b9c9');
inst('pulse50','Pulso · 50%','synth','pulse',[36,88],'#a6bdd7');
inst('synth_lead','Lead analógico','synth','synth',[48,92],'#9aadc6');
inst('synth_pad','Pad de cristal','synth','pad',[40,88],'#a3add0');
inst('drone','Drone armónico','synth','drone',[28,67],'#949eb3');
const DM={kick:36,snare:38,hat:42,open_hat:46,tom:47,wood:76,rim:37,shaker:82,ride:51,impact:30,brush:84};
const DL={kick:'Bombo',snare:'Caja',hat:'Hi-hat cerrado',open_hat:'Hi-hat abierto',tom:'Tom',wood:'Wood block',rim:'Rim',shaker:'Shaker',ride:'Ride',impact:'Impacto grave',brush:'Escobillas'};
for(const [id,midi]of Object.entries(DM))inst(id,DL[id],'drum',id,[0,127],'#c2a78d',{drum:true,midi});
function resolve(id,info={}){if(Object.hasOwn(INST,id))return INST[id];let family=String(info.family||'');const fallback={wind:'flute',brass:'brass',strings:'strings',choir:'choir_a',texture:'drone',keys:'piano',pluck:'harp',mallet:'vibes',guitar:'guitar',bass:'bass',synth:'synth_lead',drum:'wood'}[family]||'piano';return {...INST[fallback],id,label:String(info.label||id),fallback:true};}
function track(id,patch,role,pan=0,volume=1){return{id,patch,role,pan,volume,label:resolve(patch).label};}
function makeScore(title,tracks,bars=8,bar=4,bpm=94){return{kind:'gmc-brainstorm-score',version:2,title,bpm,barLength:bar,meter:bar===3?'6/8':'4/4',bars,beats:bars*bar,tracks,events:[],sections:[],backend:'original-synthetic-v2',production_ready:false,origin:'original-exploratory-composition'};}
function add(s,t,b,d,n,v=.72,extra={}){const tr=s.tracks.find(x=>x.id===t);if(!tr)throw Error('Unknown track '+t);const p=resolve(tr.patch),drum=p.drum;let pitch=drum?(n??p.midi):n;const registerInfo={};if(!drum&&Number.isFinite(pitch)&&(pitch<p.range[0]||pitch>p.range[1])){const candidates=Array.from({length:17},(_,i)=>pitch+(i-8)*12).filter(x=>x>=p.range[0]&&x<=p.range[1]).sort((a,b)=>Math.abs(a-pitch)-Math.abs(b-pitch));if(!candidates.length)throw Error('Registro incompatible');registerInfo.requestedMidi=pitch;registerInfo.octaveDisplacement=candidates[0]-pitch;pitch=candidates[0];}if(!Number.isFinite(b)||!Number.isFinite(d)||!Number.isFinite(pitch))throw Error('Non-finite note');if(b<0||b>=s.beats)return;const duration=Math.max(.035,Math.min(d,s.beats-b));let nextId=t+':'+s.events.length;for(let suffix=1;s.events.some(e=>e.id===nextId);suffix++)nextId=t+':'+s.events.length+':'+suffix;s.events.push({id:nextId,track:t,patch:tr.patch,role:tr.role,beat:b,duration,midi:Math.round(pitch),velocity:clamp(v,.04,1),articulation:'normal',...registerInfo,...extra});}
function finish(s){s.events.sort((a,b)=>a.beat-b.beat||a.track.localeCompare(b.track)||a.midi-b.midi);s.events.forEach((e,i)=>{e.id=e.id||`${e.track}:${i}`;e.performedBeat=e.performedBeat??e.beat;e.performedDuration=e.performedDuration??e.duration;e.performedVelocity=e.performedVelocity??e.velocity;});return s;}
const CHORDS=[[50,57,60,64,69],[46,53,57,60,65],[48,55,58,62,67],[45,52,55,59,64]];
function studioScore(ensemble='chamber'){
 const options={chamber:[track('keys','piano','harmony',-.22,.7),track('lead','flute','lead',.1,.8),track('answer','vibes','counter',.3,.55),track('low','bass','bass',-.1,.85),track('plucks','guitar','rhythm',-.4,.55),track('soft','brush','drums',.25,.3)],
 jazz:[track('keys','epiano','harmony',-.2,.62),track('lead','muted_brass','lead',.1,.75),track('answer','clav','counter',.35,.5),track('low','slap_bass','bass',0,.8),track('kit','snare','drums',.05,.35),track('hats','ride','drums',.4,.3)],
 ritual:[track('keys','metallophone','harmony',-.3,.55),track('lead','ocarina','lead',.14,.8),track('answer','harp','counter',.35,.6),track('low','cello','bass',-.2,.6),track('voice','choir_a','texture',.1,.25),track('kit','tom','drums',-.1,.35)]};
 const s=makeScore('Un patio después de la lluvia',copy(options[ensemble]||options.chamber));s.sections=[{name:'Llamada',start:0,end:8},{name:'Respuesta',start:8,end:16},{name:'Desvío',start:16,end:24},{name:'Retorno',start:24,end:32}];
 const line=[[.5,0,.7],[1.75,2,.5],[3,4,1.1],[5,3,.6],[6.2,1,1.25]];
 for(let ph=0;ph<4;ph++){const off=ph*8;for(const [b,deg,len]of line){let dd=deg+(ph===2?2:0);if(ph===1&&b>6)dd=4;add(s,'lead',off+b,len,degree(dd),.76+Math.sin(b/7*Math.PI)*.12,{phrase:ph});}add(s,'answer',off+4,1,degree(ph===2?6:5),.55);add(s,'answer',off+7.3,.5,degree(ph===3?0:2,74),.45);}
 for(let bar=0;bar<8;bar++){const c=CHORDS[Math.floor(bar/2)],b=bar*4;c.slice(1,5).forEach((n,i)=>add(s,'keys',b+.04*i,2.8,n,.48-i*.015));add(s,'low',b,1.35,c[0]-12,.79);add(s,'low',b+2.5,.85,c[0]-5,.6);
  const fifth=s.tracks[4];if(fifth.role==='texture'){if(bar%2===0)add(s,fifth.id,b+.5,5.2,c[2],.42);}else if(fifth.role==='drums'){add(s,fifth.id,b+1,.12,38,.5);add(s,fifth.id,b+3,.12,38,.62);}else{for(const off of [.75,2,3.25])add(s,fifth.id,b+off,.38,c[off===2?3:2],.56);}
  const sixth=s.tracks[5];for(const off of [0,1.5,2.5,3.5])add(s,sixth.id,b+off,.12,resolve(sixth.patch).midi,.35+(off===0?.18:0));}
 return finish(s);
}
function applyPerformance(score,mode='pocket',amount=.65,swing=.12,seed=19,offsets={}){
 const s=copy(score);const rng=rand(seed);const spb=60/s.bpm;const roleDelay={lead:16,counter:11,harmony:9,rhythm:-6,bass:-4,drums:0,texture:13,...offsets};
 for(const e of s.events){let shift=0;let vel=e.velocity;let dur=e.duration;const base=mod(e.beat,.5);const isOff=Math.abs(base-.25)<.02;
  if(mode==='pocket'){
   const down=Math.abs(mod(e.beat,1))<.02;const phrase=Math.floor(e.beat/8);
   const breath=Math.sin((mod(e.beat,8)/8)*Math.PI);const phraseDrift=(rand(hash(`${seed}:${phrase}`))()-.5)*7;
   shift=((roleDelay[e.role]||0)+(e.patch==='snare'?14:0)+(e.patch==='hat'?-3:0)+phraseDrift+(rng()-.5)*3)*amount/1000/spb;
   if(e.role==='lead'&&!down)shift*=.35;
   if(isOff&&['drums','rhythm','bass','harmony'].includes(e.role))shift+=.25*swing;
   vel=clamp(vel*(1+amount*(.14*breath-.06))+(rng()-.5)*.035*amount,.07,1);
   dur*=1+amount*(e.role==='lead'?.18*breath-.12:-.06);
  }else if(mode==='jitter'){shift=(rng()-.5)*.19*amount;vel=clamp(vel+(rng()-.5)*.28*amount,.07,1);dur*=1+(rng()-.5)*.4*amount;}
  e.performedBeat=clamp(e.beat+shift,0,s.beats-.02);e.performedDuration=clamp(dur,.03,s.beats-e.performedBeat);e.performedVelocity=vel;e.offsetMs=(e.performedBeat-e.beat)*spb*1000;
 }
 s.performance={mode,amount,swing,offsets,seed};return s;
}
function pocketScore(style='neo'){
 const s=makeScore('Un mismo score, tres interpretaciones',[track('keys','epiano','harmony',-.3,.65),track('bass','slap_bass','bass',-.1,.82),track('lead','muted_brass','lead',.25,.64),track('kick','kick','drums',0,.55),track('snare','snare','drums',.1,.36),track('hat','hat','drums',.4,.24)],4,4,style==='garage'?126:style==='jazz'?114:88);
 for(let bar=0;bar<4;bar++){let b=bar*4,c=CHORDS[bar];let stabs=style==='garage'?[.5,1.75,3.25]:style==='jazz'?[.66,2,3.66]:[.25,1.75,3];for(let j=0;j<stabs.length;j++)c.slice(1,5).forEach((n,i)=>add(s,'keys',b+stabs[j]+i*.015,.45,n,.6-j*.04));
 const bassP=style==='garage'?[0,1.5,2.75,3.5]:[0,.75,2.5,3.25];bassP.forEach((o,i)=>add(s,'bass',b+o,.42,c[0]-12+(i===3?7:0),i===0?.83:.65));
 const kicks=style==='garage'?[0,1.5,2.75]:[0,1.75,2.5];kicks.forEach(o=>add(s,'kick',b+o,.11,36,.8));[1,3].forEach(o=>add(s,'snare',b+o,.12,38,.65));if(bar%2===1)add(s,'snare',b+2.75,.08,38,.25);
 for(let i=0;i<8;i++){let o=i*.5+(style==='jazz'&&i%2?1/6:0);add(s,'hat',b+o,.05,42,i%2?.36:.52);}for(const [i,o]of [0,.75,2,2.75].entries()){if(bar===3&&i>1)continue;add(s,'lead',b+o,.42,degree([0,2,4,3][i]+(bar===2?1:0)),.63+i*.035);}}
 s.sections=[{name:'A · mismo material',start:0,end:8},{name:'A′ · espacio',start:8,end:16}];return finish(s);
}
function phraseScore({mode='dialogue',seed=7,space=.5,answer=.6}={}){
 const s=makeScore('La conversación de las linternas',[track('call','flute','lead',-.25,.8),track('response','clarinet','counter',.32,.72),track('keys','piano','harmony',-.1,.5),track('bass','cello','bass',.1,.48),track('harp','harp','texture',-.35,.4)],8,4,84);
 const skeleton=[[0,0,.9],[1.5,4,.8],[3.25,3,.55],[4.25,1,1.4]];let rng=rand(seed);const phLengths=mode==='asymmetric'?[12,8,12]:[8,8,8,8];let pos=0;
 const labels=mode==='tiled'?['A copiada','A copiada','A copiada','A copiada']:mode==='asymmetric'?['Pregunta larga · 3','Respuesta · 2','Recuerdo · 3']:mode==='breath'?['Aparece','Se aleja','Aire','Regresa']:['Pregunta','Respuesta','Desarrollo','Retorno'];
 phLengths.forEach((span,ph)=>{s.sections.push({name:labels[ph],start:pos,end:pos+span});const start=pos;const developing=mode==='asymmetric'?ph===1:ph===2;
  let cell=skeleton;if(mode==='breath')cell=ph===2?[[.5,4,1.8]]:[[.5,0,1.8],[4.5,3,1.45]];
  for(const[o,d,l]of cell){let lead='call';let deg=d;let beat=start+o;let dur=l;let phr=ph;
   if(mode!=='tiled'&&ph===1){lead='response';deg=d+(d===4?-1:1);beat+=.3;}
   if(mode!=='tiled'&&developing&&mode!=='breath'){deg=d+((seed%3)-1);if(o===1.5)beat+=.5;dur*=.77;}
   if(mode==='asymmetric'&&ph===0&&o===4.25)dur=2.2;
   add(s,lead,beat,dur,degree(deg,lead==='call'?74:62),.7+(ph===2?.06:0),{phrase:phr,protected:ph===0||ph===phLengths.length-1});
  }
  if(mode!=='tiled'&&mode!=='breath'){
   const b=start+span-2.1;let steps=1+Math.round(answer*3);for(let i=0;i<steps;i++)add(s,ph===1?'call':'response',b+i*.45,.35,degree((ph===phLengths.length-1?0:2)+i*(developing&&seed%2===0?-1:1),ph===1?74:62),.49,{phrase:ph,decision:'respuesta en hueco'});
  }
  if(mode==='asymmetric'&&ph!==1){add(s,'harp',start+8,.8,degree(4,62),.46);add(s,'harp',start+9.25,1.25,degree(2,62),.38);}
  pos+=span;
 });
 for(let bar=0;bar<8;bar++){let b=bar*4,c=CHORDS[Math.floor(bar/2)];if(mode==='breath'&&(bar===4||bar===5))continue;
  add(s,'bass',b,mode==='tiled'?3.6:2.65,c[0]-12,.62);const entrances=mode==='tiled'?[0,2]:[.7];for(const o of entrances)c.slice(1,4).forEach((n,i)=>add(s,'keys',b+o+i*.035,mode==='tiled'?1.5:2.15*(1-space*.45),n,.42));
  if(mode==='tiled'){for(let j=0;j<8;j++)add(s,'harp',b+j*.5,.34,c[1+j%3]+12,.32);}else if(bar%2===1&&mode!=='breath'){let h=b+3.35;if(space<.8)add(s,'harp',h,.45,c[2]+12,.3);}
 }
 return finish(s);
}
const GENRES={
 neo:{label:'Neo-soul / pocket',bpm:88,bar:4,lead:'epiano',bass:'slap_bass',comp:'guitar',scale:'dorian',rhythm:'backbeat flexible',harmony:'voicings abiertos con 7ª y 9ª',phrasing:'gesto corto, respuesta tardía',silence:'respiración antes del retorno',knowledge:'Interpretación diseñada para este boceto; no un clon de un productor.',sources:['S01','S02','S21']},
 dub:{label:'Dub / espacio',bpm:78,bar:4,lead:'organ',bass:'bass',comp:'muted_guitar',scale:'minor',rhythm:'contratiempos y apoyo en 3',harmony:'centro estable, bajo protagonista',phrasing:'entradas y retiradas',silence:'huecos con ecos discretos escritos',knowledge:'Aquí los ecos son eventos de nota explícitos, no feedback de cinta.',sources:['S04']},
 garage:{label:'UK garage / 2-step',bpm:128,bar:4,lead:'vibes',bass:'synth_bass',comp:'epiano',scale:'minor',rhythm:'bombo roto y hi-hat con swing',harmony:'stabs breves y registro reservado',phrasing:'frases sincopadas',silence:'vacíos entre graves',knowledge:'Boceto de relaciones rítmicas; no recrea samples vocales ni un track existente.',sources:['S03']},
 footwork:{label:'Footwork / pulsos partidos',bpm:156,bar:4,lead:'pulse25',bass:'sub',comp:'clav',scale:'darkpent',rhythm:'ráfagas ternarias y huecos',harmony:'célula mínima en lugar de rueda larga',phrasing:'fragmentación y medio tiempo',silence:'cortes antes de ráfagas',knowledge:'Una interpretación original, no una transcripción ni definición exhaustiva de footwork.',sources:['S05']},
 interlock:{label:'Entrelazado / inspiración gamelan',bpm:106,bar:4,lead:'metallophone',bass:'drone',comp:'kalimba',scale:'pent',rhythm:'dos partes complementarias',harmony:'centro y ciclo',phrasing:'una línea repartida',silence:'cada voz deja huecos a la otra',knowledge:'Afinación temperada de boceto: NO emula sléndro/pélog, kotekan tradicional ni un gamelan real.',sources:['S06']},
 minimal:{label:'Minimalismo / proceso',bpm:96,bar:4,lead:'piano',bass:'drone',comp:'vibes',scale:'lydian',rhythm:'célula que crece por adición',harmony:'campo estable',phrasing:'transformación acumulativa',silence:'retirar ataques revela otra figura',knowledge:'Proceso discreto original; no pretende reproducir una obra de Reich.',sources:['S07']},
 bossa:{label:'Bossa / conversación ligera',bpm:104,bar:4,lead:'flute',bass:'bass',comp:'guitar',scale:'major',rhythm:'bajo regular y acordes sincopados',harmony:'acordes extendidos suaves',phrasing:'cantabile con respuestas',silence:'dejar aire entre frases',knowledge:'Estudio sintético aproximado; no certifica una interpretación brasileña idiomática.',sources:['S20','S16']},
 tango:{label:'Tango / gesto y suspensión',bpm:108,bar:4,lead:'accordion',bass:'bass',comp:'piano',scale:'minor',rhythm:'apoyos marcados y anticipaciones',harmony:'dirección menor y llegada',phrasing:'staccato frente a línea ligada',silence:'cortes dramáticos de conjunto',knowledge:'El acordeón no es un bandoneón; gesto original no tradicional ni autenticidad certificada.',sources:['S09']},
 ambient:{label:'Ambient / respiraciones',bpm:62,bar:4,lead:'harp',bass:'drone',comp:'choir_a',scale:'lydian',rhythm:'eventos espaciados sin batería',harmony:'color sostenido',phrasing:'gestos que aparecen y desaparecen',silence:'vacíos estructurales',knowledge:'Campo determinista en una ventana finita; no promete generación infinita.',sources:['S10','S22']},
 broken:{label:'Broken beat / deriva',bpm:116,bar:4,lead:'clav',bass:'slap_bass',comp:'epiano',scale:'dorian',rhythm:'acentos desplazados y respuesta de graves',harmony:'voicings cortos',phrasing:'el patrón cambia de función',silence:'huecos compartidos entre roles',knowledge:'Boceto contemporáneo de desplazamientos, no un preset histórico universal.',sources:['S11']}
};
function genreScore({genre='neo',melodyGenre='same',density=.52,seed=17}={}){
 const g=GENRES[genre];if(!g)throw Error('Unknown genre');const mg=GENRES[melodyGenre]||g;const s=makeScore(`${g.label}${mg!==g?' × '+mg.label:''}`,[track('lead',mg.lead,'lead',.2,.72),track('comp',g.comp,'harmony',-.3,.55),track('bass',g.bass,'bass',0,.64),track('kick','kick','drums',0,.48),track('snare',genre==='bossa'?'rim':'snare','drums',.1,.27),track('hat',genre==='bossa'?'shaker':'hat','drums',.42,.21)],8,4,g.bpm);
 const sc=SCALES[g.scale],rng=rand(seed);const roots=genre==='minimal'||genre==='interlock'||genre==='footwork'?[0,0,0,0]:[0,5,3,4];
 const rhythm={neo:{k:[0,1.75,2.5],s:[1,3],c:[.25,1.75,3],bass:[0,.75,2.5,3.25]},dub:{k:[2],s:[2],c:[.5,1.5,2.5,3.5],bass:[.75,1.5,2.75]},garage:{k:[0,1.5,2.75],s:[1,3],c:[.75,2.25,3.5],bass:[0,1.75,3.25]},footwork:{k:[0,.6667,2.3333,3.3333],s:[2],c:[0,1.3333,2.6667],bass:[0,2]},interlock:{k:[],s:[],c:[.5,1.5,2.5,3.5],bass:[0]},minimal:{k:[],s:[],c:[.5,2,3.5],bass:[0]},bossa:{k:[0,2],s:[.75,2,3.5],c:[0,.75,2.25,3],bass:[0,2]},tango:{k:[],s:[],c:[0,1,2,3],bass:[0,1,2,3]},ambient:{k:[],s:[],c:[],bass:[]},broken:{k:[0,1.25,2.75],s:[1.5,3],c:[.25,1.5,2.75],bass:[0,1.25,2.5,3.75]}}[genre];
 s.sections=[{name:'Presentar',start:0,end:8},{name:'Contestar',start:8,end:16},{name:'Cambiar función',start:16,end:24},{name:'Volver / soltar',start:24,end:32}];
 for(let bar=0;bar<8;bar++){const b=bar*4,rr=roots[Math.floor(bar/2)],rootBass=degree(rr,38,sc);const chord=[0,2,4,6].map(d=>degree(rr+d,50,sc));
  if(genre==='ambient'){if(bar%2===0){add(s,'bass',b,6.7,38,.44);[62,66,69].forEach((n,i)=>add(s,'comp',b+1.2+i*.12,5.4,n,.34));}if(bar===4)continue;}
  else{for(const[o,i]of rhythm.bass.map((o,i)=>[o,i]))add(s,'bass',b+o,genre==='interlock'||genre==='minimal'?3.6:genre==='dub'?.85:.42,rootBass+(i===2?7:0),.65+(i===0?.1:0));
   if(genre==='interlock'){for(let i=0;i<4;i++)add(s,'comp',b+.5+i, .28,degree([1,4,2,3][i],62,sc),.48);}
   else if(genre==='minimal'){let len=3+Math.floor(bar/2);for(let i=0;i<len;i++)add(s,'comp',b+i*.5,.33,degree([0,2,4,3,1,5][i%6],62,sc),.48);}
   else for(const o of rhythm.c){if((bar===7&&o>1.5)||(density<.4&&o>2.9))continue;chord.slice(1,4).forEach((n,i)=>add(s,'comp',b+o+i*.018,genre==='tango'?.17:genre==='bossa'?.62:.38,n,.52));}
   rhythm.k.forEach(o=>add(s,'kick',b+o,.11,36,.75));rhythm.s.forEach(o=>add(s,'snare',b+o,.11,resolve(s.tracks[4].patch).midi,.55));
   if(!['interlock','minimal','tango'].includes(genre)){let hatCount=density>.72?16:8;for(let i=0;i<hatCount;i++){if(genre==='dub'&&i%2===0)continue;let o=i*4/hatCount;add(s,'hat',b+o,.06,42,i%2?.33:.42);}}
  }
 }
 const which=melodyGenre==='same'?genre:melodyGenre;
 for(let phrase=0;phrase<4;phrase++){const b=phrase*8;let pattern;
 switch(which){
 case 'ambient':pattern=[[.75,0,1.8],[4.5,4,2.4]];if(phrase===2)pattern=[];break;
 case 'dub':pattern=[[.75,0,.38],[2.5,2,.42],[5.5,4,.6]];break;
 case 'garage':pattern=[[.5,0,.3],[1.75,2,.35],[3.25,4,.45],[5.5,1,.32],[6.75,3,.4]];break;
 case 'footwork':pattern=[[0,0,.19],[.6667,0,.18],[1.3333,3,.21],[4,2,.25],[4.6667,1,.2],[5.3333,0,.2]];break;
 case 'interlock':pattern=Array.from({length:8},(_,i)=>[i, [0,2,1,4,3,2,1,0][i],.33]);break;
 case 'minimal':pattern=Array.from({length:3+phrase},(_,i)=>[i*.75,[0,2,4,3,1,2][i],.44]);break;
 case 'tango':pattern=[[0,0,.2],[.75,1,.2],[1.5,2,.25],[3,4,1.4],[5.25,3,.25],[6,1,.7]];break;
 case 'bossa':pattern=[[.5,0,.65],[1.75,2,.5],[2.5,3,.6],[4.5,5,.9],[6.25,2,.8]];break;
 case 'broken':pattern=[[.25,0,.28],[1,2,.33],[2.75,4,.46],[4.25,3,.42],[5.75,1,.6]];break;
 default:pattern=[[.25,0,.52],[1.5,2,.45],[3.25,4,.85],[5.5,3,.5],[6.5,1,.65]];
 }
 for(let i=0;i<pattern.length;i++){const[o,d,l]=pattern[i];if(i>2&&density<.22)continue;let delta=phrase===2&&i===2?((seed%3)-1):0;let dd=d+delta; if(phrase===3&&i===pattern.length-1)dd=0;add(s,'lead',b+o,l,degree(dd,62,sc),.69+.06*Math.sin(i),{phrase});
  if(which==='dub'&&i===1){add(s,'lead',b+o+.75,l*.8,degree(dd,62,sc),.23,{articulation:'echo'});add(s,'lead',b+o+1.5,l*.7,degree(dd,62,sc),.12,{articulation:'echo'});}}
 }
 s.grammar={rhythm:genre,melody:which,claims:'original sketch, not authenticity certification',sourceIds:[...new Set([...g.sources,...mg.sources])]};
 s.tracks=s.tracks.filter(t=>s.events.some(e=>e.track===t.id));return applyPerformance(finish(s),'pocket',.52,genre==='garage'?.35:genre==='neo'?.12:.0,seed);
}
function gcd(a,b){while(b){[a,b]=[b,a%b];}return a;}const lcm=(a,b)=>a/gcd(a,b)*b;
function euclid(steps,hits,rotate=0){if(!Number.isInteger(steps)||steps<1||steps>32||!Number.isInteger(hits)||hits<0||hits>steps)throw Error('Invalid cycle');return Array.from({length:steps},(_,i)=>mod((i-rotate)*hits,steps)<hits);}
function cycleScore({periods=[8,12,16],hits=[3,5,5],rotations=[0,1,3],spacing=.5,method='interlock',seed=7}={}){
 if(!Array.isArray(periods)||periods.length!==3||!Array.isArray(hits)||hits.length!==3||!Array.isArray(rotations)||rotations.length!==3||periods.some(n=>!Number.isInteger(n)||n<1||n>32)||rotations.some(n=>!Number.isInteger(n)))throw Error('Se necesitan tres ciclos enteros de 1–32 pasos.');
 periods.forEach((n,i)=>euclid(n,hits[i],rotations[i]));
 const common=method==='hocket'?lcm(periods.reduce(lcm),3):periods.reduce(lcm),maxSteps=192;if(common>maxSteps)throw Error(`Ciclo común ${common} pasos: elegí longitudes con MCM ≤ ${maxSteps}. No se corta el loop en silencio.`);
 if(![.25,.5,1].includes(spacing))throw Error('Invalid spacing');
 const steps=common*Math.ceil(16/common),beats=steps*spacing,s=makeScore('Tres voces, un ciclo común',[track('a','kalimba','lead',-.55,.62),track('b','vibes','counter',.42,.48),track('c','harp','rhythm',.05,.5)],beats/4,4,92);
 s.cycles={periods,hits,rotations,commonSteps:common,windowSteps:steps,spacing,method};const scale=SCALES.darkpent;
 for(let lane=0;lane<3;lane++){const n=periods[lane],mask=euclid(n,hits[lane],rotations[lane]);let note=0;
  for(let i=0;i<steps;i++){let play=mask[i%n];if(method==='hocket'){play=mod(i,3)===lane&&mask[i%n];}else if(method==='additive'){const cycle=Math.floor(i/n);play=play&&i%n<Math.min(n,3+cycle*2);}
   if(play){const d=[0,2,1,3,4,2,1][mod(note+lane+(seed%2),7)];add(s,['a','b','c'][lane],i*spacing,spacing*.78,degree(d,62+(lane===1?0:lane===2?-12:0),scale),.66+(note%3===0?.1:0),{step:i,cycle:Math.floor(i/n)});note++;}}
 }
 s.sections=Array.from({length:Math.ceil(beats/4)},(_,i)=>({name:`${i+1}`,start:i*4,end:Math.min(beats,i*4+4)}));return finish(s);
}
function importScore(raw,index=0){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Se esperaba un objeto JSON.');
 if(raw.kind==='gmc-brainstorm-session')raw=raw.score;
 if(!raw||typeof raw!=='object')throw Error('Sesión sin score.');
 const source=Array.isArray(raw.styles)?raw.styles[index]:raw;
 if(!source||!Array.isArray(source.events)||!source.events.length||source.events.length>18000)throw Error('El score necesita entre 1 y 18000 eventos.');
 if(typeof source.beats!=='number'||!Number.isFinite(source.beats)||source.beats<=0||source.beats>512)throw Error('Duración no válida (máximo 512 beats).');
 if(typeof source.bpm!=='number'||!Number.isFinite(source.bpm)||source.bpm<30||source.bpm>260)throw Error('Tempo no válido (30–260).');
 const semantic=source.kind==='gmc-brainstorm-score';let trackMap=new Map(),fallbacks=new Set();
 if(semantic){if(!Array.isArray(source.tracks)||source.tracks.length>80)throw Error('Pistas inválidas.');for(const t of source.tracks){if(!t||typeof t.id!=='string'||trackMap.has(t.id))throw Error('ID de pista duplicado/inválido.');const p=resolve(t.patch);if(p.fallback)fallbacks.add(t.patch);trackMap.set(t.id,{...track(t.id,p.id,String(t.role||'harmony'),clamp(Number(t.pan)||0,-1,1),clamp(Number(t.volume??.7),0,1)),label:String(t.label||p.label).slice(0,100)});}}
 const events=[];for(let i=0;i<source.events.length;i++){
  const e=source.events[i];if(!e||typeof e!=='object')throw Error(`Evento ${i} inválido.`);
  const id=String(semantic?e.track:e.inst);if(!trackMap.has(id)){if(semantic)throw Error('Evento apunta a pista desconocida.');const info=source.instrument_map?.[id]||{};const p=resolve(id,info);if(p.fallback)fallbacks.add(id);trackMap.set(id,{...track(id,Object.hasOwn(INST,id)?id:p.sound==='piano'?'piano':p.surface==='drum'?'wood':Object.keys(INST).find(k=>INST[k].sound===p.sound)||'piano',String(e.role||'harmony'),clamp(Number(e.pan)||0,-1,1),.62),label:String(info.label||id).slice(0,100),sourceInstrument:id});}
  let beat=e.beat,duration=e.duration??(e.kind==='drum'?.12:.3),midi=e.midi??DM[e.inst]??60;const perf=semantic?e.performedBeat:e.performance_beat;
  if([beat,duration,midi].some(x=>typeof x!=='number'||!Number.isFinite(x))||beat<0||beat>=source.beats||duration<=0||duration>512||midi<0||midi>127)throw Error(`Tiempo/nota inválida en evento ${i}.`);
  let pb=perf??beat,pd=(semantic?e.performedDuration:e.performance_duration)??duration;
  if(!Number.isFinite(pb)||pb<0||pb>=source.beats||!Number.isFinite(pd)||pd<=0||pd>512)throw Error('Interpretación fuera de rango.');if(Math.min(pd,source.beats-pb)*60/source.bpm>14)throw Error('Esta síntesis de boceto admite notas de hasta 14 segundos. Dividí explícitamente las notas largas antes de importarlas.');
  let v=semantic?(e.velocity??.7):(e.velocity??80)/127;if(semantic&&e.performedVelocity!==undefined&&(!Number.isFinite(e.performedVelocity)||e.performedVelocity<0||e.performedVelocity>1))throw Error('Velocity interpretada inválida.');if(!Number.isFinite(v)||v<0||v>1)throw Error('Velocity inválida.');
  events.push({id:`import:${i}`,track:id,patch:trackMap.get(id).patch,role:trackMap.get(id).role,beat,duration:Math.min(duration,source.beats-beat),midi:Math.round(midi),velocity:clamp(v,.04,1),performedBeat:pb,performedDuration:Math.min(pd,source.beats-pb),performedVelocity:semantic?clamp(Number(e.performedVelocity??v),.04,1):clamp(v,.04,1),articulation:String(e.articulation||'normal').slice(0,40)});
 }
 if(trackMap.size>80)throw Error('Máximo 80 pistas.');const bl=typeof source.barLength==='number'&&Number.isFinite(source.barLength)&&source.barLength>0?source.barLength:4;
 const s={...makeScore(String(source.title||'Score importado').slice(0,120),[...trackMap.values()],source.beats/bl,bl,source.bpm),events,meter:typeof source.meter==='string'&&/^[1-9][0-9]?\/(2|4|8|16)$/.test(source.meter)?source.meter:(bl===3?'6/8':'4/4'),origin:'imported-symbolic-score',importReport:{events:events.length,tracks:trackMap.size,fallbacks:[...fallbacks],losses:['Timbres sintetizados; no carga Factory Bank ni samples del JSON','No replica CC, sample offsets, buses ni toda la interpretación Neo-SPC','Las duraciones se limitan a la ventana declarada; no preserva colas escritas fuera de ella'],sourceId:String(source.id||'unknown')}};
 return finish(s);
}
function metrics(s){const ev=s.events;const offsets=ev.map(e=>(mod((e.performedBeat??e.beat)-e.beat+s.beats/2,s.beats)-s.beats/2)*60000/s.bpm);const mean=offsets.reduce((a,b)=>a+b,0)/Math.max(1,ev.length);const std=Math.sqrt(offsets.reduce((a,b)=>a+(b-mean)**2,0)/Math.max(1,ev.length));let active=new Set();const grid=.125;let allSilent=0;for(let b=0;b<s.beats;b+=grid){if(!ev.some(e=>!resolve(e.patch).drum&&(e.beat<=b&&e.beat+e.duration>b)))allSilent++;}return{notes:ev.length,tracks:s.tracks.length,timingStd:std,meanOffset:mean,silence:allSilent/(s.beats/grid),seconds:s.beats*60/s.bpm};}
function scoreSignature(s){return JSON.stringify(s.events.map(e=>[e.track,e.beat,e.duration,e.midi,e.velocity]));}
function performanceSignature(s){return JSON.stringify(s.events.map(e=>[e.track,e.performedBeat,e.performedDuration,e.midi,e.performedVelocity]));}
const api={INST,GENRES,SCALES,DM,resolve,clamp,mod,copy,hash,rand,noteName,degree,track,makeScore,add,finish,studioScore,pocketScore,applyPerformance,phraseScore,genreScore,cycleScore,euclid,lcm,importScore,metrics,scoreSignature,performanceSignature};if(typeof module!=='undefined')module.exports=api;else root.MusicLab=api;
})(typeof globalThis!=='undefined'?globalThis:this);
