/**
 * Rebindable gameplay controls. Movement stays on WASD / arrows; everything
 * else can be remapped from the pause menu and persists in settings.
 */

/** @typedef {'interact'|'throw'|'eatCheetos'|'drinkSoda'|'reloadBattery'|'shootAntivirus'|'light'|'cycleItem'|'crouch'} BindAction */

export const BIND_DEFAULTS = {
  eatCheetos: 'KeyC',
  drinkSoda: 'KeyV',
  reloadBattery: 'KeyB',
  shootAntivirus: 'KeyN',
  crouch: 'KeyZ',
  throw: 'KeyE',
  light: 'KeyF',
  interact: 'Enter',
  cycleItem: 'KeyQ',
};

export const BIND_LABELS = {
  eatCheetos: 'Eat hot cheetos',
  drinkSoda: 'Drink V67 soda',
  reloadBattery: 'Change battery',
  shootAntivirus: 'Shoot Norgin anti-virus',
  crouch: 'Crouch',
  throw: 'Throw hot cheetos',
  light: 'Flashlight',
  interact: 'Use computer, door, or printer',
  cycleItem: 'Switch item',
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
  KeyV: 'V',
  KeyB: 'B',
  KeyN: 'N',
  KeyZ: 'Z',
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
  const saved = raw && typeof raw === 'object' ? raw : {};
  const out = { ...BIND_DEFAULTS, ...saved };
  // Older saves used C to crouch and R to eat, and had no soda or battery key.
  if (!saved.drinkSoda && !saved.reloadBattery) {
    out.crouch = BIND_DEFAULTS.crouch;
    out.eatCheetos = BIND_DEFAULTS.eatCheetos;
    out.drinkSoda = BIND_DEFAULTS.drinkSoda;
    out.reloadBattery = BIND_DEFAULTS.reloadBattery;
  }
  return out;
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
