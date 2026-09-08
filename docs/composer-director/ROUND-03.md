# R03 — Ensemble Atelier y extensión de la skill

Fecha: 2026-09-08. Base del incremento: PR #2 en `fb064a0a4b28343428d7c2a270f77ab57739c581`. No se fusiona el PR ni se regeneran los 100 cues.

## Lo que se incorpora de R02

Cinco experimentos independientes: Instrumentarium, Pocket, Conversación, Atlas de gramáticas y Ciclos entrelazados. Comparten contrato de eventos, síntesis y piano roll, no una supuesta gramática universal. Se incluyen 59 identidades instrumentales sobre 13 familias visuales, diez gramáticas sintéticas audibles y 18 fichas de investigación. Las 22 fuentes se conservan con sus límites; una explica otra y no debe contarse como estudio independiente.

La variedad de R02 no se presenta como una mejora automática del generador Neo-SPC. El Atlas y los procesos permanecen en el motor de experimentación del navegador. Una identidad visual no equivale a una emulación acústica independiente.

## Pulido visual implementado

Se reemplazan superficies genéricas por cuerpos SVG con geometría original, materiales, profundidad y detalles reconocibles: teclas blancas/negras, caja y mástil, arco, agujeros y llaves, válvulas, fuelles, láminas, cuerdas de arpa, lengüetas y percusión. El contrabajo pizzicato ya no aparece como una guitarra eléctrica. La ocarina no comparte la misma silueta de una flauta larga.

Cada instrumento puede ampliarse en un diálogo con pads de notas exactas. Los pads sirven de alternativa cuando la ilustración no representa cómodamente todas las alturas. Hay selección, mute/solo, registro de ataques, notas iluminadas y piano roll editable. La ilustración no valida digitación, posiciones del arco ni física de los instrumentos; los controles decorativos no se presentan como parámetros activos.

La interfaz tiene menos énfasis de landing page y más de sala de escucha: jerarquía compacta, materiales discretos y menor competencia con la partitura. Movimiento suave o desactivado, preferencia de movimiento reducido y escape/foco explícitos. No se declara conformidad WCAG de toda la aplicación.

## Visuales vinculadas a datos reales

El instrumento muestra las notas activas. El historial registra ataques, no una animación aleatoria. VEL representa velocity del evento, no potencia acústica. El osciloscopio separado lee la señal sintética posterior al master y presenta una aproximación de pico dBFS, no LUFS o true peak certificado.

Las vistas usan una estimación del reloj de salida mediante `getOutputTimestamp` cuando existe; el fallback es el reloj del AudioContext. Esto reduce una discrepancia conceptual entre reloj de programación y salida, pero no certifica latencia de hardware en todos los dispositivos.

## Audio: fallo real corregido

La síntesis inicial de voces podía bloquear el hilo de interfaz, retrasar el reloj y detener playback en el primer acorde. El nuevo arranque prepara voces únicas con un Worker local, muestra progreso y admite cancelar. La reproducción comienza después; las repeticiones aprovechan caché. Se limita la memoria estimada a 64 MiB y se rechazan preparaciones demasiado grandes en lugar de truncar música silenciosamente.

Se conservan controles de seguridad de tiempo: ante retrasos largos se detiene el transporte, no se dispara una ráfaga atrasada. Cambiar de documento o esconder la pestaña para el audio. La síntesis en vivo y el WAV comparten función de voz. El WAV es snapshot PCM16 estéreo a 32 kHz con cola; no master, stems ni loop gapless.

## Ahora sí hay una extensión instalada

`visualize_score.py` crea HTML autónomo desde un score/catalog/session o uno de cinco demos. Recursos relativos a la skill, sin Node, APIs, fonts o dependencias de render Python. Valida límites básicos y neutraliza cierres de script en datos; el importador del navegador aplica restricciones adicionales. No replica samples, CC/buses ni todo el formato de interpretación nativo. Los fallbacks y pérdidas son visibles.

`refine_performance.py` procesa composición o catálogo nativo sin mutar la entrada. Los perfiles chamber/pocket/ritual cambian timing, gate y velocity reales. La estructura escrita queda identificada mediante hash; amount cero conserva el contenido, aplicar dos veces se rechaza y un conflicto de voces genera error sin borrar notas. Es una intervención interpretativa, no un reemplazo del compositor ni una promesa de mayor gusto musical.

`SKILL.md` se actualiza con comandos reales, límites y un workflow de identidad, estructura, interacción e interpretación. La versión anterior completa se preserva en `references/canonical-compose-workflow.md` para no perder el procedimiento de banco, mezcla y exportación. Dos referencias nuevas desarrollan visualización y dirección compositiva.

## Paquete e integración

Se adoptan selectivamente `package_skill.py`, `release_gate.py` y su test nativo del commit `ed547b7a7d8bc1350fb40fc6fdeb0c9bd1f7186f` del PR #1 cerrado: exclusión de pytest cache, manifiesto idempotente y errores de árbol más claros. No se recuperan documentos internos eliminados de aquella rama. `.local/` sigue ignorada; `.gitattributes` fija LF para archivos de texto.

El manifiesto se actualiza con hashes de los archivos nuevos/modificados. Los hashes de activos antiguos no disponibles localmente se heredan del manifiesto corregido del PR #1; esto no equivale a haber vuelto a leer todas las muestras. El gate completo debe ejecutarse en checkout íntegro.

## Estado respecto al backlog anterior

| Ticket | Progreso en esta ronda | Qué sigue pendiente |
|---|---|---|
| GMC-00 | Correcciones de paquete y manifiesto incorporadas. | Pase integral de release/relocation con todos los activos. |
| GMC-04 | Capacidades nuevas y sus límites explícitos en SKILL. | Matriz completa de controles del generador nativo. |
| GMC-08/12 | Invariantes y hashes para intervención interpretativa. | IR completo y recomposición nativa localizada. |
| GMC-14 | Refinamiento conservador por frase/rol y campos nativos. | Articulaciones por instrumento, bancos/paridad y validación de escucha. |
| GMC-18 | Cinco experiencias reales y rediseño de instrumentos. | Evaluación de creadores y un flujo de producción unificado. |
| GMC-23 | Visor y guías dentro de la skill portable. | Onboarding validado desde release completo y export de juego. |

GMC-01/02/03/05 siguen críticos: caché de render nativo por contenido, resolución/paridad de bancos, MIDI sin colisiones y voces con colas reales. No están corregidos por un frontend más agradable. La skill instruye usar una carpeta nativa de render NUEVA por revisión para evitar reutilización de audio viejo.
