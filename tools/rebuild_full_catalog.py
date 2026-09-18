#!/usr/bin/env python3
"""Recompose all 240 catalog cues and publish scores plus Studio index."""
from __future__ import annotations

import argparse
import copy
import json
from collections import defaultdict
from pathlib import Path

import regenerate_catalog as r
import extend_catalog as expand

PALETTE_ROTATION = (
    "factory",
    "velvet",
    "circuit",
    "timber",
    "prism",
    "voltage",
    "factory",
    "velvet",
    "circuit",
    "timber",
)
LEFTOVER_PACKS = {"bachata", "trap", "trip_hop", "reggaeton"}
VERSION = "6.3.0-production-banks"
EPOCH = "production-banks-1"


def assign_production_palettes(records: list[dict]) -> int:
    grouped: dict[str, list[dict]] = defaultdict(list)
    for record in records:
        grouped[record["category"]].append(record)
    changed = 0
    for category, pack in grouped.items():
        if category not in LEFTOVER_PACKS:
            continue
        for index, record in enumerate(pack):
            writing = record["native_engine_contract"]["writing"]
            next_palette = PALETTE_ROTATION[index]
            if writing.get("palette") != next_palette:
                writing["palette"] = next_palette
                changed += 1
    return changed


def compact_write(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(value, ensure_ascii=False, separators=(",", ":"), allow_nan=False) + "\n",
        encoding="utf-8",
        newline="\n",
    )


