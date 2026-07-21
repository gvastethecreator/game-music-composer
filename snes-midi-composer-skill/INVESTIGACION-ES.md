# Investigación y diseño de la skill SNES MIDI Composer

## 1. Conclusión principal

Componer “música de SNES” no consiste en generar un MIDI y reproducirlo con un soundfont retro. La Super Nintendo utilizaba un subsistema de audio basado en **reproducción de muestras**: ocho voces del S-DSP, muestras comprimidas en BRR, envolventes, paneo estéreo, ruido, modulación de pitch y un sistema de eco con filtro FIR. El carácter final surge de la interacción entre:

1. composición;
2. arreglo limitado por voces;
3. selección y preparación de muestras;
4. loops de muestra;
5. envolventes y articulaciones;
6. pitch y vibrato;
7. paneo;
8. eco;
9. restricciones de memoria y del driver.

Por eso la skill separa el **contenido simbólico** —notas, forma, armonía y ritmo— de la **interpretación tímbrica** y del **renderizador**.

Fuentes técnicas principales:

- https://snes.nesdev.org/wiki/S-SMP
- https://snes.nesdev.org/wiki/S-DSP_registers
- https://snes.nesdev.org/wiki/BRR_samples
- https://samplemance.rs/snesguide/

## 2. Restricciones que cambian la forma de componer

### Ocho voces reales

La consola mezcla ocho voces. Una melodía, un bajo, dos notas de armonía, kick, snare, hi-hat y un pad ya pueden consumir el total. Además, una nota que está en su fase de release todavía ocupa una voz. En un juego también es normal reservar una o dos voces para efectos sonoros.

Consecuencias musicales:

- los acordes completos no deben darse por sentados;
- la melodía y el bajo ayudan a definir el acorde;
- se priorizan díadas, arpegios, pedales y contrapunto;
- se alternan acordes y melodía en vez de superponer todo;
- se eliminan duplicaciones que no agregan información;
- los releases largos deben considerarse en el presupuesto.

### 64 KiB de Audio RAM compartida

En el sistema real, la memoria contiene driver, datos de secuencia, directorio de muestras, muestras BRR, estado de trabajo y buffer de eco. No existe un presupuesto universal porque depende del driver, pero una skill seria debe estimarlo y declarar margen.

### BRR

Cada bloque BRR representa 16 muestras decodificadas en 9 bytes. Los puntos de loop deben respetar fronteras de 16 muestras. Esto favorece:

- transientes breves más loops pequeños;
- muestras mono;
- reducción consciente de sample rate;
- reutilización de una muestra en varios roles;
- root keys y rangos limitados;
- bancos pequeños, expresivos y documentados.

### Salida nominal de 32 kHz e interpolación gaussiana

Las muestras no ganan calidad por prepararse por encima de lo que el sistema puede reproducir. La interpolación y el pitch alteran brillo y aliasing; una misma muestra puede volverse opaca hacia abajo y agresiva hacia arriba. El banco debe probar cada instrumento en sus extremos de rango.

### Eco FIR

El eco no es sólo “reverb retro”: utiliza memoria, puede activarse por voz y cambia la profundidad, el color y la continuidad del loop. En la web se puede aproximar con delay, feedback y filtro; para fidelidad mayor corresponde un núcleo S-DSP en WebAssembly/AudioWorklet.

## 3. No existe un banco de instrumentos SNES universal

La consola no trae piano, cuerdas, brass o batería como General MIDI. Cada producción podía utilizar:

- grabaciones acústicas compactas;
- módulos orquestales y pop de la época;
- sintetizadores y ondas de ciclo único;
- cajas de ritmo y percusión sampleada;
- voces, guitarras, foley y ambientes propios;
- ruido y formas de onda sintéticas;
- timbres transformados hasta volverse ambiguos.

Esto es crucial para los agentes. Conviene describir un sonido por su función y comportamiento:

> lead monofónico respirado, ataque medio, loop granular estable, vibrato tardío, paneo cercano al centro y eco oscuro

Eso es más útil que pedir simplemente “saxofón SNES”.

El compositor David Wise explicó que, bajo el límite de memoria, utilizó materiales cortos, ideas inspiradas en wave sequencing, información programada de envolvente/pitch/LFO y artefactos de truncamiento como parte del diseño tímbrico. La enseñanza transferible es que **un material mínimo y evolutivo puede resultar más expresivo que una muestra realista grande**.

