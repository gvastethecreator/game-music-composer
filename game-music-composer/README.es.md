# Game Music Composer

Skill para escribir música de juego expresiva, inspirada en SNES y lista para loop. Convierte una escena concreta en un plan de composición, una receta completa, datos de partitura, MIDI Type-1 y previews opcionales.

## Primer uso

Ejecuta desde esta carpeta:

```bash
python scripts/neospc.py doctor --strict
python scripts/neospc.py init ../ash-crown --title "Ash Crown" --category action --game-function "boss entrance" --game-context boss --mood dread --meter 7/8 --voices 16 --bars 16
python scripts/neospc.py validate ../ash-crown/composition-plan.json ../ash-crown/generation-harness.json --strict
python scripts/neospc.py compose ../ash-crown
python scripts/neospc.py export-midi ../ash-crown/catalog.json ../ash-crown/midi
```

El plan guarda la función en el juego, el cambio emotivo, la forma, el loop, el límite de voces y los controles de calidad. El harness guarda los 15 grupos de control de composición y producción.

Lee `SKILL.md` para seguir el flujo completo. Conserva `composition-plan.json`, el harness y el JSON de la partitura como fuentes del proyecto.

## Inspeccionar y refinar una partitura

```bash
python scripts/visualize_score.py --input ../ash-crown/composition.json --output ../ash-crown/atelier.html
python scripts/refine_performance.py ../ash-crown/catalog.json ../ash-crown/catalog-performed.json --profile chamber --amount 0.5
python scripts/neospc.py validate ../ash-crown/catalog-performed.json --strict
python scripts/neospc.py render ../ash-crown/catalog-performed.json ../ash-crown/audio-performed-new
```

El HTML autónomo incluye instrumentos tocables, piano roll y exportación de sesión JSON y WAV de boceto. Su síntesis no usa el banco nativo. Para explorar sin una partitura, sustituye `--input` por `--demo instrumentarium`, `pocket`, `conversation`, `atlas` o `cycles`.

El refinador cambia timing, gate y velocity interpretados; conserva las notas escritas. Ofrece los perfiles `chamber`, `pocket` y `ritual`. Cada revisión parte del catálogo original. Los dos helpers rechazan archivos de salida existentes. Usa una carpeta nueva para conservar cada revisión: la caché exige fingerprints coincidentes y las salidas requeridas, no sólo archivos existentes. Consulta los límites de [Ensemble Atelier](references/49-ensemble-atelier.md) y los formatos y recibos de [cada backend](references/57-sound-backends.md).

## Comandos

Los contratos de escenas viven en `data/catalog-contracts-r03.json` y los de grooves en `data/genre-expansion-contracts.json`. Definen sujetos, respuestas, frases, armonía, silencios por rol e intensidad por sección. Para reconstruir el catálogo desde el repositorio fuente, revisa `tools/rebuild_full_catalog.py`, que combina ambos conjuntos. La entrada antigua `tools/regenerate_catalog.py` exige un catálogo de escenas y no acepta el corpus combinado actual. Estas herramientas no están en la skill portable; usa `init` y `compose` para una pieza individual.

Usa la revisión y la auditoría de exportación de la versión del catálogo entregada; los conteos históricos de aprobación y puertos no son evidencia vigente. La aprobación simbólica no demuestra escucha ni aceptación en juego. Los MIDI con más de 15 instrumentos melódicos requieren un reproductor o DAW que respete los metadatos MIDI Port. Cada instrumento melódico tiene un par puerto/canal propio.

- `doctor`: revisa JSON, schemas, templates, scripts, corpus y banco; informa sus conteos actuales.
- `init`: crea un plan y una receta válidos desde un brief.
- `compose`: genera la partitura y un catálogo desde el plan, el harness y la semilla.
- `validate`: revisa planes, recetas, cues y catálogos con rutas JSON exactas.
- `review`: aplica una rúbrica de partitura estable al catálogo.
- `export-midi`: genera MIDI Type-1 y un informe; incluye un fallback sin paquetes externos.
- `audit-bank`: informa IDs de patches y avisos de rango; no certifica adecuación al rol ni reproducción.
- `render`: exporta audio y recibos cuando están disponibles las dependencias opcionales de su backend; consulta [los formatos](references/57-sound-backends.md).

## Pruebas

`data/neospc100-benchmark-v4.1.json` conserva su nombre histórico y contiene el corpus de prueba actual. No debe usarse como fuente de frases. Consulta `LICENSE-NOTES.md` y `SOURCES.md` antes de distribuir samples.

El material histórico de reconstrucción v3/legacy se conserva aparte para mantenimiento y no hace falta para usar la skill.

Para mantenimiento, elige las comprobaciones afectadas. `--smoke` repite la suite tras extraer el paquete y escribe el manifest y el ZIP.

```bash
python -m unittest discover -s scripts/tests -v
python scripts/package_skill.py --smoke
python scripts/release_gate.py
```

`render` es opcional. Instala sus dependencias locales fijadas con `python -m pip install -r requirements-render.txt` y deja `ffmpeg` disponible en `PATH` antes de pedir WAV, OGG o MP3.
