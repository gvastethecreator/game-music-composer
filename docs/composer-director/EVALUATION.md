# Evaluación: separar funcionamiento, música y utilidad

## Tres preguntas distintas

1. ¿El control hizo lo que decía y el archivo contiene lo nuevo?
2. ¿La música funciona mejor para esa intención?
3. ¿El creador puede llevarla al juego y revisarla sin perder trabajo?

Un hash distinto responde parcialmente a la primera. Un score heurístico alto no responde a la segunda ni a la tercera.

## Matriz de escenas inicial

| Fixture | Contraste que debe exponer | Riesgo que vigila |
|---|---|---|
| Safe room con diálogo | Desescalada, espacio y retorno | Crescendo final automático, lead invasivo |
| Boss con fase tranquila | Misma identidad, función diferente | Sólo subir volumen y densidad |
| Pueblo/fiesta | Riff/melodía cantable y aire | Arpegio genérico constante |
| Stealth | Pulso latente y silencios | Métrica que obliga a drum/lead |
| Duelo | Desaceleración de gesto sin incoherencia | Melancolía reducida a modo menor |
| Puzzle en 5/4 | Agrupación deliberada | Acentos que ignoran el metro |
| Persecución en 7/8 | Motricidad y límite de detalle | Densidad ilegible |
| Danza en 6/8 | Pulso compuesto reconocible | Tratarlo como 3/4 |
| Campo ambiental | Identidad sin lead obligado | Gate que castiga escasez |
| Ensamble de 8 voces | Prioridad del núcleo | Borrado destructivo del motivo |
| Ensamble de 32 voces | Claridad y exportación coherente | Confundir voces con canales MIDI |
| Encuentro → peligro → boss | Continuidad y latencia | Transiciones rítmicas pero armónicamente malas |

Registrar seeds, versión del motor, inputs, patches resueltos y hashes. Repetir los controles en varias configuraciones compatibles. No cambiar un campo que deba sincronizarse con el plan y luego interpretar el rechazo como ausencia de implementación.

## Pruebas automáticas

**Propiedades:** tiempo finito, orden/loop coherentes, pitch/registro válidos, articulaciones realizables, locks, determinismo por scope, ausencia de colisiones de canal, paths portables y no sobrescritura. Agregar casos adversariales: eventos casi simultáneos, pickups, tails más largas que la ventana, silencio final y loops de métrica irregular.

**Metamórficas:** subir un semitono la tonalidad con el mismo motivo conserva relaciones cuando el registro permite; desactivar humanize no cambia notas estructurales; variar B mantiene A; cambiar un patch debe cambiar su señal si el backend declara soportarlo; aumentar presupuesto no obliga a ocuparlo; texto nuevo no cuenta como melodía nueva.

**Audio:** renders frescos con cadena identificada; finitud, DC, nivel, true peak, colas, seam, phase/alineación de stems y comportamiento después de decodificar cada formato. Los umbrales son perfiles configurables, no una masterización universal. Un salto de muestra no demuestra por sí solo un click audible y una forma de onda continua no garantiza continuidad armónica.

## Comparación humana

Primero reducción con paleta común, luego arreglo con niveles comparables y por último gameplay con dialogue/SFX. Aleatorizar orden y registrar la clave oculta. No mostrar seed, versión, puntuación ni nombre sugestivo antes de votar. Controlar volumen para que «más fuerte» no se haga pasar por «mejor». Anotar ajustes aplicados; no alterar el archivo entregable al normalizar una copia para audición.

Separar preguntas: identidad, destino de frase, contraste con coherencia, claridad, adecuación, fatiga y preferencia. Permitir empate, ninguna opción y comentarios por timestamp. Añadir reconocimiento del motivo tras una distracción corta y revisiones concretas del creador. No inferir resultados estadísticos de una única escucha ni de las preferencias del autor del motor.

La sesión larga dura 10–20 minutos en contexto y permite mute. La fatiga no es necesariamente monotonía: demasiados cambios, clímax recurrentes y lead persistente también pueden molestar. Registrar quién escuchó, equipo/condición si se conoce, género y limitaciones, sin recolectar datos personales innecesarios.

## Separación del benchmark

El material que inspiró plantillas/defaults no es holdout independiente. Mantener conjuntos de desarrollo, regresión y evaluación nuevos. Medir similitud por intervalo+ritmo a varias escalas y revisar falsos positivos; esas herramientas no certifican originalidad ni ausencia de infracción.

No regenerar 100 cues y escoger sólo los que salieron bien para declarar mejora universal. Predeclarar escenas, conservar fallos, comparar por género y publicar excepciones. Un despliegue debe poder volver a defaults anteriores con recetas/versiones reproducibles.

## Gate de promoción propuesto

Promover un cambio musical sólo cuando: no introduce regresiones técnicas, responde a la intención en fixtures pertinentes, conserva regiones protegidas y tiene evidencia comparativa suficiente para la afirmación concreta que se haga. Los tamaños de muestra y criterios de preferencia deben acordarse antes de evaluar, según el alcance; no fijar un porcentaje vistoso después de ver resultados.

El laboratorio de este PR demuestra lógica de identidad/revisión y produce audio sintético. **No ha pasado este protocolo de preferencia musical ni prueba de uso en juego.**
