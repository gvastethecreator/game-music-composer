# Neo-SPC maintainer archive

This directory preserves historical corpus generations, research reports, schemas, templates and build passes that are not part of the installed `snes-midi-composer-skill` runtime.

- `historical/skill-package/` retains each preserved file under an explicit archive route.
- `archive-manifest.json` maps its original skill route to that archive route.
- `snes-midi-composer-skill/scripts/release_gate.py` verifies that every declared historical file exists here and no longer ships in the runtime package.

The archived scripts are historical records, not supported end-user commands. Some intentionally retain their original workstation paths as provenance; do not execute them as the current release workflow. Use the canonical CLI and release gates under `snes-midi-composer-skill/` instead.
