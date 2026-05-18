from PIL import Image, ImageDraw
import math

W, H = 512, 144
img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)

# Helper: draw a flat vector-style pine tree
def draw_pine(draw, cx, cy, scale):
    trunk_w = int(6 * scale)
    trunk_h = int(18 * scale)
    layers = [(18, 0.7), (24, 0.55), (30, 0.4)]
    # Dark to light green layers
    greens = [(0.15, 0.45, 0.22), (0.20, 0.55, 0.28), (0.26, 0.62, 0.34)]
    for i, (size, frac) in enumerate(layers):
        bw = int(size * scale)
        bh = int((size * 0.85) * scale)
        base = cy - trunk_h - int(frac * trunk_h * 2)
        pts = [
            (cx, base - bh),
            (cx - bw // 2, base),
            (cx + bw // 2, base)
        ]
        col = tuple(int(c * 255) for c in greens[i])
        draw.polygon(pts, fill=col)
    # Trunk
    draw.rectangle(
        [cx - trunk_w // 2, cy - trunk_h, cx + trunk_w // 2, cy],
        fill=(0.42, 0.28, 0.18, 255)
    )

# Helper: draw a round deciduous tree
def draw_round_tree(draw, cx, cy, scale):
    trunk_w = int(6 * scale)
    trunk_h = int(16 * scale)
    crown_r = int(22 * scale)
    base_y = cy - trunk_h
    # Crown as a circle
    draw.ellipse(
        [cx - crown_r, base_y - crown_r * 2, cx + crown_r, base_y + crown_r * 0.3],
        fill=(0.30, 0.60, 0.28, 255)
    )
    # Highlight bump
    draw.ellipse(
        [cx - crown_r // 2, base_y - crown_r * 2, cx + crown_r // 2, base_y - crown_r * 0.8],
        fill=(0.38, 0.70, 0.36, 255)
    )
    # Trunk
    draw.rectangle(
        [cx - trunk_w // 2, cy - trunk_h, cx + trunk_w // 2, cy],
        fill=(0.45, 0.30, 0.18, 255)
    )

# Helper: draw a tall thin fir
def draw_fir(draw, cx, cy, scale):
    trunk_w = int(5 * scale)
    trunk_h = int(16 * scale)
    base = cy - trunk_h
    # Simple triangle
    bw = int(14 * scale)
    bh = int(36 * scale)
    pts = [(cx, base - bh), (cx - bw, base), (cx + bw, base)]
    draw.polygon(pts, fill=(0.18, 0.50, 0.26, 255))
    # Inner lighter triangle
    bw2 = int(bw * 0.55)
    bh2 = int(bh * 0.55)
    pts2 = [(cx, base - bh2 - int(bh * 0.2)), (cx - bw2, base - int(bh * 0.15)), (cx + bw2, base - int(bh * 0.15))]
    draw.polygon(pts2, fill=(0.26, 0.58, 0.34, 255))
    # Trunk
    draw.rectangle(
        [cx - trunk_w // 2, cy - trunk_h, cx + trunk_w // 2, cy],
        fill=(0.42, 0.28, 0.18, 255)
    )

# Helper: draw a bush
def draw_bush(draw, cx, cy, scale):
    r = int(14 * scale)
    base = cy - int(6 * scale)
    draw.ellipse([cx - r, base - r, cx + r, base + r], fill=(0.32, 0.60, 0.30, 255))
    draw.ellipse([cx - r // 2, base - int(r * 1.2), cx + r // 2, base + r // 2], fill=(0.40, 0.68, 0.38, 255))

# Ground strip at bottom — subtle grassy ground
# draw.rectangle([0, H - 6, W, H], fill=(0.22, 0.50, 0.18, 255))

# Place trees across the width with seamless tiling in mind
# We'll place them from x=-64 to x=W+64 and only keep the middle W
# But for simplicity, just place within bounds ensuring first/last overlap

trees = [
    (0,    "fir",   0.9),
    (48,   "round", 1.0),
    (96,   "pine",  1.1),
    (148,  "bush",  0.85),
    (188,  "fir",   0.95),
    (236,  "round", 0.9),
    (280,  "pine",  1.0),
    (328,  "bush",  0.9),
    (376,  "fir",   1.05),
    (420,  "round", 0.95),
    (468,  "pine",  0.9),
    (510,  "bush",  0.8),   # overlaps right edge
]

for tx, kind, sc in trees:
    # Wrap negative/overhang into canvas
    draw_x = tx % W
    if kind == "pine":
        draw_pine(draw, draw_x, H - 4, sc)
    elif kind == "round":
        draw_round_tree(draw, draw_x, H - 4, sc)
    elif kind == "fir":
        draw_fir(draw, draw_x, H - 4, sc)
    elif kind == "bush":
        draw_bush(draw, draw_x, H - 4, sc)

# Also draw left-edge overhangs so it tiles seamlessly
# The tree at x=510 is a bush that barely peeks in; add a fir at x=-20 (wrapped to 492)
draw_fir(draw, 492, H - 4, 0.85)

# Add some tiny grass tufts
def draw_grass(draw, cx, cy, scale=1.0):
    h = int(6 * scale)
    for ox in (-2, 0, 2):
        draw.line([(cx + ox, cy), (cx + ox + (1 if ox == 0 else -1), cy - h)], fill=(0.35, 0.65, 0.30, 255), width=int(2 * scale))

for gx in range(0, W, 24):
    draw_grass(draw, gx + 8, H - 4, 0.8 + (gx % 7) * 0.1)

img.save(r"C:\Users\phili\OneDrive\Desktop\Physix\assets\themes\treeline_wall.png")
print("Saved treeline_wall.png")