Fuente:

- https://www.squareenixmusic.com/features/interviews/davidwise.shtml

## 4. Lenguaje compositivo que la skill debe enseñar

No hay una armonía única de SNES. El catálogo de la consola contiene JRPG orquestal, funk, jazz, rock, ambient, industrial, horror, pop y electrónica. La autenticidad no debe definirse por una progresión específica, sino por una combinación de buena escritura para videojuegos y economía de recursos.

### Motivo

La skill obliga a crear un motivo primario de 1–2 compases y un motivo de respuesta. El motivo debe sobrevivir:

- cambio de instrumento;
- reducción de fidelidad;
- repetición prolongada;
- transposición o cambio de registro;
- transformación rítmica;
- reharmonización.

Transformaciones recomendadas:

- secuencia;
- desplazamiento rítmico;
- respuesta con otra cadencia;
- transferencia de registro;
- aumento/disminución;
- inversión parcial;
- cambio de bajo;
- relevo entre instrumentos.

### Armonía económica

Principios:

- melodía + bajo pueden definir gran parte del acorde;
- omitir quintas antes que terceras, séptimas o notas de color;
- usar una o dos voces internas;
- arpegiar para serializar acordes;
- usar pedales para sostener continuidad;
- diseñar voice leading antes de sumar capas;
- considerar los últimos dos compases y los primeros dos como una sola frase circular.

### Bajo

Debe tener lógica propia, no sólo raíces mecánicas. Puede usar:

- raíz–quinta–aproximación;
- anticipaciones;
- pedal con movimiento cromático superior;
- octavas sincopadas;
- walking fragments;
- corcheas repetidas para combate;
- notas largas para ambient.

### Percusión

Por su costo de voces, conviene priorizar:

- kick;
- snare/clap;
- hat/shaker;
- un color adicional: tom, impacto o cymbal breve.

Las variaciones deberían surgir primero por omisión, desplazamiento y velocity groups; no por agregar más samples simultáneos.

### Forma y loop

Formas útiles:

```text
A 8 → A' 8 → B 8 → retorno 8
A 4 → B 4 → A' 4 → turnaround 4
intro 2–4 → A 8 → A' 8 → B 8 → pickup
```

Un loop puede terminar:

- abierto, con dominante/sus/pickup;
- estable, en tónica, si el gameplay acepta un reinicio claro;
- oculto bajo drone/ambiente;
- conectado por una línea de bajo o contrapunto.

No conviene cerrar con una gran cadencia o crash que anuncie “fin” salvo que ese reinicio sea intencional.

## 5. Blueprints incluidos

La skill contiene perfiles para:

- pueblo o zona segura JRPG;
- overworld/aventura;
- combate;
- boss/progresivo;
- dungeon/horror;
- sueño/agua/cristal;
- bosque/ruinas;
- platformer/funk;
- industrial/mecánico;
- melancolía/memoria.

Cada blueprint define rangos de tempo, recursos armónicos, groove, forma, roles de voces, timbres y anti-patrones. Se permite combinar hasta tres, pero el agente debe declarar qué toma de cada uno.

## 6. Banco de instrumentos

Cada instrumento debe registrar:

- ID estable;
- programa MIDI;
- rol;
- root key;
- rango recomendado;
- sample rate;
- one-shot o loop;
- puntos de loop y alineación;
- ADSR/GAIN aproximado;
- volumen, paneo y envío a eco;
- tamaño BRR estimado;
- receta procedural o path de muestra;
- autor, origen, licencia y modificaciones.

La skill incluye recetas para:

- flute/ocarina/whistle;
- reed o lead ambiguo;
- strings/pad;
- pizzicato/harp/dulcimer/mallet;
- brass;
- choir/glass;
- pulse/square/saw;
- bass;
- kick, snare, hat y tom;
- wind/machinery/ambience.

## 7. Contrato MIDI + JSON

MIDI es útil para interoperabilidad, pero no representa de forma nativa:

- muestras BRR;
- loops de muestra;
- memoria ARAM;
- coeficientes FIR;
- política de voice stealing;
- parámetros exactos de ADSR/GAIN del S-DSP;
- procedencia de assets.

