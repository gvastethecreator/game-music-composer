# Composer Director: de generar cues a construir identidad musical

**Estado:** propuesta de evolución con laboratorio funcional y herramientas de diagnóstico. No sustituye todavía el motor Neo-SPC ni modifica el paquete portable. Auditoría realizada el 2026-09-05 sobre `main` en `1d562a79bddfba90bcf170309bd384733a1943c5`.

La oportunidad no es sumar cincuenta controles. Es permitir una decisión que hoy resulta difícil de expresar y verificar: **«Conservá este tema, hacelo funcionar en otra situación y no destruyas lo que ya aprobé».**

## Qué se puede usar ahora

Abrir `labs/composer-director/index.html` junto a `director.js`, o servir el repositorio con `python -m http.server 8080` y navegar al laboratorio. No necesita instalación de Node, servidor de aplicación, cuenta, GPU ni claves de API. El navegador debe permitir Web Audio mediante interacción del usuario.

El laboratorio ofrece tres motivos originales, cuatro estados, reducción melodía+bajo, revisión de la respuesta B que conserva A y su retorno, protección de la selección y exportación de sesión JSON. Sus osciladores son **bocetos**: no representan el sonido del Factory Bank ni exportan un catálogo Neo-SPC. Tiene ocho compases en 4/4, cinco respuestas B por motivo y transiciones en el siguiente compás no programado. No interpreta lenguaje natural.

La herramienta `tools/composition_probe.py` ejecuta el CLI real de un checkout completo en directorios temporales. Cambia un control por ensayo y compara notas/estructura, expresión, asignaciones y mezcla declarada. No toca el proyecto original, no reutiliza sus renders y no transforma igualdad de hashes en un juicio musical.

```bash
# Desde la raíz, contra un proyecto válido ya inicializado:
python tools/composition_probe.py --project .scratch/my-cue --cases docs/composer-director/probe-cases.json --out .scratch/control-report.json

# Pruebas del incremento, independientes del paquete instalado:
python -m unittest discover -s tests -p "test_*.py" -v
node --test tests/test_director.cjs
```

Un valor igual al existente, una ruta desconocida o una combinación inválida aparece como `not_comparable`. `unchanged_in_fixture` significa únicamente «sin cambio en esta configuración y en la etapa compose». Un control de render puede legítimamente no alterar esa etapa. Ejecutar con varios géneros y semillas antes de concluir que un control no funciona. Un cambio en `factory_patch` no prueba que cambie el audio nativo.

## Documentos de decisión

| Documento | Para qué sirve |
|---|---|
| [AUDIT.md](AUDIT.md) | Hallazgos, funciones concretas, severidad y límites de evidencia. |
| [WORKFLOW.md](WORKFLOW.md) | Flujo mejorado para el agente sin inventar capacidades del CLI. |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Contratos de identidad, revisión localizada, audio adaptativo y backends. |
| [BACKLOG.md](BACKLOG.md) | Tickets en orden de dependencia con aceptación verificable. |
| [EVALUATION.md](EVALUATION.md) | Cómo demostrar mejores resultados sin optimizar un «profesor» heurístico. |
| [VALIDATION.md](VALIDATION.md) | Qué se ejecutó realmente y qué sigue sin verificar. |
| [SOURCES.md](SOURCES.md) | Fuentes primarias y su aplicación, sin prometer integraciones inexistentes. |

## El producto que vale la pena construir

Una sesión empieza con tres **decisiones compositivas distintas**, no con tres recoloraciones instrumentales. Después de elegir, el usuario protege el motivo, compara una revisión concreta y prueba la música contra estados de juego. La entrega final debe poder convertirse en una pequeña banda sonora coherente: exploración, amenaza, combate, resolución, stingers y transiciones, con evidencia de qué conserva cada variante.

La primera vertical de producto es **elegir → proteger → transformar → simular gameplay → exportar con garantías**. No es construir otro DAW, marketplace, red social o servicio de modelos antes de resolver la composición.

## Límite del PR

Este incremento añade investigación, diagnóstico ejecutable y una prueba audible del flujo. No corrige silenciosamente el renderizador, el exportador MIDI, la asignación de banco, el manifiesto ni todas las conexiones del harness. Los problemas de producción quedan explícitos y ordenados en P0/P1; no se presentan como resueltos. No se reescribe el corpus ni se vuelven a generar los 100 cues para inflar el diff. El manifiesto portable queda intacto porque este incremento no cambia archivos de su distribución.
