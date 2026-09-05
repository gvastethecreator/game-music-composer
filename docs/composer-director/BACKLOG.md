# Backlog ejecutable: identidad, control y resultados

Los tickets siguientes son **trabajo pendiente**, salvo los entregables de laboratorio/probe indicados en GMC-18. No son issues de GitHub ya creados. El orden expresa dependencias técnicas, no una estimación de calendario ni autorización para aumentar alcance automáticamente.

## Milestone 0 — Poder confiar en lo que se entrega

### GMC-00 · P0 · Integridad del paquete
**Archivos:** `scripts/package_skill.py`, `release_gate.py`, tests y `MANIFEST.sha256` dentro de la skill. **Depende:** nada.
Excluir `.pytest_cache` y otros temporales; escritura de manifiesto idempotente; diagnosticar paths sucios. Revisar el cambio relevante del PR #1 sin copiar material histórico ajeno a esta corrección. Regenerar hashes desde un checkout completo.
**Aceptación:** dos empaquetados reproducibles; prueba reubicada; manifest válido antes y después; `release_gate --check-tree` sin mutaciones inesperadas en Linux/Windows. No «arreglar» el gate desactivándolo.

### GMC-01 · P0 · Caché de render direccionada por contenido
**Archivos:** `render_mix_v4.py`, nuevo manifest de render y tests. **Depende:** 00.
Usar hashes de score/performance, muestras, calibración, código/versiones y opciones. Invalidar artefactos incompletos, corruptos o de otro backend. No reportar métricas de archivos viejos bajo la receta nueva.
**Aceptación:** cambiar una nota, una muestra, un trim o sample rate invalida; cambiar únicamente el título no necesita sintetizar otra señal; borrar WAV obliga a reconstruirlo; conservar inputs exactos permite hit verificable. El reporte identifica hash y outputs medidos.

### GMC-02 · P0 · Contrato honesto del renderer y banco
**Archivos:** wrapper, `audit_soundbank_assignments.py`, renderer, datos del banco y adaptador de showcase. **Depende:** 01.
Introducir resolución de patch por perfil/registro/velocity/articulación con muestras efectivas. Hasta implementarla, declarar original-sample render y no prometer sonido Factory equivalente.
**Aceptación:** dos patches deliberadamente diferentes producen señal diferente en la prueba correspondiente, no sólo metadata; patch inexistente falla o anuncia fallback; previews/native describen sus diferencias; provenance de los assets está disponible. No reexportar el corpus completo como sustituto de estas pruebas.

### GMC-03 · P0 · MIDI sin colisiones silenciosas
**Archivos:** `export_midis_v4.py`, `midi_compat.py`, tests binarios. **Depende:** 00.
Corregir orden off/on de misma nota en mismo tick; centralizar automatización de canales compartidos; rechazar >15 instrumentos melódicos GM hasta disponer de una política explícita; definir pickups, colas y End-of-Track.
**Aceptación:** round-trip con lector independiente; fixture de retrigger, 15/16 instrumentos, dos drums con distintos CC, notas solapadas, tiempos negativos y loop silencioso al final. Cero asignaciones de programa incompatibles en un canal. 32 voces polifónicas no se confunden con 32 canales.

### GMC-04 · P0 · Registro de capacidades y controles observables
**Archivos:** harness/schema, `build_spec`, CLI y controles del showcase. **Depende:** nada para inventario; 01/02 para prueba acústica.
Para cada control: etapa, consumidor, soporte, condiciones, unidad y evidencia. Mostrar controles no soportados como tales; no aceptar un valor que sólo decora el plan. Extender el probe a render después de arreglar caché.
**Aceptación:** matriz revisable de todos los controles, fixtures de efecto positivo y de efecto legítimamente nulo, rutas inexistentes rechazadas. Probar al menos tres semillas y configuraciones compatibles antes de declarar un control inactivo. La puntuación heurística no cuenta como prueba de efecto.

### GMC-05 · P0 · Presupuesto de voces con unidades claras
**Archivos:** wrapper, generador, reviewer y backend. **Depende:** 02.
Separar voces simbólicas, canales y voces de síntesis. Sweep exacto de on/off; tails por backend; longitudes de drums en segundos convertidas por tempo. Preasignar funciones antes de quitar notas.
**Aceptación:** solapamiento de .01 beat detectado; wrap de loop, evento más largo que un loop y colas de drums modelados explícitamente; coincidencia de métricas cuando comparten modelo. Preservar lead/bass protegidos o devolver conflicto, nunca borrado no declarado.

