/* Create view: compose, vary, keep and export songs with the synthesis engine.
   Essential shows the short path (style, play, new song, variation, ideas, tracks,
   harmony). Studio adds the track inspector, song shape, master and macros.
   Every edit goes through GMCEngine.session, so undo and persistence stay there. */
(function(){
'use strict';
const E=window.GMCEngine,L=window.GMCLabels;
if(!E||!L)return;
const $=id=>document.getElementById(id);
const STORE='gmc-create-project-v1',PREFS='gmc-create-prefs-v1';
const D=E.data,S=E.session,P=E.player;
const NOTE_NAMES=['C','C♯','D','E♭','E','F','F♯','G','A♭','A','B♭','B'];
const view={mode:'essential',ready:false,busy:false,rollKey:'',roll:null,raf:0,renderQueued:false,live:false,saveTimer:0,edit:false,sel:null,drag:null,grid:1,geom:null};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const fmtTime=s=>{const n=Math.max(0,Math.floor(s));return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');};
const trackName=id=>L.name('tracks',id);
const soundName=id=>L.name('sounds',id,D.sounds[id]?.name);
const presetName=id=>L.name('presets',id,D.presets.find(p=>p.id===id)?.name);
const seedText=()=>Math.random().toString(36).slice(2,8).toUpperCase();

function el(tag,attrs={},...children){
 const node=document.createElement(tag);
 for(const [k,v] of Object.entries(attrs)){if(v===undefined||v===null||v===false)continue;if(k==='class')node.className=v;else if(k==='text')node.textContent=v;else if(k.startsWith('on'))node.addEventListener(k.slice(2),v);else if(k==='dataset')Object.assign(node.dataset,v);else node.setAttribute(k,v===true?'':v);}
 for(const c of children.flat())if(c!==null&&c!==undefined)node.append(c);
 return node;
}
function options(select,rows,value){select.replaceChildren(...rows.map(([v,label])=>el('option',{value:v,text:label})));select.value=String(value);}
function notice(message,tone='info'){const box=$('appNotice');if(!box)return;clearTimeout(notice.timer);box.textContent=message;box.dataset.tone=tone;box.hidden=false;notice.timer=setTimeout(()=>{box.hidden=true;},tone==='error'?7000:4200);}
function guard(fn){return async(...args)=>{try{return await fn(...args);}catch(err){console.error(err);notice(L.message(err.message||String(err)),'error');}};}
function download(blob,name){const url=URL.createObjectURL(blob),a=el('a',{href:url,download:name});document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
function fileBase(s=S.state){return ('gmc_'+(s.preset||'song')+'_'+s.seed).replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,48)+'_'+s.bpm+'bpm';}

// ── Host hooks ────────────────────────────────────────────────────────────────
E.host.notify=(text,error)=>notice(L.message(text),error?'error':'info');
E.host.history=()=>syncHistory();
E.host.persist=state=>{clearTimeout(view.saveTimer);view.saveTimer=setTimeout(()=>{try{localStorage.setItem(STORE,JSON.stringify(E.project(state)));}catch{}},300);};
E.host.render=(state,{live=false}={})=>{view.live=live;queueRender();};

function queueRender(){if(view.renderQueued)return;view.renderQueued=true;requestAnimationFrame(()=>{view.renderQueued=false;render();});}

// ── Boot ──────────────────────────────────────────────────────────────────────
function restore(){
 try{const prefs=JSON.parse(localStorage.getItem(PREFS)||'{}');if(prefs.mode==='studio')view.mode='studio';}catch{}
 try{const saved=localStorage.getItem(STORE);if(saved){S.replace(E.validateProject(JSON.parse(saved)));return;}}catch(err){console.warn('Saved Create project ignored:',err.message);}
 S.replace(E.compose(seedText(),'nocturne'));
}
function savePrefs(){try{localStorage.setItem(PREFS,JSON.stringify({mode:view.mode}));}catch{}}

function buildStatic(){
 options($('createPreset'),D.presets.map(p=>[p.id,L.name('genres',p.genre,D.genreNames[p.genre])+' · '+presetName(p.id)]),S.state.preset);
 options($('createFinish'),Object.keys(D.soundFinish).map(k=>[k,L.name('finishes',k)]),S.state.sound8?.finish||'balanced');
 options($('createRoot'),NOTE_NAMES.map((n,i)=>[i,n]),S.state.root);
 options($('createScale'),Object.keys(D.scaleDefs).map(k=>[k,L.name('scales',k,D.scaleDefs[k].name)]),S.state.scale);
 const prog=$('createProgression');prog.replaceChildren();
 const named=el('optgroup',{label:'Named progressions'}),refs=el('optgroup',{label:'Reference library'});
 for(const [k,v] of Object.entries(D.progressions)){if(v.meta)refs.append(el('option',{value:k,text:`${v.meta.name} · ${v.meta.formula.replaceAll(' | ','–')}`}));else if(k!=='custom')named.append(el('option',{value:k,text:L.name('progressions',k,v.name)}));}
 prog.append(el('option',{value:'custom',text:'Custom (current cards)'}),named,refs);
 bind();
}

function bind(){
 $('createPlay').addEventListener('click',guard(togglePlay));
 $('createStop').addEventListener('click',()=>{P.stop();syncTransport();});
 $('createPreset').addEventListener('change',guard(e=>{S.applyPreset(e.target.value);notice(presetName(e.target.value)+' loaded.');}));
 $('createNewSong').addEventListener('click',guard(()=>applyCandidate(S.randomCandidate({genre:'auto',respectLocks:true},seedText(),'song'),'New song')));
 $('createVariation').addEventListener('click',guard(()=>applyCandidate(S.randomCandidate({},seedText(),'variation'),'Variation')));
 $('createChaos').addEventListener('click',guard(()=>applyCandidate(S.chaosCandidate({mode:$('createChaosMode').value},seedText()),'Chaos')));
 $('createUndo').addEventListener('click',()=>{S.undo();});
 $('createRedo').addEventListener('click',()=>{S.redo();});
 $('createBpm').addEventListener('change',e=>{S.setBpm(e.target.value);});
 const vol=$('createVolume');vol.addEventListener('input',()=>S.live(s=>{s.master.volume=Number(vol.value);}));vol.addEventListener('change',()=>S.commitLive());
 $('createFinish').addEventListener('change',e=>S.ops.changeSound({finish:e.target.value}));
 $('createEssential').addEventListener('click',()=>setMode('essential'));
 $('createStudio').addEventListener('click',()=>setMode('studio'));
 $('createRoot').addEventListener('change',e=>S.setHarmony('root',e.target.value));
 $('createScale').addEventListener('change',e=>S.setHarmony('scale',e.target.value));
 $('createProgression').addEventListener('change',e=>S.setHarmony('progression',e.target.value));
 $('createRework').addEventListener('click',()=>S.ops.reworkHarmony());
 // Choosing an export closes the menu.
 document.querySelector('.create-export-menu').addEventListener('click',e=>{if(e.target.closest('button'))e.currentTarget.closest('details').open=false;});
 $('createExportWav').addEventListener('click',guard(exportWav));
 $('createExportMidi').addEventListener('click',guard(async()=>{download(E.midi(S.state,1),fileBase()+'.mid');notice('MIDI exported. Assign instruments in your DAW; the engine timbres stay in WAV.');}));
 $('createExportProject').addEventListener('click',()=>{download(new Blob([JSON.stringify(S.project(),null,2)],{type:'application/json'}),fileBase()+'.json');notice('Project saved with notes, mix, clips and idea bank.');});
 $('createExportStems').addEventListener('click',guard(exportStems));
 $('createOpenStudio').addEventListener('click',guard(openInStudio));
 $('createImport').addEventListener('change',guard(async e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;if(file.size>20*1024*1024)throw new Error('The JSON file is larger than 20 MB.');S.load(JSON.parse(await file.text()));notice('Project opened. Undo returns to the previous song.');}));
 $('createRoll').addEventListener('click',e=>{if(editing())return;const r=e.target.getBoundingClientRect(),bars=E.totalBars(S.state),bar=Math.floor((e.clientX-r.left-view.rollGutter)/(r.width-view.rollGutter)*bars);if(bar>=0&&bar<bars)guard(()=>P.seekBar(bar))();});
 bindNoteEditor();
 document.addEventListener('keydown',e=>{if(!isShown()||e.target.closest('input,select,textarea,[contenteditable]'))return;if(editing()&&view.sel&&(e.key==='Delete'||e.key==='Backspace')){e.preventDefault();deleteNote(view.sel);return;}if(e.code==='Space'){e.preventDefault();guard(togglePlay)();}else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?S.redo():S.undo();}});
 P.onState=()=>{syncTransport();tick();};
 new ResizeObserver(()=>{view.rollKey='';if(isShown())queueRender();}).observe($('createRoll').parentElement);
}
const isShown=()=>!$('view-create')?.hidden;

async function togglePlay(){if(!P.playing)window.GMCStudioBridge?.pause();await P.toggle();syncTransport();tick();}
function applyCandidate(candidate,label){const before=new Set(Object.entries(S.state.studio?.bank||{}).filter(([,v])=>v).map(([k])=>k));S.applyCandidate(candidate);const kept=Object.entries(S.state.studio?.bank||{}).find(([k,v])=>v&&!before.has(k))?.[0];notice(`${label} · ${candidate.delta.tracks.length} tracks changed${kept?` · the previous song is kept in idea ${kept}`:''} · Ctrl/⌘ Z to undo.`);}
function setMode(mode){view.mode=mode;savePrefs();render();}

// ── Rendering ─────────────────────────────────────────────────────────────────
function render(){
 if(!view.ready||!isShown())return;
 const s=S.state,rack=document.querySelector('.create-rack');rack.dataset.mode=view.mode;
 for(const [id,mode] of [['createEssential','essential'],['createStudio','studio']]){const b=$(id),on=view.mode===mode;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));}
 renderHead(s);syncTransport();syncHistory();
 if(!view.live){renderBank(s);renderTracks(s);renderHarmony(s);renderNoteBar(s);if(view.mode==='studio'){renderInspector(s);renderShape(s);}}
 else syncTrackValues(s);
 drawRoll(s);view.live=false;
}
function renderHead(s){
 const preset=D.presets.find(p=>p.id===s.preset);
 $('createTitle').textContent=L.songName(s.session?.name)||presetName(s.preset)||'New song';
 $('createSubtitle').textContent=L.labels.presetNotes[s.preset]||(preset?L.name('genres',preset.genre,D.genreNames[preset.genre])+'. Synthesis, harmony and rhythm designed for this character.':'Custom song.');
 const chips=[L.name('genres',s.genre,D.genreNames[s.genre]),NOTE_NAMES[s.root]+' '+L.name('scales',s.scale,D.scaleDefs[s.scale].name),s.bpm+' BPM',E.totalBars(s)+' bars · '+L.name('structures',s.structure,s.structure),'Seed '+s.seed+(s.mutation?' · v'+s.mutation:'')];
 $('createMeta').replaceChildren(...chips.map(t=>el('span',{text:t})));
 $('createPreset').value=s.preset;$('createBpm').value=s.bpm;if(document.activeElement!==$('createVolume'))$('createVolume').value=s.master.volume;$('createFinish').value=s.sound8?.finish||'none';
 $('createRoot').value=s.root;$('createScale').value=s.scale;$('createProgression').value=D.progressions[s.progression]?s.progression:'custom';
}
function syncTransport(){
 const play=$('createPlay'),on=P.playing||P.starting;play.textContent=P.starting?'Opening…':P.playing?'Pause':'Play';play.setAttribute('aria-pressed',String(on));
 const s=S.state,step=Math.max(0,P.step),bar=Math.floor(step/16)+1,beat=Math.floor((step%16)/4)+1;
 $('createPosition').textContent=String(bar).padStart(2,'0')+' · '+beat;$('createTime').textContent=fmtTime(step*E.stepSeconds(s))+' / '+fmtTime(E.totalSeconds(s));
}
function syncHistory(){$('createUndo').disabled=!S.canUndo;$('createRedo').disabled=!S.canRedo;}

