/* Ensemble Atelier: event-driven SVG instruments. No pictures or external assets.
   Surfaces are explanatory, not fingering tutors or physical simulations. */
(function(root){
'use strict';
const M=root.MusicLab, V=root.VisualLab, esc=V.esc;
let serial=0;
const dark=n=>[1,3,6,8,10].includes(M.mod(n,12));
const r=(x,y,w,h,fill,rad=2,extra='')=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rad}" fill="${fill}" ${extra}/>`;
const l=(x,y,X,Y,stroke,width=1,extra='')=>`<line x1="${x}" y1="${y}" x2="${X}" y2="${Y}" stroke="${stroke}" stroke-width="${width}" ${extra}/>`;
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
 const uid='at'+(++serial),u=name=>`url(#${uid}-${name})`,notes=range(p,events),whites=notes.filter(n=>!dark(n));
 const G=(name,stops,x1=0,y1=0,x2=0,y2=1)=>`<linearGradient id="${uid}-${name}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops.map(([o,color])=>`<stop offset="${o}" stop-color="${color}"/>`).join('')}</linearGradient>`;
 const defs=`<defs>${G('wood',[[0,'#dda465'],[0.5,'#b97943'],[1,'#754b35']],0,0,1,.7)}${G('maple',[[0,'#e8b975'],[0.55,'#cf934e'],[1,'#946039']],0,0,.8,1)}${G('black',[[0,'#494d4e'],[0.3,'#292a2b'],[1,'#17191b']],0,0,.5,1)}${G('ivory',[[0,'#faf0d9'],[0.8,'#eadbbd'],[1,'#c7b695']])}${G('brass',[[0,'#ebc879'],[0.48,'#bf934d'],[1,'#785b34']])}${G('silver',[[0,'#e0e2dc'],[0.45,'#a9b2b4'],[1,'#626d73']])}${G('red',[[0,'#b66c57'],[0.45,'#8c453e'],[1,'#582f2e']],0,0,1,1)}${G('ceramic',[[0,'#d6b591'],[.3,'#be7650'],[.6,'#803f2d'],[1,'#341e1c']],0,0,.7,1)}${G('skin',[[0,'#f3e6cb'],[0.7,'#e2d0ae'],[1,'#c0ae8c']],0,0,.5,1)}
 <radialGradient id="${uid}-stage"><stop stop-color="#cba774" stop-opacity=".13"/><stop offset="1" stop-color="#cba774" stop-opacity="0"/></radialGradient>
 <pattern id="${uid}-cloth" width="5" height="5" patternUnits="userSpaceOnUse"><path d="M0 0H5M0 2.5H5M1 0V5M3.5 0V5" stroke="#e1d1ad" opacity=".14" stroke-width=".5"/></pattern>
 </defs>`;
 const screw=(x,y)=>c(x,y,3,u('silver'))+l(x-1.4,y,x+1.4,y,'#323133',1);
 const wood=(d,light=false)=>path(d,u(light?'maple':'wood'),'#42241b',2)+path(d,'none','#efc584',.8,'opacity=".5"');
 const ring=(x,y,rx,ry)=>`<ellipse data-motion="resonance" cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="none" stroke="#f7c878" stroke-width="1.8" opacity="0" style="transform-origin:${x}px ${y}px"/>`;
 const tube=(d,w=9)=>path(d,'none','#392b23',w+4,'stroke-linecap="round" stroke-linejoin="round"')+path(d,'none',u('brass'),w,'stroke-linecap="round" stroke-linejoin="round"')+path(d,'none','#ffe1a5',1,'opacity=".5"');
 const key=(n,x,y,w,h,fill,cls='')=>`<g class="key-assembly" data-key="${n}">${r(x,y,w,h,fill,2,`${hit(n)} class="play-part ${cls}" stroke="#36302a" stroke-width=".65"`)}${l(x+2,y+h-2,x+w-2,y+h-2,'#998c74',.6,'opacity=".5" pointer-events="none"')}</g>`;
 const keyboard=(x,y,w,h)=>{const kw=w/whites.length;let a=r(x-4,y-5,w+8,h+13,'#0b0c0d',3);whites.forEach((n,i)=>a+=key(n,x+i*kw,y,kw-.7,h,u('ivory'),'white-key'));notes.filter(dark).forEach(n=>{const i=whites.findIndex(w=>w>n);if(i>0)a+=key(n,x+i*kw-kw*.32,y,kw*.6,h*.63,u('black'),'black-key');});return a;};
 const label=(x,y,str)=>t(x,y,str,8,'#dbc49d');
 let s=`<ellipse cx="300" cy="188" rx="284" ry="137" fill="${u('stage')}"/><g class="instrument-body">`;
 if(p.surface==='keys'){
  const grand=['piano','prepared_piano','harpsichord'].includes(p.id);
  if(grand){
   s+=r(117,45,366,242,'#241c19',3)+r(124,52,352,228,u('wood'),2);
   s+=r(110,39,380,10,'#805538',2)+l(112,40,488,40,'#d9b17a',1.2);
   s+=r(145,62,310,91,'#573a2a',1)+r(151,68,298,79,u('wood'),1);
   s+=path('M150 147V67H450','none','#c08b55',1)+l(154,145,448,145,'#37251c',2);
   for(const x of [124,462]){s+=r(x,52,14,219,'#6b462f',1);for(let i=0;i<3;i++)s+=l(x+3+i*3,58,x+3+i*3,150,'#a16d42',.7);}
   s+=r(113,158,374,49,u('black'),4)+r(119,161,362,8,'#8d633e',1)+keyboard(131,173,338,26);
   s+=r(120,205,360,9,'#704a31',1)+l(121,206,479,206,'#c3935c',1);
   s+=r(150,222,300,49,'#543a2a',1)+r(156,226,288,40,u('wood'),1);
   for(const x of [119,466])s+=r(x,211,15,80,'#543a2a',1)+r(x-4,285,23,9,'#795134',1);
   for(let i=0;i<3;i++)s+=path(`M${281+i*19} 275v14q-6 9-5 13q6 4 11-1l-1-26Z`,u('brass'),'#e5c48a',.7);
   s+=label(300,164,p.id==='harpsichord'?'C L A V E':'A T E L I E R');
  }else{
   s+=r(49,95,502,177,u(p.id==='epiano'?'red':'wood'),13)+r(64,104,472,50,u('black'),5)+r(60,154,480,103,'#18181a',4)+keyboard(75,166,450,87);
   if(p.id==='organ'){for(let i=0;i<9;i++)s+=r(203+i*23,112,7,33,'#090909',2)+r(198+i*23,113+(i%3)*7,17,10,i<3?'#e4cfad':'#a47144',2);}
   else{s+=r(166,116,279,25,u('cloth'),3)+label(300,133,p.id==='epiano'?'E L E C T R I C   7 3':'C L A V I N E T');}
   for(const x of [95,504])s+=c(x,128,12,u('silver'))+c(x,128,9,u('black'))+l(x,128,x+3,121,'#f1d6a0',2);
   s+=l(62,264,539,264,'#d9b677',2);for(const x of[58,542])for(const y of[106,260])s+=screw(x,y);
  }
 }else if(p.surface==='fret'||p.surface==='bow'){
  const bowed=p.surface==='bow'||p.id==='bass',low=['bass','cello','contrabass'].includes(p.id),plucked=p.surface==='fret'||p.id==='pizz',electric=p.id.includes('dist_guitar')||p.id==='slap_bass';
  s+='<g data-motion="body" style="transform-origin:300px 220px">';
  const guitar='M287 149C272 143 245 144 245 169C245 188 257 195 250 210C241 225 226 238 229 266C232 296 263 306 300 306C337 306 368 296 371 266C374 238 359 225 350 210C343 195 355 188 355 169C355 144 328 143 313 149Z';
  const violin='M287 120C273 110 252 115 252 133C251 146 264 150 264 161C264 166 261 166 259 166C274 175 270 187 257 196C241 207 239 233 252 248C264 263 283 265 300 265C317 265 336 263 348 248C361 233 359 207 343 196C330 187 326 175 341 166C339 166 336 166 336 161C336 150 349 146 348 133C348 115 327 110 313 120Z';
  const solid='M287 148L274 128Q268 144 271 167C253 157 244 170 244 189L234 250Q231 288 268 296H332Q369 288 366 250L356 189C356 170 347 157 329 167Q332 144 326 128L313 148Z';
  const cello='M287 116C268 112 263 132 253 149C249 157 256 164 264 167C272 175 271 187 258 197C238 213 235 243 251 262C267 281 333 281 349 262C365 243 362 213 342 197C329 187 328 175 336 167C344 164 351 157 347 149C337 132 332 112 313 116Z';
  const outline=bowed?(low?cello:violin):electric?solid:guitar;
  s+=path(outline,'#39271d','#161719',4)+path(outline,u(bowed?'wood':electric?'red':'maple'),'#ecc58b',1.2);
  s+=path(outline,'none','#885730',.8,'transform="translate(9 6) scale(.97)"');
  if(!bowed&&!electric){s+=c(300,204,24,'#855b33')+c(300,204,21,'#e4c38a')+c(300,204,18,'#1d1a18')+c(300,204,25,'none','stroke="#e9c98d" stroke-width=".8"');s+=path('M323 199Q338 219 330 239Q320 245 310 238L311 226Q325 218 323 199Z','#583524');}
  if(bowed){s+=path('M270 194C281 184 277 199 271 208C264 219 266 228 274 221M330 194C319 184 323 199 329 208C336 219 334 228 326 221','none','#35221b',2.6,'stroke-linecap="round"');s+=path('M282 221Q300 215 318 221L318 229Q300 225 282 229Z','#e6bd7b','#6b472c',1)+path('M289 239H311L305 259H295Z','#242326');}
  else s+=r(280,256,40,10,'#392c24',2)+r(284,256,32,2,'#e5d2ac',.5);
  if(electric)s+=r(284,206,32,10,'#d5c9b5',2)+r(284,235,32,10,'#d5c9b5',2)+c(335,259,6,u('brass'))+c(330,279,5,u('brass'));
  const top=bowed?66:62,bottom=bowed?211:189;
  s+=path(`M290 ${top}H310L312 ${bottom}H288Z`,'#292627','#aa8355',.8);
  if(bowed){s+=path('M292 65V42Q283 24 293 18Q310 11 310 28Q310 38 307 42V65Z',u('wood'),'#dfac68',1)+c(300,27,6,'none','stroke="#653f28" stroke-width="2"');for(let i=0;i<4;i++){const y=45+i*5;s+=l(286,y,314,y,'#69442c',2)+c(i%2?317:283,y,3.5,'#45413b');}}
  else{s+=path('M290 62L283 22Q300 16 317 22L310 62Z',u('wood'),'#dcb581',1);for(let i=0;i<3;i++){const y=29+i*10;for(const side of[-1,1])s+=l(300+side*13,y,300+side*21,y,'#aeaaa0',2)+r(300+side*23-3,y-3,6,6,u('ivory'),2)+c(300+side*9,y,2,u('silver'));}for(let f=0;f<=17;f++){const y=64+126*(1-2**(-f/12))/ (1-2**(-17/12));s+=l(290,y,310,y,'#bcb6a3',f? .75:2);if([3,5,7,9,12,15].includes(f))s+=c(300,y-3,1.3,'#d5c8b2');}}
  const strings=p.strings||(bowed?[55,62,69,76]:[40,45,50,55,59,64]);strings.forEach((n,i)=>{const x=292+16*i/(strings.length-1);s+=l(x,bowed?42:29,x,bowed?251:262,'#e8d7b4',1-i*.1,`data-vibrate="${i}" data-open-note="${n}"`);for(let f=0;f<=17;f++){if(n+f<p.range[0]||n+f>p.range[1])continue;s+=c(x,top+5+f*(bottom-top-10)/17,4,'transparent',`${hit(n+f)} class="fret play-part" data-string="${i}"`);}});
  if(low)s+=l(300,274,300,308,'#bfb9a7',2.5);s+=ring(300,bowed?224:210,bowed?44:30,bowed?36:30)+'</g>';
  if(bowed&&!plucked)s+=`<g data-motion="bow" style="transform-origin:300px 219px">${path('M159 216Q300 211 441 216','none','#95633c',3)}${l(159,222,442,222,'#e6d6b5',1.6)}${r(409,216,27,9,'#2b2828',1)}${r(412,218,5,7,u('silver'),1)}</g>`;
 }else if(p.surface==='wind'){
  if(p.id==='ocarina'){
   s+='<g data-motion="body" style="transform-origin:286px 195px">';
   const body='M147 235C79 212 114 139 180 113Q249 93 310 126L385 63Q403 54 412 74L382 162Q449 207 398 253Q328 281 243 251Z';
   s+=path(body,u('ceramic'),'#e7b68b',2)+path('M130 181Q145 118 231 119Q280 119 310 140','none','#f9d0a8',3,'opacity=".6"')+path('M171 240Q312 281 383 246','none','#4f2723',7,'opacity=".5"');
   for(let i=0;i<8;i++){let x=181+i%4*44,y=174+Math.floor(i/4)*39+(i%3)*5;s+=`<g data-motion="hole" data-hole="${i}">${c(x,y,10,'#d3986a')}${c(x,y,7,'#301c1a')}${path(`M${x-6} ${y}Q${x} ${y-10} ${x+6} ${y}`,'none','#f4c491',1)}</g>`;}
   s+=ring(294,199,123,62)+'</g>';
  }else{
   const reed=['reed','clarinet','bassoon'].includes(p.id),bassoon=p.id==='bassoon';
   s+='<g><g data-motion="body" style="transform-origin:300px 170px">';
   s+=r(81,151,432,33,u(reed?bassoon?'wood':'black':'silver'),9)+l(97,155,499,155,reed?'#b9a59a':'#fff6df',1.5);
   for(const x of[108,174,379,490])s+=r(x,148,8,39,u('silver'),2);
   if(reed)s+=path('M79 157L38 162L37 173L83 179Z',u('black'),'#b1a898',1)+path('M499 155Q533 142 548 131L563 193Q534 187 499 179Z',u(bassoon?'wood':'black'),'#aea492',1.5);
   else s+=r(112,155,38,25,u('silver'),10)+r(121,162,17,9,'#333c43',5);
   s+=l(181,147,475,147,'#d4d0c4',3);
   for(let i=0;i<10;i++){let x=192+i*28;s+=l(x,148,x-3,160,'#e1d9c5',2)+`<g data-motion="keycup" data-hole="${i}" style="transform-origin:${x}px 165px">${c(x,165,10.5,u('silver'),'stroke="#4f5050" stroke-width="1.5"')}${c(x,165,7,reed?'#82796a':'#e0ddd3')}${path(`M${x-6} 161Q${x} 156 ${x+6} 162`,'none','#fff5d9',1.2)}</g>`;if(i%3===1)s+=l(x+10,146,x+17,133,'#c4c1b6',2)+c(x+18,131,4,u('silver'));}
   if(bassoon)s+=r(125,116,370,25,u('wood'),7)+path('M129 128Q83 124 79 151','none','#b4c0c5',5);
   s+=ring(reed?547:517,168,22,34)+'</g></g>';
  }
 }else if(p.surface==='brass'){
  s+='<g data-motion="body" style="transform-origin:281px 187px">';
  if(p.id==='horn'){
   s+=tube('M361 64V169C361 236 331 273 274 273C213 273 174 230 174 174C174 114 213 81 266 81C322 81 354 123 354 171C354 226 322 260 276 260C228 260 190 227 190 180',9);
   s+=tube('M190 180C188 156 201 140 220 140H287Q309 140 309 159V190Q309 206 287 206H232Q210 206 210 224Q210 244 240 247H273Q296 247 296 226Q296 215 282 215H245',7);
   s+=tube('M224 139V122Q224 103 244 103Q266 103 266 125V151H294Q320 151 320 174Q320 197 296 197H230Q218 197 218 184Q218 171 230 171H291',6);
   s+=path('M192 203Q157 192 90 210Q106 165 145 110Q145 157 203 178Z',u('brass'),'#e3bd77',1.4)+path('M90 210Q118 183 145 110','none','#f1d491',3)+path('M98 202Q128 191 185 201L192 192Q148 179 145 122Z','#d2a85c');
   s+=r(356,51,10,17,u('brass'),2)+r(353,47,16,5,u('silver'),2);
   for(let i=0;i<3;i++){const y=160+i*19;s+=c(280,y,8,u('silver'),'stroke="#70634e" stroke-width="1"')+c(280,y,3,'#706553')+`<g data-motion="valve" data-hole="${i}">${l(284,y,323,y+1,'#c9c4b5',2)}${r(318,y-3,17,7,u('ivory'),3)}</g>`;}
   s+=ring(137,172,41,38);
  }else{
   s+=tube('M72 157H363',13)+r(47,149,28,16,u('silver'),4);
   s+=path('M334 149Q410 135 474 92L484 226Q410 185 335 173Z',u('brass'),'#d8a761',1.5)+`<ellipse cx="480" cy="159" rx="23" ry="67" fill="#51301c" stroke="${u('brass')}" stroke-width="9"/>`+`<ellipse cx="484" cy="159" rx="12" ry="53" fill="#201b19"/>`;
   if(p.id==='trombone')s+=`<g data-motion="slide">${tube('M376 187H125Q91 187 91 219Q91 247 125 247H384',10)}${l(162,189,162,245,'#efd29b',4)}</g>`;
   else{s+=tube('M153 157V219Q153 236 176 236H302Q328 236 328 217V161',10);for(let i=0;i<3;i++){const x=218+i*32;s+=r(x-9,143,19,78,u('brass'),4)+`<g data-motion="valve" data-hole="${i}">${r(x-3,119,6,31,u('silver'),1)}${r(x-12,113,24,7,u('silver'),3)}</g>`;}s+=tube('M227 204H198Q185 204 185 190V170',6);}
   if(p.id==='muted_brass')s+=path('M480 131L535 145V176L480 190Z',u('silver'),'#d3d0c3',1.5);
   s+=ring(484,159,27,69);
  }s+='</g>';
 }else if(p.surface==='mallet'){
  s+=r(58,106,485,91,u('black'),5)+wood('M50 105H61V210H50Z')+wood('M535 105H547V210H535Z');
  for(const x of[76,526])s+=l(x,191,x,291,'#666967',6)+l(x,282,x-17,306,'#747973',5)+c(x-17,307,5,'#15191a');
  s+=l(77,279,525,279,'#45494a',6);
  const seq=whites.slice(0,15),w=452/seq.length;
  seq.forEach((n,i)=>{const x=74+i*w,y=127,h=63-i*.8;s+=r(x+4,169,w-9,104-i*4.2,u('brass'),3)+key(n,x,y,w-5,h,u(p.id==='metallophone'?'brass':'silver'),'bar')+c(x+(w-5)/2,y+10,2,'#5b5550');});
  notes.filter(dark).forEach(n=>{const i=seq.findIndex(a=>a>n);if(i>0)s+=key(n,74+i*w-w*.35,89,w*.67,53,u('silver'),'bar');});
  for(let i=0;i<2;i++)s+=`<g data-motion="mallet" data-hand="${i}" style="transform-origin:${i?435:155}px 46px">${l(i?435:155,46,i?362:227,142,'#ac7948',4)}${l(i?436:156,46,i?363:228,141,'#ecd3a1',1)}${c(i?362:227,142,12,'#8d8173')}${c(i?360:225,139,8,'#d5c9b2')}</g>`;
 }else if(p.surface==='harp'){
  s+=wood('M164 60H192L188 286H158Z')+wood('M171 65Q215 20 250 70Q283 126 347 146Q393 163 424 133L439 145Q407 187 337 167Q266 145 231 91Q211 63 180 84Z');
  s+=wood('M423 135L444 146L316 292L282 286Z',true)+path('M429 152L304 282','none','#e0b57b',2);
  const seq=whites.slice(0,18);seq.forEach((n,i)=>{const x=204+i*11.3,Y=74+92*(1-Math.exp(-i/5.8)),end=x<287?281:281-(x-287)*1.071;if(end>Y)s+=l(x,Y,x,end,n%12===0?'#b15e49':n%12===5?'#617d99':'#dacba9',1.15,`${hit(n)} class="harp-string play-part" data-vibrate="${i}"`)+c(x,Y,2.5,u('brass'));});
  s+=r(156,63,39,12,u('brass'),4)+r(156,45,39,13,u('wood'),4)+l(169,81,166,277,'#e0b681',2)+wood('M156 278Q221 267 315 281L328 300Q242 319 148 298Z')+path('M154 297Q239 309 320 299','none','#eac78d',2)+ring(272,213,84,57);
 }else if(p.surface==='tines'){
  const outline='M192 44H398Q414 44 414 60V278Q414 293 398 293H192Q176 293 176 278V60Q176 44 192 44Z';s+=wood(outline,true)+path('M178 259Q289 282 410 261','none','#754b29',2)+c(295,241,34,'#8c6137')+c(295,241,28,'#18191b')+c(295,241,31,'none','stroke="#ebce97" stroke-width="2"');
  s+=r(190,86,211,10,u('brass'),3)+r(188,115,217,8,u('silver'),2);
  const seq=whites.slice(0,11);seq.forEach((n,i)=>{const x=191+i*19,h=70+(5-Math.abs(5-i))*13;s+=key(n,x,79,14,h,u('silver'),'tine')+label(x+7,157+Math.min(h-101,20),M.noteName(n));});s+=r(186,111,221,9,u('silver'),3)+screw(193,115)+screw(400,115)+ring(295,241,36,36);
 }else if(p.surface==='bells'){
  s+=wood('M66 71H530V87H66Z')+wood('M69 56H88V286H69Z')+wood('M507 56H526V286H507Z')+c(79,53,10,u('wood'))+c(517,53,10,u('wood'))+wood('M70 265L42 303H93L89 285H507L503 303H550L525 266L514 276H81Z');
  const played=[...new Set(events.map(e=>e.midi).filter(Number.isFinite))].sort((a,b)=>a-b),seq=played.length?played.slice(0,12):whites.slice(0,4),step=360/Math.max(3,seq.length-1),size=Math.min(1,step/76);seq.forEach((n,i)=>{const x=300+(i-(seq.length-1)/2)*step,Y=190-i*7;s+=`<g transform="translate(${x*(1-size)} 0) scale(${size} 1)">`+l(x,76,x,105,'#b6a99a',1.1)+`<g ${hit(n)} class="bell play-part" data-motion="bell" data-tone="${n}" style="transform-origin:${x}px 101px">${c(x,105,5,u('brass'))}${path(`M${x-12} 128Q${x-11} 111 ${x} 111Q${x+11} 111 ${x+12} 128Q${x+13} ${Y-15} ${x+25} ${Y}Q${x+27} ${Y+7} ${x+34} ${Y+10}Q${x} ${Y+21} ${x-34} ${Y+10}Q${x-27} ${Y+7} ${x-25} ${Y}Q${x-13} ${Y-15} ${x-12} 128Z`,u('brass'),'#efcf92',1.2)}<ellipse cx="${x}" cy="${Y+13}" rx="32" ry="6" fill="#50331e" stroke="#dcb474" stroke-width="2"/>${l(x,Y+14,x,Y+25,'#aa8042',3)}${c(x,Y+28,6,u('brass'))}</g></g>`;});
 }else if(p.surface==='bellows'){
  s+='<g data-motion="body" style="transform-origin:300px 192px">';
  s+='<g data-motion="bellows" style="transform-origin:298px 172px">';for(let i=0;i<23;i++){const x=172+i*10.8;s+=path(`M${x} 93L${x+5.4} 85L${x+10.8} 94V254L${x+5.4} 265L${x} 255Z`,i%2?'#a45c45':'#522d2c','#d9a876',.9);}s+='</g>';
  s+=`<g data-motion="accordion-left">${r(74,72,99,206,u('red'),14)}${r(83,85,79,181,u('black'),5)}`;
  const aw=162/whites.length;whites.forEach((n,i)=>s+=key(n,89,91+i*aw,64,aw-.5,u('ivory'),'accordion-key'));notes.filter(dark).forEach(n=>{const i=whites.findIndex(w=>w>n);if(i>0)s+=key(n,117,91+i*aw-aw*.3,36,aw*.6,u('black'),'accordion-key');});s+='</g>';
  s+=`<g data-motion="accordion-right">${r(422,71,97,206,u('red'),14)}${r(434,89,74,58,u('cloth'),4)}`;
  for(let i=0;i<18;i++)s+=c(446+i%3*21,164+Math.floor(i/3)*17,4.5,u('ivory'),`${hit(notes[i%notes.length])} class="play-part"`);s+=label(472,125,'ATELIER')+'</g></g>';
 }else if(p.surface==='choir'){
  s+=path('M72 289Q300 269 529 289L529 303H72Z',u('wood'));
  const skin=['#ae7658','#e0b18b','#80503f','#edbf9b','#c18a66'];
  for(let i=0;i<5;i++){const x=140+i*79,Y=99+Math.abs(i-2)*9;s+=`<g data-motion="singer" data-singer="${i}" style="transform-origin:${x}px 278px">`;
   s+=path(`M${x-34} 286L${x-31} ${Y+85}Q${x-23} ${Y+50} ${x} ${Y+48}Q${x+23} ${Y+50} ${x+31} ${Y+85}L${x+34} 286Z`,u(i%2?'red':'black'),'#80766c',.8);
   s+=path(`M${x-11} ${Y+32}V${Y+59}Q${x} ${Y+71} ${x+11} ${Y+58}V${Y+32}`,skin[i]);
   s+=`<ellipse cx="${x}" cy="${Y}" rx="22" ry="31" fill="${skin[i]}"/>`+path(`M${x-22} ${Y+2}Q${x-32} ${Y-40} ${x+2} ${Y-35}Q${x+30} ${Y-36} ${x+23} ${Y+10}L${x+17} ${Y-11}Q${x-2} ${Y-12} ${x-14} ${Y-23}Z`,i===3?'#967b5d':'#302624');
   s+=path(`M${x-14} ${Y-1}Q${x-9} ${Y-4} ${x-5} ${Y-1}M${x+5} ${Y-1}Q${x+10} ${Y-4} ${x+14} ${Y-1}`,'none','#503b31',1.4)+path(`M${x+1} ${Y+2}L${x-2} ${Y+11}L${x+3} ${Y+11}`,'none','#986d54',1);
   s+=`<ellipse data-motion="vowel" data-singer="${i}" cx="${x}" cy="${Y+20}" rx="4.5" ry="1.6" fill="#513129" style="transform-origin:${x}px ${Y+20}px"/>`;
   s+=path(`M${x-16} ${Y+59}L${x} ${Y+81}L${x+16} ${Y+59}M${x} ${Y+81}V276`,'none','#b5a382',1.6)+path(`M${x-29} 224Q${x} 213 ${x+29} 224L${x+28} 251Q${x} 239 ${x-28} 251Z`,'#dad0ba','#5c5146',1)+l(x,223,x,244,'#998c77',1)+c(x-24,239,5,skin[i])+c(x+24,239,5,skin[i])+'</g>';
  }
 }else if(p.surface==='drum'){
  const cym=['hat','open_hat','ride'].includes(p.id),shaker=['shaker','wood','rim'].includes(p.id);
  if(cym){
   s+=l(302,173,302,290,'#c3c4be',5)+l(302,267,245,304,'#929798',4)+l(302,267,361,304,'#929798',4)+l(302,267,303,312,'#d3d2c5',4);
   s+=`<g ${hit(p.midi)} class="play-part cymbal" data-motion="cymbal" style="transform-origin:300px 145px"><ellipse cx="300" cy="154" rx="182" ry="57" fill="${u('brass')}" stroke="#eaca8b" stroke-width="2"/>`;
   for(let i=0;i<19;i++)s+=`<ellipse cx="300" cy="154" rx="${34+i*7.4}" ry="${11+i*2.4}" fill="none" stroke="${i%2?'#fff0c1':'#634420'}" opacity=".32" stroke-width=".65"/>`;
   s+=`<ellipse cx="300" cy="145" rx="39" ry="17" fill="${u('brass')}"/>${c(300,141,7,'#382f28')}${r(297,120,6,19,u('silver'),2)}</g>`+ring(300,154,184,58);
  }else if(shaker){
   s+=`<g ${hit(p.midi)} class="play-part" data-motion="shaker" style="transform-origin:300px 188px">${wood('M143 125Q123 126 120 150V226Q124 247 145 248H456Q478 246 480 225V146Q478 126 456 125Z',p.id==='wood')}${r(145,150,308,15,'#211d1a',7)}${r(149,179,298,6,'#43291c',3)}${l(152,227,452,227,'#dda365',2)}${r(134,129,9,113,u('brass'),3)}${r(457,129,9,113,u('brass'),3)}</g>`;
  }else{
   s+=l(216,259,194,304,'#a7a7a0',4)+l(384,259,406,304,'#a7a7a0',4);
   s+=c(300,173,117,'#38291f','stroke="#a87a4f" stroke-width="5"')+c(300,173,110,u('silver'))+c(300,173,104,u('skin'),`${hit(p.midi)} class="play-part drum-head" stroke="#87735a" stroke-width="2"`)+c(300,173,98,'none','stroke="#d3c19f" stroke-width="1" pointer-events="none"');
   for(let i=0;i<12;i++){const a=i*Math.PI/6,x=300+115*Math.sin(a),y=173-115*Math.cos(a);s+=`<g transform="rotate(${i*30} ${x} ${y})">${r(x-6,y-7,12,15,'#747a7b',2)}${r(x-4,y-6,8,11,u('silver'),1)}${l(x-3,y-4,x+3,y-4,'#f2ece0',1)}</g>`;}
   s+=label(300,109,'A T E L I E R')+ring(300,173,76,76);
   for(let i=0;i<2;i++)s+=`<g data-motion="stick" data-hand="${i}" style="transform-origin:${i?374:226}px 255px">${l(i?374:226,255,i?249:351,143,'#94643d',5)}${l(i?374:226,254,i?249:351,142,'#e8c48b',2)}${c(i?249:351,142,7,u('ivory'))}</g>`;
  }
 }else{
  s+=path('M60 91H540V268H60Z',u('black'),'#66615a',2)+wood('M44 84H62V273H44Z')+wood('M537 84H555V273H537Z');
  s+=r(80,108,174,83,'#0b0d10',5,'stroke="#68645c" stroke-width="1"');
  for(let i=0;i<7;i++)s+=l(86,120+i*10,247,120+i*10,'#d1a164',.5,'opacity=".16"');
  s+=path('M88 155H102L102 130H121V172H140V130H159V172H178V130H197V172H216V153H247','none','#dfae67',1.8,'data-motion="signal" style="transform-origin:167px 153px"')+label(167,182,p.id.includes('pulse')?'PULSE / OSC':'ANALOG / OSC');
  for(let i=0;i<6;i++){const x=290+i%3*79,y=127+Math.floor(i/3)*47;s+=c(x,y,17,'#0b0d10','stroke="#716960" stroke-width="1"')+c(x,y,12,u('silver'))+c(x,y,9,u('black'))+l(x,y,x+4,y-8,'#efc885',2);}
  s+=path('M365 133Q343 77 423 89Q471 85 449 150','none','#bf754d',3)+path('M291 181Q297 213 363 176','none','#d4b26e',3);
  s+=keyboard(82,209,433,46);for(let i=0;i<8;i++)s+=r(273+i*32,194,20,4,i%3===0?'#e7b469':'#554b3f',1,`data-motion="led" data-led="${i}"`);
  for(const x of[69,527])for(const y of[100,263])s+=screw(x,y);
 }
 s+='</g>';
 return `<svg class="surface atelier-surface" viewBox="0 0 600 340" role="group" data-art-version="3" data-view="front" aria-label="${esc(p.label)}: superficie instrumental expresiva">${defs}${s}</svg>`;
}