### GMC-06 · P0 · Una fuente de verdad para validación
**Archivos:** `neospc.py`, esquemas, harness/defaults y tests. **Depende:** 04.
Resolver perfiles 20/28 frente a 8/12/16/24/32; tipos estrictos, valores finitos, enums y claves desconocidas; diferencias plan/harness con diagnóstico accionable.
**Aceptación:** toda opción publicada crea un proyecto válido o se retira de la interfaz; NaN, Infinity, bool como entero, rangos imposibles y paths de output inseguros rechazados. Guardar compatibilidad de los proyectos actuales con migración explícita.

## Milestone 1 — Composición con identidad, no sólo más variaciones

### GMC-07 · P1 · Desacoplar producción del benchmark
**Archivos:** `benchmark_factory_map`, librería de asignaciones y pruebas de independencia. **Depende:** 02/04.
Extraer una biblioteca explícita de orquestación por función, familia, tesitura y articulación; dejar el benchmark para evaluación. No importar frases del corpus como supuesta generación original.
**Aceptación:** componer con el corpus ausente produce el mismo resultado para la misma versión de biblioteca; familia y patrón de bajo cambian dimensiones distintas; decisiones incluyen regla/fallback usado, no «consenso» invisible.

### GMC-08 · P1 · Score IR e identidad tipada
**Archivos:** nuevos módulos de score/identidad, esquemas, migradores y wrapper. **Depende:** 04/06.
Separar intención, estructura, performance y render. IDs estables para secciones, voces y notas; motivo con ritmo, intervalos/grados, respiración, ancla y preservaciones. Permitir identidad no melódica.
**Aceptación:** round-trip sin pérdida de material aprobado; plan viejo migra con reporte; rechazo de versión desconocida; cambiar prosa no cambia notas. Fixtures de tema melódico, riff y campo ambiental. El laboratorio no se acepta directamente como catálogo.

### GMC-09 · P1 · Gramáticas de frase y destinos de sección
**Archivos:** `form_sections`, `section_intensity`, funciones de frase y datos de gramática. **Depende:** 08.
Hacer explícitos presentación, continuación, liquidación, contraste, retorno y vaciado. Variar sintaxis y longitudes, no sólo instrumentación. Separar energía, tensión, densidad y registro; soportar anticlimax y final vacío.
**Aceptación:** seis briefs contrastantes producen destinos de frase verificables; safe room sin crescendo obligatorio; retorno reconoce el motivo sin copiar todo el arreglo; mínimos de respiración ajustados al género. Selección ciega de reducciones contra baseline antes de promover defaults.

### GMC-10 · P1 · Ritmo armónico y conducción de voces
**Archivos:** `parse_chord`, `chord_plan`, voicing, selección de pitches y esquema HarmonyEvent. **Depende:** 08/09.
Admitir cambios armónicos dentro de un compás y acordes sostenidos varios compases; inversiones, pedal, préstamos y notas no armónicas con resolución. Búsqueda acotada de voicings legales antes de emitir notas.
**Aceptación:** fixtures de suspensión, bajo pedal, préstamo modal, cadencia abierta y compás irregular; cero clamps silenciosos; cambio de ritmo armónico altera eventos relevantes; registro siempre válido o conflicto explícito. No premiar indiscriminadamente 100% de chord tones.

### GMC-11 · P1 · Ritmo idiomático por función
**Archivos:** generadores de bajo, drums, comp, librería de patrones y performance. **Depende:** 08/09.
Modelar agrupaciones métricas, acentos, pickups y relación kick/bass/comp. Swing dependiente del contexto, no jitter universal; fills en puntos de frase; silencio como parte del patrón.
**Aceptación:** 6/8 distingue pulsación compuesta de 3/4; 7/8 declara agrupación; 5/4 no desplaza silenciosamente todos los roles; high-tempo reduce ornamento en vez de escalar densidad sin límite. Separar tests de eventos de la escucha idiomática.

