# Workflow propuesto para mejorar la skill

Este documento es utilizable como guía de trabajo en el repositorio. **No es una actualización ya instalada de `game-music-composer/SKILL.md`**. La incorporación a la distribución depende de GMC-00/04/08 y de publicar un registro verdadero de capacidades.

## 1. Leer el trabajo como una escena, no como una lista de adjetivos

Registrar función de juego, duración útil, límites de repetición, espacio ocupado por diálogo/SFX, restricciones del motor, paleta sonora y qué debe reconocer el jugador. Separar las respuestas del usuario de las suposiciones del agente.

Preguntar sólo si una respuesta cambia la música o la entrega: ¿fondo o protagonista?, ¿loop o escena sincronizada?, ¿qué debe sobrevivir al transformar el tema? No bloquear una exploración por no conocer todavía el compresor o la articulación de cada nota.

Una tesis útil: «El refugio parece seguro, pero el bajo nunca confirma completamente el hogar; una llamada de cinco notas reaparece en combate». Una tesis insuficiente: «épico, oscuro, inmersivo, hermoso».

## 2. Comprobar capacidades antes de ofrecer controles

Leer el contrato real del CLI y la etapa que consume cada parámetro. Ejecutar doctor y validación de proyecto. No afirmar que `humanize.timing_depth`, una curva de densidad o un Factory Patch modifican el render por estar presentes en un JSON.

Usar el probe en copias temporales y clasificar: efecto observado en compose, efecto reservado a otra etapa, condicionado, incompatible en este fixture o pendiente de implementar. La falta de cambio en un único fixture no basta para una conclusión universal.

## 3. Ofrecer tres decisiones compositivas contrastantes

Para un encargo abierto, producir tres reducciones breves. Cada dirección debe diferir en al menos dos dimensiones estructurales: célula rítmica, contorno/interválica, sintaxis de frase, comportamiento armónico o relación figura/silencio. Cambiar sólo timbre, tonalidad o seed no cuenta como tres ideas.

Ejemplo para una puerta prohibida:

| Dirección | Decisión | Qué sacrifica |
|---|---|---|
| Llamada del peregrino | Salto reconocible y respuesta descendente; bajo móvil pero austero. | Menor agresividad inmediata. |
| Máquina ritual | Célula corta, acentos desplazados y pedal inestable. | Menor cantabilidad. |
| Refugio falso | Frase luminosa, armonía ambigua y respiraciones largas. | Menor sensación de amenaza explícita. |

No todos los encargos necesitan melodía protagonista. Para un campo ambiental, la identidad puede estar en un patrón de respiración, una sonoridad o una relación rítmica. No imponer lead ni cadencia tonal como criterio universal.

Guardar por dirección: decisiones, score de reducción, audio del backend declarado, limitaciones y comentarios de escucha. Si no hubo escucha real, escribir `listening: pending`; no «aprobado por el profesor».

## 4. Proteger la identidad elegida

Anotar el motivo como notas/grados, ritmo, articulación estructural, respiración, ancla y destino de frase; no sólo como `heroic` o `arch`. Declarar invariantes y qué se permite transformar. Guardar versión, hashes de contenido y semilla por etapa.

La revisión «más peligro, mismo tema» puede cambiar acompañamiento, notas de paso o color modal sin cambiar el núcleo rítmico. Debe explicitarse qué identidad se conserva: grados/contorno no equivalen a mantener todas las alturas absolutas.

## 5. Diseñar la forma antes de densificar

Cada sección declara función y destino: presentar, continuar, intensificar, contrastar, vaciar, volver o resolver. Energía, tensión armónica, brillo, registro y densidad son dimensiones distintas. Un clímax puede tener menos instrumentos y mayor exposición.

Planear dónde respira la frase y dónde no debe competir con diálogo. Preparar un retorno que tenga sentido al repetir; no colocar por defecto el mayor tutti en la última sección. Verificar melodía+bajo antes de arreglar el resto.

## 6. Componer relaciones, no rellenar pistas

La armonía propone objetivos fuertes, notas de paso y ritmo armónico; no obliga a que cada ataque sea acorde. El bajo tiene dirección y función; la familia sonora no sustituye a su gramática. El contrapunto responde o se calla. Los instrumentos entran y salen por razones de escena.

Resolver tesitura y conducción de voces antes de emitir eventos. Cuando las restricciones son incompatibles, explicarlo o proponer una simplificación. No corregir notas ilegales con clamp silencioso ni salvar el presupuesto borrando material estructural sin reporte.

## 7. Revisar una región sin regenerar lo aprobado

Toda revisión tiene `scope`, `preserve`, `allowed_changes`, `reason` y comprobaciones antes/después. Ejemplo: sólo lead en B, preservando A, retorno, bajo y compases totales. Guardar la versión anterior y un diff musical, no sólo un diff textual.

Hasta que el CLI implemente transacciones/local seeds, no anunciar `revise`, `lock` o `transform` como comandos existentes. Se puede preparar un contrato de revisión y hacer una edición explícita del score, validando de nuevo; el laboratorio demuestra únicamente su propia conservación de A/B.

## 8. Evaluar en tres representaciones

**Reducción:** idea, dirección, respiración y destino. **Arreglo:** jerarquía, claridad, timbres y articulación. **Gameplay:** transiciones, fatiga, diálogo y eventos repetidos. Una mezcla agradable no rescata una idea sin dirección; una partitura correcta no garantiza una transición útil.

Comparar con nivel perceptual controlado cuando se juzgue preferencia. El prototipo actual no lo hace: sus comparaciones son exploratorias. No usar un único valor 0–100 como aprobación artística ni optimizar sistemáticamente contra los mismos heurísticos que generaron el material.

## 9. Entregar un contrato reproducible

La entrega de producción debe incluir plan/harness/score, versión del motor, semillas, procedencia de sonidos, backend realmente usado, MIDI compatible, loops con puntos definidos, stems alineados cuando existan, diagnóstico técnico y estado de escucha. Diferenciar claramente previsualización, render final y exportación de juego.

Para integrar este workflow en SKILL.md: conservar la entrada breve, trasladar teoría a referencias, añadir una tabla de comandos reales y enlaces relativos que funcionen dentro del ZIP. Empaquetar, reubicar, ejecutar smoke y comprobar el manifiesto antes de declarar lista la skill.
