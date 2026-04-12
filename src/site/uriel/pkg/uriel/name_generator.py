# -*- coding: utf-8 -*-
"""
Procedural names for Entity / Location / Object.

Location & object compounds take inspiration from Dwarf Fortress language raws: words are
combined using front/rear compound patterns (see FRONT_COMPOUND_NOUN / REAR_COMPOUND_NOUN
in DF language tokens — adjacent stems form a single proper noun).

Entity names use culture-specific syllable pools keyed by kinds_chart ~1:E kind_label
(D&D-style ancestries and creature types). Extra TOKEN REWORK–style entries are included
for humanoids and non-humanoids not yet on every chart row.
"""

from __future__ import annotations

from random import Random
from typing import Sequence

# --- Material-plane biomes (HH_Planet_Biomes) ---------------------------------
HH_PLANET_BIOMES: dict[int, str] = {
    0: "Atmosphere",
    1: "Marine",
    2: "Glacier",
    3: "Tundra",
    4: "Taiga",
    5: "Cold Desert",
    6: "Hot Desert",
    7: "Tropical Rainforest",
    8: "Wetland",
    9: "Tropical Seasonal Forest",
    10: "Savana",
    11: "Grassland",
    12: "Temperate Deciduous Forest",
    13: "Temperate Rainforest",
}

# ~10% weight: planar / otherworld locations (aligns with kinds_chart HH_Color_Pools + planar biomes)
PLANAR_REALMS: tuple[str, ...] = (
    "The Abyss",
    "Limbo",
    "The Nine Hells",
    "The Beastlands",
    "Arcadia",
    "Mechanus",
    "Mount Celestia",
    "Bytopia",
    "Elysium",
    "The Gray Waste",
    "Carceri",
    "Gehenna",
    "Hades",
    "Pandemonium",
    "The Outlands",
    "Sigil",
    "The Feywild",
    "The Shadowfell",
    "The Elemental Plane of Fire",
    "The Elemental Plane of Water",
    "The Elemental Plane of Air",
    "The Elemental Plane of Earth",
    "The Astral Sea",
    "The Ethereal Veil",
    "Amethyst (Abyssal layer)",
    "Ruby (Nine Hells layer)",
)

MATERIAL_PLANE_BIAS_DEFAULT = 0.90

# DF-style: pools tagged for front vs rear compounds (language_words-style stems)
_LOC_FRONT: tuple[str, ...] = (
    "Deep",
    "High",
    "Low",
    "Old",
    "Lost",
    "Broken",
    "Bleak",
    "Ash",
    "Frost",
    "Sun",
    "Iron",
    "Ghost",
    "Red",
    "Black",
    "White",
    "Storm",
    "Mist",
    "Blood",
    "Silver",
    "Gold",
    "Grim",
    "Fair",
    "Dread",
    "Hollow",
    "Still",
)

_LOC_REAR: tuple[str, ...] = (
    "mire",
    "hollow",
    "ford",
    "watch",
    "spire",
    "gate",
    "run",
    "barrow",
    "fen",
    "crag",
    "moor",
    "wick",
    "stead",
    "heim",
    "gard",
    "fell",
    "vale",
    "mere",
    "cross",
    "well",
    "pit",
    "rest",
    "hold",
    "mark",
    "bloom",
)

# Optional middle for three-part rare compounds (DF sometimes stacks symbols)
_LOC_MID: tuple[str, ...] = (
    "stone",
    "bone",
    "iron",
    "ash",
    "marrow",
    "thorn",
    "shadow",
    "salt",
)

_OBJ_FRONT: tuple[str, ...] = (
    "Ash",
    "Blood",
    "Dawn",
    "Dusk",
    "Frost",
    "Gloom",
    "Grim",
    "Rune",
    "Storm",
    "Void",
    "Wild",
    "Wyrm",
    "Night",
    "Sun",
)

_OBJ_REAR: tuple[str, ...] = (
    "blade",
    "fang",
    "grip",
    "ward",
    "bane",
    "song",
    "thread",
    "shard",
    "heart",
    "crown",
    "mantle",
    "spire",
    "lock",
    "key",
    "band",
    "chain",
)

# --- Entity: culture buckets (syllables + optional surname patterns) ----------


def _join_syllables(rng: Random, parts: Sequence[str], n_lo: int, n_hi: int) -> str:
    n = rng.randint(n_lo, n_hi)
    s = "".join(rng.choice(parts) for _ in range(n))
    # Capitalize like a proper name
    return s[:1].upper() + s[1:] if s else "Unnamed"


