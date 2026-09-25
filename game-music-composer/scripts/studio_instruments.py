"""Studio instrument identities with their explicit Factory Bank assignments.

The browser studio publishes this map as atelier/instruments.js; the studio-engine
bridge uses it to turn synthesized engine songs into native sample-bank scores.
"""
from __future__ import annotations

import generate_neospc100_v3 as engine
from compose_from_plan import apply_factory_assignments

# Explicit bank assignments for the three additional Atelier identities.
ADDITIONS = {
    'epiano': ('piano', 'keys.electric_piano', 'Electric Piano'),
    'kalimba': ('harp', 'plucks.dulcimer', 'Dulcimer'),
    'metallophone': ('vibes', 'mallets.vibraphone', 'Vibraphone'),
}


def studio_instruments() -> dict[str, dict]:
    # The current catalog is not guaranteed to use every playable identity.
    instruments = {name: {'sample': values[0].removesuffix('.wav'), 'file': values[0], 'root_midi': values[1], 'color': values[2], 'family': values[4], 'label': name.replace('_', ' ').title()} for name, values in engine.INSTRUMENTS.items()}
    apply_factory_assignments({'instrument_map': instruments})
    if any('factory_patch' not in info for info in instruments.values()):
        raise ValueError('Every studio identity needs an explicit Factory assignment.')
    for name, (source, patch, label) in ADDITIONS.items():
        instruments[name] = {**instruments[source], 'label': name.replace('_', ' ').title(), 'factory_patch': patch, 'factory_label': label}
    return instruments
