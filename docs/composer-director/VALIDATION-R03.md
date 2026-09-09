# Validación R03 — evidencia y límites


## Instrumentos vectoriales, Studio v2 y legibilidad — 8 de septiembre de 2026

Cristian pidió una referencia con estética vectorizada y descartó la primera dirección fotográfica. La referencia seleccionada y su prompt están en `docs/design/instrument-vector-reference.{png,md}`. Los SVG se redibujaron con siluetas, piezas separadas, pocos tonos por material y sombras simples. Hay 13 familias para 59 identidades; teclas, cuerdas, arcos, válvulas, baquetas, campanas, fuelle y voces reciben ataques y releases de las notas reales. La vista ampliada comparte la edad del ataque. Las campanas toman las alturas del score. Movimiento desactivado y movimiento reducido conservan la identificación de las notas.

El producto visible se llama Game Music Composer. La página conserva carbón y ámbar, con instrumentos mayores, mixer y campos más legibles. El piano roll dibuja en coordenadas de pantalla con resolución adaptada a DPR: sus rótulos ya no se encogen desde un canvas fijo de 1800 píxeles.

Studio Multisample v2 tiene 608 regiones de 50 patches, dos intensidades y 304 pares de ataques alternos con hashes distintos. Se cargan mediante 50 scripts locales por patch. Studio Compact reconstruye los 46 samples nativos y su calibración. La síntesis usa parciales limitados por Nyquist, resonancias de cuerpo, excitación por intensidad, variación de ensemble y percusión modal. Los bucles de sustain tienen cruces preparados. El renderer nativo reemplaza la interpolación simple de pitch por remuestreo polifásico filtrado. Se renovaron las 50 preescuchas y los 200 masters; los 100 scores y sus MIDI conservan sus datos musicales.

Pruebas y límites:

- 30 comprobaciones del estudio: edición, undo, importación, generadores, tres bancos, WAV, cancelación, foco y tamaños sin overflow; sin errores ni tráfico remoto.
- 35 comprobaciones del viewer independiente: las 13 familias, alturas reales de campanas, decaimiento, retrigger, continuidad del foco y movimiento reducido.
- 113 casos de música/puente en Node. Se corrigió un error de precedencia en la nueva síntesis antes de volver a ejecutar los casos afectados.
- Suite nativa: 53 casos pasaron en la extracción inicial; falló el límite existente de 25 MiB del paquete. Se compactó únicamente el JSON generado, comprobando igualdad de todos sus datos. El caso de paquete volvió a pasar. No se relajó el límite ni se recortó audio. El paquete final contiene 105 archivos y aproximadamente 19,7 MiB descomprimidos.
- La comprobación de movimiento con notas sintéticas necesitó mantener setup, acción y aserción en una misma evaluación para evitar que el rAF de la sesión detenida borrase su fixture entre llamadas. No se cambió el comportamiento de producción para hacerla pasar.
- En Wake of Amber se capturaron 41 estados visuales distintos en 41 frames durante 650 ms, se comprobó el reposo al detener, ambas preescuchas y la reproducción real del MP3 nuevo. Esto prueba actualización visual y señal, no realismo físico ni preferencia artística.
- La verificación final comparó los 608 WAV embebidos con sus fuentes, 46 samples compactos, 50 previews, 200 masters, igualdad semántica del catálogo y 533 hashes del estudio. El ZIP coincide con su copia descargable y con su manifest interno.

Evidencia: `.scratch/studio-soundbanks-v2-final/{verification,audio-verification,final-delivery,catalog-formatting}.json`, `.scratch/screenshots/instrument-redesign/` y los resultados existentes de suites. El archivo de fuentes incluye `STUDIO-V2-AUDIO.md` para distinguir los nuevos masters de las verificaciones históricas R03. Se conservan los bancos y masters anteriores en scratch. La evaluación musical a oído permanece pendiente. Release gate y auditoría estática pasan; no se ejecuta el gate de árbol limpio mientras el commit no esté autorizado.

## Catálogo completo y 100 contratos revisados — 8 de septiembre de 2026

Esta sección reemplaza el estado anterior del catálogo. Los 100 cues se recompusieron desde `game-music-composer/data/catalog-contracts-r03.json`, con semilla maestra `20260908` y semillas individuales registradas. Se conservan IDs, títulos, categorías, tempo, compás, tonalidad y célula motívica de partida. Cada contrato incluye dirección propia, frases explícitas, textura de contraste, silencios por rol, intensidad de secciones y retorno. Los controles se consumen antes de la interpretación; no son descripciones añadidas a las mismas notas. Las texturas que antes terminaban en el acompañamiento genérico se sustituyeron por ramas implementadas.