_SYL_DWARF = (
    "thor",
    "grim",
    "bor",
    "nak",
    "thra",
    "rin",
    "dul",
    "mor",
    "gar",
    "thum",
    "bal",
    "din",
    "kur",
    "vok",
    "hen",
    "sor",
    "tor",
    "mun",
)
_SYL_ELF = (
    "ae",
    "thil",
    "lar",
    "ien",
    "mir",
    "wyn",
    "sil",
    "nor",
    "ael",
    "dir",
    "riel",
    "las",
    "ion",
    "wen",
    "fea",
)
_SYL_HUMAN = (
    "mar",
    "ric",
    "ald",
    "ben",
    "cyr",
    "hel",
    "jor",
    "kat",
    "len",
    "os",
    "pet",
    "ser",
    "tom",
    "val",
    "wil",
    "yan",
)
_SYL_GOBLIN = (
    "rik",
    "zit",
    "nak",
    "grot",
    "snik",
    "krab",
    "zug",
    "vrik",
    "tik",
    "mog",
    "skit",
    "blix",
)
_SYL_ORC = (
    "grok",
    "nar",
    "thak",
    "dur",
    "lug",
    "mog",
    "ruk",
    "zar",
    "kash",
    "brug",
)
_SYL_HALFLING = (
    "per",
    "pip",
    "mer",
    "sam",
    "ros",
    "bil",
    "din",
    "tol",
    "wil",
    "bar",
)
_SYL_GNOME = (
    "nim",
    "fin",
    "cor",
    "wim",
    "zin",
    "tib",
    "gel",
    "nor",
)
_SYL_TIEFLING = (
    "zar",
    "mep",
    "kis",
    "vor",
    "xar",
    "ith",
    "ael",
    "ryn",
)
_SYL_DRAGONBORN = (
    "dar",
    "zor",
    "kir",
    "rax",
    "vel",
    "jin",
    "sor",
    "hex",
)
_SYL_CELESTIAL = (
    "ael",
    "ser",
    "the",
    "mik",
    "ur",
    "iel",
    "pha",
    "lum",
)
_SYL_INFERNAL = (
    "mal",
    "zor",
    "baph",
    "asm",
    "vex",
    "gor",
    "lil",
    "paz",
)
_SYL_UNDEAD = (
    "mor",
    "vain",
    "strah",
    "lich",
    "ske",
    "grim",
    "nox",
    "wra",
)
_SYL_PRIMORDIAL = (
    "tar",
    "pha",
    "levi",
    "zara",
    "tem",
    "dra",
    "ka",
    "pyr",
)
_SYL_BEAST = (
    "snarl",
    "fang",
    "paw",
    "muzzle",
    "howl",
    "run",
    "pack",
)
_SYL_FEY = (
    "pix",
    "sprite",
    "thorn",
    "moss",
    "glam",
    "syl",
    "fae",
)
_SYL_ABERRATION = (
    "ith",
    "ul",
    "mim",
    "vex",
    "zor",
    "qil",
)
_SYL_CONSTRUCT = (
    "cog",
    "brass",
    "steel",
    "bolt",
    "gear",
    "iron",
    "tin",
    "forg",
)
_SYL_ELEMENTAL = (
    "ember",
    "tide",
    "gale",
    "shard",
    "magma",
    "frost",
    "spark",
    "core",
)
_SYL_DRAGON = (
    "rax",
    "thor",
    "ign",
    "zeph",
    "glaur",
    "vel",
    "drak",
    "pyr",
)

