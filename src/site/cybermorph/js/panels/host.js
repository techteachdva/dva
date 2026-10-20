/**
 * Panels sit over the dimmed diorama. While one is open the world ignores clicks
 * (a tap that closes one layer must never land on the next).
 */

import { $, el } from '../core/util.js';
import { setDim, setFocus, R } from '../engine/renderer.js';
import { sfx } from '../core/audio.js';

let openCount = 0;
export const panelOpen = () => openCount > 0;

export function openPanel({ dim = 0.62, focus = false, className = '' } = {}) {
  openCount++;
  document.body.classList.add('panel-open');
  const root = el('div', { class: `panel ${className}` });
  $('panel-layer').append(root);
  setDim(dim);
  if (focus) setFocus(true);
  sfx.open();
  let closed = false;
  const keyHandlers = [];
  const api = {
    root,
    onKey(fn) {
      const h = (e) => { if (!closed) fn(e); };
      keyHandlers.push(h);
      window.addEventListener('keydown', h);
    },
    close() {
      if (closed) return;
      closed = true;
      openCount = Math.max(0, openCount - 1);
      keyHandlers.forEach((h) => window.removeEventListener('keydown', h));
      root.remove();
      if (openCount === 0) { setDim(0); setFocus(false); document.body.classList.remove('panel-open'); }
      // Swallow the click that closed the panel so it can't reach the world underneath.
      R.swallowUntil = performance.now() + 250;
      sfx.close();
    },
    get closed() { return closed; },
  };
  return api;
}

export function closeButton(onClose) {
  return el('button', { class: 'x-btn panel-close', type: 'button', 'aria-label': 'Close (Esc)', title: 'Close (Esc)', onclick: onClose }, '✕ CLOSE');
}
