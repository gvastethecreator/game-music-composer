# Validación R03 — evidencia y límites

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
