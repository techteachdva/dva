// Deterministic-ish RNG helpers (simple Mulberry32 + conveniences).
export function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function rand(min, max) {
  return min + Math.random() * (max - min);
}
export function randInt(min, max) {
  let a = min;
  let b = max;
  if (b < a) [a, b] = [b, a];
  return Math.floor(rand(a, b + 1));
}

/** Undefined if `arr` is empty — callers must fallback. */
export function pick(arr) {
  const n = Array.isArray(arr) ? arr.length : 0;
  if (n <= 0) return undefined;
  return arr[Math.floor(Math.random() * n)];
}
export function chance(p) {
  return Math.random() < p;
}
