# Mezcla, velocity y control de calidad — Neo-SPC v2.1

## Problema diagnosticado

El renderer v2.0 aplicaba `gain` directamente sobre muestras cuyo nivel intrínseco variaba más de 20 dB y normalizaba el resultado después de sumar todas las voces. Eso conseguía un pico global controlado, pero no una mezcla: una muestra sostenida y naturalmente fuerte podía tapar un arpa, una guitarra o un piano aunque ambas partes fueran musicalmente importantes.

La auditoría del benchmark v2.0 encontró:

- rango de nivel RMS activo entre samples: más de 20 dB;
- loudness integrado de previews: aproximadamente −16,9 a −11,2 LUFS;
- rango dinámico de corto plazo: aproximadamente 4,3 a 17,2 dB;
- `velocity` MIDI derivado casi directamente del mismo `gain` usado por el audio.

## Cambio de arquitectura

### 1. Calibración de fuentes

Cada sample recibe una compensación previa. Los loops sostenidos se calibran mediante RMS activo; percusión y transientes se calibran principalmente por pico y crest factor. Los trims están limitados para evitar convertir una muestra delicada en un elemento agresivo.

### 2. Mezcla por buses

Las voces se enrutan por función musical:

- lead;
- bass;
- drums;
- rhythm;
- harmony;
- atmosphere;
- FX.

Cada bus dispone de nivel activo objetivo, filtrado, compresión, anchura estéreo y prioridad. Esto permite que un lead sea foreground sin exigir que todas sus notas tengan una velocity máxima.

### 3. Automatización de prioridad

Cuando el lead está activo, harmony, rhythm y atmosphere ceden entre aproximadamente 1 y 2,5 dB según categoría. Kick y bass utilizan ducking muy moderado en acción, electrónica y música urbana. El objetivo no es un sidechain audible, sino reducir masking.

### 4. Loudness y dinámica

La medición usa el enfoque de loudness de ITU-R BS.1770. Neo-SPC no adopta el objetivo broadcast de EBU R 128 de −23 LUFS; utiliza objetivos editoriales por categoría entre −14,8 y −17 LUFS para previews web, conservando un techo cercano a −1 dBFS y evitando normalizar únicamente por pico.

Fuentes:

- ITU-R BS.1770-5: https://www.itu.int/rec/R-REC-BS.1770-5-202311-I
- EBU R 128: https://tech.ebu.ch/publications/r128
- EBU Tech 3342, Loudness Range: https://tech.ebu.ch/publications/tech3342
- EBU Tech 3343, Production Guidelines: https://tech.ebu.ch/publications/tech3343

## Velocity MIDI

La versión anterior trataba `gain` y `velocity` como casi la misma variable. La v2.1 los separa:

- CC7: balance de pista;
- note velocity: energía del ataque y articulación;
- CC11: dinámica de sección y frase;
- CC10: panorama;
- CC91: envío espacial.

La velocity se calcula desde rol, acento métrico, arco de frase, sección formal, repetición y posición dentro de un voicing. El catálogo resultante utiliza 95 valores distintos, con un rango de 28 a 123, en lugar de concentrar la mayor parte de los eventos alrededor de unos pocos niveles.

La investigación de performance expresiva considera timing, dinámica y articulación como variables contextuales y jerárquicas, no como ruido aleatorio independiente.

Fuentes:

- Earis, expressive timing and dynamics: https://journals.sagepub.com/doi/10.1177/102986490701100202
- MIDI-DDSP: https://arxiv.org/abs/2112.09312
- GigaMIDI expressive heuristics: https://arxiv.org/abs/2502.17726
- ACCompanion: https://arxiv.org/abs/2304.12939

## Control de calidad compositiva

La mezcla puede revelar una composición; no puede arreglarla. La v2.1 incorpora una cola de revisión separada de la auditoría técnica. Evalúa variedad de topología rítmica, curva de densidad, contraste entre secciones, respiración, intervalos, duplicación exacta y repetición apropiada para el género.

El catálogo actual contiene 67 temas clasificados como `curated`, 31 como `review` y 2 como `rebuild`. Estos últimos permanecen accesibles como material de benchmark, pero no deben considerarse aprobados artísticamente por el simple hecho de pasar armonía, registro o polifonía.
