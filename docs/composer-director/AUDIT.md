# Auditoría técnica y compositiva

Fecha: 2026-09-05. Fuente: `main@1d562a79bddfba90bcf170309bd384733a1943c5`. Revisión directa de SKILL.md, harness, wrapper de composición, funciones centrales del generador, revisor simbólico, renderer, exportador MIDI, manifiesto y PR #1. No es una audición de los 100 temas ni una auditoría exhaustiva del frontend/histórico.

## Lo que conviene conservar

La skill ya prioriza reducción, forma, respiración, desarrollo motívico y presupuesto de voces como techo, no como objetivo de saturación. Ya existe generación determinista, CLI portable, separación entre runtime y materiales históricos, un showcase y documentación que reconoce que `professor_review` es heurístico, no una persona escuchando. La propuesta profundiza esos principios y corrige la distancia entre intención, parámetros y realización; no atribuye al proyecto la ausencia de todo eso.

## Hallazgos confirmados por lectura del código

Los enlaces relativos apuntan al árbol de este PR; las observaciones se refieren al commit base indicado arriba. «Confirmado» significa comportamiento de código observado, no mejora sonora demostrada por una prueba de escucha.

### F01 · P0 · Un render anterior puede hacerse pasar por el resultado nuevo

Fuente: [`render_mix_v4.py`](../../game-music-composer/scripts/render_mix_v4.py), `render_style`, bloque `if ogg.exists() and mp3.exists()`.

La presencia de OGG y MP3 activa la reutilización sin comparar score, muestras, calibración, renderer ni opciones; tampoco requiere el WAV. El reporte combina audio anterior con el número de eventos de la composición actual. Esto puede invalidar cualquier comparación «antes/después». Solución: caché direccionada por contenido y comprobación de artefactos, no sólo existencia. Ticket GMC-01.

### F02 · P0 · Asignar un Factory Patch no implica oírlo en el render nativo

Fuentes: [`compose_from_plan.py`](../../game-music-composer/scripts/compose_from_plan.py), `apply_factory_assignments`; [`render_mix_v4.py`](../../game-music-composer/scripts/render_mix_v4.py), `load_samples` y `render_style`.

La asignación agrega `factory_patch`, pero el renderer selecciona `instrument_map[inst]['sample']` del banco original. No resuelve ese patch para producir la señal. El help de `neospc render` ya lo describe como preview con el banco original: la brecha está en la expectativa y el contrato entre etapas, no en incumplir ese help. Esto no demuestra que el reproductor del showcase esté mal; demuestra que los backends no deben presentarse como equivalentes sin un contrato. Publicar backend, parche realmente resuelto, muestras efectivas y limitaciones por exportación. GMC-02.

### F03 · P0 · El MIDI puede reutilizar un canal de otro instrumento

Fuente: [`export_midis_v4.py`](../../game-music-composer/scripts/export_midis_v4.py), `export`: asignación `melodic[ci % len(melodic)]`.

Tras 15 pistas melódicas, una nueva pista comparte canal con una anterior y ambos program changes gobiernan el mismo canal. Tener 32 voces simultáneas no equivale a disponer de 32 canales MIDI. La solución inicial segura es un error explicativo; después, una política explícita de puertos/partición o de instrumentos compatibles, no módulo silencioso. GMC-03.

### F04 · P0 · Orden de retrigger y automatización de percusión

Fuente: el mismo `export`. `note_on` tiene prioridad 0 y `note_off` prioridad 1 al ordenar un tick. En una repetición de la misma nota/canal, el off anterior puede apagar el nuevo ataque. Las pistas de percusión comparten canal 9 indexado desde cero, pero cada una escribe CC7/10/91 y CC11: no son controles independientes por pista. Consolidar el dueño de automatización de canal y definir semántica de retrigger y loop. GMC-03.

### F05 · P1 · El harness promete más superficie de control que la ruta de composición consume

Fuentes: [`generation-harness-v3.json`](../../game-music-composer/data/generation-harness-v3.json) y `compose_from_plan.build_spec`.

`build_spec` no transfiere las secciones `humanize`, `mix` y `render` al motor. Tampoco transfiere, por ejemplo, `harmony.harmonic_rhythm_bars`, `orchestration.density_curve` ni `drums.fill_rate`. Algunos pueden pertenecer a otra etapa: hay que trazar consumidor por consumidor antes de etiquetarlos como no implementados. La interfaz necesita un registro de capacidades y pruebas por etapa. El nuevo probe sólo mide compose y declara ese límite. GMC-04.

### F06 · P1 · Familia de bajo y elección de preset se pisan

Fuente: `compose_from_plan.build_spec`: `BASS_PRESETS.get(preset, BASS_FAMILIES[family])`.

Cuando el preset es reconocido, determina el patrón; cambiar la familia no cambia esa selección. La asignación posterior también depende del instrumento genérico y del consenso del benchmark. Separar **comportamiento** de bajo de **familia sonora**, y probar ambos factores de manera independiente. No basta con renombrar metadatos. GMC-07 y GMC-13.

### F07 · P1 · El corpus de evaluación participa en decisiones de producción

Fuente: `benchmark_factory_map`, lectura del benchmark completo y parche más frecuente por instrumento.