El resultado tiene 26.207 eventos escritos. Cambiaron las 100 partituras y los 300 archivos musicales: 100 MIDI, 100 OGG y 100 MP3. Los renders se produjeron en una carpeta nueva con el banco nativo y su calibración. La verificación independiente leyó cada MIDI con `mido` y decodificó ambos formatos de audio: notas MIDI completas, rutas melódicas puerto/canal únicas, estéreo de 32 kHz, datos finitos, señal no silenciosa, picos inferiores a 0 dBFS y duración esperada. No se midió true peak ni se aprobó la escucha. Se comprobaron también forma, texturas y silencios escritos contra los 100 contratos. La auditoría de banco cubre 1.100/1.100 asignaciones, sin errores ni advertencias.

Se corrigieron tres fallos observados durante la entrega: el redondeo podía colocar un inicio interpretado exactamente al final del loop; algunas partes de guitarra y coro necesitaban otro registro para el patch; siete cues excedían los 15 canales melódicos de un solo puerto MIDI. El exportador añade MIDI Port, respeta la intensidad declarada y ordena note-off antes de retriggers coincidentes. Los siete archivos con más de 15 partes melódicas necesitan un reproductor que respete esos puertos. Esto no garantiza equivalencia acústica con General MIDI ni resuelve toda superposición de notas de igual altura.

La revisión simbólica nueva mantiene **74 aprobados y 26 para revisar**, media **87,18**. Los 26 resultados conservan sus críticas sobre armonía estructural, frase o similitud de células. No se cambiaron umbrales para aprobarlos. La evaluación humana y en juego sigue pendiente. Las dos pasadas de la página representan partitura compuesta e interpretada; no se presentan como dos rondas de aprobación humana.

Pruebas de cierre:

- Paquete extraído en otra carpeta: doctor estricto y 51/51 tests, incluidos seis casos nuevos sobre frases, silencios, loop, puertos y expresión/retrigger MIDI.
- Studio desde `file://`: 30/30 comprobaciones de edición, reproducción en tres bancos, importación, cinco generadores y WAV. Se inspeccionó la captura de escritorio del catálogo nuevo. El runner existente conserva además su comprobación de reflow.
- Puente Node: los cuatro casos pasan. El caso circular usa ahora una entrada explícita en vez de depender de que Fernway conserve una nota adelantada después de regenerarse; sus aserciones de preservación no cambiaron.
- `Victory Lap Zero` cargó su contrato R03 por URL y reprodujo su MP3 nuevo en el navegador, sin errores. La vista Review mostró 74/100. El JSON editado por el piano roll pasó validación nativa estricta.
- Auditoría del showcase y release gate de rutas/archivo/manifiesto: pasan. `--check-tree` no se repite porque requiere el commit aún no autorizado. No se repiten los labs autónomos porque sus módulos siguen idénticos a la integración ya probada.

El ZIP instalado contiene 104 archivos y su SHA-256 es `ac21f1d83cbbb2f88ed2e6dbb6683ad331283b688be8839e5fb4495c74791d4f`. El estudio publica este mismo paquete, el catálogo v5, revisiones, MIDI y audios. El ZIP de fuentes incluye 100 contratos completos, 100 partituras, semillas, fuentes y recibos de verificación. `generation.skill_sources` conserva la instantánea al componer; `verification.export_sources` identifica el exportador corregido usado después.

Evidencia local en `.scratch/catalog-r03-contracts-20260908-02` y `.scratch/screenshots/studio-integration/{browser-results,catalog-browser-results}.json`. La carpeta de generación conserva una copia completa del catálogo y estudio anteriores. Las carpetas de intentos intermedios no forman parte de los paquetes. Todo permanece local y pendiente de commit.

## Studio integrado antes de regenerar el catálogo — 8 de septiembre de 2026

La página original `game-music-composer-showcase/index.html` incorpora los cinco generadores de Atelier, interpretación, instrumentos SVG tocables, selección y edición en su piano roll, deshacer y restauración. Conserva el catálogo, el editor de recetas, los 50 patches y la revisión. Las herramientas comparten eventos nativos, transporte, mezcla y bancos. La cabecera ocupa menos espacio y las superficies conservan el gris y el ámbar originales.

