"""Bake the themed button backgrounds: a soft rounded glass, dusky colour and a
scene in the colours of what the button does, with its symbol on the right,
kept low in contrast behind the words. Writes assets/ui/buttons/<name>.png."""

import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

OUT = Path(__file__).resolve().parents[2] / "assets" / "ui" / "buttons"
W, H, SS = 420, 120, 3


def gradient(top, low):
    img = Image.new("RGBA", (W * SS, H * SS))
    px = img.load()
    for y in range(H * SS):
        t = y / (H * SS)
        for x in range(W * SS):
            u = t * 0.8 + x / (W * SS) * 0.2
            px[x, y] = tuple(int(top[i] + (low[i] - top[i]) * u) for i in range(3)) + (236,)
    return img


def poly_star(cx, cy, r, n=5, inner=0.45, rot=-90):
    return [(cx + math.cos(math.radians(rot + i * 180 / n)) * (r if i % 2 == 0 else r * inner),
             cy + math.sin(math.radians(rot + i * 180 / n)) * (r if i % 2 == 0 else r * inner)) for i in range(n * 2)]


def drop(d, x, y, r, c):
    d.polygon([(x, y - r * 1.7), (x - r * 0.8, y), (x + r * 0.8, y)], fill=c)
    d.ellipse([x - r, y - r * 0.6, x + r, y + r], fill=c)


def scene(name, d, sym):
    a = (255, 255, 255, 22)
    s = SS
    cx, cy = (W - 58) * s, H / 2 * s
    white = (255, 250, 225, 210)
    rng = random.Random(name)
    if name in ("rain", "river"):
        for _ in range(26):
            drop(d, rng.randint(0, W) * s, rng.randint(0, H) * s, 5 * s, a)
        drop(sym, cx, cy + 8 * s, 22 * s, white)
    elif name == "sun":
        for k in range(5):
            d.arc([-60 * s, (H - 30 - k * 22) * s, (W + 60) * s, (H + 90 - k * 22) * s], 180, 360, fill=a, width=6 * s)
        sym.ellipse([cx - 19 * s, cy - 19 * s, cx + 19 * s, cy + 19 * s], fill=white)
        for k in range(10):
            t = k * math.pi / 5
            sym.line([cx + math.cos(t) * 25 * s, cy + math.sin(t) * 25 * s, cx + math.cos(t) * 36 * s, cy + math.sin(t) * 36 * s], fill=white, width=4 * s)
    elif name == "power":
        for _ in range(16):
            x, y = rng.randint(0, W) * s, rng.randint(0, H) * s
            d.line([x, y, x - 34 * s, y + 20 * s], fill=a, width=3 * s)
        sym.polygon(poly_star(cx, cy, 36 * s), fill=white)
    elif name == "info":
        for i in range(0, W, 46):
            for j in range(0, H, 46):
                d.ellipse([(i + 12) * s, (j + 12) * s, (i + 20) * s, (j + 20) * s], fill=a)
                d.line([(i + 16) * s, (j + 16) * s, (i + 62) * s, (j + 62 - (i % 3) * 23) * s], fill=(255, 255, 255, 18), width=2 * s)
        sym.polygon([(cx - 34 * s, cy - 24 * s), (cx, cy - 16 * s), (cx + 34 * s, cy - 24 * s), (cx + 34 * s, cy + 24 * s), (cx, cy + 32 * s), (cx - 34 * s, cy + 24 * s)], fill=white)
        sym.line([cx, cy - 16 * s, cx, cy + 32 * s], fill=(70, 60, 130, 255), width=3 * s)
    elif name == "time":
        for r in (40, 90, 150, 220):
            d.ellipse([W * 0.4 * s - r * s, cy - r * s, W * 0.4 * s + r * s, cy + r * s], outline=a, width=4 * s)
        sym.ellipse([cx - 32 * s, cy - 32 * s, cx + 32 * s, cy + 32 * s], outline=white, width=6 * s)
        sym.line([cx, cy, cx, cy - 22 * s], fill=white, width=5 * s)
        sym.line([cx, cy, cx + 16 * s, cy + 8 * s], fill=white, width=5 * s)
    elif name == "exit":
        for k in range(6):
            d.line([k * 90 * s, H * s, (k * 90 + 70) * s, 0], fill=a, width=10 * s)
        sym.line([cx - 22 * s, cy - 22 * s, cx + 22 * s, cy + 22 * s], fill=white, width=9 * s)
        sym.line([cx + 22 * s, cy - 22 * s, cx - 22 * s, cy + 22 * s], fill=white, width=9 * s)
    elif name == "settings":
        sym.ellipse([cx - 22 * s, cy - 22 * s, cx + 22 * s, cy + 22 * s], outline=white, width=8 * s)
        for k in range(8):
            t = k * math.pi / 4
            sym.line([cx + math.cos(t) * 24 * s, cy + math.sin(t) * 24 * s, cx + math.cos(t) * 34 * s, cy + math.sin(t) * 34 * s], fill=white, width=8 * s)
        for i in range(0, W, 70):
            d.line([i * s, 0, i * s, H * s], fill=(255, 255, 255, 16), width=2 * s)
    else:
        for _ in range(26):
            x, y = rng.randint(0, W) * s, rng.randint(0, H) * s
            d.ellipse([x - 16 * s, y - 6 * s, x + 16 * s, y + 6 * s], fill=a)
        sym.ellipse([cx - 34 * s, cy - 16 * s, cx + 34 * s, cy + 16 * s], fill=white)
        sym.line([cx - 40 * s, cy, cx + 34 * s, cy], fill=(40, 100, 60, 255), width=3 * s)