Por eso cada entrega incluye:

- `song.mid` — SMF tipo 1;
- `song.json` — espejo determinista de eventos;
- `instrument-bank.json`;
- `composition-brief.json`;
- `style-profile.json` cuando hay referencias;
- `song-plan.json`;
- reporte de validación;
- reproductor o integración web.

El MIDI utiliza una pista conductor con tempo, métrica, secciones y `[LOOP_START]` / `[LOOP_END]`. Cada rol musical tiene pista, canal, programa y estado inicial de controladores.

## 8. Reproducción web

### Nivel práctico

Web Audio API permite:

- `AudioBufferSourceNode` para muestras;
- `playbackRate` para pitch;
- `GainNode` para envolventes;
- `StereoPannerNode` para paneo;
- delay + feedback + filtro para eco aproximado;
- scheduler temporal;
- voice allocator.

Tone.js puede facilitar transport, scheduling y efectos, y `@tonejs/midi` simplifica lectura/escritura de MIDI. La demo incluida evita dependencias: parsea el SMF directamente y genera buffers procedurales a 32 kHz.

Fuentes:

- https://www.w3.org/TR/webaudio/
- https://tonejs.github.io/
- https://github.com/Tonejs/Midi

### Nivel fiel

Para aproximación hardware real:

- núcleo S-DSP/SPC en WebAssembly;
- scheduling desde AudioWorklet;
- BRR real;
- ADSR/GAIN discreto;
- interpolación gaussiana;
- eco FIR;
- voice stealing y timing del driver.

La skill diferencia explícitamente “estética SNES” de “hardware probado”.

## 9. Herramientas y recursos

### Terrific Audio Driver

Driver homebrew con MML, SFX, envolventes, vibrato/portamento, eco y exportación orientada a SPC. Es una ruta moderna para convertir una composición a un entorno real de SNES.

- https://github.com/undisbeliever/terrific-audio-driver

### BRRtools

Conversión WAV↔BRR, resampling, loops y simulación del filtrado gaussiano.

- https://github.com/Optiroc/BRRtools

### C700

Workflow DAW/MIDI orientado al SPC/SNES.

- https://github.com/osoumen/C700

### Furnace

Tracker abierto con chip de muestras SNES, MIDI input, edición de samples y loop points. Resulta útil para composición y audition, aunque cualquier export final debe verificarse según el formato/driver objetivo.

- https://github.com/tildearrow/furnace

### chipsynth SFC

Herramienta comercial enfocada en emulación y diseño de instrumentos SNES.

- https://www.plogue.com/products/chipsynth-sfc.html

El catálogo machine-readable completo está en `resources/source-catalog.json`.

## 10. Seguridad legal y de datos

La skill no incluye samples extraídos de juegos comerciales, ROMs ni melodías de soundtracks. La política por defecto acepta:

- síntesis procedural;
- grabaciones propias;
- CC0;
- assets con licencia explícita;
- archivos aportados por el usuario con permiso documentado.

Para análisis estilístico, el agente debe extraer rasgos abstractos —contorno, groove, densidad, registros, articulación, forma— sin conservar ni reproducir pasajes identificables.

## 11. Arquitectura recomendada para agentes

```text
Brief normalizer
      ↓
Style analyst ──────────────┐
      ↓                     │
Motif + harmony designer    │
      ↓                     │
Rhythm designer             │
      ↓                     │
Voice-budget orchestrator ←─┘
      ↓
Instrument-bank designer
      ↓
MIDI/JSON compiler
      ↓
Loop + polyphony + memory validators
      ↓
Web renderer / hardware export adapter
      ↓
Audition and revision
```

Los sub-agentes no deberían editar archivos MIDI por separado. Deben proponer cambios a un estado compartido y dejar una única etapa de orquestación/compilación como autoridad final.

## 12. Qué valida el ejemplo incluido

`Forest at Night` es un BGM original de 16 compases, 92 BPM y D Dorian.

- 7 voces musicales centrales;
- 1 voz reservada para SFX;
- 377 notas/eventos musicales;
- 41,739 segundos por loop;
- MIDI tipo 1, PPQ 480;
- banco procedural CC0;
- estimación hardware de 63.832 / 65.536 bytes;
- colas de release del navegador auditadas por separado;
- reproductor Web Audio sin dependencias;
- parser MIDI probado contra el archivo incluido.

