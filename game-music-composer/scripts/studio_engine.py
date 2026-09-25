"""Python access to the studio engine (the synthesis engine behind the browser Create view).

Composition, MIDI and catalog import run the engine's own JavaScript through Node.js 18+.
Synthesized WAV rendering needs Web Audio, so it runs the same engine offline in a local
headless Chromium through Playwright (optional). Nothing uses the network.
"""
from __future__ import annotations

import base64
import json
import shutil
import subprocess
import tempfile
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent
CLI = SCRIPTS / 'studio_engine.cjs'
ENGINE = SCRIPTS.parent / 'resources' / 'studio-engine' / 'core.js'


class EngineUnavailable(RuntimeError):
    """Raised when Node.js (or Playwright for synthesized audio) is missing."""


def node_path() -> str | None:
    return shutil.which('node')


def node_version() -> tuple[int, ...] | None:
    node = node_path()
    if not node:
        return None
    try:
        text = subprocess.run([node, '--version'], capture_output=True, text=True, timeout=20, check=True).stdout.strip()
        return tuple(int(x) for x in text.lstrip('v').split('.')[:3])
    except (OSError, subprocess.SubprocessError, ValueError):
        return None


def run(*arguments: str) -> str:
    node = node_path()
    if not node:
        raise EngineUnavailable('Node.js 18 or later is required for the studio engine (not found on PATH).')
    version = node_version()
    if version and version < (18,):
        raise EngineUnavailable(f'Node.js 18 or later is required for the studio engine; found {".".join(map(str, version))}.')
    result = subprocess.run([node, str(CLI), *arguments], capture_output=True, text=True, encoding='utf-8', timeout=600)
    if result.returncode:
        raise RuntimeError(result.stderr.strip() or f'studio engine exited with {result.returncode}')
    return result.stdout


def presets() -> list[dict]:
    return json.loads(run('presets'))


def compose(preset: str, seed: str, project: Path, native: Path, *, cue_id: str, title: str, category: str,
            category_label: str, variation: str | None = None, bars: int | None = None, form: str | None = None, game: bool = False) -> dict:
    from studio_instruments import studio_instruments

    with tempfile.TemporaryDirectory() as tmp:
        instruments = Path(tmp) / 'instruments.json'
        instruments.write_text(json.dumps(studio_instruments()), encoding='utf-8')
        arguments = ['compose', '--preset', preset, '--seed', seed, '--instruments', str(instruments), '--project', str(project),
                     '--native', str(native), '--id', cue_id, '--title', title, '--category', category, '--category-label', category_label]
        if variation:
            arguments += ['--variation', variation]
        if bars:
            arguments += ['--bars', str(bars)]
        if form:
            arguments += ['--form', form]
        if game:
            arguments.append('--game')
        return json.loads(run(*arguments))


def midi(project: Path, output: Path, loops: int = 1) -> Path:
    run('midi', str(project), str(output), '--loops', str(loops))
    return output


def import_native(composition: Path, project: Path) -> Path:
    run('import', str(composition), str(project))
    return project


def _browser_page(playwright):
    browser = playwright.chromium.launch()
    page = browser.new_page()
    errors: list[str] = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.set_content('<!doctype html><title>studio engine</title>')
    page.add_script_tag(path=str(ENGINE))
    return browser, page, errors


def _playwright():
    try:
        from playwright.sync_api import sync_playwright
    except ImportError as exc:
        raise EngineUnavailable('Synthesized rendering needs Playwright for Python and a Chromium build (pip install playwright; playwright install chromium).') from exc
    return sync_playwright


def render_game(project: Path, output_dir: Path, *, sample_rate: int = 44100) -> dict:
    """Render one seamless loop per game state, the manifest, the project and the runtime."""
    payload = json.loads(project.read_text(encoding='utf-8'))
    script = """async ([payload, sampleRate]) => {
      const state = GMCEngine.validateProject(payload);
      const {files, manifest} = await GMCEngine.game.renderPackage(state, {sampleRate});
      const out = [];
      for (const f of files) { const bytes = new Uint8Array(await f.blob.arrayBuffer()); let text = ''; for (let i = 0; i < bytes.length; i += 32768) text += String.fromCharCode(...bytes.subarray(i, i + 32768)); out.push({name: f.name, data: btoa(text)}); }
      return {files: out, manifest};
    }"""
    with _playwright()() as p:
        browser, page, errors = _browser_page(p)
        try:
            result = page.evaluate(script, [payload, sample_rate])
            if errors:
                raise RuntimeError('; '.join(errors))
        finally:
            browser.close()
    for item in result['files']:
        target = output_dir / item['name']
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(base64.b64decode(item['data']))
    (output_dir / 'gmc-music-director.js').write_text(run_node_source(), encoding='utf-8')
    return result['manifest']


def run_node_source() -> str:
    """Self-contained runtime source, as shipped in browser-exported packages."""
    return run('runtime')


def render_synth(project: Path, output: Path, *, loops: int = 1, tail: str = 'tail', sample_rate: int = 44100) -> dict:
    """Render the engine's synthesis offline in headless Chromium and write a 16-bit stereo WAV."""
    payload = json.loads(project.read_text(encoding='utf-8'))
    script = """async ([payload, loops, tail, sampleRate]) => {
      const state = GMCEngine.validateProject(payload);
      const wav = await GMCEngine.renderWav(state, {loops, tail, sampleRate});
      const bytes = new Uint8Array(await wav.blob.arrayBuffer());
      let text = ''; for (let i = 0; i < bytes.length; i += 32768) text += String.fromCharCode(...bytes.subarray(i, i + 32768));
      return {data: btoa(text), peak: wav.peak, rms: wav.rms, seconds: wav.seconds, sampleRate: wav.sampleRate};
    }"""
    with _playwright()() as p:
        browser, page, errors = _browser_page(p)
        try:
            result = page.evaluate(script, [payload, loops, tail, sample_rate])
            if errors:
                raise RuntimeError('; '.join(errors))
        finally:
            browser.close()
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(base64.b64decode(result.pop('data')))
    return result
