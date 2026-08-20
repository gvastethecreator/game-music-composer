# Investigación: del SNES estricto a un sistema Neo-SPC expandido

## 1. Punto de partida

El S-DSP original dispone de ocho voces sample-based. Cada voz puede seleccionar fuente de muestra, pitch, volumen, envolvente y participación en mecanismos como noise, pitch modulation y echo. Esa arquitectura obliga a pensar en roles, prioridades y reutilización de recursos.

Neo-SPC conserva esa forma de pensar, pero no el techo físico. El sistema permite hasta 32 voces para explorar arreglos que se sienten como una evolución plausible: orquesta de cámara ampliada, coros divididos, contrapunto, capas electrónicas y percusión más detallada.

## 2. Por qué no conviene activar 32 voces siempre

Una mayor polifonía puede mejorar:

- divisi de cuerdas;
- coro SATB;
- dobles expresivos;
- contrapunto real;
- orquestación por familias;
- capas de ataque y sustain;
- colas ambientales independientes;
- percusión con mayor separación.

Pero también puede producir:

- pérdida de identidad melódica;
- enmascaramiento espectral;
- armonía confusa;
- sensación de pad constante;
- clímax sin contraste;
- duplicaciones mecánicas.

Por eso la densidad debe tener una curva formal. Una pieza con budget 32 puede usar 7–10 voces durante su apertura, 14–20 durante el desarrollo y acercarse a 32 sólo en una llegada significativa.

## 3. Arquitectura por roles

### Núcleo

Melodía, bajo, armonía esencial y pulso principal. Debe funcionar por sí solo.

### Ensemble

Divisi, dobles tímbricos, secciones de cuerdas, brass o coro. Debe fortalecer un punto formal.

### Ornamentación

Respuestas, fills, figuras secundarias y decoración localizada.

### Textura

Drones, pads, resonancias, ambientes o masas sostenidas.

### Percusión y efectos

Ataques, transiciones, impactos y señales no continuas.

## 4. Web Audio y MIDI

Web Audio permite representar el proyecto como un grafo flexible de fuentes, ganancias, filtros, paneo, delays y procesamiento en tiempo real. AudioWorklet permite mover procesamiento personalizado fuera del hilo principal cuando sea necesario.

MIDI Type 1 sigue siendo útil para intercambio y edición multitrack. Para expresión fina, MIDI 2.0 ofrece mayor resolución y controles por nota; sin embargo, el JSON semántico continúa siendo la fuente canónica porque registra roles, samples, curvas, arquitectura de voces y decisiones formales.

## 5. Escala del benchmark

NeoSPC-100 se diseñó como un corpus de evaluación:

- 100 piezas;
- 10 categorías;
- 10 estudios por categoría;
- 8 familias métricas;
- perfiles de 12 a 32 voces en el set actual;
- 31.469 eventos base;
- máximo medido de 32 voces;
- cero firmas melódicas exactas duplicadas;
- cero topologías de ataque exactas duplicadas.

Estas métricas no garantizan calidad artística. Sirven para detectar homogeneización, errores de cobertura y uso decorativo del presupuesto de voces.
