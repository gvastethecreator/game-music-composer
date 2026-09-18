/* Optional local SoundFont preview. No CDN. Compact palettes stay the default.
   Catalog masters are not swapped when this engine is selected. */
(function(root){
'use strict';
const PATHS=[
 './spessasynth/spessasynth_lib.js',
 './spessasynth/index.js',
 '../spessasynth/spessasynth_lib.js',
 './resources/spessasynth/spessasynth_lib.js'
];
const PROCESSORS=[
 './spessasynth/spessasynth_processor.js',
 '../spessasynth/spessasynth_processor.js',
 './resources/spessasynth/spessasynth_processor.js'
];

function status(text,ok){
 const el=document.getElementById('sf2-status');
 if(el){el.textContent=text;el.style.color=ok?'var(--accent2)':'var(--danger)';}
}

class SoundfontPreview{
 constructor(){this.ready=false;this.library=null;this.synth=null;this.bankName=null;this.timers=new Set();this.channels=new Map();this.nextChannel=0;}
 async findLibrary(){
  if(this.library)return this.library;
  if(root.SpessaSynth||root.WorkletSynthesizer){this.library=root.SpessaSynth||{WorkletSynthesizer:root.WorkletSynthesizer};return this.library;}
  for(const path of PATHS){
   try{
    const mod=await import(path);
    this.library=mod;
    return mod;
   }catch{}
  }
  this.library=null;
  return null;
 }
 async attach(engine){
  this.engine=engine;
  engine.soundfont=this;
  const lib=await this.findLibrary();
  if(!lib){
   status('SpessaSynth no está junto a este HTML. Las paletas compactas, Chamber y los masters del catálogo no cambian. Copiá resources/spessasynth/ al lado del archivo, sin CDN.',false);
   return false;
  }
  status('SpessaSynth encontrado. Elegí un SF2 local. Esto no sustituye un master grabado.',true);
  return true;
 }
 channelFor(patch){
  if(this.channels.has(patch))return this.channels.get(patch);
  const ch=this.nextChannel%16;
  this.channels.set(patch,ch);
  this.nextChannel++;
  return ch;
 }
 async loadFile(file){
  if(!file)throw Error('Elegí un archivo .sf2 o .sf3 local.');
  const lib=await this.findLibrary();
  if(!lib)throw Error('Falta SpessaSynth local. No se descarga por red.');
  if(!this.engine?.ctx)await this.engine.init();
  const buffer=await file.arrayBuffer();
  const Synthesizer=lib.WorkletSynthesizer||lib.Synthesizer||lib.default?.WorkletSynthesizer;
  if(!Synthesizer)throw Error('Esta copia de SpessaSynth no expone WorkletSynthesizer.');
  let processor=null;
  for(const path of PROCESSORS){
   try{await this.engine.ctx.audioWorklet.addModule(path);processor=path;break;}catch{}
  }
  if(!processor)throw Error('No se cargó spessasynth_processor.js. Debe estar en el mismo origen, no en un CDN.');
  if(this.synth?.destroy)try{this.synth.destroy();}catch{}
  const synth=new Synthesizer(this.engine.ctx);
  if(synth.connect)synth.connect(this.engine.input);
  else if(synth.output?.connect)synth.output.connect(this.engine.input);
  if(synth.isReady)await synth.isReady;
  if(synth.soundBankManager?.addSoundBank)await synth.soundBankManager.addSoundBank(buffer,file.name);
  else if(synth.addNewSoundBank)await synth.addNewSoundBank(buffer,file.name);
  else if(synth.loadSoundFont)await synth.loadSoundFont(buffer);
  else throw Error('La librería no aceptó el SF2. Revisá la API de tu copia de SpessaSynth.');
  this.synth=synth;
  this.bankName=file.name;
  this.ready=true;
  this.channels.clear();
  this.nextChannel=0;
  status(`SF2 local: ${file.name}. Preview en vivo. Los masters del catálogo y las paletas compactas siguen intactos.`,true);
  return true;
 }
 note(event,when,duration){
  if(!this.synth||!this.ready)return null;
  const ch=this.channelFor(event.patch||'lead');
  const midi=event.midi;
  const vel=Math.max(1,Math.min(127,Math.round((event.performedVelocity??event.velocity??.7)*127)));
  const delay=Math.max(0,when-(this.engine.ctx.currentTime));
  const start=()=>{
   this.synth.programChange?.(ch,0);
   this.synth.noteOn?.(ch,midi,vel);
   const off=setTimeout(()=>{this.synth.noteOff?.(ch,midi);this.timers.delete(off);},Math.max(40,duration*1000));
   this.timers.add(off);
  };
  const wait=setTimeout(start,delay*1000);
  this.timers.add(wait);
  return {stop:()=>{clearTimeout(wait);this.synth.noteOff?.(ch,midi);}};
 }
 panic(){
  for(const t of this.timers)clearTimeout(t);
  this.timers.clear();
  if(!this.synth)return;
  for(let ch=0;ch<16;ch++)this.synth.stopAll?.(ch)||this.synth.noteOff?.(ch,0);
 }
}

root.SoundfontLab={SoundfontPreview,status};
})(typeof globalThis!=='undefined'?globalThis:this);
