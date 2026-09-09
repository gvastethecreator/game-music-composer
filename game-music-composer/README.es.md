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

El refinador cambia timing, gate y velocity interpretados; conserva las notas escritas. Ofrece los perfiles `chamber`, `pocket` y `ritual`. Cada revisión parte del catálogo original. Los dos helpers rechazan archivos de salida existentes. Usa una carpeta nueva por render: el motor actual reutiliza audio por existencia de archivos. Consulta los límites de [Ensemble Atelier](references/49-ensemble-atelier.md) y el [procedimiento de entrega](references/canonical-compose-workflow.md).

## Comandos

El catálogo completo se reconstruye desde `data/catalog-contracts-r03.json`: 100 contratos revisados con frases explícitas, ritmo armónico, texturas contrastantes, silencios escritos por rol e intensidad por sección. El generador nativo consume estos campos. `generate_neospc100_v3.py --output ../catalog-base` genera las partituras base; la herramienta `tools/regenerate_catalog.py` del repositorio añade bancos, interpretación, revisión y publicación verificada.

La revisión simbólica del catálogo regenerado marca 74 cues aprobados y 26 para revisar. La escucha y la aprobación en juego siguen pendientes. Siete MIDI usan más de 15 instrumentos melódicos y requieren un reproductor o DAW que respete los metadatos MIDI Port. Cada instrumento melódico tiene un par puerto/canal propio.

- `doctor`: revisa JSON, schemas, templates, scripts, el corpus de 100 cues y el banco de 50 patches.
- `init`: crea un plan y una receta válidos desde un brief.
- `compose`: genera la partitura y un catálogo desde el plan, el harness y la semilla.
- `validate`: revisa planes, recetas, cues y catálogos con rutas JSON exactas.
- `review`: aplica una rúbrica de partitura estable al catálogo.
- `export-midi`: genera MIDI Type-1 y un informe; incluye un fallback sin paquetes externos.
- `audit-bank`: revisa patches, cobertura de roles y rangos.
- `render`: genera WAV, OGG y MP3 cuando NumPy, SoundFile y FFmpeg están disponibles.

## Pruebas

`data/neospc100-benchmark-v4.1.json` sirve como corpus de prueba y guía de estructura. No debe usarse como fuente de frases. Consulta `LICENSE-NOTES.md` y `SOURCES.md` antes de distribuir samples.

El paquete runtime sólo contiene el corpus v4.1 y las herramientas canónicas. El material histórico de reconstrucción v3/legacy se conserva aparte para mantenimiento y no hace falta para usar la skill.

```bash
python -m unittest discover -s scripts/tests -v
python scripts/package_skill.py --smoke
python scripts/release_gate.py
```

`render` es opcional. Instala sus dependencias locales fijadas con `python -m pip install -r requirements-render.txt` y deja `ffmpeg` disponible en `PATH` antes de pedir WAV, OGG o MP3.
