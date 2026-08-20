# Investigación: interpretación expresiva, humanización y uso de múltiples voces

## Conclusión central

La sensación robótica no proviene sólo de la cuantización. Surge cuando tempo, ataques, dinámica, articulación, timbre y duración no responden a la estructura musical. El jitter aleatorio puede volver la ejecución imprecisa sin volverla humana.

La arquitectura v1.0 separa:

```text
score → performance plan → synthesis/rendering
```

Esto permite conservar la composición y comparar interpretaciones diferentes.

## Variables expresivas

La literatura sobre interpretación expresiva identifica como dimensiones principales:

- tempo y timing local;
- dinámica;
- articulación y overlap;
- entonación;
- vibrato;
- pedalling o sustain equivalente;
- timbre y ataque.

Estas variables deben responder a información de la partitura: frase, posición métrica, llegada melódica, cadencia, densidad y rol instrumental.

## Microtiming

El microtiming no es un valor aleatorio por nota. La v1.0 usa curvas suaves y correlacionadas:

- el comienzo de la frase puede empujar levemente;
- la segunda mitad puede relajarse;
- la cadencia puede ensancharse;
- el siguiente límite formal vuelve a la grilla.

Los instrumentos reciben roles distintos. Ejemplo de jazz o bossa:

```text
kick: referencia estable
bass: ligeramente adelante o centrado
snare/rim: ligeramente detrás
comping: relajado y con asynchrony interna
lead: timing de frase independiente
```

La magnitud depende del género. Exagerar los desplazamientos puede reducir groove y claridad.

## Dinámica

La dinámica se modela en cuatro escalas:

1. arco de sección;
2. arco de frase;
3. acento métrico y armónico;
4. variación local de notas repetidas.

No se usa una velocidad fija por instrumento ni ruido independiente en cada nota.

## Articulación

- notas de paso más breves;
- llegadas y finales de frase más largos;
- bajo con overlap dependiente del género;
- espacios respiratorios en vientos;
- ataques alternados en acompañamientos repetidos;
- acordes de piano, guitarra o arpa con ataques no simultáneos;
- vibrato que aparece después del ataque, no desde el primer sample.

## Múltiples voces por instrumento

El S-DSP físico posee ocho voces. Una voz adicional consume el mismo presupuesto que cualquier otra parte musical. Por eso hay tres modos.

### strict_hardware

No emplea dobles permanentes. La riqueza proviene de ADSR/GAIN, pan, echo, vibrato, portamento, detune selectivo, dinámica y reasignación temporal de voces.

### expanded_web

Permite hasta aproximadamente dieciséis voces. Las capas adicionales se reservan para:

- cuerdas y coros sostenidos;
- brass en llegadas estructurales;
- aire/cuerpo detrás de un wind lead;
- unison detuned en leads electrónicos;
- transient layers.

### bounce_to_sample

Un ensemble expandido puede renderizarse como una muestra y luego ocupar una sola voz SNES. El costo se desplaza de polifonía a memoria, rango de transposición y flexibilidad.

## Restricciones editoriales

- no duplicar todo el arreglo;
- no ensanchar el bajo de forma continua;
- no aplicar chorus permanente a un solo íntimo;
- no utilizar timing aleatorio idéntico para todos los roles;
- no aprobar una mala composición porque el render suene más grande;
- declarar siempre si un preview excede ocho voces.

## Fuentes de referencia

- SNESdev Wiki: S-SMP, S-DSP registers, envelopes and audio drivers.
- Yoko Shimomura interview, Square Enix: eight-sound limit and instrument-bank tradeoffs.
- Cancino-Chacón, Grachten, Goebl and Widmer: computational models of expressive performance.
- Senn et al.: expert microtiming in swing and funk.
- Earis: expressive timing and dynamics extraction.
- GigaMIDI: onset, velocity and metric-level heuristics for expressive MIDI detection.
- MIDI-DDSP: hierarchy of notes, performance and synthesis.
- NES-MDB: separation between composition and expressive performance attributes in constrained game music.
