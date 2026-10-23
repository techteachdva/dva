export const $ = (id) => document.getElementById(id);

export function el(tag, attrs = {}, ...children) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(n.style, v);
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    n.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return n;
}

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
export const easeOutBack = (t) => { const c1 = 1.70158; const c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };

export function shuffle(arr, rnd = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const pick = (arr, rnd = Math.random) => arr[Math.floor(rnd() * arr.length)];
export const uid = () => Math.random().toString(36).slice(2, 10);
export const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** A tiny tween runner driven by the render loop. */
const tweens = new Set();
let clockNow = 0;
export function tween(ms, fn, done) {
  const t = { start: Math.max(performance.now(), clockNow), ms, fn, done };
  tweens.add(t);
  return () => tweens.delete(t);
}
export function runTweens(now) {
  clockNow = now;
  for (const t of tweens) {
    const k = Math.min(1, (now - t.start) / t.ms);
    t.fn(k);
    if (k >= 1) {
      tweens.delete(t);
      if (t.done) t.done();
    }
  }
}

export const prefersReducedMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Hold a continue button shut for ms so the player reads before moving on; a bar fills
 * across it while it waits. Check readLocked(btn) before acting on a press.
 * Playtest scripts set window.__cybermorphFast to skip the wait.
 */
export function readLock(btn, ms) {
  if (window.__cybermorphFast) ms = 0;
  clearTimeout(btn._lockT);
  btn.classList.remove('read-lock');
  btn._lockUntil = performance.now() + ms;
  if (ms <= 0) { btn.removeAttribute('aria-disabled'); return; }
  void btn.offsetWidth; // restart the fill animation
  btn.style.setProperty('--lock-ms', `${ms}ms`);
  btn.classList.add('read-lock');
  btn.setAttribute('aria-disabled', 'true');
  btn._lockT = setTimeout(() => { btn.classList.remove('read-lock'); btn.removeAttribute('aria-disabled'); }, ms);
}
export const readLocked = (btn) => performance.now() < (btn._lockUntil || 0);

/** A tween as a promise. */
export const tweenP = (ms, fn) => new Promise((res) => tween(ms, fn, res));
