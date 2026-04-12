# -*- coding: utf-8 -*-
"""Random detail rolls from kinds_chart.csv pools (GUI / tools)."""

from __future__ import annotations

from random import Random
from typing import Any

from uriel.kinds_registry import KindsChart, KindEntry


def format_kind_detail_roll(tok: Any, chart: KindsChart, rng: Random) -> str:
    """
    Build a multi-line report: the token's assigned kind, then random pulls from the
    same (topic, order) pool (and notes/branches) for improvisation.
    """
    pool = chart.pool_for(tok.topic, tok.order)
    lines: list[str] = [
        f"Token: {tok.surface}",
        f"~{tok.topic}:{tok.order}  assigned kind: {tok.kind_label}  (code {tok.kind_code})",
        f"branch: {tok.kind_branch or '—'}",
        f"chart pool for this topic+order: {len(pool)} row(s)",
        "",
    ]
    if not pool:
        lines.append(
            "No rows match this topic/order in the chart (check kinds_chart.csv or topic fallback)."
        )
        return "\n".join(lines)

    k = min(8, max(4, min(len(pool), 6 + rng.randint(0, 2))))
    if len(pool) <= k:
        sample = list(pool)
        rng.shuffle(sample)
    else:
        sample = rng.sample(pool, k=k)

    lines.append("Random pulls from the chart:")
    seen: set[str] = set()
    for e in sample:
        key = f"{e.kind_code}|{e.kind_label}"
        if key in seen:
            continue
        seen.add(key)
        br = f" [{e.branch}]" if e.branch else ""
        note = f" — {e.notes}" if e.notes else ""
        lines.append(f"  • {e.kind_label}{br}{note}")

    spotlight = rng.choice(pool)
    lines.append("")
    lines.append(
        f"Spotlight: {spotlight.kind_label}"
        + (f" — {spotlight.notes}" if spotlight.notes else "")
        + (f"  [{spotlight.branch}]" if spotlight.branch else "")
    )
    return "\n".join(lines)


def format_sentence_hub_roll(
    sentence_index: int,
    sentence_text: str,
    tokens: list[Any],
    chart: KindsChart,
    rng: Random,
) -> str:
    """Aggregate random chart rows from all tokens in one sentence (hub right-click)."""
    lines: list[str] = [
        f"Sentence S{sentence_index + 1}",
        sentence_text,
        "",
        "Tokens in this sentence:",
    ]
    if not tokens:
        lines.append("  (no tokens)")
        return "\n".join(lines)

    merged: list[KindEntry] = []
    for t in tokens:
        merged.extend(chart.pool_for(t.topic, t.order))
    # dedupe by kind_code + label
    uniq: dict[str, KindEntry] = {}
    for e in merged:
        uniq[f"{e.topic}:{e.order}:{e.kind_code}:{e.kind_label}"] = e
    pool = list(uniq.values())
    lines.append("")
    for t in tokens:
        lines.append(f"  • {t.surface}  ~{t.topic}:{t.order}  {t.kind_label}")

    lines.extend(["", f"Merged unique chart rows across pools: {len(pool)}"])
    if not pool:
        return "\n".join(lines)

    k = min(10, max(4, len(pool)))
    sample = rng.sample(pool, k=min(k, len(pool))) if len(pool) > k else pool
    rng.shuffle(sample)
    lines.append("")
    lines.append("Random cross-pulls:")
    for e in sample[:10]:
        note = f" — {e.notes}" if e.notes else ""
        lines.append(f"  • ({e.topic}:{e.order}) {e.kind_label}{note}")
    lines.append("")
    lines.append(f"Spotlight: {rng.choice(pool).kind_label}")
    return "\n".join(lines)
