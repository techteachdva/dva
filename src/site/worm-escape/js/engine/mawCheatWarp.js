import { CHAMBERS } from "../content/chambers.js";
import { TongueBossScene } from "../scenes/tongueBoss.js";

/** Below max so Mana Vial mini-game can open (full MP is rejected). */
const MAW_TEST_MANA_FRAC = 0.38;

export function findMawChamberIndex() {
  return CHAMBERS.findIndex((c) => c.isMaw);
}

export function preparePlayerForMawCheatDrop(p) {
  if (!p) return;
  p.hp = p.hpMax;
  if (p.armorMax > 0) p.armor = p.armorMax;
  p.tankHitsLeft = p.tankHitsMax;
  const cap =
    p.manaMax <= 1 ? 0 : Math.min(p.manaMax - 1, Math.floor(p.manaMax * MAW_TEST_MANA_FRAC));
  p.mana = cap;
  if (p.cooldowns) {
    p.cooldowns.attack = 0;
    p.cooldowns.special = 0;
    if (p.cooldowns.tertiary !== undefined) p.cooldowns.tertiary = 0;
  }
}

/**
 * After forge: if `game.pendingMawCheat` is `'gygax'` | `'bossnow'`, heals player,
 * sets finale flags, replaces with THE MAW. Clears pending. Returns whether handled.
 */
export function tryConsumePendingMawCheatAfterForge(game) {
  const k = game.pendingMawCheat;
  if (k !== "gygax" && k !== "bossnow") return false;

  const p = game.player;
  if (!p) return false;
  const mawIdx = findMawChamberIndex();
  if (mawIdx < 0) return false;

  game.pendingMawCheat = null;

  preparePlayerForMawCheatDrop(p);
  if (k === "gygax") {
    game.endlessMode = true;
    game.wormTier = 6;
  } else {
    game.endlessMode = false;
    game.wormTier = 1;
  }
  game.chamberIndex = mawIdx;
  game.scenes.replace(new TongueBossScene(mawIdx), game);
  return true;
}
