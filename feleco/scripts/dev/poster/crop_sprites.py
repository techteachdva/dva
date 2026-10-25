"""Crop one portrait per species (normal kind, male) from the baked atlases."""
import pathlib
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parents[3]
OUT = pathlib.Path(__file__).with_name("img")
OUT.mkdir(exist_ok=True)
# Cell picks: (col, row). Humans also get builder and wizard; mushroom the toadstool.
PICKS = {
    "sheep": [(0, 0)], "wolf": [(0, 0)], "human": [(0, 0), (1, 0), (2, 1)], "falcon": [(0, 0)],
    "robin": [(0, 0)], "boar": [(0, 0)], "rabbit": [(0, 0)], "worm": [(0, 0)], "fish": [(0, 0)],
    "mushroom": [(1, 0), (2, 0)],
}
for sp, cells in PICKS.items():
    atlas = Image.open(ROOT / "assets" / "sprites" / f"{sp}.png").convert("RGBA")
    cw, ch = atlas.width // 3, atlas.height // 2
    for i, (c, r) in enumerate(cells):
        cell = atlas.crop((c * cw, r * ch, (c + 1) * cw, (r + 1) * ch))
        box = cell.getbbox()
        if box:
            cell = cell.crop(box)
        name = sp if i == 0 else f"{sp}_{i}"
        cell.save(OUT / f"{name}.png")
        print(name, cell.size)
    # Female of the normal kind sits in the bottom row.
    if sp != "mushroom":
        fem = atlas.crop((0, ch, cw, 2 * ch))
        box = fem.getbbox()
        (fem.crop(box) if box else fem).save(OUT / f"{sp}_f.png")
for extra in ["tuft", "mycelium"]:
    Image.open(ROOT / "assets" / "sprites" / f"{extra}.png").save(OUT / f"{extra}.png")
