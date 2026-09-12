/** Axial hex coordinates (q, r) for the Somnia Dreamscape board. */

/** Inner disk (bed + starters + ring 2) plus six ring-3 corners = 25 landscape tiles. */
export const BOARD_RADIUS = 3;

export const HEX_DIRS = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

/** Fixed layout: Bed center, six starters on ring 1. */
export const STARTER_HEX = {
  bed: { q: 0, r: 0 },
  city: { q: 1, r: 0 },
  sky: { q: 1, r: -1 },
  forest: { q: 0, r: -1 },
  road: { q: -1, r: 0 },
  house: { q: -1, r: 1 },
  suburbia: { q: 0, r: 1 },
};

/** All coordinates on a single hex ring (radius 0 = center only). */
export function hexRingCoords(radius) {
  if (radius === 0) return [{ q: 0, r: 0 }];
  const results = [];
  let q = HEX_DIRS[4].q * radius;
  let r = HEX_DIRS[4].r * radius;
  for (let i = 0; i < 6; i += 1) {
    for (let step = 0; step < radius; step += 1) {
      results.push({ q, r });
      q += HEX_DIRS[i].q;
      r += HEX_DIRS[i].r;
    }
  }
  return results;
}

/** Ring-2 pool slots (twelve tiles between the starters). */
export const POOL_RING2_SLOTS = hexRingCoords(2);

/** Six symmetric corner extensions on ring 3 (one per axial direction). */
export const POOL_RING3_CORNER_SLOTS = [
  { q: 3, r: 0 },
  { q: 3, r: -3 },
  { q: 0, r: -3 },
  { q: -3, r: 0 },
  { q: -3, r: 3 },
  { q: 0, r: 3 },
];

/** @deprecated Use POOL_RING2_SLOTS — kept for older imports. */
export const POOL_HEX_SLOTS = POOL_RING2_SLOTS;

/** All non-starter pool coordinates: ring 2, then ring-3 corners (18 slots). */
export function poolBoardSlots() {
  return [...POOL_RING2_SLOTS, ...POOL_RING3_CORNER_SLOTS];
}

/** Every landscape coordinate on the board (25 cells). */
export function allBoardSlots() {
  return [...hexDiskCoords(2), ...POOL_RING3_CORNER_SLOTS];
}

export function hexKey(q, r) {
  return `${q},${r}`;
}

export function hexDistance(a, b) {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

export function hexNeighbors(q, r) {
  return HEX_DIRS.map((d) => ({ q: q + d.q, r: r + d.r }));
}

export function tileAt(state, q, r) {
  return state.board.find((t) => t.q === q && t.r === r);
}

export function tileCoords(tile) {
  return { q: tile.q, r: tile.r };
}

export function areHexAdjacent(tileA, tileB) {
  if (!tileA || !tileB) return false;
  return hexDistance(tileA, tileB) === 1;
}

export function adjacentTiles(state, landscapeId) {
  const tile = state.board.find((l) => l.id === landscapeId);
  if (!tile) return [];
  return hexNeighbors(tile.q, tile.r)
    .map(({ q, r }) => tileAt(state, q, r))
    .filter(Boolean);
}

export function adjacentLandscapeIds(state, landscapeId) {
  return adjacentTiles(state, landscapeId).map((t) => t.id);
}

export function canTradeBetween(state, landscapeA, landscapeB) {
  if (landscapeA === landscapeB) return true;
  const a = state.board.find((l) => l.id === landscapeA);
  const b = state.board.find((l) => l.id === landscapeB);
  return areHexAdjacent(a, b);
}

/** Edge = revealed non-center tile with fewer than 6 board neighbors. */
export function isEdgeLandscape(state, tile) {
  if (!tile?.revealed || tile.center) return false;
  const neighbors = hexNeighbors(tile.q, tile.r);
  const onBoard = neighbors.filter(({ q, r }) => tileAt(state, q, r));
  return onBoard.length < 6;
}

export function edgeLandscapes(state) {
  return state.board.filter((t) => isEdgeLandscape(state, t));
}

/**
 * Legal Explore targets: adjacent revealed tiles, or any revealed if free explore.
 */
export function getLegalMoveTargets(state, player, { freeMove = false } = {}) {
  const from = state.board.find((l) => l.id === player.landscapeId);
  if (!from) return [];

  if (freeMove || state.freeExploreNextRound) {
    return state.board.filter((t) => t.revealed);
  }

  return adjacentTiles(state, from.id).filter((t) => t.revealed);
}

export function canMoveTo(state, player, targetId, { freeMove = false } = {}) {
  const targets = getLegalMoveTargets(state, player, { freeMove });
  return targets.some((t) => t.id === targetId);
}

/** Pixel offset for pointy-top hex layout (size = circumradius, center to vertex). */
export function hexToPixel(q, r, size = 58) {
  const x = size * Math.sqrt(3) * (q + r / 2);
  const y = size * 1.5 * r;
  return { x, y };
}

export function boardPixelBounds(state, size = 58) {
  const halfW = (size * Math.sqrt(3)) / 2;
  const halfH = size;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  state.board.forEach((tile) => {
    const { x, y } = hexToPixel(tile.q, tile.r, size);
    minX = Math.min(minX, x - halfW);
    maxX = Math.max(maxX, x + halfW);
    minY = Math.min(minY, y - halfH);
    maxY = Math.max(maxY, y + halfH);
  });
  const pad = Math.max(8, size * 0.12);
  return {
    width: maxX - minX + pad * 2,
    height: maxY - minY + pad * 2,
    offsetX: -minX + pad,
    offsetY: -minY + pad,
  };
}

/**
 * All hex coordinates within `maxRadius` of origin (uniform hex disk).
 */
export function hexDiskCoords(maxRadius) {
  const coords = [];
  for (let q = -maxRadius; q <= maxRadius; q += 1) {
    for (let r = -maxRadius; r <= maxRadius; r += 1) {
      if (hexDistance({ q, r }, { q: 0, r: 0 }) <= maxRadius) {
        coords.push({ q, r });
      }
    }
  }
  return coords;
}

/**
 * Build board: Bed + six starters (revealed) + all eighteen pool landscapes
 * (twelve on ring 2, six on ring-3 corners). Twenty-five tiles total.
 */
export function buildHexBoard(landscapes) {
  const all = landscapes.filter((l) => !l.hidden);
  const center = all.find((l) => l.center);
  const starters = all.filter((l) => l.starting && !l.center);
  const pool = shufflePool(all.filter((l) => !l.starting && !l.center));
  const poolSlots = poolBoardSlots();

  if (pool.length > poolSlots.length) {
    console.warn(`Somnia board: ${pool.length} pool landscapes but only ${poolSlots.length} slots.`);
  }

  const board = [];

  if (center && STARTER_HEX.bed) {
    const { q, r } = STARTER_HEX.bed;
    board.push({ ...center, q, r, revealed: true, wasteland: false, finalRecurrenceSide: false });
  }

  starters.forEach((landscape) => {
    const pos = STARTER_HEX[landscape.id];
    if (!pos) return;
    board.push({
      ...landscape,
      q: pos.q,
      r: pos.r,
      revealed: true,
      wasteland: false,
      finalRecurrenceSide: false,
    });
  });

  poolSlots.forEach((slot, index) => {
    const landscape = pool[index];
    if (!landscape) return;
    board.push({
      ...landscape,
      q: slot.q,
      r: slot.r,
      revealed: false,
      wasteland: true,
      finalRecurrenceSide: false,
    });
  });

  return board;
}

function shufflePool(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
