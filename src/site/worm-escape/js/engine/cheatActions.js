import { CHAMBERS } from "../content/chambers.js";
import { makePlayer } from "../content/player.js";
import { loadSave, saveGame } from "./storage.js";
import { TongueBossScene } from "../scenes/tongueBoss.js";
import { EncyclopediaScene } from "../scenes/encyclopedia.js";

export function jumpToFinalBossFight(game) {
  const mawIdx = CHAMBERS.findIndex((c) => c.isMaw);
  if (mawIdx < 0) return { ok: false, msg: "No Maw chamber in data." };

  const p = makePlayer("swift", "sword", game);
  p.hp = p.hpMax;
  p.mana = p.manaMax;
  if (p.armorMax > 0) p.armor = p.armorMax;
  p.tankHitsLeft = p.tankHitsMax;
  game.player = p;
  game.chamberIndex = mawIdx;
  game.scenes.replace(new TongueBossScene(mawIdx), game);
  game.cheatMenuOpen = false;
  return { ok: true, msg: "Dropped into THE MAW." };
}

/**
 * Applies a cheat line typed in the cheat overlay. Mutates save / game flags.
 */
export function applyCheatLine(rawLine, game) {
  const c = rawLine.trim().toLowerCase();
  if (!c) return { ok: false, msg: "Empty." };

  if (c === "jackson") {
    const save = loadSave();
    save.unlocks.necromancerBuild = true;
    saveGame(save);
    game.cheatSaveRefresh = true;
    return { ok: true, msg: "Jackson — NECROMANCER unlocked (forge)." };
  }
  if (c === "dez") {
    game.pickAnyWeapon = true;
    return { ok: true, msg: "Dez — full weapon shuffle at forge (DEZ)." };
  }
  if (c === "acererack") {
    game.invulnerable = !game.invulnerable;
    return {
      ok: true,
      msg: game.invulnerable ? "Acererack — invulnerability ON." : "Acererack — invulnerability OFF.",
    };
  }
  if (c === "bossnow") {
    return jumpToFinalBossFight(game);
  }

  if (c === "loredump") {
    if (game.scenes?.current instanceof EncyclopediaScene) {
      return { ok: false, msg: "Codex already hogging screen — ESC to close first." };
    }
    game.scenes.push(new EncyclopediaScene(), game);
    return { ok: true, msg: "THE INNER GUTS CODEX is opening nerd." };
  }

  return { ok: false, msg: `Unknown cheat: "${c}".` };
}
