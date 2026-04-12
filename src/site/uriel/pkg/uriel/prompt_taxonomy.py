# -*- coding: utf-8 -*-
"""
Prompt_Instructions.txt + TOKEN REWORK — Orders, Entia ladder, nominal class, Tracker Year.

Topic is set by morpheme CSV or first letter; Order / Kind / Entia are driven by a
separate RNG seeded from the *rest* of the normalized word (details layer).
"""

from __future__ import annotations

import re
from random import Random

from uriel.stable_hash import stable_uint32
from typing import Literal

# --- Tops_N_Orders (Prompt_Instructions) + TOKEN REWORK extended orders ------------

ORDER_DISPLAY: dict[tuple[int, str], str] = {
    (1, "A"): "(Entity) Ability",
    (1, "C"): "(Entity) Class",
    (1, "E"): "(Entity) Entity",
    (1, "F"): "(Entity) Flaw",
    (1, "G"): "(Entity) Goal",
    (1, "Œ"): "(Entity) Method to Madness",
    (2, "B"): "(Location) Biome",
    (2, "H"): "(Location) Hub",
    (2, "L"): "(Location) Location",
    (2, "Z"): "(Location) Zone",
    (2, "¥"): "(Location) Landmark",
    (2, "ř"): "(Location) Ruin",
    (3, "M"): "(Object) Material",
    (3, "O"): "(Object) Object",
    (3, "R"): "(Object) Rarity",
    (3, "T"): "(Object) Type",
    (3, "U"): "(Object) Utility",
    (3, "¢"): "(Object) Gold Price",
    (3, "Æ"): "(Object) Artifact",
    (4, "N"): "(Functional) Name",
    (4, "S"): "(Functional) Spell",
    (4, "T"): "(Functional) Type",
    (4, "V"): "(Functional) Verb",
    (4, "≈"): "(Functional) Network",
    (4, "!"): "(Functional) Notifier",
    (5, "J"): "(Tracker) Justice",
    (5, "K"): "(Tracker) Knowledge",
    (5, "W"): "(Tracker) Widespread",
    (5, "Y"): "(Tracker) Year",
    (5, "‰"): "(Tracker) Quest Progress",
    (5, "ç"): "(Tracker) Corruption",
    (6, "D"): "(DM) Deity",
    (6, "I"): "(DM) Info",
    (6, "P"): "(DM) Power",
    (6, "Q"): "(DM) Quest",
    (6, "X"): "(DM) Secret",
    (6, "Þ"): "(DM) Front",
}

# One emoji per (topic, order) for GUI scanning — parallel to ORDER_DISPLAY.
ORDER_ICON: dict[tuple[int, str], str] = {
    (1, "A"): "💪",
    (1, "C"): "🛡️",
    (1, "E"): "👤",
    (1, "F"): "⚠️",
    (1, "G"): "🎯",
    (1, "Œ"): "🎭",
    (2, "B"): "🌲",
    (2, "H"): "🏛️",
    (2, "L"): "📍",
    (2, "Z"): "🧭",
    (2, "¥"): "🗿",
    (2, "ř"): "🏚️",
    (3, "M"): "🧱",
    (3, "O"): "📦",
    (3, "R"): "💎",
    (3, "T"): "🏷️",
    (3, "U"): "🔧",
    (3, "¢"): "🪙",
    (3, "Æ"): "🏺",
    (4, "N"): "📛",
    (4, "S"): "🔮",
    (4, "T"): "📋",
    (4, "V"): "✍️",
    (4, "≈"): "🕸️",
    (4, "!"): "🔔",
    (5, "J"): "⚖️",
    (5, "K"): "📜",
    (5, "W"): "🌍",
    (5, "Y"): "📆",
    (5, "‰"): "📈",
    (5, "ç"): "☠️",
    (6, "D"): "⛪",
    (6, "I"): "🌉",
    (6, "P"): "⚡",
    (6, "Q"): "🗺️",
    (6, "X"): "🔐",
    (6, "Þ"): "🚩",
}

# Fallback when a chart introduces a new order letter not yet in ORDER_ICON.
_ORDER_ICON_FALLBACK: dict[str, str] = {
    "A": "💪",
    "B": "🌲",
    "C": "🛡️",
    "D": "✨",
    "E": "👤",
    "F": "⚠️",
    "G": "🎯",
    "H": "🏛️",
    "I": "🌉",
    "J": "⚖️",
    "K": "📜",
    "L": "📍",
    "M": "🧱",
    "N": "📛",
    "O": "📦",
    "P": "⚡",
    "Q": "🗺️",
    "R": "💎",
    "S": "🔮",
    "T": "🏷️",
    "U": "🔧",
    "V": "✍️",
    "W": "🌍",
    "X": "🔐",
    "Y": "📆",
    "Z": "🧭",
}


