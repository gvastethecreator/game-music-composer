#!/usr/bin/env python3
"""Build an offline Ensemble Atelier HTML from a Neo-SPC score or a demo.

The viewer re-synthesizes notes with its original sketch backend; it does not
render the original/Factory Bank samples, promise physical fingering, or approve
artistic quality. No network, Node, Python rendering extras or API key required.
"""
from __future__ import annotations
import argparse
import html
import json
import math
from pathlib import Path
import sys
from typing import Any

RESOURCES = Path(__file__).resolve().parents[1] / 'resources' / 'ensemble-atelier'
JS_ORDER = ('music.js', 'audio.js', 'soundfont-engine.js', 'visuals.js', 'atelier.js', 'app.js')
DEMOS = ('instrumentarium', 'pocket', 'conversation', 'atlas', 'cycles')
MAX_INPUT_BYTES = 25 * 1024 * 1024


def load_json(path: Path) -> Any:
    if path.stat().st_size > MAX_INPUT_BYTES:
        raise ValueError('JSON exceeds the 25 MiB input limit')
    def reject(value: str) -> None:
        raise ValueError(f'Non-finite JSON constant: {value}')
    return json.loads(path.read_text(encoding='utf-8-sig'), parse_constant=reject)


def script_json(value: Any) -> str:
    # Neutralize script end-tags, HTML entities and JS line separators in user data.
    return (json.dumps(value, ensure_ascii=False, allow_nan=False)
            .replace('<', '\\u003c').replace('>', '\\u003e').replace('&', '\\u0026')
            .replace('\u2028', '\\u2028').replace('\u2029', '\\u2029'))


def select_cue(data: Any, index: int = 0) -> dict[str, Any]:
    if isinstance(index, bool) or not isinstance(index, int) or index < 0:
        raise ValueError('cue index must be a non-negative integer')
    if not isinstance(data, dict):
        raise ValueError('Expected a composition, catalog, or exported session object')
    if 'styles' in data:
        styles = data['styles']
        if not isinstance(styles, list) or not styles or index >= len(styles):
            raise ValueError('Cue index outside catalog styles')
        cue = styles[index]
    else:
        if index:
            raise ValueError('A single composition/session only has cue index 0')
        cue = data.get('score', data)
    if not isinstance(cue, dict) or not isinstance(cue.get('events'), list) or not cue['events']:
        raise ValueError('Selected cue needs a non-empty events array')
    if len(cue['events']) > 12000:
        raise ValueError('Viewer is limited to 12,000 events; no automatic truncation')
    bpm = cue.get('bpm')
    if isinstance(bpm, bool) or not isinstance(bpm, (int, float)) or not math.isfinite(bpm) or not 30 <= bpm <= 260:
        raise ValueError('Selected cue BPM must be finite and between 30 and 260')
    if not all(isinstance(event, dict) for event in cue['events']):
        raise ValueError('Every event must be an object')
    # Browser importer validates ranges, track limits and supported event semantics.
    # Keep user data intact; this is not the complete canonical CLI validator.
    script_json(cue)
    return cue


def build_html(data: Any = None, *, demo: str = 'instrumentarium', cue_index: int = 0,
               resources: Path = RESOURCES) -> str:
    if demo not in DEMOS:
        raise ValueError('Unknown demo')
    if data is not None and demo != 'instrumentarium':
        raise ValueError('Imported scores use instrumentarium; other demos generate their own material')
    cue = select_cue(data, cue_index) if data is not None else None
    if data is None and cue_index:
        raise ValueError('cue-index requires an input catalog')
    metadata = json.loads((resources / 'ideas.json').read_text(encoding='utf-8'))
    item = next(row for row in metadata if row[1] == demo)
    ident, mode, title, headline, desc, hypothesis, limits, interactions = item
    css = '\n'.join((resources / name).read_text(encoding='utf-8') for name in ('ui.css', 'atelier.css'))
    js = '\n'.join((resources / name).read_text(encoding='utf-8') for name in JS_ORDER)
    # Source scripts are trusted bundled assets, not strings supplied by the score.
    if '</script' in js.lower():
        raise ValueError('Bundled JS must not contain literal closing script tags')
    fields = {'TITLE': title, 'TITLE_UPPER': title.upper(), 'HEADLINE': headline, 'DESC': desc,
              'HYP': hypothesis, 'LIMITS': limits, 'IDEA_ID': ident, 'MODE': mode,
              'NUMBER': ident[-2:], **{f'INTERACT_{i}': text for i, text in enumerate(interactions)}}
    config = {'id': ident, 'mode': mode, 'sources': json.loads((resources / 'sources.json').read_text(encoding='utf-8'))}
    document = (resources / 'template.html').read_text(encoding='utf-8')
    for key, value in fields.items():
        document = document.replace('__' + key + '__', html.escape(value))
    # Data replacement is last so literal placeholders in imported titles are preserved.
    document = document.replace('__STYLE__', css).replace('__SCRIPT__', js)
    document = document.replace('__CONFIG__', script_json(config)).replace('__INITIAL__', script_json(cue))
    return document


def write_html(output: Path, document: str) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open('x', encoding='utf-8', newline='\n') as handle:
        handle.write(document)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', type=Path, help='Composition, catalog or Atelier session JSON')
    parser.add_argument('--output', type=Path, required=True, help='New standalone HTML; never overwritten')
    parser.add_argument('--demo', choices=DEMOS, default='instrumentarium')
    parser.add_argument('--cue-index', type=int, default=0)
    args = parser.parse_args()
    try:
        if args.output.exists():
            raise ValueError('Output exists; choose a new filename')
        data = load_json(args.input) if args.input else None
        document = build_html(data, demo=args.demo, cue_index=args.cue_index)
        write_html(args.output, document)
        print(f'Created {args.output} — offline synthetic preview; not a native-bank render')
        return 0
    except (OSError, ValueError, KeyError, TypeError, StopIteration) as exc:
        print(f'Viewer failed: {exc}', file=sys.stderr)
        return 2


if __name__ == '__main__':
    raise SystemExit(main())