El puente nativo preserva samples, routing, eventos no editados y desplazamientos circulares. Los cues editados se identifican como borradores locales y no muestran el master o la aprobación del original. JSON guarda la partitura; WAV incorpora banco, tempo, transposición y niveles actuales. La exportación WAV usa el mismo código de voces del reproductor y un loop previo para releases y eco; produce PCM estéreo de 32 kHz y admite hasta dos minutos. El botón Stop cancela también la preparación pendiente.

Evidencia actual en Chrome 152.0.7977.83, desde `file://`:

- `studio_tests.py`: 30/30 comprobaciones. Los tres bancos produjeron señal real medida; el WAV Factory fue estéreo y no silencioso. Se verificaron edición, JSON reimportado, deshacer/restaurar, cinco generadores, ciclos inválidos, foco, cancelación y las páginas existentes, sin excepciones ni solicitudes remotas.
- `studio.test.cjs`: 4/4 casos. Incluye todas las familias de generación, correspondencias con samples reales y copias exactas de los módulos canónicos.
- `neospc.py validate edited-score.json --strict`: cero errores y advertencias para el JSON exportado por la página.
- HTMLs portátiles regenerados en `.scratch/ensemble-atelier-studio`: Atelier 32/32 y lanzador 22/22. La creación del osciloscopio ahora se monta explícitamente para reutilizar los instrumentos en ambas aplicaciones.
- ZIP extraído y probado en otra carpeta: doctor estricto y 45/45 tests. El ZIP actualizado tiene SHA-256 `8f624a744cb89a030dabaeb185284b743263213567fd2e46701a8424c47f4e1e` y reemplaza al hash de la pasada anterior descrita más abajo.
- Auditoría estática del showcase: 100 cues, 50 previews, cero errores y advertencias. `tools/sync_studio.py` publica módulos, 59 asignaciones, el ZIP descargable y el manifiesto del sitio con finales LF reproducibles.
- Se comprobaron los 483 hashes del manifiesto del sitio y la igualdad binaria entre el ZIP canónico y el descargable. La sintaxis de los cuatro módulos de integración pasa. `release_gate.py` pasa para archivo, rutas y manifiesto; `--check-tree` queda pendiente porque exige un árbol limpio y los cambios aún no tienen commit.

Capturas comparables a 1440×1000 y comprobación de reflow a 390×844 en `.scratch/screenshots/studio-integration`. Se inspeccionaron el piano roll, controles, instrumentos y estado de borrador. Las pruebas son locales; no se desplegó el sitio. El audio de navegador no acredita mastering ni equivalencia acústica con la CLI. Los borradores permanecen en la sesión y deben exportarse antes de cerrar. El catálogo y los renders originales no se regeneraron.

## Integración local en Windows — 8 de septiembre de 2026

Se incorporaron todos los archivos del PR #2 en `3737296519b930fe48d09fc1ce7a3b17ea34777c`, sobre la copia local limpia de `main` en `1d562a7`. La integración incluye las correcciones siguientes y permanece pendiente de commit. Esta sección actualiza la evidencia; las pruebas de Linux descritas más abajo conservan su alcance histórico.

### Correcciones de revisión

- **Timing circular:** mezclar posiciones absolutas movía un adelanto del beat 0 al centro del loop. Un caso de 32 beats pasaba de 31,99 a 15,9904. El refinador ahora mezcla desplazamientos circulares con signo y conserva el cruce de loop. La desviación temporal del visor usa la misma interpretación circular.
- **Duración editada:** el piano roll aceptaba notas de más de 14 segundos que el sintetizador recortaba. El editor ahora rechaza ese cambio y conserva la partitura.
- **Preparación de audio:** el tempo queda bloqueado mientras el Worker prepara las voces, además de durante la reproducción.
- **Selector de Ciclos:** los valores `.25` y `.5` no coincidían con los valores numéricos serializados `0.25` y `0.5`. Se corrigieron las opciones; cambio y restablecimiento tienen cobertura de navegador.
- **Paquete:** el test anterior exigía menos de 100 archivos, pero la extensión requiere 103. Ahora comprueba coincidencia exacta con el manifiesto, entrada de las nuevas herramientas, exclusión de cachés, reproducibilidad y el límite original de 25 MiB. `LICENSE` también usa LF para estabilizar sus hashes en Windows.

Se actualizaron ambos README instalados y el descriptor de la skill. Los enlaces de Codex, Agents y Matrix apuntan al paquete canónico local y ven directamente estos cambios.

### Pruebas ejecutadas

Entorno: Windows, Python 3.13 y Chrome 152.0.7977.83 mediante Playwright. Se usaron dependencias de navegador locales en scratch; el paquete distribuible sigue sin depender de Playwright o Node.

