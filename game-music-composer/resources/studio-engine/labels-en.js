/* English labels for the studio engine. The engine keeps its source identifiers;
   the Create view shows these names. Missing entries fall back to the engine label. */
(function(root){
'use strict';
const labels={
 tracks:{kick:'Kick',snare:'Snare',hat:'Hi-hat',open:'Open hat',perc:'Percussion',bass:'Bass',keys:'Chords',pad:'Pad',arp:'Arpeggio',lead:'Melody'},
 sounds:{
  kickRound:'Round kick',kick808:'Long 808 kick',kickTight:'Tight kick',snareDust:'Tape snare',snareBrush:'Synth brush',clap:'Analog clap',
  hatSoft:'Soft hi-hat',hatMetal:'Metallic hi-hat',shaker:'Noise shaker',openSoft:'Velvet open hat',openMetal:'Metallic open hat',
  rim:'Dry rim',conga:'Synth conga',wood:'Wood block',cowbell:'Analog cowbell',sub:'Warm sub',analog:'Analog bass',fmbass:'FM bass',acid:'Resonant bass',
  electric:'FM electric piano',softkeys:'Felt keys',organ:'Harmonic organ',pluck:'Plucked string',tape:'Tape pad',strings:'Analog strings',choir:'Synth voice',
  glass:'FM glass',bell:'Soft bell',marimba:'Synth marimba',chip:'25% pulse',sinelead:'Expressive sine',flute:'Synth flute',reed:'Analog reed',
  kick909:'909 kick',kickDeep:'Deep sub kick',kickPunch:'Impact kick',snare909:'Crisp 909 snare',snareRoom:'Synth acoustic snare',clapWide:'Wide clap',
  hat909:'909 hi-hat',hatGrain:'Grainy hi-hat',open909:'909 open hat',ride:'Modal ride',tom:'Tuned tom',tabla:'Synth tabla',claves:'Resonant claves',metalPerc:'Metal percussion',
  reese:'Reese bass',rubber:'Rubber bass',organbass:'Drawbar bass',velvetEP:'Velvet electric piano',pianoModal:'Modal piano',dulcimer:'Hammered strings',nylon:'Warm nylon pluck',
  pwmPad:'Pulse pad',airPad:'Air pad',supersaw:'Saw ensemble',fmPluck:'Dynamic FM pluck',kalimba:'Modal kalimba',brass:'Analog brass',syncLead:'Harmonic lead',
  kick7:'Kick · body / transient',snare7:'Snare · head / wires',mono7:'Mono bass · legato',ep7:'Electric piano · expressive'
 },
 presets:{
  nocturne:'Magnetic nocturne',dub:'Underwater echoes',micro:'Night geometry',bossa:'Mercury patio',ambient:'Glass horizon',garage:'Dawn platform',
  electro:'Oblique circuit',broken:'Imperfect orbit',soul:'Lunar velvet',ritual:'Circle of ash',cinema:'Empty architecture',chip:'Pocket satellite',
  techno:'Orbital steel',dubtechno:'Submerged concrete',minimal:'Tiny pieces',melodic:'Lines of flight',trance:'Photons',dnb:'Undercurrent',
  jungle:'Jungle fragments',liquid:'Neon water',halftime:'Suspended mass',trap:'Low gravity',lofi:'Solar dust',synthwave:'Violet highway',
  disco:'Mercury disco',funk:'Chrome spring',jazz:'Impossible quartet',afro:'Electric wood',reggaeton:'Warm asphalt',footwork:'Impossible steps',
  idm:'Garden of errors',breakbeat:'Elastic tension'
 },
 presetNotes:{
  nocturne:'Slow trip-hop. Dark keys, a round sub and drums with room to breathe.',dub:'Deep dub. Organ offbeats, a slow bass and filtered stereo echoes.',
  micro:'Restrained microhouse. Steady kick, small syncopations and short felt chords.',bossa:'Electronic bossa. Plucked strings, synth congas and flute lines between silences.',
  ambient:'Bright ambient. Long chords, glass resonances and barely-there percussion.',garage:'UK garage. Shifted kick, swung hats and short answering phrases.',
  electro:'Clean electro. Resonant bass, metallic percussion and an angular arpeggio.',broken:'Broken beat. Interlocking percussion, electric piano and a bass that dodges the beat.',
  soul:'Pocket neo-soul. Ninth chords, ghost notes and a short motif over a relaxed pulse.',ritual:'Modal ritual. Euclidean pulses, resonant wood and a suspended synth voice.',
  cinema:'Dark cinema. Harmonic minor, spaced basses and layers that arrive without hurry.',chip:'Expressive chiptune. Narrow pulses, broken chords and clear melodic contours.',
  techno:'Techno: a punchy kick, short stabs and an ostinato that changes register.'
 },
 genres:{trip:'Trip-hop',dub:'Dub',house:'Microhouse',bossa:'Electronic bossa',ambient:'Ambient',garage:'UK garage',electro:'Electro',broken:'Broken beat',soul:'Neo-soul',ritual:'Modal ritual',cinema:'Cinematic',chip:'Chiptune',techno:'Techno',dubtechno:'Dub techno',minimal:'Minimal',melodic:'Melodic house',trance:'Trance',dnb:'Drum & bass',jungle:'Jungle',liquid:'Liquid DnB',halftime:'Halftime',trap:'Trap',lofi:'Lo-fi hip-hop',synthwave:'Synthwave',disco:'Nu-disco',funk:'Electro-funk',jazz:'Chamber jazz',afro:'Afro house',reggaeton:'Electronic dembow',footwork:'Footwork',idm:'IDM',breakbeat:'Breakbeat'},
 scales:{minor:'Natural minor',major:'Major',dorian:'Dorian',phrygian:'Phrygian',lydian:'Lydian',mixolydian:'Mixolydian',harmonic:'Harmonic minor',melodic:'Melodic minor',pentminor:'Minor pentatonic',pentmajor:'Major pentatonic',whole:'Whole tone',locrian:'Locrian',doubleharmonic:'Double harmonic',hungarian:'Hungarian minor',hirajoshi:'Hirajōshi',insen:'Insen',blues:'Minor blues',lydianDom:'Lydian dominant',phrygianDom:'Phrygian dominant'},
 progressions:{
  nocturne:'Nocturne · I–VI–III–VII',home:'Home · I–IV–V–I',falling:'Falling · I–VII–VI–V',drift:'Drift · I–IV–I–VI',soul:'Circle · II–V–I–VI',lift:'Lift · I–V–VI–IV',
  modal:'Modal · I–II–I–VII',orbit:'Orbit · I–III–VI–IV',pedal:'Pedal · I–I–IV–I',tension:'Suspense · I–VI–IV–V',custom:'Custom · edit the cards',
  pendulum:'Modal pendulum · I–IV',pedal2:'Open pedal · I–VII',dorianLift:'Dorian · i9–IV9',minorTwoFive:'Minor jazz · iiø–V7–i9–VImaj7',jazzTurn:'Turnaround · Imaj7–VI7–ii7–V7',
  backdoor:'Backdoor · Imaj9–iv7–♭VII9–Imaj9',tritone:'Tritone sub · ii9–♭II7–Imaj9–VI7',andalusian:'Andalusian · i–♭VII–♭VI–V',borrowed:'Modal mixture · I–iv–♭VI–V7',
  chromatic:'Chromatic mediants · i–♭VI–iii–V',neo:'Film transforms · i–VI–vi–III',dream:'Suspended dream · Imaj9–IIImaj7–IVmaj9–iv6',chainDom:'Chained dominants · III7–VI7–II7–V7',
  gospel:'Gospel rise · I6–III7–vi7–IVmaj9',houseSoul:'House ninths · i9–♭IIImaj9–♭VII9–iv9',susOrbit:'Sus orbit · Isus2–♭VIsus2–IVsus4–Vsus4',phrygianGate:'Phrygian gate · i–♭II–i–♭VII',
  fifths:'Circle of fifths · 8 chords',pop8:'Pop journey · 8 chords',minor8:'Minor story · 8 chords',jazz8:'Jazz circle · 8 chords',blues12:'Dominant blues · 12 chords',
  minorBlues:'Minor blues · 12 chords',slowMajor:'Contemplative · I–III–IV–I',subdominant:'Subdominant · IV–I–II–V',rising:'Diatonic rise · I–II–III–IV'
 },
 patterns:{drum:{preset:'Preset groove',euclid:'Euclidean / 16',four:'Four on the floor',half:'Half time',broken:'Broken',sparse:'Sparse'},bass:{sync:'Root + syncopation',root:'Held root',walking:'Walking bass',octaves:'Octaves',pulse:'Steady pulse'},keys:{sustain:'Held chord',stabs:'Syncopated stabs',offbeat:'Offbeats',broken:'Broken chord'},pad:{sustain:'Held cloud',breath:'Breathing'},arp:{up:'Up',down:'Down',pendulum:'Pendulum',skip:'Skipping thirds',random:'Seeded order',euclid:'Euclidean / 16'},lead:{phrase:'Motif + answer',call:'Call and rest',sparse:'Suspended notes',cascade:'Melodic cascade'}},
 arpModes:{up:'Up',down:'Down',updown:'Up-down',downup:'Down-up',converge:'Converge',diverge:'Diverge',thirds:'Thirds',pinky:'Top pedal',thumb:'Bottom pedal',random:'Seeded random',walk:'Bounded walk',chord:'Repeated chord'},
 arpRates:{'4':'1/4','8':'1/8','16':'1/16','32':'1/32','8t':'1/8 triplet','16t':'1/16 triplet','8d':'1/8 dotted'},
 performanceModes:{original:'Written notes',arp:'Arpeggio',chop:'Chop',hybrid:'Arpeggio → chop'},
 templateGroups:{'Dirección':'Direction','Oscilación':'Oscillation','Repetición':'Repeats','Ritmo':'Rhythm','Síncopa':'Syncopation','Floritura':'Flourish','Capas':'Layers','House':'House','Lento':'Slow','Transformación':'Morph','UMBRA / laboratorio':'Studio lab','Pulsos':'Pulses','Trance':'Trance','Stabs':'Stabs','Pads':'Pads','Divisiones':'Divisions'},
 finishes:{none:'Neutral',balanced:'Balanced',warm:'Warm',open:'Open'},
 structures:{loop:'Loop',journey:'Journey'},
 voicings:{triad:'Triads',seventh:'Sevenths',ninth:'Ninths',sus:'Sus',sus4:'Sus4',sixth:'Sixths',add9:'Add9',eleventh:'Elevenths',power:'Power'},
 reverbKinds:{room:'Room',plate:'Plate',hall:'Hall',cavern:'Cavern'},
 macros:{energy:'Energy',tension:'Tension',space:'Space',movement:'Movement'},
 sectionNames:{'Tema A':'Theme A','Tema B':'Theme B','Variación A′':'Variation A′','Ruptura':'Break','Cierre':'Ending','Intro':'Intro','Desarrollo':'Development','Sección':'Section','copia':'copy'},
 automationParams:{volume:'Volume',pan:'Pan',cutoff:'Filter',send:'Reverb',delay:'Delay',phaser:'Phaser',chorus:'Chorus',reverb:'Reverb'},
 // Studio catalog category that best fits each engine genre (Open in Studio).
 genreCategory:{trip:'trip_hop',dub:'trip_hop',house:'house',micro:'house',melodic:'house',afro:'house',disco:'house',bossa:'bossa_nova',ambient:'adventure',garage:'electronic',electro:'electronic',broken:'electronic',soul:'urban',jazz:'urban',ritual:'fantasy',cinema:'emotion',chip:'electronic',techno:'electronic',dubtechno:'electronic',minimal:'electronic',trance:'electronic',dnb:'dnb',jungle:'dnb',liquid:'dnb',halftime:'dnb',trap:'trap',lofi:'lofi',synthwave:'synthwave',funk:'funk',reggaeton:'reggaeton',footwork:'electronic',idm:'electronic',breakbeat:'electronic'},
 // Words of the engine's generated song names.
 nameWords:{'Órbita':'Orbit','Luz':'Light','Materia':'Matter','Memoria':'Memory','Noche':'Night','Horizonte':'Horizon','Pulso':'Pulse','Estación':'Station','Silencio':'Silence','Cristal':'Crystal','Sombra':'Shadow','Tiempo':'Time',
  'de mercurio':'of mercury','en suspensión':'suspended','oblicua':'oblique','del subsuelo':'underground','de madrugada':'at dawn','entre líneas':'between lines','de neón':'of neon','en tránsito':'in transit','sin gravedad':'without gravity','de vidrio':'of glass','bajo el agua':'underwater','distante':'far away',
  'Obsidiana':'Obsidian','Fósforo':'Phosphor','Interferencia':'Interference','Carbón':'Carbon','Vértigo':'Vertigo','Prisma':'Prism','en órbita':'in orbit','fragmentado':'fragmented','de medianoche':'at midnight','en expansión':'expanding','sin centro':'without center','de cristal':'of crystal',
  'Antes de generar':'Before generating','Versión':'Version'},
 messages:[
  [/^Clip desacoplado\. Sigue disponible en la biblioteca\.$/,'Clip detached. It stays in the library.'],
  [/^Clip seleccionado\.$/,'Clip selected.'],[/^Copia independiente creada\.$/,'Independent copy created.'],
  [/^Interpretación convertida en notas independientes\. La fuente sigue guardada\.$/,'Interpretation baked into independent notes. The source clip is kept.'],
  [/^Intro, temas, ruptura y cierre creados con material independiente\.$/,'Intro, themes, break and ending created with independent material.'],
  [/^La estructura se añade después de las secciones existentes\.$/,'The structure is added after the existing sections.'],
  [/^Sección independiente creada\.$/,'Independent section created.'],[/^Duración de sección inconsistente\.$/,'A section needs an allowed length with at least one bar per chord.'],[/^Sección inválida\.$/,'Unknown section.'],[/^Transformación aplicada; anclas conservadas\.$/,'Transformation applied; anchors kept.'],
  [/^Versión (.) guardada\. La sesión sigue intacta\.$/,'Idea $1 saved. The session is unchanged.'],[/^Versión (.) cargada\. Deshacer recupera la anterior\.$/,'Idea $1 loaded. Undo brings back the previous song.'],
  [/^Armonía renovada\. Acordes y pistas bloqueados conservados\.$/,'New chords. Locked chords and tracks are kept.'],[/^Alternativa aplicada al acorde (\d+)\.$/,'Alternative applied to chord $1.'],
  [/^(\d+) clips sin uso eliminados\. Deshacer permite recuperarlos\.$/,'$1 unused clips removed. Undo brings them back.'],
  [/^No es un proyecto UMBRA v1–v8 válido\..*$/,'This is not a valid project file (UMBRA v1–v8 or GMC Create).'],
  [/^El render supera .*180 segundos.*$/,'The render exceeds 180 seconds. Use fewer loops or bars.'],[/^El (arreglo|render) supera 18\.000 voces.*$/,'The render exceeds 18,000 voices. Reduce repeats, ratchets or arpeggiated tracks.'],
  [/^Elegí al menos un grupo de parámetros\.$/,'Choose at least one group to vary.'],[/^Escribí una semilla de 1 a 64 caracteres\.$/,'Write a seed of 1 to 64 characters.'],
  [/^La semilla debe tener entre 1 y 64 caracteres\.$/,'The seed must have 1 to 64 characters.'],[/^Escribí entre 2 y 12 acordes.*$/,'Write 2 to 12 chords separated by | or commas.'],
  [/^Acorde (\d+): Raíz no reconocida: «(.*)»\.$/,'Chord $1: unknown root “$2”.'],[/^Acorde (\d+): Acorde no reconocido: «(.*)».*$/,'Chord $1: unknown chord “$2”. Use Cmaj7 or IΔ7.'],
  [/^Acorde (\d+): Extensión no reconocida en «(.*)»: (.*)$/,'Chord $1: unknown extension in “$2”: $3'],
  [/^No hay espacio para seis secciones más\.$/,'There is no room for six more sections.'],[/^Esta vista admite hasta 12 secciones\.$/,'A song holds up to 12 sections.'],
  [/^Todas las pistas están bloqueadas\..*$/,'Every track is locked. Unlock one, or turn off “respect locks”.'],
  [/^No quedan parámetros disponibles para transformar\.$/,'Nothing is left to transform.'],[/^La pista de destino está bloqueada\.$/,'The destination track is locked.'],
  [/^Límite de 160 clips\..*$/,'Limit of 160 clips. Remove unused clips first.'],[/^Exportación cancelada\.$/,'Export cancelled.'],
  [/^Este navegador no permite renderizar audio offline\.$/,'This browser cannot render audio offline.'],[/^Se detectó una muestra no válida en el render\..*$/,'The render produced an invalid sample. The file was not saved.'],
  [/^La sesión excede 180 s o 350 MB estimados\..*$/,'The stems session exceeds 180 s or an estimated 350 MB. Shorten the song or export one stem type.']
 ]
};
function name(group,id,fallback){return labels[group]?.[id]??fallback??id;}
// Engine messages and generated names are Spanish; unknown text passes through unchanged.
function message(text){for(const [re,out] of labels.messages)if(re.test(text))return text.replace(re,out);return text;}
function songName(text){if(!text)return text;let out=text;for(const [es,en] of Object.entries({...labels.nameWords,...labels.sectionNames}).sort((a,b)=>b[0].length-a[0].length))out=out.split(es).join(en);return out;}
const api={labels,name,message,songName};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.GMCLabels=api;
})(globalThis);
