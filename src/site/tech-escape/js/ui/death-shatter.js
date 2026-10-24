/**
 * Death still. The fall is photographed, blurred, held, then broken into tiles.
 * No DOM lookups: the caller owns the canvases, so the timing can be tested
 * without a browser.
 */

export function planTiles(cols, rows) {
  const tiles = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const cx = (x + 0.5) / cols - 0.5;
      const cy = (y + 0.5) / rows - 0.5;
      const n = ((x * 17 + y * 31) % 100) / 100;
      tiles.push({
        col: x,
        row: y,
        vx: cx * 240 + (n - 0.5) * 70,
        vy: 30 + cy * 40 + n * 80,
        vr: (n - 0.5) * 3.2,
        delay: (n * 0.12),
      });
    }
  }
  return tiles;
}

/** Where a tile sits `local` seconds after it starts moving. */
export function tilePose(tile, local) {
  const t = Math.max(0, local);
  return {
    x: tile.vx * t,
    y: tile.vy * t + 220 * t * t,
    rot: tile.vr * t,
    alpha: Math.max(0, 1 - t * 0.7),
  };
}

export const SHATTER_HOLD = 0.18;
export const SHATTER_BREAK = 1.05;

export function shatterDone(elapsed) {
  return elapsed >= SHATTER_HOLD + SHATTER_BREAK;
}

/**
 * @param {HTMLCanvasElement} snap blurred still
 * @param {HTMLCanvasElement} dest full-screen canvas
 */
export function createShatter(snap, cols = 12, rows = 7) {
  const tw = snap.width / cols;
  const th = snap.height / rows;
  const tiles = planTiles(cols, rows).map((tile) => {
    const chip = document.createElement('canvas');
    chip.width = Math.max(1, Math.ceil(tw));
    chip.height = Math.max(1, Math.ceil(th));
    const g = chip.getContext('2d');
    g.drawImage(snap, tile.col * tw, tile.row * th, tw, th, 0, 0, chip.width, chip.height);
    return { ...tile, chip };
  });
  return { snap, tiles, tw, th, t: 0 };
}

/** Draw one frame. Returns true when the shards have finished falling. */
export function drawShatter(state, dest, dt) {
  state.t += dt;
  const ctx = dest.getContext('2d');
  const dw = dest.width;
  const dh = dest.height;
  const sx = dw / state.snap.width;
  const sy = dh / state.snap.height;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, dw, dh);
  ctx.fillStyle = '#020604';
  ctx.fillRect(0, 0, dw, dh);

  if (state.t < SHATTER_HOLD) {
    const bands = 9;
    const kick = (state.t / SHATTER_HOLD) * 18;
    for (let i = 0; i < bands; i++) {
      const sy0 = (state.snap.height / bands) * i;
      const sh = state.snap.height / bands + 1;
      const shift = (i % 2 === 0 ? 1 : -1) * kick * (i % 3 === 0 ? 1.6 : 0.6);
      ctx.drawImage(
        state.snap,
        0, sy0, state.snap.width, sh,
        shift * sx, sy0 * sy, dw, sh * sy,
      );
    }
    return false;
  }

  const fallT = state.t - SHATTER_HOLD;
  for (const tile of state.tiles) {
    const pose = tilePose(tile, fallT - tile.delay);
    if (pose.alpha <= 0) continue;
    ctx.save();
    ctx.globalAlpha = pose.alpha;
    ctx.translate((tile.col * state.tw + state.tw / 2 + pose.x) * sx, (tile.row * state.th + state.th / 2 + pose.y) * sy);
    ctx.rotate(pose.rot);
    ctx.drawImage(tile.chip, (-state.tw / 2) * sx, (-state.th / 2) * sy, state.tw * sx, state.th * sy);
    ctx.restore();
  }
  return shatterDone(state.t);
}
