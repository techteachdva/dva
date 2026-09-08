#!/usr/bin/env python3
"""Normalize Somnia landscape tiles to a shared point-up hex frame with suit-colored borders."""
from __future__ import annotations

import argparse
import json
import math
import shutil
from pathlib import Path

from PIL import Image, ImageDraw, ImageOps

ROOT = Path(__file__).resolve().parents[1]
LANDSCAPES = ROOT / "src/site/somnia/images/landscapes"
LANDSCAPES_JSON = ROOT / "src/site/somnia/data/landscapes.json"
TEMPLATE = LANDSCAPES / "house.png"
BACKUP_DIR = ROOT / "scripts/landscape-art-backup"
AUDIT_PATH = ROOT / "scripts/landscape-art-audit.json"
FRAME_OVERLAY_DIR = ROOT / "scripts/landscape-frame-overlays"
SKIP_FILES = {"wasteland.png"}

SUIT_FRAME_COLORS: dict[str | None, dict[str, tuple[int, int, int]]] = {
    "lucidity": {
        "dark": (16, 44, 104),
        "mid": (74, 158, 255),
        "light": (176, 214, 255),
    },
    "elasticity": {
        "dark": (88, 64, 8),
        "mid": (240, 200, 48),
        "light": (255, 236, 168),
    },
    "willpower": {
        "dark": (96, 20, 24),
        "mid": (232, 72, 72),
        "light": (255, 176, 176),
    },
    None: {
        "dark": (40, 32, 16),
        "mid": (200, 160, 80),
        "light": (240, 201, 106),
    },
}


def point_up_hex_polygon(size: int, inset: float) -> list[tuple[float, float]]:
    cx = cy = size / 2
    radius = size * (0.5 - inset)
    return [
        (
            cx + radius * math.cos(math.radians(-90 + 60 * i)),
            cy + radius * math.sin(math.radians(-90 + 60 * i)),
        )
        for i in range(6)
    ]


def polygon_mask(size: int, points: list[tuple[float, float]]) -> Image.Image:
    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)
    draw.polygon(points, fill=255)
    return mask


def corner_fill_color(suit: str | None) -> tuple[int, int, int, int]:
    dark = SUIT_FRAME_COLORS.get(suit, SUIT_FRAME_COLORS[None])["dark"]
    return (*dark, 255)


def build_frame_overlay(template: Image.Image, inner_inset: float, hex_inset: float) -> Image.Image:
    size = template.size[0]
    art_mask = polygon_mask(size, point_up_hex_polygon(size, inner_inset))
    hex_mask = polygon_mask(size, point_up_hex_polygon(size, hex_inset))
    overlay = Image.new("RGBA", template.size, (0, 0, 0, 0))
    tpl = template.convert("RGBA")
    art_px = art_mask.load()
    hex_px = hex_mask.load()
    out_px = overlay.load()
    tpl_px = tpl.load()
    for y in range(size):
        for x in range(size):
            in_hex = hex_px[x, y]
            in_art = art_px[x, y]
            if in_hex and not in_art:
                out_px[x, y] = tpl_px[x, y]
    return overlay


def recolor_frame_overlay(overlay: Image.Image, suit: str | None) -> Image.Image:
    colors = SUIT_FRAME_COLORS.get(suit, SUIT_FRAME_COLORS[None])
    rgba = overlay.convert("RGBA")
    r, g, b, a = rgba.split()
    lum = Image.merge("RGB", (r, g, b)).convert("L")
    colored = ImageOps.colorize(lum, black=colors["dark"], mid=colors["mid"], white=colors["light"])
    colored.putalpha(a)
    return colored


def extract_hex_art(source: Image.Image, extract_inset: float) -> Image.Image:
    size = source.size[0]
    mask = polygon_mask(size, point_up_hex_polygon(size, extract_inset))
    masked = Image.new("RGBA", source.size, (0, 0, 0, 0))
    masked.paste(source.convert("RGBA"), mask=mask)
    bbox = masked.getbbox()
    if not bbox:
        return source.convert("RGBA")
    return masked.crop(bbox)


def fit_art_into_hex(art: Image.Image, size: int, inner_inset: float) -> Image.Image:
    target = polygon_mask(size, point_up_hex_polygon(size, inner_inset))
    bbox = target.getbbox()
    if not bbox:
        return Image.new("RGBA", (size, size), (0, 0, 0, 0))
    x0, y0, x1, y1 = bbox
    tw, th = x1 - x0, y1 - y0
    scale = max(tw / art.width, th / art.height)
    resized = art.resize(
        (max(1, int(art.width * scale)), max(1, int(art.height * scale))),
        Image.Resampling.LANCZOS,
    )
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ox = x0 + (tw - resized.width) // 2
    oy = y0 + (th - resized.height) // 2
    canvas.paste(resized, (ox, oy), resized)
    canvas.putalpha(Image.composite(canvas.split()[-1], Image.new("L", (size, size), 0), target))
    return canvas


