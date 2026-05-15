#!/usr/bin/env python3
"""Generate promotional graphics for Physix using Pillow."""
import os, math
from PIL import Image, ImageDraw, ImageFont, ImageFilter

OUT_DIR = "C:/Users/phili/OneDrive/Desktop/Physix/assets/graphics"
os.makedirs(OUT_DIR, exist_ok=True)

# Palette
BG = (10, 10, 18)
CYAN = (0, 229, 255)
PURPLE = (179, 0, 255)
ORANGE = (255, 85, 0)
GREEN = (0, 255, 102)
RED = (255, 30, 30)
WHITE = (255, 255, 255)

def draw_radial_gradient(img, center, radius, color_inner, color_outer):
    draw = ImageDraw.Draw(img)
    for r in range(radius, 0, -2):
        t = r / radius
        c = tuple(int(color_inner[i] * (1 - t) + color_outer[i] * t) for i in range(3))
        draw.ellipse([center[0] - r, center[1] - r, center[0] + r, center[1] + r], fill=c)

def draw_glowing_sphere(draw, cx, cy, r, color, blur=0):
    # Outer glow
    for i in range(5, 0, -1):
        glow_r = r + i * 8
        alpha = int(30 / i)
        glow_color = color + (alpha,)
        draw.ellipse([cx - glow_r, cy - glow_r, cx + glow_r, cy + glow_r], fill=glow_color)
    # Core
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=color + (255,))

def get_font(size):
    try:
        return ImageFont.truetype("arialbd.ttf", size)
    except:
        try:
            return ImageFont.truetype("Arial Bold.ttf", size)
        except:
            return ImageFont.load_default()

# ═══════════════════════════════════════════════════════════════════════════════
# 1. SPLASH SCREEN
# ═══════════════════════════════════════════════════════════════════════════════
img = Image.new("RGBA", (1920, 1080), BG)
draw = ImageDraw.Draw(img)

# Background radial gradient
draw_radial_gradient(img, (960, 600), 900, (20, 10, 40), BG)

# Track lines converging to vanishing point
vp = (960, 450)
for side in [-1, 1]:
    for i in range(6):
        x_start = 960 + side * (200 + i * 120)
        y_start = 1080
        # Draw line with glow
        for offset in range(-3, 4):
            alpha = 80 - abs(offset) * 20
            col = CYAN + (alpha,)
            draw.line([(x_start + offset, y_start), (vp[0] + side * 20 + offset, vp[1])], fill=col, width=2)

# Scattered glowing dots
import random
random.seed(42)
for _ in range(80):
    x = random.randint(0, 1920)
    y = random.randint(0, 1080)
    size = random.randint(2, 6)
    color = random.choice([CYAN, PURPLE, ORANGE, GREEN])
    draw.ellipse([x - size, y - size, x + size, y + size], fill=color + (180,))

# Title
title_font = get_font(140)
draw.text((960, 320), "PHYSIX", font=title_font, fill=WHITE, anchor="mm",
          stroke_width=4, stroke_fill=CYAN)

# Subtitle
sub_font = get_font(36)
draw.text((960, 420), "Physics-Based Slope Roller", font=sub_font, fill=CYAN, anchor="mm")

# Glowing sphere at bottom center
draw_glowing_sphere(draw, 960, 750, 60, ORANGE)

img = img.filter(ImageFilter.GaussianBlur(radius=0.5))
img.save(os.path.join(OUT_DIR, "splash_screen.png"))
print("Saved splash_screen.png")

# ═══════════════════════════════════════════════════════════════════════════════
# 2. GAME ICON
# ═══════════════════════════════════════════════════════════════════════════════
img = Image.new("RGBA", (512, 512), BG)
draw = ImageDraw.Draw(img)

# Background radial gradient
draw_radial_gradient(img, (256, 256), 350, (25, 15, 45), BG)

# Neon track curve
for t in range(0, 360, 5):
    angle = math.radians(t)
    r = 180 + math.sin(angle * 2) * 40
    x = 256 + math.cos(angle) * r
    y = 256 + math.sin(angle) * r
    draw.ellipse([x - 3, y - 3, x + 3, y + 3], fill=CYAN + (200,))

# Central glowing sphere
draw_glowing_sphere(draw, 256, 256, 80, ORANGE)

# Inner core
for i in range(3, 0, -1):
    draw.ellipse([256 - i * 20, 256 - i * 20, 256 + i * 20, 256 + i * 20],
                   fill=(255, 160, 40) + (100,))

draw.ellipse([256 - 25, 256 - 25, 256 + 25, 256 + 25], fill=(255, 200, 100) + (255,))