function renderBank(s){
 const bank=s.studio?.bank||{},root=$('createBank');root.replaceChildren(el('span',{class:'module-label',text:'Ideas'}));
 for(const slot of ['A','B','C','D']){const b=bank[slot];
  const card=el('div',{class:'create-slot'+(b?' filled':'')},
   el('button',{type:'button',class:'create-slot-main',title:b?'Load this idea (current song goes to history)':'Keep the current song here',onclick:guard(()=>{if(b){S.ops.loadBank(slot);notice('Idea '+slot+' loaded.');}else{S.ops.storeBank(slot,null,s.session?.name||presetName(s.preset));notice('Kept in idea '+slot+'.');}})},el('b',{text:slot}),el('span',{text:b?L.songName(b.name)||'Idea '+slot:'Empty · keep current'})),
   b?el('button',{type:'button',class:'create-slot-save',title:'Replace idea '+slot+' with the current song','aria-label':'Replace idea '+slot,onclick:guard(()=>{S.ops.storeBank(slot,null,s.session?.name||presetName(s.preset));notice('Idea '+slot+' replaced.');})},'↺'):null);
  root.append(card);}
}

function renderTracks(s){
 const root=$('createTracks');root.replaceChildren();
 const anySolo=s.tracks.some(t=>t.solo);$('createTrackCount').textContent=s.tracks.filter(t=>E.audible(t,s)).length+' / '+s.tracks.length+' audible';
 for(const tr of s.tracks){const def=D.trackMap[tr.id],color=D.trackColors[tr.id]||def.color;
  const vol=el('input',{type:'range',min:0,max:125,step:1,value:Math.round(tr.volume*100),'aria-label':trackName(tr.id)+' volume'});
  vol.addEventListener('input',()=>S.live(st=>{st.tracks.find(t=>t.id===tr.id).volume=Number(vol.value)/100;}));vol.addEventListener('change',()=>S.commitLive());
  const sound=el('select',{'aria-label':trackName(tr.id)+' sound'});options(sound,def.voices.filter((v,i,a)=>a.indexOf(v)===i).map(v=>[v,soundName(v)]),tr.sound);sound.addEventListener('change',()=>S.setTrack(tr.id,{sound:sound.value}));
  const flag=(key,label,title)=>el('button',{type:'button',class:'create-flag'+(tr[key]?' on':''),title,'aria-pressed':String(!!tr[key]),onclick:()=>key==='locked'?S.toggleLock(tr.id):S.toggleFlag(tr.id,key)},label);
  const row=el('div',{class:'create-track'+(S.selected===tr.id?' selected':'')+(E.audible(tr,s)?'':' silent'),style:`--track:${color}`,dataset:{track:tr.id}},
   el('button',{type:'button',class:'create-track-name',title:'Select and audition','aria-pressed':String(S.selected===tr.id),onclick:guard(async()=>{S.select(tr.id);render();window.GMCStudioBridge?.pause();await P.preview(tr.id);})},el('i'),el('span',{text:trackName(tr.id)})),
   el('div',{class:'create-track-flags'},flag('mute','M','Mute'),flag('solo','S','Solo'),flag('locked','L','Lock: keep this track through new songs and variations'),el('button',{type:'button',class:'create-flag',title:'New pattern for this track','aria-label':'Regenerate '+trackName(tr.id),onclick:()=>S.regenerateTrack(tr.id)},'↻')),
   sound,vol,el('output',{class:'create-track-vol',text:Math.round(tr.volume*100)+'%'}));
  if(anySolo&&!tr.solo)row.classList.add('silent');
  root.append(row);}
}
function syncTrackValues(s){for(const row of $('createTracks').children){const tr=s.tracks.find(t=>t.id===row.dataset.track);if(!tr)continue;const out=row.querySelector('output');if(out)out.textContent=Math.round(tr.volume*100)+'%';}if(document.activeElement!==$('createVolume'))$('createVolume').value=s.master.volume;}

