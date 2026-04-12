# -*- coding: utf-8 -*-
from __future__ import annotations

import hashlib

from holonic_analyzer import AnalysisResult

from uriel.models import WorldExploreSession


def new_world_session(label: str, analysis: AnalysisResult) -> WorldExploreSession:
    """Factory for a session; hash is available if you need save-game IDs later."""
    _ = hashlib.sha256(repr(analysis.tokens).encode("utf-8", errors="replace")).hexdigest()[:16]
    return WorldExploreSession(label=label, analysis=analysis)
