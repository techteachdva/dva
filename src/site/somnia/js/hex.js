/** Axial hex coordinates (q, r) for the Somnia Dreamscape board. */

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

/** One outward slot per starter direction (ring 2). */
export const POOL_HEX_SLOTS = [
  { q: 2, r: 0 },
  { q: 2, r: -1 },
  { q: 1, r: -2 },
  { q: -1, r: -1 },
  { q: -2, r: 0 },
  { q: -1, r: 2 },
  { q: 0, r: 2 },
  { q: 2, r: -2 },
  { q: -2, r: 1 },
  { q: 1, r: 1 },
  { q: -2, r: 2 },
  { q: 0, r: -2 },
];

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

/** Pixel offset for pointy-top hex layout (size = half-width). */
export function hexToPixel(q, r, size = 58) {
  const x = size * 1.5 * q;
  const y = size * Math.sqrt(3) * (r + q / 2);
  return { x, y };
}

export function boardPixelBounds(state, size = 58) {
  let minX = 0;
  let maxX = 0;
  let minY = 0;
  let maxY = 0;
  state.board.forEach((tile) => {
    const { x, y } = hexToPixel(tile.q, tile.r, size);
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  });
  const pad = size * 1.2;
  return {
    width: maxX - minX + pad * 2,
    height: maxY - minY + pad * 2,
    offsetX: -minX + pad,
    offsetY: -minY + pad,
  };
}

/**
 * Build board with hex coordinates. Starters fixed; pool tiles fill ring-2+ slots.
 */
export function buildHexBoard(landscapes, poolCount = 6) {
  const all = landscapes.filter((l) => !l.hidden);
  const center = all.find((l) => l.center);
  const starters = all.filter((l) => l.starting);
  const pool = shufflePool(all.filter((l) => !l.starting && !l.center));

  const usedKeys = new Set();
  const board = [];

  if (center && STARTER_HEX.bed) {
    const { q, r } = STARTER_HEX.bed;
    board.push({ ...center, q, r, revealed: true, wasteland: false });
    usedKeys.add(hexKey(q, r));
  }

  starters.forEach((landscape) => {
    const pos = STARTER_HEX[landscape.id];
    if (!pos) return;
    board.push({ ...landscape, q: pos.q, r: pos.r, revealed: true, wasteland: false });
    usedKeys.add(hexKey(pos.q, pos.r));
  });

  let poolIdx = 0;
  for (const slot of POOL_HEX_SLOTS) {
    if (poolIdx >= poolCount) break;
    const key = hexKey(slot.q, slot.r);
    if (usedKeys.has(key)) continue;
    const landscape = pool[poolIdx];
    if (!landscape) break;
    board.push({
      ...landscape,
      q: slot.q,
      r: slot.r,
      revealed: false,
      wasteland: true,
    });
    usedKeys.add(key);
    poolIdx += 1;
  }

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