function renderHarmony(s){
 const root=$('createChords'),voicings=E.chordVoicings(s),step=Math.max(0,P.step),current=P.playing?E.harmonyIndex(Math.floor(step/16)%s.bars,s):-1;root.replaceChildren();
 if(Object.values(s.studio?.clips||{}).some(c=>c.origin?.label==='GMC catalog'&&s.studio.bindings[c.track]===c.id))root.append(el('p',{class:'create-note create-chord-note',text:'These notes come from a Studio catalog cue; the cards show the engine progression, used only by tracks you regenerate.'}));
 s.degrees.forEach((_,i)=>{const start=Math.ceil(i*s.bars/s.degrees.length),end=Math.ceil((i+1)*s.bars/s.degrees.length);
  root.append(el('div',{class:'create-chord'+(i===current?' current':''),dataset:{index:i}},el('strong',{text:E.labels.chordLabel(i,s)}),el('span',{text:voicings[i].map(n=>NOTE_NAMES[n%12]).join(' ')}),el('small',{text:'Bars '+(start+1)+(end-start>1?'–'+end:'')})));});
}

// ── Score view (all tracks) ───────────────────────────────────────────────────
function rollData(s){
 const key=JSON.stringify([s.patterns,s.tracks,s.bars,s.structure,s.degrees,s.chordEdits,s.root,s.scale,s.seed,s.mutation,s.bpm,s.human,s.swing,s.studio&&{...s.studio,bank:null}]);
 if(view.roll&&view.rollKey===key)return view.roll;
 // Draw every track, including muted ones (dimmed): score a copy with all tracks audible.
 const shown=JSON.parse(JSON.stringify(s));const muted=new Set(s.tracks.filter(t=>!E.audible(t,s)||t.volume<=0).map(t=>t.id));for(const t of shown.tracks){t.mute=false;t.solo=false;if(t.volume<=0)t.volume=.01;}
 const total=E.totalBars(shown)*16,dt=E.stepSeconds(shown),notes=[];let lo=127,hi=0;
 for(let i=0;i<total;i++)for(const e of E.scoreEvents(i,shown)){const drum=D.trackMap[e.id].drum;for(const n of e.n){const at=i+e.offset/dt;notes.push({id:e.id,drum,n,at,len:e.d/dt,v:e.v,muted:muted.has(e.id)});if(!drum){lo=Math.min(lo,n);hi=Math.max(hi,n);}}}
 if(lo>hi){lo=48;hi=72;}
 view.roll={notes,total,lo:lo-2,hi:hi+2};view.rollKey=key;return view.roll;
}
function sizeCanvas(c){const r=c.getBoundingClientRect(),dpr=Math.min(2,window.devicePixelRatio||1),w=Math.max(1,Math.round(r.width*dpr)),h=Math.max(1,Math.round(r.height*dpr));if(c.width!==w||c.height!==h){c.width=w;c.height=h;}const ctx=c.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);return{ctx,w:r.width,h:r.height};}
function drawRoll(s){
 const canvas=$('createRoll');if(!canvas.getContext)return;const {ctx,w,h}=sizeCanvas(canvas),full=rollData(s),data=editing()?{...full,...editRange()}:full,gutter=view.rollGutter=34,drumRows=5,drumH=Math.min(60,h*.22),top=6,pitchH=h-drumH-top-8,rows=data.hi-data.lo+1,rh=pitchH/rows,cw=(w-gutter)/data.total;
 ctx.clearRect(0,0,w,h);ctx.fillStyle='#070808';ctx.fillRect(0,0,w,h);
 // Scale rows, bar grid and section boundaries.
 const scale=D.scaleDefs[s.scale].notes;
 for(let n=data.lo;n<=data.hi;n++){const y=top+(data.hi-n)*rh,pc=((n-s.root)%12+12)%12;if(scale.includes(pc)){ctx.fillStyle=pc===0?'#16140e':'#0e0f0f';ctx.fillRect(gutter,y,w-gutter,rh);}if(n%12===0){ctx.fillStyle='#777';ctx.font='9px JetBrains Mono,monospace';ctx.fillText('C'+(n/12-1),4,y+rh-1);}}
 for(let st=0;st<=data.total;st+=4){const x=gutter+st*cw;ctx.fillStyle=st%16===0?(st%(s.bars*16)===0?'#5a4a2a':'#333'):'#1a1a1a';ctx.fillRect(Math.round(x),top,1,h-top);}
 ctx.fillStyle='#111';ctx.fillRect(gutter,h-drumH-4,w-gutter,drumH+4);
 const drumIds=['kick','snare','hat','open','perc'];ctx.font='8px JetBrains Mono,monospace';drumIds.forEach((id,i)=>{ctx.fillStyle='#666';ctx.fillText(trackName(id).slice(0,5),2,h-drumH-2+(i+.8)*drumH/drumRows);});
 const edit=editing()?S.selected:null;view.geom={gutter,cw,top,rh,lo:data.lo,hi:data.hi,drumTop:h-drumH-2,drumRow:drumH/drumRows,drumIds,w,h};
 for(const note of data.notes){const color=D.trackColors[note.id]||'#aaa',x=gutter+note.at*cw;ctx.globalAlpha=edit?(note.id===edit?0:.13):note.muted?.18:.45+note.v*.55;if(!ctx.globalAlpha)continue;ctx.fillStyle=color;
  if(note.drum){const row=drumIds.indexOf(note.id),y=h-drumH-2+row*drumH/drumRows;ctx.fillRect(x,y+1,Math.max(2,cw*.7),drumH/drumRows-2);}
  else{const y=top+(data.hi-note.n)*rh;ctx.fillRect(x,y+.5,Math.max(2,note.len*cw-1),Math.max(2,rh-1));}}
 ctx.globalAlpha=1;if(edit)drawEditNotes(ctx,edit);drawHead();
}
function noteRect(n,id){const g=view.geom,drum=D.trackMap[id].drum,x=g.gutter+n.t*g.cw,w=Math.max(4,n.d*g.cw-1);if(drum){const row=g.drumIds.indexOf(id);return{x,y:g.drumTop+row*g.drumRow+1,w:Math.max(4,g.cw*.8),h:g.drumRow-2};}return{x,y:g.top+(g.hi-n.p)*g.rh,w,h:Math.max(3,g.rh-1)};}
function editNotes(id){const d=view.drag;const notes=S.ops.notesForTrack(id);if(d?.moved)for(const n of notes)if(n.id===d.id)Object.assign(n,d.next);return notes;}
function drawEditNotes(ctx,id){const color=D.trackColors[id]||'#fff';for(const n of editNotes(id)){const r=noteRect(n,id);ctx.globalAlpha=.35+n.v*.65;ctx.fillStyle=color;ctx.fillRect(r.x,r.y,r.w,r.h);if(n.id===view.sel){ctx.globalAlpha=1;ctx.strokeStyle='#fff';ctx.lineWidth=1.5;ctx.strokeRect(r.x-.5,r.y-.5,r.w+1,r.h+1);}if(n.anchor){ctx.globalAlpha=1;ctx.fillStyle='#fff';ctx.fillRect(r.x,r.y,2,r.h);}}ctx.globalAlpha=1;}
function drawHead(){
 const canvas=$('createRollHead');if(!canvas.getContext||!view.roll)return;const {ctx,w,h}=sizeCanvas(canvas);ctx.clearRect(0,0,w,h);if(!P.playing||P.step<0)return;
 const total=view.roll.total,x=view.rollGutter+((P.step%total)+.5)*(w-view.rollGutter)/total;ctx.fillStyle='#78ece9';ctx.shadowColor='#5fffff';ctx.shadowBlur=8;ctx.fillRect(x,0,2,h);
}
let lastStep=-1;
function tick(){cancelAnimationFrame(view.raf);if(!P.playing&&!P.starting){drawHead();return;}view.raf=requestAnimationFrame(()=>{if(P.step!==lastStep){lastStep=P.step;syncTransport();drawHead();if(P.step%16===0)renderHarmony(S.state);}tick();});}