El benchmark no se está copiando como una frase musical en esa función, pero sí decide asignaciones. Conviene convertir las asignaciones aprobadas en una biblioteca de producción explícita y versionada. El corpus de evaluación debe poder retirarse sin que componer un cue cambie de sonido o deje de funcionar. GMC-07.

### F08 · P1 · Tres significados distintos de «voces»

Fuentes: `compose_from_plan.first_overflow`, `generate_neospc100_v3.peak_polyphony`, `professor_review.polyphony_profile`, renderer.

El wrapper y generador aproximan cada drum como .12 beats. El revisor muestrea cada .25 beats y sólo notas; puede perder solapamientos breves. El audio incluye longitud de muestra y release en segundos. Separar polifonía simbólica, canales MIDI y voces activas del backend. El render circular sí pliega colas: no se diagnostica aquí un inexistente corte universal del loop. GMC-05.

### F09 · P1 · «Vibrato» nativo es modulación de amplitud

Fuente: `render_style`, multiplicación de `y` por `1 + .025 * depth * fade * sin(...)`.

La frecuencia del tono no varía en esa operación: es un comportamiento de tremolo. La corrección necesita unidades explícitas de profundidad en cents, fase/retardo, caché y pruebas de frecuencia, no un cambio de etiqueta. Además, el nivel usa `velocity_gain` y trims por rol; no consume directamente todos los campos `gain`/`performance_gain`. Auditar la cadena completa de ganancia antes de prometer dinámica. GMC-14.

### F10 · P1 · La forma tiene un sesgo fijo hacia el final más intenso

Fuente: [`generate_neospc100_v3.py`](../../game-music-composer/scripts/generate_neospc100_v3.py), `section_intensity`.

La última sección recibe base 1.0 antes de evaluar un objetivo de desescalada, y otras decisiones dependen de nombres/palabras clave. Esto restringe retornos vacíos, anticlímax, safe rooms y formas que necesitan soltar tensión. Se propone función musical tipada y curvas independientes de energía, tensión y densidad. No se afirma que el motor carezca de desarrollo motívico: ya tiene mecanismos de frase. GMC-09.

### F11 · P1 · Limitar MIDI por clamp puede cambiar la armonía

Fuente: `event_note` en el mismo generador: clamp al mínimo/máximo del instrumento.

Un límite de registro no necesariamente es una nota de la escala/acorde activo. Varias notas distintas pueden colapsar al mismo extremo. Resolver restricciones en la selección de nota/voicing y registrar los casos inviables; no ocultarlos corrigiendo a posteriori. GMC-10.

### F12 · P1 · Algunas métricas confunden interpretación con composición

Fuente: [`professor_review.py`](../../game-music-composer/scripts/professor_review.py), `topology_by_bar`, `melodic_metrics`, `harmonic_metrics`.

Las firmas usan `performance_beat` y duraciones humanizadas. Un poco de jitter puede inflar variedad o cambiar la clasificación de un ataque fuerte. Las colisiones de registro se estiman a partir de rangos por instrumento, no enmascaramiento simultáneo. Usar timing simbólico para estructura y timing interpretado para performance; mantener las métricas como diagnósticos. GMC-15.

### F13 · P1 · Repetición intencional y similitud entre cues necesitan contratos diferentes

Fuente: `identity_metrics`, comparación de prefijos de 8–12 intervalos y pares de frases.

A/A' o el retorno de un leitmotiv no son automáticamente pobreza compositiva. Un prefijo similar tampoco demuestra plagio, y uno distinto no garantiza originalidad. Etiquetar recurrencias deliberadas; medir motivos por intervalos y ritmo a varias escalas, con inspección de falsos positivos y revisión humana. GMC-15/16.

### F14 · P0 · Contradicción de perfiles entre harness y CLI

Fuentes: `generation-harness-v3.json`, `brief.voice_budget` admite 20 y 28; [`neospc.py`](../../game-music-composer/scripts/neospc.py), `VOICE_PROFILES` y `validate_plan`, sólo 8/12/16/24/32.

Elegir una fuente única de capacidades. No resolverlo aumentando a ciegas el presupuesto ni mezclando validación de planes con perfiles del benchmark. Probar todas las opciones expuestas y rechazo de NaN/Infinity, bool como entero y claves desconocidas. GMC-06.

### F15 · P0 · El manifiesto incluye caché de tests

Fuente: primeras cuatro entradas de [`MANIFEST.sha256`](../../game-music-composer/MANIFEST.sha256), que incluyen `.pytest_cache`. [PR #1](https://github.com/gvastethecreator/game-music-composer/pull/1) documentó una corrección y está cerrado sin merge en la consulta realizada.

Revalidar hashes de un checkout limpio, excluir cachés y comprobar que empaquetar no cambia el árbol. No importar el diff completo del PR anterior: contiene historia y el listado de archivos/diff consultado no fue suficiente para asumir una integración limpia. Este PR no refresca el manifiesto ni acredita un pase del release gate. GMC-00.

## Hipótesis de producto, no hallazgos acústicos

Es plausible que identidad protegida, direcciones contrastantes y prueba contra gameplay aporten más valor que más presets. Debe demostrarse con selección ciega, capacidad de revisión y uso en un juego real. No se ha demostrado aquí que una composición guste más, que el banco tenga calidad profesional o que el producto tenga demanda masiva.
