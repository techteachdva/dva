# -*- coding: utf-8 -*-
"""
Stable 32-bit seeds for ``random.Random``.

Python's built-in ``hash()`` is randomized per interpreter process (``PYTHONHASHSEED``),
so two runs of the same text could yield different holon details. URIEL uses SHA-256
here so the same input always produces the same analysis on any machine.
"""

from __future__ import annotations

import hashlib


def stable_uint32(*parts: object, version: str = "uriel_v1") -> int:
    """
    Deterministic unsigned 32-bit integer for seeding ``Random``.

    ``parts`` are joined with a delimiter and hashed; changing ``version`` intentionally
    rotates all downstream picks if the generation scheme needs a breaking change.
    """
    payload = version + "\x1e" + "\x1f".join(str(p) for p in parts)
    digest = hashlib.sha256(payload.encode("utf-8")).digest()
    return int.from_bytes(digest[:4], "big") & 0xFFFFFFFF
