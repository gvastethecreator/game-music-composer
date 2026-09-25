/* Engine song -> native Neo-SPC score, so a Create song plays with the sample
   banks, opens in the Studio piano roll and exports for the skill. The engine
   score is the source: every event comes from scoreEvents(), including arps,
   performance, swing and humanization. Muted tracks are not exported. */
(function(root){
'use strict';
const PITCH_NAMES=['C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B'];
// Closest sampled studio instrument for each synthesized timbre.
const SOUND_TO_PATCH={
 kickRound:'kick',kick808:'kick',kickTight:'kick',kick909:'kick',kickDeep:'kick',kickPunch:'kick',kick7:'kick',
 snareDust:'snare',snareBrush:'snare',clap:'snare',snare909:'snare',snareRoom:'snare',clapWide:'snare',snare7:'snare',
 hatSoft:'hat',hatMetal:'hat',hat909:'hat',hatGrain:'hat',shaker:'shaker',
 openSoft:'open_hat',openMetal:'open_hat',open909:'open_hat',
 rim:'rim',conga:'tom',tabla:'tom',tom:'tom',wood:'wood',claves:'wood',cowbell:'wood',metalPerc:'wood',ride:'ride',
 sub:'sub',analog:'synth_bass',acid:'synth_bass',fmbass:'synth_bass',reese:'synth_bass',rubber:'synth_bass',mono7:'synth_bass',organbass:'bass',
 electric:'epiano',velvetEP:'epiano',ep7:'epiano',softkeys:'piano',pianoModal:'piano',organ:'organ',pluck:'guitar',nylon:'guitar',dulcimer:'harp',marimba:'metallophone',
 tape:'synth_pad',airPad:'synth_pad',pwmPad:'synth_pad',strings:'strings',supersaw:'strings',choir:'choir_a',
 glass:'bell',bell:'bell',chip:'pulse25',fmPluck:'kalimba',kalimba:'kalimba',syncLead:'synth_lead',brass:'brass',
 sinelead:'ocarina',flute:'flute',reed:'reed'
};
const ROLE={kick:'kick',snare:'snare',hat:'hat',open:'hat',perc:'rim',bass:'bass',keys:'comp',pad:'pad',arp:'arp',lead:'lead'};
// open -> open_hat keeps the live engine's closed/open hat choke.
const INST={open:'open_hat'};
const round=(x,n=6)=>Math.round(x*10**n)/10**n;
const mod=(x,n)=>((x%n)+n)%n;

function peakVoices(events,beats){
 const edges=[];
 for(const e of events){const b=e.performance_beat,d=Math.min(beats,e.performance_duration);edges.push([b,1],[Math.min(beats,b+d),-1]);if(b+d>beats)edges.push([0,1],[b+d-beats,-1]);}
 edges.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);let count=0,peak=0;for(const [,delta] of edges){count+=delta;peak=Math.max(peak,count);}return peak;
}

function toNative(E,s,{instruments,category,id,title,labels}={}){
 if(!instruments)throw new Error('Studio instrument mappings are not loaded.');
 const spb=60/s.bpm,steps=E.totalBars(s)*16,beats=steps/4,events=[],used=new Set();
 for(let step=0;step<steps;step++)for(const e of E.scoreEvents(step,s)){
  const drum=E.data.trackMap[e.id].drum,inst=INST[e.id]||e.id,v=Math.max(1,Math.min(127,Math.round(e.v*127)));
  e.n.forEach((midi,i)=>{
   const at=mod(step/4+(e.offset+i*e.strum)/spb,beats),dur=Math.max(.02,e.d/spb);
   // Written position on a 1/48-beat grid; the exact played position stays in performance_beat.
   events.push({kind:drum?'drum':'note',inst,midi,beat:mod(Math.round(at*48)/48,beats),duration:round(dur),performance_beat:round(at),performance_duration:round(dur),velocity:v,velocity_norm:round(v/127),velocity_gain:round(v/100),pan:e.tr.pan,role:ROLE[e.id]});
  });
  used.add(e.id);
 }
 if(!events.length)throw new Error('Every track is muted or empty.');
 const instrument_map={},track_mix={};
 for(const tr of s.tracks){if(!used.has(tr.id))continue;const patch=SOUND_TO_PATCH[tr.sound],info=instruments[patch];if(!info)throw new Error('No sampled instrument for '+tr.sound);
  const inst=INST[tr.id]||tr.id;instrument_map[inst]={...JSON.parse(JSON.stringify(info)),atelier_patch:patch,label:labels?.(tr)||info.label,engine_sound:tr.sound};
  track_mix[inst]={gain:tr.volume,send:tr.send};}
 const peak=peakVoices(events,beats);
 if(peak>32)throw new Error(`This song peaks at ${peak} simultaneous notes; the Studio sample player allows 32. Mute a dense track or lower density, then try again.`);
 const form=s.structure==='journey'?['Intro','Theme','Break','Return'].map((name,i)=>({name,start_bar:i*s.bars,bars:s.bars})):[{name:'A',start_bar:0,bars:s.bars/2},{name:'A2',start_bar:s.bars/2,bars:s.bars/2}];
 const chord_plan=s.degrees.map((_,i)=>{const start=Math.ceil(i*s.bars/s.degrees.length),end=Math.ceil((i+1)*s.bars/s.degrees.length);return{start_bar:start,bars:end-start,symbol:E.labels.chordLabel(i,s)};});
 return{
  id,title,category:category.id,category_label:category.label,subcategory:'Create · engine song',
  description:'Composed in Create with the synthesis engine; here it plays through the sampled banks.',
  key:PITCH_NAMES[s.root],mode:s.scale,key_source:'engine',meter:'4/4',bpm:s.bpm,beats,barLength:4,bars:beats/4,
  voice_budget:32,measured_peak_voices:Math.max(1,peak),form,chord_plan,instrument_map,track_mix,events,
  tags:['create','engine'],generator:{id:'gmc-studio-engine',version:E.version,seed:s.seed,mutation:s.mutation,preset:s.preset},
  musical_direction:{thesis:'Engine sketch; review before production.'}
 };
}
// ── Native score -> engine project ───────────────────────────────────────────
// A catalog cue keeps its notes and played timing; the engine supplies synthesis,
// channel strips, buses and master. Each instrument joins one of the ten engine
// tracks by role; its family picks the closest synthesized timbre.
const ROLE_TO_TRACK={kick:'kick',snare:'snare',hat:'hat',shaker:'hat',open_hat:'open',tom:'perc',rim:'perc',wood:'perc',ride:'open',brush:'snare',impact:'kick',bass:'bass',lead:'lead',counter:'arp',arp:'arp',riff:'arp',motor:'arp',ostinato:'arp',pulse:'arp',comp:'keys',support:'pad',pad:'pad',ensemble:'pad',texture:'pad'};
const FAMILY_TO_TRACK={drum:'perc',bass:'bass',strings:'pad',choir:'pad',texture:'pad',keys:'keys',guitar:'keys',wind:'lead',brass:'lead',mallet:'arp',pluck:'arp',synth:'lead'};
const TIMBRE={
 lead:{wind:i=>/reed|clarinet|bassoon/.test(i)?'reed':'flute',brass:()=>'brass',synth:i=>/pulse/.test(i)?'chip':'syncLead',keys:()=>'pianoModal',mallet:()=>'kalimba',pluck:()=>'fmPluck',guitar:()=>'fmPluck',strings:()=>'sinelead',choir:()=>'sinelead'},
 arp:{guitar:()=>'nylon',pluck:i=>/harp/.test(i)?'dulcimer':'pluck',mallet:i=>/bell/.test(i)?'bell':'marimba',synth:i=>/pulse/.test(i)?'chip':'fmPluck',keys:()=>'velvetEP',strings:()=>'pluck',wind:()=>'kalimba',brass:()=>'brass'},
 keys:{keys:i=>/organ|accordion/.test(i)?'organ':/harpsichord|clav/.test(i)?'dulcimer':/epiano/.test(i)?'velvetEP':'pianoModal',guitar:()=>'nylon',mallet:()=>'marimba',pluck:()=>'pluck',synth:()=>'electric'},
 pad:{strings:()=>'strings',choir:()=>'choir',synth:()=>'airPad',texture:()=>'tape',keys:i=>/organ|accordion/.test(i)?'organ':'tape',brass:()=>'supersaw',wind:()=>'airPad'},
 bass:{bass:i=>/slap/.test(i)?'rubber':/sub|triangle/.test(i)?'sub':/synth/.test(i)?'analog':'organbass'}
};
const SCALE={minor:'minor',major:'major',dorian:'dorian',phrygian:'phrygian',mixolydian:'mixolydian',lydian:'lydian',harmonic_minor:'harmonic',melodic_minor:'melodic',whole_tone:'whole',octatonic:'hungarian',locrian:'locrian',blues:'blues',pentatonic_minor:'pentminor',pentatonic_major:'pentmajor'};
const ALLOWED_BARS=[1,2,3,4,6,8,12,16,24,32,48,64];
const STYLE_PRESET={salsa:'bossa',cumbia:'afro',bachata:'bossa',bossa_nova:'bossa',tango:'cinema',funk:'funk',house:'micro',dnb:'liquid',synthwave:'synthwave',lofi:'lofi',trap:'trap',trip_hop:'nocturne',metal:'breakbeat',reggaeton:'reggaeton',action:'techno',towns:'soul',mystery:'cinema',horror:'cinema',emotion:'ambient',fantasy:'ritual',electronic:'electro',urban:'soul',classical:'ambient',adventure:'ambient'};

function trackFor(event,info){return ROLE_TO_TRACK[event.inst]||ROLE_TO_TRACK[event.role]||FAMILY_TO_TRACK[info?.family]||'keys';}
function fromNative(E,native,{seed='CATALOG'}={}){
 // The engine loops whole 4/4 phrases of allowed lengths. Pick the length that needs the least
 // stretch while the scaled tempo stays in 45-190 BPM; real-time length is kept.
 const steps=Math.round(native.beats*4),fits=ALLOWED_BARS.map(b=>({b,stretch:b*16/steps})).filter(x=>native.bpm*x.stretch>=45&&native.bpm*x.stretch<=190);
 const {b:bars,stretch}=(fits.length?fits:[{b:ALLOWED_BARS.find(b=>b*16>=steps)||64,stretch:(ALLOWED_BARS.find(b=>b*16>=steps)||64)*16/steps}]).sort((x,y)=>Math.abs(Math.log(x.stretch))-Math.abs(Math.log(y.stretch)))[0];
 const preset=STYLE_PRESET[native.category]||'nocturne',s=E.compose(seed,preset);
 s.bpm=Math.max(45,Math.min(190,Math.round(native.bpm*stretch)));s.root=Math.max(0,PITCH_NAMES.indexOf(native.key));s.scale=SCALE[native.mode]||(/min/.test(native.mode)?'minor':'major');
 s.bars=bars;s.structure='loop';s.human=0;s.swing=0;s.mutation=0;s.seed=String(seed).slice(0,64);
 if(s.degrees.length>bars){s.progression='custom';s.degrees=s.degrees.slice(0,Math.max(2,Math.min(bars,4)));s.chordEdits=null;}
 const byTrack={},families={};
 native.events.forEach((e,i)=>{const info=native.instrument_map[e.inst],track=trackFor(e,info),drum=E.data.trackMap[track].drum;
  const t=Number(e.performance_beat??e.beat)*4*stretch,d=Math.max(.05,Number(e.performance_duration??e.duration??.25)*4*stretch);
  if(!(t>=0&&t<bars*16))return;
  (byTrack[track]||=[]).push({id:'c'+i,t:Math.round(t*10000)/10000,p:drum?E.data.trackMap[track].midi:Math.max(12,Math.min(119,Math.round(Number(e.midi??info.root_midi??60)))),d:Math.min(bars*16,Math.round(d*10000)/10000),v:Math.max(.01,Math.min(1,Number(e.velocity??80)/127))});
  const f=(families[track]||={});f[info.family+'|'+e.inst]=(f[info.family+'|'+e.inst]||0)+1;});
 s.studio.clips={};s.studio.bindings={};s.studio.sections=[];s.studio.selectedSection=null;s.studio.playMode='phrase';s.studio.automation=[];
 for(const tr of s.tracks){
  s.patterns[tr.id]=Array.from({length:bars},()=>Array(16).fill(null));
  tr.performance={...tr.performance,mode:'original'};tr.arp={...tr.arp,enabled:false};tr.octave=0;tr.locked=false;tr.arpLock=null;
  const notes=byTrack[tr.id];if(!notes){tr.mute=true;continue;}tr.mute=false;
  const [family,inst]=Object.entries(families[tr.id]).sort((a,b)=>b[1]-a[1])[0][0].split('|'),pick=TIMBRE[tr.id]?.[family]?.(inst);
  if(pick&&E.data.trackMap[tr.id].voices.includes(pick))tr.sound=pick;
  const id='clip_'+tr.id;s.studio.clips[id]={id,track:tr.id,name:(native.title||'Catalog cue')+' · '+tr.id,length:bars*16,timing:'baked',notes:notes.slice(0,8192).map(n=>({...n,prob:1,every:1,phase:0,fill:false,ratchet:1,flam:0,anchor:false})),origin:{label:'GMC catalog',seed:'',sourceClip:null},recipe:null};
  s.studio.bindings[tr.id]=id;}
 s.session={...(s.session||{}),name:native.title||'Catalog cue'};
 return E.validateProject({schema:'umbra-project',version:8,state:s});
}
const api={toNative,fromNative,SOUND_TO_PATCH,peakVoices};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.GMCNativeBridge=api;
})(globalThis);