No se presenta como export `.spc` ni como emulación S-DSP cycle-accurate. Es una prueba completa del contrato de composición, datos, validación y reproducción web.

## 13. El género debe modelarse como espacio multidimensional

Una clasificación plana como `terror`, `acción` o `aventura` es insuficiente. Dos escenas del mismo género pueden requerir comportamientos opuestos. La skill amplía cada encargo mediante:

- familia y subdivisión narrativa;
- mood principal y moods secundarios;
- energía;
- tensión;
- dominancia o agencia percibida;
- certeza tonal;
- intimidad/escala;
- brillo;
- contexto de gameplay;
- arco temporal;
- idioma musical;
- entorno y modificadores de escena.

La separación entre **energía**, **tensión** y **dominancia** es decisiva. Un pasillo vacío puede tener energía baja y tensión altísima; un power fantasy puede tener energía y tensión altas, pero dominancia positiva; una persecución de survival horror usa energía alta y dominancia fuertemente negativa.

Los modelos de emoción musical revisados apoyan el uso de dimensiones continuas de valence/arousal, y los modelos PAD agregan dominancia para diferenciar estados que de otro modo quedarían demasiado cerca. La taxonomía de la skill agrega certeza tonal e intimidad porque son controles compositivos y espaciales útiles, no porque sean emociones básicas.

## 14. Cues musicales y su uso práctico

Los estudios sobre comunicación emocional señalan que ninguna variable trabaja sola. Tempo, modo, articulación, pitch, dinámica, brillo e instrumentación se combinan. En la práctica de la skill:

- **modo y armonía** inclinan valencia y certeza;
- **articulación** cambia actividad, agresión y claridad;
- **tempo + subdivisión** regulan energía;
- **registro y pitch** afectan fragilidad, brillo y escala;
- **dinámica y densidad** modelan intensidad, pero no reemplazan forma;
- **timbre** contextualiza la emoción dentro del mundo;
- **silencio** regula expectativa y fatiga.

La skill no trata estos vínculos como leyes. Fear, power y surprise presentan perfiles menos estables que calmness o sadness, por lo que requieren contexto, audición y múltiples candidatos.

## 15. Subdivisiones profundas por género

El atlas ampliado contiene 72 perfiles. Algunos ejemplos:

### Terror

- foreboding;
- isolation;
- being hunted;
- chase panic;
- uncanny childlike;
- body grotesque;
- ritual occult;
- cosmic void;
- psychological grief;
- jump/reveal;
- safe room;
- monster boss.

### Acción

- heroic combat;
- tactical;
- arcade frenzy;
- desperate survival;
- martial duel;
- industrial assault;
- chase;
- progressive boss;
- power fantasy;
- victory release.

### Aventura

- heroic overworld;
- pastoral forest;
- mysterious ruins;
- nautical travel;
- desert expedition;
- magical forest;
- subterranean descent;
- sky flight;
- discovery reveal;
- homecoming.

También se incluyen drama, misterio/puzzle, comedia, espacios sociales, ciencia ficción/industrial y fantasía/sagrado.

## 16. Patrones como componentes, no como canciones

La nueva biblioteca contiene más de cien componentes reutilizables:

- grooves y células rítmicas;
- progresiones y dispositivos armónicos;
- contornos melódicos;
- patrones de bajo;
- patrones de percusión;
- formas y arcos;
- transiciones adaptativas.

Cada patrón tiene ID, tags, descripción y datos relativos. Un agente no debe copiarlo literalmente en todas las salidas: debe transformarlo mediante omisión, desplazamiento, cambio métrico, inversión de acento, transposición, reharmonización, cambio de registro o sustitución tímbrica.

## 17. Horror no es un único paquete de clichés

La investigación separa al menos cuatro mecanismos:

1. **anticipación:** drones, señales, baja periodicidad y ambigüedad;
2. **alarma:** ruido, cambios abruptos, sidebands, disonancia y ataques;
3. **vulnerabilidad:** baja dominancia, registro vacío y silencios;
4. **repulsión/extrañeza:** irregularidad, timbre orgánico, simetría rota o material inocente corrompido.

