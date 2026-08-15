/**
 * Rebindable gameplay controls. Movement stays on WASD / arrows; everything
 * else can be remapped from the pause menu and persists in settings.
 */

/** @typedef {'interact'|'throw'|'eatCheetos'|'light'|'cycleItem'|'crouch'} BindAction */

export const BIND_DEFAULTS = {
  interact: 'Enter',
  throw: 'KeyE',
  eatCheetos: 'KeyR',
  light: 'KeyF',
  cycleItem: 'KeyQ',
  crouch: 'KeyC',
};

export const BIND_LABELS = {
  interact: 'Use terminal / printer / door',
  throw: 'Throw (disc at virus, cheetos otherwise)',
  eatCheetos: 'Eat hot cheetos (drinks soda when soda is selected)',
  light: 'Flashlight',
  cycleItem: 'Switch inventory item',
  crouch: 'Crouch / crawl',
};

const DISPLAY = {
  Enter: 'Enter',
  NumpadEnter: 'Enter',
  Space: 'Space',
  ShiftLeft: 'Shift',
  ShiftRight: 'Shift',
  ControlLeft: 'Ctrl',
  ControlRight: 'Ctrl',
  KeyE: 'E',
  KeyR: 'R',
  KeyF: 'F',
  KeyQ: 'Q',
  KeyG: 'G',
  KeyC: 'C',
  KeyW: 'W',
  KeyA: 'A',
  KeyS: 'S',
  KeyD: 'D',
};

/** Human-readable key cap for HUD and menus. */
export function bindDisplay(code) {
  if (!code) return '?';
  if (DISPLAY[code]) return DISPLAY[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Arrow')) return code.slice(5);
  if (code.startsWith('Digit')) return code.slice(5);
  return code;
}

/** Merge saved binds with defaults so new actions always have a key. */
export function normalizeBinds(raw) {
  return { ...BIND_DEFAULTS, ...(raw && typeof raw === 'object' ? raw : null) };
}

/** @param {Record<BindAction,string>} binds */
export function validateBinds(binds) {
  const out = normalizeBinds(binds);
  const used = new Set();
  for (const action of Object.keys(BIND_DEFAULTS)) {
    const code = out[action];
    if (!code || used.has(code)) return null;
    used.add(code);
  }
  return out;
}
