/** Settings live in the browser, shared by every profile on this Chromebook. */

import { prefersReducedMotion } from './util.js';

const KEY = 'cybermorph.settings.v1';

const DEFAULTS = {
  music: 0.35,
  sfx: 0.7,
  speakWords: true,
  speakDialogue: false,
  rate: 0.95,
  textSize: 1,
  reducedMotion: false,
  cognates: false,
  quality: 'auto',
  font: 'default',
};

function load() {
  let s = { ...DEFAULTS, reducedMotion: prefersReducedMotion() };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) s = { ...s, ...JSON.parse(raw) };
  } catch { /* private window or blocked storage: defaults are fine */ }
  const q = new URLSearchParams(location.search);
  if (q.get('cognates') === 'es') s.cognates = true;
  return s;
}

export const settings = load();
const listeners = new Set();

export function setSetting(key, value) {
  settings[key] = value;
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* ignore */ }
  applySettings();
  listeners.forEach((fn) => fn(key, value));
}

export function onSetting(fn) { listeners.add(fn); }

export function applySettings() {
  const root = document.documentElement;
  root.style.setProperty('--text-scale', String(settings.textSize));
  root.classList.toggle('reduced-motion', !!settings.reducedMotion);
  root.classList.toggle('font-readable', settings.font === 'readable');
}
