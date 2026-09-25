(() => {
  'use strict';
  const catalog=window.NEOSPC_CATALOG;
  const harnessSpec=window.NEOSPC_HARNESS;
  const libraries=window.NEOSPC_LIBRARIES;
  const reviewBundle=window.NEOSPC_REVIEWS;
  let factoryBank=window.NEOSPC_FACTORY_BANK||null;
  const factoryPreviews=window.NEOSPC_FACTORY_PREVIEWS||{};
  let factoryPatches=Object.values(factoryBank?.patches||{});
  let bankLoadPromise=null;
  const cueCache=new Map(Object.entries(window.NEOSPC_CUES||{}));
  const cueLoads=new Map();
  const $=id=>document.getElementById(id);
  const $$=(sel,root=document)=>[...root.querySelectorAll(sel)];
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pitchNames=['C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B'];
  const drumPitch={kick:36,snare:38,hat:42,open_hat:46,tom:45,wood:76,shaker:82,rim:37,ride:51,impact:29,brush:84};
  const trackDb=value=>value<=0?'−∞ dB':`${(20*Math.log10(value/100)).toFixed(1)} dB`;
  const bankLabels={timber:'Timber',prism:'Prism',voltage:'Voltage',megadrive:'Mega Drive · sampled',snes:'SNES · sampled',velvet:'Velvet',circuit:'Circuit',factory:'Chamber',chamber:'Chamber',original:'Compact',chip:'Chip Core'};
  const importLimits={bytes:5*1024*1024,styles:24,events:30000};
  const finalReviews=new Map(reviewBundle.final.tracks.map(x=>[x.id,x]));
  const pass1Reviews=new Map(reviewBundle.pass1.tracks.map(x=>[x.id,x]));
  const engine=new window.NeoSpcLiveEngine();
  const els={};
  let studio;
  let rollHits=[];
  const state={view:'workstation',category:catalog.categories[0].id,style:null,pendingStyleId:null,selectionToken:0,search:'',quality:'all',mode:'live',bankMode:'factory',tempo:100,transpose:0,volume:-3,ceiling:-1,seeking:false,playbackBusy:false,activeKeys:new Set(),ripples:[],particles:[],activity:new Map(),lastNow:performance.now(),raf:0,harnessSection:'brief',harnessConfig:null,bankProfile:'neo16',bankPatchId:factoryPatches[0]?.id||null,bankSearch:'',bankFamily:'all',bankVelocity:96,bankPreviewAudio:null,localImportCount:0,localImportEvents:0,noticeTimer:0,reduceMotion:matchMedia('(prefers-reduced-motion: reduce)').matches};

  const onset=e=>Number(e.performance_beat??e.beat??0);
  const duration=e=>e.kind==='drum'?.14:Math.max(.035,Number(e.performance_duration??e.duration??.2));
  const pitchOf=e=>e.kind==='drum'?(e.midi??drumPitch[e.inst]??60):Number(e.midi)+state.transpose;
  const role=e=>e.role||(e.kind==='drum'?e.inst:'support');
  const colorOf=inst=>state.style?.instrument_map?.[inst]?.color||'#999';
  const labelOf=inst=>state.style?.instrument_map?.[inst]?.label||inst.replaceAll('_',' ');
  const noteName=m=>pitchNames[((m%12)+12)%12]+(Math.floor(m/12)-1);
  const timeText=sec=>Number.isFinite(sec)?`${String(Math.floor(sec/60)).padStart(2,'0')}:${String(Math.floor(sec%60)).padStart(2,'0')}`:'00:00';
  const currentBps=()=>((state.style?.bpm||120)*(state.tempo/100))/60;
  const currentDuration=()=>state.style?state.style.beats/currentBps():0;
  const currentBeat=()=>state.mode==='live'?engine.getBeat():(els.audio.duration?els.audio.currentTime/els.audio.duration*state.style.beats:0);
  const activeAt=(e,b)=>{const st=onset(e),du=duration(e),end=st+du,n=state.style.beats;if(end<=n)return b>=st&&b<end;return b>=st||b<end-n};
  const transposedKey=()=>pitchNames[(pitchNames.indexOf(state.style.key)+state.transpose+120)%12]||state.style.key;

  function loadScript(src){return new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=src;script.async=true;script.addEventListener('load',resolve,{once:true});script.addEventListener('error',()=>reject(new Error(`Could not load ${src}`)),{once:true});document.head.appendChild(script)})}
  function loadCue(id){
    if(cueCache.has(id))return Promise.resolve(cueCache.get(id));if(cueLoads.has(id))return cueLoads.get(id);
    const request=loadScript(`data/cues/${id}.js`).then(()=>{const cue=window.NEOSPC_CUES?.[id];if(!cue)throw new Error(`Cue data is empty: ${id}`);cueCache.set(id,cue);cueLoads.delete(id);return cue}).catch(error=>{cueLoads.delete(id);throw error});cueLoads.set(id,request);return request
  }
  function ensureFactoryBank(){
    if(window.NEOSPC_FACTORY_BANK&&window.NEOSPC_SAMPLE_BANK&&window.NEOSPC_PALETTES){factoryBank=window.NEOSPC_FACTORY_BANK;factoryPatches=Object.values(factoryBank.patches||{});return Promise.resolve(factoryBank)}
    if(bankLoadPromise)return bankLoadPromise;
    bankLoadPromise=Promise.all([loadScript('data/sample-bank.js'),loadScript('data/factory-bank.js'),loadScript('data/studio-palettes.js')]).then(()=>{
      factoryBank=window.NEOSPC_FACTORY_BANK;factoryPatches=Object.values(factoryBank?.patches||{});if(!factoryBank||!factoryPatches.length)throw new Error('Factory Bank data is empty');if(!state.bankPatchId)state.bankPatchId=factoryPatches[0].id;return factoryBank
    }).catch(error=>{bankLoadPromise=null;throw error});
    return bankLoadPromise;
  }

  function notice(message,tone='info'){
    clearTimeout(state.noticeTimer);els.notice.textContent=message;els.notice.dataset.tone=tone;els.notice.hidden=false;
    state.noticeTimer=setTimeout(()=>{els.notice.hidden=true},tone==='error'?7000:4200);
  }
  function readPrefs(){try{return JSON.parse(localStorage.getItem('neospc-studio-prefs')||'{}')}catch{return{}}}
  function savePrefs(){try{localStorage.setItem('neospc-studio-prefs',JSON.stringify({view:state.view,category:state.category,styleId:state.style?.source_type==='local_import'?null:state.style?.id,mode:state.mode,bankMode:state.bankMode}))}catch{}}
  function syncUrl(){
    if(!state.style)return;try{const url=new URL(location.href);if(state.style.source_type==='local_import')url.searchParams.delete('cue');else url.searchParams.set('cue',state.style.id);if(state.view==='workstation')url.searchParams.delete('view');else url.searchParams.set('view',state.view);if(state.bankMode==='factory')url.searchParams.delete('bank');else url.searchParams.set('bank',state.bankMode);history.replaceState(null,'',url)}catch{}
  }
  function setView(view,focus=false){
    const allowed=new Set(['create','workstation','recipe','soundbank','review']);state.view=allowed.has(view)?view:'workstation';document.body.dataset.view=state.view;
    $$('#appTabs [role="tab"]').forEach(button=>{const active=button.dataset.view===state.view;button.classList.toggle('active',active);button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;if(active&&focus)button.focus()});
    $$('.app-view').forEach(panel=>{const active=panel.id===`view-${state.view}`;panel.classList.toggle('active',active);panel.hidden=!active});if(state.view==='create')window.GMCCreate?.show();
    if(state.view==='recipe')renderHarnessPanel();if(state.view==='review')renderReview();if(state.view==='soundbank'){els.bankAuditionStatus.textContent=factoryBank?'READY':'LOADING BANK';els.bankPatchList.setAttribute('aria-busy',String(!factoryBank));ensureFactoryBank().then(()=>{buildSoundbank();renderBankCueMap();els.bankPatchList.setAttribute('aria-busy','false');els.bankAuditionStatus.textContent='READY'}).catch(error=>{els.bankPatchList.setAttribute('aria-busy','false');els.bankAuditionStatus.textContent='BANK ERROR';notice('Factory Bank data could not load. Reload the page and try again.','error');console.error(error)})}savePrefs();syncUrl();
  }
  function buildAppTabs(){
    const tabs=$$('#appTabs [role="tab"]');
    tabs.forEach((button,index)=>{button.addEventListener('click',()=>setView(button.dataset.view));button.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();let next=index;if(event.key==='ArrowRight')next=(index+1)%tabs.length;if(event.key==='ArrowLeft')next=(index-1+tabs.length)%tabs.length;if(event.key==='Home')next=0;if(event.key==='End')next=tabs.length-1;setView(tabs[next].dataset.view,true)})});
    $$('[data-open-view]').forEach(button=>button.addEventListener('click',()=>{setView(button.dataset.openView);requestAnimationFrame(()=>document.querySelector(`#view-${button.dataset.openView}`)?.scrollIntoView({block:'start'}))}));
  }
  function buildCategories(){
    els.categories.innerHTML='';[{id:'all',label:'All cues'},...catalog.categories].forEach(c=>{const b=document.createElement('button');b.type='button';b.textContent=c.label;b.dataset.id=c.id;b.setAttribute('aria-pressed','false');b.addEventListener('click',()=>switchCategory(c.id));els.categories.appendChild(b)});
  }
  function switchCategory(id,preferredId=null){state.category=id;state.search='';els.search.value='';$$('#categoryTabs button').forEach(b=>{const active=b.dataset.id===id;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active))});const c=catalog.categories.find(x=>x.id===id);els.categoryTitle.textContent=c?.label||'All cues';renderTrackList();const preferred=catalog.styles.find(s=>s.id===preferredId&&(id==='all'||s.category===id));const first=preferred||filteredStyles()[0]||catalog.styles[0];if(first)selectStyle(first.id,false);savePrefs()}
  function filteredStyles(){const q=state.search.trim().toLowerCase();return catalog.styles.map(s=>studio?.drafts.get(s.id)||s).filter(s=>state.category==='all'||s.category===state.category).filter(s=>state.quality==='all'||s.composition_quality?.status===state.quality).filter(s=>!q||[s.title,s.category_label,s.subcategory,s.meter,s.key,s.mode,...(s.tags||[])].join(' ').toLowerCase().includes(q))}
  function renderTrackList(){const arr=filteredStyles();els.categoryCount.textContent=arr.length;els.trackList.innerHTML='';els.trackEmpty.hidden=arr.length>0;arr.forEach(s=>{const local=s.source_type==='local_import',q=local?'local':(s.composition_quality?.status||'review'),active=(state.pendingStyleId||state.style?.id)===s.id;const row=document.createElement('button');row.type='button';row.className='track-row'+(local?' local-cue':'')+(active?' active':'');row.setAttribute('aria-pressed',String(active));row.innerHTML=`<strong>${safe(s.title)}</strong><small>${safe(s.category_label)} · ${safe(s.subcategory)}</small><div class="row-meta"><span>${s.bpm} BPM</span><span>${s.meter}</span><span>${s.voice_budget} V</span><span class="quality-${q}">${q==='curated'?'approved':q}</span></div>`;row.addEventListener('click',()=>selectStyle(s.id,false));els.trackList.appendChild(row)});const selected=state.pendingStyleId||state.style?.id;if(els.trackList.dataset.selection!==selected){els.trackList.dataset.selection=selected||'';requestAnimationFrame(()=>{const row=els.trackList.querySelector('.active');if(!row)return;const bounds=els.trackList.getBoundingClientRect(),item=row.getBoundingClientRect();if(item.bottom>bounds.bottom)els.trackList.scrollTop+=item.bottom-bounds.bottom;else if(item.top<bounds.top)els.trackList.scrollTop+=item.top-bounds.top;});}}

  const hasMastered=style=>Boolean(style&&style.source_type!=='local_import');
  function setupMasteredAudio(){els.audio.pause();const option=els.mode.querySelector('option[value="mastered"]'),available=hasMastered(state.style);option.disabled=!available;els.soundbank.disabled=state.mode==='mastered';if(!available){els.audio.removeAttribute('src');els.audio.load();els.audioDownload.hidden=true;if(state.mode==='mastered'){state.mode='live';els.mode.value='live'}els.soundbank.disabled=false;return}els.audio.src=`assets/audio/${state.style.id}.mp3`;els.audio.playbackRate=state.tempo/100;els.audio.preservesPitch=true;els.audio.volume=clamp(Math.pow(10,state.volume/20),0,1);els.audioDownload.hidden=false;els.audioDownload.href=`assets/audio/${state.style.id}.mp3`;els.audioDownload.download=`${state.style.id}.mp3`}
  async function selectStyle(id,autoplay=false){
    const summary=catalog.styles.find(x=>x.id===id);if(!summary)return;const token=++state.selectionToken,wasPlaying=(state.mode==='live'&&engine.isPlaying())||(state.mode==='mastered'&&!els.audio.paused);state.pendingStyleId=id;engine.pause(false);els.audio.pause();setPlaybackBusy(true);els.title.textContent=`Loading ${summary.title}…`;els.trackList.setAttribute('aria-busy','true');renderTrackList();let resume=false;
    try{
      const [loaded]=await Promise.all([loadCue(id),ensureFactoryBank()]);const s=studio.resolve(loaded);if(token!==state.selectionToken)return;if(state.style?.id!==s.id)state.bankMode=state.requestedBank||(s.sound_palette==='chamber'?'factory':s.sound_palette)||state.bankMode;state.requestedBank=null;state.style=s;state.pendingStyleId=null;state.activeKeys.clear();state.ripples=[];state.particles=[];state.activity.clear();els.soundbank.value=state.bankMode==='chamber'?'factory':state.bankMode;renderSoundbankMode();engine.setStyle(s);engine.setBankMode(state.bankMode==='chamber'?'factory':state.bankMode);engine.setTempo(state.tempo);engine.setTranspose(state.transpose);engine.setMasterDb(state.volume);engine.setCeilingDb(state.ceiling);setupMasteredAudio();
      els.kicker.textContent=s.kicker||`${s.category_label} · ${s.meter}`;els.title.textContent=s.title;els.description.textContent=s.description||'Local Game Music Composer score loaded for live soundbank comparison.';els.meta.innerHTML='';[s.source_type==='local_import'?'LOCAL SCORE':s.category_label,s.subcategory,`${transposedKey()} ${s.mode}`,`${s.bpm} BPM`,s.meter,`BUDGET ${s.voice_budget}`,`PEAK ${s.measured_peak_voices}`].forEach(x=>{const el=document.createElement('span');el.textContent=x;els.meta.appendChild(el)});
      if(s.source_type==='local_import'){els.midi.removeAttribute('href');els.midi.removeAttribute('download');els.midi.setAttribute('aria-disabled','true');els.midi.textContent='MIDI via CLI'}else{els.midi.href=`assets/midi/${s.id}.mid`;els.midi.download=`${s.id}.mid`;els.midi.removeAttribute('aria-disabled');els.midi.textContent='MIDI'}els.form.textContent=(s.form||[]).map(f=>`${f.name}: ${f.bars} bars`).join(' / ');els.harmony.textContent=`${transposedKey()} ${s.mode} · ${(s.chord_plan||[]).slice(0,10).map(c=>transposeChord(c.symbol,state.transpose)).join(' – ')}`;els.voice.textContent=`${s.voice_budget}-voice budget · measured peak ${s.measured_peak_voices} · ${Object.keys(s.instrument_map||{}).length} instruments`;els.direction.textContent=s.musical_direction?.thesis||s.dna?.motif||'';
      renderInstrumentActivity();renderTrackList();renderReview();renderBankCueMap();syncHarnessFromTrack();updateGlobalDisplays();savePrefs();syncUrl();studio.load(s);resume=autoplay||wasPlaying;
    }catch(error){if(token===state.selectionToken){state.pendingStyleId=null;els.title.textContent=summary.title;renderTrackList();notice('Cue data could not load. Reload the page and try again.','error')}console.error(error)}finally{if(token===state.selectionToken){els.trackList.setAttribute('aria-busy','false');setPlaybackBusy(false)}}
    if(resume)await play();
  }

  async function play(){
    if(state.playbackBusy||!state.style)return;window.GMCCreate?.pause();$$('.bank-console-packs audio').forEach(audio=>audio.pause());setPlaybackBusy(true);els.transportState.textContent='LOADING';
    try{
      if(state.mode==='live'){if(state.bankMode!=='chip')await ensureFactoryBank();engine.setBankMode(state.bankMode);engine.setStyle(state.style);engine.setTempo(state.tempo);engine.setTranspose(state.transpose);engine.setMasterDb(state.volume);engine.setCeilingDb(state.ceiling);await engine.play(currentBeat());if(!engine.isPlaying())return;els.transportState.textContent=`PLAYING · ${bankLabels[state.bankMode].toUpperCase()}`}
      else{els.audio.playbackRate=state.tempo/100;await els.audio.play();els.transportState.textContent='PLAYING · MASTER'}

    }catch(err){els.transportState.textContent='AUDIO ERROR';notice('Playback could not start. Try another live bank or allow audio in this browser.','error');console.error(err)}finally{setPlaybackBusy(false)}
  }
  function pause(){if(state.mode==='live')engine.pause(true);else els.audio.pause();els.transportState.textContent='PAUSED';}
  function stop(){if(state.mode==='live'){engine.pause(false);engine.seekBeat(0)}else{els.audio.pause();els.audio.currentTime=0}els.scrubber.value=0;els.transportState.textContent='STOPPED';}
  function setPlaybackBusy(busy){state.playbackBusy=busy;[els.play].forEach(button=>{button.disabled=busy;button.setAttribute('aria-busy',String(busy))})}
  function switchMode(mode){if(mode==='mastered'&&!hasMastered(state.style)){els.mode.value='live';notice('Local scores use the live soundbanks. Export audio with the skill when you need a master.','error');return}const beat=currentBeat(),was=(state.mode==='live'&&engine.isPlaying())||(state.mode==='mastered'&&!els.audio.paused);if(state.mode==='live')engine.pause(false);else els.audio.pause();state.mode=mode;els.mode.value=mode;els.soundbank.disabled=mode==='mastered';if(mode==='live'){engine.setStyle(state.style);engine.setBankMode(state.bankMode);engine.seekBeat(beat)}else{els.audio.currentTime=beat/state.style.beats*(els.audio.duration||currentDuration())}savePrefs();if(was)play();}
  async function switchSoundbank(mode,announce=true){if(!bankLabels[mode])return;const beat=currentBeat(),was=(state.mode==='live'&&engine.isPlaying())||(state.mode==='mastered'&&!els.audio.paused);if(state.mode==='live')engine.pause(false);else els.audio.pause();state.mode='live';state.bankMode=mode;els.mode.value='live';els.soundbank.disabled=false;els.soundbank.value=mode;engine.setStyle(state.style);engine.setBankMode(mode);engine.seekBeat(beat);renderSoundbankMode();if(state.style)renderInstrumentActivity();if(state.view==='soundbank')renderSoundbank();savePrefs();syncUrl();if(announce)notice(`${bankLabels[mode]} selected. The score and position stay in place.`);if(was)await play();else{els.transportState.textContent=`READY · ${bankLabels[mode].toUpperCase()}`;}}
  function renderSoundbankMode(){if($('bankPaletteSelect'))$('bankPaletteSelect').value=state.bankMode;$$('[data-soundbank-card]').forEach(card=>card.classList.toggle('active',card.dataset.soundbankCard===state.bankMode));$$('[data-use-soundbank]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.useSoundbank===state.bankMode)))}
  function setTempo(v){const beat=currentBeat(),was=(state.mode==='live'&&engine.isPlaying())||(state.mode==='mastered'&&!els.audio.paused);state.tempo=Number(v);engine.setTempo(state.tempo);els.audio.playbackRate=state.tempo/100;if(was&&state.mode==='mastered')els.audio.currentTime=beat/state.style.beats*(els.audio.duration||currentDuration());updateGlobalDisplays()}
  function setTranspose(delta,absolute=false){if(state.mode!=='live')switchMode('live');state.transpose=clamp(absolute?Number(delta):state.transpose+Number(delta),-12,12);engine.setTranspose(state.transpose);updateTrackMetaOnly();syncHarnessKey();updateGlobalDisplays()}
  function setVolume(v){state.volume=Number(v);engine.setMasterDb(state.volume);els.audio.volume=clamp(Math.pow(10,state.volume/20),0,1);updateGlobalDisplays()}
  function setCeiling(v){state.ceiling=Number(v);engine.setCeilingDb(state.ceiling);updateGlobalDisplays()}
  function updateGlobalDisplays(){els.volumeValue.textContent=state.volume.toFixed(1).replace('-','−');els.ceilingValue.textContent=state.ceiling.toFixed(1).replace('-','−');els.tempoValue.textContent=`${state.tempo}%`;els.bpmValue.textContent=Math.round((state.style?.bpm||120)*state.tempo/100);els.pitchValue.textContent=`${state.transpose>0?'+':''}${state.transpose} st`;els.keyValue.textContent=state.style?transposedKey():'—'}
  function updateTrackMetaOnly(){if(!state.style)return;[...els.meta.children].forEach((x,i)=>{if(i===2)x.textContent=`${transposedKey()} ${state.style.mode}`});els.harmony.textContent=`${transposedKey()} ${state.style.mode} · ${(state.style.chord_plan||[]).slice(0,10).map(c=>transposeChord(c.symbol,state.transpose)).join(' – ')}`}
  function transposeChord(symbol,semi){if(!semi)return symbol;const m=String(symbol).match(/^([A-G](?:#|b)?)(.*)$/);if(!m)return symbol;const idx=pitchNames.indexOf(m[1]);return idx<0?symbol:pitchNames[(idx+semi+120)%12]+m[2]}

  function renderInstrumentActivity(){els.instrumentActivity.innerHTML='';const insts=[...new Set(state.style.events.map(e=>e.inst))];insts.forEach(inst=>{state.activity.set(inst,0);const row=document.createElement('div');row.className='instrument-row';row.dataset.inst=inst;row.style.setProperty('--inst',colorOf(inst));const val=engine.getInstrumentVolume(inst),info=state.style.instrument_map?.[inst]||{},patch=state.bankMode==='chip'?'Generated chip voice':state.bankMode==='original'?(info.file||'Original sample'):engine.factoryPatch(info)?.label||info.factory_label||'Compatibility patch';row.innerHTML=`<div class="instrument-name"><span><i class="instrument-dot"></i>${safe(labelOf(inst))}</span><b>${trackDb(val)}</b></div><small class="instrument-patch">${safe(patch)}</small><input type="range" min="0" max="100" value="${val}" aria-label="${safe(labelOf(inst))} track level"><div class="instrument-meter"><i></i></div>`;const input=row.querySelector('input'),out=row.querySelector('b');input.addEventListener('input',()=>{if(state.mode!=='live')switchMode('live');studio.resetMix();engine.setInstrumentVolume(inst,input.value);out.textContent=trackDb(Number(input.value))});els.instrumentActivity.appendChild(row)})}
  function updateInstrumentActivity(active){const counts=collections(active);$$('.instrument-row',els.instrumentActivity).forEach(row=>{const inst=row.dataset.inst,c=counts.get(inst)||0;const old=state.activity.get(inst)||0;const v=Math.max(c?1:0,old*.88);state.activity.set(inst,v);row.classList.toggle('active',v>.12);row.querySelector('.instrument-meter i').style.width=`${Math.min(100,v*100)}%`})}
  function collections(events){const m=new Map();events.forEach(e=>m.set(e.inst,(m.get(e.inst)||0)+1));return m}

  function spawnFx(active,playX,pitchY){const next=new Set();active.forEach((e,i)=>{const key=`${e.inst}|${e.midi??0}|${onset(e)}|${i}`;next.add(key);if(!state.activeKeys.has(key)){const color=colorOf(e.inst),y=pitchY(pitchOf(e));state.ripples.push({x:playX,y,color,life:1});for(let k=0;k<4;k++){const a=Math.random()*Math.PI*2,s=12+Math.random()*18;state.particles.push({x:playX,y,color,life:1,vx:Math.cos(a)*s,vy:Math.sin(a)*s,size:1+Math.random()*2})}}});state.activeKeys=next}
  function updateFx(dt){state.ripples.forEach(r=>r.life-=dt*2.2);state.ripples=state.ripples.filter(r=>r.life>0);state.particles.forEach(p=>{p.life-=dt*2;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=Math.pow(.2,dt);p.vy*=Math.pow(.25,dt)});state.particles=state.particles.filter(p=>p.life>0).slice(-180)}
  function roundRect(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath()}
  function draw(now){
    if(!state.style){state.raf=requestAnimationFrame(draw);return}const ctx=els.canvas.getContext('2d'),rect=els.canvas.getBoundingClientRect(),w=Math.max(1,rect.width),h=Math.max(1,rect.height),dpr=Math.min(2,window.devicePixelRatio||1);if(els.canvas.width!==Math.round(w*dpr)||els.canvas.height!==Math.round(h*dpr)){els.canvas.width=Math.round(w*dpr);els.canvas.height=Math.round(h*dpr);}ctx.setTransform(dpr,0,0,dpr,0,0);const dt=Math.min(.05,Math.max(.001,(now-state.lastNow)/1000));state.lastNow=now;const playing=state.mode==='live'?engine.isPlaying():!els.audio.paused;const beat=currentBeat();const s=state.style,left=58,top=28,bottom=34,playX=w*.39,beatWindow=16,pxBeat=w/beatWindow;const pitches=s.events.map(pitchOf).filter(Number.isFinite);const minP=Math.max(20,Math.min(...pitches)-3),maxP=Math.min(108,Math.max(...pitches)+3),span=Math.max(12,maxP-minP),pitchY=p=>top+((maxP-p)/span)*(h-top-bottom);const active=playing?s.events.filter(e=>activeAt(e,beat)):[];if(playing&&!state.reduceMotion)spawnFx(active,playX,pitchY);else state.activeKeys.clear();updateFx(dt);
    const bg=ctx.createLinearGradient(0,0,0,h);bg.addColorStop(0,'#0b1017');bg.addColorStop(1,'#05070b');ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);for(let i=0;i<38;i++){ctx.fillStyle=i%2?'rgba(255,255,255,.005)':'rgba(255,255,255,.012)';ctx.fillRect(0,i*h/38,w,1)}
    const activeP=new Map(active.map(e=>[pitchOf(e),colorOf(e.inst)]));for(let p=minP;p<=maxP;p++){const y1=pitchY(p+.5),y2=pitchY(p-.5),hh=Math.max(2,y2-y1),pc=((p%12)+12)%12,black=[1,3,6,8,10].includes(pc);ctx.fillStyle=black?'#050608':'rgba(225,230,238,.09)';ctx.fillRect(0,y1,black?left*.63:left,hh-.5);if(activeP.has(p)){ctx.save();ctx.shadowColor=activeP.get(p);ctx.shadowBlur=18;ctx.fillStyle=activeP.get(p);ctx.fillRect(0,y1,black?left*.66:left,hh-.5);ctx.restore()}}
    for(let p=Math.ceil(minP/2)*2;p<=maxP;p+=2){const y=Math.round(pitchY(p))+.5,isC=p%12===0;ctx.strokeStyle=isC?'rgba(255,255,255,.11)':'rgba(255,255,255,.03)';ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(w,y);ctx.stroke();if(isC){ctx.fillStyle='#bcb7ac';ctx.font='11px '+getComputedStyle(document.documentElement).getPropertyValue('--mono');ctx.textAlign='right';ctx.fillText(noteName(p),left-6,y+3)}}
    const gridStep=(s.meter||'').includes('/8')?.5:1,base=Math.floor(beat/gridStep)*gridStep,first=Math.floor(((-playX+left)/pxBeat)/gridStep)*gridStep-gridStep,last=Math.ceil(((w-playX)/pxBeat)/gridStep)*gridStep+gridStep,bar=s.barLength||4;for(let off=first;off<=last+.001;off+=gridStep){const gb=base+off,frac=beat-base,x=playX+(off-frac)*pxBeat,nb=((gb%s.beats)+s.beats)%s.beats,barLine=Math.abs(nb%bar)<.001;ctx.strokeStyle=barLine?'rgba(231,155,36,.25)':Math.abs(nb-Math.round(nb))<.001?'rgba(255,255,255,.06)':'rgba(255,255,255,.028)';ctx.beginPath();ctx.moveTo(x,top-7);ctx.lineTo(x,h-bottom+6);ctx.stroke();if(barLine){ctx.textAlign='left';ctx.fillStyle='#d4b680';ctx.font='11px '+getComputedStyle(document.documentElement).getPropertyValue('--mono');ctx.fillText(`BAR ${String(Math.floor(nb/bar)+1).padStart(2,'0')}`,x+4,15)}}
    rollHits=[];ctx.save();ctx.beginPath();ctx.rect(left,top,w-left,h-top-bottom);ctx.clip();const markers=[];for(const [eventIndex,e] of s.events.entries()){const p=pitchOf(e),y=pitchY(p),du=duration(e),col=colorOf(e.inst),vel=Number(e.velocity||78);for(let loop=-2;loop<=2;loop++){const x=playX+(onset(e)+loop*s.beats-beat)*pxBeat,width=Math.max(e.kind==='drum'?8:10,du*pxBeat);if(x+width<left-10||x>w+10)continue;const isActive=playing&&x<=playX&&x+width>=playX,baseH=Math.max(2,Math.min(e.kind==='drum'?5:7,(h-top-bottom)/span*.82)),hh=isActive?baseH*1.15:baseH;ctx.save();ctx.globalAlpha=isActive?1:Math.max(.18,1-Math.abs(x-playX)/(w*.88));ctx.shadowColor=col;ctx.shadowBlur=isActive?7:0;const g=ctx.createLinearGradient(x,0,x+width,0);g.addColorStop(0,isActive?'#fff':col);g.addColorStop(isActive?.13:0,col);g.addColorStop(1,col);ctx.fillStyle=g;roundRect(ctx,x,y-hh/2,width,hh,4);ctx.fill();rollHits.push({index:eventIndex,x,y:y-9,width,height:18});if(eventIndex===studio.note){ctx.strokeStyle='#ffd071';ctx.lineWidth=2;ctx.stroke();}if(isActive){ctx.strokeStyle='#fff';ctx.lineWidth=1;roundRect(ctx,x-.5,y-hh/2-.5,width+1,hh+1,4.5);ctx.stroke();markers.push({y,col,label:e.kind==='drum'?labelOf(e.inst):noteName(p),vel})}ctx.restore()}}
    ctx.restore();state.ripples.forEach(r=>{ctx.save();ctx.globalAlpha=r.life*.7;ctx.strokeStyle=r.color;ctx.shadowColor=r.color;ctx.shadowBlur=14;ctx.lineWidth=1.3;ctx.beginPath();ctx.arc(r.x,r.y,8+(1-r.life)*30,0,Math.PI*2);ctx.stroke();ctx.restore()});state.particles.forEach(p=>{ctx.save();ctx.globalAlpha=p.life;ctx.fillStyle=p.color;ctx.shadowColor=p.color;ctx.shadowBlur=8;ctx.fillRect(p.x,p.y,p.size,p.size);ctx.restore()});const pg=ctx.createLinearGradient(playX,top,playX,h-bottom);pg.addColorStop(0,'transparent');pg.addColorStop(.13,varColor('--cyan'));pg.addColorStop(.87,varColor('--cyan'));pg.addColorStop(1,'transparent');ctx.strokeStyle=pg;ctx.lineWidth=1.5;ctx.shadowColor=varColor('--cyan');ctx.shadowBlur=playing?12:4;ctx.beginPath();ctx.moveTo(playX,top-9);ctx.lineTo(playX,h-bottom+7);ctx.stroke();ctx.shadowBlur=0;markers.slice(0,12).forEach((m,i)=>{const z=5+(m.vel/127)*4+(state.reduceMotion?0:Math.sin(now*.014+i));ctx.save();ctx.translate(playX,m.y);ctx.rotate(Math.PI/4);ctx.fillStyle='#fff';ctx.shadowColor=m.col;ctx.shadowBlur=18;ctx.fillRect(-z/2,-z/2,z,z);ctx.fillStyle=m.col;ctx.fillRect(-z*.28,-z*.28,z*.56,z*.56);ctx.restore()});const unit=(beat%bar)*((s.meter||'').includes('/8')?2:1)+1;els.position.textContent=`BAR ${String(Math.floor(beat/bar)+1).padStart(2,'0')} · ${unit.toFixed(2)}`;els.active.textContent=`${String(markers.length).padStart(2,'0')} VOICES`;updateInstrumentActivity(active);updateTransport();studio.frame(active,beat,playing,now/1000);state.raf=requestAnimationFrame(draw)
  }
  function varColor(name){return getComputedStyle(document.documentElement).getPropertyValue(name).trim()}
  function updateTransport(){const sec=state.mode==='live'?engine.getElapsed():els.audio.currentTime,dur=state.mode==='live'?engine.getDuration():(els.audio.duration||currentDuration());els.transportTime.textContent=`${timeText(sec)} / ${timeText(dur)}`;if(!state.seeking)els.scrubber.value=dur?Math.round(sec/dur*1000):0}

  function buildHarness(){state.harnessConfig=defaultsFromSpec(harnessSpec.sections);renderHarnessSections();renderHarnessPanel();updateHarnessJson()}
  function defaultsFromSpec(sections){const cfg={};for(const [section,params] of Object.entries(sections)){cfg[section]={};for(const [k,v] of Object.entries(params))cfg[section][k]=v.default}return cfg}
  function renderHarnessSections(){els.harnessSections.innerHTML='';Object.keys(harnessSpec.sections).forEach(section=>{const b=document.createElement('button');b.type='button';b.textContent=section.replaceAll('_',' ');b.classList.toggle('active',section===state.harnessSection);b.addEventListener('click',()=>{state.harnessSection=section;renderHarnessSections();renderHarnessPanel()});els.harnessSections.appendChild(b)})}
  function sourceOptions(source){if(!libraries)return[];if(source==='scale-library.json')return (libraries.scales?.scales||[]).map(x=>[x.id,x.label]);if(source==='chord-progression-library.json')return (libraries.progressions?.progressions||[]).map(x=>[x.id,`${x.label} · ${x.roman.join('–')}`]);if(source?.startsWith('pattern-preset-library.json#')){let key=source.split('#')[1];if(key==='melody')key='melody_motion';return (libraries.patterns?.patterns?.[key]||[]).map(x=>[x.id,x.label])}return[]}
  function renderHarnessPanel(){const sec=state.harnessSection,params=harnessSpec.sections[sec],cfg=state.harnessConfig[sec];els.harnessPanel.innerHTML='';for(const [key,p] of Object.entries(params)){const wrap=document.createElement('div');wrap.className='harness-control';const label=key.replaceAll('_',' ');if(p.type==='enum'){const opts=p.values?p.values.map(v=>[v,String(v)]):sourceOptions(p.source);wrap.innerHTML=`<label><span>${safe(label)}</span></label><select aria-label="${safe(label)}">${opts.map(([v,l])=>`<option value="${safe(v)}" ${String(v)===String(cfg[key])?'selected':''}>${safe(l)}</option>`).join('')}</select>`;const input=wrap.querySelector('select');input.addEventListener('input',()=>{cfg[key]=isNaN(input.value)?input.value:Number(input.value);updateHarnessJson()})}else if(p.type==='boolean'){wrap.innerHTML=`<label><span>${safe(label)}</span></label><div class="toggle-control"><input type="checkbox" aria-label="${safe(label)}" ${cfg[key]?'checked':''}><b>${cfg[key]?'ON':'OFF'}</b></div>`;const input=wrap.querySelector('input'),out=wrap.querySelector('b');input.addEventListener('change',()=>{cfg[key]=input.checked;out.textContent=input.checked?'ON':'OFF';updateHarnessJson()})}else{wrap.innerHTML=`<label><span>${safe(label)}</span><output>${formatControl(cfg[key],p)}</output></label><input type="range" aria-label="${safe(label)}" min="${p.min}" max="${p.max}" step="${p.step||1}" value="${cfg[key]}">`;const input=wrap.querySelector('input'),out=wrap.querySelector('output');input.addEventListener('input',()=>{cfg[key]=p.type==='integer'?Number.parseInt(input.value):Number(input.value);out.textContent=formatControl(cfg[key],p);updateHarnessJson()})}els.harnessPanel.appendChild(wrap)}}
  function formatControl(v,p){if(p.unit)return `${Number(v).toFixed((p.step||1)<1?2:0)} ${p.unit}`;return Number.isFinite(Number(v))?Number(v).toFixed((p.step||1)<1?2:0):String(v)}
  function updateHarnessJson(){els.harnessJson.textContent=JSON.stringify(state.harnessConfig,null,2)}
  const MODE_TO_SCALE={major:'ionian',minor:'aeolian',dorian:'dorian',phrygian:'phrygian',lydian:'lydian',mixolydian:'mixolydian',melodic_minor:'melodic_minor',whole_tone:'whole_tone',octatonic:'octatonic_wh'};
  const GRAMMAR_TO_GROOVE={funk:'funk',tango:'tango',waltz:'waltz',bossa:'bossa',samba:'samba',breaks:'breakbeat',swing:'shuffle',dub:'one_drop',field:'floating',minimal:'floating',techno:'motor'};
  const GAME_CONTEXT_HINTS=[[/combat|siege|duel|boss|arena|sprint/,'combat'],[/stealth|infiltration/,'stealth'],[/puzzle/,'puzzle'],[/town|city|capital|court/,'town'],[/voyage|travel|sea|route/,'travel'],[/overworld|exploration|gallery|pastoral/,'exploration'],[/chase/,'chase'],[/victory/,'victory']];
  function pickHarnessValue(spec,value){if(value==null||value==='')return;const options=spec?.values||(spec?.source?sourceOptions(spec.source).map(([v])=>v):null);if(!options?.length){if(spec?.type==='boolean')return Boolean(value);if(spec?.min!=null||spec?.max!=null){const n=Number(value);if(!Number.isFinite(n))return;return clamp(n,spec.min??-Infinity,spec.max??Infinity)}return value}const found=options.find(v=>String(v)===String(value));if(found!==undefined)return found;if(typeof options[0]==='number'&&Number.isFinite(Number(value))){const n=Number(value);return options.reduce((best,v)=>Math.abs(Number(v)-n)<=Math.abs(Number(best)-n)?v:best)}}
  function assignHarness(section,key,value){const spec=harnessSpec.sections?.[section]?.[key];if(!spec||!state.harnessConfig?.[section])return;const next=pickHarnessValue(spec,value);if(next!==undefined)state.harnessConfig[section][key]=next}
  function gameContextFromCue(style){const text=`${style.composition_contract?.game_function||''} ${style.subcategory||''}`.toLowerCase();for(const [pattern,id] of GAME_CONTEXT_HINTS){if(pattern.test(text))return id}}
  function syncHarnessKey(){if(!state.harnessConfig)return;assignHarness('harmony','key',pitchNames.indexOf(transposedKey()));updateHarnessJson();if(state.view==='recipe')renderHarnessPanel()}
  function syncHarnessFromTrack(){if(!state.style||!harnessSpec)return;const style=state.style,mix=style.mix||{},mixV3=style.mix_v3||{},evidence=style.writing_evidence||{},generation=style.generation||{},form=Array.isArray(style.form)?style.form:[],roles=evidence.roles||[],leads=harnessSpec.sections.orchestration.primary_lead.values,mixBus=libraries?.mix_bus;state.harnessConfig=defaultsFromSpec(harnessSpec.sections);assignHarness('brief','category',style.category);assignHarness('brief','voice_budget',style.voice_budget);assignHarness('brief','loop_bars',style.bars??style.loop_bars);assignHarness('brief','energy',style.metrics?.energy);assignHarness('brief','tension',style.metrics?.tension);assignHarness('brief','game_context',gameContextFromCue(style));assignHarness('brief','seed',generation.seed);assignHarness('harmony','key',pitchNames.indexOf(transposedKey()));assignHarness('harmony','scale_id',MODE_TO_SCALE[style.mode]||style.mode);assignHarness('rhythm','meter',style.meter);assignHarness('rhythm','groove_template',GRAMMAR_TO_GROOVE[evidence.grammar]||evidence.grammar);assignHarness('form','architecture',generation.architecture);assignHarness('form','section_count',form.length);assignHarness('form','phrase_bars',form[0]?.bars);assignHarness('orchestration','primary_lead',roles.find(role=>leads.includes(role)));assignHarness('orchestration','secondary_lead',roles.slice(1).find(role=>harnessSpec.sections.orchestration.secondary_lead.values.includes(role)));assignHarness('orchestration','layer_count',Object.keys(style.instrument_map||{}).length||undefined);assignHarness('mix','target_lufs',mixV3.target_lufs??mixBus?.master?.category_lufs_targets?.[style.category]);assignHarness('mix','ceiling_dbfs',mixV3.true_peak_dbfs??mixBus?.master?.true_peak_default_dbfs);assignHarness('mix','lead_duck_db',mixV3.lead_duck_db);assignHarness('mix','kick_bass_duck_db',mixV3.kick_bass_duck_db);assignHarness('mix','master_volume_db',mixBus?.master?.monitor_volume_default_db);assignHarness('mix','delay_send',mix.echo_feedback);assignHarness('mix','saturation',mix.drive);assignHarness('humanize','timing_depth',style.performance_refinement?.amount);assignHarness('humanize','dynamics_depth',style.performance_refinement?.amount);assignHarness('humanize','role_placement',style.performance_refinement?.amount);updateHarnessJson();const status=$('recipeCueStatus');if(status)status.textContent=style.title?`${style.title} · ${style.sound_palette||'catalog'} palette · mix v3 · harness ${harnessSpec.version||libraries?.harness_version||'3.0.0'}`:'Select a composition in Studio to load its recipe.';if(state.view==='recipe')renderHarnessPanel()}
  function downloadHarness(){const blob=new Blob([JSON.stringify(state.harnessConfig,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${state.style?.id||'neospc'}-recipe.json`;a.click();URL.revokeObjectURL(a.href)}


  function buildSoundbank(){
    if(!factoryBank)return;
    factoryPatches=Object.values(factoryBank.patches||{});
    const families=[...new Set(factoryPatches.map(p=>p.family))].sort();
    els.bankFamily.innerHTML='<option value="all">All families</option>'+families.map(f=>`<option value="${safe(f)}">${safe(f.replaceAll('_',' '))}</option>`).join('');
    const notes=[36,41,48,53,60,65,72,77,84];
    els.bankKeys.innerHTML=notes.map(n=>`<button type="button" data-bank-note="${n}"><span>${noteName(n)}</span><small>${n}</small></button>`).join('');
    renderSoundbank();
  }
  function filteredBankPatches(){
    const q=state.bankSearch.trim().toLowerCase();
    return Object.values((window.NEOSPC_PALETTES?.[state.bankMode]||factoryBank)?.patches||{}).filter(p=>state.bankFamily==='all'||p.family===state.bankFamily).filter(p=>!q||[p.id,p.label,p.family,...(p.tags||[])].join(' ').toLowerCase().includes(q));
  }
  function renderSoundbank(){
    if(!factoryBank||!els.bankPatchList)return;
    const arr=filteredBankPatches();
    els.bankPatchCount.textContent=arr.length;
    els.bankPatchList.innerHTML='';
    els.bankEmpty.hidden=arr.length>0;
    arr.forEach(p=>{const b=document.createElement('button');b.type='button';b.className='bank-patch-row'+(p.id===state.bankPatchId?' active':'');b.innerHTML=`<strong>${safe(p.label)}</strong><small>${safe(p.id)}</small><div><span>${safe(p.family.replaceAll('_',' '))}</span><span>${p.profiles.neo16.regions.length} regions</span></div>`;b.addEventListener('click',()=>selectBankPatch(p.id));els.bankPatchList.appendChild(b)});
    if(!state.bankPatchId&&arr[0])state.bankPatchId=arr[0].id;
    renderBankPatchDetail();
  }
  function selectBankPatch(id){if(state.bankPreviewAudio){state.bankPreviewAudio.pause();state.bankPreviewAudio=null}state.bankPatchId=id;els.bankAuditionStatus.textContent='READY';renderSoundbank()}
  function currentBankPatch(){const bank=window.NEOSPC_PALETTES?.[state.bankMode]||factoryBank;return bank?.patches?.[state.bankPatchId]||Object.values(bank?.patches||{})[0]}
  function renderBankPatchDetail(){
    const p=currentBankPatch();if(!p)return;
    const hasPreview=state.bankMode==='factory';
    if(!p.profiles[state.bankProfile]||(state.bankProfile==='neo32'&&!hasPreview))state.bankProfile='neo16';
    const profile=p.profiles[state.bankProfile];
    els.bankFamilyLabel.textContent=p.family.replaceAll('_',' ');
    els.bankTitle.textContent=p.label;els.bankId.textContent=p.id;els.bankType.textContent=p.type;
    els.bankRange.textContent=p.range?`${noteName(p.range[0])} – ${noteName(p.range[1])}`:`Trigger ${p.note||60}`;
    els.bankRoots.textContent=(p.roots||[p.note||60]).map(noteName).join(' · ');els.bankRegions.textContent=profile.regions.length;
    els.bankTags.innerHTML=(p.tags||[]).map(t=>`<span>${safe(t)}</span>`).join('');
    els.bankProfileLabel.textContent=state.bankProfile==='neo16'?'MULTISAMPLE':'44.1 kHz PREVIEW';
    els.bankProfileNote.textContent=state.bankProfile==='neo16'?'Studio Multisample uses every embedded register, intensity layer and alternate attack. Works offline.':'A representative 44.1 kHz note from Chamber. Choose Multisample to play different notes and intensities.';
    els.bankRegionTable.innerHTML=profile.regions.slice(0,18).map(r=>`<div><code>${safe(r.file.split('/').pop())}</code><span>${noteName(r.lokey)}–${noteName(r.hikey)}</span><span>V${r.lovel}–${r.hivel}</span><span>ROOT ${noteName(r.root)}</span><span>RR ${r.rr}/${r.rr_count}</span></div>`).join('');
    $$('#view-soundbank [data-bank-profile]').forEach(b=>{b.disabled=!p.profiles[b.dataset.bankProfile]||(b.dataset.bankProfile==='neo32'&&!hasPreview);const active=b.dataset.bankProfile===state.bankProfile;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active))});
    $$('.bank-patch-row',els.bankPatchList).forEach(b=>b.classList.toggle('active',b.querySelector('small')?.textContent===p.id));
  }
  async function auditionBankPatch(note){
    const patch=currentBankPatch();if(!patch)return;
    note=Number(note);state.bankVelocity=Number(els.bankVelocity.value);els.bankVelocityValue.textContent=state.bankVelocity;els.bankAuditionStatus.textContent='LOADING';
    try{
      if(state.bankProfile==='neo16'){
        const info={factory_patch:patch.id,factory_profile:'neo16',root_midi:patch.note||60};
        const event={kind:patch.type==='drum'||patch.type==='fx'?'drum':'note',midi:note,velocity:state.bankVelocity,beat:0};
        const region=engine.resolveFactoryRegion(info,event);if(!region)throw new Error('No matching region');
        const ctx=await engine.ensureContext(),buffer=await engine.decodeFile(region.file),src=ctx.createBufferSource(),g=ctx.createGain(),pan=ctx.createStereoPanner?ctx.createStereoPanner():null;
        src.buffer=buffer;src.playbackRate.value=Math.pow(2,(note-Number(region.root||note))/12);g.gain.value=.52*(state.bankVelocity/127)*engine.sampleGain(region.file);
        if(region.loop&&patch.loop){const sr=Number(factoryBank.profiles.neo16.sample_rate||32000);src.loop=true;src.loopStart=region.loop.start_sec??region.loop.start/sr;src.loopEnd=Math.min(buffer.duration,region.loop.end_sec??region.loop.end/sr)}
        src.connect(g);if(pan){g.connect(pan);pan.connect(engine.master)}else g.connect(engine.master);const end=ctx.currentTime+(patch.loop?2.3:Math.min(2.5,buffer.duration/src.playbackRate.value));g.gain.setValueAtTime(g.gain.value,ctx.currentTime);g.gain.setTargetAtTime(.0001,end-.08,.02);src.start();src.stop(end);els.bankAuditionStatus.textContent=`PLAYING ${noteName(note)} · MULTISAMPLE`;
      }else{
        const preview=factoryPreviews[patch.id];if(!preview)throw new Error('Preview unavailable');
        if(state.bankPreviewAudio){state.bankPreviewAudio.pause();state.bankPreviewAudio=null}
        const a=new Audio(preview.file);a.volume=Math.min(1,.52*(state.bankVelocity/127)*Math.pow(10,(window.NEOSPC_LEVELS.preview_gain_db[preview.file]+state.volume-3.01)/20));a.playbackRate=Math.pow(2,(note-Number(preview.root||note))/12);a.preservesPitch=false;a.webkitPreservesPitch=false;state.bankPreviewAudio=a;await a.play();els.bankAuditionStatus.textContent=`PLAYING ${noteName(note)} · 44.1 kHz PREVIEW`;
      }
    }catch(err){els.bankAuditionStatus.textContent='AUDITION ERROR';notice('This patch could not play. Try Multisample or another key.','error');console.error(err)}
  }
  function renderBankCueMap(){
    if(!els.bankCueMap||!state.style)return;
    const entries=Object.entries(state.style.instrument_map||{}),mapped=entries.filter(([,v])=>v.factory_patch);
    els.bankCueTitle.textContent=state.style.title;els.bankCoverageText.textContent=`${mapped.length} of ${entries.length} instruments mapped to ${bankLabels[state.bankMode]}. ${['megadrive','snes'].includes(state.bankMode)?'Sample preview with Studio mixing. Native console demos and downloads are above.':''}`;
    els.bankCueMap.innerHTML=entries.map(([inst,info])=>`<div class="${info.factory_patch?'factory':'legacy'}"><span><i style="background:${safe(info.color||'#888')}"></i>${safe(info.label||inst)}</span><strong>${safe(engine.factoryPatch(info)?.label||info.factory_label||'Compatibility patch')}</strong></div>`).join('');
  }

  function renderReview(){
    if(!state.style)return;
    const r=finalReviews.get(state.style.id);
    els.reviewPass1.textContent=`${reviewBundle.pass1.summary.approved||0}/${catalog.styles.length}`;els.reviewFinal.textContent=`${reviewBundle.final.summary.approved||0}/${catalog.styles.length}`;els.reviewAverage.textContent=reviewBundle.final.average_score.toFixed(1);els.reviewTitle.textContent=state.style.title;els.reviewSubtitle.textContent=`${state.style.category_label} · ${state.style.subcategory}`;els.dimensionGrid.innerHTML='';els.rubricList.innerHTML='';
    for(const [k,v] of Object.entries(reviewBundle.rubric?.dimensions||{})){const d=document.createElement('div');d.className='rubric-item';d.innerHTML=`<strong>${safe(k.replaceAll('_',' '))}</strong><span>weight ${v.weight} · ${safe(v.questions[0])}</span>`;els.rubricList.appendChild(d)}
    if(state.style.source_type==='local_import'){
      els.reviewScore.textContent='—';els.reviewStatus.textContent='LOCAL';els.reviewStatus.className='review-status quality-local';els.critiqueList.innerHTML='<li>This local score has no bundled review report.</li>';els.actionList.innerHTML='<li>Run neospc.py review on its catalog, then keep the report with the project.</li>';return;
    }
    els.reviewScore.textContent=r?Math.round(r.score):'—';els.reviewStatus.textContent=r?.status||'—';els.reviewStatus.className=`review-status quality-${r?.status==='approved'?'curated':'review'}`;for(const [k,v] of Object.entries(r?.dimension_scores||{})){const item=document.createElement('div');item.className='dimension-item';item.innerHTML=`<div class="dimension-top"><span>${safe(k.replaceAll('_',' '))}</span><b>${v.toFixed(1)}</b></div><div class="dimension-bar"><i style="width:${v*10}%"></i></div>`;els.dimensionGrid.appendChild(item)}els.critiqueList.innerHTML=(r?.critique||[]).map(x=>`<li>${safe(x)}</li>`).join('');els.actionList.innerHTML=(r?.required_actions?.length?r.required_actions:['No blocking action. Refinement only.']).map(x=>`<li>${safe(String(x).replaceAll('_',' '))}</li>`).join('')
  }

  async function copyHarness(){
    const text=JSON.stringify(state.harnessConfig,null,2);let copied=false;
    try{await navigator.clipboard.writeText(text);copied=true}catch{
      const area=document.createElement('textarea');area.value=text;area.setAttribute('readonly','');area.style.position='fixed';area.style.opacity='0';document.body.appendChild(area);area.select();try{copied=document.execCommand('copy')}catch{}area.remove();
    }
    els.copyHarness.textContent=copied?'Copied':'Copy failed';notice(copied?'Recipe JSON copied.':'Copy failed. Use Download JSON instead.',copied?'info':'error');setTimeout(()=>els.copyHarness.textContent='Copy JSON',1400)
  }
  function validateImportedStyle(value,index){
    const fail=message=>{throw new Error(`Score ${index+1}: ${message}`)};
    if(!value||typeof value!=='object'||Array.isArray(value))fail('expected a composition object.');
    if(!/^[a-z0-9_]+$/.test(String(value.id||'')))fail('id must use lowercase letters, digits and underscores.');
    if(cueCache.has(value.id)||catalog.styles.some(style=>style.id===value.id))fail(`id "${value.id}" is already loaded.`);
    if(typeof value.title!=='string'||!value.title.trim()||value.title.length>120)fail('title must contain 1–120 characters.');
    if(!catalog.categories.some(category=>category.id===value.category))fail(`category "${value.category}" is not in this skill version.`);
    if(typeof value.meter!=='string'||!value.meter.includes('/'))fail('meter is missing or invalid.');
    if(!pitchNames.includes(value.key))fail('key must use the Neo-SPC pitch-name set.');
    if(typeof value.mode!=='string'||!value.mode.trim())fail('mode is missing.');
    if(!Number.isFinite(Number(value.bpm))||value.bpm<30||value.bpm>260)fail('bpm must be between 30 and 260.');
    if(!Number.isFinite(Number(value.beats))||value.beats<=0||value.beats>2000)fail('beats must be above 0 and at most 2000.');
    if(!Number.isInteger(value.voice_budget)||value.voice_budget<8||value.voice_budget>32)fail('voice_budget must be an integer from 8 to 32.');
    if(!Number.isInteger(value.measured_peak_voices)||value.measured_peak_voices<1||value.measured_peak_voices>value.voice_budget)fail('measured_peak_voices must fit the declared voice budget.');
    if(!Array.isArray(value.form)||value.form.length<2)fail('form must contain at least two sections.');
    if(!Array.isArray(value.chord_plan))fail('chord_plan must be an array.');
    if(!Array.isArray(value.events)||!value.events.length)fail('events must be a non-empty array.');
    if(value.events.length>importLimits.events)fail(`event count exceeds ${importLimits.events}.`);
    if(!value.instrument_map||typeof value.instrument_map!=='object'||Array.isArray(value.instrument_map))fail('instrument_map must be an object.');
    for(const [eventIndex,event] of value.events.entries()){
      if(!event||typeof event!=='object'||Array.isArray(event))fail(`event ${eventIndex+1} is invalid.`);
      if(!['note','drum'].includes(event.kind))fail(`event ${eventIndex+1} has an invalid kind.`);
      if(typeof event.inst!=='string'||!Object.prototype.hasOwnProperty.call(value.instrument_map,event.inst))fail(`event ${eventIndex+1} uses an undeclared instrument.`);
      const beat=Number(event.performance_beat??event.beat);
      if(!Number.isFinite(beat)||beat<0||beat>=Number(value.beats))fail(`event ${eventIndex+1} starts outside the loop.`);
      if(event.kind==='note'&&(!Number.isFinite(Number(event.midi))||event.midi<0||event.midi>127))fail(`event ${eventIndex+1} has an invalid MIDI note.`);
    }
    for(const [inst,info] of Object.entries(value.instrument_map)){
      if(!info||typeof info!=='object'||Array.isArray(info))fail(`instrument "${inst}" is invalid.`);
      if(typeof info.file!=='string'||!info.file.endsWith('.wav'))fail(`instrument "${inst}" needs an embedded .wav source for Studio Compact.`);
    }
    const style=JSON.parse(JSON.stringify(value));
    style.source_type='local_import';style.category_label=style.category_label||catalog.categories.find(category=>category.id===style.category)?.label||style.category;style.subcategory=style.subcategory||'Local composition';style.kicker=style.kicker||`LOCAL SCORE · ${style.meter}`;style.description=style.description||'Local Game Music Composer score loaded for live soundbank comparison.';style.tags=Array.isArray(style.tags)?style.tags:[];
    return style;
  }
  async function importCompositionFiles(fileList){
    const files=[...fileList],added=[],errors=[];
    for(const file of files){
      if(file.size>importLimits.bytes){errors.push(`${file.name}: file exceeds 5 MB.`);continue}
      try{
        const documentValue=JSON.parse(await file.text());
        const styles=Array.isArray(documentValue?.styles)?documentValue.styles:[documentValue];
        if(styles.length>importLimits.styles)throw new Error(`catalog exceeds ${importLimits.styles} scores.`);
        for(const raw of styles){
          if(state.localImportCount>=importLimits.styles)throw new Error(`session limit is ${importLimits.styles} scores.`);
          const candidate=['gmc-brainstorm-session','gmc-brainstorm-score'].includes(raw?.kind)?StudioScore.generated(MusicLab.importScore(raw),window.STUDIO_INSTRUMENTS,'atelier_import_'+Date.now()+'_'+state.localImportCount,catalog.categories[0]):raw;
          const style=validateImportedStyle(candidate,state.localImportCount);
          if(state.localImportEvents+style.events.length>importLimits.events)throw new Error(`session event limit is ${importLimits.events}.`);
          catalog.styles.push(style);cueCache.set(style.id,style);state.localImportCount++;state.localImportEvents+=style.events.length;added.push(style);
        }
      }catch(error){errors.push(`${file.name}: ${error.message}`)}
    }
    els.compositionInput.value='';
    if(added.length){els.localImportStatus.textContent=`${state.localImportCount} local score${state.localImportCount===1?'':'s'} · ${state.localImportEvents} events · session only`;switchCategory('all',added[added.length-1].id)}
    if(errors.length)notice(`${added.length?`${added.length} loaded. `:''}${errors[0]}${errors.length>1?` (+${errors.length-1} more)`:''}`,'error');
    else if(added.length)notice(`${added.length} local score${added.length===1?'':'s'} loaded. Compare them with any live soundbank.`);
  }
  async function addLocalScore(score){if(state.localImportCount>=importLimits.styles||state.localImportEvents+score.events.length>importLimits.events)throw Error('Session limit reached. Export your drafts before reloading.');const next=validateImportedStyle(score,state.localImportCount);catalog.styles.push(next);cueCache.set(next.id,next);state.localImportCount++;state.localImportEvents+=next.events.length;state.category='all';state.search='';state.quality='all';els.search.value='';els.quality.value='all';$$('#categoryTabs button').forEach(b=>b.classList.toggle('active',b.dataset.id==='all'));els.categoryTitle.textContent='All cues';els.localImportStatus.textContent=state.localImportCount+' local scores · session only';await selectStyle(next.id);setView('workstation');return next}
  function clearTrackFilters(){state.search='';state.quality='all';els.search.value='';els.quality.value='all';renderTrackList();els.search.focus()}
  function clearBankFilters(){state.bankSearch='';state.bankFamily='all';els.bankSearch.value='';els.bankFamily.value='all';renderSoundbank();els.bankSearch.focus()}
  function bind(){
    els.canvas.addEventListener('pointerdown',event=>{const rect=els.canvas.getBoundingClientRect(),x=event.clientX-rect.left,y=event.clientY-rect.top;const hit=rollHits.filter(h=>x>=Math.max(58,h.x)&&x<=h.x+h.width&&y>=h.y&&y<=h.y+h.height).at(-1);if(hit)studio.selectNote(hit.index)});

    els.play.addEventListener('click',play);els.pause.addEventListener('click',pause);els.stop.addEventListener('click',stop);
    els.mode.addEventListener('change',()=>switchMode(els.mode.value));els.soundbank.addEventListener('change',()=>switchSoundbank(els.soundbank.value));els.volume.addEventListener('input',()=>setVolume(els.volume.value));els.ceiling.addEventListener('input',()=>setCeiling(els.ceiling.value));els.tempo.addEventListener('input',()=>setTempo(els.tempo.value));
    $$('[data-pitch]').forEach(b=>b.addEventListener('click',()=>setTranspose(b.dataset.pitch)));els.pitchReset.addEventListener('click',()=>setTranspose(0,true));els.resetInstruments.addEventListener('click',()=>{studio.resetMix();engine.resetInstrumentVolumes(state.style);renderInstrumentActivity();notice('Instrument levels reset.')});
    els.search.addEventListener('input',()=>{state.search=els.search.value;renderTrackList()});els.quality.addEventListener('change',()=>{state.quality=els.quality.value;renderTrackList()});els.clearTrackFilters.addEventListener('click',clearTrackFilters);els.loadComposition.addEventListener('click',()=>els.compositionInput.click());els.compositionInput.addEventListener('change',()=>importCompositionFiles(els.compositionInput.files));
    els.scrubber.addEventListener('input',()=>{state.seeking=true;const fraction=Number(els.scrubber.value)/1000;if(state.mode==='live')engine.seekBeat(fraction*state.style.beats);else els.audio.currentTime=fraction*(els.audio.duration||currentDuration())});els.scrubber.addEventListener('change',()=>state.seeking=false);
    $$('.bank-console-packs audio').forEach(audio=>{audio.volume=Math.pow(10,window.NEOSPC_LEVELS.demo_gain_db[audio.getAttribute('src')]/20);audio.addEventListener('play',()=>{pause();$$('.bank-console-packs audio').forEach(other=>{if(other!==audio)other.pause()})})});
    els.audio.addEventListener('ended',()=>{els.transportState.textContent='READY';});els.audio.addEventListener('error',()=>{els.transportState.textContent='MASTER ERROR';if(state.mode==='mastered'){switchMode('live');notice(`Mastered preview unavailable. Switched to ${bankLabels[state.bankMode]}.`,'error')}});
    els.copyHarness.addEventListener('click',copyHarness);els.downloadHarness.addEventListener('click',()=>{downloadHarness();notice('Recipe JSON downloaded.')});els.resetHarness.addEventListener('click',()=>{state.harnessConfig=defaultsFromSpec(harnessSpec.sections);syncHarnessFromTrack();renderHarnessPanel();notice('Recipe reset to the current cue defaults.')});
    els.bankSearch.addEventListener('input',()=>{state.bankSearch=els.bankSearch.value;renderSoundbank()});els.bankFamily.addEventListener('change',()=>{state.bankFamily=els.bankFamily.value;renderSoundbank()});els.clearBankFilters.addEventListener('click',clearBankFilters);
    $$('[data-bank-profile]').forEach(b=>b.addEventListener('click',()=>{state.bankProfile=b.dataset.bankProfile;renderBankPatchDetail()}));els.bankVelocity.addEventListener('input',()=>{state.bankVelocity=Number(els.bankVelocity.value);els.bankVelocityValue.textContent=state.bankVelocity});els.bankKeys.addEventListener('click',e=>{const b=e.target.closest('[data-bank-note]');if(b)auditionBankPatch(b.dataset.bankNote)});
    $$('[data-use-soundbank]').forEach(button=>button.addEventListener('click',async()=>{await switchSoundbank(button.dataset.useSoundbank);setView('workstation');requestAnimationFrame(()=>document.querySelector('.main-rack')?.scrollIntoView({behavior:state.reduceMotion?'auto':'smooth',block:'start'}))}));
  }
  function init(){
    Object.assign(els,{categories:$('categoryTabs'),kicker:$('trackKicker'),title:$('trackTitle'),description:$('trackDescription'),meta:$('trackMeta'),play:$('playButton'),pause:$('pauseButton'),stop:$('stopButton'),mode:$('playbackMode'),soundbank:$('soundbankMode'),midi:$('midiLink'),audioDownload:$('audioDownloadLink'),volume:$('volumeSlider'),volumeValue:$('volumeValue'),ceiling:$('ceilingSlider'),ceilingValue:$('ceilingValue'),tempo:$('tempoSlider'),tempoValue:$('tempoValue'),bpmValue:$('bpmValue'),pitchValue:$('pitchValue'),keyValue:$('keyValue'),pitchReset:$('pitchReset'),transportState:$('transportState'),transportTime:$('transportTime'),scrubber:$('scrubber'),instrumentActivity:$('instrumentActivity'),resetInstruments:$('resetInstruments'),canvas:$('pianoRoll'),position:$('positionReadout'),active:$('activeReadout'),form:$('formText'),harmony:$('harmonyText'),voice:$('voiceText'),direction:$('directionText'),categoryTitle:$('categoryTitle'),categoryCount:$('categoryCount'),search:$('searchInput'),quality:$('qualityFilter'),trackList:$('trackList'),trackEmpty:$('trackEmpty'),clearTrackFilters:$('clearTrackFilters'),loadComposition:$('loadCompositionButton'),compositionInput:$('compositionFileInput'),localImportStatus:$('localImportStatus'),audio:$('audioPlayer'),harnessSections:$('harnessSections'),harnessPanel:$('harnessPanel'),harnessJson:$('harnessJson'),copyHarness:$('copyHarness'),downloadHarness:$('downloadHarness'),resetHarness:$('resetHarness'),reviewPass1:$('reviewPass1'),reviewFinal:$('reviewFinal'),reviewAverage:$('reviewAverage'),reviewTitle:$('reviewTitle'),reviewSubtitle:$('reviewSubtitle'),reviewScore:$('reviewScore'),reviewStatus:$('reviewStatus'),dimensionGrid:$('dimensionGrid'),critiqueList:$('critiqueList'),actionList:$('actionList'),rubricList:$('rubricList'),bankSearch:$('bankSearch'),bankFamily:$('bankFamily'),bankPatchCount:$('bankPatchCount'),bankPatchList:$('bankPatchList'),bankEmpty:$('bankEmpty'),clearBankFilters:$('clearBankFilters'),bankFamilyLabel:$('bankFamilyLabel'),bankTitle:$('bankTitle'),bankId:$('bankId'),bankType:$('bankType'),bankRange:$('bankRange'),bankRoots:$('bankRoots'),bankRegions:$('bankRegions'),bankTags:$('bankTags'),bankVelocity:$('bankVelocity'),bankVelocityValue:$('bankVelocityValue'),bankKeys:$('bankKeys'),bankAuditionStatus:$('bankAuditionStatus'),bankProfileNote:$('bankProfileNote'),bankProfileLabel:$('bankProfileLabel'),bankRegionTable:$('bankRegionTable'),bankCueTitle:$('bankCueTitle'),bankCoverageText:$('bankCoverageText'),bankCueMap:$('bankCueMap'),notice:$('appNotice')});
    $('bankPaletteSelect').innerHTML=els.soundbank.innerHTML;$('bankPaletteSelect').addEventListener('change',event=>switchSoundbank(event.target.value));
    const prefs=readPrefs(),params=new URLSearchParams(location.search),requestedCue=params.get('cue')||prefs.styleId,requestedStyle=catalog.styles.find(style=>style.id===requestedCue);state.category=requestedStyle?.category||(prefs.category==='all'||catalog.categories.some(category=>category.id===prefs.category)?prefs.category:catalog.categories[0].id);const initialView=params.get('view')||(requestedCue&&params.get('cue')?'workstation':prefs.view)||'create';state.view=['create','workstation','recipe','soundbank','review'].includes(initialView)?initialView:'workstation';state.mode=bankLabels[params.get('bank')]?'live':(['live','mastered'].includes(prefs.mode)?prefs.mode:'live');state.bankMode=bankLabels[params.get('bank')]?params.get('bank'):(bankLabels[prefs.bankMode]?prefs.bankMode:'factory');state.requestedBank=bankLabels[params.get('bank')]?params.get('bank'):null;els.mode.value=state.mode;els.soundbank.value=state.bankMode;els.soundbank.disabled=state.mode==='mastered';engine.setBankMode(state.bankMode);
    studio=new window.StudioAtelier({
      category:()=>catalog.categories.find(c=>c.id===state.style?.category)||catalog.categories[0],
      transpose:()=>state.transpose,
      level:(id,value)=>{if(value!==undefined){if(state.mode!=='live')switchMode('live');engine.setInstrumentVolume(id,value);const row=[...els.instrumentActivity.children].find(r=>r.dataset.inst===id);if(row){row.querySelector('input').value=value;row.querySelector('b').textContent=value+'%'}}return engine.getInstrumentVolume(id)},
      refresh:async id=>{const beat=currentBeat(),was=state.mode==='live'?engine.isPlaying():!els.audio.paused;engine.pause();els.audio.pause();await selectStyle(id);engine.seekBeat(beat);if(was)await play()},
      add:addLocalScore,
      wav:async()=>{const score=state.style,settings={bankMode:state.bankMode,tempoPct:state.tempo,transpose:state.transpose,masterDb:state.volume,ceilingDb:state.ceiling,instrumentVolumes:new Map(engine.instrumentVolumes)};await ensureFactoryBank();return engine.renderWav(score,settings)},
      audition:async(id,midi)=>{if(state.playbackBusy)throw Error('Wait for the soundbank to finish loading.');if(state.mode!=='live')switchMode('live');const score=state.style;if(state.bankMode!=='chip')await ensureFactoryBank();await engine.prepareStyle(score);if(state.style!==score)return;const template=score.events.find(e=>e.inst===id);engine.scheduleEvent({...template,midi,duration:.65,performance_duration:.65,velocity:90,velocity_gain:.9},engine.getBeat()+.01,engine.getBeat())}
    });
    window.GMCStudioBridge={pause:()=>{if(engine.isPlaying()||!els.audio.paused)pause()},addScore:addLocalScore,categories:()=>catalog.categories,notice};
    $('studioOpenCreate')?.addEventListener('click',()=>{if(!state.style||!window.GMCCreate)return;pause();try{window.GMCCreate.openNative(state.style);setView('create')}catch(error){notice(error.message,'error')}});
    engine.onReadyState=value=>els.transportState.textContent=value;buildAppTabs();buildCategories();buildHarness();buildSoundbank();renderSoundbankMode();bind();switchCategory(state.category,requestedStyle?.id);setView(state.view);updateGlobalDisplays();state.raf=requestAnimationFrame(draw)
  }
  addEventListener('load',()=>{try{init()}catch(error){const output=$('appNotice');output.textContent='The studio could not start. Reload the page or check the local asset files.';output.dataset.tone='error';output.hidden=false;console.error(error)}});addEventListener('pagehide',event=>{if(event.persisted){engine.pause();els.audio.pause();state.bankPreviewAudio?.pause();return;}cancelAnimationFrame(state.raf);clearTimeout(state.noticeTimer);if(state.bankPreviewAudio)state.bankPreviewAudio.pause();engine.destroy()});
})();
