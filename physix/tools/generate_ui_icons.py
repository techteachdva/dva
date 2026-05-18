#!/usr/bin/env python3
"""Generate UI icons (heart, star, coin, lock) as PNG files — stdlib only."""
import os
import struct
import zlib

SIZE = 64
OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "icons")


def _png(w: int, h: int, rgba_rows: list[bytes]) -> bytes:
    def chunk(tag: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    raw = b"".join(b"\x00" + row for row in rgba_rows)
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )


def _blank() -> list[list[tuple[int, int, int, int]]]:
    return [[(0, 0, 0, 0) for _ in range(SIZE)] for _ in range(SIZE)]


def _set(px, x, y, c: tuple[int, int, int, int]) -> None:
    if 0 <= x < SIZE and 0 <= y < SIZE:
        px[y][x] = c


def _fill_circle(px, cx, cy, r, c) -> None:
    r2 = r * r
    for y in range(SIZE):
        for x in range(SIZE):
            if (x - cx) ** 2 + (y - cy) ** 2 <= r2:
                _set(px, x, y, c)


def _fill_rect(px, x0, y0, x1, y1, c) -> None:
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            _set(px, x, y, c)


def _fill_poly(px, pts, c) -> None:
    # Scanline fill
    ys = [p[1] for p in pts]
    y_min, y_max = max(0, min(ys)), min(SIZE - 1, max(ys))
    for y in range(y_min, y_max + 1):
        xs = []
        n = len(pts)
        for i in range(n):
            x0, y0 = pts[i]
            x1, y1 = pts[(i + 1) % n]
            if y0 == y1:
                continue
            if (y >= min(y0, y1)) and (y < max(y0, y1)):
                xs.append(x0 + (y - y0) * (x1 - x0) / (y1 - y0))
        if len(xs) < 2:
            continue
        xs.sort()
        for x in range(int(xs[0]), int(xs[-1]) + 1):
            _set(px, x, y, c)


def _rows(px) -> list[bytes]:
    out = []
    for row in px:
        out.append(bytes(v for pxel in row for v in pxel))
    return out


def heart() -> bytes:
    px = _blank()
    red = (230, 45, 60, 255)
    hi = (255, 100, 120, 255)
    _fill_circle(px, 22, 24, 10, hi)
    _fill_circle(px, 42, 24, 10, hi)
    _fill_poly(px, [(12, 30), (20, 18), (32, 26), (44, 18), (52, 30), (32, 54)], red)
    return _png(SIZE, SIZE, _rows(px))


def star(fill=(255, 210, 40, 255)) -> bytes:
    px = _blank()
    pts = [(32, 6), (39, 24), (58, 24), (43, 36), (49, 56), (32, 44), (15, 56), (21, 36), (6, 24), (25, 24)]
    _fill_poly(px, pts, fill)
    return _png(SIZE, SIZE, _rows(px))


def coin() -> bytes:
    px = _blank()
    gold = (255, 195, 30, 255)
    edge = (200, 140, 10, 255)
    _fill_circle(px, 32, 36, 22, gold)
    _fill_circle(px, 32, 36, 18, (255, 230, 120, 200))
    for y in range(SIZE):
        for x in range(SIZE):
            if (x - 32) ** 2 + (y - 36) ** 2 <= 22 ** 2:
                d = abs((x - 32) ** 2 + (y - 36) ** 2 - 20 ** 2)
                if d < 30:
                    _set(px, x, y, edge)
    _fill_rect(px, 26, 28, 38, 44, (180, 120, 0, 255))
    return _png(SIZE, SIZE, _rows(px))


def lock() -> bytes:
    px = _blank()
    body = (170, 175, 190, 255)
    shackle = (150, 155, 170, 255)
    _fill_rect(px, 20, 30, 44, 54, body)
    for y in range(10, 32):
        for x in range(18, 46):
            if (x - 32) ** 2 + (y - 22) ** 2 <= 14 ** 2 and y <= 28:
                _set(px, x, y, shackle)
    _fill_circle(px, 32, 42, 4, (90, 95, 110, 255))
    return _png(SIZE, SIZE, _rows(px))


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    files = {
        "heart.png": heart(),
        "star.png": star(),
        "star_empty.png": star((70, 70, 80, 255)),
        "coin.png": coin(),
        "lock.png": lock(),
    }
    for name, data in files.items():
        path = os.path.join(OUT, name)
        with open(path, "wb") as f:
            f.write(data)
        print("wrote", path)


if __name__ == "__main__":
    main()
