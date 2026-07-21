# Revisión independiente de composición

La revisión v3 se ejecuta antes del render y permanece separada del sistema de mezcla. Su objetivo no es comprobar únicamente si las notas son legales, sino cuestionar la pieza como lo haría un profesor de composición.

## Secuencia obligatoria

1. Generar la reducción central: melodía, bajo, armonía y pulso.
2. Construir forma, contrapunto, orquestación y performance.
3. Ejecutar `professor_review.py` sin considerar loudness, mastering ni efectos.
4. Aplicar solamente las acciones prescritas por el reviewer.
5. Ejecutar una segunda revisión sobre la partitura corregida.
6. Repetir hasta el máximo configurado en `review.max_revision_passes`.
7. Renderizar únicamente después de superar el gate o quedar explícitamente en estado `review`.

## Dimensiones

- coherencia melódica;
- lógica armónica;
- frase y forma;
- ritmo y groove;
- contrapunto y conducción de voces;
- orquestación;
- expresión;
- carácter idiomático;
- diseño del loop;
- identidad.

La evaluación genera comentarios y acciones concretas. No utiliza elogios genéricos ni permite que un buen mix compense una composición débil.