Por eso `psychological_grief`, `being_hunted`, `uncanny_childlike` y `monster_boss` no comparten el mismo tempo, densidad, instrumentación ni forma.

## 18. Acción: poder, peligro y caos son dimensiones distintas

La música de combate puede comunicar:

- dominio heroico;
- concentración táctica;
- supervivencia desesperada;
- locomoción de chase;
- caos impredecible;
- peso de boss;
- recompensa de victoria.

Técnicas de inestabilidad como tonic pivots, acordes cuartales, cromatismo, escalas de tonos enteros/octatónicas, politonalidad y fragmentación cinética resultan útiles cuando el objetivo es peligro o caos. No deben aplicarse a todo combate: una power fantasy necesita métrica y bajo firmes, mientras una escena de supervivencia puede negar el downbeat y desviar resoluciones.

## 19. Música adaptativa

La skill incorpora:

- re-secuenciación horizontal;
- layering vertical;
- mix dinámica;
- stingers;
- procesamiento runtime;
- mapas de voces alternativos para `strict_hardware`.

El contexto del jugador activa cambios en parámetros concretos. Proximidad de enemigo controla tensión y ostinato; cantidad de enemigos controla densidad; salud baja reduce dominancia; progreso de puzzle añade capas; región cambia idioma e instrumentación; fase de boss modifica forma, armonía y métrica.

## 20. Archivos nuevos

- `references/12-affect-taxonomy.md`
- `references/13-genre-context-atlas.md`
- `references/14-rhythm-pattern-library.md`
- `references/15-harmony-melody-pattern-library.md`
- `references/16-energy-arcs-and-loop-form.md`
- `references/17-adaptive-music-state-model.md`
- `data/mood-vocabulary.json`
- `data/genre-profiles.json`
- `data/pattern-library.json`
- `schemas/composition-query.schema.json`
- `schemas/pattern-card.schema.json`
- `scripts/query_patterns.py`
- `examples/queries/*.json`
- `SOURCES.md`



# Ampliación v0.3 — géneros musicales y teoría compositiva

## Dos taxonomías complementarias

La versión anterior clasificaba principalmente función dramática y jugable. La ampliación separa:

- **género funcional:** terror de acecho, boss progresivo, pueblo, puzzle, viaje, etc.;
- **género musical:** jazz swing, funk, reggae, barroco, house, heavy metal, bossa nova, ambient, etc.

El primero define comportamiento; el segundo define groove, vocabulario armónico, forma, articulación, relación bajo/batería y tratamiento instrumental.

## 34 recetas musicales

Las recetas cubren orquestal/clásico, jazz/blues, funk/soul, rock/metal, Jamaican, brasileño/latino, folk, ambient/minimalismo y electrónica. Cada receta incluye tempo, métricas, groove, armonía, melodía, bajo, forma, instrumentación, traducción a ocho voces, controles de energía/mood y anti-patrones.

## Teoría como motor de decisiones

Se añadieron módulos para pulso, métrica, subdivisión, groove, motivo, frase, forma, armonía, conducción de voces, contrapunto, melodía, bajo, orquestación, timbre, loop, adaptividad e hibridación. La intención es impedir que el agente reduzca composición a una progresión de acordes más una melodía aleatoria.

## Investigación metodológica

Open Music Theory y Music Theory for the 21st-Century Classroom se utilizaron como marcos pedagógicos por su cobertura de fundamentos, contrapunto, forma, armonía, jazz, popular music, técnicas contemporáneas, orquestación y desarrollo motívico. Ableton Learning Music se utilizó para ejemplos operativos de beat, backbeat, four-on-the-floor, skank, bajos techno/dub y repetición procesual. Los cursos de Berklee se tomaron como confirmación de que una formación compositiva completa integra ritmo, escalas, armonía, chord-scale relationships, blues, modos, bass/drum grooves, modulación y estilos contemporáneos.

Las recetas no son definiciones universales. Los géneros son históricos, multi-label y culturalmente variables. Cada candidato debe audicionarse y revisarse.

# Ampliación v0.4 — identidad estructural y prevención de colapso

## Diagnóstico del set anterior

