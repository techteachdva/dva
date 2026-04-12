# -*- coding: utf-8 -*-
"""Core data hooks for RPG mechanics — intentionally empty total=False TypedDicts."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, TypedDict

from holonic_analyzer import AnalysisResult


class GameMechanicsPayload(TypedDict, total=False):
    """
    Future: attach AC, HP, inventory item IDs, spell slots, faction standing, etc.
    Keys are stable string IDs; values are JSON-serializable or small structs.
    """

    note: str


class EntityKindDetail(TypedDict, total=False):
    """Reserved for when an Entity token resolves to a full stat block."""

    cr: str
    source: str


@dataclass
class WorldExploreSession:
    """
    Session shell around a text analysis: the 'world' you explore after translation.
    Use `extensions` for modules that are not yet wired (map, journal, combat).
    """

    label: str
    analysis: AnalysisResult
    extensions: dict[str, Any] = field(default_factory=dict)

    def attach(self, key: str, value: Any) -> None:
        self.extensions[key] = value
