# -*- coding: utf-8 -*-
"""
Single entry for web / tooling: run analysis and return JSON-friendly text + graph payload.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from holonic_analyzer import (
    AnalysisResult,
    MorphemeDictionary,
    analysis_to_graph_payload,
    analyze_text,
)
from uriel.campaign_notes import (
    format_dm_campaign_notes,
    format_player_handout,
    format_technical_token_log,
)
from uriel.kinds_registry import KindsChart


def analyze_to_web_bundle(
    text: str,
    morpheme_csv: str | Path,
    kinds_csv: str | Path,
    *,
    kind_pick_mode: str = "branch_weighted",
) -> dict[str, Any]:
    """
    Load dictionaries from paths (strings work with Pyodide virtual FS), analyze ``text``,
    return technical / DM / player strings plus ``graph`` dict for canvas/vis-network.
    """
    mp = Path(morpheme_csv)
    kp = Path(kinds_csv)
    dictionary = MorphemeDictionary.load_csv(mp)
    kinds = KindsChart.load_csv(kp)
    result = analyze_text(text, dictionary, kinds, kind_pick_mode=kind_pick_mode)
    return bundle_from_result(result)


def bundle_from_result(result: AnalysisResult) -> dict[str, Any]:
    """Format an existing ``AnalysisResult`` (e.g. after tests) into the web payload shape."""
    return {
        "technical": format_technical_token_log(result),
        "dm": format_dm_campaign_notes(result),
        "player": format_player_handout(result),
        "graph": analysis_to_graph_payload(result),
        "stats": {
            "sentences": len(result.sentences),
            "tokens": len(result.tokens),
            "morpheme_dictionary_size": result.morpheme_dictionary_size,
            "kinds_chart_size": result.kinds_chart_size,
        },
    }
