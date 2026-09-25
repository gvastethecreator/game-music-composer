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
const api={toNative,SOUND_TO_PATCH,peakVoices};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.GMCNativeBridge=api;
})(globalThis);