La amplitud taxonómica no se había trasladado por completo al generador de ejemplos. Los veinte previews compartían un canvas de 16 beats y 4/4; muchos utilizaban cuatro bloques armónicos, secuencias de ocho pasos, registros y densidades cercanas, además de variantes de una misma familia de osciladores y delay. El resultado era cambio de etiqueta sin suficiente cambio de arquitectura perceptiva.

La auditoría simbólica del set anterior registró similitud media 0.7315 y pares de hasta 0.9368. Esto no demuestra por sí solo que una pieza sea mala, pero sí confirma reutilización excesiva de plantilla.

## Estilo en tres capas

La skill distingue ahora:

1. estilo compositivo: forma, groove, armonía, melodía, bajo y contrapunto;
2. estilo de performance: microtiming, articulación, dinámica y fraseo;
3. estilo tímbrico: fuente, espectro, envolvente, transiente y espacio.

Una variación no se considera nueva si sólo cambia tonalidad, BPM, escala o nombre de instrumento.

## Arquitectura antes de notas

Se añadieron 18 arquitecturas: ciclos asimétricos, rotaciones rituales, triptychs compuestos, fanfares amplias, riffs aditivos, break architectures, frases jazz de seis compases, procesos polimétricos, dropouts dub, períodos, lamentos ternarios, exposiciones imitativas, builds de capas, vamps interlocking, AABA chiptune, campos no métricos y arcos habanera.

La arquitectura fija frase, longitud, grouping, densidad por sección y mecanismo de loop. Sólo después se generan eventos.

## Contrato de identidad

Cada candidato declara diez ejes posibles y debe diferir de alternativas previas en al menos cuatro, con dos cambios estructurales. Un género musical debe sobrevivir parcialmente a una reducción tímbrica neutra mediante groove, bajo, sintaxis, frase o forma; su timbre debe aportar una segunda capa de identidad, no sustituir la composición.

## Timbre y performance

El renderer de referencia utiliza familias distintas de parciales, ADSR, filtros, transientes de ruido, vibrato, pitch bend, slides, unison selectivo y procesamiento por composición. La intención no es emular el S-DSP bit-perfect, sino evitar que todos los instrumentos sean el mismo oscilador renombrado.

## Resultado reescrito

Las 18 composiciones nuevas cubren ocho longitudes de loop y once familias métricas, incluyendo 13/8, 12/8, 7/8, 6/8, 6/4, 5/4, 3/2, 3/4, 2/4, 4/4 y campo no métrico. La similitud media baja a 0.5591 y el par máximo a 0.7150, dentro del umbral configurado.

El objetivo no es maximizar diferencia matemática. El auditor detecta colapso de plantilla; la selección final requiere escucha en timbre normal, timbre neutro, sin melodía, sin percusión, en mono y durante varios loops.

# Profundización v0.5: dirección musical, orquestación y verdad tímbrica

La diversidad de métricas y patrones no garantiza calidad musical. El nuevo modelo distingue cuatro niveles:

1. **identidad de catálogo:** que una pieza no sea una variación superficial de otra;
2. **identidad interna:** que el motivo y el groove organicen la pieza;
3. **dirección dramática:** que cada sección prepare, retenga o transforme algo;
4. **traducción tímbrica:** que el sonido real apoye la intención y no sólo lleve el nombre correcto.

## Unidad de evaluación instrumental

```text
muestra × rol × registro × articulación × contexto × contraste
```

Una campana brillante puede servir como revelación única en horror, pero su repetición constante puede transformar lo ocultista en sagrado/luminoso. Un órgano puede aportar arquitectura ritual, pero en jazz noir puede tapar el walking bass y producir una lectura de iglesia o lounge. Una guitarra metal requiere contraste entre palm mute, sustain, power intervals y slides; un loop buzzy con etiqueta `guitar` no es suficiente.

## Dirección previa a las notas

Cada composición debe declarar tesis, punto de vista, motivo, consecuencias formales, clímax, entradas tímbricas, implicaciones prohibidas y estrategia de loop. Esta información alimenta los nuevos auditores y las pasadas de escucha editorial.

## Resultado metodológico

v0.5 reduce la cantidad del showcase de 18 a 12 ejemplos y aumenta su profundidad. Cada uno tiene una forma más larga, una tesis, lógica de orquestación, muestras originales, MIDI, render circular y reportes de calidad. El objetivo ya no es demostrar cuántas etiquetas puede cubrir el sistema, sino comprobar si cada pieza mantiene una razón musical para cada voz.


