/* Atelier operates on the studio's native score and its single audio engine. */
(function(root){
'use strict';
const M=root.MusicLab,S=root.StudioScore,$=id=>document.getElementById(id);
class StudioAtelier {
  constructor(bridge){
    this.bridge=bridge;this.drafts=new Map();this.originals=new Map();this.history=new Map();this.selected=null;this.note=null;this.serial=0;this.busy=false;this.live=[];
    this.stage=new root.Atelier.AtelierStage($('studioInstruments'),(id,midi)=>this.audition(id,midi),id=>this.selectTrack(id),id=>this.mix(id,false),id=>this.mix(id,true));
    this.muted=new Set();this.solo=null;this.levels=new Map();
    const controls=$('studioInstruments').previousElementSibling;
    controls.querySelector('.atelier-kicker').textContent='Instruments';
    controls.querySelector('#view-labels').textContent='Note pads';controls.querySelector('#view-labels').click();controls.querySelector('#view-focus').textContent='Focus instrument';
    const motion=controls.querySelector('#view-motion');motion.textContent='Expressive motion';motion.addEventListener('click',()=>motion.textContent=this.stage.motion==='off'?'Motion off':'Expressive motion');
    this.stage.dialog.querySelector('.atelier-kicker').textContent='INSTRUMENT';this.stage.dialog.querySelector('.focus-close').textContent='Close ×';this.stage.dialog.querySelector('.focus-close').setAttribute('aria-label','Close instrument');this.stage.dialog.querySelector('.hint').textContent='Play the note pads with the selected studio soundbank. Escape closes this view.';
    const menus=[...document.querySelectorAll('.file-menu,.category-picker,.playback-settings')];
    menus.forEach(menu=>menu.addEventListener('keydown',e=>{if(e.key==='Escape'&&menu.open){e.preventDefault();menu.open=false;menu.querySelector('summary').focus();}}));
    document.addEventListener('click',e=>menus.forEach(menu=>{if(menu.open&&!menu.contains(e.target))menu.open=false;}));
    $('categoryTabs').addEventListener('click',e=>{if(e.target.closest('button')){const menu=$('categoryTabs').closest('details');menu.open=false;menu.querySelector('summary').focus({preventScroll:true});}});
    const dockTabs=[...document.querySelectorAll('[data-dock]')];
    const showDock=(button,focus=false)=>{dockTabs.forEach(tab=>{const active=tab===button;tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;$(tab.getAttribute('aria-controls')).hidden=!active;});if(focus)button.focus();};
    dockTabs.forEach((button,index)=>{button.onclick=()=>showDock(button);button.onkeydown=e=>{let next;if(e.key==='ArrowRight')next=(index+1)%dockTabs.length;else if(e.key==='ArrowLeft')next=(index+dockTabs.length-1)%dockTabs.length;else if(e.key==='Home')next=0;else if(e.key==='End')next=dockTabs.length-1;else return;e.preventDefault();showDock(dockTabs[next],true);};});
    $('studioCreateToggle').onclick=()=>this.panel('create');$('studioPerformanceToggle').onclick=()=>this.panel('performance');
    $('studioGenerator').onchange=()=>this.generatorOptions();this.generatorOptions();
    $('studioCreate').onclick=()=>this.run(()=>this.create());
    $('studioApplyPerformance').onclick=()=>this.run(()=>this.performance());
    $('studioUndo').onclick=()=>this.run(()=>this.undo());
    $('studioRestore').onclick=()=>this.run(()=>this.restore());
    $('studioExport').onclick=()=>this.export();
    $('studioWav').onclick=()=>this.run(()=>this.wav());
    $('studioTrack').onchange=()=>this.selectTrack($('studioTrack').value);
    $('studioNote').onchange=()=>this.selectNote(Number($('studioNote').value));
    $('studioEdit').onsubmit=e=>{e.preventDefault();this.run(()=>this.edit());};
    $('studioAmount').oninput=()=>{$('studioAmountValue').value=$('studioAmount').value+'%';};
    $('studioDensity').oninput=()=>{$('studioDensityValue').value=$('studioDensity').value+'%';};
  }
  async run(action){if(this.busy)return;this.busy=true;this.buttons();try{await action();}catch(error){this.message(error.message,true);}finally{this.busy=false;this.buttons();}}
  message(text,error=false){$('studioStatus').textContent=text;$('studioStatus').dataset.error=String(error);}
  buttons(){for(const id of ['studioCreate','studioApplyPerformance','studioApplyEdit','studioExport','studioWav'])$(id).disabled=this.busy||!this.native;$('studioUndo').disabled=this.busy||!this.history.get(this.native?.id)?.length;$('studioRestore').disabled=this.busy||!this.drafts.has(this.native?.id);}
  panel(name){for(const key of ['create','performance']){const active=key===name&&$('studio'+key+'Panel').hidden;$('studio'+key+'Panel').hidden=!active;$('studio'+(key==='create'?'Create':'Performance')+'Toggle').setAttribute('aria-expanded',String(active));}}
  resolve(native){if(!this.originals.has(native.id))this.originals.set(native.id,native);return this.drafts.get(native.id)||native;}
  load(native){
    const changed=this.native?.id!==native.id;this.native=native;this.score=S.fromNative(native);this.eventMap=new Map(native.events.map((e,i)=>[e,this.score.events[i]]));
    if(changed){for(const [id,level] of this.levels)this.bridge.level(id,level);this.selected=this.score.tracks[0].id;this.note=null;this.muted.clear();this.solo=null;this.levels.clear();}
    if(!this.score.tracks.some(t=>t.id===this.selected))this.selected=this.score.tracks[0].id;
    const track=$('studioTrack');track.replaceChildren(...this.score.tracks.map(t=>new Option(t.label,t.id)));track.value=this.selected;
    this.stage.build(this.score,this.selected);
    for(const card of this.stage.cards.values()){card.querySelector('.readout span').textContent=card.querySelector('.readout span').textContent.replace('eventos','events');card.querySelector('.instrument-name').title='Select instrument';card.querySelector('.expand').setAttribute('aria-label','Focus '+card.querySelector('.instrument-name').textContent);}
    this.stage.dialog.setAttribute('aria-label','Instrument focus');
    this.selectTrack(this.selected);this.updateMix();this.buttons();
    $('studioDraftLabel').textContent=native.source_type==='local_import'?'LOCAL DRAFT':'CATALOG SCORE';
    this.message(native.source_type==='local_import'?'Local draft · export JSON to keep your work.':'Select a note in the roll to edit. The catalog original is kept.');
  }
  selectTrack(id){this.selected=id;$('studioTrack').value=id;this.stage.state(this.muted,this.solo,id);const entries=this.native.events.map((e,i)=>[e,i]).filter(([e])=>e.inst===id);$('studioNote').replaceChildren(...entries.map(([e,i])=>new Option(`${M.noteName(e.midi??this.native.instrument_map[id].root_midi)} · beat ${e.beat.toFixed(2)}`,String(i))));const next=entries.find(([,i])=>i===this.note)||entries[0];if(next)this.selectNote(next[1]);}
  selectNote(index){const e=this.native?.events[index];if(!e)return;this.note=index;if(e.inst!==this.selected){this.selectTrack(e.inst);return;}$('studioNote').value=String(index);$('studioPitch').value=e.midi??this.native.instrument_map[e.inst].root_midi;$('studioBeat').value=e.beat;$('studioDuration').value=e.duration??.14;$('studioVelocity').value=e.velocity??80;$('studioBeat').max=this.native.beats-.001;$('studioDuration').max=this.native.beats;this.stage.state(this.muted,this.solo,this.selected);}
  async commit(next,label){const history=this.history.get(this.native.id)||[];history.push(this.native);if(history.length>24)history.shift();this.history.set(this.native.id,history);this.drafts.set(next.id,next);await this.bridge.refresh(next.id);this.message(label+' · export JSON to keep this draft.');}
  async edit(){const next=S.edit(this.native,this.note,{midi:Number($('studioPitch').value),beat:Number($('studioBeat').value),duration:Number($('studioDuration').value),velocity:Number($('studioVelocity').value)});await this.commit(next,'Note updated');}
  async performance(){const swing=Number($('studioSwing').value);if(!Number.isFinite(swing)||swing<0||swing>60)throw Error('Swing must be between 0 and 60%.');const interpreted=M.applyPerformance(S.fromNative(this.native),$('studioFeel').value,Number($('studioAmount').value)/100,swing/100,19);await this.commit(S.perform(this.native,interpreted),'Performance applied');}
  async undo(){const previous=this.history.get(this.native.id)?.pop();if(!previous)return;if(previous===this.originals.get(previous.id))this.drafts.delete(previous.id);else this.drafts.set(previous.id,previous);await this.bridge.refresh(previous.id);this.message('Last change undone.');}
  async restore(){const id=this.native.id,previous=this.native;this.drafts.delete(id);const history=this.history.get(id)||[];history.push(previous);this.history.set(id,history);await this.bridge.refresh(id);this.message('Source score restored.');}
  generatorOptions(){
    const kind=$('studioGenerator').value;
    $('studioSeed').disabled=['instrumentarium','pocket'].includes(kind);
    const options={instrumentarium:{chamber:'Chamber',jazz:'Electric jazz',ritual:'Ritual'},pocket:{neo:'Neo soul'},conversation:{dialogue:'Call and response',asymmetric:'Asymmetric phrases',breath:'Space and breath',tiled:'Repeated phrase'},atlas:Object.fromEntries(Object.entries(M.GENRES).map(([id,g])=>[id,g.label])),cycles:{interlock:'Interlocking',hocket:'Hocket',additive:'Additive'}}[kind];
    $('studioVariant').replaceChildren(...Object.entries(options).map(([id,label])=>new Option(label,id)));
    $('studioCycleControls').hidden=kind!=='cycles';$('studioPhraseControls').hidden=kind!=='conversation';$('studioAtlasControls').hidden=kind!=='atlas';
    $('studioMelodyGenre').replaceChildren(new Option('Same as rhythm','same'),...Object.entries(M.GENRES).map(([id,g])=>new Option(g.label,id)));
  }
  async create(){
    const kind=$('studioGenerator').value,variant=$('studioVariant').value,seed=Number($('studioSeed').value);
    if(!Number.isInteger(seed)||seed<0||seed>99999)throw Error('Use a seed from 0 to 99999.');
    let score;
    if(kind==='instrumentarium')score=M.studioScore(variant);
    else if(kind==='pocket')score=M.pocketScore(variant);
    else if(kind==='conversation')score=M.phraseScore({mode:variant,seed,space:Number($('studioSpace').value)/100,answer:Number($('studioAnswer').value)/100});
    else if(kind==='atlas')score=M.genreScore({genre:variant,melodyGenre:$('studioMelodyGenre').value,seed,density:Number($('studioDensity').value)/100});
    else {const periods=[1,2,3].map(i=>Number($('studioPeriod'+i).value)),hits=[1,2,3].map(i=>Number($('studioHits'+i).value));if(periods.some((n,i)=>!Number.isInteger(n)||n<1||n>32||!Number.isInteger(hits[i])||hits[i]<0||hits[i]>n))throw Error('Cycle lengths must be 1–32 with hits between 0 and the cycle length.');score=M.cycleScore({method:variant,periods,hits,spacing:Number($('studioSpacing').value),seed});}
    score.mode=kind==='atlas'?M.GENRES[variant].scale:kind==='cycles'?'darkpent':'dorian';
    const next=S.generated(score,root.STUDIO_INSTRUMENTS,'atelier_'+Date.now()+'_'+(++this.serial),this.bridge.category());
    await this.bridge.add(next);this.message('Sketch created · '+next.events.length+' notes · ready in all three live banks.');
  }
  mix(id,solo){if(solo)this.solo=this.solo===id?null:id;else if(this.muted.has(id))this.muted.delete(id);else this.muted.add(id);this.updateMix();}
  updateMix(){for(const t of this.score.tracks){const silent=this.muted.has(t.id)||(this.solo&&this.solo!==t.id);if(silent&&!this.levels.has(t.id)){this.levels.set(t.id,this.bridge.level(t.id));this.bridge.level(t.id,0);}else if(!silent&&this.levels.has(t.id)){this.bridge.level(t.id,this.levels.get(t.id));this.levels.delete(t.id);}}this.stage.state(this.muted,this.solo,this.selected);}
  resetMix(){for(const [id,level] of this.levels)this.bridge.level(id,level);this.muted.clear();this.solo=null;this.levels.clear();this.stage.state(this.muted,this.solo,this.selected);}
  async audition(id,midi){try{await this.bridge.audition(id,midi);this.live.push({track:id,midi,velocity:.7,id:'audition:'+performance.now(),until:performance.now()+420});}catch(error){this.message(error.message,true);}}
  frame(active,beat,playing,time){if(!this.native)return;this.live=this.live.filter(e=>e.until>performance.now());const visible=active.filter(e=>this.bridge.level(e.inst)>0).map(e=>({...this.eventMap.get(e),midi:(e.midi??this.native.instrument_map[e.inst].root_midi)+(e.kind==='drum'?0:this.bridge.transpose())}));this.stage.update(visible.concat(this.live),time);}
  export(){const score={...this.native,id:this.drafts.has(this.native.id)?this.native.id+'_draft':this.native.id};const blob=new Blob([JSON.stringify(score,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=score.id+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);this.message('Native score exported · tempo and pitch controls remain audition settings.');}
  async wav(){const id=this.native.id;this.message('Rendering WAV with the selected bank, tempo, pitch and mixer…');const blob=await this.bridge.wav(),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=id+'.wav';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);this.message('Stereo WAV exported · 32 kHz · current studio mix.');}
}
root.StudioAtelier=StudioAtelier;
})(globalThis);
