# Investigación de corpus de partituras SNES — v0.6

## Conclusión principal

No existe un único archivo público, completo, homogéneo y fiable de “todas las partituras SNES”. Sí existe un ecosistema suficientemente grande para construir un corpus analítico serio si se separan las representaciones y se verifican entre sí.

La ruta recomendada es:

```text
archivo MIDI amplio
+ reducción/lead sheet legible
+ SPC como referencia de performance
= evidencia triangulada
```

## Cobertura localizada

- **VGMusic SNES:** 6.708 MIDI. Es el índice simbólico más amplio encontrado, pero mezcla transcripciones, conversiones, arreglos, versiones XG y remixes.
- **SNESmusic.org:** 1.519 sets SPC, 2.631 juegos cubiertos de 3.127 conocidos. Es la referencia más amplia para playback, voces, timbre, pitch, envelopes y echo.
- **NinSheetMusic:** 5.131 partituras de videojuegos en total, normalmente con PDF, MIDI y archivo de notación. Entre los casos SNES verificados: Chrono Trigger 35, EarthBound 28, Star Fox 15, Mega Man 7 12, Super Metroid 7 y Mega Man X 6.
- **VGLeadSheets:** colección completa descargable y transcripciones educativas centradas en melodía, acordes y forma.
- **Square Enix Music Online:** sets MIDI catalogados como completos para Chrono Trigger y Final Fantasy IV–VI, además de libros DOREMI con 63, 44, 67 y 61 piezas respectivamente.
- **SNES MIDI Remaster Project:** trece soundtracks completos reportados a diciembre de 2025, con MIDI GS, audio e información de instrumentación. Es especialmente valioso para estudiar problemas de channel rotation, percusión pitch-shifted y automatización expresiva.

## Por qué no debemos ingerir todo ciegamente

Una misma cue puede aparecer como:

- conversión cercana al driver;
- transcripción manual;
- arreglo GM/XG;
- piano solo;
- lead sheet;
- remix;
- remaster;
- SPC original.

Si todos esos archivos entran como equivalentes, el agente aprende contradicciones: programas GM falsos, acordes añadidos por el pianista, polifonía imposible, duraciones de nota artificiales o instrumentación moderna inexistente en el juego.

## Arquitectura propuesta para la skill

### Nivel 1 — Registro de fuentes

`data/snes-score-source-registry.json` documenta tipo, cobertura, fortalezas, caveats y política de uso.

### Nivel 2 — Atlas editorial

`data/snes-study-corpus.json` contiene 190 juegos distribuidos en diez familias. No almacena scores: define qué investigar y con qué preguntas.

### Nivel 3 — Manifest local

`build_score_manifest.py` registra hashes y rights status de material aportado legalmente por el usuario sin copiarlo.

### Nivel 4 — Análisis simbólico

`analyze_symbolic_scores.py` extrae notas, pitch classes, intervalos, duraciones, onset positions, canales, programas, tempo, métrica y polifonía.

### Nivel 5 — Alineación SPC

La siguiente extensión deberá incorporar un extractor SPC/S-DSP capaz de comparar canales, sample IDs, ADSR/GAIN, pitch, pan y echo con los eventos simbólicos.

### Nivel 6 — Reglas derivadas

Una regla sólo se promueve cuando aparece en cinco cues, tres juegos y al menos dos compositores cuando los créditos están disponibles. Debe conservar counterexamples y no puede contener una frase identificable.

## Nuevas habilidades que habilita

- comparar batalla normal, boss y persecución a través de múltiples franquicias;
- estudiar cómo se disimula la repetición en loops cortos y largos;
- medir cuándo un bajo funciona como raíz, contrapunto, riff o pedal;
- distinguir densidad escrita de densidad percibida;
- detectar timbres reservados para clímax o secciones;
- observar role switching dentro de ocho voces;
- aprender formas que no sean 4/4 + 16 beats;
- construir recetas por función y género con rangos y probabilidades;
- auditar si una nueva cue está demasiado cerca de una referencia.

## Límite legal y editorial

El paquete no redistribuye PDFs, MIDIs, SPCs ni samples de terceros. Sólo contiene enlaces, metadatos, hashes, features derivados y metodología. Los archivos completos deben permanecer externos o ser aportados localmente por el usuario con derechos suficientes para analizarlos.
