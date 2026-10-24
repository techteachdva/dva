/**
 * Types an element's text, then unlocks the panel.
 * Reduced motion shows the text at once. The full string is always in the
 * DOM for assistive tech via aria-label before the visual catch-up.
 */

import { settings } from '../meta/settings.js';

export function typeInto(el, text, { onDone, cps = 38 } = {}) {
  const value = String(text || '');
  if (!el) {
    onDone?.();
    return () => {};
  }
  el.setAttribute('aria-label', value);
  if (settings.get('reduceMotion') || value.length < 2) {
    el.textContent = value;
    onDone?.();
    return () => {};
  }
  el.textContent = '';
  let i = 0;
  let timer = 0;
  let dead = false;
  const tick = () => {
    if (dead) return;
    i = Math.min(value.length, i + 1);
    el.textContent = value.slice(0, i);
    if (i < value.length) timer = window.setTimeout(tick, 1000 / cps);
    else onDone?.();
  };
  timer = window.setTimeout(tick, 1000 / cps);
  return () => {
    dead = true;
    window.clearTimeout(timer);
  };
}

/**
 * Types every [data-gate] in order, then enables buttons and fields.
 * [data-gate-keep] stays usable the whole time (Skip, for example).
 */
export function gate(root) {
  if (!root) return () => {};
  const nodes = [...root.querySelectorAll('[data-gate]')];
  const locks = [...root.querySelectorAll('button, input, select, textarea')]
    .filter((el) => !el.dataset.gateKeep && !el.closest('[data-gate-keep]'));
  const originals = nodes.map((el) => el.textContent || '');
  locks.forEach((el) => { el.disabled = true; });
  if (!nodes.length || settings.get('reduceMotion')) {
    locks.forEach((el) => { el.disabled = false; });
    return () => {};
  }
  let stop = () => {};
  let index = 0;
  const next = () => {
    if (index >= nodes.length) {
      locks.forEach((el) => { el.disabled = false; });
      return;
    }
    const el = nodes[index];
    const text = originals[index];
    index += 1;
    stop = typeInto(el, text, { onDone: next, cps: 42 });
  };
  next();
  return () => stop();
}
