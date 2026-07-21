# Workflow de integración del Factory Bank

La skill v3.1 incorpora el banco como parte explícita de la composición y no como una selección posterior de presets.

## Secuencia

1. Definir función, género, mood, forma y arquitectura de voces.
2. Escribir la reducción musical esencial.
3. Asignar roles instrumentales abstractos.
4. Resolver cada rol mediante `factory-bank-role-map.json`.
5. Seleccionar patch, perfil, registro y rango de velocity.
6. Ejecutar `audit_soundbank_assignments.py`.
7. Revisar contradicciones tímbricas y masking.
8. Renderizar Neo-16 y, cuando sea útil, una variante Neo-32.
9. Ejecutar Professor Review sobre composición y revisión de producción por separado.

La elección de banco no puede promover una composición débil ni esconder una mala conducción de voces.