// Stable keyed maps prevent event order from becoming a random visual performance.
const Base=V.Stage;
// One attack clock per event. Card and focus view read the same performance state.
function hostNodes(host){return {keys:[...host.querySelectorAll('[data-note]')],motions:[...host.querySelectorAll('[data-motion]')],strings:[...host.querySelectorAll('[data-vibrate]')],surfaces:[...host.querySelectorAll('.atelier-surface')],text:host.querySelector('.readout strong'),meter:host.querySelector('.level i'),trail:host.querySelector('.event-trail')};}
const motionSet=(node,key,value)=>{if(node.style[key]!==value)node.style[key]=value;};
const eventKey=e=>String(e.id??`${e.midi}:${e.until??e.beat}`);
const velocity=e=>M.clamp(e.performedVelocity??e.velocity??.7,0,1);
class AtelierStage extends Base{
 constructor(...args){super(...args);this.motion='soft';this.labels=true;this.history=new Map();this.nodes=new Map();this.lastIds=new Map();this.voices=new Map();this.lastTime=0;this.createControls();}
 createControls(){
  const controls=document.createElement('div');controls.className='atelier-controls';controls.innerHTML='<span class="atelier-kicker">ENSEMBLE / LIVE ROOM</span><div class="atelier-actions"><button id="view-labels" aria-pressed="true">Notas visibles</button><button id="view-motion" aria-pressed="false">Movimiento expresivo</button><button id="view-focus">Ampliar instrumento</button></div>';this.el.before(controls);
  controls.querySelector('#view-labels').onclick=()=>{this.labels=!this.labels;this.el.classList.toggle('hide-pads',!this.labels);controls.querySelector('#view-labels').setAttribute('aria-pressed',String(this.labels));};
  controls.querySelector('#view-motion').onclick=()=>{this.motion=this.motion==='off'?'soft':'off';this.reduced=this.motion==='off'||matchMedia('(prefers-reduced-motion: reduce)').matches;controls.querySelector('#view-motion').textContent=this.motion==='off'?'Movimiento desactivado':'Movimiento expresivo';controls.querySelector('#view-motion').setAttribute('aria-pressed',String(this.motion==='off'));this.refreshMotion();};
  controls.querySelector('#view-focus').onclick=()=>this.focus(this.selected||this.score?.tracks[0]?.id);
  this.dialog=document.createElement('dialog');this.dialog.className='focus-instrument';this.dialog.innerHTML='<div class="focus-head"><div><span class="atelier-kicker">INSTRUMENTO / VISTA AMPLIADA</span><h2></h2></div><button class="focus-close" aria-label="Cerrar vista ampliada">Cerrar ×</button></div><div class="focus-body"></div><p class="hint">Tocá las notas. La animación expresa el ataque y la resonancia; no enseña digitación física. Escape cierra esta vista.</p>';document.body.append(this.dialog);this.dialog.querySelector('.focus-close').onclick=()=>this.dialog.close();this.dialog.addEventListener('click',e=>{if(e.target===this.dialog)this.dialog.close();});
  this.dialog.addEventListener('close',()=>{this.focusTrack=null;this.focusNodes=null;});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&this.dialog.open){e.stopImmediatePropagation();e.preventDefault();this.dialog.close();}},true);
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',e=>{this.reduced=e.matches||this.motion==='off';this.refreshMotion();});
 }
 pads(p,events){let ns=[...new Set(events.map(e=>e.midi))].sort((a,b)=>a-b);if(!ns.length)ns=p.drum?[p.midi]:range(p,[]);return '<div class="note-pads" role="group" aria-label="Alturas tocables">'+ns.map(n=>`<button class="note-pad ${dark(n)?'accidental':''}" data-note="${n}" aria-label="Tocar ${esc(M.noteName(n))}">${esc(M.noteName(n))}</button>`).join('')+'</div>';}
 bind(host,id){host.querySelectorAll('[data-note]').forEach(el=>{const trigger=()=>this.onNote(id,Number(el.dataset.note));if(el.tagName==='BUTTON')el.onclick=trigger;else{el.addEventListener('pointerdown',e=>{e.preventDefault();trigger();});el.addEventListener('keydown',e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();trigger();}});}});}
 build(score,selected){
  super.build(score,selected);this.nodes.clear();this.history.clear();this.lastIds.clear();this.voices.clear();this.lastTime=0;if(this.dialog?.open)this.dialog.close();
  for(const tr of score.tracks){const p=M.resolve(tr.patch),events=score.events.filter(e=>e.track===tr.id),card=this.cards.get(tr.id);card.classList.add('atelier-instrument');card.dataset.surface=p.surface;card.dataset.patch=p.id;card.querySelector('.surface').outerHTML=instrument(p,events);card.querySelector('.surface').insertAdjacentHTML('afterend',this.pads(p,events));
   card.querySelector('.readout span').textContent=`${events.length} eventos · ${p.surface}`;card.querySelector('footer').lastElementChild.textContent='VEL';card.querySelector('.level').setAttribute('title','Velocity activa, no nivel de audio');
   const focus=document.createElement('button');focus.className='expand';focus.textContent='↗';focus.title='Ampliar '+p.label;focus.setAttribute('aria-label','Ampliar '+p.label);focus.onclick=()=>this.focus(tr.id);card.querySelector('.lane-buttons').append(focus);
   card.querySelector('footer').insertAdjacentHTML('beforebegin','<canvas class="event-trail" width="440" height="25" aria-label="Historial de ataques reales, últimos tres segundos"></canvas>');
   this.bind(card,tr.id);const nodes=hostNodes(card);nodes.color=p.color;this.nodes.set(tr.id,nodes);this.history.set(tr.id,[]);this.voices.set(tr.id,new Map());
  }this.state(new Set(),null,selected);this.refreshMotion();
 }
 state(muted,solo,selected){super.state(muted,solo,selected);this.selected=selected;this.muted=muted;this.solo=solo;}
 focus(id){const tr=this.score?.tracks.find(t=>t.id===id);if(!tr)return;this.onSelect(id);this.focusTrack=id;const p=M.resolve(tr.patch),events=this.score.events.filter(e=>e.track===id);this.dialog.style.setProperty('--voice',p.color);this.dialog.querySelector('h2').textContent=tr.label;this.dialog.querySelector('.focus-body').innerHTML=instrument(p,events)+this.pads(p,events);this.bind(this.dialog,id);this.focusNodes=hostNodes(this.dialog);this.dialog.showModal();this.dialog.querySelector('.focus-close').focus();this.refreshMotion();}
 refreshMotion(){for(const n of [...this.nodes.values(),this.focusNodes].filter(Boolean)){for(const svg of n.surfaces)svg.dataset.reduced=String(this.reduced);if(this.reduced)for(const node of [...n.motions,...n.strings]){motionSet(node,'transform','');if(node.dataset.motion==='resonance')motionSet(node,'opacity','0');}}}
 decorate(n,active,time,voices){
  const pitches=new Set(active.map(e=>e.midi)),fretSeen=new Set(),strings=new Set();
  for(const key of n.keys){let on=pitches.has(Number(key.dataset.note));if(key.classList.contains('fret')){if(fretSeen.has(key.dataset.note))on=false;else if(on){fretSeen.add(key.dataset.note);strings.add(Number(key.dataset.string));}}key.classList.toggle('lit',on);}
  let strike=0,latest=null,level=0;
  for(const voice of voices.values()){const age=Math.max(0,time-voice.start);const attack=voice.velocity*Math.exp(-age/ .13);strike=Math.max(strike,attack);const gate=voice.release===null?1:Math.max(0,1-(time-voice.release)/.18);level=Math.max(level,voice.velocity*gate);if(!latest||voice.start>latest.start)latest=voice;}
  const age=latest?Math.max(0,time-latest.start):0,midi=latest?.midi??60,on=active.length>0,amp=on?Math.max(...active.map(velocity)):level;
  const closeMask=[0,7,5,3,1,6,4,2,7,5,3,1][M.mod(midi,12)];
  for(const node of n.motions){const type=node.dataset.motion;let transform='',opacity=null;
   if(type==='resonance'){opacity=this.reduced?'0':String((Math.min(.5,strike*.48)).toFixed(3));if(!this.reduced&&strike>.003)transform=`scale(${(1+Math.min(age,.5)*.3).toFixed(3)})`;}
   else if(type==='signal'){opacity=String((.3+amp*.7).toFixed(3));if(!this.reduced&&on)transform=`scaleY(${(.55+amp*.4+Math.sin(age*13)*.08).toFixed(3)})`;}
   else if(type==='led')opacity=String(on&&Number(node.dataset.led)<=amp*8?1:.2);
   if(!this.reduced&&(amp>.005||strike>.005)){
    if(type==='body')transform=`translateY(${(-strike*1.5).toFixed(2)}px) rotate(${(Math.sin(age*4)*level*.24).toFixed(3)}deg)`;
    else if(type==='bow')transform=`translate(${(Math.sin(age*4.5)*19*amp).toFixed(2)}px,${(-Math.sin(age*4.5)*4*amp).toFixed(2)}px) rotate(${(-strike*1.2).toFixed(2)}deg)`;
    else if(type==='stick'||type==='mallet'){const hand=Number(node.dataset.hand||0),gain=hand===(midi%2)?1:.4;transform=`rotate(${((hand?-1:1)*(-17*strike+5*Math.sin(age*26)*Math.exp(-age*10)*amp)*gain).toFixed(2)}deg)`;}
    else if(type==='cymbal')transform=`rotate(${(Math.sin(age*39)*strike*5).toFixed(2)}deg) scaleY(${(1+Math.sin(age*32)*strike*.035).toFixed(3)})`;
    else if(type==='shaker')transform=`translate(${(Math.sin(age*46)*strike*9).toFixed(2)}px,${(-strike*2).toFixed(2)}px) rotate(${(Math.sin(age*35)*strike*2).toFixed(2)}deg)`;
    else if(type==='bell'){const v=[...voices.values()].filter(v=>v.midi===Number(node.dataset.tone)).at(-1);const hitAge=v?Math.max(0,time-v.start):99;transform=`rotate(${(Math.sin(hitAge*15)*Math.exp(-hitAge*4)* (v?.velocity??0)*7).toFixed(2)}deg)`;}
    else if(type==='valve')transform=`translateY(${on&&(closeMask&(1<<Number(node.dataset.hole)))?5:0}px)`;
    else if(type==='keycup'||type==='hole'){const closed=on&&M.mod(midi+Number(node.dataset.hole)*2,12)<7;transform=closed?'translateY(1.4px) scale(.91)':'';}
    else if(type==='slide')transform=`translateX(${(on?(M.mod(72-midi,12)-5)*6:0).toFixed(1)}px)`;
    else if(type==='bellows')transform=`scaleX(${(1+Math.sin(age*2.8)*level*.055).toFixed(4)})`;
    else if(type==='accordion-left'||type==='accordion-right')transform=`translateX(${(Math.sin(age*2.8)*level*7*(type==='accordion-left'?-1:1)).toFixed(2)}px)`;
    else if(type==='vowel')transform=`scale(${(1+amp*.17).toFixed(3)},${(1+amp*1.8).toFixed(3)})`;
    else if(type==='singer')transform=`translateY(${(-level*(1.3+Math.sin(age*2.1+Number(node.dataset.singer))*.6)).toFixed(2)}px)`;
   }
   motionSet(node,'transform',transform);if(opacity!==null)motionSet(node,'opacity',opacity);
  }
  for(const string of n.strings){let sounding=pitches.has(Number(string.dataset.note))||strings.has(Number(string.dataset.vibrate));if(!string.hasAttribute('data-open-note')&&!string.hasAttribute('data-note'))sounding=on;const move=!this.reduced&&sounding?Math.sin(age*(35+Number(string.dataset.vibrate)%6))*Math.max(strike*.8,level*.13):0;motionSet(string,'transform',Math.abs(move)>.002?`translate${'X'}(${move.toFixed(3)}px)`:'');}
 }
 update(events,time){
  if(!Number.isFinite(time))return;
  if(time<this.lastTime){this.history.forEach(a=>a.splice(0));this.lastIds.clear();this.voices.forEach(v=>v.clear());}this.lastTime=time;
  const lanes=new Map();for(const e of events){if(this.muted?.has(e.track)||(this.solo&&this.solo!==e.track))continue;if(!lanes.has(e.track))lanes.set(e.track,[]);lanes.get(e.track).push(e);}
  for(const[id,card]of this.cards){const active=lanes.get(id)||[],n=this.nodes.get(id),voices=this.voices.get(id),hist=this.history.get(id);if(!n)continue;
   const ids=new Set(active.map(eventKey)),previous=this.lastIds.get(id)||new Set();
   for(const e of active){const key=eventKey(e);if(!previous.has(key)){voices.set(key,{start:time,release:null,midi:e.midi,velocity:velocity(e)});hist.push({time,midi:e.midi,velocity:velocity(e)});}else if(voices.has(key))voices.get(key).release=null;}
   for(const[key,v]of voices){if(!ids.has(key)&&v.release===null)v.release=time;if(v.release!==null&&time-v.release>.6)voices.delete(key);}
   this.lastIds.set(id,ids);const ns=[...new Set(active.map(e=>e.midi))],text=ns.length?ns.slice(0,5).map(M.noteName).join(' · '):'—';if(n.text.textContent!==text)n.text.textContent=text;
   const amp=active.reduce((v,e)=>Math.max(v,velocity(e)),0);motionSet(n.meter,'transform',`scaleX(${amp.toFixed(3)})`);card.classList.toggle('sounding',active.length>0);this.decorate(n,active,time,voices);
   while(hist.length&&time-hist[0].time>3)hist.shift();const ctx=n.trail.getContext('2d'),w=n.trail.width,h=n.trail.height;ctx.clearRect(0,0,w,h);ctx.strokeStyle='#b5aa8b29';ctx.beginPath();ctx.moveTo(0,h-2);ctx.lineTo(w,h-2);ctx.stroke();ctx.fillStyle=n.color;
   for(const e of hist){ctx.globalAlpha=1-(time-e.time)/3;ctx.fillRect(w-5-(time-e.time)*w/3,h-3-e.velocity*16,3,Math.max(2,e.velocity*16));}ctx.globalAlpha=1;
   if(this.dialog.open&&this.focusTrack===id&&this.focusNodes)this.decorate(this.focusNodes,active,time,voices);
  }
 }
}