| Comprobación | Resultado |
|---|---|
| Doctor y suite completa desde ZIP extraído en otra carpeta | PASS; 45 tests, incluidos 23 de las extensiones |
| Pruebas Python de composition probe | 18/18 PASS |
| Node: Director y Ensemble Atelier | 129/129 PASS: 20 + 109 |
| Cinco demos, una pasada con registro instrumental compartido | 132/132 PASS |
| Ciclos después de corregir el selector | 26/26 PASS, incluido su registro instrumental |
| Worker, foco, movimiento, reloj y señal | 32/32 PASS |
| Lanzador y cinco documentos embebidos | 22/22 PASS |
| Composer Director | 11/11 PASS y reducción sintética finita, no silenciosa |
| Composición nativa real abierta desde disco | 15/15 PASS |
| ZIP final y release gate | PASS; 102 entradas de manifiesto y 103 archivos empaquetados |

La suite completa se ejecutó antes del último cambio, limitado a las opciones del selector de Ciclos. Después se repitieron su recorrido de navegador, la comprobación de paquete reproducible y el release gate. Los demás resultados se conservan porque sus rutas no cambiaron.

El ZIP final tiene SHA-256 `695f7fa1c352f51faa7d977c8140ff2e97151534142b6878e9c6a584c5782ffc`. Se recalcularon los 102 hashes desde los archivos completos del checkout, incluido el banco; no se heredaron hashes sin leer sus archivos.

### Recorrido nativo completo

`neospc init` y `compose` generaron una pieza de ocho compases, 165 eventos y diez instrumentos. El refinador `chamber`, amount 0,5, conservó el hash de la estructura escrita y un pico simbólico de 7/12 voces. El mayor cambio de timing fue 4,147 ms. La validación estricta y la auditoría de las diez asignaciones al banco terminaron sin errores ni advertencias; se exportó MIDI Type-1.

Se renderizaron los catálogos original y refinado en dos carpetas nuevas. Ambos produjeron OGG y MP3 de 20 segundos, estéreo, a 32 kHz. Los OGG tienen hashes diferentes, muestras finitas y señal no silenciosa. El pico decodificado fue 0,7261 y 0,7619 respectivamente. Esto demuestra que el refinamiento llegó al renderer, no que la revisión suene mejor.

El HTML de esa composición se abrió con navegación real `file://`, a 1440 × 1050. Se comprobaron reproducción con señal real, foco y retorno de teclado, Escape, exportación JSON y WAV. No hubo errores JavaScript ni peticiones HTTP externas. Los cinco demos también produjeron WAV reales y pasaron sus recorridos de edición, importación y exportación. Se revisaron capturas de las pantallas afectadas; las pruebas móviles usan un viewport emulado, no un dispositivo físico.

Artefactos locales: `.scratch/pr-2-native/` contiene composición, catálogos, MIDI, renders, HTML y resultados. `.scratch/ensemble-atelier-integrated/index.html` abre los cinco demos finales. Los informes originales de las suites están en `.scratch/ensemble-atelier/qa/results/`; la repetición final de Ciclos está en `.scratch/ensemble-atelier-integrated/qa/results/`.

### Límites que siguen abiertos

No se regeneraron los 100 renders ni se hizo escucha ciega, round-trip MIDI independiente o integración con un juego. El doctor sí comprobó el corpus incluido. La caché nativa por existencia, paridad de bancos y colas/canales MIDI siguen en el backlog previo; esta integración no los declara resueltos. El puente con fixture no se repitió porque se probó el recorrido con una composición generada por el motor real.

GitHub Actions ya estaba desactivado y sigue así. No hay prueba de CI remota. `release_gate.py` pasó; `--check-tree` queda para después del commit porque exige un árbol limpio. No se fusionó ni publicó el PR en GitHub.

## Evidencia original de R03 en Linux

Fecha: 2026-09-08. Local: Linux, Python 3.13.5, Node 22 y Chromium 144. No hubo ejecución local en Windows ni dispositivos móviles físicos.

## Ejecutado sobre el incremento

