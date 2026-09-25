#!/usr/bin/env python3
"""Publish canonical Atelier and studio-engine modules and the skill package into the portable studio."""
import hashlib
import json
from pathlib import Path
import shutil
import sys

ROOT = Path(__file__).resolve().parents[1]
STUDIO = ROOT / 'game-music-composer-showcase'
SOURCE = ROOT / 'game-music-composer/resources/ensemble-atelier'
MODULES = ('music.js', 'visuals.js', 'atelier.js')
ENGINE_SOURCE = ROOT / 'game-music-composer/resources/studio-engine'
ENGINE_MODULES = ('core.js', 'native-bridge.js', 'labels-en.js')

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
    (STUDIO / 'engine').mkdir(exist_ok=True)
    for name in ENGINE_MODULES:
        shutil.copyfile(ENGINE_SOURCE / name, STUDIO / 'engine' / name)
    sys.path.insert(0, str(ROOT / 'game-music-composer/scripts'))
    from studio_instruments import studio_instruments
    instruments = studio_instruments()
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
    print(f'Synced {len(MODULES) + len(ENGINE_MODULES)} modules, {len(instruments)} instrument assignments and {len(lines)} studio files.')

if __name__ == '__main__':
    sync()
