# Code map · game-music-composer

generated: 2026-08-20T03:20:01Z
commit: 68d50f305eee
scope: .

counts: 6 nodes · 3 edges · 0 flows · 0 unknown

## Modules

- `external-dependencies` · `game-music-composer-maintainer/historical/skill-package/scripts/apply_human_performance.py` · external · External
  callers: game-music-composer-maintainer (imports), game-music-composer-scripts (imports), game-music-composer-showcase-scripts (imports)
  callees: (none)
  tests: (none)
  entry: game-music-composer-maintainer/historical/skill-package/scripts/apply_human_performance.py:__future__

- `game-music-composer` · `game-music-composer` · module · Game Music Composer
  callers: (none)
  callees: (none)
  tests: (none)
  entry: game-music-composer/SKILL.md:Game Music Composer

- `game-music-composer-maintainer` · `game-music-composer-maintainer` · module · Game Music Composer Maintainer
  callers: (none)
  callees: external-dependencies (imports)
  tests: (none)
  entry: game-music-composer-maintainer/historical/skill-package/scripts/apply_human_performance.py:seed_for

- `game-music-composer-scripts` · `game-music-composer/scripts` · service · Game Music Composer
  callers: (none)
  callees: external-dependencies (imports)
  tests: (none)
  entry: game-music-composer/scripts/audit_soundbank_assignments.py:main

- `game-music-composer-showcase` · `game-music-composer-showcase` · module · Game Music Composer Showcase
  callers: (none)
  callees: (none)
  tests: (none)
  entry: game-music-composer-showcase/app.js:loadScript

- `game-music-composer-showcase-scripts` · `game-music-composer-showcase/scripts` · service · Game Music Composer Showcase
  callers: (none)
  callees: external-dependencies (imports)
  tests: (none)
  entry: game-music-composer-showcase/scripts/audit_showcase.py:MarkupAudit

## Edges

- game-music-composer-maintainer -> external-dependencies · imports
- game-music-composer-scripts -> external-dependencies · imports
- game-music-composer-showcase-scripts -> external-dependencies · imports

## Unknown

- none

## Flows

- none
