/**
 * Room maps are built, not typed: a base grid (walls, firewalls, the data chasm)
 * plus a list of placed items. This keeps every room the same shape to navigate
 * while each one gets its own furniture.
 *
 * Map legend:
 *   #  wall            .  floor          ~  data chasm (a bridge forms across row 7)
 *   M  mentor          T  terminal       G  first firewall     F  second firewall
 *   R  Rotling spawn   N  link node      W  Unknown File       C  room core
 *   H  port to the hub @  arrival        &  checkpoint inside the Rotling zone
 *   a–h  named props (morpheme objects)  o k  generic decor
 *   Lingo Room only: P Chromebook cart · Q 3D printer · Y triangle desks · x blocked tile under big furniture
 *   Hub only: L tree · D desk · A booth · O Overclock cabinet · X compiler · 1 2 3 4 ports
 *
 * Zones (left to right): 0 = lesson zone, 1 = Rotling zone, 2 = core zone.
 */

export const ROOM_W = 24;
export const ROOM_H = 14;
export const CORRIDOR = 7;
export const GATE1_COL = 8;
export const CHASM_COLS = [14, 15];
export const GATE2_COL = 17;

export function buildRoomMap(items, { chasm = true, secondGate = true } = {}) {
  const g = Array.from({ length: ROOM_H }, (_, r) => Array.from({ length: ROOM_W }, (_, c) => (r === 0 || c === 0 || r === ROOM_H - 1 || c === ROOM_W - 1 ? '#' : '.')));
  for (let r = 1; r < ROOM_H - 1; r++) g[r][GATE1_COL] = '#';
  g[CORRIDOR][GATE1_COL] = 'G';
  if (chasm) for (let r = 1; r < ROOM_H - 1; r++) CHASM_COLS.forEach((c) => { g[r][c] = '~'; });
  if (secondGate) {
    for (let r = 1; r < ROOM_H - 1; r++) g[r][GATE2_COL] = '#';
    g[CORRIDOR][GATE2_COL] = 'F';
  }
  g[CORRIDOR][0] = 'H';
  g[CORRIDOR][1] = '@';
  g[CORRIDOR][GATE1_COL + 1] = '&';
  for (const [c, r, ch] of items) {
    if (g[r][c] !== '.') throw new Error(`layout: ${ch} at ${c},${r} lands on "${g[r][c]}"`);
    g[r][c] = ch;
  }
  return g.map((row) => row.join(''));
}

export function zoneOf(c, secondGate = true) {
  if (c < GATE1_COL) return 0;
  if (secondGate && c > GATE2_COL) return 2;
  return 1;
}

export const HUB_W = 20;
export const HUB_H = 14;

export function buildHubMap() {
  const g = Array.from({ length: HUB_H }, (_, r) => Array.from({ length: HUB_W }, (_, c) => (r === 0 || c === 0 || r === HUB_H - 1 || c === HUB_W - 1 ? '#' : '.')));
  const put = (c, r, ch) => { g[r][c] = ch; };
  put(10, 0, '1');
  put(0, 7, '2');
  put(19, 7, '3');
  put(10, 13, '4');
  put(1, 7, '@');
  put(10, 7, 'L');
  put(4, 3, 'X');
  put(15, 3, 'D');
  put(4, 10, 'A');
  put(15, 10, 'O');
  [[2, 1], [17, 1], [2, 12], [17, 12]].forEach(([c, r]) => put(c, r, 'o'));
  return g.map((row) => row.join(''));
}
