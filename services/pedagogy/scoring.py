"""
Aggregate Likert responses (1–5) into **1–100** spectrum scores (display scale).

Each item is rated 1 (Strongly Disagree) .. 5 (Strongly Agree). Items are assigned to
one pedagogical spectrum. Some items are reverse-scored so that **higher always means
"more of the right-hand pole"** on that spectrum.

We compute a mean Likert score per spectrum, then map linearly to 1–100:
(score_100 = 1 + (mean_1_to_5 - 1) * 99 / 4).
"""
from __future__ import annotations

from collections import defaultdict

from questions_data import QUESTIONS, Field, Question


def _reverse_if_needed(value_1_to_5: int, reverse: bool) -> int:
    return 6 - value_1_to_5 if reverse else value_1_to_5


def _likert_mean_to_100(mean_1_to_5: float) -> float:
    # 1 ↦ 1, 5 ↦ 100
    return 1.0 + (mean_1_to_5 - 1.0) * (99.0 / 4.0)


def compute_raw_field_totals(responses: dict[int, int]) -> dict[Field, float]:
    """
    Mean Likert (1–5) per spectrum (after reverse scoring).

    This is shown in the report as the "raw" layer because it is the direct scale teachers answered.
    """
    sums: dict[Field, int] = defaultdict(int)
    counts: dict[Field, int] = defaultdict(int)

    for q in QUESTIONS:
        v = responses.get(q.id)
        if v is None:
            continue
        v = int(v)
        if not 1 <= v <= 5:
            continue
        adj = _reverse_if_needed(v, q.reverse_scored)
        sums[q.spectrum] += adj
        counts[q.spectrum] += 1

        if q.contributes_to_constructivism:
            sums[Field.CONSTRUCTIVISM_INDEX] += adj
            counts[Field.CONSTRUCTIVISM_INDEX] += 1

    out: dict[Field, float] = {}
    for f in Field:
        if counts.get(f, 0) > 0:
            out[f] = sums[f] / counts[f]
        else:
            out[f] = 3.0  # neutral if missing
    return out


def compute_field_scores(responses: dict[int, int]) -> dict[Field, float]:
    """
    responses: question_id -> Likert rating (1..5).

    Each field score is in **[1, 100]**, derived from the mean Likert rating per spectrum.
    """
    means = compute_raw_field_totals(responses)
    return {f: _likert_mean_to_100(means[f]) for f in Field}


def rank_fields(scores: dict[Field, float]) -> tuple[list[tuple[Field, float]], list[tuple[Field, float]]]:
    items = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    return items, list(reversed(items))
