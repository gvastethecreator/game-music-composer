# Game Music Composer

Skill para escribir música de juego expresiva, inspirada en SNES y lista para loop. Convierte una escena concreta en un plan de composición, una receta completa, datos de partitura, MIDI Type-1 y previews opcionales.

## Primer uso

Ejecuta desde esta carpeta:

```bash
python scripts/neospc.py doctor --strict
python scripts/neospc.py init work/ash-crown --title "Ash Crown" --category action --game-function "boss entrance" --game-context boss --mood dread --meter 7/8 --voices 16 --bars 16
python scripts/neospc.py validate work/ash-crown/composition-plan.json work/ash-crown/generation-harness.json --strict
```

El plan guarda la función en el juego, el cambio emotivo, la forma, el loop, el límite de voces y los controles de calidad. El harness guarda los 15 grupos de control de composición y producción.

Lee `SKILL.md` para seguir el flujo completo. Conserva `composition-plan.json`, el harness y el JSON de la partitura como fuentes del proyecto.

## Comandos

- `doctor`: revisa JSON, schemas, templates, scripts, el corpus de 100 cues y el banco de 50 patches.
- `init`: crea un plan y una receta válidos desde un brief.
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
