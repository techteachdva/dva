#!/usr/bin/env python3
"""Convert landscape PNG assets to .webp for Somnia."""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_SRC = Path.home() / "Desktop/SOMNIA BACKUP/somnia/images/landscapes"
DEST = ROOT / "src/site/somnia/images/landscapes"


def convert(src_dir: Path = DEFAULT_SRC) -> int:
    dest_dir = DEST
    dest_dir.mkdir(parents=True, exist_ok=True)
    count = 0
    for src in sorted(src_dir.glob("*.png")):
        dest = dest_dir / f"{src.stem}.webp"
        img = Image.open(src)
        if img.mode not in ("RGB", "RGBA"):
            img = img.convert("RGBA" if "A" in img.getbands() else "RGB")
        img.save(dest, "WEBP", quality=85, method=6)
        count += 1
        print(f"{src.name} -> {dest.name}")
    print(f"Converted {count} landscapes")
    return count


if __name__ == "__main__":
    convert()