## 18. Corpus de partituras y transcripciones SNES (v0.6)

La skill ahora incluye un registro externo de fuentes y un atlas editorial de 190 juegos. No se empaquetan partituras protegidas. La estrategia cruza MIDI/transcripción, reducción o lead sheet y SPC/audio para separar composición, arreglo y performance.

Hallazgos de cobertura verificados durante esta ampliación:

- VGMusic lista 6.708 archivos MIDI en su directorio SNES.
- SNESmusic.org reporta 1.519 sets SPC que cubren 2.631 de 3.127 juegos conocidos.
- NinSheetMusic mantiene 5.131 partituras de videojuegos en total; entre los anchors SNES aparecen 35 de Chrono Trigger, 28 de EarthBound y 15 de Star Fox.
- Existen libros de reducción pianística de cobertura casi integral: Chrono Trigger (63 piezas), Final Fantasy IV (44), Final Fantasy V (67) y Final Fantasy VI (61).
- Square Enix Music Online cataloga sets MIDI completos para los álbumes originales de Chrono Trigger y Final Fantasy IV–VI.

La mejora no consiste en copiar ese repertorio, sino en medir: forma, seam del loop, ritmo armónico, onset topology, desarrollo motívico, independencia del bajo, entradas/salidas de voces, densidad, espacio negativo, channel rotation, envelopes, pitch gestures y echo.

---

# Actualización v0.9: de patrones superpuestos a composición jerárquica

La revisión auditiva demostró que la legalidad armónica no basta. Un sistema puede producir cero notas externas al acorde y, aun así, generar música lineal, torpe o intercambiable cuando melodía, bajo, arpegio y percusión se escriben como bucles independientes.

La v0.9 cambia la unidad de generación. La unidad primaria deja de ser el evento o el patrón de un compás y pasa a ser una jerarquía explícita:

```text
forma
→ función de sección
→ función de frase y cadencia
→ esqueleto rítmico
→ notas melódicas estructurales
→ bajo y conducción armónica
→ estados de textura
→ realización final
```

## Fundamentación

La forma musical organiza repetición y contraste en diferentes escalas. Un período relaciona antecedente y consecuente mediante la reaparición de una idea básica, pero modifica la consecuencia cadencial. Una sentencia desarrolla una idea mediante fragmentación, liquidación, secuencia y aceleración rítmica o armónica. Por lo tanto, repetir exactamente la misma grilla no equivale a desarrollar un motivo.

La literatura contemporánea sobre generación simbólica llega a una conclusión compatible: los modelos de mejor estructura separan niveles de forma, frase y cadencia de los niveles de notas, acordes y textura. MusicFrameworks organiza primero secciones y frases, genera después ritmo y melodía básica, y finalmente realiza notas condicionadas por ritmo y acordes. Los enfoques skeleton-to-texture generan primero los eventos estructurales y rellenan después el detalle.

## Fallo confirmado en v0.8.1

La auditoría encontró ejemplos extremos:

- `Goblin Workshop`: ocho compases consecutivos con la misma topología de ataques;
- `Sunlit Market`: siete compases consecutivos idénticos y similitud adyacente de 0,9898;
- `Clocktower Invention`: aparente contrapunto construido sobre una grilla casi constante;
- `Banner of Dawn`: misma métrica, perfil de lead y comportamiento tonal que `Sunlit Market`;
- `Rain on the Quay`: un error de scheduling avanzaba pares de dos compases cada dos beats en vez de cuatro, solapando patrones.

## Nuevos controles

La v0.9 añade:

- `hierarchical-composition-plan.json` obligatorio;
- auditoría de linealidad rítmica por género;
- auditoría de identidad entre pares de canciones;
- clasificación de repetición en motor, temática, contrapuntística y de campo;
- límites sobre topologías de ataques idénticas;
- obligación de pickups, silencios, cadencias, handoffs o dropouts en cues no motóricos;
- separación explícita entre comportamiento del bajo y del acompañamiento;
- revisión desde la capa jerárquica más alta que haya fallado.

Los scores automáticos continúan siendo auxiliares. No equivalen a aprobación editorial ni sustituyen la escucha.