# kind_label substring / exact → syllable pool key
_KIND_STYLE: tuple[tuple[str, str], ...] = (
    # Mortal ancestries (PHB-adjacent)
    ("Dwarf", "dwarf"),
    ("Elf-High", "elf"),
    ("Elf-Wood", "elf"),
    ("Human", "human"),
    ("Halfling", "halfling"),
    ("Gnome", "gnome"),
    ("Tiefling", "tiefling"),
    ("Dragonborn", "dragonborn"),
    ("Half-Elf", "elf"),
    ("Half-Orc", "orc"),
    ("Orc", "orc"),
    ("Aasimar", "celestial"),
    ("Genasi", "human"),
    ("Gith", "aberration"),
    ("Firbolg", "elf"),
    ("Kenku", "goblin"),
    ("Tabaxi", "beast"),
    ("Triton", "human"),
    ("Bugbear", "orc"),
    ("Hobgoblin", "orc"),
    ("Yuan-ti", "infernal"),
    ("Lizardfolk", "beast"),
    ("Kobold", "goblin"),
    ("Genasi", "human"),
    ("Warforged", "construct"),
    ("Construct", "construct"),
    ("Automaton", "construct"),
    ("Changeling", "human"),
    ("Shifter", "beast"),
    ("Centaur", "beast"),
    ("Minotaur", "beast"),
    ("Loxodon", "beast"),
    ("Simic Hybrid", "aberration"),
    ("Verdan", "goblin"),
    ("True Dragons", "dragon"),
    ("Dragon", "dragon"),
    ("Elemental", "elemental"),
    ("Ooze", "aberration"),
    ("Plant", "fey"),
    ("Plant Creature", "fey"),
    ("Giant", "human"),
    ("Monstrosity", "beast"),
    ("Celestial", "celestial"),
    ("Fiend", "infernal"),
    ("Fey", "fey"),
    ("Undead", "undead"),
    ("Aberration", "aberration"),
    ("Humanoid", "human"),
    ("Beast", "beast"),
    ("Merfolk", "human"),
    ("Sahuagin", "beast"),
    ("Mind Flayer", "aberration"),
    ("Beholder", "aberration"),
    # kinds_chart.csv Entity rows
    ("Dwarf-Hill", "dwarf"),
    ("Overdeity", "celestial"),
    ("Greater Deity", "celestial"),
    ("Intermediate Deity", "celestial"),
    ("Lesser Deity", "celestial"),
    ("Demigod", "celestial"),
    ("PC God", "celestial"),
    ("Tarrasque", "primordial"),
    ("Phoenix", "primordial"),
    ("Leviathan", "primordial"),
    ("Elder Tempest", "primordial"),
    ("Zaratan", "primordial"),
    ("Dust Mephit", "infernal"),
    ("Ice Mephit", "infernal"),
    ("Angels_LG", "celestial"),
    ("Angels", "celestial"),
    ("Devils_LE", "infernal"),
    ("Devils", "infernal"),
    ("Demons_CE", "infernal"),
    ("Demons", "infernal"),
    ("Lich", "undead"),
    ("Vampire", "undead"),
    ("Canine_Beast", "beast"),
    ("Quest-Giver", "human"),
    ("Merchant", "human"),
    ("Patron_as_Entity", "infernal"),
    ("Rival_NPC", "human"),
    ("Witness_to_Oath", "human"),
    ("Exiled_Noble", "human"),
    ("Pact_Bearer", "infernal"),
)

_STYLE_SYLLABLES: dict[str, tuple[str, ...]] = {
    "dwarf": _SYL_DWARF,
    "elf": _SYL_ELF,
    "human": _SYL_HUMAN,
    "goblin": _SYL_GOBLIN,
    "orc": _SYL_ORC,
    "halfling": _SYL_HALFLING,
    "gnome": _SYL_GNOME,
    "tiefling": _SYL_TIEFLING,
    "dragonborn": _SYL_DRAGONBORN,
    "celestial": _SYL_CELESTIAL,
    "infernal": _SYL_INFERNAL,
    "undead": _SYL_UNDEAD,
    "primordial": _SYL_PRIMORDIAL,
    "beast": _SYL_BEAST,
    "fey": _SYL_FEY,
    "aberration": _SYL_ABERRATION,
    "construct": _SYL_CONSTRUCT,
    "elemental": _SYL_ELEMENTAL,
    "dragon": _SYL_DRAGON,
}


def entity_style_for_kind(kind_label: str) -> str:
    """Map kinds_chart Entity kind_label to internal style key."""
    k = (kind_label or "").strip()
    if not k:
        return "human"
    kl = k.lower()
    # Longest / most specific matches first
    for needle, style in sorted(_KIND_STYLE, key=lambda x: -len(x[0])):
        if needle.lower() in kl or kl in needle.lower():
            return style
    # Word-level fuzzy
    for needle, style in _KIND_STYLE:
        if needle.lower() in kl:
            return style
    return "human"