| Suite | Resultado | Alcance |
|---|---:|---|
| Helpers Python | 22/22 PASS | 13 pruebas de refinamiento + 9 de visor; inputs, no sobreescritura, preservación, determinismo, reubicación de assets y CLI desde otra carpeta. |
| Música/síntesis Node | 108/108 PASS | 59 identidades, señal finita/determinista, cinco generadores, cruces del Atlas, cierre de ciclos, import y contratos de eventos. |
| Browser por demo | 29, 25, 24, 32, 25 PASS | I001…I005 respectivamente. Controles, reproducción/stop, notas, edición/import según demo, móvil, export y errores. |
| Pulido Atelier | 31/31 PASS | Vista ampliada de las 13 familias, pads, cancelación Worker, replay, señal real, reloj, movimiento reducido y escape. |
| Lanzador | 22/22 PASS | Cinco embeds, clicks de reproducción, retirar documento anterior, download idéntico y layouts. |
| Puente helpers → HTML | 8/8 PASS | Dos helpers Python reales y navegador, usando fixture de 16 eventos en formato nativo. |

La prueba de cobertura de 59 identidades se repite al ejecutar cada demo por separado. La suma de 135 comprobaciones de demos NO son 135 criterios independientes de calidad. Los números no son una puntuación musical ni un benchmark de rendimiento. Los 22 tests Python y 108 Node se reejecutaron con las rutas adaptadas del repositorio.

Se probó además el índice generado por `tools/build_ensemble_atelier.py` con las mismas 22 comprobaciones. Su portada portable es más sencilla que la portada ilustrada de la sesión entregada; los cinco documentos usan los mismos módulos musicales, visuales y de audio.

## Audio realmente producido

Cinco WAV de prueba guardados, no archivos vacíos ni promesas de exportación. Una vuelta más cola, 32 kHz, dos canales. Mediciones sobre el buffer sintético antes de codificar PCM16:

| Demo | Duración s | Pico lineal | RMS |
|---|---:|---:|---:|
| I001 | 21.1256 | 0.24453 | 0.04653 |
| I002 | 11.6091 | 0.27599 | 0.04277 |
| I003 | 23.5572 | 0.14105 | 0.02895 |
| I004 | 22.5182 | 0.16323 | 0.03405 |
| I005 | 16.3522 | 0.12103 | 0.02098 |

Todos finitos y sin muestras recortadas en estas pruebas. No son LUFS, true peak ni evaluación de mezcla profesional. No se nivelaron perceptualmente las opciones y no hubo selección ciega humana.

## Navegador

Los HTML se cargaron con Playwright `set_content`, y los embeds con `srcdoc`. La política del entorno bloqueó inicialmente navegación `file://`; no se acredita por estas pruebas abrirlos desde disco ni navegar un servidor HTTP. El audio se inició mediante clicks, sin override de autoplay. Se observaron cero errores JS y cero solicitudes HTTP externas en los recorridos registrados.

Se inspeccionaron capturas de escritorio, móvil y foco de instrumentos. Los dibujos pueden tener simplificaciones deliberadas; la suite no demuestra digitación física, realismo acústico o cumplimiento integral de accesibilidad.

## Nativo: distinción indispensable

El fixture de puente usa estructura Neo-SPC pero no fue generado por `neospc compose`. Los helpers añadidos se ejecutaron realmente; no se ejecutó aquí el generador completo ni su renderer original con banco de muestras. Tampoco los 100 renders, un round-trip MIDI independiente, las pruebas históricas completas de doctor, el paquete portable completo o el release gate con todos sus archivos.

La corrección del empaquetado se reutiliza de PR #1. Los hashes nuevos son calculados desde archivos disponibles; los antiguos provienen de su manifiesto corregido. Un pase de hashes locales parciales no sería prueba del paquete entero. Los workflows de GitHub están preparados; su estado remoto debe leerse del run, no inferirse de este documento.

## Reproducir

Desde raíz:

```bash
python tools/build_ensemble_atelier.py
node --test tests/ensemble-atelier/music.test.cjs
python -m unittest discover -s game-music-composer/scripts/tests -p test_visualize_score.py -v
python -m unittest discover -s game-music-composer/scripts/tests -p test_refine_performance.py -v
```

Con Playwright y Chromium disponibles, los runners de `tests/ensemble-atelier/` guardan informes/capturas en el directorio generado. `GMC_LAB_DIR` permite otro destino y `CHROMIUM_EXECUTABLE` otro navegador Chromium. El runner completo y los informes de la sesión se incluyen en el paquete de evidencias.

**No se ha demostrado que la composición nativa guste más.** Sí se comprobaron nuevas herramientas utilizables, preservación de notas y una experiencia instrumental más desarrollada. La aprobación musical y su uso en juego continúan pendientes.

## Frontal SVG revision

The front-facing reference is `../design/instrument-front-reference.png`. Rebuilt the piano case, upright guitar and bowed strings, horn tubing, drum face and accordion keyboard. Removed global instrument tilt and corrected vertical string vibration to move horizontally. The synthesizer case now uses a rectangular front panel. The existing warm palette, score targets and motion controls remain in use.

