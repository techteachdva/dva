"""Redraw every baked creature sheet as real 32x32 pixel art.

The valley sheets stay where they are. This writes assets/sprites/pixel/
with the same atlas layout, each art pixel 4 sheet pixels wide:

  1. Solid or empty is decided per block, so thin legs survive.
  2. Ink is kept out of the colour pick, so bodies stay bright.
  3. One palette per species (from its whole sheet), so nothing flickers.
  4. Stray single pixels go, and a fresh 1px outline wraps the silhouette.
"""

import time
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2] / "assets" / "sprites"
OUT = ROOT / "pixel"
SPECIES = [
    "sheep", "wolf", "boar", "falcon", "robin", "worm", "human", "rabbit",
    "fish", "mushroom", "deer", "goat", "bear", "lion", "beetle", "mouse",
    "fairy", "sunfolk", "scarecrow", "snowman",
]
BLOCK = 4
COLOURS = 24
OUTLINE = np.array([34, 26, 32], dtype=np.uint8)
SOLID = 0.34
INK = 70


def cells(name: str) -> tuple[int, int]:
    return (25, 8) if name.endswith("_anim") else (4, 2)


def blocks(cell: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray, int]:
    """Colour and solid mask for one cell, a pixel per block."""
    h, w = cell.shape[0] // BLOCK, cell.shape[1] // BLOCK
    tiles = cell[: h * BLOCK, : w * BLOCK].reshape(h, BLOCK, w, BLOCK, 4).transpose(0, 2, 1, 3, 4).astype(float)
    alpha = tiles[..., 3] / 255.0
    bright = tiles[..., :3].max(axis=-1)
    # Dark-furred creatures need a lower bar, or their whole body counts as ink.
    body = bright[alpha > 0.5]
    level = 24 if body.size and np.median(body) < INK * 1.3 else INK
    weight = alpha * (bright > level)
    # Bright paint wins a block; a block of only ink stays ink.
    use = np.where(weight.sum((2, 3), keepdims=True) > 1.5, weight, alpha) + 1e-6
    rgb = (tiles[..., :3] * use[..., None]).sum((2, 3)) / use.sum((2, 3))[..., None]
    ink = (alpha * (bright <= level)).sum((2, 3)) / np.maximum(alpha.sum((2, 3)), 1e-6)
    return rgb, alpha.mean((2, 3)) >= SOLID, ink, level


def neighbours(mask: np.ndarray) -> np.ndarray:
    p = np.pad(mask, 1).astype(int)
    return p[:-2, 1:-1] + p[2:, 1:-1] + p[1:-1, :-2] + p[1:-1, 2:]


def build_palette(img: Image.Image) -> Image.Image:
    arr = np.array(img)
    keep = arr[..., 3] > 200
    keep &= arr[..., :3].max(axis=-1) > 24
    pts = arr[keep][:, :3]
    if pts.size == 0:
        pts = np.array([[128, 128, 128]], dtype=np.uint8)
    pts = pts[:: max(1, len(pts) // 250000)]
    sample = Image.fromarray(pts.reshape(-1, 1, 3).astype(np.uint8), "RGB")
    return sample.quantize(COLOURS - 1, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)


def draw_cell(cell: np.ndarray, palette: Image.Image) -> np.ndarray:
    rgb, solid, ink, level = blocks(cell)
    # Orphan pixels read as dirt on the sprite.
    solid &= neighbours(solid) > 0
    tile = Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8), "RGB")
    flat = np.array(tile.quantize(palette=palette, dither=Image.Dither.NONE).convert("RGB"))
    out = np.zeros((*solid.shape, 4), dtype=np.uint8)
    out[solid, :3] = flat[solid]
    out[solid, 3] = 255
    # Eyes and jaw lines are smaller than a block; keep them inside the body.
    dark = (rgb.max(axis=-1) <= level + 15) | ((ink > 0.2) & (neighbours(solid) == 4))
    out[solid & dark, :3] = OUTLINE
    edge = neighbours(solid) > 0
    ring = edge & ~solid
    ring[0, :] = ring[-1, :] = False
    ring[:, 0] = ring[:, -1] = False
    out[ring, :3] = OUTLINE
    out[ring, 3] = 255
    return out.repeat(BLOCK, 0).repeat(BLOCK, 1)


def convert(src: Path, palette: Image.Image) -> None:
    img = np.array(Image.open(src).convert("RGBA"))
    cols, rows = cells(src.stem)
    ch, cw = img.shape[0] // rows, img.shape[1] // cols
    out = np.zeros_like(img)
    for row in range(rows):
        for col in range(cols):
            y, x = row * ch, col * cw
            out[y : y + ch, x : x + cw] = draw_cell(img[y : y + ch, x : x + cw], palette)
    # A scanner or the editor can briefly hold the file on Windows.
    for attempt in range(8):
        try:
            Image.fromarray(out, "RGBA").save(OUT / src.name, optimize=True)
            break
        except OSError:
            if attempt == 7:
                raise
            time.sleep(1.0)
    print(f"  {src.name}  cells {cw}x{ch}")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for species in SPECIES:
        palette = build_palette(Image.open(ROOT / f"{species}.png").convert("RGBA"))
        for suffix in ("", "_anim"):
            convert(ROOT / f"{species}{suffix}.png", palette)


if __name__ == "__main__":
    main()