// ── Note editor (Studio, loop form) ──────────────────────────────────────────
// Written notes live in the engine clip of the selected track; each gesture is one undo step.
// While editing, rows start at the selected track's notes plus an octave each side and
// grow only when a note leaves the view, so rows stay put under the pointer.
function editRange(){const id=S.selected,notes=S.ops.notesForTrack(id).map(n=>n.p);if(D.trackMap[id].drum||!notes.length){view.editRange=view.editRange||{lo:48,hi:84,id};return view.editRange;}
 const min=Math.min(...notes),max=Math.max(...notes),r=view.editRange;
 view.editRange=r&&r.id===id?{lo:Math.min(r.lo,min-1),hi:Math.max(r.hi,max+1),id}:{lo:Math.max(24,min-12),hi:Math.min(108,max+12),id};return view.editRange;}
function editBlocked(s=S.state){return s.structure!=='loop'||s.studio?.playMode==='song';}
function editing(){return view.mode==='studio'&&view.edit&&!editBlocked();}
function noteId(){return 'n_'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);}
function editAt(e){const r=$('createRoll').getBoundingClientRect(),g=view.geom,x=e.clientX-r.left,y=e.clientY-r.top,id=S.selected,drum=D.trackMap[id].drum;
 const t=(x-g.gutter)/g.cw,p=drum?D.trackMap[id].midi:g.hi-Math.floor((y-g.top)/g.rh);return{x,y,t,p:Math.max(12,Math.min(119,p)),id,drum};}