Validation: 35 standalone browser checks and 113 Node checks passed. The studio focus view produced 55 distinct motion frames, both sample previews played, and the mastered cue advanced without JavaScript errors. Rendered family and focus captures are in `.scratch/screenshots/instrument-redesign/`. Audio regeneration was not repeated because this change only affects the drawings. The downloadable skill package was rebuilt and the studio manifest refreshed.

## Revised phrases and minimal workspace

All 100 contracts now use revision `r03-contracts-2`. Section lengths and written rests were revised together; phrase questions, continuations and cadences follow the new section spans. The protected cue identity, tempo, meter, key and lead motif remain intact. Changing only the seed reproduced an unchanged score, so the regeneration gate rejected that attempt before publication.

The resulting catalog has 26,196 events. The symbolic review reports 77 approved and 23 revise, with a mean of 86.96. The generator audit finds no exact melody or topology duplicates. These are structural measurements, not proof of perceptual variety or listening approval. The low choir register was corrected after three notes exceeded the Factory extension; the final bank audit covers all 1,101 assignments with zero warnings.

The studio uses one transport. Categories moved into the library; playback settings, mixer and score notes use keyboard-accessible disclosures. Note pads start collapsed and remain available through their toggle. The piano roll is wider, and instrument cards use three columns on desktop. Header copy, hardware decoration and repeated playback controls were removed.

Evidence and complete exports are in `.scratch/catalog-minimal-r04-release/`; matched workspace captures are in `.scratch/screenshots/instrument-redesign/minimal-{before,after}-studio.png`. Human listening remains pending.

Final checks for this revision: 55 native tests, 113 Node tests, 35 standalone browser checks and 34 studio browser checks passed. The release gate and showcase audit passed. All 300 published audio/MIDI artifacts match their verification hashes; all 533 studio manifest entries match. The portable skill contains 21,075,413 unpacked bytes. Both desktop and narrow layouts were inspected.

## Carbon workspace redesign

Applied ruthless-designer to the workspace around the existing piano roll. Replaced the page stack with a docked desktop shell, a left library, a shared lower panel and a single Files menu. Replaced the accumulated studio stylesheet with a coherent carbon palette and flat controls. The roll renderer, scores and soundbanks were not changed. Fixed the recipe view so its controls refresh from the same current configuration as the JSON preview.

Matched Walls of Bronze captures at 1440x1000: `.scratch/screenshots/carbon-studio/before.png` and `after.png`. The roll moves from y=400.6 to y=238 and grows from 340px to 438px high. Playback, mixer, note pads, recipe, bank, review and 390px-wide states were also rendered and inspected. 39 studio browser checks pass, including dock keyboard navigation, file-menu focus recovery, edit/undo, bank audio and current recipe configuration.

Design judgment: better for artifact priority and consistency. The lower dock trades simultaneous visibility of all instruments for a horizontal strip and tabs; full instrument focus remains available. Initial blue-biased panels were corrected to neutral carbon. A narrow transport clipping issue was repaired. Audio synthesis and catalog tests were not repeated because this revision does not change their inputs.


## Phrase Studio replacement — 2026-09-08

The user rejected the previous music and soundbanks. The new catalog is version 6.0.0-phrase-studio, generated with phrase_composer.py from 100 explicit subjects and answers. All 100 written scores, 200 audio exports and 100 MIDI files changed. Scene IDs remain stable. The previous distribution and bank files are retained in the scratch regeneration and bank archives.

- 21,041 events across ten categories; measured peak at most eight simultaneous voices.
- 450/450 factory assignments covered, no bank errors or warnings.
- 100 independently specified subjects; no exact melodic-signature duplicates. Accompaniment topologies are shared within the 17 finite grammars; this is not 100 independent style engines.
- Three production palettes, 50 patch mappings and 608 regions each. Chamber includes 103 pinned CC0 VSCO 2 CE recordings across 15 patch definitions; the rest is synthesized. Velvet and Circuit are original synthesis. Ninety-three Chamber region files repeat source material where a separate recorded take is unavailable.
- All 1,824 regions have finite audio, safe peaks and verified loop boundaries; published chunks match the build.
- Every MIDI note count matches its score. Every audio file is fresh, non-silent stereo, unclipped and has the intended duration.
- Native and browser source-region selection matched on 24 events each for Chamber, Velvet and Circuit. Real browser output peaks over sustained playback were .074, .103 and .102 respectively. The master processing differs between backends.
- 39 existing browser checks passed with all five bank options, editing, undo, local creation, WAV export and offline delivery. No browser exceptions or external requests.
- 113 Node checks passed. Native suite: 56 passed initially; one fixture that assumed the old catalog form was repaired and its focused rerun passed (57 total cases).
- The native init + score-blueprint.json + compose path produced a valid six-instrument cue, peak 6/12.

