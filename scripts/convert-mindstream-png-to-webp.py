#!/usr/bin/env python3
"""Convert mindstream-*.png assets to .webp in the repo."""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ASSETS = Path.home() / ".cursor/projects/c-Users-phili-Desktop-coding-projects-dva/assets"
SOMNIA = ROOT / "src/site/somnia/images/cards/mindstream"

count = 0
for src in sorted(ASSETS.glob("mindstream-*.png")):
    parts = src.stem.split("-", 2)
    if len(parts) < 3:
        continue
    suit = parts[1]
    eid = parts[2]
    dest = SOMNIA / suit / f"{eid}.webp"
    dest.parent.mkdir(parents=True, exist_ok=True)
    img = Image.open(src)
    if img.mode not in ("RGB", "RGBA"):
        img = img.convert("RGB")
    img.save(dest, "WEBP", quality=85)
    count += 1
    print(dest.relative_to(ROOT))

print(f"Converted {count} images to webp")
