"""Landscape promo for Feleco 4.2, pictures first.

Every picture is a real frame: live valley shots from the screenshot harness,
the four mode screens, and the game's own season renders. No generated scenes.
"""

from PIL import Image, ImageDraw, ImageFont

ROOT = r"D:\coding-projects\dva\feleco"
STILLS = ROOT + r"\docs\promo_stills"
OUT = ROOT + r"\docs\feleco_promo_poster.png"

W, H = 3840, 2160
INK = (20, 26, 22)
CREAM = (244, 239, 228)
MIST = (187, 200, 185)
GOLD = (230, 195, 106)

FRED = ROOT + r"\assets\fonts\Fredoka.ttf"
NUNI = ROOT + r"\assets\fonts\Nunito.ttf"

SEASONS = [
    ("Spring", ROOT + r"\assets\ui\menu_spring.jpg", (118, 176, 96)),
    ("Summer", ROOT + r"\assets\ui\menu_summer.jpg", (214, 164, 64)),
    ("Autumn", ROOT + r"\assets\ui\menu_autumn.jpg", (196, 106, 52)),
    ("Winter", ROOT + r"\assets\ui\menu_winter.jpg", (126, 176, 210)),
]


def face(path: str, size: int, style: str) -> ImageFont.FreeTypeFont:
    font = ImageFont.truetype(path, size)
    font.set_variation_by_name(style)
    return font


def cover(im: Image.Image, w: int, h: int, bias: float = 0.5) -> Image.Image:
    im = im.convert("RGB")
    scale = max(w / im.width, h / im.height)
    nw, nh = round(im.width * scale), round(im.height * scale)
    im = im.resize((nw, nh), Image.Resampling.LANCZOS)
    left = (nw - w) // 2
    top = int((nh - h) * bias)
    top = max(0, min(top, nh - h))
    return im.crop((left, top, left + w, top + h))


def fit(im: Image.Image, w: int, h: int) -> Image.Image:
    """Whole frame, letterboxed. UI shots must stay complete."""
    im = im.convert("RGB")
    scale = min(w / im.width, h / im.height)
    nw, nh = max(1, round(im.width * scale)), max(1, round(im.height * scale))
    im = im.resize((nw, nh), Image.Resampling.LANCZOS)
    plate = Image.new("RGB", (w, h), (16, 22, 18))
    plate.paste(im, ((w - nw) // 2, (h - nh) // 2))
    return plate


def rounded(im: Image.Image, radius: int) -> Image.Image:
    im = im.convert("RGBA")
    mask = Image.new("L", im.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, im.width - 1, im.height - 1), radius, fill=255)
    im.putalpha(mask)
    return im


def load_box(path: str, box: tuple[int, int, int, int]) -> Image.Image:
    return Image.open(path).convert("RGB").crop(box)


def paste_rounded(canvas: Image.Image, im: Image.Image, xy: tuple[int, int], radius: int = 22) -> None:
    frame = rounded(im, radius)
    canvas.paste(frame, xy, frame)


def kicker(draw: ImageDraw.ImageDraw, xy: tuple[int, int], text: str, font) -> None:
    draw.text(xy, text, font=font, fill=GOLD)


def main() -> None:
    canvas = Image.new("RGB", (W, H), INK)
    draw = ImageDraw.Draw(canvas)
    title = face(FRED, 84, "Bold")
    deck = face(NUNI, 30, "SemiBold")
    kick = face(FRED, 26, "SemiBold")
    cap = face(NUNI, 24, "Bold")

    draw.text((64, 28), "FELECO", font=title, fill=GOLD)
    tag = "A pocket valley. One champion."
    draw.text((W - 64 - draw.textlength(tag, font=deck), 52), tag, font=deck, fill=CREAM)
    draw.text((68, 124), "Watch a living valley. Raise one creature. Bet on who rules the year.", font=deck, fill=MIST)
    draw.line((64, 176, W - 64, 176), fill=GOLD, width=3)

    meadow = load_box(STILLS + r"\close_1.png", (520, 250, 1560, 880))
    census = load_box(STILLS + r"\world_2.png", (28, 18, 455, 790))
    card = load_box(STILLS + r"\card_late.png", (990, 310, 1690, 900))
    champ = load_box(STILLS + r"\world_2.png", (1224, 18, 1688, 214))

    # Left: the live valley. Right: the rules as the screens that teach them.
    hero = cover(meadow, 2140, 1368, bias=0.35)
    paste_rounded(canvas, hero, (64, 204), 28)

    rx, ry, rw = 2244, 204, 1532
    gap = 16
    top_h = 640
    bet_h = 250
    ways_h = 1368 - top_h - bet_h - gap * 2

    kicker(draw, (rx, ry), "WHAT IT IS", kick)
    kicker(draw, (rx + 520, ry), "RAISE ONE", kick)
    census_im = fit(census, 492, top_h - 44)
    card_im = fit(card, rw - 492 - gap, top_h - 44)
    paste_rounded(canvas, census_im, (rx, ry + 40))
    paste_rounded(canvas, card_im, (rx + 492 + gap, ry + 40))

    by = ry + top_h + gap
    kicker(draw, (rx, by), "THE BET", kick)
    champ_im = fit(champ, rw, bet_h - 44)
    paste_rounded(canvas, champ_im, (rx, by + 40))

    wy = by + bet_h + gap
    kicker(draw, (rx, wy), "FOUR WAYS IN", kick)
    doors = [
        ("Enter the Valley", STILLS + r"\menu.png"),
        ("Campaign", STILLS + r"\campaign.png"),
        ("Challenge", STILLS + r"\challenge.png"),
        ("Greenhouse", STILLS + r"\shop.png"),
    ]
    door_w = (rw - gap * 3) // 4
    door_h = ways_h - 44
    for i, (name, path) in enumerate(doors):
        dx = rx + i * (door_w + gap)
        shot = fit(Image.open(path), door_w, door_h - 42)
        paste_rounded(canvas, shot, (dx, wy + 40), 18)
        draw = ImageDraw.Draw(canvas)
        tw = draw.textlength(name, font=cap)
        draw.text((dx + (door_w - tw) / 2, wy + door_h - 2), name, font=cap, fill=CREAM)

    strip_y = 1616
    strip_h = 488
    draw = ImageDraw.Draw(canvas)
    draw.text((64, strip_y - 34), "THE YEAR, FROM THE GAME", font=face(NUNI, 20, "Bold"), fill=GOLD)
    gap_s = 24
    shot_w = (W - 128 - gap_s * 3) // 4
    for i, (name, path, color) in enumerate(SEASONS):
        sx = 64 + i * (shot_w + gap_s)
        shot = cover(Image.open(path), shot_w, strip_h, bias=0.45)
        band = Image.new("RGB", (shot_w, 10), color)
        shot.paste(band, (0, 0))
        paste_rounded(canvas, shot, (sx, strip_y), 22)
        draw = ImageDraw.Draw(canvas)
        tw = draw.textlength(name, font=deck)
        pill = (sx + 18, strip_y + strip_h - 58, sx + 18 + tw + 32, strip_y + strip_h - 16)
        draw.rounded_rectangle(pill, 14, fill=(16, 20, 18))
        draw.text((sx + 34, strip_y + strip_h - 52), name, font=face(NUNI, 24, "SemiBold"), fill=CREAM)

    canvas.save(OUT, "PNG", optimize=True)
    print("wrote", OUT)


if __name__ == "__main__":
    main()
