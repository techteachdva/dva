# -*- coding: utf-8 -*-
"""
DNDTT Kind registry — K in ~T:O;K,E.N (TOKEN REWORK.pdf).

Resolution order:
  1) Match pool by (topic, order), else topic-only, else Uncharted.
  2) mode ``branch_weighted`` (default): pick a branch with probability ∝ sum(row
     weights in branch), then pick a leaf with probability ∝ row weight within branch.
  3) mode ``flat_weighted``: one weighted draw from the whole pool.
  4) mode ``flat_uniform``: uniform random (legacy).

RNG is supplied by the caller (e.g. per-word deterministic RNG in holonic_analyzer) so
the same text yields the same kinds for the same chart.

Spine: Kind codes use dotted segments (e.g. 2.1.4.2, pool_7); see parse_kind_spine().
"""

from __future__ import annotations

import csv
from dataclasses import dataclass
from pathlib import Path
from random import Random
from collections import defaultdict
from typing import ClassVar

# --- Public constants ---------------------------------------------------------

DEFAULT_PICK_MODE = "branch_weighted"
VALID_PICK_MODES = frozenset({"branch_weighted", "flat_weighted", "flat_uniform"})


def parse_kind_spine(kind_code: str) -> tuple[str, ...]:
    """
    Split a Kind code into spine segments (TOKEN REWORK: ;#.#.#.# style stored as dots).

    Non-numeric segments (e.g. pool_7) are kept as-is for special rows.
    """
    k = (kind_code or "").strip()
    if not k:
        return ()
    return tuple(s.strip() for s in k.split(".") if s.strip())


def spine_prefix(kind_code: str, depth: int) -> tuple[str, ...]:
    """First ``depth`` segments (for parent linkage / future roll tables)."""
    segs = parse_kind_spine(kind_code)
    if depth <= 0:
        return segs
    return segs[:depth]


@dataclass(frozen=True)
class KindEntry:
    topic: int
    order: str
    kind_code: str
    kind_label: str
    branch: str
    notes: str
    status: str
    weight: float = 1.0
    parent_code: str = ""

    @classmethod
    def uncharted(cls, topic: int, order: str) -> KindEntry:
        return cls(
            topic=topic,
            order=order,
            kind_code="0",
            kind_label="Uncharted",
            branch="",
            notes="No kinds_chart row for this topic/order yet",
            status="placeholder",
            weight=1.0,
            parent_code="",
        )


def _parse_weight(raw: str | None) -> float:
    w = (raw or "").strip()
    if not w:
        return 1.0
    try:
        return max(0.0, float(w))
    except ValueError:
        return 1.0


