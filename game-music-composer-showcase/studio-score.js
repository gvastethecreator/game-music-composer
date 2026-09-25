/* Native score operations. The studio keeps Neo-SPC events and sample metadata. */
(function(root){
'use strict';
const copy=x=>JSON.parse(JSON.stringify(x));
const mod=(x,n)=>(x%n+n)%n;
function fromNative(native){
  const ids=[...new Set(native.events.map(e=>e.inst))];
  return {title:native.title,bpm:native.bpm,beats:native.beats,barLength:native.barLength||4,
    tracks:ids.map(id=>({id,patch:native.instrument_map[id].atelier_patch||id,label:native.instrument_map[id].label||id,role:native.events.find(e=>e.inst===id).role||'support'})),
    events:native.events.map((e,i)=>({id:String(i),track:e.inst,patch:native.instrument_map[e.inst].atelier_patch||e.inst,role:e.role||'support',midi:e.midi??native.instrument_map[e.inst].root_midi,beat:e.beat,duration:e.duration??.14,velocity:(e.velocity??80)/127,performedBeat:e.performance_beat??e.beat,performedDuration:e.performance_duration??e.duration??.14,performedVelocity:(e.velocity??80)/127}))};
}
function draft(native){
  const s=copy(native);s.source_type='local_import';s.studio_source_id=native.studio_source_id||native.id;
  s.kicker='LOCAL DRAFT · '+s.meter;s.composition_quality={status:'unreviewed'};
  delete s.professor_review_pass1;delete s.professor_review_final;
  return s;
}
function measure(s){
  const edges=[];
  for(const e of s.events){const b=e.performance_beat??e.beat,d=Math.min(s.beats,e.performance_duration??e.duration??.14);edges.push([b,1],[Math.min(s.beats,b+d),-1]);if(b+d>s.beats)edges.push([0,1],[b+d-s.beats,-1]);}
  edges.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);let count=0,peak=0;for(const [,delta] of edges){count+=delta;peak=Math.max(peak,count);}s.measured_peak_voices=peak;return s;
}
function generated(score,instruments,id,category){
  const s={id,title:score.title,category:category.id,category_label:category.label,subcategory:'Atelier sketch',description:'A local sketch. Edit the notes, shape the performance and compare live soundbanks.',key:'D',mode:'dorian',meter:score.meter,bpm:score.bpm,beats:score.beats,bars:score.bars,barLength:score.barLength,voice_budget:32,form:'A A2 B A3',chord_plan:[],instrument_map:{},events:[],tags:['atelier'],musical_direction:{thesis:'Exploratory composition; review before production.'},studio_sections:copy(score.sections||[])};
  // Authored balance travels as track_mix (linear gain, 0 stays silent); velocities are untouched.
  s.track_mix={};
  for(const tr of score.tracks){const info=instruments[tr.patch];if(!info)throw Error('No studio bank mapping for '+tr.patch);s.instrument_map[tr.id]={...copy(info),atelier_patch:tr.patch,label:tr.label};s.track_mix[tr.id]={gain:tr.volume??1,...(tr.send!==undefined?{send:tr.send}:{})};}
  // Atelier generators write on a D tonic; the key is their convention, not an analysis.
  s.key_source='atelier-default';s.generator={id:score.origin||score.kind||'atelier',version:score.version??null,seed:score.seed??null};
  const tracks=new Map(score.tracks.map(t=>[t.id,t]));
  s.events=score.events.map(e=>{const tr=tracks.get(e.track),info=s.instrument_map[e.track],v=Math.round((e.performedVelocity??e.velocity)*127);return{kind:info.family==='drum'?'drum':'note',inst:e.track,midi:e.midi,beat:e.beat,duration:e.duration,performance_beat:e.performedBeat??e.beat,performance_duration:e.performedDuration??e.duration,velocity:v,velocity_norm:v/127,velocity_gain:v/100,pan:tr.pan||0,role:({harmony:'comp',rhythm:'riff',texture:'pad',drums:tr.patch})[tr.role]||tr.role};});
  s.form=(score.sections||[]).map(section=>({name:section.name,start_bar:section.start/score.barLength,bars:(section.end-section.start)/score.barLength}));
  if(s.form.length<2)s.form=[{name:'A',start_bar:0,bars:score.bars/2},{name:'A2',start_bar:score.bars/2,bars:score.bars/2}];
  s.mode=score.mode||'dorian';
  return measure(draft(s));
}
function perform(native,interpreted){
  const s=draft(native);
  s.events.forEach((e,i)=>{const p=interpreted.events[i];const old=e.velocity??80,newVelocity=Math.max(1,Math.round(p.performedVelocity*127));e.performance_beat=p.performedBeat;e.performance_duration=p.performedDuration;e.start_offset_ms=(mod(p.performedBeat-e.beat+s.beats/2,s.beats)-s.beats/2)*60000/s.bpm;e.velocity=newVelocity;e.velocity_norm=newVelocity/127;e.velocity_gain=(e.velocity_gain??old/100)*newVelocity/Math.max(1,old);});
  return measure(s);
}
function edit(native,index,values){
  if(!Number.isInteger(index)||!native.events[index])throw Error('Select a note first.');
  const {midi,beat,duration,velocity}=values;
  if(!Number.isInteger(midi)||midi<0||midi>127||!Number.isFinite(beat)||beat<0||beat>=native.beats||!Number.isFinite(duration)||duration<=0||duration>native.beats||!Number.isInteger(velocity)||velocity<1||velocity>127)throw Error('Use pitch 0–127, a beat inside the loop, a positive duration up to the loop length and velocity 1–127.');
  const s=draft(native),e=s.events[index],old=e.velocity??80,shift=mod((e.performance_beat??e.beat)-e.beat+s.beats/2,s.beats)-s.beats/2,gate=(e.performance_duration??e.duration??.14)/(e.duration??.14);
  Object.assign(e,{midi,beat,duration,velocity,performance_beat:mod(beat+shift,s.beats),performance_duration:duration*gate,velocity_norm:velocity/127,velocity_gain:(e.velocity_gain??old/100)*velocity/Math.max(1,old)});
  return measure(s);
}
const api={fromNative,generated,perform,edit,draft,measure};
if(typeof module!=='undefined')module.exports=api;else root.StudioScore=api;
})(globalThis);