### GMC-12 · P1 · Revisión localizada, locks y seeds por etapa
**Archivos:** RevisionContract, pipeline determinista, historial y CLI nuevo sólo al implementarse. **Depende:** 08/09/10.
Transacción con base hash, scope, preserve y allowed_changes; streams locales por sección/rol. Previsualizar diff semántico y permitir deshacer.
**Aceptación:** revisar B deja byte-identidad normalizada en todos los eventos protegidos; conflictos de armonía/presupuesto se muestran; seed reproducible después de reordenar trabajo; undo restaura exactamente la versión elegida. No convertir «conservar» en autorización de modificar otras regiones.

### GMC-13 · P1 · Orquestación de funciones y espacio negativo
**Archivos:** asignación de roles, `add_*`, perfiles de banco y voice planner. **Depende:** 02/05/07/09.
Entradas/salidas por función, rangos complementarios, contrapunto que responde al lead y familias de bajo independientes del patrón. Preasignar presupuesto y registrar omisiones.
**Aceptación:** reducción intacta al ampliar paleta; exposición/dialogue dejan huecos; configuración de 8 voces no pierde el núcleo; agregar voces no obliga a usarlas. Comparar claridad a nivel perceptual comparable y con SFX, no sólo contar instrumentos.

### GMC-14 · P1 · Interpretación musical y dinámica real
**Archivos:** humanize, velocity/expression, resolver de muestras, renderer. **Depende:** 02/08/13.
Curvas de frase por instrumento, correlación de timing, articulación, velocity layers y afinación. Vibrato de pitch con cents/rate/delay; tremolo separado. Auditar cada factor de ganancia hasta señal.
**Aceptación:** desactivar humanize elimina sus offsets; frase conserva dirección dinámica; test espectral distingue vibrato/tremolo; velocity modifica ataque/zona cuando el patch lo soporte. No introducir una LFO idéntica y permanente en todas las notas.

## Milestone 2 — Demostrar que mejora

### GMC-15 · P1 · Métricas conscientes de intención
**Archivos:** `professor_review.py`, nuevos diagnósticos y fixtures adversariales. **Depende:** 08/09.
Usar estructura simbólica para variedad, performance para expresión y señal para sonido. Reconocer recurrencia declarada; separar validez, advertencias e información. Eliminar aprobación artística automática como decisión final.
**Aceptación:** A/A' intencional no dispara la misma advertencia que tile accidental; jitter no «mejora» variedad; ambiente sin lead no falla por defecto; cada warning muestra rango y evidencia. Documentar falsos positivos y no llamar plagio a coincidencias locales.

### GMC-16 · P1 · Benchmark independiente y escucha ciega
**Archivos:** fixtures de evaluación, herramienta de comparación y reportes. **Depende:** 01/02/15.
Separar material usado para diseñar defaults del holdout; conservar baseline/versiones. Comparar reducción, arreglo y contexto de juego con loudness controlado. Capturar preferencia, reconocimiento, claridad, fatiga y esfuerzo de revisión por separado.
**Aceptación:** protocolo predeclarado, orden aleatorio registrado, sin labels reveladoras, archivos frescos y reproducibles; reporte por género y discrepancias, no sólo promedio. No anunciar mejora general sin muestra y límites explícitos.

### GMC-17 · P1 · QA acústico, loops y formatos
**Archivos:** renderer, audio QA, export y fixtures. **Depende:** 01/02/03/05.
Medir true peak, nivel, DC, silencio inesperado, colas, seam y alineación. PCM como referencia; verificar cada formato después de decodificar y tener en cuenta delay/padding del codec.
**Aceptación:** fixtures con pickup, cola larga, fade, nota sostenida y transición; dos o más ciclos escuchables sin defecto no intencional; sumar stems sólo bajo su contrato; reporte de fallos sin inventar valores universales de masterización.

## Milestone 3 — Una experiencia difícil de reemplazar

### GMC-18 · P2 · Director de tres alternativas y reducción inmediata
**Incluido en este PR:** lab independiente, tres motivos originales, cuatro estados, cinco revisiones B, conservación verificada, controles de reproducción y export de sesión. **Pendiente:** conectarlo al pipeline real, comparación nivelada, proyectos persistentes y pruebas con creadores. **Depende para producción:** 08/12/16/17.
**Aceptación futura:** elegir idea sin navegar decenas de controles; oír reducción y arreglo del mismo score; ninguna selección regenera material sin permiso; handoff transparente y reproducible. Reutilizar componentes útiles del showcase en lugar de rehacerlo sin auditoría.