img = img.filter(ImageFilter.GaussianBlur(radius=0.3))
img.save(os.path.join(OUT_DIR, "game_icon.png"))
print("Saved game_icon.png")

# ═══════════════════════════════════════════════════════════════════════════════
# 3. MAIN MENU BG
# ═══════════════════════════════════════════════════════════════════════════════
img = Image.new("RGBA", (1920, 1080), BG)
draw = ImageDraw.Draw(img)

# Subtle vertical gradient
for y in range(1080):
    t = y / 1080
    r = int(10 + t * 15)
    g = int(10 + t * 5)
    b = int(18 + t * 25)
    draw.line([(0, y), (1920, y)], fill=(r, g, b))

# Faint track grid
for i in range(-10, 11):
    x = 960 + i * 80
    draw.line([(x, 1080), (960 + i * 10, 400)], fill=CYAN + (30,), width=1)
for y in range(400, 1080, 60):
    draw.line([(0, y), (1920, y)], fill=PURPLE + (20,), width=1)

# Title
title_font = get_font(120)
draw.text((960, 200), "PHYSIX", font=title_font, fill=WHITE, anchor="mm",
          stroke_width=3, stroke_fill=PURPLE)

# Ambient particles
random.seed(7)
for _ in range(60):
    x = random.randint(0, 1920)
    y = random.randint(0, 1080)
    size = random.randint(2, 5)
    color = random.choice([CYAN, PURPLE, GREEN])
    draw.ellipse([x - size, y - size, x + size, y + size], fill=color + (120,))

# Dark overlay on lower half for buttons
overlay = Image.new("RGBA", (1920, 1080), (0, 0, 0, 0))
overlay_draw = ImageDraw.Draw(overlay)
for y in range(600, 1080):
    alpha = int((y - 600) / 480 * 180)
    overlay_draw.line([(0, y), (1920, y)], fill=(0, 0, 0, alpha))
img = Image.alpha_composite(img, overlay)

img.save(os.path.join(OUT_DIR, "main_menu_bg.png"))
print("Saved main_menu_bg.png")

# ═══════════════════════════════════════════════════════════════════════════════
# 4. WORLD MAP BG
# ═══════════════════════════════════════════════════════════════════════════════
img = Image.new("RGBA", (1920, 1080), BG)
draw = ImageDraw.Draw(img)

# Hexagonal grid pattern
hex_size = 40
for row in range(-2, 20):
    for col in range(-2, 30):
        cx = col * hex_size * 1.732 + (row % 2) * hex_size * 0.866
        cy = row * hex_size * 1.5
        if cx < -50 or cx > 1970 or cy < -50 or cy > 1130:
            continue
        points = []
        for i in range(6):
            angle = math.radians(60 * i - 30)
            px = cx + hex_size * 0.5 * math.cos(angle)
            py = cy + hex_size * 0.5 * math.sin(angle)
            points.append((px, py))
        draw.polygon(points, outline=(30, 30, 50), fill=None)

# World clusters (5 worlds)
world_colors = [GREEN, (0, 150, 255), ORANGE, RED, PURPLE]
world_centers = [(300, 800), (600, 500), (960, 700), (1300, 450), (1600, 750)]
world_names = ["World 1", "World 2", "World 3", "World 4", "World 5"]

for idx, ((cx, cy), color, name) in enumerate(zip(world_centers, world_colors, world_names)):
    # Draw connecting lines between worlds
    if idx < len(world_centers) - 1:
        ncx, ncy = world_centers[idx + 1]
        for offset in range(-2, 3):
            draw.line([(cx + offset, cy + offset), (ncx + offset, ncy + offset)],
                      fill=color + (60,), width=2)

    # Draw nodes in cluster
    random.seed(idx * 10)
    node_count = 4 if idx < 4 else 3
    for n in range(node_count):
        nx = cx + random.randint(-80, 80)
        ny = cy + random.randint(-60, 60)
        # Glow
        for r in range(8, 0, -1):
            alpha = int(40 / r)
            draw.ellipse([nx - r * 4, ny - r * 4, nx + r * 4, ny + r * 4], fill=color + (alpha,))
        draw.ellipse([nx - 6, ny - 6, nx + 6, ny + 6], fill=color + (255,))
        # Small label
        draw.text((nx, ny + 15), f"{idx + 1}-{n + 1}", font=get_font(12), fill=WHITE, anchor="mm")

    # Cluster label
    label_font = get_font(22)
    draw.text((cx, cy - 50), name, font=label_font, fill=color, anchor="mm",
              stroke_width=1, stroke_fill=WHITE)

img.save(os.path.join(OUT_DIR, "world_map_bg.png"))
print("Saved world_map_bg.png")

print("\nAll graphics generated successfully in:", OUT_DIR)
