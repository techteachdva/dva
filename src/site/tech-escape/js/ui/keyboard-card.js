/**
 * A real QWERTY keyboard. Only the keys this game uses are lit, in the same
 * places they sit on the keyboard in front of the player.
 */

import { normalizeBinds } from '../meta/binds.js?v=3.25';

const ROWS = [
  ['Escape', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0', 'Minus', 'Equal', 'Backspace'],
  ['Tab', 'KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI', 'KeyO', 'KeyP', 'BracketLeft', 'BracketRight', 'Backslash'],
  ['CapsLock', 'KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon', 'Quote', 'Enter'],
  ['ShiftLeft', 'KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyM', 'Comma', 'Period', 'Slash', 'ShiftRight'],
  ['ControlLeft', 'MetaLeft', 'AltLeft', 'Space', 'AltRight', 'ControlRight'],
];

const GLYPH = {
  Escape: 'esc',
  Digit1: '1', Digit2: '2', Digit3: '3', Digit4: '4', Digit5: '5',
  Digit6: '6', Digit7: '7', Digit8: '8', Digit9: '9', Digit0: '0',
  Minus: '-', Equal: '=', Backspace: 'bksp',
  Tab: 'tab',
  KeyQ: 'Q', KeyW: 'W', KeyE: 'E', KeyR: 'R', KeyT: 'T', KeyY: 'Y',
  KeyU: 'U', KeyI: 'I', KeyO: 'O', KeyP: 'P',
  BracketLeft: '[', BracketRight: ']', Backslash: '\\',
  CapsLock: 'caps',
  KeyA: 'A', KeyS: 'S', KeyD: 'D', KeyF: 'F', KeyG: 'G', KeyH: 'H',
  KeyJ: 'J', KeyK: 'K', KeyL: 'L', Semicolon: ';', Quote: "'",
  Enter: 'enter',
  ShiftLeft: 'shift', ShiftRight: 'shift',
  KeyZ: 'Z', KeyX: 'X', KeyC: 'C', KeyV: 'V', KeyB: 'B',
  KeyN: 'N', KeyM: 'M', Comma: ',', Period: '.', Slash: '/',
  ControlLeft: 'ctrl', ControlRight: 'ctrl',
  MetaLeft: 'win', AltLeft: 'alt', AltRight: 'alt',
  Space: '',
};

const SIZE = {
  Backspace: 'w2', Tab: 'w15', Backslash: 'w15',
  CapsLock: 'w18', Enter: 'w2',
  ShiftLeft: 'w23', ShiftRight: 'w28',
  ControlLeft: 'w13', ControlRight: 'w13',
  MetaLeft: 'w13', AltLeft: 'w13', AltRight: 'w13',
  Space: 'space',
};

function mark(map, code, role, word) {
  if (!code || map.has(code)) return;
  map.set(code, { role, word });
}

export function renderControlsKeyboard(rawBinds) {
  const binds = normalizeBinds(rawBinds);
  const roles = new Map();
  mark(roles, 'KeyW', 'move', 'walk');
  mark(roles, 'KeyA', 'move', 'walk');
  mark(roles, 'KeyS', 'move', 'walk');
  mark(roles, 'KeyD', 'move', 'walk');
  mark(roles, 'ShiftLeft', 'move', 'sprint');
  mark(roles, 'ShiftRight', 'move', 'sprint');
  mark(roles, 'Space', 'move', 'climb');
  mark(roles, binds.crouch, 'move', 'crouch');
  mark(roles, binds.eatCheetos, 'item', 'cheetos');
  mark(roles, binds.drinkSoda, 'item', 'soda');
  mark(roles, binds.reloadBattery, 'item', 'battery');
  mark(roles, binds.shootAntivirus, 'item', 'norgin');
  mark(roles, binds.throw, 'act', 'throw');
  mark(roles, binds.light, 'act', 'light');
  mark(roles, binds.interact, 'act', 'use');

  const rows = ROWS.map((row) => {
    const keys = row.map((code) => {
      const hit = roles.get(code);
      const size = SIZE[code] || '';
      const on = hit ? ` is-on is-${hit.role}` : '';
      const word = hit && hit.word ? `<i>${hit.word}</i>` : '';
      return `<span class="kb-key ${size}${on}"><b>${GLYPH[code] || ''}</b>${word}</span>`;
    }).join('');
    return `<div class="kb-row">${keys}</div>`;
  }).join('');

  return `
    <div class="kb-sheet">
      <div class="kb-board" role="img" aria-label="Keyboard. Lit keys: walk, look, sprint, climb, crouch, cheetos, soda, battery, norgin, throw, flashlight, use.">
        ${rows}
      </div>
      <div class="kb-mouse" aria-hidden="true">
        <span class="kb-mouse-body"><span class="kb-mouse-arrow"></span></span>
        <span class="kb-mouse-word">look</span>
      </div>
    </div>`;
}