def order_icon(topic: int, order: str) -> str:
    """Single emoji for this token order (for labels, legends, and quick visual parsing)."""
    o = (order or "").strip()
    if not o:
        return "◆"
    hit = ORDER_ICON.get((topic, o))
    if hit:
        return hit
    if len(o) == 1 and o.upper() in _ORDER_ICON_FALLBACK:
        return _ORDER_ICON_FALLBACK[o.upper()]
    return "◇"


# Per-topic order pools: base Prompt letters + rare TOKEN REWORK specials (low weight)
def _merge_orders(base: dict[str, float], extra: dict[str, float] | None = None) -> dict[str, float]:
    out = dict(base)
    if extra:
        out.update(extra)
    return out


ORDER_WEIGHTS: dict[int, dict[str, float]] = {
    1: _merge_orders({"E": 1.0, "A": 1.0, "C": 1.0, "F": 1.0, "G": 1.0}, {"Œ": 0.06}),
    2: _merge_orders({"L": 1.0, "B": 1.0, "H": 1.0, "Z": 1.0}, {"¥": 0.08, "ř": 0.08}),
    3: _merge_orders({"O": 1.0, "M": 1.0, "R": 1.0, "U": 1.0, "T": 1.0}, {"¢": 0.06, "Æ": 0.05}),
    4: {"N": 0.28, "T": 0.28, "V": 0.24, "S": 0.20, "≈": 0.06, "!": 0.05},
    5: _merge_orders({"J": 1.0, "K": 1.0, "W": 1.0, "Y": 1.0}, {"‰": 0.07, "ç": 0.07}),
    6: _merge_orders({"D": 1.0, "I": 1.0, "P": 1.0, "Q": 1.0, "X": 1.0}, {"Þ": 0.06}),
}


def order_display(topic: int, order: str) -> str:
    return ORDER_DISPLAY.get((topic, order), f"(~{topic}:{order})")


def order_icon_with_label(topic: int, order: str) -> str:
    """Compact string for transcripts: emoji + short order hint."""
    return f"{order_icon(topic, order)} {order_display(topic, order)}"


def pick_order_for_topic(topic: int, rng: Random) -> str:
    """Weighted order draw for a topic (details RNG). Helper ~4 uses Markov weights."""
    table = ORDER_WEIGHTS.get(topic)
    if not table:
        return "N"
    letters = list(table.keys())
    weights = [max(0.0, table[c]) for c in letters]
    if sum(weights) <= 0:
        return rng.choice(letters)
    return rng.choices(letters, weights=weights, k=1)[0]


# --- Entia: Prompt_Instructions lines 128–133 ---------------------------------

EntiaTag = Literal["1", "d2", "d4", "d6", "d8", "d10"]

# (code, human label, weight)
ENTIA_WEIGHTED: list[tuple[str, str, float]] = [
    ("1", "Daily 100% advance", 1.0),
    ("d2", "Daily 50% (simple errand)", 0.85),
    ("d4", "Daily 25% (multistage)", 0.7),
    ("d6", "Daily ~17% (cycles, wild/safe)", 0.55),
    ("d8", "Weekly ~12% (seasons, wild/dungeon)", 0.4),
    ("d10", "Weekly 10% (immortal & mortal plans)", 0.3),
]


def pick_entia(rng: Random) -> tuple[str, str]:
    codes = [e[0] for e in ENTIA_WEIGHTED]
    labels = [e[1] for e in ENTIA_WEIGHTED]
    weights = [e[2] for e in ENTIA_WEIGHTED]
    i = rng.choices(range(len(codes)), weights=weights, k=1)[0]
    return codes[i], labels[i]


# --- Nominal: proper vs common (Prompt: Name token N reserved for proper nouns) ---

_PROPER_RE = re.compile(r"^[A-Z][a-z]+(?:'[A-Z][a-z]+)?$|^[A-Z]{2,}$")


def classify_nominal(surface: str) -> tuple[str, Literal["proper", "common"]]:
    s = (surface or "").strip()
    if not s:
        return "?", "common"
    if _PROPER_RE.match(s):
        return s, "proper"
    if s[0].isupper() and len(s) > 1 and not s.isupper():
        return s, "proper"
    return s, "common"


def roll_tracker_year(rng: Random) -> int:
    """Prompt: Year between -10000 and 10000."""
    return rng.randint(-10_000, 10_000)


def detail_rng(normalized: str, sentence_index: int, word_index: int) -> Random:
    """RNG seeded from *rest* of word + position (details layer). Stable across runs."""
    rest = normalized[1:] if len(normalized) > 1 else normalized
    h = stable_uint32(rest, sentence_index, word_index, "detail_rng")
    return Random(h)