The automatic review keeps all 100 cues in revise status (mean 84.5), principally for phrase and expression concerns. No human listening approval is claimed. Formal genre labels are scene references: the bounded invention, process and field grammars are not proof of strict fugue, full process composition or idiomatic cultural practice.

Evidence: `.scratch/phrase-studio-final/verification.json`, `.scratch/studio-palettes-v3b/delivery-verification.json`, and `.scratch/screenshots/phrase-studio/results.json`.


## Four genre collections - 2026-09-08

Added ten instrumental cues each for Bachata, Trip hop, Trap and Reggaeton. Catalog 6.1.0-four-genres contains 140 cues in 14 categories. The original hundred style objects and all 300 of their export hashes are unchanged. New contracts live in data/genre-expansion-contracts.json; genre_composer.py writes the dedicated accompaniment, bass and percussion around explicit subjects and answers.

The additions contain 17,528 events; maximum measured written polyphony is nine. All forty melody signatures are distinct. Each has a contrasting section with foreground space. Native init chooses the right default meter and tempo, supplies an editable blueprint and rejects unsupported meters before writing. Its short-form breakdown stays inside section B. The trap lead enum was corrected after the relocation test exposed it.

Four synthesized patches (requinto, muted rhythm guitar, bongo and guira) bring each production palette to 54 patches and 648 regions. New assignments: 256/256, zero errors or warnings. MIDI retains GM bongo keys; live sample pitch uses explicit tuning independently of those keys.

Verification:
- All 80 new audio files are finite, non-silent stereo at 32 kHz, below full scale and the intended duration. All 40 MIDI note counts match the scores.
- All 420 published media hashes checked. Both archives contain all 140 identities; the source archive preserves earlier evidence under history/.
- Native relocation suite: 58 passed first; the two trap-init failures passed after the enum repair (60 cases total). No weakened assertions.
- 133 Node checks passed. The existing browser flow reached the genre extension after passing its earlier checks; the extension initially hit a persisted-view selector issue in the test. An explicit workstation URL fixed it. All 24 focused genre/browser checks then passed, including playback, category counts, palette choice, recipe controls, MIDI-key/sample-pitch separation, zero browser exceptions and offline operation.
- Inspected the rendered Bachata piano roll at 1440x1000. Evidence: .scratch/screenshots/studio-integration/bachata-playing.png and genre-results.json.
- Studio structural audit: zero errors or warnings. Release gate passes without the optional clean-tree check. The clean-tree variant fails because this task and prior integration work are uncommitted; no files were reverted to satisfy it.
- Native ZIP: 112 entries, 22,880,217 bytes unpacked; 810 Studio manifest entries verified. Skill ZIP SHA-256: fb1aaf1be509532508c43809495fb72acef572a48aeda161719da6f06caff4a7.

Delivery evidence is under .scratch/four-genres-final/verification.json and publication-verification.json. The audio from four-genres-release was carried forward only after exact comparison of every render input field; the only difference was provenance for the expanded generator CLI. Human listening and artistic approval remain pending. No commit or push was made.


## Resonant banks and native console soundpacks

Added Timber, Prism and Voltage: 54 patches and 2,130 multisample regions each, with three intensity layers and two alternate attacks. Their modal, FM and band-limited subtractive models live in the installed skill. Browser chunks use lossless FLAC; every encoder roundtrip matched PCM16. Native rendering accepts an explicit factory directory. Four matched-score audio comparisons are published at -18 LUFS. These are original synthesized instruments; no claim of acoustic-recording realism or listener preference is made.

Added separate Mega Drive and SNES soundpacks. The native writer emits YM2612/PSG VGM and SPC700/S-DSP SPC files, rejects voice overflow and preserves explicit register/BRR designs. Mega Drive offers 12 FM patches plus PSG square and noise; SNES offers 16 BRR designs. The mapped Studio previews share 224 dry source samples across the 54 existing roles. The downloads contain native demos, source, editable notes, WAV multisamples and SFZ maps; SNES also includes BRR sources. The organ designs are available in the native writer but do not have a corresponding catalog role or a bundled SFZ. Modern Studio preview mixing does not enforce console limits. Physical-hardware equivalence remains unverified.

