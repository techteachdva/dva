"""Cut every baked creature sheet into big pixels, frame by frame.

The valley sheets stay where they are. This writes assets/sprites/pixel/
with the same atlas layout: 25 frames by 8 cells for *_anim.png, and
4 kinds by 2 sexes for the rest pose. Each cell is pixelated on its own
so a walk frame never bleeds into the next one.
"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2] / "assets" / "sprites"
OUT = ROOT / "pixel"
SPECIES = [
    "sheep", "wolf", "boar", "falcon", "robin", "worm", "human", "rabbit",
    "fish", "mushroom", "deer", "goat", "bear", "lion", "beetle", "mouse",
]
# Source pixels per painted block. 128px cells become 16 blocks tall.
BLOCK = 8


def cells(name: str) -> tuple[int, int]:
    return (25, 8) if name.endswith("_anim") else (4, 2)


def chunk(cell: Image.Image) -> Image.Image:
    w, h = cell.size
    sw, sh = max(1, w // BLOCK), max(1, h // BLOCK)
    small = cell.resize((sw, sh), Image.Resampling.BOX)
    px = small.load()
    for y in range(sh):
        for x in range(sw):
            r, g, b, a = px[x, y]
            if a < 96:
                px[x, y] = (0, 0, 0, 0)
            else:
                px[x, y] = ((r // 24) * 24, (g // 24) * 24, (b // 24) * 24, 255)
    return small.resize((w, h), Image.Resampling.NEAREST)


def convert(src: Path) -> None:
    img = Image.open(src).convert("RGBA")
    cols, rows = cells(src.stem)
    cw, ch = img.size[0] // cols, img.size[1] // rows
    out = Image.new("RGBA", img.size, (0, 0, 0, 0))
    for row in range(rows):
        for col in range(cols):
            box = (col * cw, row * ch, (col + 1) * cw, (row + 1) * ch)
            out.paste(chunk(img.crop(box)), box[:2])
    dest = OUT / src.name
    out.save(dest, optimize=True)
    print(f"  {src.name}  {img.size[0]}x{img.size[1]}  cells {cw}x{ch}")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for species in SPECIES:
        for suffix in ("", "_anim"):
            src = ROOT / f"{species}{suffix}.png"
            if not src.exists():
                raise SystemExit(f"missing {src}")
            convert(src)


if __name__ == "__main__":
    main()
