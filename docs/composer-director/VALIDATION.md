# Evidencia de validación del incremento

Fecha: 2026-09-05. Entorno local: Python 3.13.5, Node 22.16.0, Chromium 144.0.7559.96 en Linux.

## Ejecutado

| Comprobación | Resultado | Alcance |
|---|---|---|
| `python -m unittest discover -s tests -p "test_*.py" -v` | 18 tests PASS | Hashes, mutación aislada, rechazo de inputs, preservación del proyecto y protocolo CLI usando fixture sintético. |
| `node --test tests/test_director.cjs` | 20 tests PASS | 12 combinaciones tema/estado, notas finitas y acotadas, determinismo, conservación fuera de B, cinco B distintas, reducción, validación y parseo del script de UI. |
| Playwright con Chromium | 11 comprobaciones PASS | 3 temas, 4 estados, reproducción, cambio de estado programado, stop sin voces/timer, bloqueo, preservación, descarga JSON, layouts 1440×1100 y 390×844, controles con reduced motion. |
| Errores JS / solicitudes externas observadas | 0 / 0 | Recorrido anterior; no garantiza todos los navegadores o combinaciones. |
| Síntesis OfflineAudioContext | PASS | Reducción sintética de 8 s a 48 kHz, 384000 frames, valores finitos, peak 0.068723 y RMS 0.023300 aproximadamente. No es render Neo-SPC ni evaluación artística. |

El documento del navegador se cargó mediante `page.set_content`, insertando `director.js` en el HTML. La política del navegador del entorno bloqueó la navegación `file://` y HTTP local. **No se acredita con esta prueba la carga del sitio servido ni la apertura directa desde disco**, aunque el documento y su descarga Blob sí se ejercitaron. Se revisaron visualmente las capturas de escritorio y móvil.

Para repetir las comprobaciones opcionales del navegador, disponer de Playwright y Chromium; no son dependencias del runtime:

```bash
python tests/browser_director.py --out-dir .scratch/director-browser-proof --chromium /ruta/al/ejecutable/chromium
```

Omitir `--chromium` usa el Chromium del PATH, o el de Playwright si no se encuentra. Elegir un directorio nuevo; se guardan JSON y capturas. El test del navegador usa una opción de autoplay para headless, pero también pulsa Escuchar: no acredita las políticas de autoplay de todos los dispositivos.

## Preparado, pero no acreditado como ejecutado localmente

El workflow `Composer Director lab` añade Linux/Windows, Python 3.12 y Node 22, además de una prueba sobre `neospc.py` real: inicializa un cue y compara controles de melody/rest, seed y humanize/timing. El estado de ese workflow debe leerse del run del PR; no confundir su presencia con un PASS.

No se contó con un checkout completo y ejecutable del runtime y sus assets en el entorno de trabajo; se leyó el código mediante el conector de GitHub. Por eso las pruebas Python de integración locales usan un fixture que respeta el protocolo del CLI. **No son evidencia de que el probe completo haya pasado contra el motor real.**

No se ejecutaron el release gate completo, el empaquetado portable, los 100 renders, una prueba nativa de Factory Bank, round-trip del exportador MIDI actual, una sesión musical ciega, una prueba de fatiga ni integración con un juego. No se acreditan Safari/Firefox, Windows local, hardware de audio o dispositivos móviles físicos.

## Interpretación

Los tests demuestran propiedades específicas del incremento, no que la música «sea mejor» o que el usuario prefiera estos bocetos. La evaluación de producción está definida en EVALUATION.md. Los hallazgos del motor son de lectura de código salvo que se indique una ejecución posterior con su evidencia.