def normalize_landscape(
    source: Image.Image,
    frame_overlay: Image.Image,
    suit: str | None,
    inner_inset: float,
    extract_inset: float,
    size: int,
) -> Image.Image:
    inner_mask = polygon_mask(size, point_up_hex_polygon(size, inner_inset))
    art = extract_hex_art(source, extract_inset)
    fitted = fit_art_into_hex(art, size, inner_inset)
    base = Image.new("RGBA", (size, size), corner_fill_color(suit))
    base.paste(fitted, mask=inner_mask)
    base.alpha_composite(frame_overlay)
    return base


def load_suit_map() -> dict[str, str | None]:
    data = json.loads(LANDSCAPES_JSON.read_text(encoding="utf-8"))
    suits: dict[str, str | None] = {}
    for row in data:
        suits[Path(row["image"]).name] = row.get("suit")
    return suits


def restore_from_backup(names: list[str]) -> None:
    for name in names:
        src = BACKUP_DIR / name
        dst = LANDSCAPES / name
        if src.exists():
            shutil.copy2(src, dst)


def source_image_for(path: Path) -> Image.Image:
    backup = BACKUP_DIR / path.name
    if backup.exists():
        return Image.open(backup).convert("RGBA")
    return Image.open(path).convert("RGBA")


def main() -> None:
    parser = argparse.ArgumentParser(description="Normalize Somnia landscape art to shared suit-colored hex frames.")
    parser.add_argument("--dry-run", action="store_true", help="List files only; do not write images.")
    parser.add_argument("--restore", action="store_true", help="Restore originals from backup before processing.")
    parser.add_argument("--inner-inset", type=float, default=0.135, help="Inner hex inset for scene art.")
    parser.add_argument("--hex-inset", type=float, default=0.08, help="Outer hex inset including border.")
    parser.add_argument("--extract-inset", type=float, default=0.11, help="Inset used when sampling source art.")
    args = parser.parse_args()

    if not TEMPLATE.exists():
        raise SystemExit(f"Template missing: {TEMPLATE}")

    suit_map = load_suit_map()
    template = Image.open(TEMPLATE).convert("RGBA")
    size = template.size[0]
    base_overlay = build_frame_overlay(template, args.inner_inset, args.hex_inset)

    frame_overlays: dict[str | None, Image.Image] = {}
    for suit_key in ("lucidity", "elasticity", "willpower", None):
        frame_overlays[suit_key] = recolor_frame_overlay(base_overlay, suit_key)

    targets = sorted(LANDSCAPES.glob("*.png"))
    changed = []
    skipped = []

    if args.restore and not args.dry_run:
        restore_from_backup([p.name for p in targets])

    if not args.dry_run:
        FRAME_OVERLAY_DIR.mkdir(parents=True, exist_ok=True)
        for suit_key, overlay in frame_overlays.items():
            label = suit_key or "neutral"
            overlay.save(FRAME_OVERLAY_DIR / f"{label}.png")

    for path in targets:
        if path.name in SKIP_FILES:
            skipped.append(path.name)
            continue
        if path.name not in suit_map:
            skipped.append(path.name)
            continue

        suit = suit_map[path.name]
        if args.dry_run:
            changed.append({"file": path.name, "suit": suit})
            continue

        BACKUP_DIR.mkdir(parents=True, exist_ok=True)
        backup = BACKUP_DIR / path.name
        if not backup.exists():
            shutil.copy2(path, backup)

        source = source_image_for(path)
        out = normalize_landscape(
            source,
            frame_overlays.get(suit, frame_overlays[None]),
            suit,
            args.inner_inset,
            args.extract_inset,
            size,
        )
        out.save(path)
        changed.append({"file": path.name, "suit": suit})

    summary = {
        "template": str(TEMPLATE.relative_to(ROOT)),
        "frame_overlays": str(FRAME_OVERLAY_DIR.relative_to(ROOT)),
        "processed": changed,
        "skipped": skipped,
        "dry_run": args.dry_run,
        "suit_colors": {
            str(k or "neutral"): v for k, v in SUIT_FRAME_COLORS.items()
        },
    }
    AUDIT_PATH.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
