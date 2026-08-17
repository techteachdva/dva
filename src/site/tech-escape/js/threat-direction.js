/**
 * Maps a world-space threat into HUD sectors and stereo pan for damage feedback.
 */

import { clamp } from './util.js';

/** @typedef {'front'|'up'|'down'|'left'|'right'|'up-left'|'up-right'|'down-left'|'down-right'} ThreatSector */

const SECTORS = [
  'front', 'up-right', 'right', 'down-right', 'down', 'down-left', 'left', 'up-left',
];

/**
 * @param {import('./entities/player.js').Player} player
 * @param {number} x
 * @param {number} z
 * @param {number} [y]
 * @returns {ThreatSector}
 */
export function threatSector(player, x, z, y = 0) {
  const dx = x - player.pos.x;
  const dz = z - player.pos.z;
  const dy = y - player.pos.y;
  const horiz = Math.hypot(dx, dz);
  if (horiz < 0.2) return 'front';

  const yaw = player.yaw;
  const forward = (dx * (-Math.sin(yaw)) + dz * (-Math.cos(yaw))) / horiz;
  const right = (dx * Math.cos(yaw) + dz * (-Math.sin(yaw))) / horiz;
  const angle = Math.atan2(right, forward);
  const vert = clamp(dy / Math.max(horiz, 0.35), -1, 1);

  let idx = Math.round(angle / (Math.PI / 4));
  if (idx === 4 || idx === -4) idx = 0;
  idx = ((idx + 8) % 8);

  let sector = SECTORS[idx];
  if (sector === 'front') {
    if (vert > 0.22) sector = 'up';
    else if (vert < -0.22) sector = 'down';
  }
  return sector;
}

/**
 * Stereo pan from player-relative horizontal bearing (-1 left, +1 right).
 * @param {import('./entities/player.js').Player} player
 * @param {number} x
 * @param {number} z
 */
export function threatPan(player, x, z) {
  const dx = x - player.pos.x;
  const dz = z - player.pos.z;
  const horiz = Math.hypot(dx, dz);
  if (horiz < 0.05) return 0;
  const yaw = player.yaw;
  const right = (dx * Math.cos(yaw) + dz * (-Math.sin(yaw))) / horiz;
  return clamp(right * 1.15, -1, 1);
}