### GMC-19 · P2 · Familias de leitmotiv y presagios narrativos
**Archivos:** ThemeIdentity, grafo narrativo, transformaciones y UI genealógica. **Depende:** 09/10/12/16.
Derivar encuentro, peligro, traición, duelo y revelación desde identidad protegida. Permitir fragmentos discretos del tema de un jefe en cues anteriores y transformación diegética/no diegética.
**Aceptación:** pruebas de reconocimiento frente a variantes no relacionadas; diferencias de función musical, no sólo volumen; límite de exposición para no saturar la banda sonora; trazabilidad de núcleo preservado y transformaciones consentidas.

### GMC-20 · P2 · Director adaptativo y simulador de gameplay
**Archivos:** TransitionGraph, scheduler, simulador y primer adaptador de juego. **Depende:** 09/17/19.
Mezcla vertical, secuencias horizontales, bridges/stingers y reglas armónicas; hysteresis, cooldown, permanencia y prioridades. Simular telemetría ruidosa y eventos rápidos.
**Aceptación:** replay determinista de traza; nunca más de una transición comprometida incompatible; límites de latencia conocidos; cambios en puntos musicalmente seguros; stop/resume y pausa no emiten ráfagas atrasadas. No confundir next-bar con transición automáticamente correcta.

### GMC-21 · P2 · Exportación jugable y stems confiables
**Archivos:** asset manifest, stem renderer, export adapters y ejemplo de integración. **Depende:** 02/03/17/20.
Entregar puntos de loop, tempo/métrica, transiciones, stems y eventos en un contrato neutral. Implementar primero un adaptador pequeño según el proyecto piloto; FMOD/Wwise pueden empezar como documentación de importación, no compatibilidad certificada.
**Aceptación:** demo real en el motor elegido, reinicio/pausa/transición reproducibles, rutas relativas y asset hashes; medición de headroom de combinaciones; stems con origen y longitud comunes y semántica de FX explícita.

### GMC-22 · P2 · Fatiga y espacio para diálogo/SFX
**Archivos:** banco de variaciones, historial de exposición, simulador y evaluaciones largas. **Depende:** 13/16/20.
Recurrencia con memoria, variaciones de baja intensidad, silencios programados y roles reservados al juego. Incluir un modo de escucha con diálogo/SFX de prueba, no captura de micrófono implícita.
**Aceptación:** sesión de 10–20 minutos sin acumulación de densidad por defecto; decisiones de variación trazables y seed reproducible; condiciones sin música disponibles; reporte humano de fatiga y claridad sin score universal inventado.

### GMC-23 · P2 · Skill portable, onboarding y procedencia
**Archivos:** SKILL.md, referencias internas, README.es/en, agents metadata, paquete y showcase. **Depende:** 00/04/08/18 y export realmente implementado.
Integrar WORKFLOW.md de forma breve y progressive disclosure; publicar sólo comandos reales. Mostrar una vertical completa y compartir recipes con assets originales/licenciados, sin copiar bancos comerciales ni exigir API de pago.
**Aceptación:** agente nuevo produce el flujo documentado desde ZIP reubicado; tabla de capacidades verificada por tests; provenance por asset; texto del showcase distingue demo, generación, render y compatibilidad. Medir selección de idea, revisiones conservadas y llegada al juego con consentimiento, sin trackers por defecto.

## Orden de integración y gates

`00 → 01/03`, `04 → 06`, `01 → 02 → 05/07`; luego `08 → 09 → 10/11/12/13 → 14/15`; después evaluación `16/17` y una vertical `18 → 19 → 20 → 21`. Fatiga y distribución se cierran con 22/23. Puede haber investigación paralela, pero no anunciar una integración antes de pasar sus dependencias.

Gate A: outputs confiables. Gate B: control musical causal. Gate C: preferencia y revisión demostradas. Gate D: uso real en juego. **No expandir el catálogo ni construir infraestructura comercial como sustituto de pasar estos gates.**
