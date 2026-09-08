/* Ensemble Atelier: event-driven SVG instruments. No pictures or external assets.
   Surfaces are explanatory, not fingering tutors or physical simulations. */
(function(root){
'use strict';
const M=root.MusicLab, V=root.VisualLab, esc=V.esc;
let serial=0;
const dark=n=>[1,3,6,8,10].includes(M.mod(n,12));
const r=(x,y,w,h,fill,rad=2,extra='')=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rad}" fill="${fill}" ${extra}/>`;
const l=(x,y,X,Y,stroke,width=1,extra='')=>`<line x1="${x}" y1="${y}" x2="${X}" y2="${Y}" stroke="${(x===X||y===Y)&&String(stroke).startsWith('url(')?'#bbc5b4':stroke}" stroke-width="${width}" ${extra}/>`;
const c=(x,y,R,fill,extra='')=>`<circle cx="${x}" cy="${y}" r="${R}" fill="${fill}" ${extra}/>`;
const t=(x,y,s,size=9,fill='#a8977f')=>`<text x="${x}" y="${y}" fill="${fill}" font-size="${size}" font-family="ui-monospace,monospace" text-anchor="middle" pointer-events="none">${esc(s)}</text>`;
const path=(d,fill,stroke='none',width=1,extra='')=>`<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${width}" ${extra}/>`;
const hit=n=>`data-note="${n}" role="button" tabindex="-1" aria-label="Tocar ${esc(M.noteName(n))}"`;
function range(p,events){
 const valid=events.filter(e=>Number.isFinite(e.midi));
 let low=Math.max(p.range[0],Math.floor((valid.length?Math.min(...valid.map(e=>e.midi)):Math.max(48,p.range[0]+7))/12)*12);
 let high=Math.min(p.range[1],low+24); low=Math.max(p.range[0],Math.min(low,high-12));
 return Array.from({length:high-low+1},(_,i)=>low+i);
}
function instrument(p,events){
 const uid='at'+(++serial),url=name=>`url(#${uid}-${name})`, notes=range(p,events), whites=notes.filter(n=>!dark(n));
 const defs=`<defs>
 <linearGradient id="${uid}-wood" x1="0" y1="0" x2=".4" y2="1"><stop stop-color="#825332"/><stop offset=".26" stop-color="#4a2d1e"/><stop offset=".52" stop-color="#734625"/><stop offset="1" stop-color="#302018"/></linearGradient>
 <linearGradient id="${uid}-lightwood" x2=".6" y2="1"><stop stop-color="#d2ad75"/><stop offset=".45" stop-color="#997248"/><stop offset="1" stop-color="#5d3f28"/></linearGradient>
 <linearGradient id="${uid}-ivory" x2=".15" y2="1"><stop stop-color="#aaa395"/><stop offset=".12" stop-color="#ece6d7"/><stop offset=".76" stop-color="#d8cfbd"/><stop offset="1" stop-color="#948b79"/></linearGradient>
 <linearGradient id="${uid}-ebony" x2=".2" y2="1"><stop stop-color="#555650"/><stop offset=".13" stop-color="#272923"/><stop offset=".9" stop-color="#101411"/><stop offset="1" stop-color="#44463f"/></linearGradient>
 <linearGradient id="${uid}-brass" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#756044"/><stop offset=".2" stop-color="#ebd09a"/><stop offset=".4" stop-color="#a38349"/><stop offset=".57" stop-color="#f7dfab"/><stop offset=".72" stop-color="#8a6a39"/><stop offset="1" stop-color="#423522"/></linearGradient>
 <linearGradient id="${uid}-silver" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#535e60"/><stop offset=".27" stop-color="#e2e7df"/><stop offset=".45" stop-color="#879a98"/><stop offset=".6" stop-color="#f2f2da"/><stop offset="1" stop-color="#4c605d"/></linearGradient>
 <linearGradient id="${uid}-panel" x2="0" y2="1"><stop stop-color="#3a403c"/><stop offset=".5" stop-color="#222724"/><stop offset="1" stop-color="#101714"/></linearGradient>
 <radialGradient id="${uid}-skin"><stop stop-color="#d8d2b9"/><stop offset=".72" stop-color="#b9b599"/><stop offset="1" stop-color="#787e6c"/></radialGradient>
 <radialGradient id="${uid}-ceramic" cx=".35" cy=".2"><stop stop-color="#b5d0bb"/><stop offset=".4" stop-color="#598675"/><stop offset="1" stop-color="#213c33"/></radialGradient>
 <radialGradient id="${uid}-light"><stop stop-color="${p.color}" stop-opacity=".11"/><stop offset="1" stop-color="${p.color}" stop-opacity="0"/></radialGradient>
 <pattern id="${uid}-grain" width="37" height="13" patternUnits="userSpaceOnUse"><path d="M-4 2 Q12 9 39 2 M-8 11 Q8 5 39 10" stroke="#dbab70" stroke-opacity=".11" fill="none" stroke-width=".6"/></pattern>
 <filter id="${uid}-shadow" x="-30%" y="-30%" width="170%" height="180%"><feDropShadow dx="0" dy="7" stdDeviation="5" flood-opacity=".42"/></filter>
 </defs>`;
 const screw=(x,y)=>c(x,y,3.4,'#4e5148')+l(x-1.9,y+1.1,x+1.9,y-1.1,'#131a15',1.3);
 const grain=(x,y,w,h)=>r(x,y,w,h,url('grain'),3,'pointer-events="none"');
 const key=(n,x,y,w,h,fill,cls='')=>r(x,y,w,h,fill,2,`${hit(n)} class="play-part ${cls}" stroke="#10150f" stroke-width=".7"`);
 const kb=(x,y,w,h)=>{const kw=w/whites.length; let s=r(x-5,y-6,w+10,h+14,'#0c120f',3);whites.forEach((n,i)=>{s+=key(n,x+i*kw,y,kw-.9,h,url('ivory'),'white-key')+l(x+i*kw+2,y+h-6,x+(i+1)*kw-3,y+h-6,'#fff8d4',.7,'pointer-events="none"');if(n%12===0)s+=t(x+(i+.5)*kw,y+h-16,M.noteName(n),7,'#635f50');});notes.filter(dark).forEach(n=>{let idx=whites.findIndex(w=>w>n);if(idx>0)s+=key(n,x+idx*kw-kw*.3,y,kw*.59,h*.64,url('ebony'),'black-key');});return s;};
 const bearing=(x,y)=>c(x,y,5,url('brass'))+c(x,y,1.8,'#111810');
 let s=`<ellipse cx="260" cy="148" rx="240" ry="105" fill="${url('light')}"/><ellipse cx="260" cy="213" rx="182" ry="12" fill="#000" opacity=".28"/>`;
 s+='<g class="instrument-body" filter="'+url('shadow')+'">';
 if(p.surface==='keys'){
  const electric=['epiano','clav','organ'].includes(p.id);
  s+=r(20,39,480,169,url(electric?'panel':'wood'),12)+grain(20,39,480,169)+r(31,49,458,46,'#161d17',4)+l(35,93,485,93,url('brass'),2);
  s+=r(30,100,459,103,'#1c201a',3)+kb(39,109,442,85);
  if(p.id==='organ'){for(let i=0;i<9;i++){s+=r(160+i*21,56,9,29,'#080f0a',2)+r(157+i*21,61+(i%3)*5,15,9,i%3===0?'#e2d3ad':'#916744',2);}s+=t(78,77,'DRAWBARS',8);}
  else if(p.id==='prepared_piano'){for(let i=0;i<28;i++)s+=l(125+i*8,53,137+i*8,86,i%3?'#ab9670':'#d8bd8c',.8);s+=t( 70,78,'PREPARED',7);}
  else {s+=t(260, 74,p.id==='epiano'?'E L E C T R I C  /  7 3':p.id==='harpsichord'?'C L A V E C Í N':p.id==='clav'?'C L A V I N E T':'P I A N O   D E   C Á M A R A',10,'#bbab8b');s+=c(57,72,9,url('silver'))+l(57,72,60,66,'#1b271e',2)+c(454,72,3,'#b8c991');}
  for(const x of[27,493])for(const y of[47,201])s+=screw(x,y);
 }else if(p.surface==='fret'&&p.id!=='bass'){
  const electric=['dist_guitar_l','dist_guitar_r','slap_bass'].includes(p.id),upright=p.id==='bass';
  const body='M119 55 C87 36 50 59 56 94 C58 106 75 115 68 129 C33 181 76 216 123 207 C157 212 190 185 174 151 C162 127 145 117 158 96 C181  60 154 43 119 55 Z';
  s+=path(body,url(electric?'panel':'lightwood'),'#a38960',2)+path(body,url('grain'));
  if(!electric)s+=c(121,125,upright?20:25,'#aa8755')+c(121,125,upright?17:21,'#11160f')+c(121,125,23,'none','stroke="#675036" stroke-width=".8"');
  else s+=r(107,87,12, 78,'#b7b7a5',2)+r(140,98,10,57,'#b7b7a5',2)+c(91,178,6,url('brass'));
  s+=r(168,104,274,40,url('wood'),2)+grain(168,104,274,40)+r(170,107,269,34,'#29231b',2);
  s+=path('M434 103 L484 94 Q502 96 499 115 L490 146 L437 142 Z',url('lightwood'),'#95754f',2)+r(86,102,9,45,'#392a1b',2);
  const strings=p.strings||[40,45,50,55,59,64];
  for(let f=0;f<13;f++){let x=172+265*(1-Math.pow(2,-f/12))*2;s+=l(x,106,x,144,f===0?'#ede1ba':'#897860',f===0?3:1);if([3,5,7,9,12].includes(f))s+=c(x-8,124,2.2,'#c7b48c');}
  strings.forEach((n,i)=>{const y=110+i*28/(strings.length-1);s+=l(90,y,480,y,url('silver'),1.4-i*.12,`data-vibrate="${i}"`);for(let f=0;f<=12;f++){const midi=n+f;if(midi<p.range[0]||midi>p.range[1])continue;const x=f===0?171:166+265*(1-2**(-f/12))*2;s+=c(x,y,7,'transparent',`${hit(midi)} class="fret play-part" data-fret="${f}" data-string="${i}"`);}
   s+=bearing(452+i*6,98-(i%2)*9);});
  s+=t(317,166,electric?'PASTILLAS / CUERDAS':'CAJA / CUERDAS',8);
 }else if(p.surface==='bow'||p.id==='bass'){
  const low=['cello','contrabass','bass'].includes(p.id),cx=226;
  const body='M224 62 C199  50 174 62 180 89 C188 106 188 118 165 139 C139 170 155 211 192 215 Q225 225 253 212 C291 195 283 159 265 140 C249 124 247 111 259 89 C271 65 248 49 224 62 Z';
  s+=path(body,url('wood'),'#cca273',2)+path(body,'none','#412718',6)+path(body,url('grain'));
  s+=r(212,20,21,134,'#181b13',4)+r(214,13,17,19,url('wood'),6)+c(223,12,7,url('lightwood'));
  s+=path('M176 143 Q196 132 184 163 Q178 172 186 175 M261 145 Q241 134 253 164 Q260 176 251 178','none','#1a1c13',3);
  s+=path('M204 167 Q222 157 244 167 L240 176 L208 176 Z',url('lightwood'))+path('M212 211 L232 211 L237 184 L209 184 Z','#23271e');
  const strings=p.strings||[55,62,69,76];strings.forEach((n,i)=>{const x=215+i*4.5;s+=l(x,19,x,205,url('silver'),.9,`data-vibrate="${i}"`);for(let f=0;f<13;f++){const midi=n+f;if(midi>=p.range[0]&&midi<=p.range[1])s+=c(x,34+f*9,5,'transparent',`${hit(midi)} class="fret play-part" data-string="${i}"`);}});
  if(!['bass','pizz'].includes(p.id))s+=`<g data-motion="bow" style="transform-origin:260px 153px">${l(86,174,391,130,url('wood'),5)}${l(88,180,390,137,'#d8cda9',2)}${r(88,172,22,12,'#252a23',1)}${c(387,132,3,url('brass'))}</g>`;
  if(low)s+=l(223,218,223,234,url('silver'),3);s+=t(371,202,p.id==='bass'?'CONTRABAJO / PIZZICATO':p.id==='pizz'?'PIZZICATO':low?'REGISTRO GRAVE':'ARCO / CUERDAS',8);
 }else if(p.surface==='wind'){
  if(p.id==='ocarina'){
   s+=path('M119 174 C64 154 85 98 131 83 C178 66 232  80 248 102 L318 45 Q334 39 339 58 L303 136 C355 165 321 204 277 204 C213 205 174 180 119 174 Z',url('ceramic'),'#7f9f89',2);
   for(let i=0;i<7;i++)s+=c(142+i*21,125+Math.sin(i)*13,7,'#12281e','stroke="#91b69c" stroke-width="2" data-hole="'+i+'"');
   s+=path('M113 101 Q150 80 205  90','none','#b1cbbb',2,'opacity=".6"');
  }else{
   const reed=['reed','clarinet','bassoon'].includes(p.id),material=reed?(p.id==='bassoon'?'wood':'ebony'):'silver';
   s+=r(39,107,421,33,url(material),10)+r(54,104,12,39,url('silver'),3)+r(441,104,12,39,url('silver'),3);
   if(reed)s+=path('M33 112 L8 116 L8 131 L38 137 Z','#2c3026','#77735d',1)+path('M451 111 Q474 97 493 94 L496 149 Q474 147 451 137 Z',url(material),'#8a8971',2);
   else s+=r(68,111,35,22,url('silver'),10)+r(77,115,18,12,'#334a41',6);
   s+=l(111,106,430,106,url('silver'),3);
   for(let i=0;i<10;i++){let x=119+i*30;s+=l(x,105,x+5,122,url('silver'),2)+c(x+5,123,10,url('silver'),'stroke="#57635b" stroke-width="1" data-motion="keycup" data-hole="'+i+'"')+c(x+5,123,6,reed?'#404b41':'#bbc4b1');if(i%3===0)s+=l(x+7,122,x+14, 95,url('silver'),2)+c(x+14,94,4,url('silver'));}
   if(p.id==='bassoon')s+=r(114, 74,323,22,url('wood'),8)+path('M113 84 Q85 81  80 108','none',url('silver'),6);
  }
  s+=t(260,215,'LLAVES Y AIRE · ALTURAS EN LOS PADS',8);
 }else if(p.surface==='brass'){
  if(p.id==='horn'){
   s+=`<ellipse cx="217" cy="137" rx="92" ry="64" fill="none" stroke="${url('brass')}" stroke-width="16"/>`;
   for(let i=0;i<3;i++)s+=`<ellipse cx="215" cy="139" rx="${36+i*17}" ry="${28+i*10}" fill="none" stroke="${url('brass')}" stroke-width="6"/>`;
   s+=path('M285 115 Q342 102 386 63 L417 182 Q344 147 293 148 Z',url('brass'),'#b9a074',2)+`<ellipse cx="402" cy="123" rx="20" ry="61" fill="#4a3d26" stroke="${url('brass')}" stroke-width="8"/>`;
  }else{
   s+=path('M58 111 L335 111 Q370 105 435  70','none',url('brass'),12);
   s+=path('M340 114 L437 62 Q461 69 456 140 L435 167 L340 128 Z',url('brass'),'#af8d53',1)+`<ellipse cx="444" cy="114" rx="17" ry="51" fill="#342c1e" stroke="${url('brass')}" stroke-width="8"/>`;
   s+=r(41,106,30,15,url('silver'),5);
   if(p.id==='trombone')s+=path('M322 140 H107 Q80 140 80 161 Q80 181 109 181 H370','none',url('brass'),9,'data-motion="slide"');
   else{s+=path('M125 114 V167 Q125 179 145 179 H276 Q300 179 300 161 V115','none',url('brass'),9);for(let i=0;i<3;i++){let x=174+i*32;s+=r(x-8,100,17, 68,url('brass'),3)+`<g data-motion="valve">${r(x-3,78,6,29,url('silver'),1)}${r(x-11,75,22,7,url('silver'),3)}</g>`;}}
   if(p.id==='muted_brass')s+=path('M441  90 L489 102 L489 124 L441 137 Z',url('silver'),'#71806e',2);
  }
 }else if(p.surface==='mallet'){
  s+=r(28,48,464,154,url('wood'),9)+grain(28,48,464,154)+r(40,56,440,137,'#151e17',5);
  const seq=whites.slice(0,15),w=418/seq.length;
  seq.forEach((n,i)=>{let x=51+i*w,hh=110-i*3.4;s+=r(x+4,85,w-10,hh+18,url('silver'),4)+key(n,x,76+i*1.8,w-4,hh,url(p.id==='metallophone'?'brass':'silver'),'bar');s+=c(x+(w-4)/2,90+i*1.8,2,'#526358');});
  notes.filter(dark).slice(0,10).forEach(n=>{const i=seq.findIndex(a=>a>n);if(i>0)s+=key(n,51+i*w-w*.36,51,w*.65,52,url('ebony'),'bar');});
  s+=`<g data-motion="mallet" style="transform-origin:100px 50px">${l(80,17,148,97,url('lightwood'),4)}${c(148,97,10,'#d6c099')}${c(145,94,4,'#ebd9b1')}</g>`;
 }else if(p.surface==='harp'){
  s+=path('M78 208 Q61  80 143 25 Q253 119 415 30 L436 209 Z',url('wood'),'#ad8553',6)+path('M99 195 Q93 107 151 52 Q257 131 403 58 L409 195 Z','#17231b','#c4a878',3);
  const seq=whites.slice(0,17);seq.forEach((n,i)=>{let x=116+i*17,Y=68+32*Math.sin(i/seq.length*Math.PI);s+=l(x,Y,x,194,n%12===0?'#b4785f':url('silver'),3.5,`${hit(n)} class="harp-string play-part"`)+bearing(x,Y);});s+=r(69,206,379,13,url('brass'),3);
 }else if(p.surface==='tines'){
  const outline='M150 34 Q260 12 365 38 L399 194 Q385 218 260 221 Q135 219 122 192 Z';
  s+=path(outline,url('wood'),'#aa8554',3)+path(outline,url('grain'))+c(260,162,34,'#bfa16b')+c(260,162,28,'#0d170e')+c(260,162,32,'none','stroke="#554124" stroke-width="2"')+r(147,61,229,10,url('brass'),3);
  const seq=whites.slice(0,11);seq.forEach((n,i)=>{const x=153+i*20,h=85+(5-Math.abs(5-i))*11;s+=key(n,x,49,15,h,url('silver'),'tine')+l(x+4,52,x+4,49+h-8,'#f2f4dd',1,'pointer-events="none"');});
 }else if(p.surface==='bells'){
  s+=r(45,30,430,12,url('wood'),4)+l(65,40,65,213,url('brass'),5)+l(458,40,458,213,url('brass'),5);
  const seq=whites.slice(0,9);seq.forEach((n,i)=>{let x=94+i*42,base=175-i*6;s+=l(x,41,x, 70,url('silver'),1.5)+`<g class="bell play-part" ${hit(n)} style="transform-origin:${x}px 55px">`+path(`M${x-11} 84 Q${x} 56 ${x+11} 84 L${x+18} ${base} Q${x} ${base+12} ${x-18} ${base} Z`,url('brass'),'#c7ad76',1)+c(x,base+4,4,url('silver'))+'</g>';});
 }else if(p.surface==='bellows'){
  s+=r(53,43,83,164,url('wood'),12)+r(378,43,83,164,url('wood'),12)+grain(53,43,83,164)+grain(378,43,83,164);
  s+='<g data-motion="bellows" style="transform-origin:256px 130px">';for(let i=0;i<22;i++)s+=path(`M${137+i*11} 55 l5 -7 l5 7 V196 l-5 7 l-5 -7 Z`,i%2?'#5c3930':'#342823','#a0886a',.8);s+='</g>';
  const seq=notes.slice(0,13);seq.forEach((n,i)=>s+=key(n,64,54+i*10.8,55,10,dark(n)?url('ebony'):url('ivory'),'accordion-key'));
  for(let i=0;i<15;i++){let n=notes[i%notes.length];s+=c(394+(i%3)*21,70+Math.floor(i/3)*27,5,url('ivory'),`${hit(n)} class="play-part"`);}
 }else if(p.surface==='choir'){
  const count=5;s+=path('M45 206 Q260 169 475 206 L475 216 H45 Z',url('wood'));
  for(let i=0;i<count;i++){const x=112+i*75,Y= 70+Math.abs(i-2)*9;s+=path(`M${x-28} 207 Q${x-32} ${Y+30} ${x} ${Y+29} Q${x+32} ${Y+30} ${x+28} 207 Z`,url('panel'),'#65746c',1)+`<ellipse cx="${x}" cy="${Y}" rx="17" ry="23" fill="#c3ac8a"/>`+path(`M${x-17} ${Y-3} Q${x-24} ${Y-33} ${x+13} ${Y-24} L${x+17} ${Y} Q${x+3} ${Y-17} ${x-17} ${Y-3}`,url('ebony'))+`<ellipse data-motion="vowel" cx="${x}" cy="${Y+11}" rx="4" ry="3" fill="#513d2d" style="transform-origin:${x}px ${Y+11}px"/>`+path(`M${x-13} ${Y+41} L${x} ${Y+51} L${x+13} ${Y+41}`,'none','#b8a27a',2);}
 }else if(p.surface==='drum'){
  const cym=['hat','open_hat','ride'].includes(p.id);
  if(cym){s+=l(260,100,260,222,url('silver'),5)+l(260,201,214,226,url('silver'),3)+l(260,201,308,226,url('silver'),3);s+=`<g ${hit(p.midi)} class="play-part cymbal" style="transform-origin:260px 112px"><ellipse cx="260" cy="120" rx="152" ry="65" fill="${url('brass')}" stroke="#d2b176" stroke-width="2"/>`;for(let i=0;i<12;i++)s+=`<ellipse cx="260" cy="120" rx="${31+i*10}" ry="${14+i*4}" fill="none" stroke="${i%2?'#f1d29b':'#5b502f'}" stroke-opacity=".2"/>`;s+=`<ellipse cx="260" cy="111" rx="29" ry="15" fill="${url('brass')}"/>${c(260,109,6,'#403d29')}</g>`;}
  else if(['shaker','wood','rim'].includes(p.id)){s+=`<g ${hit(p.midi)} class="play-part shaker">${r(111, 70,290,111,url('wood'),30)}${grain(111,70,290,111)}${r(137,105,234,10,'#151b11',5)}${r(122, 80,6,88,url('brass'),2)}${r(385,80,6,88,url('brass'),2)}</g>`;}
  else{s+=r(133,95,254,86,url('wood'),4)+grain(133,95,254,86)+`<ellipse cx="260" cy="179" rx="129" ry="46" fill="${url('wood')}" stroke="${url('silver')}" stroke-width="5"/>`;
   for(let i=0;i<9;i++){let x=144+i*29;s+=r(x,102,6,84,url('silver'),3)+r(x-2,123,10,20,url('silver'),2);}
   s+=`<ellipse ${hit(p.midi)} class="play-part drum-head" cx="260" cy="105" rx="130" ry="60" fill="${url('skin')}" stroke="${url('silver')}" stroke-width="7"/><ellipse cx="260" cy="105" rx="118" ry="51" fill="none" stroke="#d4ccb3" stroke-width="1" pointer-events="none"/>`;
   for(let i=0;i<10;i++){let ang=i/10*Math.PI*2;s+=bearing(260+130*Math.cos(ang),105+60*Math.sin(ang));}
   s+=`<g data-motion="stick" style="transform-origin:145px 29px">${l(147,29,261,103,url('lightwood'),5)}${c(261,103,4,'#d9bf92')}</g>`;
  }
 }else{
  s+=r(26, 38,468,170,url('panel'),11)+r(26,38,15,170,url('wood'),4)+r(479,38,15,170,url('wood'),4)+r(58,55,206, 68,'#0e1d14',5);
  s+=l(62,89,258,89,'#55745a',.7)+l(160,61,160,117,'#42624b',.7)+path('M64 91 H79 L81  70 L84 108 L 90  90 H110 L128 75 L146 107 L164 75 L181 107 L199 75 L215 103 L230  80 H258','none','#a4c991',1.5,'data-motion="signal"');
  for(let i=0;i<5;i++){let x=294+i*35;s+=c(x,79,13,url('silver'))+c(x,79,10,url('ebony'))+l(x,79,x+4,71,'#ded7b8',2)+t(x,111,['TONE','BODY','AIR','MOD','OUT'][i],7);}
  s+=kb(57,137,405, 52);
 }
 s+='</g>';
 return `<svg class="surface atelier-surface" viewBox="0 0 520 248" role="group" aria-label="${esc(p.label)}: superficie expresiva esquemática">${defs}${s}</svg>`;
}
// Stable keyed maps prevent event order from becoming a random visual performance.
const Base=V.Stage;
class AtelierStage extends Base{
 constructor(...args){super(...args);this.motion='soft';this.labels=true;this.history=new Map();this.nodes=new Map();this.lastIds=new Map();this.lastTime=0;this.createControls();}
 createControls(){const controls=document.createElement('div');controls.className='atelier-controls';controls.innerHTML='<span class="atelier-kicker">ENSEMBLE / LIVE ROOM</span><div class="atelier-actions"><button id="view-labels" aria-pressed="true">Notas visibles</button><button id="view-motion" aria-pressed="false">Movimiento suave</button><button id="view-focus">Ampliar instrumento</button></div>';this.el.before(controls);
 controls.querySelector('#view-labels').onclick=()=>{this.labels=!this.labels;this.el.classList.toggle('hide-pads',!this.labels);controls.querySelector('#view-labels').setAttribute('aria-pressed',String(this.labels));};
 controls.querySelector('#view-motion').onclick=()=>{this.motion=this.motion==='off'?'soft':'off';this.reduced=this.motion==='off'||matchMedia('(prefers-reduced-motion: reduce)').matches;controls.querySelector('#view-motion').textContent=this.motion==='off'?'Movimiento desactivado':'Movimiento suave';controls.querySelector('#view-motion').setAttribute('aria-pressed',String(this.motion==='off'));};
 controls.querySelector('#view-focus').onclick=()=>this.focus(this.selected||this.score?.tracks[0]?.id);
 this.dialog=document.createElement('dialog');this.dialog.className='focus-instrument';this.dialog.innerHTML='<div class="focus-head"><div><span class="atelier-kicker">INSTRUMENTO / VISTA AMPLIADA</span><h2></h2></div><button class="focus-close" aria-label="Cerrar vista ampliada">Cerrar ×</button></div><div class="focus-body"></div><p class="hint">Tocá las notas. La animación explica el ataque; no enseña digitación física. Escape cierra esta vista.</p>';document.body.append(this.dialog);this.dialog.querySelector('.focus-close').onclick=()=>this.dialog.close();this.dialog.addEventListener('click',e=>{if(e.target===this.dialog)this.dialog.close();});this.dialog.addEventListener('cancel',()=>{this.focusTrack=null;});this.dialog.addEventListener('close',()=>{this.focusTrack=null;});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&this.dialog.open){e.stopImmediatePropagation();e.preventDefault();this.dialog.close();}},true);
 matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',e=>{this.reduced=e.matches||this.motion==='off';});
 }
 pads(p,events){let ns=[...new Set(events.map(e=>e.midi))].sort((a,b)=>a-b);if(!ns.length)ns=p.drum?[p.midi]:range(p,[]);return '<div class="note-pads" role="group" aria-label="Alturas tocables">'+ns.map(n=>`<button class="note-pad ${dark(n)?'accidental':''}" data-note="${n}" aria-label="Tocar ${esc(M.noteName(n))}">${esc(M.noteName(n))}</button>`).join('')+'</div>';}
 bind(host,id){host.querySelectorAll('[data-note]').forEach(el=>{const trigger=()=>this.onNote(id,Number(el.dataset.note));if(el.tagName==='BUTTON')el.onclick=trigger;else{el.addEventListener('pointerdown',e=>{e.preventDefault();trigger();});el.addEventListener('keydown',e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();trigger();}});}});}
 build(score,selected){super.build(score,selected);this.nodes.clear();this.history.clear();this.lastIds.clear();this.lastTime=0;if(this.dialog?.open)this.dialog.close();for(const tr of score.tracks){const p=M.resolve(tr.patch),events=score.events.filter(e=>e.track===tr.id),card=this.cards.get(tr.id);card.classList.add('atelier-instrument');card.dataset.surface=p.surface;card.querySelector('.surface').outerHTML=instrument(p,events);card.querySelector('.surface').insertAdjacentHTML('afterend',this.pads(p,events));
  card.querySelector('.readout span').textContent=`${events.length} eventos · ${p.surface}`;card.querySelector('footer').lastElementChild.textContent='VEL';card.querySelector('.level').setAttribute('title','Velocity activa, no nivel de audio');
  const focus=document.createElement('button');focus.className='expand';focus.textContent='↗';focus.title='Ampliar '+p.label;focus.setAttribute('aria-label','Ampliar '+p.label);focus.onclick=()=>this.focus(tr.id);card.querySelector('.lane-buttons').append(focus);
  card.querySelector('footer').insertAdjacentHTML('beforebegin','<canvas class="event-trail" width="440" height="25" aria-label="Historial de ataques reales, últimos tres segundos"></canvas>');
  this.bind(card,tr.id);this.nodes.set(tr.id,{keys:[...card.querySelectorAll('[data-note]')],motions:[...card.querySelectorAll('[data-motion]')],text:card.querySelector('.readout strong'),meter:card.querySelector('.level i'),trail:card.querySelector('.event-trail')});this.history.set(tr.id,[]);
 }this.state(new Set(),null,selected);}
 state(muted,solo,selected){super.state(muted,solo,selected);this.selected=selected;this.muted=muted;this.solo=solo;}
 focus(id){const tr=this.score?.tracks.find(t=>t.id===id);if(!tr)return;this.onSelect(id);this.focusTrack=id;const p=M.resolve(tr.patch),events=this.score.events.filter(e=>e.track===id);this.dialog.style.setProperty('--voice',p.color);this.dialog.querySelector('h2').textContent=tr.label;this.dialog.querySelector('.focus-body').innerHTML=instrument(p,events)+this.pads(p,events);this.bind(this.dialog,id);this.dialog.showModal();this.dialog.querySelector('.focus-close').focus();}
 decorate(hostNodes,active,time){const ns=new Set(active.map(e=>e.midi)),fretSeen=new Set();for(const k of hostNodes.keys){let lit=ns.has(Number(k.dataset.note));if(k.classList.contains('fret')){if(fretSeen.has(k.dataset.note))lit=false;else if(lit)fretSeen.add(k.dataset.note);}k.classList.toggle('lit',lit);}
 const amp=active.reduce((m,e)=>Math.max(m,e.performedVelocity??e.velocity??.7),0),on=active.length>0;
 for(const m of hostNodes.motions){let tx='';if(on&&!this.reduced){const type=m.dataset.motion;if(type==='bow')tx=`translate(${Math.sin(time*4)*11}px,0)`;else if(type==='mallet'||type==='stick')tx=`rotate(${Math.sin(time*16)*3}deg)`;else if(type==='valve'||type==='keycup')tx='translateY(2px)';else if(type==='vowel')tx=`scaleY(${1+amp*1.2})`;else if(type==='bellows')tx=`scaleX(${1+.025*Math.sin(time*4)})`;else if(type==='slide')tx=`translateX(${Math.sin(time*3)*7}px)`;}m.style.transform=tx;}
 }
 update(events,time){if(time<this.lastTime){this.history.forEach(a=>a.splice(0));this.lastIds.clear();}this.lastTime=time;
 for(const[id,card]of this.cards){const active=events.filter(e=>e.track===id),n=this.nodes.get(id);if(!n)continue;const ns=[...new Set(active.map(e=>e.midi))];n.text.textContent=ns.length?ns.slice(0,5).map(M.noteName).join(' · '):'LISTO';let amp=active.reduce((v,e)=>Math.max(v,e.performedVelocity??e.velocity??.7),0);n.meter.style.width=`${amp*100}%`;card.classList.toggle('sounding',active.length>0);this.decorate(n,active,time);
  const ids=new Set(active.map(e=>e.id||`${e.midi}:${e.until}`)),previous=this.lastIds.get(id)||new Set(),hist=this.history.get(id);active.forEach(e=>{const key=e.id||`${e.midi}:${e.until}`;if(!previous.has(key))hist.push({time,midi:e.midi,velocity:e.performedVelocity??e.velocity??.7});});this.lastIds.set(id,ids);while(hist.length&&time-hist[0].time>3)hist.shift();const ctx=n.trail.getContext('2d'),w=n.trail.width,h=n.trail.height;ctx.clearRect(0,0,w,h);ctx.strokeStyle='#7a786329';ctx.beginPath();ctx.moveTo(0,h-2);ctx.lineTo(w,h-2);ctx.stroke();ctx.fillStyle=M.resolve(this.score.tracks.find(t=>t.id===id).patch).color;
  for(const e of hist){ctx.globalAlpha=1-(time-e.time)/3;ctx.fillRect(w-5-(time-e.time)*w/3,h-3-e.velocity*16,3,Math.max(2,e.velocity*16));}ctx.globalAlpha=1;
 }
 if(this.dialog.open&&this.focusTrack)this.decorate({keys:[...this.dialog.querySelectorAll('[data-note]')],motions:[...this.dialog.querySelectorAll('[data-motion]')]},events.filter(e=>e.track===this.focusTrack),time);
 }
}
V.Stage=AtelierStage;root.Atelier={instrument,range,AtelierStage};
})(globalThis);
/* Actual post-master waveform. Instrument meters above are velocity, not audio. */
(function(){'use strict';const host=document.createElement('div');host.className='master-scope';host.innerHTML='<canvas width="200" height="32" aria-label="Forma de onda real de la salida del sintetizador"></canvas><span>SALIDA / — dBFS</span>';document.querySelector('.toolbar').after(host);const cv=host.querySelector('canvas'),ctx=cv.getContext('2d'),label=host.querySelector('span');let values=null,peakHold=0;
Atelier.scope=function(sound){ctx.clearRect(0,0,200,32);ctx.strokeStyle='#a9b89c';ctx.lineWidth=1;ctx.beginPath();let peak=0;if(sound.analyser){if(!values||values.length!==sound.analyser.fftSize)values=new Float32Array(sound.analyser.fftSize);sound.analyser.getFloatTimeDomainData(values);for(let i=0;i<200;i++){let v=values[Math.floor(i*values.length/200)];peak=Math.max(peak,Math.abs(v));if(i===0)ctx.moveTo(0,16-v*64);else ctx.lineTo(i,16-v*64);}}else{ctx.moveTo(0,16);ctx.lineTo(200,16);}ctx.stroke();peakHold=Math.max(peak,peakHold*.9);label.textContent='SALIDA / '+(peakHold>1e-5?(20*Math.log10(peakHold)).toFixed(1):'—')+' dBFS';};
})();
