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
  return Math.floor(rand(min, max + 1));
}
export function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
export function chance(p) {
  return Math.random() < p;
}