function hitNote(pt){const notes=S.ops.notesForTrack(pt.id).reverse();notes.sort((a,b)=>(b.id===view.sel)-(a.id===view.sel));for(const n of notes){const r=noteRect(n,pt.id);if(pt.x>=r.x-2&&pt.x<=r.x+r.w+2&&pt.y>=r.y-1&&pt.y<=r.y+r.h+1)return{n,edge:pt.x>r.x+r.w-Math.min(6,r.w*.3)};}return null;}
const snap=t=>Math.round(t/view.grid)*view.grid;
function commitNotes(id,fn,message){S.commit(()=>{const c=S.ops.ensureClip(id);fn(c);c.notes.sort((a,b)=>a.t-b.t||a.p-b.p);S.ops.syncProjection(id);},{message});}
function bindNoteEditor(){
 const canvas=$('createRoll'),length=()=>S.state.bars*16;
 canvas.addEventListener('pointerdown',e=>{if(!editing()||e.button!==0)return;const pt=editAt(e);if(pt.t<0||pt.t>=length())return;const hit=hitNote(pt);
  if(hit){view.sel=hit.n.id;view.drag={id:hit.n.id,mode:hit.edge?'resize':'move',start:pt,orig:{t:hit.n.t,p:hit.n.p,d:hit.n.d},next:{},moved:false};canvas.setPointerCapture(e.pointerId);}
  else{const t=Math.max(0,Math.min(length()-view.grid,Math.floor(pt.t/view.grid)*view.grid)),id=noteId();view.sel=id;commitNotes(pt.id,c=>c.notes.push(S.ops.makeNote({id,t,p:pt.p,d:pt.drum?1:Math.max(view.grid,2),v:.75})));}
  drawRoll(S.state);renderNoteBar(S.state);});
 canvas.addEventListener('pointermove',e=>{const d=view.drag;if(!d)return;const pt=editAt(e),dt=snap(pt.t-d.start.t);
  if(d.mode==='move')d.next={t:Math.max(0,Math.min(length()-.0625,d.orig.t+dt)),p:D.trackMap[pt.id].drum?d.orig.p:Math.max(12,Math.min(119,d.orig.p+pt.p-d.start.p))};
  else d.next={d:Math.max(view.grid/2,Math.min(length()-d.orig.t,d.orig.d+dt))};
  d.moved=Object.entries(d.next).some(([k,v])=>v!==d.orig[k]);drawRoll(S.state);});
 const end=()=>{const d=view.drag;view.drag=null;if(d?.moved)commitNotes(S.selected,c=>{const n=c.notes.find(x=>x.id===d.id);if(n)Object.assign(n,d.next);});};
 canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',()=>{view.drag=null;drawRoll(S.state);});
 canvas.addEventListener('dblclick',e=>{if(!editing())return;const hit=hitNote(editAt(e));if(hit)deleteNote(hit.n.id);});
}
function deleteNote(id){const track=S.selected;commitNotes(track,c=>{c.notes=c.notes.filter(n=>n.id!==id);});if(view.sel===id)view.sel=null;}
function selectedNote(){return view.sel?S.ops.notesForTrack(S.selected).find(n=>n.id===view.sel)||null:null;}
function renderNoteBar(s){
 let bar=$('createNoteBar');if(!bar){bar=el('div',{id:'createNoteBar',class:'create-notebar inset-panel create-studio-only'});document.querySelector('.create-roll').before(bar);}
 bar.replaceChildren();const blocked=editBlocked(s),note=editing()?selectedNote():null;if(note===null&&view.sel&&editing())view.sel=null;
 const toggle=el('button',{type:'button',class:'compact-button'+(view.edit?' active':''),'aria-pressed':String(view.edit),disabled:blocked,onclick:()=>{view.edit=!view.edit;view.sel=null;view.editRange=null;render();}},view.edit?'Editing notes':'Edit notes');
 bar.append(el('span',{class:'module-label',text:'Notes · '+trackName(S.selected)}),toggle);
 if(blocked){bar.append(el('span',{class:'create-note',text:'Note editing works on a looping phrase. Set Form to Loop and play the phrase to edit.'}));return;}
 if(!view.edit){bar.append(el('span',{class:'create-note',text:'Select a track, then edit its written notes: click to add, drag to move, drag the right edge to lengthen, double-click or Delete to remove.'}));return;}
 const grid=el('select',{'aria-label':'Grid'});options(grid,[[.25,'1/64'],[.5,'1/32'],[1,'1/16'],[2,'1/8'],[4,'1/4']],view.grid);grid.addEventListener('change',()=>{view.grid=Number(grid.value);});
 bar.append(el('label',{class:'create-field'},el('span',{text:'Grid'}),grid));
 if(note){const v=el('input',{type:'range',min:1,max:100,value:Math.round(note.v*100),'aria-label':'Note velocity'});v.addEventListener('change',()=>commitNotes(S.selected,c=>{const n=c.notes.find(x=>x.id===note.id);if(n)n.v=Number(v.value)/100;}));
  bar.append(el('label',{class:'create-slider create-notebar-vel'},el('span',{},'Velocity',el('output',{text:Math.round(note.v*100)})),v),
   el('button',{type:'button',class:'compact-button','aria-pressed':String(note.anchor),title:'Anchored notes survive transformations',onclick:()=>commitNotes(S.selected,c=>{const n=c.notes.find(x=>x.id===note.id);if(n)n.anchor=!n.anchor;})},note.anchor?'Anchored':'Anchor'),
   el('button',{type:'button',class:'compact-button',onclick:()=>deleteNote(note.id)},'Delete'));}
 const kinds=[['pitches','Vary pitches'],['rhythm','Vary rhythm'],['articulation','Vary articulation'],['invert','Invert'],['reverse','Reverse'],['answer','Answer'],['transition','Transition'],['quantize','Quantize'],['humanize','Humanize']];
 const tx=el('select',{'aria-label':'Transform'});options(tx,[['','Transform…'],...kinds],'');tx.addEventListener('change',()=>{if(!tx.value)return;S.select(S.selected);S.ops.transform(tx.value,{selection:false});view.sel=null;});
 bar.append(tx);
}