def compose_catalog(seed: int) -> dict:
    old = r.read(r.SKILL / "data/neospc100-benchmark-v4.1.json")
    scene = r.engine.load_catalog_contracts()
    genre_path = r.SKILL / "data/genre-expansion-contracts.json"
    genre_doc = r.read(genre_path)
    palette_changes = assign_production_palettes(genre_doc["contracts"])
    if palette_changes:
        r.write(genre_path, genre_doc)
    genre = genre_doc["contracts"]
    recipe_errors = r.engine.catalog_recipe_errors(scene + genre)
    if recipe_errors:
        raise ValueError("Catalog recipe uniqueness failed: " + "; ".join(recipe_errors))
    source_hashes = {
        name: r.file_hash(r.SKILL / name)
        for name in [
            "SKILL.md",
            "data/catalog-contracts-r03.json",
            "data/genre-expansion-contracts.json",
            "scripts/generate_neospc100_v3.py",
            "scripts/phrase_composer.py",
            "scripts/genre_composer.py",
            "scripts/compose_from_plan.py",
            "scripts/refine_performance.py",
            "scripts/professor_review.py",
        ]
    }
    patches = {patch["id"]: patch for patch in r.read(r.SKILL / "data/factory-bank-manifest.json")["patches"]}
    finished = []
    for number, record in enumerate(scene + genre):
        spec = copy.deepcopy(record["native_engine_contract"])
        cue_id = record["id"]
        cue_seed = int.from_bytes(r.hashlib.sha256(f"{seed}:{cue_id}".encode()).digest()[:4], "big") & 0x7FFFFFFF
        spec["seed"] = cue_seed
        style = r.engine.compose(spec, record["category"], record["category_label"])
        if record["category"] in r.engine.SCENE_CATEGORIES:
            r.composer.enforce_voice_budget(style, max(7, spec["budget"] - 1))
        elif r.composer.first_overflow(style["events"], style["beats"], spec["budget"]):
            raise ValueError(f"{cue_id}: voice overflow")
        r.composer.apply_factory_assignments(style)
        for inst, patch in record.get("patch_overrides", {}).items():
            if inst in style["instrument_map"] and patch in patches:
                style["instrument_map"][inst].update(
                    factory_patch=patch,
                    factory_label=patches[patch]["label"],
                    factory_profile="neo16",
                    factory_source="genre_blueprint",
                )
        style["source_type"] = "generated_catalog"
        style["generation_epoch"] = EPOCH
        style["generation"] = {
            "workflow": "score-blueprint+performance",
            "engine": style.get("writing_evidence", {}).get("engine", "phrase-composer"),
            "seed": cue_seed,
            "contract_sha256": r.digest(record),
            "skill_sources": source_hashes,
        }
        keep = [key for key in ("revision", "game_function", "protected_identity", "musical_direction", "listening_checks") if key in record]
        style["composition_contract"] = {key: copy.deepcopy(record[key]) for key in keep}
        performance = record.get("performance")
        if performance:
            result = r.performance.refine_style(
                style,
                profile=performance["profile"],
                amount=performance["amount"],
                seed=int(performance.get("seed", cue_seed)),
            )
        else:
            result = style
        issues = r.neospc.validate_composition(result)
        if issues:
            raise ValueError(f"{cue_id}: {issues}")
        if record["category"] in expand.GENRES:
            expand.genre_checks(result)
        finished.append(result)
        if (number + 1) % 10 == 0:
            print(f"Composed {number + 1}/{len(scene) + len(genre)}", flush=True)
    review = r.reviews(finished)
    scored = {track["id"]: track for track in review["tracks"]}
    for style in finished:
        item = scored[style["id"]]
        style["professor_review_pass1"] = item
        style["professor_review_final"] = item
        style["composition_quality"] = {
            "status": {"approved": "curated", "revise": "review", "rebuild": "rebuild"}[item["status"]],
            "score": item["score"],
            "reasons": item["critique"],
            "method": "symbolic; human listening pending",
        }
    grouped: dict[str, list[dict]] = defaultdict(list)
    for style in finished:
        grouped[style["category"]].append(style)
    ordered = [style for category, _label in r.engine.CATEGORY_DEFS for style in grouped[category]]
    if len(ordered) != 240:
        raise ValueError("Catalog does not contain 10 cues in each of 24 categories")
    catalog = {
        key: copy.deepcopy(value)
        for key, value in old.items()
        if key in {"voice_model"}
    }
    catalog.update(
        version=VERSION,
        project="Game Music Composer / Phrase Studio",
        categories=[{"id": category, "label": label, "count": 10} for category, label in r.engine.CATEGORY_DEFS],
        styles=ordered,
        regeneration={
            "seed": seed,
            "skill_sources": source_hashes,
            "palette_assignments_updated": palette_changes,
            "human_listening": "pending",
        },
    )
    audit = r.engine.audit(finished)
    if audit["errors"]:
        raise ValueError("Catalog audit failed: " + "; ".join(audit["errors"]))
    issues = r.neospc.validate_catalog(catalog)
    if issues:
        raise ValueError("Catalog validation failed: " + "; ".join(str(item) for item in issues))
    return {"catalog": catalog, "review": review, "audit": audit, "palette_changes": palette_changes}


def publish(bundle: dict, output: Path) -> None:
    catalog = bundle["catalog"]
    output.mkdir(parents=True, exist_ok=True)
    compact_write(output / "catalog.json", catalog)
    r.write(output / "review.json", bundle["review"])
    r.write(output / "diversity-audit.json", bundle["audit"])
    compact_write(r.SKILL / "data/neospc100-benchmark-v4.1.json", catalog)
    review_path = r.STUDIO / "data/reviews.js"
    review_path.write_text(
        "window.NEOSPC_REVIEWS=" + json.dumps({"pass1": bundle["review"], "final": bundle["review"]}, ensure_ascii=False, separators=(",", ":")) + ";\n",
        encoding="utf-8",
        newline="\n",
    )
    print(
        json.dumps(
            {
                "count": len(catalog["styles"]),
                "events": sum(len(style["events"]) for style in catalog["styles"]),
                "review": bundle["review"]["summary"],
                "average": bundle["review"]["average_score"],
                "palette_changes": bundle["palette_changes"],
                "version": catalog["version"],
            }
        ),
        flush=True,
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path)
    parser.add_argument("--seed", type=int, default=20260917)
    args = parser.parse_args()
    publish(compose_catalog(args.seed), args.output.resolve())


if __name__ == "__main__":
    main()