# Dusky, milky forest colours: enchanted cottage at twilight.
THEMES = {
    "life": ((86, 128, 96), (42, 72, 66)),
    "rain": ((104, 144, 176), (54, 78, 120)),
    "sun": ((196, 150, 104), (130, 84, 88)),
    "power": ((176, 128, 168), (92, 68, 128)),
    "info": ((132, 120, 176), (66, 62, 112)),
    "time": ((98, 142, 140), (50, 80, 96)),
    "settings": ((132, 136, 120), (74, 82, 78)),
    "exit": ((170, 104, 110), (96, 56, 76)),
}
GILT = (246, 226, 170, 235)


def blossom(d, x, y, r):
    for k in range(5):
        t = k * math.tau / 5 - math.pi / 2
        px, py = x + math.cos(t) * r, y + math.sin(t) * r
        d.ellipse([px - r * 0.62, py - r * 0.62, px + r * 0.62, py + r * 0.62], fill=(255, 240, 236, 225))
    d.ellipse([x - r * 0.45, y - r * 0.45, x + r * 0.45, y + r * 0.45], fill=(244, 206, 110, 255))


def sprig(d, x, y, sx, sy):
    s = SS
    d.arc([x - 0 * s, y - 0 * s, x + sx * 70 * s if sx > 0 else x + 1, y + 1], 0, 1, fill=GILT)
    pts = [(x + sx * i * s, y + sy * (10 - 10 * math.cos(i / 16)) * s) for i in range(0, 64, 4)]
    d.line(pts, fill=GILT, width=int(1.4 * s))
    for i, (px, py) in enumerate(pts[2::2]):
        side = 1 if i % 2 == 0 else -1
        d.ellipse([px - 3 * s, py + side * 5 * s - 2 * s, px + 3 * s, py + side * 5 * s + 2 * s], fill=(214, 232, 170, 215))


def bake(name, top, low):
    img = gradient(top, low)
    # A milky wash and firefly bokeh, far softer than the scene beneath.
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    sym = Image.new("RGBA", img.size, (0, 0, 0, 0))
    scene(name, ImageDraw.Draw(layer), ImageDraw.Draw(sym))
    img.alpha_composite(layer.filter(ImageFilter.GaussianBlur(2 * SS)))
    glow = Image.new("RGBA", img.size, (0, 0, 0, 0))
    g = ImageDraw.Draw(glow)
    rng = random.Random(name + "fly")
    g.ellipse([W * 0.15 * SS, -50 * SS, W * 0.85 * SS, 60 * SS], fill=(255, 250, 225, 74))
    for _ in range(16):
        x, y, r = rng.randint(0, W) * SS, rng.randint(0, H) * SS, rng.randint(3, 8) * SS
        g.ellipse([x - r, y - r, x + r, y + r], fill=(255, 240, 170, 120))
    img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(5 * SS)))
    deco = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(deco)
    i1, i2 = 7 * SS, 12 * SS
    w, h, r = W * SS - 1, H * SS - 1, 30 * SS
    d.rounded_rectangle([i1, i1, w - i1, h - i1], r - i1, outline=GILT, width=int(1.6 * SS))
    d.rounded_rectangle([i2, i2, w - i2, h - i2], r - i2, outline=(246, 226, 170, 80), width=SS)
    sprig(d, 28 * SS, 24 * SS, 1, 1)
    sprig(d, 28 * SS, (H - 24) * SS, 1, -1)
    blossom(d, 26 * SS, 26 * SS, 7 * SS)
    blossom(d, 26 * SS, (H - 26) * SS, 6 * SS)
    img.alpha_composite(deco)
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, w, h], r, fill=232)
    img.putalpha(mask)
    img.resize((W // 2, H // 2), Image.LANCZOS).save(OUT / f"{name}.png")


OUT.mkdir(parents=True, exist_ok=True)
for key, (t, l) in THEMES.items():
    bake(key, t, l)
