(() => {
  'use strict';
  const catalog=window.NEOSPC_CATALOG;
  const harnessSpec=window.NEOSPC_HARNESS;
  const libraries=window.NEOSPC_LIBRARIES;
  const reviewBundle=window.NEOSPC_REVIEWS;
  const factoryBank=window.NEOSPC_FACTORY_BANK;
  const factoryPreviews=window.NEOSPC_FACTORY_PREVIEWS||{};
  const factoryPatches=Object.values(factoryBank?.patches||{});
  const $=id=>document.getElementById(id);
  const $$=(sel,root=document)=>[...root.querySelectorAll(sel)];
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pitchNames=['C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B'];
  const drumPitch={kick:36,snare:38,hat:42,open_hat:46,tom:45,wood:76,shaker:82,rim:37,ride:51,impact:29,brush:84};
  const finalReviews=new Map(reviewBundle.final.tracks.map(x=>[x.id,x]));
  const pass1Reviews=new Map(reviewBundle.pass1.tracks.map(x=>[x.id,x]));
  const engine=new window.NeoSpcLiveEngine();
  const els={};
  const state={view:'workstation',category:catalog.categories[0].id,style:null,search:'',quality:'all',mode:'live',tempo:100,transpose:0,volume:-3,ceiling:-1,seeking:false,activeKeys:new Set(),ripples:[],particles:[],activity:new Map(),lastNow:performance.now(),raf:0,harnessSection:'brief',harnessConfig:null,bankProfile:'neo16',bankPatchId:factoryPatches[0]?.id||null,bankSearch:'',bankFamily:'all',bankVelocity:96,bankPreviewAudio:null,reduceMotion:matchMedia('(prefers-reduced-motion: reduce)').matches};

  const onset=e=>Number(e.performance_beat??e.beat??0);
  const duration=e=>e.kind==='drum'?.14:Math.max(.035,Number(e.performance_duration??e.duration??.2));
  const pitchOf=e=>e.kind==='drum'?(drumPitch[e.inst]||60):Number(e.midi)+state.transpose;
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

  function buildAppTabs(){
    $$('#appTabs button').forEach(b=>b.addEventListener('click',()=>{
      state.view=b.dataset.view;$$('#appTabs button').forEach(x=>x.classList.toggle('active',x===b));$$('.app-view').forEach(v=>v.classList.toggle('active',v.id===`view-${state.view}`));
      if(state.view==='review')renderReview();
      if(state.view==='soundbank'){renderSoundbank();renderBankCueMap();}
    }));
  }
  function buildCategories(){
    els.categories.innerHTML='';catalog.categories.forEach(c=>{const b=document.createElement('button');b.type='button';b.textContent=c.label;b.dataset.id=c.id;b.addEventListener('click',()=>switchCategory(c.id));els.categories.appendChild(b)});
  }
  function switchCategory(id){state.category=id;state.search='';els.search.value='';$$('#categoryTabs button').forEach(b=>b.classList.toggle('active',b.dataset.id===id));const c=catalog.categories.find(x=>x.id===id);els.categoryTitle.textContent=c.label;renderTrackList();const first=filteredStyles()[0]||catalog.styles.find(s=>s.category===id);if(first)selectStyle(first.id,false)}
  function filteredStyles(){const q=state.search.trim().toLowerCase();return catalog.styles.filter(s=>s.category===state.category).filter(s=>state.quality==='all'||s.composition_quality?.status===state.quality).filter(s=>!q||[s.title,s.subcategory,s.meter,s.key,s.mode,...(s.tags||[])].join(' ').toLowerCase().includes(q))}
  function renderTrackList(){const arr=filteredStyles();els.categoryCount.textContent=arr.length;els.trackList.innerHTML='';arr.forEach(s=>{const q=s.composition_quality?.status||'review';const row=document.createElement('button');row.type='button';row.className='track-row'+(state.style?.id===s.id?' active':'');row.innerHTML=`<strong>${safe(s.title)}</strong><small>${safe(s.subcategory)}</small><div class="row-meta"><span>${s.bpm} BPM</span><span>${s.meter}</span><span>${s.voice_budget} V</span><span class="quality-${q}">${q==='curated'?'approved':q}</span></div>`;row.addEventListener('click',()=>selectStyle(s.id,false));els.trackList.appendChild(row)})}

  function setupMasteredAudio(){els.audio.pause();els.audio.src=`assets/audio/${state.style.id}.mp3`;els.audio.load();els.audio.playbackRate=state.tempo/100;els.audio.preservesPitch=true;els.audio.volume=clamp(Math.pow(10,state.volume/20),0,1)}
  async function selectStyle(id,autoplay=false){
    const s=catalog.styles.find(x=>x.id===id);if(!s)return;const wasPlaying=(state.mode==='live'&&engine.isPlaying())||(state.mode==='mastered'&&!els.audio.paused);
    engine.pause(false);els.audio.pause();state.style=s;state.activeKeys.clear();state.ripples=[];state.particles=[];state.activity.clear();engine.setStyle(s);engine.setTempo(state.tempo);engine.setTranspose(state.transpose);engine.setMasterDb(state.volume);engine.setCeilingDb(state.ceiling);setupMasteredAudio();
    els.kicker.textContent=s.kicker||`${s.category_label} · ${s.meter}`;els.title.textContent=s.title;els.description.textContent=s.description;els.meta.innerHTML='';[s.category_label,s.subcategory,`${transposedKey()} ${s.mode}`,`${s.bpm} BPM`,s.meter,`BUDGET ${s.voice_budget}`,`PEAK ${s.measured_peak_voices}`].forEach(x=>{const el=document.createElement('span');el.textContent=x;els.meta.appendChild(el)});
    els.midi.href=`assets/midi/${s.id}.mid`;els.form.textContent=(s.form||[]).map(f=>`${f.name}: ${f.bars} bars`).join(' / ');els.harmony.textContent=`${transposedKey()} ${s.mode} · ${(s.chord_plan||[]).slice(0,10).map(c=>transposeChord(c.symbol,state.transpose)).join(' – ')}`;els.voice.textContent=`${s.voice_budget}-voice budget · measured peak ${s.measured_peak_voices} · ${Object.keys(s.instrument_map||{}).length} instruments`;els.direction.textContent=s.musical_direction?.thesis||s.dna?.motif||'';
    renderInstrumentActivity();renderTrackList();renderReview();renderBankCueMap();syncHarnessFromTrack();updateGlobalDisplays();
    if(autoplay||wasPlaying)await play();
  }

  async function play(){
    els.transportState.textContent='LOADING';
    try{
      if(state.mode==='live'){engine.setStyle(state.style);engine.setTempo(state.tempo);engine.setTranspose(state.transpose);engine.setMasterDb(state.volume);engine.setCeilingDb(state.ceiling);await engine.play(currentBeat());els.transportState.textContent='PLAYING · LIVE'}
      else{els.audio.playbackRate=state.tempo/100;await els.audio.play();els.transportState.textContent='PLAYING · MASTER'}
    }catch(err){els.transportState.textContent='AUDIO ERROR';console.error(err)}
  }
  function pause(){if(state.mode==='live')engine.pause(true);else els.audio.pause();els.transportState.textContent='PAUSED'}
  function stop(){if(state.mode==='live'){engine.pause(false);engine.seekBeat(0)}else{els.audio.pause();els.audio.currentTime=0}els.scrubber.value=0;els.transportState.textContent='STOPPED'}
  function switchMode(mode){const beat=currentBeat(),was=(state.mode==='live'&&engine.isPlaying())||(state.mode==='mastered'&&!els.audio.paused);if(state.mode==='live')engine.pause(false);else els.audio.pause();state.mode=mode;els.mode.value=mode;if(mode==='live'){engine.setStyle(state.style);engine.seekBeat(beat)}else{els.audio.currentTime=beat/state.style.beats*(els.audio.duration||currentDuration())}if(was)play()}
  function setTempo(v){const beat=currentBeat(),was=(state.mode==='live'&&engine.isPlaying())||(state.mode==='mastered'&&!els.audio.paused);state.tempo=Number(v);engine.setTempo(state.tempo);els.audio.playbackRate=state.tempo/100;if(was&&state.mode==='mastered')els.audio.currentTime=beat/state.style.beats*(els.audio.duration||currentDuration());updateGlobalDisplays()}
  function setTranspose(delta,absolute=false){if(state.mode!=='live')switchMode('live');state.transpose=clamp(absolute?Number(delta):state.transpose+Number(delta),-12,12);engine.setTranspose(state.transpose);updateTrackMetaOnly();syncHarnessFromTrack();updateGlobalDisplays()}
  function setVolume(v){state.volume=Number(v);engine.setMasterDb(state.volume);els.audio.volume=clamp(Math.pow(10,state.volume/20),0,1);updateGlobalDisplays()}
  function setCeiling(v){state.ceiling=Number(v);engine.setCeilingDb(state.ceiling);updateGlobalDisplays()}
  function updateGlobalDisplays(){els.volumeValue.textContent=state.volume.toFixed(1).replace('-','−');els.ceilingValue.textContent=state.ceiling.toFixed(1).replace('-','−');els.tempoValue.textContent=`${state.tempo}%`;els.bpmValue.textContent=Math.round((state.style?.bpm||120)*state.tempo/100);els.pitchValue.textContent=`${state.transpose>0?'+':''}${state.transpose} st`;els.keyValue.textContent=state.style?transposedKey():'—'}
  function updateTrackMetaOnly(){if(!state.style)return;[...els.meta.children].forEach((x,i)=>{if(i===2)x.textContent=`${transposedKey()} ${state.style.mode}`});els.harmony.textContent=`${transposedKey()} ${state.style.mode} · ${(state.style.chord_plan||[]).slice(0,10).map(c=>transposeChord(c.symbol,state.transpose)).join(' – ')}`}
  function transposeChord(symbol,semi){if(!semi)return symbol;const m=String(symbol).match(/^([A-G](?:#|b)?)(.*)$/);if(!m)return symbol;const idx=pitchNames.indexOf(m[1]);return idx<0?symbol:pitchNames[(idx+semi+120)%12]+m[2]}

  function renderInstrumentActivity(){els.instrumentActivity.innerHTML='';const insts=[...new Set(state.style.events.map(e=>e.inst))];insts.forEach(inst=>{state.activity.set(inst,0);const row=document.createElement('div');row.className='instrument-row';row.dataset.inst=inst;row.style.setProperty('--inst',colorOf(inst));const val=engine.getInstrumentVolume(inst),info=state.style.instrument_map?.[inst]||{},patch=info.factory_label||'Compatibility patch';row.innerHTML=`<div class="instrument-name"><span><i class="instrument-dot"></i>${safe(labelOf(inst))}</span><b>${val}%</b></div><small class="instrument-patch">${safe(patch)}</small><input type="range" min="0" max="100" value="${val}" aria-label="${safe(labelOf(inst))} maximum volume"><div class="instrument-meter"><i></i></div>`;const input=row.querySelector('input'),out=row.querySelector('b');input.addEventListener('input',()=>{if(state.mode!=='live')switchMode('live');engine.setInstrumentVolume(inst,input.value);out.textContent=`${input.value}%`});els.instrumentActivity.appendChild(row)})}
  function updateInstrumentActivity(active){const counts=collections(active);$$('.instrument-row',els.instrumentActivity).forEach(row=>{const inst=row.dataset.inst,c=counts.get(inst)||0;const old=state.activity.get(inst)||0;const v=Math.max(c?1:0,old*.88);state.activity.set(inst,v);row.classList.toggle('active',v>.12);row.querySelector('.instrument-meter i').style.width=`${Math.min(100,v*100)}%`})}
  function collections(events){const m=new Map();events.forEach(e=>m.set(e.inst,(m.get(e.inst)||0)+1));return m}

  function spawnFx(active,playX,pitchY){const next=new Set();active.forEach((e,i)=>{const key=`${e.inst}|${e.midi??0}|${onset(e)}|${i}`;next.add(key);if(!state.activeKeys.has(key)){const color=colorOf(e.inst),y=pitchY(pitchOf(e));state.ripples.push({x:playX,y,color,life:1});for(let k=0;k<4;k++){const a=Math.random()*Math.PI*2,s=12+Math.random()*18;state.particles.push({x:playX,y,color,life:1,vx:Math.cos(a)*s,vy:Math.sin(a)*s,size:1+Math.random()*2})}}});state.activeKeys=next}
  function updateFx(dt){state.ripples.forEach(r=>r.life-=dt*2.2);state.ripples=state.ripples.filter(r=>r.life>0);state.particles.forEach(p=>{p.life-=dt*2;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=Math.pow(.2,dt);p.vy*=Math.pow(.25,dt)});state.particles=state.particles.filter(p=>p.life>0).slice(-180)}
  function roundRect(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath()}
  function draw(now){
    if(!state.style){state.raf=requestAnimationFrame(draw);return}const ctx=els.canvas.getContext('2d'),w=els.canvas.width,h=els.canvas.height,dt=Math.min(.05,Math.max(.001,(now-state.lastNow)/1000));state.lastNow=now;const playing=state.mode==='live'?engine.isPlaying():!els.audio.paused;const beat=playing?currentBeat():0;const s=state.style,left=58,top=28,bottom=34,playX=w*.39,beatWindow=16,pxBeat=w/beatWindow;const pitches=s.events.map(pitchOf).filter(Number.isFinite);const minP=Math.max(20,Math.min(...pitches)-3),maxP=Math.min(108,Math.max(...pitches)+3),span=Math.max(12,maxP-minP),pitchY=p=>top+((maxP-p)/span)*(h-top-bottom);const active=playing?s.events.filter(e=>activeAt(e,beat)):[];if(playing)spawnFx(active,playX,pitchY);else state.activeKeys.clear();updateFx(dt);
    const bg=ctx.createLinearGradient(0,0,0,h);bg.addColorStop(0,'#0b1017');bg.addColorStop(1,'#05070b');ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);for(let i=0;i<38;i++){ctx.fillStyle=i%2?'rgba(255,255,255,.005)':'rgba(255,255,255,.012)';ctx.fillRect(0,i*h/38,w,1)}
    const activeP=new Map(active.map(e=>[pitchOf(e),colorOf(e.inst)]));for(let p=minP;p<=maxP;p++){const y1=pitchY(p+.5),y2=pitchY(p-.5),hh=Math.max(2,y2-y1),pc=((p%12)+12)%12,black=[1,3,6,8,10].includes(pc);ctx.fillStyle=black?'#050608':'rgba(225,230,238,.09)';ctx.fillRect(0,y1,black?left*.63:left,hh-.5);if(activeP.has(p)){ctx.save();ctx.shadowColor=activeP.get(p);ctx.shadowBlur=18;ctx.fillStyle=activeP.get(p);ctx.fillRect(0,y1,black?left*.66:left,hh-.5);ctx.restore()}}
    for(let p=Math.ceil(minP/2)*2;p<=maxP;p+=2){const y=Math.round(pitchY(p))+.5,isC=p%12===0;ctx.strokeStyle=isC?'rgba(255,255,255,.11)':'rgba(255,255,255,.03)';ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(w,y);ctx.stroke();if(isC){ctx.fillStyle='#777';ctx.font='10px '+getComputedStyle(document.documentElement).getPropertyValue('--mono');ctx.textAlign='right';ctx.fillText(noteName(p),left-6,y+3)}}
    const gridStep=(s.meter||'').includes('/8')?.5:1,base=Math.floor(beat/gridStep)*gridStep,first=Math.floor(((-playX+left)/pxBeat)/gridStep)*gridStep-gridStep,last=Math.ceil(((w-playX)/pxBeat)/gridStep)*gridStep+gridStep,bar=s.barLength||4;for(let off=first;off<=last+.001;off+=gridStep){const gb=base+off,frac=beat-base,x=playX+(off-frac)*pxBeat,nb=((gb%s.beats)+s.beats)%s.beats,barLine=Math.abs(nb%bar)<.001;ctx.strokeStyle=barLine?'rgba(231,155,36,.25)':Math.abs(nb-Math.round(nb))<.001?'rgba(255,255,255,.06)':'rgba(255,255,255,.028)';ctx.beginPath();ctx.moveTo(x,top-7);ctx.lineTo(x,h-bottom+6);ctx.stroke();if(barLine){ctx.fillStyle='rgba(255,208,113,.45)';ctx.font='10px '+getComputedStyle(document.documentElement).getPropertyValue('--mono');ctx.fillText(`BAR ${String(Math.floor(nb/bar)+1).padStart(2,'0')}`,x+4,15)}}
    const markers=[];for(const e of s.events){const p=pitchOf(e),y=pitchY(p),du=duration(e),col=colorOf(e.inst),vel=Number(e.velocity||78);for(let loop=-2;loop<=2;loop++){const x=playX+(onset(e)+loop*s.beats-beat)*pxBeat,width=Math.max(e.kind==='drum'?8:10,du*pxBeat);if(x+width<left-10||x>w+10)continue;const isActive=playing&&x<=playX&&x+width>=playX,baseH=e.kind==='drum'?7:8,hh=isActive?baseH*(1.45+vel/180):baseH;ctx.save();ctx.globalAlpha=isActive?1:Math.max(.18,1-Math.abs(x-playX)/(w*.88));ctx.shadowColor=col;ctx.shadowBlur=isActive?24:6;const g=ctx.createLinearGradient(x,0,x+width,0);g.addColorStop(0,isActive?'#fff':col);g.addColorStop(isActive?.13:0,col);g.addColorStop(1,col);ctx.fillStyle=g;roundRect(ctx,x,y-hh/2,width,hh,4);ctx.fill();if(isActive){ctx.strokeStyle='#fff';ctx.lineWidth=1;roundRect(ctx,x-.5,y-hh/2-.5,width+1,hh+1,4.5);ctx.stroke();markers.push({y,col,label:e.kind==='drum'?labelOf(e.inst):noteName(p),vel})}ctx.restore()}}
    state.ripples.forEach(r=>{ctx.save();ctx.globalAlpha=r.life*.7;ctx.strokeStyle=r.color;ctx.shadowColor=r.color;ctx.shadowBlur=14;ctx.lineWidth=1.3;ctx.beginPath();ctx.arc(r.x,r.y,8+(1-r.life)*30,0,Math.PI*2);ctx.stroke();ctx.restore()});state.particles.forEach(p=>{ctx.save();ctx.globalAlpha=p.life;ctx.fillStyle=p.color;ctx.shadowColor=p.color;ctx.shadowBlur=8;ctx.fillRect(p.x,p.y,p.size,p.size);ctx.restore()});const pg=ctx.createLinearGradient(playX,top,playX,h-bottom);pg.addColorStop(0,'transparent');pg.addColorStop(.13,varColor('--cyan'));pg.addColorStop(.87,varColor('--cyan'));pg.addColorStop(1,'transparent');ctx.strokeStyle=pg;ctx.lineWidth=1.5;ctx.shadowColor=varColor('--cyan');ctx.shadowBlur=playing?12:4;ctx.beginPath();ctx.moveTo(playX,top-9);ctx.lineTo(playX,h-bottom+7);ctx.stroke();ctx.shadowBlur=0;markers.slice(0,12).forEach((m,i)=>{const z=5+(m.vel/127)*4+(state.reduceMotion?0:Math.sin(now*.014+i));ctx.save();ctx.translate(playX,m.y);ctx.rotate(Math.PI/4);ctx.fillStyle='#fff';ctx.shadowColor=m.col;ctx.shadowBlur=18;ctx.fillRect(-z/2,-z/2,z,z);ctx.fillStyle=m.col;ctx.fillRect(-z*.28,-z*.28,z*.56,z*.56);ctx.restore()});const unit=(beat%bar)*((s.meter||'').includes('/8')?2:1)+1;els.position.textContent=`BAR ${String(Math.floor(beat/bar)+1).padStart(2,'0')} · ${unit.toFixed(2)}`;els.active.textContent=`${String(markers.length).padStart(2,'0')} VOICES`;updateInstrumentActivity(active);updateTransport();state.raf=requestAnimationFrame(draw)
  }
  function varColor(name){return getComputedStyle(document.documentElement).getPropertyValue(name).trim()}
  function updateTransport(){const sec=state.mode==='live'?engine.getElapsed():els.audio.currentTime,dur=state.mode==='live'?engine.getDuration():(els.audio.duration||currentDuration());els.transportTime.textContent=`${timeText(sec)} / ${timeText(dur)}`;if(!state.seeking)els.scrubber.value=dur?Math.round(sec/dur*1000):0}

  function buildHarness(){state.harnessConfig=defaultsFromSpec(harnessSpec.sections);renderHarnessSections();renderHarnessPanel();updateHarnessJson()}
  function defaultsFromSpec(sections){const cfg={};for(const [section,params] of Object.entries(sections)){cfg[section]={};for(const [k,v] of Object.entries(params))cfg[section][k]=v.default}return cfg}
  function renderHarnessSections(){els.harnessSections.innerHTML='';Object.keys(harnessSpec.sections).forEach(section=>{const b=document.createElement('button');b.type='button';b.textContent=section.replaceAll('_',' ');b.classList.toggle('active',section===state.harnessSection);b.addEventListener('click',()=>{state.harnessSection=section;renderHarnessSections();renderHarnessPanel()});els.harnessSections.appendChild(b)})}
  function sourceOptions(source){if(source==='scale-library.json')return libraries.scales.scales.map(x=>[x.id,x.label]);if(source==='chord-progression-library.json')return libraries.progressions.progressions.map(x=>[x.id,`${x.label} · ${x.roman.join('–')}`]);if(source?.startsWith('pattern-preset-library.json#')){let key=source.split('#')[1];if(key==='melody')key='melody_motion';return (libraries.patterns.patterns[key]||[]).map(x=>[x.id,x.label])}return[]}
  function renderHarnessPanel(){const sec=state.harnessSection,params=harnessSpec.sections[sec],cfg=state.harnessConfig[sec];els.harnessPanel.innerHTML='';for(const [key,p] of Object.entries(params)){const wrap=document.createElement('div');wrap.className='harness-control';const label=key.replaceAll('_',' ');if(p.type==='enum'){const opts=p.values?p.values.map(v=>[v,String(v)]):sourceOptions(p.source);wrap.innerHTML=`<label><span>${safe(label)}</span></label><select>${opts.map(([v,l])=>`<option value="${safe(v)}" ${String(v)===String(cfg[key])?'selected':''}>${safe(l)}</option>`).join('')}</select>`;const input=wrap.querySelector('select');input.addEventListener('input',()=>{cfg[key]=isNaN(input.value)?input.value:Number(input.value);updateHarnessJson()})}else if(p.type==='boolean'){wrap.innerHTML=`<label><span>${safe(label)}</span></label><div class="toggle-control"><input type="checkbox" ${cfg[key]?'checked':''}><b>${cfg[key]?'ON':'OFF'}</b></div>`;const input=wrap.querySelector('input'),out=wrap.querySelector('b');input.addEventListener('change',()=>{cfg[key]=input.checked;out.textContent=input.checked?'ON':'OFF';updateHarnessJson()})}else{wrap.innerHTML=`<label><span>${safe(label)}</span><output>${formatControl(cfg[key],p)}</output></label><input type="range" min="${p.min}" max="${p.max}" step="${p.step||1}" value="${cfg[key]}">`;const input=wrap.querySelector('input'),out=wrap.querySelector('output');input.addEventListener('input',()=>{cfg[key]=p.type==='integer'?Number.parseInt(input.value):Number(input.value);out.textContent=formatControl(cfg[key],p);updateHarnessJson()})}els.harnessPanel.appendChild(wrap)}}
  function formatControl(v,p){if(p.unit)return `${Number(v).toFixed((p.step||1)<1?2:0)} ${p.unit}`;return Number.isFinite(Number(v))?Number(v).toFixed((p.step||1)<1?2:0):String(v)}
  function updateHarnessJson(){els.harnessJson.textContent=JSON.stringify(state.harnessConfig,null,2)}
  function syncHarnessFromTrack(){if(!state.style||!state.harnessConfig)return;const idx=pitchNames.indexOf(transposedKey());if(idx>=0)state.harnessConfig.harmony.key=idx;state.harnessConfig.brief.category=state.style.category;state.harnessConfig.brief.voice_budget=state.style.voice_budget;state.harnessConfig.brief.loop_bars=state.style.bars;state.harnessConfig.rhythm.meter=state.style.meter;state.harnessConfig.brief.energy=state.style.metrics?.energy??.5;state.harnessConfig.brief.tension=state.style.metrics?.tension??.3;updateHarnessJson();if(state.view==='recipe')renderHarnessPanel()}
  function downloadHarness(){const blob=new Blob([JSON.stringify(state.harnessConfig,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${state.style?.id||'neospc'}-recipe.json`;a.click();URL.revokeObjectURL(a.href)}


  function buildSoundbank(){
    if(!factoryBank)return;
    const families=[...new Set(factoryPatches.map(p=>p.family))].sort();
    els.bankFamily.innerHTML='<option value="all">All families</option>'+families.map(f=>`<option value="${safe(f)}">${safe(f.replaceAll('_',' '))}</option>`).join('');
    const notes=[36,41,48,53,60,65,72,77,84];
    els.bankKeys.innerHTML=notes.map(n=>`<button type="button" data-bank-note="${n}"><span>${noteName(n)}</span><small>${n}</small></button>`).join('');
    renderSoundbank();
  }
  function filteredBankPatches(){
    const q=state.bankSearch.trim().toLowerCase();
    return factoryPatches.filter(p=>state.bankFamily==='all'||p.family===state.bankFamily).filter(p=>!q||[p.id,p.label,p.family,...(p.tags||[])].join(' ').toLowerCase().includes(q));
  }
  function renderSoundbank(){
    if(!factoryBank||!els.bankPatchList)return;
    const arr=filteredBankPatches();
    els.bankPatchCount.textContent=arr.length;
    els.bankPatchList.innerHTML='';
    arr.forEach(p=>{const b=document.createElement('button');b.type='button';b.className='bank-patch-row'+(p.id===state.bankPatchId?' active':'');b.innerHTML=`<strong>${safe(p.label)}</strong><small>${safe(p.id)}</small><div><span>${safe(p.family.replaceAll('_',' '))}</span><span>${p.profiles.neo16.regions.length}/${p.profiles.neo32.regions.length} zones</span></div>`;b.addEventListener('click',()=>selectBankPatch(p.id));els.bankPatchList.appendChild(b)});
    if(!state.bankPatchId&&arr[0])state.bankPatchId=arr[0].id;
    renderBankPatchDetail();
  }
  function selectBankPatch(id){state.bankPatchId=id;renderSoundbank()}
  function currentBankPatch(){return factoryBank?.patches?.[state.bankPatchId]||factoryPatches[0]}
  function renderBankPatchDetail(){
    const p=currentBankPatch();if(!p)return;
    const profile=p.profiles[state.bankProfile];
    els.bankFamilyLabel.textContent=p.family.replaceAll('_',' ');
    els.bankTitle.textContent=p.label;els.bankId.textContent=p.id;els.bankType.textContent=p.type;
    els.bankRange.textContent=p.range?`${noteName(p.range[0])} – ${noteName(p.range[1])}`:`Trigger ${p.note||60}`;
    els.bankRoots.textContent=(p.roots||[p.note||60]).map(noteName).join(' · ');els.bankRegions.textContent=profile.regions.length;
    els.bankTags.innerHTML=(p.tags||[]).map(t=>`<span>${safe(t)}</span>`).join('');
    els.bankProfileLabel.textContent=state.bankProfile.toUpperCase();
    els.bankProfileNote.textContent=state.bankProfile==='neo16'?'Neo-16 uses the embedded multisample regions and works when the site is opened directly from disk.':'Neo-32 audition uses a representative 44.1 kHz preview; download the full bank for every zone, velocity layer and round robin.';
    els.bankRegionTable.innerHTML=profile.regions.slice(0,18).map(r=>`<div><code>${safe(r.file.split('/').pop())}</code><span>${noteName(r.lokey)}–${noteName(r.hikey)}</span><span>V${r.lovel}–${r.hivel}</span><span>ROOT ${noteName(r.root)}</span><span>RR ${r.rr}/${r.rr_count}</span></div>`).join('');
    $$('#view-soundbank [data-bank-profile]').forEach(b=>b.classList.toggle('active',b.dataset.bankProfile===state.bankProfile));
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
        src.buffer=buffer;src.playbackRate.value=Math.pow(2,(note-Number(region.root||note))/12);g.gain.value=.52*(state.bankVelocity/127);
        if(region.loop&&patch.loop){const sr=Number(factoryBank.profiles.neo16.sample_rate||32000);src.loop=true;src.loopStart=region.loop.start/sr;src.loopEnd=Math.min(buffer.duration,region.loop.end/sr)}
        src.connect(g);if(pan){g.connect(pan);pan.connect(engine.master)}else g.connect(engine.master);src.start();src.stop(ctx.currentTime+(patch.loop?2.3:Math.min(2.5,buffer.duration/src.playbackRate.value)));els.bankAuditionStatus.textContent=`PLAYING ${noteName(note)} · NEO-16`;
      }else{
        const preview=factoryPreviews[patch.id];if(!preview)throw new Error('Neo-32 preview unavailable');
        if(state.bankPreviewAudio){state.bankPreviewAudio.pause();state.bankPreviewAudio=null}
        const a=new Audio(preview.file);a.volume=.78*(state.bankVelocity/127);a.playbackRate=Math.pow(2,(note-Number(preview.root||note))/12);a.preservesPitch=false;a.webkitPreservesPitch=false;state.bankPreviewAudio=a;await a.play();els.bankAuditionStatus.textContent=`PLAYING ${noteName(note)} · NEO-32`;
      }
    }catch(err){els.bankAuditionStatus.textContent='AUDITION ERROR';console.error(err)}
  }
  function renderBankCueMap(){
    if(!els.bankCueMap||!state.style)return;
    const entries=Object.entries(state.style.instrument_map||{}),mapped=entries.filter(([,v])=>v.factory_patch);
    els.bankCueTitle.textContent=state.style.title;els.bankCoverageText.textContent=`${mapped.length} of ${entries.length} instruments use Factory Bank patches in Live Mix. Unmapped specialist colors retain the compatibility bank.`;
    els.bankCueMap.innerHTML=entries.map(([inst,info])=>`<div class="${info.factory_patch?'factory':'legacy'}"><span><i style="background:${safe(info.color||'#888')}"></i>${safe(info.label||inst)}</span><strong>${safe(info.factory_label||'Compatibility patch')}</strong></div>`).join('');
  }

  function renderReview(){if(!state.style)return;const r=finalReviews.get(state.style.id),p1=pass1Reviews.get(state.style.id);els.reviewPass1.textContent=`${reviewBundle.pass1.summary.approved||0}/100`;els.reviewFinal.textContent=`${reviewBundle.final.summary.approved||0}/100`;els.reviewAverage.textContent=reviewBundle.final.average_score.toFixed(1);els.reviewTitle.textContent=state.style.title;els.reviewSubtitle.textContent=`${state.style.category_label} · ${state.style.subcategory}`;els.reviewScore.textContent=r?Math.round(r.score):'—';els.reviewStatus.textContent=r?.status||'—';els.reviewStatus.className=`review-status quality-${r?.status==='approved'?'curated':'review'}`;els.dimensionGrid.innerHTML='';for(const [k,v] of Object.entries(r?.dimension_scores||{})){const item=document.createElement('div');item.className='dimension-item';item.innerHTML=`<div class="dimension-top"><span>${safe(k.replaceAll('_',' '))}</span><b>${v.toFixed(1)}</b></div><div class="dimension-bar"><i style="width:${v*10}%"></i></div>`;els.dimensionGrid.appendChild(item)}els.critiqueList.innerHTML=(r?.critique||[]).map(x=>`<li>${safe(x)}</li>`).join('');els.actionList.innerHTML=(r?.required_actions?.length?r.required_actions:['No blocking action. Refinement only.']).map(x=>`<li>${safe(String(x).replaceAll('_',' '))}</li>`).join('');els.rubricList.innerHTML='';for(const [k,v] of Object.entries(reviewBundle.rubric.dimensions)){const d=document.createElement('div');d.className='rubric-item';d.innerHTML=`<strong>${safe(k.replaceAll('_',' '))}</strong><span>weight ${v.weight} · ${safe(v.questions[0])}</span>`;els.rubricList.appendChild(d)}}

  function bind(){
    els.play.addEventListener('click',play);els.pause.addEventListener('click',pause);els.stop.addEventListener('click',stop);els.mode.addEventListener('change',()=>switchMode(els.mode.value));els.volume.addEventListener('input',()=>setVolume(els.volume.value));els.ceiling.addEventListener('input',()=>setCeiling(els.ceiling.value));els.tempo.addEventListener('input',()=>setTempo(els.tempo.value));$$('[data-pitch]').forEach(b=>b.addEventListener('click',()=>setTranspose(b.dataset.pitch)));els.pitchReset.addEventListener('click',()=>setTranspose(0,true));els.resetInstruments.addEventListener('click',()=>{engine.resetInstrumentVolumes(state.style);renderInstrumentActivity()});els.search.addEventListener('input',()=>{state.search=els.search.value;renderTrackList()});els.quality.addEventListener('change',()=>{state.quality=els.quality.value;renderTrackList()});els.scrubber.addEventListener('input',()=>{state.seeking=true;const fraction=Number(els.scrubber.value)/1000;if(state.mode==='live')engine.seekBeat(fraction*state.style.beats);else els.audio.currentTime=fraction*(els.audio.duration||currentDuration())});els.scrubber.addEventListener('change',()=>state.seeking=false);els.audio.addEventListener('ended',()=>els.transportState.textContent='READY');els.audio.addEventListener('error',()=>{els.transportState.textContent='MASTER ERROR';if(state.mode==='mastered')switchMode('live')});els.copyHarness.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(JSON.stringify(state.harnessConfig,null,2));els.copyHarness.textContent='Copied';setTimeout(()=>els.copyHarness.textContent='Copy JSON',1000)}catch{els.copyHarness.textContent='Select JSON'}});els.downloadHarness.addEventListener('click',downloadHarness);els.resetHarness.addEventListener('click',()=>{state.harnessConfig=defaultsFromSpec(harnessSpec.sections);syncHarnessFromTrack();renderHarnessPanel()});els.bankSearch.addEventListener('input',()=>{state.bankSearch=els.bankSearch.value;renderSoundbank()});els.bankFamily.addEventListener('change',()=>{state.bankFamily=els.bankFamily.value;renderSoundbank()});$$('[data-bank-profile]').forEach(b=>b.addEventListener('click',()=>{state.bankProfile=b.dataset.bankProfile;renderBankPatchDetail()}));els.bankVelocity.addEventListener('input',()=>{state.bankVelocity=Number(els.bankVelocity.value);els.bankVelocityValue.textContent=state.bankVelocity});els.bankKeys.addEventListener('click',e=>{const b=e.target.closest('[data-bank-note]');if(b)auditionBankPatch(b.dataset.bankNote)})
  }
  function init(){Object.assign(els,{categories:$('categoryTabs'),kicker:$('trackKicker'),title:$('trackTitle'),description:$('trackDescription'),meta:$('trackMeta'),play:$('playButton'),pause:$('pauseButton'),stop:$('stopButton'),mode:$('playbackMode'),midi:$('midiLink'),volume:$('volumeSlider'),volumeValue:$('volumeValue'),ceiling:$('ceilingSlider'),ceilingValue:$('ceilingValue'),tempo:$('tempoSlider'),tempoValue:$('tempoValue'),bpmValue:$('bpmValue'),pitchValue:$('pitchValue'),keyValue:$('keyValue'),pitchReset:$('pitchReset'),transportState:$('transportState'),transportTime:$('transportTime'),scrubber:$('scrubber'),instrumentActivity:$('instrumentActivity'),resetInstruments:$('resetInstruments'),canvas:$('pianoRoll'),position:$('positionReadout'),active:$('activeReadout'),form:$('formText'),harmony:$('harmonyText'),voice:$('voiceText'),direction:$('directionText'),categoryTitle:$('categoryTitle'),categoryCount:$('categoryCount'),search:$('searchInput'),quality:$('qualityFilter'),trackList:$('trackList'),audio:$('audioPlayer'),harnessSections:$('harnessSections'),harnessPanel:$('harnessPanel'),harnessJson:$('harnessJson'),copyHarness:$('copyHarness'),downloadHarness:$('downloadHarness'),resetHarness:$('resetHarness'),reviewPass1:$('reviewPass1'),reviewFinal:$('reviewFinal'),reviewAverage:$('reviewAverage'),reviewTitle:$('reviewTitle'),reviewSubtitle:$('reviewSubtitle'),reviewScore:$('reviewScore'),reviewStatus:$('reviewStatus'),dimensionGrid:$('dimensionGrid'),critiqueList:$('critiqueList'),actionList:$('actionList'),rubricList:$('rubricList'),bankSearch:$('bankSearch'),bankFamily:$('bankFamily'),bankPatchCount:$('bankPatchCount'),bankPatchList:$('bankPatchList'),bankFamilyLabel:$('bankFamilyLabel'),bankTitle:$('bankTitle'),bankId:$('bankId'),bankType:$('bankType'),bankRange:$('bankRange'),bankRoots:$('bankRoots'),bankRegions:$('bankRegions'),bankTags:$('bankTags'),bankVelocity:$('bankVelocity'),bankVelocityValue:$('bankVelocityValue'),bankKeys:$('bankKeys'),bankAuditionStatus:$('bankAuditionStatus'),bankProfileNote:$('bankProfileNote'),bankProfileLabel:$('bankProfileLabel'),bankRegionTable:$('bankRegionTable'),bankCueTitle:$('bankCueTitle'),bankCoverageText:$('bankCoverageText'),bankCueMap:$('bankCueMap')});engine.onReadyState=x=>els.transportState.textContent=x;buildAppTabs();buildCategories();buildHarness();buildSoundbank();bind();switchCategory(catalog.categories[0].id);updateGlobalDisplays();state.raf=requestAnimationFrame(draw)}
  addEventListener('load',init);addEventListener('beforeunload',()=>{cancelAnimationFrame(state.raf);engine.destroy()});
})();
