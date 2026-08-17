#!/usr/bin/env python3
"""Audit the static Neo-SPC showcase without a browser dependency."""
from __future__ import annotations

import json
import re
from html.parser import HTMLParser
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class MarkupAudit(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.ids: list[str] = []
        self.references: list[tuple[str, str]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        if values.get("id"):
            self.ids.append(str(values["id"]))
        for name in ("src", "href"):
            if values.get(name):
                self.references.append((name, str(values[name])))


def load_assignment(path: Path) -> object:
    source = path.read_text(encoding="utf-8").strip()
    try:
        payload = source.split("=", 1)[1].rstrip(";\n ")
    except IndexError as exc:
        raise ValueError(f"Missing JavaScript assignment in {path.name}") from exc
    return json.loads(payload)


def load_cue(path: Path) -> dict:
    source = path.read_text(encoding="utf-8").strip()
    match = re.search(r"window\.NEOSPC_CUES\[\"[^\"]+\"\]=(.*);$", source, re.DOTALL)
    if not match:
        raise ValueError(f"Invalid lazy cue assignment in {path.name}")
    value = json.loads(match.group(1))
    if not isinstance(value, dict):
        raise ValueError(f"Cue payload must be an object in {path.name}")
    return value


def local_path(value: str) -> Path | None:
    if value.startswith(("#", "http://", "https://", "mailto:", "data:", "javascript:")):
        return None
    return ROOT / value.split("?", 1)[0].split("#", 1)[0]


def main() -> int:
    errors: list[str] = []
    warnings: list[str] = []
    parser = MarkupAudit()
    parser.feed((ROOT / "index.html").read_text(encoding="utf-8"))

    duplicates = sorted({item for item in parser.ids if parser.ids.count(item) > 1})
    if duplicates:
        errors.append(f"duplicate HTML ids: {', '.join(duplicates)}")

    for kind, reference in parser.references:
        path = local_path(reference)
        if path is not None and not path.is_file():
            errors.append(f"missing {kind}: {reference}")

    app_source = (ROOT / "app.js").read_text(encoding="utf-8")
    engine_source = (ROOT / "live-engine.js").read_text(encoding="utf-8")
    html_source = (ROOT / "index.html").read_text(encoding="utf-8")
    dom_ids = set(re.findall(r"(?<!\$)\$\('([^']+)'\)", app_source))
    missing_dom = sorted(dom_ids - set(parser.ids))
    if missing_dom:
        errors.append(f"JavaScript references missing HTML ids: {', '.join(missing_dom)}")
    required_ui = {"soundbankMode", "loadCompositionButton", "compositionFileInput", "localImportStatus", "studioMain"}
    if required_ui - set(parser.ids):
        errors.append(f"missing composition/soundbank UI: {', '.join(sorted(required_ui - set(parser.ids)))}")
    for bank_mode in ("factory", "original", "chip"):
        if f'value="{bank_mode}"' not in html_source or f"'{bank_mode}'" not in engine_source:
            errors.append(f"missing live soundbank contract: {bank_mode}")
    for token in ("importLimits", "validateImportedStyle", "importCompositionFiles", "source_type==='local_import'"):
        if token not in app_source:
            errors.append(f"missing local composition guard: {token}")
    for token in ("setBankMode", "scheduleChipEvent", "getNoiseBuffer"):
        if token not in engine_source:
            errors.append(f"missing live engine bank feature: {token}")

    catalog = load_assignment(ROOT / "data" / "catalog.js")
    styles = catalog.get("styles", []) if isinstance(catalog, dict) else []
    if len(styles) != 100:
        errors.append(f"expected 100 catalog cues, found {len(styles)}")
    cue_ids = [str(style.get("id", "")) for style in styles]
    if len(cue_ids) != len(set(cue_ids)):
        errors.append("catalog contains duplicate cue ids")
    for cue_id in cue_ids:
        cue_path = ROOT / "data" / "cues" / f"{cue_id}.js"
        if not cue_path.is_file():
            errors.append(f"missing lazy cue data: data/cues/{cue_id}.js")
        else:
            try:
                cue = load_cue(cue_path)
                if cue.get("id") != cue_id or not cue.get("events") or not cue.get("instrument_map"):
                    errors.append(f"invalid lazy cue payload: data/cues/{cue_id}.js")
            except (ValueError, json.JSONDecodeError) as exc:
                errors.append(str(exc))
        for relative in (f"assets/midi/{cue_id}.mid", f"assets/audio/{cue_id}.ogg", f"assets/audio/{cue_id}.mp3"):
            path = ROOT / relative
            if not path.is_file() or path.stat().st_size == 0:
                errors.append(f"missing or empty cue asset: {relative}")

    previews = load_assignment(ROOT / "data" / "factory-bank-previews.js")
    for patch_id, preview in previews.items() if isinstance(previews, dict) else []:
        path = ROOT / str(preview.get("file", ""))
        if not path.is_file() or path.stat().st_size == 0:
            errors.append(f"missing Factory Bank preview for {patch_id}: {preview.get('file')}")

    for path in (ROOT / "downloads").glob("*.zip"):
        if path.stat().st_size == 0:
            errors.append(f"empty download: {path.name}")
    if not (ROOT / "downloads" / "game-music-composer.zip").is_file():
        errors.append("missing packaged composer skill")
    for relative in ("data/sample-bank.js", "data/factory-bank.js"):
        if not (ROOT / relative).is_file():
            errors.append(f"missing lazy runtime data: {relative}")

    if "focus-visible" not in (ROOT / "styles.css").read_text(encoding="utf-8"):
        warnings.append("no explicit keyboard focus style found")
    if "prefers-reduced-motion" not in (ROOT / "styles.css").read_text(encoding="utf-8"):
        warnings.append("no reduced-motion style found")

    print(f"showcase audit: {len(errors)} error(s), {len(warnings)} warning(s)")
    for message in errors:
        print(f"ERROR   {message}")
    for message in warnings:
        print(f"WARNING {message}")
    if not errors:
        print(f"READY   {len(styles)} cues, {len(parser.ids)} ids, {len(previews)} bank previews")
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