Native verification: the 63-case relocated run passed 62 cases and exposed a YM2612 octave conversion error. The conversion was corrected, affected output regenerated, and the unchanged native decode/pitch/release case passed from the final relocated ZIP. The earlier modal-velocity failure was fixed in synthesis and passes in this run. No assertions were weakened. Native decoder checks use external FFmpeg 9.0.1 with libgme. Doctor and release gates pass; the structural Studio audit reports zero errors or warnings.

Publication checks preserve the 140 written cues, all 420 existing media exports and 162 prior palette chunks. New synthesis chunks match their generation receipts. The native skill ZIP contains 116 entries / 22,920,707 bytes unpacked. Both native console ZIPs pass integrity and SFZ sample-reference checks. Human listening remains pending. No commit or push.

Final browser closeout: all 25 console checks pass in Chrome 152, including real audio peaks, selected-bank routing, unchanged score events, stereo WAV exports, native demo playback, demo/Studio mutual exclusion, native ZIP downloads, playback after downloads, patch inspection, zero exceptions and zero network requests. The two exported WAVs have distinct hashes. Full exports needed a longer 120-second test wait; this change does not claim improved render speed. Evidence: .scratch/screenshots/studio-integration/console-bank-results.json, megadrive-bank.png and snes-bank.png. The rendered desktop console rack was inspected; full-width native audio controls remain legible.

Final publication: 1,012 Studio manifest hashes verified; the downloadable skill matches the canonical ZIP (SHA-256 02e4d5d9752a7decd45d79e76a81e740132da84ec5ac8aedc6cd30ff45d9f942). Mega Drive ZIP: 108 WAV source samples / 13 SFZ maps / 5,203,762 bytes. SNES ZIP: 116 WAV source samples / 15 SFZ maps / 7,823,668 bytes. Native organ patches are included in source and SNES BRR, but not mapped to the 54 current score roles. All 224 preview samples and both final native demo renders are finite, non-silent and below full scale. Final receipts: .scratch/console-banks-3/publication-verification.json and native-audio-verification.json. The optional clean-tree check is still inapplicable to this deliberately uncommitted integration; no remote mutation was performed.


## Source level matching and layout repair

Calibrated 8,604 delivered sample files in 1,969 root groups using a 400 ms onset-aligned K-weighted reference at -18 LUFS with peak headroom. Each root shares its gain across velocity layers and alternate attacks, preserving their dynamics. Browser playback, auditions, native sample rendering and the downloadable console SFZ maps use the same source trims. Chip mode has a measured -8 dB trim. Representative previews and native demo players have separate playback trims; raw console audio and native VGM/SPC remain unchanged.

Actual browser WAV exports of electric piano, electric bass and requinto across eight sample palettes reduced bank spreads from 13.14, 12.51 and 17.90 dB to 0.08, 0.59 and 0.28 dB respectively. These are reference-note measurements, not claims of equal perceived loudness for every score. All ten playback modes pass the broader 4 dB reference check. The native renderer's electric-piano probe spans less than 0.03 dB across eight palettes. Evidence: .scratch/mix-layout-repair/{calibration,browser-levels,native-levels}.json.

The workstation now allocates vertical space to the piano roll and mixer without hiding faders. Track levels read in dB. Palette metadata loads before initial instrument labels. The Soundbank page exposes its selector and patch browser first; descriptions, demos and downloads are collapsed. Rendered views were inspected at 1440x900, 1024x768 and 390x844 because the affected rules include responsive layout. Five mixer strips fit the compact desktop; the last fader remains reachable in an eight-part score. Mobile uses normal document scrolling.

Verification: 57 focused browser checks pass, including 30 finite/unclipped audio exports, unchanged score events, real playback, selector routing, empty-search recovery, geometry, zero exceptions and offline operation. The packaged skill relocation smoke passes. JavaScript syntax, Studio structural audit (zero errors/warnings), release gate and scoped diff whitespace checks pass. No unchanged composition-core suite was repeated. The optional clean-tree gate was omitted because the integration remains uncommitted.

Publication verifies all 1,013 Studio manifest hashes, 140 unchanged cues, 420 unchanged existing exports and 162 prior chunks. All 224 console SFZ region trims match canonical gains; both archives pass integrity and sample-reference checks. Skill ZIP SHA-256: c9a4fceb7b515c594b9e9ddd156b6159d1e2e07473f6bd5ed05795477b6000d7 (23,405,501 bytes unpacked). Existing mastered exports were not remastered; calibration applies to live playback, auditions and newly rendered output. Human listening approval and physical-console comparison remain pending. No commit or push.
