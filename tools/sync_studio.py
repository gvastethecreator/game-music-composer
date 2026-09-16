#!/usr/bin/env python3
"""Publish canonical Atelier modules and skill package into the portable studio."""
import hashlib
import json
from pathlib import Path
import shutil
import sys

ROOT = Path(__file__).resolve().parents[1]
STUDIO = ROOT / 'game-music-composer-showcase'
SOURCE = ROOT / 'game-music-composer/resources/ensemble-atelier'
MODULES = ('music.js', 'visuals.js', 'atelier.js')

def publish_recipes():
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from publish_studio_recipes import publish
    publish()

def sync():
    publish_recipes()
    target = STUDIO / 'atelier'
    target.mkdir(exist_ok=True)
    for name in MODULES:
        shutil.copyfile(SOURCE / name, target / name)
    # The current catalog is not guaranteed to use every playable identity.
    sys.path.insert(0, str(ROOT / 'game-music-composer/scripts'))
    import generate_neospc100_v3 as engine
    from compose_from_plan import apply_factory_assignments
    instruments = {name: {'sample': values[0].removesuffix('.wav'), 'file': values[0], 'root_midi': values[1], 'color': values[2], 'family': values[4], 'label': name.replace('_', ' ').title()} for name, values in engine.INSTRUMENTS.items()}
    apply_factory_assignments({'instrument_map': instruments})
    if any('factory_patch' not in info for info in instruments.values()):
        raise ValueError('Every studio identity needs an explicit Factory assignment.')
    # Explicit bank assignments for the three additional Atelier identities.
    additions = {
        'epiano': ('piano', 'keys.electric_piano', 'Electric Piano'),
        'kalimba': ('harp', 'plucks.dulcimer', 'Dulcimer'),
        'metallophone': ('vibes', 'mallets.vibraphone', 'Vibraphone'),
    }
    for name, (source, patch, label) in additions.items():
        instruments[name] = {**instruments[source], 'label': name.replace('_', ' ').title(), 'factory_patch': patch, 'factory_label': label}
    (target / 'instruments.js').write_text('window.STUDIO_INSTRUMENTS = '+json.dumps(instruments, ensure_ascii=True, separators=(',', ':'))+';\n', encoding='utf-8')
    shutil.copyfile(ROOT / 'game-music-composer/dist/game-music-composer.zip', STUDIO / 'downloads/game-music-composer.zip')
    manifest = STUDIO / 'MANIFEST.sha256'
    files = sorted((path for path in STUDIO.rglob('*') if path.is_file() and path != manifest and '__pycache__' not in path.parts), key=lambda path: path.relative_to(STUDIO).as_posix().lower())
    # Match the repository's .gitattributes before hashing the portable tree.
    text_suffixes = {'.py', '.md', '.json', '.js', '.css', '.html', '.yaml', '.yml', '.txt', '.sha256', '.cjs'}
    for path in files:
        if path.suffix in text_suffixes:
            data = path.read_bytes()
            if b'\r\n' in data:
                path.write_bytes(data.replace(b'\r\n', b'\n'))
    lines = [hashlib.sha256(path.read_bytes()).hexdigest()+'  ./'+path.relative_to(STUDIO).as_posix() for path in files]
    manifest.write_text('\n'.join(lines)+'\n', encoding='utf-8', newline='\n')
    print(f'Synced {len(MODULES)} modules, {len(instruments)} instrument assignments and {len(lines)} studio files.')

if __name__ == '__main__':
    sync()
