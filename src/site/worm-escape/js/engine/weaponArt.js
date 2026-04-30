// Raster weapon portraits for character creation cards (PNG under img/weapons/).
// Paths resolve relative to index.html.

const IMG_DIR = "img/weapons/";
const LOADOUT_SRC = Object.freeze({
  blunderbuss: "blunderbuss.png",
  rustyChainsaw: "rustyChainsaw.png",
  cursedScythe: "cursedScythe.png",
  engineerWrench: "engineerWrench.png",
  chair: "chair.png",
  club: "club.png",
});

const cache = new Map();
/** @type {Map<string, Promise<void>>} */
const inflight = new Map();

function loadOne(loadoutId) {
  if (cache.has(loadoutId)) return Promise.resolve();
  const pending = inflight.get(loadoutId);
  if (pending) return pending;

  const file = LOADOUT_SRC[loadoutId];
  if (!file) return Promise.resolve();

  const p = new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      cache.set(loadoutId, img);
      inflight.delete(loadoutId);
      resolve();
    };
    img.onerror = () => {
      cache.set(loadoutId, null);
      inflight.delete(loadoutId);
      resolve();
    };
    img.src = `${IMG_DIR}${file}?v=1`;
  });
  inflight.set(loadoutId, p);
  return p;
}

/** Kick off loading for every keyed weapon; resolves when attempts finish (missing files are benign). */
export function preloadWeaponArt() {
  return Promise.all(Object.keys(LOADOUT_SRC).map(loadOne));
}

export function hasRasterWeaponArt(loadoutId) {
  return !!LOADOUT_SRC[loadoutId];
}

/** Ensure this id is loading / loaded (cheap no-op once cached). */
function ensureQueued(loadoutId) {
  if (LOADOUT_SRC[loadoutId]) void loadOne(loadoutId);
}

/**
 * Draw centered at (cx, cy); ~maxHeight pixels tall. Returns true if a loaded bitmap was drawn.
 */
export function tryDrawRasterWeaponArt(ctx, loadoutId, cx, cy, maxHeight = 135) {
  if (!LOADOUT_SRC[loadoutId]) return false;
  ensureQueued(loadoutId);
  const img = cache.get(loadoutId);
  if (!img || !img.complete || img.naturalWidth === 0) return false;
  const nh = img.naturalHeight || 1;
  const nw = img.naturalWidth || 1;
  const scale = maxHeight / nh;
  const w = nw * scale;
  const h = maxHeight;
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
  ctx.restore();
  return true;
}
