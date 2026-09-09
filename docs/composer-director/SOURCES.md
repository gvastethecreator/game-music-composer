# Fuentes y relación con las decisiones

Consulta: 2026-09-05. Las fuentes explican técnicas o contratos; no demuestran que este producto ya alcance sus resultados. No se copió código de terceros ni se descargaron bancos musicales externos para el laboratorio.

## Repositorio auditado

Base fija: [main@1d562a79](https://github.com/gvastethecreator/game-music-composer/tree/1d562a79bddfba90bcf170309bd384733a1943c5). Funciones y archivos concretos en [AUDIT.md](AUDIT.md). La declaración de banco original en el help del CLI y la advertencia de revisión simbólica en SKILL.md forman parte de la evidencia; no deben omitirse al interpretar los hallazgos.

## Composición jerárquica

[Music Transformer — Magenta](https://magenta.withgoogle.com/music-transformer) y [publicación original — Google Research](https://research.google/pubs/music-transformer-generating-music-with-long-term-structure/) describen el reto de dependencias musicales largas. Respaldan investigar representaciones de motivo, frase y estructura; **no** justifican que instalar un Transformer o copiar su arquitectura sea la siguiente tarea de este repositorio. La elección de un modelo queda separada de la necesidad de control y evaluación.

## Música interactiva

[Audiokinetic: clasificación de diseño dinámico](https://www.audiokinetic.com/fr/community/blog/about-dynamic-music-design-part-1-design-classification/) y [cómo musicalizar gameplay con música interactiva](https://www.audiokinetic.com/en/community/blog/how-to-use-interactive-music-to-score-gameplay/) aportan la distinción entre organización horizontal y vertical. Aplicación: TransitionGraph y estados con función musical, no un único slider de volumen.

[Wwise: Working with cues](https://www.audiokinetic.com/fr/public-library/2025.1.8_9170/?id=working_with_cues&source=Help) y [puntos de cambios de estado](https://www.audiokinetic.com/library/2025.1.8_9170/?id=defining_points_within_music_objects_for_state_changes&source=Help) explican sincronización y puntos de entrada/salida. Aplicación: probar timing y armonía por separado. Esto no significa que el lab exporte proyectos Wwise.

## Audio web y MIDI

[W3C Web Audio API 1.1](https://www.w3.org/TR/webaudio-1.1/) es la referencia para el reloj de audio, nodos y automatización. Aplicación: programar audio con `AudioContext.currentTime`, no disparar notas directamente por el timer de UI. El timer del lab sólo alimenta la programación; pausa ante retrasos prolongados.

[MIDI Association: General MIDI Lite](https://midi.org/general-midi-lite) describe su organización de 16 canales y percusión en el canal 10; [Control Change Messages](https://midi.org/midi-1-0-control-change-messages) documenta controladores por canal. Aplicación: distinguir canales, programas y polifonía; probar colisiones en el exportador. No se generaliza la limitación de un perfil a todos los estándares/puertos MIDI.

## Automatización

Releases oficiales de [checkout](https://github.com/actions/checkout/releases), [setup-python](https://github.com/actions/setup-python/releases) y [setup-node](https://github.com/actions/setup-node/releases), con refs v7.0.0 consultadas a través de GitHub. El workflow añadido fija los tres commits completos, usa `pull_request` con permisos de sólo lectura y no persiste credenciales. No necesita instalar una dependencia musical ni alterar el workflow de release existente.
