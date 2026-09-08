#!/usr/bin/env python3
"""Audit Somnia landscape tile art for size, framing, and hex alignment."""
from __future__ import annotations

import json
import os
from collections import Counter
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
LANDSCAPES = ROOT / "src/site/somnia/images/landscapes"


def analyze(path: Path) -> dict:
    im = Image.open(path).convert("RGBA")
    w, h = im.size
    alpha = im.split()[-1]
    bbox = alpha.getbbox() or (0, 0, w, h)
    x0, y0, x1, y1 = bbox
    bw, bh = x1 - x0, y1 - y0

    # center of opaque mass
    cx = (x0 + x1) / 2
    cy = (y0 + y1) / 2
    dx = abs(cx - w / 2) / w
    dy = abs(cy - h / 2) / h

    # corner transparency (frame usually opaque in norm tiles)
    corners = [
        alpha.getpixel((4, 4)),
        alpha.getpixel((w - 5, 4)),
        alpha.getpixel((4, h - 5)),
        alpha.getpixel((w - 5, h - 5)),
    ]
    corner_opaque = sum(1 for a in corners if a > 200)

    opaque = sum(1 for a in alpha.getdata() if a > 16)

    return {
        "file": path.name,
        "size": [w, h],
        "ratio": round(w / h, 4) if h else 0,
        "content_bbox": [x0, y0, x1, y1],
        "content_size": [bw, bh],
        "content_fill": round(bw * bh / (w * h), 4),
        "center_offset": [round(dx, 4), round(dy, 4)],
        "corner_opaque": corner_opaque,
        "opaque_pct": round(100 * opaque / (w * h), 2),
    }


def main() -> None:
    rows = [analyze(p) for p in sorted(LANDSCAPES.glob("*.png"))]
    sizes = Counter(tuple(r["size"]) for r in rows)
    fills = [r["content_fill"] for r in rows]
    median_fill = sorted(fills)[len(fills) // 2]

    mode_size = sizes.most_common(1)[0][0] if sizes else None

    for r in rows:
        flags = []
        if tuple(r["size"]) != mode_size:
            flags.append("size")
        if abs(r["content_fill"] - median_fill) > 0.08:
            flags.append("fill")
        if r["center_offset"][0] > 0.04 or r["center_offset"][1] > 0.04:
            flags.append("off-center")
        if r["corner_opaque"] < 3:
            flags.append("transparent-corners")
        r["flags"] = flags

    print("MODE SIZE:", mode_size)
    print("SIZE DISTRIBUTION:", dict(sizes))
    print("MEDIAN CONTENT FILL:", median_fill)
    print()
    for r in rows:
        flag = ",".join(r["flags"]) or "ok"
        print(
            f"{r['file']:28} {r['size']} fill={r['content_fill']:.3f} "
            f"off={r['center_offset']} corners={r['corner_opaque']}/4  [{flag}]"
        )

    out = ROOT / "scripts/landscape-art-audit.json"
    out.write_text(json.dumps({"mode_size": mode_size, "median_fill": median_fill, "tiles": rows}, indent=2))
    print(f"\nWrote {out}")


if __name__ == "__main__":
    main()