def list_entity_kind_options() -> list[str]:
    """Static fallback kind labels (matches _KIND_STYLE needles + extended ancestries)."""
    from_csv = sorted({needle for needle, _ in _KIND_STYLE})
    extras = [
        "Halfling (Lightfoot)",
        "Halfling (Stout)",
        "Gnome (Forest)",
        "Gnome (Rock)",
        "Half-Orc",
        "Half-Elf",
        "Orc",
        "Aasimar",
        "Genasi (Air)",
        "Genasi (Earth)",
        "Genasi (Fire)",
        "Genasi (Water)",
        "Githyanki",
        "Githzerai",
        "Yuan-ti Pureblood",
        "Lizardfolk",
        "Bugbear",
        "Hobgoblin",
        "Centaur",
        "Minotaur",
        "Loxodon",
        "Simic Hybrid",
        "Verdan",
        "Changeling",
        "Kalashtar",
        "Warforged",
        "Shifter",
    ]
    merged = sorted(set(from_csv) | set(extras))
    return merged


def entity_kind_labels_for_ui(chart: object | None) -> list[str]:
    """
    Kind labels for the entity dropdown: all ``~1:E`` rows from the loaded chart plus
    static TOKEN REWORK–style extensions (humanoids / creature types).
    """
    merged: set[str] = set(list_entity_kind_options())
    if chart is not None:
        pool_for = getattr(chart, "pool_for", None)
        if callable(pool_for):
            for e in pool_for(1, "E"):
                merged.add(e.kind_label)
    return sorted(merged)


def generate_entity_name(rng: Random, kind_label: str) -> str:
    style = entity_style_for_kind(kind_label)
    pool = _STYLE_SYLLABLES.get(style, _SYL_HUMAN)
    first = _join_syllables(rng, pool, 2, 3)
    if rng.random() < 0.55:
        last = _join_syllables(rng, pool, 2, 2)
        return f"{first} {last}"
    return first


# --- Location / Object compounds ---------------------------------------------


def _compound_two(rng: Random, front: Sequence[str], rear: Sequence[str]) -> str:
    a, b = rng.choice(front), rng.choice(rear)
    # CamelCase single word per DF compound surname style, or spaced - use solid lowercase for place
    return (a + b).lower()


def _compound_three(rng: Random) -> str:
    return (
        rng.choice(_LOC_FRONT).lower()
        + rng.choice(_LOC_MID)
        + rng.choice(_LOC_REAR)
    )


def generate_location_name(
    rng: Random,
    *,
    material_plane_bias: float = MATERIAL_PLANE_BIAS_DEFAULT,
) -> tuple[str, str]:
    """
    Returns (display_name, tag) where tag is biome name or planar realm.

    ~``material_plane_bias`` of results are material-plane biomes (HH planet list);
    the rest are planar / otherworld gates.
    """
    if rng.random() >= material_plane_bias:
        realm = rng.choice(PLANAR_REALMS)
        # Portal-flavored compound + realm tag
        core = _compound_two(rng, _LOC_FRONT, _LOC_REAR)
        if rng.random() < 0.35:
            core = _compound_three(rng)
        name = f"{core.title()} — threshold to {realm}"
        return name, realm

    biome_id = rng.randint(0, 13)
    biome = HH_PLANET_BIOMES[biome_id]
    if rng.random() < 0.15:
        name = _compound_three(rng).title()
    else:
        name = _compound_two(rng, _LOC_FRONT, _LOC_REAR).title()
    return f"{name} ({biome})", biome


def generate_object_name(rng: Random) -> str:
    """DF-style artifact / item compound."""
    if rng.random() < 0.25:
        return (rng.choice(_OBJ_FRONT) + rng.choice(_OBJ_REAR)).title()
    return (
        rng.choice(_OBJ_FRONT).lower()
        + rng.choice(_LOC_MID)
        + rng.choice(_OBJ_REAR)
    ).title()


def generate_batch(
    rng: Random,
    kind: str,
    *,
    entity_kind: str = "Human-Basic",
    count: int = 5,
    material_plane_bias: float = MATERIAL_PLANE_BIAS_DEFAULT,
) -> list[str | tuple[str, str]]:
    kind_l = (kind or "entity").lower()
    out: list[str | tuple[str, str]] = []
    for _ in range(max(1, min(count, 50))):
        if kind_l == "entity":
            out.append(generate_entity_name(rng, entity_kind))
        elif kind_l == "location":
            out.append(generate_location_name(rng, material_plane_bias=material_plane_bias))
        else:
            out.append(generate_object_name(rng))
    return out
