# Composer Director — estado consolidado

**Actualización: 8 de septiembre de 2026, ronda R03 / Ensemble Atelier.** El PR ahora modifica la skill distribuible: incorpora visor, herramientas de interpretación, recursos visuales y tests. La afirmación de la primera ronda de que el runtime permanecía intacto ya no describe el incremento actual.

La [integración local en Windows](VALIDATION-R03.md#integración-local-en-windows--8-de-septiembre-de-2026) añade correcciones de timing circular, edición, transporte, selector y paquete. Incluye prueba desde ZIP reubicado y un recorrido real de composición → refinamiento → MIDI/audio → visor desde disco. El commit sigue pendiente.

| Leer | Contenido |
|---|---|
| [ROUND-03.md](ROUND-03.md) | Cambios implementados, promoción de R02 y estado de tickets. |
| [VALIDATION-R03.md](VALIDATION-R03.md) | Evidencia actual y lo que no se ha probado. |
| [RESEARCH-R03.md](RESEARCH-R03.md) | Investigación adicional, prioridades y criterios para próximos experimentos. |
| [repertoire.json](repertoire.json) | 18 líneas de repertorio con fuentes, estado y límites. |
| [SKILL.md](../../game-music-composer/SKILL.md) | Entrada ejecutable actual y comandos disponibles. |

## Probar la evolución

```bash
python tools/build_ensemble_atelier.py
```

Abrir `.scratch/ensemble-atelier/index.html`. Los cinco HTML independientes exploran instrumento, interpretación, conversación, gramática y ciclos. La vista ampliada y los pads exactos permiten tocar e inspeccionar cada voz. El visor puede generarse también desde un score nativo con `scripts/visualize_score.py`, desde el directorio de la skill.

R02 se incorpora como código fuente compartido y demos generables: no se duplican cinco grandes HTML en el paquete ni se copian WAV de prueba al runtime. R03 pule todas las superficies y el transporte. Los informes/capturas/WAV de la sesión se entregan aparte; los runners reproducibles están en el repositorio.

## Primera ronda conservada como histórico

[AUDIT.md](AUDIT.md), [WORKFLOW.md](WORKFLOW.md), [ARCHITECTURE.md](ARCHITECTURE.md), [BACKLOG.md](BACKLOG.md), [EVALUATION.md](EVALUATION.md), [SOURCES.md](SOURCES.md) y [VALIDATION.md](VALIDATION.md) describen la auditoría y el incremento del 5 de septiembre. Sus resultados históricos no son resultados de R03. El backlog original GMC-00…23 se mantiene para evitar cerrar tareas mayores por haber implementado sólo una parte.

La oportunidad sigue siendo la misma: **elegir una identidad, conservarla, transformarla y revisar una región sin perder una buena toma**. Más controles y mejores dibujos no sustituyen la prueba musical. La evolución se decide con reducción, arreglo y gameplay, no con un promedio de tests.