V.Stage=AtelierStage;root.Atelier={instrument,range,AtelierStage};
})(globalThis);
/* Actual post-master waveform. Instrument meters above are velocity, not audio. */
Atelier.createScope=function(toolbar){'use strict';const host=document.createElement('div');host.className='master-scope';host.innerHTML='<canvas width="200" height="32" aria-label="Forma de onda real de la salida del sintetizador"></canvas><span>SALIDA / — dBFS</span>';toolbar.after(host);const cv=host.querySelector('canvas'),ctx=cv.getContext('2d'),label=host.querySelector('span');let values=null,peakHold=0;
Atelier.scope=function(sound){ctx.clearRect(0,0,200,32);ctx.strokeStyle='#a9b89c';ctx.lineWidth=1;ctx.beginPath();let peak=0;if(sound.analyser){if(!values||values.length!==sound.analyser.fftSize)values=new Float32Array(sound.analyser.fftSize);sound.analyser.getFloatTimeDomainData(values);for(let i=0;i<200;i++){let v=values[Math.floor(i*values.length/200)];peak=Math.max(peak,Math.abs(v));if(i===0)ctx.moveTo(0,16-v*64);else ctx.lineTo(i,16-v*64);}}else{ctx.moveTo(0,16);ctx.lineTo(200,16);}ctx.stroke();peakHold=Math.max(peak,peakHold*.9);label.textContent='SALIDA / '+(peakHold>1e-5?(20*Math.log10(peakHold)).toFixed(1):'—')+' dBFS';};
};
