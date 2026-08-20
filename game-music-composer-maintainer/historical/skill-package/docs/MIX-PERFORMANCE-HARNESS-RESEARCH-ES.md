# Investigación v2.2 — bajos, drums, dinámica MIDI y harness generativo

## Diagnóstico

El problema de las versiones anteriores no provenía únicamente de la composición. El renderer utilizaba un banco con niveles intrínsecos muy distintos, un mismo bajo para contextos incompatibles y demasiada dependencia del `gain` de cada evento. Eso provocaba horns y synths dominantes, drums retraídas y bajos con identidad parecida a un piano grave.

La solución se divide en cuatro sistemas independientes:

1. **fuente instrumental adecuada**;
2. **gain staging y buses funcionales**;
3. **interpretación MIDI contextual**;
4. **harness de generación jerárquico y determinista**.

## 1. Familias de bajo

Un bajo no se define sólo por tocar una octava grave. Ataque, distribución armónica, sustain, ruido de cuerda, saturación y relación con el kick determinan su lectura.

La nueva paleta incorpora:

- upright bass v2;
- electric finger bass;
- picked bass;
- analog bass;
- sub bass;
- bowed contrabass.

Cada categoría selecciona una familia inicial y permite excepciones justificadas por subgénero. El bajo permanece generalmente mono y centrado; dobles o capas sólo se habilitan en secciones concretas.

## 2. Buses funcionales

Mix v3 utiliza siete buses:

- lead;
- bass;
- drums;
- rhythm;
- harmony;
- atmosphere;
- fx.

Cada uno tiene un objetivo de nivel activo, rango espectral y compresión propios. Drums reciben una combinación paralela de cuerpo y transiente. Bass recibe refuerzo controlado de graves. Harmony y atmosphere ceden nivel cuando entra el foreground.

La mezcla no intenta igualar todos los instrumentos. Busca una jerarquía legible:

```text
intención principal
> pulso y fundamento
> soporte armónico
> ornamento
> ambiente
```

## 3. Velocity y control MIDI

La salida MIDI separa:

- CC7: balance de pista;
- velocity: ataque e intención de nota;
- CC11: curva de expresión;
- CC10: panorama;
- CC91: envío espacial.

La velocity deriva de rol, métrica, frase, cadencia, articulación y respuesta del instrumento. Los acordes no reciben valores idénticos: se balancean raíz, voces internas y nota superior. Ghost notes y adornos permanecen claramente por debajo de los ataques estructurales.

## 4. Detalle para tempos rápidos

Aumentar BPM no implica duplicar todas las subdivisiones. El nuevo pass usa:

- retriggers selectivos;
- ratchets de dos a cuatro ataques;
- ghost hats o shakers;
- fills de final de frase;
- alternancia entre densidad y huecos;
- velocity descendente o ascendente dentro del gesto;
- cambios de patrón entre secciones.

La activación comienza alrededor de 140 BPM y se reduce cuando la densidad global ya es alta.

## 5. Harness generativo

Las referencias de workstation muestran una separación útil entre progresión, ritmo de acordes, arpeggio, bassline, humanización, chopping y articulación. La versión 2.2 adopta esa separación como contrato de datos, no como generador aleatorio sin control.

El harness incluye:

- 60 escalas y pitch collections;
- 142 progresiones clasificadas por modo, mood y función;
- 17 ritmos armónicos;
- 20 arpeggiators;
- 15 basslines;
- 15 movimientos melódicos;
- 10 perfiles de humanización;
- 10 chops.

Todo preset debe pasar por forma, armonía local, conducción de voces y límites de densidad. Los presets son vocabulario de transformación, no frases musicales acabadas.

## 6. Controles del showcase

La workstation separa:

- `Monitor Level`: nivel de escucha, sin modificar el archivo;
- `Output Ceiling`: umbral del limitador Web Audio;
- `Tempo Scale`: 60–150 % con 100 % como punto central;
- medidores L/R y peak hold;
- harness exportable como JSON.

El tempo del preview cambia mediante playback rate. Para producción final, el agente debe volver a renderizar a la velocidad elegida para conservar control total sobre envelopes y efectos dependientes del tiempo.

## Conclusión

El objetivo no es ofrecer más controles por apariencia. Cada control representa una dimensión musical separada. El harness debe ayudar a explorar combinaciones, pero la composición sigue requiriendo selección, jerarquía, desarrollo y revisión auditiva.
