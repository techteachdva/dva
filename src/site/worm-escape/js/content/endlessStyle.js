/**
 * Visual + difficulty layering for ENDLESS worm runs (after first win unlock).
 * `game.wormTier` is 1..6 — current nested-worm palette & danger band.
 */

import { COLORS } from "../engine/render.js";

const TIER_TINT_MUL = [1, 1, 1.02, 1.03, 0.96, 0.94, 0.93];

/** Per-tier flesh palette overlays (mostly background wash). Enemy tint is css filter on sprites. */
const TIER_BACKGROUND = [
  null,
  null,
  {
    deep: "#2a0608",
    mid: "#661010",
    bruise: "rgba(255, 120, 60, 0.16)",
    bump: "rgba(255, 200, 100, 0.12)",
  },
  {
    deep: "#080a26",
    mid: "#143070",
    bruise: "rgba(240, 60, 50, 0.15)",
    bump: "rgba(255, 100, 90, 0.12)",
  },
  {
    deep: "#042010",
    mid: "#206030",
    bruise: "rgba(170, 60, 200, 0.14)",
    bump: "rgba(200, 120, 255, 0.12)",
  },
  {
    deep: "#332a06",
    mid: "#887010",
    bruise: "rgba(120, 150, 255, 0.14)",
    bump: "rgba(255, 230, 80, 0.14)",
  },
  {
    deep: "#1a1a1a",
    mid: "#4a5055",
    bruise: "rgba(255, 140, 40, 0.12)",
    bump: "rgba(255, 180, 100, 0.10)",
  },
];

const TIER_ENEMY_FILTER = [
  "",
  "",
  "hue-rotate(68deg) saturate(1.45) brightness(1.08)",
  "hue-rotate(-18deg) saturate(1.5) brightness(1.06)",
  "hue-rotate(95deg) saturate(1.35) brightness(1.05)",
  "hue-rotate(168deg) saturate(1.4) brightness(1.06)",
  "sepia(0.55) saturate(1.85) hue-rotate(-12deg) contrast(1.08)",
];

export function currentWormTier(game) {
  const t = game?.wormTier ?? 1;
  return Math.max(1, Math.min(6, t));
}

export function endlessActive(game) {
  return !!(game?.endlessMode && game?.wormTier >= 1);
}

/** Incoming damage / enemy HP multiplier for endless layers. */
export function endlessDangerMult(game) {
  if (!game?.endlessMode) return 1;
  const tier = currentWormTier(game);
  return 1 + (tier - 1) * 0.185;
}

/**
 * Palette passed to drawFleshBackground: merges worm tier dye with chamber base.
 */
export function resolveEndlessPalette(game, chamberPalette, wormTint) {
  const tier = currentWormTier(game);
  if (!game?.endlessMode || tier <= 1 || !chamberPalette) {
    const mul = endlessActive(game)
      ? (TIER_TINT_MUL[tier] ?? 1) * wormTint
      : wormTint;
    return { palette: chamberPalette, wormTint: mul };
  }

  const ov = TIER_BACKGROUND[tier];
  if (!ov) return { palette: chamberPalette, wormTint: wormTint * (TIER_TINT_MUL[tier] ?? 1) };

  return {
    palette: {
      deep: ov.deep,
      mid: ov.mid ?? chamberPalette.mid,
      bruise: ov.bruise ?? chamberPalette.bruise,
      bump: ov.bump ?? chamberPalette.bump,
    },
    wormTint: wormTint * (TIER_TINT_MUL[tier] ?? 1),
  };
}

export function endlessEnemyCssFilter(game) {
  if (!game?.endlessMode) return "";
  const f = TIER_ENEMY_FILTER[currentWormTier(game)];
  return f || "";
}

export function healPlayerBetweenEndlessLoops(p) {
  if (!p) return;
  p.hp = p.hpMax;
  p.mana = p.manaMax;
  if (p.armorMax > 0) p.armor = p.armorMax;
  p.tankHitsLeft = p.tankHitsMax;
  if (typeof p.acidTimer === "number" && typeof p.acidTimerMax === "number") {
    p.acidTimer = p.acidTimerMax;
  }
  if (p.cooldowns) {
    p.cooldowns.attack = 0;
    p.cooldowns.special = 0;
    if (p.cooldowns.tertiary !== undefined) p.cooldowns.tertiary = 0;
  }
}

export const ENDLESS_LOOP_MESSAGE =
  'Oh no! Apparently That Worm was INSIDE another bigger Worm. Oh well, nowhere to go now but up again!';

export const ENDLESS_RECURSION_SENTENCE =
  "The Worm Was inside another worm, inside another worm, inside another worm, inside another worm";