// ── Studio panels ─────────────────────────────────────────────────────────────
function slider({label,value,min,max,step=1,format=v=>String(Math.round(v)),input,commit}){
 const out=el('output',{text:format(value)}),range=el('input',{type:'range',min,max,step,value,'aria-label':label});
 range.addEventListener('input',()=>{out.textContent=format(Number(range.value));input(Number(range.value));});
 range.addEventListener('change',()=>commit?commit(Number(range.value)):S.commitLive());
 return el('label',{class:'create-slider'},el('span',{},label,out),range);
}
function select({label,rows,value,change}){const s=el('select',{'aria-label':label});options(s,rows,value);s.addEventListener('change',()=>change(s.value));return el('label',{class:'create-field'},el('span',{text:label}),s);}
function group(title,...controls){return el('section',{class:'create-group'},el('h3',{text:title}),el('div',{class:'create-group-body'},...controls));}
const liveTrack=(id,key,scale=1)=>v=>S.live(st=>{st.tracks.find(t=>t.id===id)[key]=v*scale;});
const liveMaster=key=>v=>S.live(st=>{st.master[key]=v;});

function renderInspector(s){
 const root=$('createInspector'),tr=s.tracks.find(t=>t.id===S.selected)||s.tracks[0],def=D.trackMap[tr.id],drum=def.drum;
 root.replaceChildren(el('div',{class:'create-panel-head'},el('span',{class:'module-label',text:'Inspector'}),el('strong',{text:trackName(tr.id)})));
 const patterns=D.patternDefs[drum?'drum':tr.id];
 root.append(group('Sound',
  select({label:'Timbre',rows:def.voices.filter((v,i,a)=>a.indexOf(v)===i).map(v=>[v,soundName(v)]),value:tr.sound,change:v=>S.setTrack(tr.id,{sound:v})}),
  select({label:'Pattern',rows:Object.keys(patterns).map(k=>[k,L.labels.patterns[drum?'drum':tr.id]?.[k]??patterns[k]]),value:tr.pattern,change:v=>S.setTrack(tr.id,{pattern:v},{regenerate:true})}),
  drum?null:select({label:'Octave',rows:[[-2,'−2'],[-1,'−1'],[0,'0'],[1,'+1'],[2,'+2']],value:tr.octave,change:v=>S.setTrack(tr.id,{octave:Number(v)})}),
  slider({label:'Density',value:tr.density,min:0,max:100,input:liveTrack(tr.id,'density'),commit:v=>{S.commitLive();S.setTrack(tr.id,{density:v},{regenerate:true});}}),
  slider({label:'Tone',value:tr.tone,min:0,max:100,input:liveTrack(tr.id,'tone')}),slider({label:'Decay',value:tr.decay,min:0,max:100,input:liveTrack(tr.id,'decay')}),
  slider({label:'Texture',value:tr.texture,min:0,max:100,input:liveTrack(tr.id,'texture')}),slider({label:'Attack',value:tr.attack,min:0,max:100,input:liveTrack(tr.id,'attack')}),
  slider({label:'Tune',value:tr.tune,min:-12,max:12,step:.1,format:v=>v.toFixed(1)+' st',input:liveTrack(tr.id,'tune')}),
  drum&&tr.pattern==='euclid'?slider({label:'Pulses',value:tr.pulses,min:0,max:16,input:()=>{},commit:v=>S.setTrack(tr.id,{pulses:v},{regenerate:true})}):null,
  el('div',{class:'create-row'},el('button',{type:'button',class:'compact-button',onclick:guard(()=>P.preview(tr.id))},'Audition'),el('button',{type:'button',class:'compact-button',onclick:()=>S.regenerateTrack(tr.id)},'New pattern'),el('button',{type:'button',class:'compact-button',onclick:()=>S.clearTrack(tr.id)},'Clear'))));
 root.append(group('Mix',
  slider({label:'Volume',value:Math.round(tr.volume*100),min:0,max:125,format:v=>v+'%',input:liveTrack(tr.id,'volume',.01)}),
  slider({label:'Pan',value:Math.round(tr.pan*100),min:-100,max:100,format:v=>v?(v<0?'L':'R')+Math.abs(v):'C',input:liveTrack(tr.id,'pan',.01)}),
  slider({label:'Reverb send',value:Math.round(tr.send*100),min:0,max:100,format:v=>v+'%',input:liveTrack(tr.id,'send',.01)}),
  slider({label:'Delay send',value:Math.round(tr.delay*100),min:0,max:100,format:v=>v+'%',input:liveTrack(tr.id,'delay',.01)})));
 root.append(group('Color',
  slider({label:'Drive',value:tr.drive,min:0,max:70,input:liveTrack(tr.id,'drive')}),slider({label:'High-pass',value:tr.highpass,min:20,max:2000,step:5,format:v=>v+' Hz',input:liveTrack(tr.id,'highpass')}),
  slider({label:'Low EQ',value:tr.lowEQ,min:-12,max:12,step:.5,format:v=>v+' dB',input:liveTrack(tr.id,'lowEQ')}),slider({label:'High EQ',value:tr.highEQ,min:-12,max:12,step:.5,format:v=>v+' dB',input:liveTrack(tr.id,'highEQ')}),
  slider({label:'Resonance',value:tr.resonance,min:0,max:65,input:liveTrack(tr.id,'resonance')}),slider({label:'Chorus',value:tr.chorus,min:0,max:80,input:liveTrack(tr.id,'chorus')}),
  slider({label:'Phaser',value:tr.phaser,min:0,max:75,input:liveTrack(tr.id,'phaser')}),slider({label:'Tremolo',value:tr.tremolo,min:0,max:85,input:liveTrack(tr.id,'tremolo')}),
  slider({label:'Auto-pan',value:tr.autoPan,min:0,max:80,input:liveTrack(tr.id,'autoPan')}),slider({label:'Stereo spread',value:tr.spread,min:0,max:85,input:liveTrack(tr.id,'spread')})));
 if(!drum)root.append(performanceGroup(tr));
}
function performanceGroup(tr){
 const p=tr.performance,mode=p.mode==='legacy'?(tr.arp.enabled?'arp':'original'):p.mode,a=tr.arp;
 const tplRows=(lib)=>Object.values(lib).map(t=>[t.id,(L.labels.templateGroups[t.group]||t.group)+' · '+t.name]);
 const body=[select({label:'Mode',rows:Object.entries(L.labels.performanceModes),value:mode,change:v=>{S.select(tr.id);S.ops.setPerformanceMode(v);}})];
 if(mode==='arp'||mode==='hybrid')body.push(select({label:'Arpeggio',rows:[['classic','Classic arpeggiator'],...tplRows(D.arpLibrary)],value:p.arpPreset,change:v=>{S.select(tr.id);if(v==='classic')S.setTrack(tr.id,{performance:{...p,arpPreset:'classic'}});else S.ops.applyPerformanceTemplate('arp',v);}}),
  select({label:'Direction',rows:Object.keys(D.arpModes).map(k=>[k,L.name('arpModes',k)]),value:a.mode,change:v=>S.setTrack(tr.id,{arp:{...a,mode:v}})}),
  select({label:'Rate',rows:Object.keys(D.arpRates).map(k=>[k,L.name('arpRates',k)]),value:a.rate,change:v=>S.setTrack(tr.id,{arp:{...a,rate:v}})}),
  slider({label:'Octaves',value:a.octaves,min:1,max:4,input:()=>{},commit:v=>S.setTrack(tr.id,{arp:{...a,octaves:v}})}),
  slider({label:'Gate',value:a.gate,min:10,max:140,format:v=>v+'%',input:v=>S.live(st=>{st.tracks.find(t=>t.id===tr.id).arp.gate=v;})}),
  slider({label:'Probability',value:a.probability,min:10,max:100,format:v=>v+'%',input:v=>S.live(st=>{st.tracks.find(t=>t.id===tr.id).arp.probability=v;})}),
  slider({label:'Ratchet',value:a.ratchet,min:1,max:3,input:()=>{},commit:v=>S.setTrack(tr.id,{arp:{...a,ratchet:v}})}));
 if(mode==='chop'||mode==='hybrid')body.push(select({label:'Chop',rows:tplRows(D.chopLibrary),value:p.chopPreset,change:v=>{S.select(tr.id);S.ops.applyPerformanceTemplate('chop',v);}}),
  select({label:'Source',rows:[['chord','Current chord'],['notes','Written notes']],value:p.source,change:v=>S.setTrack(tr.id,{performance:{...p,source:v},arp:{...a,source:v==='notes'?'pattern':'chord'}})}));
 if(mode!=='original')body.push(el('div',{class:'create-row'},el('button',{type:'button',class:'compact-button',title:'Turn the interpretation into editable notes; the source clip is kept',onclick:()=>{S.select(tr.id);S.ops.bake(tr.id);}},'Bake to notes')));
 return group('Performance',...body);
}
function renderShape(s){
 const root=$('createShape');root.replaceChildren();const st=s.studio||{};
 root.append(group('Composition',
  slider({label:'Density',value:s.density,min:0,max:100,input:()=>{},commit:v=>S.setGeneration('density',v)}),slider({label:'Complexity',value:s.complexity,min:0,max:100,input:()=>{},commit:v=>S.setGeneration('complexity',v)}),
  slider({label:'Phrase variation',value:s.variation,min:0,max:100,input:()=>{},commit:v=>S.setGeneration('variation',v)}),slider({label:'Humanize',value:s.human,min:0,max:100,input:v=>S.live(x=>{x.human=v;})}),
  slider({label:'Swing',value:s.swing,min:0,max:65,input:v=>S.live(x=>{x.swing=v;})}),
  select({label:'Voicing',rows:Object.entries(L.labels.voicings),value:s.voicing,change:v=>S.setHarmony('voicing',v)}),
  select({label:'Bars',rows:[1,2,3,4,6,8,12,16,24,32,48,64].filter(b=>b>=s.degrees.length).map(b=>[b,b+' bars']),value:s.bars,change:v=>S.setHarmony('bars',v)}),
  select({label:'Form',rows:Object.entries(L.labels.structures),value:s.structure,change:v=>S.setHarmony('structure',v)}),
  el('div',{class:'create-row'},el('input',{class:'create-seed',value:s.seed,maxlength:64,'aria-label':'Seed',onchange:e=>S.setSeed(e.target.value)}),el('button',{type:'button',class:'compact-button',onclick:()=>S.newSeed()},'New seed'),el('button',{type:'button',class:'compact-button',title:'Recompose unlocked tracks with the next variation',onclick:()=>S.mutate()},'Mutate'))));
 const m=s.master;
 root.append(group('Master',
  slider({label:'Reverb',value:m.reverb,min:0,max:80,input:liveMaster('reverb')}),select({label:'Space',rows:Object.entries(L.labels.reverbKinds),value:m.reverbKind,change:v=>S.setMaster({reverbKind:v})}),
  slider({label:'Delay',value:m.delay,min:0,max:70,input:liveMaster('delay')}),slider({label:'Feedback',value:m.feedback,min:0,max:65,input:liveMaster('feedback')}),
  slider({label:'Kick ducking',value:m.duck,min:0,max:80,input:liveMaster('duck')}),slider({label:'Low-pass',value:m.cutoff,min:500,max:20000,step:100,format:v=>(v/1000).toFixed(1)+' kHz',input:liveMaster('cutoff')}),
  slider({label:'Glue',value:m.glue,min:0,max:80,input:liveMaster('glue')}),slider({label:'Drum drive',value:m.drumDrive,min:0,max:70,input:liveMaster('drumDrive')}),slider({label:'Drum crush',value:m.drumCrush,min:0,max:80,input:liveMaster('drumCrush')}),
  select({label:'Engine',rows:[['studio','Studio synthesis'],['legacy','Legacy synthesis']],value:s.sound8?.engine||'legacy',change:v=>S.ops.changeSound({engine:v})}),
  slider({label:'Finish amount',value:s.sound8?.amount??65,min:0,max:100,input:()=>{},commit:v=>S.ops.changeSound({amount:v})})));
 const macros=st.macros||{};
 root.append(group('Macros',...Object.keys(L.labels.macros).map(k=>slider({label:L.name('macros',k),value:macros[k]??0,min:0,max:100,input:v=>S.live(x=>{x.studio.macros[k]=v;})}))));
 const song=st.playMode==='song';
 root.append(group('Song',
  el('p',{class:'create-note',text:st.sections?.length?`${st.sections.length} sections · playing ${song?'the whole song':'the selected phrase'}.`:'Build an intro, themes, a break and an ending from this phrase. Each section gets independent material.'}),
  el('div',{class:'create-row'},el('button',{type:'button',class:'compact-button',onclick:()=>S.ops.structureSong()},'Build song'),st.sections?.length?el('button',{type:'button',class:'compact-button','aria-pressed':String(song),onclick:()=>S.ops.setSongMode(song?'phrase':'song')},song?'Play phrase':'Play song'):null)));
}

