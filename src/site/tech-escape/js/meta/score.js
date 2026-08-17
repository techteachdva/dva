/**
 * Tech Escape run scoring — rewards skillful play, not just survival.
 */

import { CODE_PARTS } from '../config.js';
import { formatTime } from '../util.js';

const DIFF_LABEL = {
  beginner: 'BEGINNER',
  chill: 'FIELD TRIP',
  normal: 'AFTER HOURS',
  nightmare: 'SYSTEM CRASH',
  questions: 'QUESTIONS ONLY',
};

const FLOOR_IDX = {
  lab: 0,
  servers: 1,
  library: 2,
  tunnels: 3,
  mainframe: 4,
};

/**
 * Compute a run score and human-readable breakdown lines.
 * @param {object} world - active run world
 * @param {boolean} escaped
 */
export function computeRunScore(world, escaped) {
  const w = world;
  const stats = w.player?.stats || {};
  const diffKey = w.diff?.key || 'normal';
  const scale = Number(w.diff?.scoreScale) || 1;
  const found = (w.earned || []).filter(Boolean).length;
  const asked = w.questionsAsked || 0;
  const right = w.questionsRight || 0;
  const acc = asked ? right / asked : 0;
  const breakdown = {};
  let raw = 0;

  if (escaped) {
    breakdown.escape = 5000;
    raw += 5000;
    const speedBonus = Math.max(0, Math.round(3500 * (1 - w.runTime / 720)));
    breakdown.speed = speedBonus;
    raw += speedBonus;
  } else {
    const piecePts = found * 450;
    breakdown.pieces = piecePts;
    raw += piecePts;
    const surviveBonus = Math.min(1200, Math.round(w.runTime / 60) * 80);
    breakdown.survival = surviveBonus;
    raw += surviveBonus;
  }

  const firstTryPts = (w.questionsFirstTry || 0) * 280;
  breakdown.firstTry = firstTryPts;
  raw += firstTryPts;

  const accPts = Math.round(acc * 1600);
  breakdown.accuracy = accPts;
  raw += accPts;

  const itemPts = (stats.cheetosEaten || 0) * 45
    + (stats.sodasDrunk || 0) * 40
    + (stats.batteriesFound || 0) * 65
    + (stats.itemsThrown || 0) * 55
    + (stats.micePopped || 0) * 90
    + (stats.virusesKilled || 0) * 220;
  breakdown.items = itemPts;
  raw += itemPts;

  const flashMin = Math.min((stats.flashlightSec || 0) / 60, 10);
  const flashPts = Math.round(flashMin * 85);
  breakdown.flashlight = flashPts;
  raw += flashPts;

  const flipBudget = CODE_PARTS * 4;
  const decryptPts = Math.max(0, (flipBudget - (w.decryptAttempts || 0)) * 35);
  breakdown.decrypt = decryptPts;
  raw += decryptPts;

  const dmgPenalty = Math.round((stats.damageTaken || 0) * 130);
  breakdown.damage = -dmgPenalty;
  raw -= dmgPenalty;

  const floorPts = ((FLOOR_IDX[w.level?.id] ?? 0) + 1) * 180;
  breakdown.floor = floorPts;
  raw += floorPts;

  const score = Math.max(0, Math.round(raw * scale));

  const lines = [
    escaped ? `Escaped (+${breakdown.escape})` : `Code pieces (+${breakdown.pieces || 0})`,
    breakdown.speed ? `Fast escape (+${breakdown.speed})` : null,
    breakdown.survival ? `Time survived (+${breakdown.survival})` : null,
    `First-try answers (+${breakdown.firstTry})`,
    `Accuracy (+${breakdown.accuracy})`,
    breakdown.items ? `Items & combat (+${breakdown.items})` : null,
    breakdown.flashlight ? `Flashlight use (+${breakdown.flashlight})` : null,
    breakdown.decrypt ? `Decrypt efficiency (+${breakdown.decrypt})` : null,
    breakdown.damage ? `Damage taken (−${dmgPenalty})` : 'No damage taken',
    breakdown.floor ? `Floor bonus (+${breakdown.floor})` : null,
    scale !== 1 ? `Difficulty ×${scale.toFixed(2)}` : null,
  ].filter(Boolean);

  return {
    score,
    breakdown,
    lines,
    escaped,
    seconds: Math.round(w.runTime || 0),
    timeLabel: formatTime(w.runTime || 0),
    floor: w.level?.codename || w.level?.name || 'LAB',
    difficulty: w.diff?.label || DIFF_LABEL[diffKey] || diffKey,
    diffKey,
    found,
    accuracyPct: Math.round(acc * 100),
  };
}
