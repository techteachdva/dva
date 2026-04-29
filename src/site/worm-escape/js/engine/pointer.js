/** Canvas-space helpers for mouse hit testing (coords match Input.mouseX/Y, 1280×800). */

export function pointInRect(mx, my, x, y, w, h) {
  return mx >= x && mx < x + w && my >= y && my < y + h;
}

/** Map X to nearest column band using midpoint splits between consecutive centers. */
export function columnIndexFromX(mx, colCenters) {
  const n = colCenters?.length ?? 0;
  if (n <= 1) return 0;
  if (mx <= colCenters[0]) return 0;
  for (let i = 0; i < n - 1; i++) {
    const mid = (colCenters[i] + colCenters[i + 1]) / 2;
    if (mx < mid) return i;
  }
  return n - 1;
}

export function stepTowardIndex(cur, dest) {
  if (dest > cur) return 1;
  if (dest < cur) return -1;
  return 0;
}