// ── Export and bridge ─────────────────────────────────────────────────────────
async function exportWav(){
 if(view.busy)return;view.busy=true;notice('Rendering WAV with the current mix…');
 try{P.pause();const wav=await E.renderWav(JSON.parse(JSON.stringify(S.state)),{loops:1,tail:'tail',sampleRate:44100});download(wav.blob,fileBase()+'.wav');notice('WAV exported · '+fmtTime(wav.seconds)+' · peak '+(wav.peak>0?(20*Math.log10(wav.peak)).toFixed(1):'−∞')+' dBFS.');}
 finally{view.busy=false;}
}
async function exportStems(){
 if(view.busy)return;view.busy=true;
 try{P.pause();const zip=await E.createSession(JSON.parse(JSON.stringify(S.state)),{mode:'wet',sampleRate:44100,onProgress:t=>notice(t)});download(zip.blob,fileBase()+'_stems.zip');notice('Stems exported with a master reference and manifest.');}
 finally{view.busy=false;}
}
async function openInStudio(){
 const bridge=window.GMCStudioBridge;if(!bridge||!window.GMCNativeBridge)throw new Error('The Studio view is still loading.');
 P.pause();const s=S.state,cats=bridge.categories(),category=cats.find(c=>c.id===L.labels.genreCategory[s.genre])||cats[0];
 const native=window.GMCNativeBridge.toNative(E,s,{instruments:window.STUDIO_INSTRUMENTS,category,id:('create_'+s.seed+'_'+Date.now().toString(36)).toLowerCase().replace(/[^a-z0-9_]/g,'_'),title:(L.songName(s.session?.name)||presetName(s.preset))+' · '+s.seed,labels:tr=>trackName(tr.id)+' · '+soundName(tr.sound)});
 await bridge.addScore(native);bridge.notice('Opened in Studio: the same notes now play through the sampled banks. Create keeps the original.');
}

// ── Public hooks for app.js ──────────────────────────────────────────────────
window.GMCCreate={
 show(){if(!view.ready){restore();buildStatic();view.ready=true;}view.rollKey='';render();},
 pause(){if(P.playing||P.starting){P.pause();syncTransport();}},
 // A Studio score keeps its notes and played timing; the engine replaces the sample banks.
 openNative(native){if(!view.ready){restore();buildStatic();view.ready=true;}P.stop();const project=window.GMCNativeBridge.fromNative(E,native,{seed:(native.id||'CATALOG').slice(0,64)});S.load(E.project(project));view.rollKey='';notice('“'+native.title+'” opened in Create: the same notes through the synthesis engine. Change timbres per track or undo to return.');}
};
})();
