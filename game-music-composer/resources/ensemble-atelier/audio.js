/* Original compact synthesis: no samples, external libraries or model calls.
   The offline export and live player use the very same voice function. */
(function(root){
'use strict';const M=root.MusicLab;
const TAU=2*Math.PI;
function voiceSamples(patch,midi,duration,velocity,sr=32000){
 const p=M.resolve(patch),sound=p.sound,f=440*2**((midi-69)/12);
 duration=M.clamp(duration,.035,14);velocity=M.clamp(velocity,.04,1);
 let tail=p.drum?.05: .18;
 if(['pad','strings','choir','drone','violin','cello','bowed'].includes(sound))tail=.32;
 let total=p.drum?({kick:.43,snare:.25,hat:.1,open_hat:.5,tom:.45,wood:.16,rim:.1,shaker:.17,ride:.9,impact:.8,brush:.45}[sound]||.25):duration+tail;
 const n=Math.ceil(total*sr),out=new Float32Array(n),r=M.rand(M.hash(`${patch}:${midi}:${duration.toFixed(3)}:${velocity.toFixed(3)}`));
 let phase=0,low=0,prevNoise=0;
 const sustained=['flute','ocarina','reed','clarinet','brass','horn','mutedbrass','violin','cello','strings','bowed','choir','organ','accordion','pad','drone','synth','pulse','analogbass','sub'].includes(sound);
 let attack={flute:.035,ocarina:.025,reed:.03,clarinet:.035,brass:.05,horn:.085,mutedbrass:.045,violin:.09,cello:.11,strings:.14,bowed:.11,choir:.18,organ:.012,accordion:.035,pad:.3,drone:.25,synth:.016,pulse:.009}[sound]||.006;
 let cutoff={guitar:3600,muted:1450,distorted:2850,bass:1900,electricbass:2600,analogbass:1300,sub:380,piano:8000,epiano:5400,flute:6200,ocarina:4200,reed:4800,clarinet:5500,brass:5500,horn:3400,mutedbrass:2200,violin:5200,cello:3200,strings:4800,choir:4600,organ:5600,accordion:4800,pad:3600,drone:1800,clav:4700}[sound]||10500;
 const a=1-Math.exp(-TAU*cutoff/sr);const count=Math.min(32,Math.floor((sr*.43)/f));
 for(let i=0;i<n;i++){
  let t=i/sr,x=0,noise=r()*2-1;
  const vib=(sound==='flute'||sound==='reed'||sound==='violin'||sound==='cello'||sound==='strings'||sound==='choir')?7*Math.sin(TAU*5.15*t)*M.clamp((t-.14)/.16,0,1):0;
  phase+=TAU*f*2**(vib/1200)/sr;
  if(p.drum){
   const bend=2**((midi-p.midi)/12);
   if(sound==='kick'||sound==='impact'){let decay=sound==='impact'?.34:.12;const ph=TAU*bend*(48*t+95*(1-Math.exp(-t*35))/35);x=.88*Math.sin(ph)*Math.exp(-t/decay)+noise*.07*Math.exp(-t/.012);}
   else if(sound==='snare'||sound==='brush'){x=(noise-prevNoise)*.26*Math.exp(-t/(sound==='brush'?.14:.068))+.22*Math.sin(TAU*183*bend*t)*Math.exp(-t/.052);}
   else if(sound==='tom'){x=.8*Math.sin(TAU*bend*(98*t+29*(1-Math.exp(-t*22))/22))*Math.exp(-t/.13)+noise*.055*Math.exp(-t/.025);}
   else if(sound==='wood'||sound==='rim'){x=(Math.sin(TAU*(sound==='wood'?660:950)*bend*t)+.45*Math.sin(TAU*1490*bend*t))*.36*Math.exp(-t/.032)+noise*.09*Math.exp(-t/.005);}
   else if(sound==='ride'){x=(noise-prevNoise)*.10*Math.exp(-t/.25)+.13*(Math.sin(TAU*1739*bend*t)+.3*Math.sin(TAU*3291*bend*t))*Math.exp(-t/.32);}
   else{x=(noise-prevNoise)*.21*Math.exp(-t/(sound==='open_hat'?.16:sound==='shaker'?.05:.023));}
   x*=Math.min(1,t/.0015);
  }else if(['piano','epiano','prepared'].includes(sound)){
   if(sound==='epiano'){x=.72*Math.sin(phase+(1.8*velocity*Math.exp(-t*5))*Math.sin(phase*2)) *Math.exp(-t*.65)+.14*Math.sin(phase*.5)*Math.exp(-t*2.3);}
   else{for(let k=1;k<=Math.min(count,22);k++){const partial=(k===1?1: Math.abs(Math.sin(k*.56))/k)*Math.exp(-k/(5+20*velocity))*Math.exp(-t*(.5+k*.12));const ph=phase*k*Math.sqrt(1+.00007*k*k);if(f*k*Math.sqrt(1+.00007*k*k)<sr*.43)x+=partial*(.76*Math.sin(ph)+.24*Math.sin(ph*1.0009+.12));}x+=noise*.022*velocity*Math.exp(-t/.008)+.04*Math.sin(TAU*277*t)*Math.exp(-t*24);if(sound==='prepared')x+=.18*Math.sin(phase*2.71)*Math.exp(-t*6);x*=.7;}
  }else if(['guitar','muted','distorted','bass','electricbass','harp','pizz','harpsichord','clav','kalimba'].includes(sound)){
   let decay={guitar:1.1,muted:5.4,distorted:.9,bass:.95,electricbass:1.2,harp:.8,pizz:3.5,harpsichord:1.9,clav:3.8,kalimba:1.8}[sound];
   for(let k=1;k<=Math.min(count,sound==='bass'?14:24);k++){const weight=(k===1?1:.8*Math.sin(k*.73)*Math.exp(-k/(5+16*velocity))/k)*Math.exp(-t*(decay+k*.25));x+=Math.sin(phase*k)*weight;}
   x+=noise*.025*velocity*Math.exp(-t/.008)+.045*Math.sin(TAU*(sound==='bass'?103:219)*t)*Math.exp(-t*27);if(sound==='distorted')x=Math.tanh(x*2.2)*.42;else x*=.62;
   if(sound==='kalimba')x+=.19*Math.sin(phase*2.76)*Math.exp(-t*8);
  }else if(['vibes','bell','metal'].includes(sound)){
   const ratios=sound==='vibes'?[1,4,10]:sound==='metal'?[1,2.76,5.4,8.93]:[1,2.01,2.76,4.07,5.41];
   ratios.forEach((k,j)=>{if(f*k<sr*.44)x+=Math.sin(phase*k)*(j===0?.64:.23/(j+1))*Math.exp(-t*(.7+j*1.8));});
  }else if(sound==='flute'||sound==='ocarina'||sound==='clarinet'||sound==='reed'){
   for(let k=1;k<=count;k++){let w=sound==='flute'?Math.exp(-(k-1)*1.4):sound==='ocarina'?Math.exp(-(k-1)*2.4):sound==='clarinet'?(k%2?1:.10)/k**1.3:(.7+.6*Math.exp(-(((k*f-1500)/800)**2)))/k**1.3; x+=.55*w*Math.sin(phase*k+.025*k);}
   x+=(noise-prevNoise)*.009*(1+.7*Math.exp(-t*22));
  }else if(sound==='choir'){
   for(let k=1;k<=count;k++){const freq=k*f;const vowel=Math.exp(-(((freq-720)/340)**2))+.7*Math.exp(-(((freq-1200)/370)**2));x+=Math.sin(phase*k)*(.06/k+vowel*.14);}
  }else if(['violin','strings','cello','bowed'].includes(sound)){
   for(let k=1;k<=Math.min(count,28);k++){x+=(Math.sin(phase*k)+.24*Math.sin(phase*k*1.0018+.2)+.20*Math.sin(phase*k*.9987+.4))*(.35+.9*Math.exp(-(((k*f-480)/280)**2))+.7*Math.exp(-(((k*f-2300)/1500)**2)))/(k**1.25*2.1);}
   x*=.52;x+=noise*.008;
  }else if(['brass','horn','mutedbrass','organ','accordion','pad','drone','synth','pulse','analogbass','sub'].includes(sound)){
   if(sound==='sub'){x=.7*Math.sin(phase)+.08*Math.sin(phase*2);}
   else if(sound==='organ'){x=.42*Math.sin(phase)+.2*Math.sin(phase*2)+.16*Math.sin(phase*3)+.09*Math.sin(phase*4);}
   else if(sound==='pad'||sound==='drone'){x=.46*Math.sin(phase)+.13*Math.sin(phase*1.0021)+.11*Math.sin(phase*2)+.06*Math.sin(phase*3);}
   else{for(let k=1;k<=count;k++){let amp=sound==='pulse'?(2*Math.sin(Math.PI*k*(p.id==='pulse25'?.25:.5))/(Math.PI*k)):Math.exp(-k/(sound==='horn'?4+velocity*3:6+velocity*10))/k**(sound==='horn'?1.6:1.2);if(sound==='mutedbrass')amp*=.2+1.5*Math.exp(-(((f*k-1700)/900)**2));x+=amp*Math.sin(phase*k);if(sound==='accordion')x+=amp*.25*Math.sin(phase*k*1.002+.2);}if(sound==='analogbass')x*=.85;}
  }else{x=.7*Math.sin(phase);}
  prevNoise=noise;
  if(!p.drum){let env=Math.min(1,t/attack);if(t>duration)env*=Math.max(0,1-(t-duration)/tail)**2;if(sustained)env*=.92+.06*Math.sin(Math.PI*Math.min(t/duration,1));x*=env;}
  low+=a*(x-low);out[i]=Math.tanh(low)*.29*velocity**1.25;
 }
 return out;
}
class SoundEngine{
 constructor(){this.ctx=null;this.input=null;this.master=null;this.voices=new Set();this.cache=new Map();this.volume=.6;this.enabled=true;this.onVoice=null;this.previewCount=0;this.prepareCancel=null;this.maxCacheBytes=64*1024*1024;this.previewBackend='compact';this.soundfont=null;}
 async init(){if(!this.ctx){const C=window.AudioContext||window.webkitAudioContext;if(!C)throw Error('Web Audio no está disponible.');this.ctx=new C({latencyHint:'interactive'});this.input=this.ctx.createGain();const comp=this.ctx.createDynamicsCompressor();comp.threshold.value=-9;comp.knee.value=4;comp.ratio.value=8;comp.attack.value=.004;comp.release.value=.12;this.master=this.ctx.createGain();this.master.gain.value=this.volume;this.input.connect(comp);comp.connect(this.master);this.master.connect(this.ctx.destination);this.analyser=this.ctx.createAnalyser();this.analyser.fftSize=256;this.master.connect(this.analyser);}await this.ctx.resume();if(this.ctx.state!=='running')throw Error('El navegador no habilitó el audio.');return this.ctx;}
 key(event,duration,sr){const v=event.performedVelocity??event.velocity;return `${event.patch}|${event.midi}|${duration.toFixed(3)}|${v.toFixed(3)}|${sr}`;}
 async prepare(score,isCurrent=()=>true){
  if(this.previewBackend==='soundfont'){
   if(!this.soundfont||!this.soundfont.ready)throw Error('Elegí un SF2 local y SpessaSynth junto al HTML. Las paletas compactas siguen disponibles.');
   return;
  }
  const sr=this.ctx.sampleRate, unique=new Map();
  for(const e of score.events){const d=e.performedDuration*60/score.bpm,key=this.key(e,d,sr);if(!unique.has(key))unique.set(key,{key,patch:e.patch,midi:e.midi,duration:d,velocity:e.performedVelocity??e.velocity,sr});}
  // Bound pre-rendered samples instead of dropping an early attack from an LRU during play.
  const estimated=[...unique.values()].reduce((n,e)=>n+Math.ceil((Math.min(14,e.duration)+1)*sr)*4,0);
  if(estimated>this.maxCacheBytes)throw Error('La escucha excede 64 MB de voces precalculadas. Importá un fragmento menor; no se recortó tu score.');
  const keep=new Set(unique.keys());for(const key of this.cache.keys())if(!keep.has(key))this.cache.delete(key);
  const pending=[...unique.values()].filter(e=>!this.cache.has(e.key));if(!pending.length)return;
  const code=`'use strict';const INST=${JSON.stringify(M.INST)},TAU=2*Math.PI;const M={resolve:${M.resolve.toString()},clamp:${M.clamp.toString()},rand:${M.rand.toString()},hash:${M.hash.toString()}};const voiceSamples=${voiceSamples.toString()};self.onmessage=({data:e})=>{try{const samples=voiceSamples(e.patch,e.midi,e.duration,e.velocity,e.sr);self.postMessage({key:e.key,samples},[samples.buffer]);}catch(error){self.postMessage({error:error.message});}};`;
  let worker=null,url=null;
  try{
   url=URL.createObjectURL(new Blob([code],{type:'text/javascript'}));worker=new Worker(url);
   await new Promise((resolve,reject)=>{let i=0;const timer=setTimeout(()=>finish(Error('La preparación de audio excedió 45 s.')),45000);let done=false;
    const finish=error=>{if(done)return;done=true;clearTimeout(timer);this.prepareCancel=null;worker.terminate();error?reject(error):resolve();};
    this.prepareCancel=()=>finish(Error('Preparación cancelada.'));
    worker.onerror=e=>{e.preventDefault();finish(Error('El navegador bloqueó la preparación de audio en Worker.'));};
    worker.onmessage=({data})=>{if(!isCurrent()){finish(Error('Preparación cancelada.'));return;}if(data.error){finish(Error(data.error));return;}this.cache.set(data.key,data.samples);i++;this.onPrepare?.(i,pending.length);if(i===pending.length)finish();else worker.postMessage(pending[i]);};
    worker.postMessage(pending[0]);
   });
  }finally{worker?.terminate();if(url)URL.revokeObjectURL(url);}
 }
 displayTime(){if(!this.ctx)return 0;const now=this.ctx.currentTime;if(this.ctx.state!=='running')return now;try{const ts=this.ctx.getOutputTimestamp?.();if(ts&&ts.performanceTime>0&&Number.isFinite(ts.contextTime)){const elapsed=(performance.now()-ts.performanceTime)/1000;if(elapsed>=0&&elapsed<1)return M.clamp(ts.contextTime+elapsed,0,now);}}catch{}return now;}
 setVolume(v){this.volume=M.clamp(v,0,.9);if(this.ctx)this.master.gain.setTargetAtTime(this.volume,this.ctx.currentTime,.02);}
 buffer(context,event,duration){const v=event.performedVelocity??event.velocity;const key=this.key(event,duration,context.sampleRate);let samples=this.cache.get(key);if(!samples){samples=voiceSamples(event.patch,event.midi,duration,v,context.sampleRate);if(this.cache.size>800)this.cache.delete(this.cache.keys().next().value);this.cache.set(key,samples);}const b=context.createBuffer(1,samples.length,context.sampleRate);b.copyToChannel(samples,0);return b;}
 note(event,when,duration,tr={volume:1,pan:0},ctx=this.ctx,dest=this.input,register=true){if(!ctx)return null;if(this.previewBackend==='soundfont'&&this.soundfont?.ready&&ctx===this.ctx)return this.soundfont.note(event,when,duration,tr,ctx,dest,register);const source=ctx.createBufferSource(),gain=ctx.createGain(),pan=ctx.createStereoPanner();source.buffer=this.buffer(ctx,event,duration);gain.gain.value=M.clamp(tr.volume??1,0,1);pan.pan.value=M.clamp(tr.pan??0,-1,1);source.connect(gain);gain.connect(pan);pan.connect(dest);source.start(when);if(register){this.voices.add(source);source.onended=()=>{source.disconnect();gain.disconnect();pan.disconnect();this.voices.delete(source);};}return source;}
 panic(){this.soundfont?.panic?.();if(!this.ctx)return;for(const source of this.voices){try{source.stop();}catch{}}this.voices.clear();}
 async preview(patch,midi,duration=.5,velocity=.7,tr={volume:.8,pan:0}){await this.init();if(this.previewBackend==='soundfont'&&!(this.soundfont&&this.soundfont.ready))throw Error('Elegí un SF2 local. Sin librería SpessaSynth el motor compacto permanece activo.');const e={patch,midi,velocity};this.note(e,this.ctx.currentTime+.005,duration,tr);this.previewCount++;return{time:this.ctx.currentTime+.005,end:this.ctx.currentTime+.005+duration,event:e};}
 async render(score,{muted=new Set(),solo=null,loops=1}={}){
  const length=score.beats*60/score.bpm*loops;if(length>150||score.events.length*loops>6000)throw Error('El export de boceto admite hasta 150 s y 6000 eventos.');
  const sr=32000,ctx=new OfflineAudioContext(2,Math.ceil((length+.7)*sr),sr),input=ctx.createGain(),comp=ctx.createDynamicsCompressor(),out=ctx.createGain();comp.threshold.value=-9;comp.knee.value=4;comp.ratio.value=8;comp.attack.value=.004;comp.release.value=.12;out.gain.value=this.volume;input.connect(comp);comp.connect(out);out.connect(ctx.destination);
  const tracks=new Map(score.tracks.map(t=>[t.id,t]));for(let cycle=0;cycle<loops;cycle++){for(const e of score.events){if(muted.has(e.track)||(solo&&e.track!==solo))continue;this.note(e,(e.performedBeat??e.beat)*60/score.bpm+cycle*length/loops,(e.performedDuration??e.duration)*60/score.bpm,tracks.get(e.track),ctx,input,false);}}
  const b=await ctx.startRendering();return b;
 }
}
class Transport{
 constructor(sound){this.sound=sound;this.score=null;this.playing=false;this.starting=false;this.epoch=0;this.timer=null;this.queue=[];this.index=0;this.cycle=0;this.muted=new Set();this.solo=null;this.onStop=null;this.scheduled=[];this.generation=0;}
 setScore(s){this.stop();this.score=s;this.muted=new Set([...this.muted].filter(id=>s.tracks.some(t=>t.id===id)));if(this.solo&&!s.tracks.some(t=>t.id===this.solo))this.solo=null;}
 async play(){if(this.playing||this.starting||!this.score)return;this.starting=true;const generation=++this.generation;try{await this.sound.init();if(generation!==this.generation)return;await this.sound.prepare(this.score,()=>generation===this.generation);if(generation!==this.generation)return;this.queue=this.score.events.slice().sort((a,b)=>a.performedBeat-b.performedBeat);this.index=0;this.cycle=0;this.epoch=this.sound.ctx.currentTime+.2;this.playing=true;this.scheduled=[];this.tick();}finally{if(generation===this.generation)this.starting=false;}}
 tick(){if(!this.playing)return;const ctx=this.sound.ctx,score=this.score,spb=60/score.bpm,period=score.beats*spb;let count=0;
  if(ctx.state!=='running'){this.stop();return;}
  while(this.queue.length&&count++<300){const e=this.queue[this.index],when=this.epoch+this.cycle*period+e.performedBeat*spb;
   if(when>ctx.currentTime+.3)break;
   if(when<ctx.currentTime-.12){this.stop();if(this.onStop)this.onStop('Audio detenido: pestaña o CPU interrumpió el reloj. Reiniciá la escucha.');return;}
   if(!this.muted.has(e.track)&&(!this.solo||this.solo===e.track)){const tr=score.tracks.find(t=>t.id===e.track);this.sound.note(e,Math.max(ctx.currentTime,when),e.performedDuration*spb,tr);this.scheduled.push({id:e.id,track:e.track,midi:e.midi,time:when,duration:e.performedDuration*spb});if(this.scheduled.length>250)this.scheduled.shift();}
   if(++this.index>=this.queue.length){this.index=0;this.cycle++;}
  }
  this.timer=setTimeout(()=>this.tick(),25);
 }
 position(time=this.sound.displayTime()){if(!this.playing||!this.sound.ctx)return 0;return M.mod(Math.max(0,time-this.epoch)*this.score.bpm/60,this.score.beats);}
 active(time=this.sound.displayTime()){if(!this.playing||!this.sound.ctx||time<this.epoch)return[];const b=this.position(time),total=this.score.beats;return this.score.events.filter(e=>!this.muted.has(e.track)&&(!this.solo||this.solo===e.track)&&M.mod(b-e.performedBeat,total)<Math.max(e.performedDuration,M.resolve(e.patch).drum?.13:0));}
 stop(){this.generation++;this.sound.prepareCancel?.();this.playing=false;this.starting=false;clearTimeout(this.timer);this.timer=null;this.sound.panic();}
}
function wav(buffer){const channels=buffer.numberOfChannels,length=buffer.length,data=new ArrayBuffer(44+length*channels*2),dv=new DataView(data);const str=(o,s)=>{for(let i=0;i<s.length;i++)dv.setUint8(o+i,s.charCodeAt(i));};str(0,'RIFF');dv.setUint32(4,data.byteLength-8,true);str(8,'WAVE');str(12,'fmt ');dv.setUint32(16,16,true);dv.setUint16(20,1,true);dv.setUint16(22,channels,true);dv.setUint32(24,buffer.sampleRate,true);dv.setUint32(28,buffer.sampleRate*channels*2,true);dv.setUint16(32,channels*2,true);dv.setUint16(34,16,true);str(36,'data');dv.setUint32(40,data.byteLength-44,true);for(let i=0;i<length;i++)for(let c=0;c<channels;c++)dv.setInt16(44+(i*channels+c)*2,Math.round(M.clamp(buffer.getChannelData(c)[i],-1,1)*32767),true);return new Blob([data],{type:'audio/wav'});}
root.SynthLab={voiceSamples,SoundEngine,Transport,wav};
})(typeof globalThis!=='undefined'?globalThis:this);
