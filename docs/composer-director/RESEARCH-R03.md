# Investigación R03 — más control musical, no más ruido

Consulta: 8 de septiembre de 2026. Las decisiones propuestas se separan de las capacidades ya implementadas. Las fuentes son investigaciones originales, especificaciones o documentación de creadores de instrumentos.

## La interpretación debe tener relaciones, no errores independientes

El estudio [Downbeat delays are a key component of swing in jazz](https://www.nature.com/articles/s42005-022-00995-z) encontró un efecto beneficioso de retrasos sistemáticos del solista en sus condiciones de prueba. No demuestra que cualquier retardo mejore cualquier género. Junto con [Does it Swing?](https://www.nature.com/articles/s41598-019-55981-3), respalda comparar relaciones temporales específicas y no promover un control genérico de azar como sinónimo de humanidad.

Aplicación actual: Pocket mantiene el score escrito para comparar interpretaciones; el helper nativo conserva estructura y ajusta timing/gate/velocity por frase y rol. Nuestros perfiles son hipótesis conservadoras y NO réplicas experimentales de esos estudios.

## La nota continúa después del ataque

La [guía de diseño de sonidos de LinnStrument](https://www.rogerlinndesign.com/support/support-linnstrument-creating-sounds) y su [guía de implementación MPE](https://www.rogerlinndesign.com/support/support-developers-how-to-add-mpe) distinguen ataque, presión continua, timbre y afinación por nota. Esto inspira una próxima capa de gesto instrumental: una nota sostenida no debería depender sólo de su velocity inicial.

Propuesta: un contrato `InstrumentGesture` con ataque, curva de energía, brillo, afinación y liberación por región. Un viento necesita respiración; una cuerda puede desarrollar presión; un piano tiene un ataque transitorio y caída. Son decisiones diferentes, no la misma LFO aplicada a todos.

No se implementó MPE, presión táctil, MIDI externo ni emulación física en R03. Antes de añadir controles, cada campo debe tener consumidor audible, unidad, resolución temporal, política de límites y prueba que lo distinga de un metadato decorativo.

## El reloj visual no es el reloj de programación

La [especificación Web Audio 1.1](https://www.w3.org/TR/webaudio-1.1/) expone `getOutputTimestamp` para relacionar tiempo de audio y rendimiento. Aplicación actual: estimación del tiempo de salida para notas, roll y visuales. Se conserva fallback explícito y límites contra adelantarse al contexto. No se prometen cero latencia ni sincronía de hardware universal.

También importa no bloquear el hilo de interfaz: preparar las voces en un Worker antes del transporte corrige un problema observado en la primera nota. El siguiente objetivo sería scheduling de fragmentos con caché acotada y métricas de coste por instrumento, no elevar indefinidamente el límite de memoria.

## Próximos cinco experimentos con criterio de aceptación

**Gestos de instrumento.** Comparar una misma nota y frase con curvas de ataque/energía/bright/release. Aceptación: diferencia audible atribuible, representación sincronizada y export con los mismos datos. La representación ampliada actual sirve para explorarlo, pero los dibujos no deben engañar sobre técnica física.

**Destinos armónicos y frases abiertas.** Modelar ancla y llegada, suspensiones, pedal, ritmo armónico y registro antes de emitir notas. Aceptación: distintas funciones de frase sin cambiar arbitrariamente el motivo; tensiones intencionales diferenciadas de errores. Ni todos los ataques deben ser chord tones ni toda sección final debe crecer.

**Diálogo orquestal.** Asignar turnos de primer plano y límites de actividad al acompañamiento. Aceptación: retirar notas explícitamente en regiones designadas, conservar lo aprobado y mostrar el diff. Conversación ya prueba formas finitas; falta integrarlo al plan nativo de orquestación.

**Revisiones comparables.** Dos versiones alineadas, diferencias de score/performance separadas, escucha nivelada y decisión humana con opción de empate. Aceptación: archivos nuevos verificados por contenido, no caché vieja. Primero arreglar el render nativo para que una bonita comparación A/B no mida dos veces el mismo audio.

**Música contra gameplay.** Estados con puntos de entrada/salida armónica, hysteresis, latencia y excepciones para stingers. Aceptación: traza reproducible en un juego real y preservación temática. Una transición al próximo compás no basta para una transición musical correcta.

## Repertorio: consolidación sin falsas promesas

[repertoire.json](repertoire.json) incorpora las 18 líneas de R02, distingue demos de investigación y declara `native_compose_integrated: false`. Fuentes completas: [sources.json](../../game-music-composer/resources/ensemble-atelier/sources.json). Las 10 gramáticas del Atlas son bocetos originales, no transcripciones ni autenticidad certificada. Gamelan, konnakol, tabla, flamenco y tradiciones locales necesitan conocimiento interpretativo específico; sus etiquetas no son presets intercambiables.

La prioridad propuesta es **timbre/gesto verificable + frase con destino + espacio entre instrumentos**. Más estilos sin estas relaciones ampliarían el menú, no necesariamente la calidad.
