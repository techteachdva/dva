"""Bake the button icons: soft gold-cream silhouettes with a glow, kept
separate from the backgrounds so they never stretch. assets/ui/buttons/icons/."""

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

OUT = Path(__file__).resolve().parents[2] / "assets" / "ui" / "buttons" / "icons"
S = 256
C = (255, 244, 205, 255)
K = (0, 0, 0, 0)


def star(n, r, q, rot=-90, cx=128, cy=128):
    return [(cx + math.cos(math.radians(rot + i * 180 / n)) * (r if i % 2 == 0 else r * q),
             cy + math.sin(math.radians(rot + i * 180 / n)) * (r if i % 2 == 0 else r * q)) for i in range(2 * n)]


def drop(d):
    d.polygon([(128, 24), (64, 140), (192, 140)], fill=C)
    d.ellipse([60, 92, 196, 228], fill=C)


def wave(d):
    for y in (80, 130, 180):
        d.line([(24 + i * 4, y + math.sin(i / 7) * 16) for i in range(53)], fill=C, width=20)


def sun(d):
    d.ellipse([80, 80, 176, 176], fill=C)
    for k in range(12):
        t = k * math.pi / 6
        d.line([128 + math.cos(t) * 66, 128 + math.sin(t) * 66, 128 + math.cos(t) * 104, 128 + math.sin(t) * 104], fill=C, width=14)


def meteor(d):
    d.ellipse([130, 130, 216, 216], fill=C)
    for o in (-22, 0, 22):
        d.line([174 + o, 172 - o, 54 + o, 52 - o], fill=C, width=14)


def flame(d):
    d.polygon([(128, 20), (190, 120), (178, 200), (128, 236), (78, 200), (66, 130), (100, 150)], fill=C)
    d.polygon([(128, 130), (156, 182), (128, 214), (100, 182)], fill=K)


def moon(d):
    d.ellipse([40, 40, 216, 216], fill=C)
    d.ellipse([86, 24, 240, 178], fill=K)


def eye(d):
    d.ellipse([20, 66, 236, 190], fill=C)
    d.ellipse([84, 84, 172, 172], fill=K)
    d.ellipse([108, 108, 148, 148], fill=C)


def book(d):
    d.polygon([(24, 60), (124, 80), (124, 216), (24, 196)], fill=C)
    d.polygon([(132, 80), (232, 60), (232, 196), (132, 216)], fill=C)


def web(d):
    for k in range(8):
        t = k * math.pi / 4
        d.line([128, 128, 128 + math.cos(t) * 108, 128 + math.sin(t) * 108], fill=C, width=8)
    for r in (40, 74, 108):
        d.polygon([(128 + math.cos(k * math.pi / 4) * r, 128 + math.sin(k * math.pi / 4) * r) for k in range(8)], outline=C, width=8)


def bars(d):
    for x, h in ((36, 80), (102, 150), (168, 196)):
        d.rounded_rectangle([x, 224 - h, x + 52, 224], 10, fill=C)


def target(d):
    for r, f in ((104, C), (72, K), (40, C)):
        d.ellipse([128 - r, 128 - r, 128 + r, 128 + r], fill=f)


def scroll(d):
    d.rounded_rectangle([56, 40, 200, 216], 22, fill=C)
    for y in (84, 124, 164):
        d.line([84, y, 172, y], fill=K, width=12)


def crown(d):
    d.polygon([(28, 200), (28, 80), (84, 130), (128, 56), (172, 130), (228, 80), (228, 200)], fill=C)


def flag(d):
    d.line([64, 28, 64, 232], fill=C, width=18)
    d.polygon([(70, 36), (216, 80), (70, 136)], fill=C)


def paw(d):
    d.ellipse([72, 116, 184, 216], fill=C)
    for x, y in ((48, 92), (98, 52), (158, 52), (208, 92)):
        d.ellipse([x - 26, y - 32, x + 26, y + 32], fill=C)


def clock(d):
    d.ellipse([28, 28, 228, 228], outline=C, width=22)
    d.line([128, 128, 128, 66], fill=C, width=16)
    d.line([128, 128, 172, 150], fill=C, width=16)


def gear(d):
    d.polygon(star(8, 112, 0.74), fill=C)
    d.ellipse([92, 92, 164, 164], fill=K)


def back(d):
    d.polygon([(40, 128), (130, 44), (130, 96), (216, 96), (216, 160), (130, 160), (130, 212)], fill=C)


def cross(d):
    d.line([56, 56, 200, 200], fill=C, width=38)
    d.line([200, 56, 56, 200], fill=C, width=38)


def play(d):
    d.polygon([(68, 36), (216, 128), (68, 220)], fill=C)


def flower(d):
    for k in range(6):
        t = k * math.pi / 3
        x, y = 128 + math.cos(t) * 64, 128 + math.sin(t) * 64
        d.ellipse([x - 44, y - 44, x + 44, y + 44], fill=C)
    d.ellipse([100, 100, 156, 156], fill=K)


def tree(d):
    d.rectangle([112, 150, 144, 236], fill=C)
    for y, w in ((30, 70), (80, 92), (130, 110)):
        d.polygon([(128, y - 12), (128 - w, y + 88), (128 + w, y + 88)], fill=C)


def sprout(d):
    d.line([128, 232, 128, 120], fill=C, width=16)
    d.ellipse([34, 56, 128, 136], fill=C)
    d.ellipse([128, 84, 222, 160], fill=C)


def hand(d):
    d.rounded_rectangle([72, 112, 192, 232], 40, fill=C)
    for i, x in enumerate((76, 110, 144, 178)):
        d.rounded_rectangle([x - 2, 40 + abs(i - 1.5) * 18, x + 22, 150], 12, fill=C)


def bolt(d):
    d.polygon([(150, 16), (56, 146), (118, 146), (92, 240), (204, 96), (138, 96)], fill=C)


def coin(d):
    d.ellipse([28, 28, 228, 228], fill=C)
    d.polygon(star(5, 66, 0.45), fill=K)


def sword(d):
    d.polygon([(216, 28), (232, 44), (92, 184), (72, 164)], fill=C)
    d.line([52, 136, 120, 204], fill=C, width=18)
    d.line([78, 178, 34, 222], fill=C, width=20)


def dice(d):
    d.rounded_rectangle([40, 40, 216, 216], 34, fill=C)
    for x, y in ((88, 88), (168, 88), (128, 128), (88, 168), (168, 168)):
        d.ellipse([x - 16, y - 16, x + 16, y + 16], fill=K)


ALL = [drop, wave, sun, meteor, flame, moon, eye, book, web, bars, target, scroll, crown, flag, paw,
       clock, gear, back, cross, play, flower, tree, sprout, hand, bolt, coin, sword, dice]
OUT.mkdir(parents=True, exist_ok=True)
for fn in ALL:
    img = Image.new("RGBA", (S, S), K)
    fn(ImageDraw.Draw(img))
    glow = Image.new("RGBA", (S, S), (255, 214, 130, 0))
    glow.putalpha(img.getchannel("A").filter(ImageFilter.GaussianBlur(10)).point(lambda v: int(v * 0.7)))
    glow.alpha_composite(img)
    pad = Image.new("RGBA", (S + 40, S + 40), K)
    pad.paste(glow, (20, 20))
    pad.resize((72, 72), Image.LANCZOS).save(OUT / f"{fn.__name__}.png")