class KindsChart:
    """In-memory index built from kinds_chart.csv."""

    def __init__(self, rows: list[KindEntry]) -> None:
        self._rows = rows
        by_pair: dict[tuple[int, str], list[KindEntry]] = {}
        by_topic: dict[int, list[KindEntry]] = {}
        for r in rows:
            by_pair.setdefault((r.topic, r.order), []).append(r)
            by_topic.setdefault(r.topic, []).append(r)
        self._by_pair = by_pair
        self._by_topic = by_topic

    @classmethod
    def load_csv(cls, path: Path) -> KindsChart:
        rows: list[KindEntry] = []
        with path.open(encoding="utf-8", newline="") as f:
            reader = csv.DictReader(f)
            for raw in reader:
                try:
                    topic = int((raw.get("topic") or "").strip())
                except ValueError:
                    continue
                order = (raw.get("order") or "").strip()
                if not order:
                    continue
                rows.append(
                    KindEntry(
                        topic=topic,
                        order=order,
                        kind_code=(raw.get("kind_code") or "").strip() or "0",
                        kind_label=(raw.get("kind_label") or "").strip() or "?",
                        branch=(raw.get("branch") or "").strip(),
                        notes=(raw.get("notes") or "").strip(),
                        status=(raw.get("status") or "").strip() or "skeleton",
                        weight=_parse_weight(raw.get("weight")),
                        parent_code=(raw.get("parent_code") or "").strip(),
                    )
                )
        return cls(rows)

    def pool_for(self, topic: int, order: str) -> list[KindEntry]:
        """Exact (topic, order) pool, else all rows for topic, else empty."""
        pool = self._by_pair.get((topic, order))
        if not pool:
            pool = self._by_topic.get(topic, [])
        return list(pool)

    def pick(
        self,
        topic: int,
        order: str,
        rng: Random,
        *,
        mode: str = DEFAULT_PICK_MODE,
        normalized_word: str = "",
    ) -> KindEntry:
        """
        Select a KindEntry. ``rng`` should be the per-word RNG for reproducibility.

        ``normalized_word`` is reserved for future gloss/morpheme biasing; passed through
        for API stability.
        """
        _ = normalized_word  # future: filter pool by keyword hints
        pool = self.pool_for(topic, order)
        if not pool:
            return KindEntry.uncharted(topic, order)
        if len(pool) == 1:
            return pool[0]

        roots = [e for e in pool if not (e.parent_code or "").strip()]
        by_parent: dict[str, list[KindEntry]] = defaultdict(list)
        for e in pool:
            p = (e.parent_code or "").strip()
            if p:
                by_parent[p].append(e)

        if not by_parent:
            return self._pick_within_pool(pool, rng, mode)

        if not roots:
            return self._weighted_choice(rng, pool)

        meta: list[tuple[str, list[KindEntry], float]] = []
        w_roots = sum(max(0.0, e.weight) for e in roots)
        meta.append(("__roots__", roots, w_roots))
        for p, kids in by_parent.items():
            w_k = sum(max(0.0, e.weight) for e in kids)
            meta.append((p, kids, w_k))
        weights = [m[2] for m in meta]
        if sum(weights) <= 0:
            return rng.choice(pool)
        _key, subpool, _w = rng.choices(meta, weights=weights, k=1)[0]
        if _key == "__roots__":
            return self._pick_within_pool(subpool, rng, mode)
        return self._weighted_choice(rng, subpool)

    def _pick_within_pool(self, pool: list[KindEntry], rng: Random, mode: str) -> KindEntry:
        """Pick from a flat pool with no parent_code tier (used for roots and non-hierarchical pools)."""
        if mode not in VALID_PICK_MODES:
            mode = "flat_uniform"

        if mode == "flat_uniform":
            return rng.choice(pool)

        if mode == "flat_weighted":
            return self._weighted_choice(rng, pool)

        by_br: dict[str, list[KindEntry]] = {}
        for e in pool:
            key = e.branch if e.branch.strip() else "_"
            by_br.setdefault(key, []).append(e)

        if len(by_br) == 1:
            only = next(iter(by_br.values()))
            return self._weighted_choice(rng, only)

        branch_keys = list(by_br.keys())
        branch_wts = [sum(max(0.0, x.weight) for x in by_br[k]) for k in branch_keys]
        if sum(branch_wts) <= 0:
            return rng.choice(pool)
        chosen_branch = rng.choices(branch_keys, weights=branch_wts, k=1)[0]
        leaves = by_br[chosen_branch]
        return self._weighted_choice(rng, leaves)

    @staticmethod
    def _weighted_choice(rng: Random, entries: list[KindEntry]) -> KindEntry:
        weights = [max(0.0, e.weight) for e in entries]
        total = sum(weights)
        if total <= 0:
            return rng.choice(entries)
        return rng.choices(entries, weights=weights, k=1)[0]

    def branches_for(self, topic: int, order: str) -> dict[str, list[KindEntry]]:
        """Expose branch → entries for UI / debugging."""
        pool = self.pool_for(topic, order)
        out: dict[str, list[KindEntry]] = {}
        for e in pool:
            key = e.branch if e.branch.strip() else "_"
            out.setdefault(key, []).append(e)
        return out

    def __len__(self) -> int:
        return len(self._rows)


def default_kinds_chart_path() -> Path:
    return Path(__file__).resolve().parent.parent / "kinds_chart.csv"
