import { markCheatKnownInSave } from "../content/cheatsKnowledge.js";
import { clearPinkFloydTrail } from "./pinkFloydVfx.js";
import { loadSave, saveGame } from "./storage.js";
import { TongueBossScene } from "../scenes/tongueBoss.js";
import { EncyclopediaScene } from "../scenes/encyclopedia.js";
import { CreateScene } from "../scenes/create.js";
import {
  findMawChamberIndex,
  preparePlayerForMawCheatDrop,
} from "./mawCheatWarp.js";

/** Typing a cheat successfully also bookmarks its Inner Guts Codex dossier. */
function revealCheatDossierIfNew(game, cheatId) {
  if (!game) return;
  const save = loadSave();
  if (!markCheatKnownInSave(save, cheatId)) return;
  saveGame(save);
  game.cheatSaveRefresh = true;
}

export function jumpToSixthLayerMawBoss(game) {
  const mawIdx = findMawChamberIndex();
  if (mawIdx < 0) return { ok: false, msg: "No Maw chamber in data." };

  if (!game.player) {
    game.pendingMawCheat = "gygax";
    game.scenes.replace(new CreateScene(), game);
    game.cheatMenuOpen = false;
    revealCheatDossierIfNew(game, "gygax");
    return {
      ok: true,
      msg: "Gygax queued — forge your hero; you wake in THE MAW (layer 6).",
    };
  }

  const p = game.player;
  preparePlayerForMawCheatDrop(p);
  game.chamberIndex = mawIdx;
  game.endlessMode = true;
  game.wormTier = 6;
  game.scenes.replace(new TongueBossScene(mawIdx), game);
  game.cheatMenuOpen = false;
  revealCheatDossierIfNew(game, "gygax");
  return { ok: true, msg: "Gygax — THE MAW · worm layer 6 (your hero)." };
}

export function jumpToFinalBossFight(game) {
  const mawIdx = findMawChamberIndex();
  if (mawIdx < 0) return { ok: false, msg: "No Maw chamber in data." };

  if (!game.player) {
    game.pendingMawCheat = "bossnow";
    game.scenes.replace(new CreateScene(), game);
    game.cheatMenuOpen = false;
    revealCheatDossierIfNew(game, "bossnow");
    return {
      ok: true,
      msg: "BOSSNOW queued — forge your hero, then dropped into THE MAW.",
    };
  }

  const p = game.player;
  preparePlayerForMawCheatDrop(p);
  game.chamberIndex = mawIdx;
  game.endlessMode = false;
  game.wormTier = 1;
  game.scenes.replace(new TongueBossScene(mawIdx), game);
  game.cheatMenuOpen = false;
  revealCheatDossierIfNew(game, "bossnow");
  return { ok: true, msg: "Dropped into THE MAW (your hero)." };
}

/**
 * Applies a cheat line typed in the cheat overlay. Mutates save / game flags.
 */
export function applyCheatLine(rawLine, game) {
  const c = rawLine.trim().toLowerCase();
  if (!c) return { ok: false, msg: "Empty." };

  if (c === "nocheats") {
    game.invulnerable = false;
    game.easyMode = false;
    game.hardMode = false;
    game.ultraHardMode = false;
    game.dealzPacts = false;
    game.jillyMode = false;
    game.bubblegumMode = false;
    game.rowanWeirdWeapons = false;
    game.lemonBoost = false;
    game.pickAnyWeapon = false;
    game.pinkFloydMode = false;
    clearPinkFloydTrail(game);
    game.pendingMawCheat = null;
    revealCheatDossierIfNew(game, "nocheats");
    return {
      ok: true,
      msg: "Nocheats — runtime cheat toggles cleared (Jackson NECROMANCER unlock in save is untouched).",
    };
  }

  if (c === "mrphil") {
    game.pickAnyWeapon = true;
    game.easyMode = true;
    game.hardMode = false;
    game.ultraHardMode = false;
    game.jillyMode = true;
    game.bubblegumMode = true;
    game.rowanWeirdWeapons = true;
    game.lemonBoost = true;
    game.invulnerable = false;
    game.pinkFloydMode = true;
    revealCheatDossierIfNew(game, "mrphil");
    return {
      ok: true,
      msg:
        "MrPhil — wyrm bias, jilly climb rates, bubblegum, rowan forge, lemon climb, dez browse, pinkfloyd trip (no bossnow/gygax).",
    };
  }

  if (c === "pinkfloyd") {
    game.pinkFloydMode = !game.pinkFloydMode;
    if (!game.pinkFloydMode) clearPinkFloydTrail(game);
    revealCheatDossierIfNew(game, "pinkfloyd");
    return {
      ok: true,
      msg: game.pinkFloydMode
        ? "Pink Floyd — ultra trip: trails, edge bursts, sparkles, rainbow UI, canvas warp & soak ON."
        : "Pink Floyd — psychedelic visuals OFF.",
    };
  }

  if (c === "jackson") {
    const save = loadSave();
    save.unlocks.necromancerBuild = true;
    markCheatKnownInSave(save, "jackson");
    saveGame(save);
    game.cheatSaveRefresh = true;
    return { ok: true, msg: "Jackson — NECROMANCER unlocked (forge)." };
  }
  if (c === "dez") {
    game.pickAnyWeapon = true;
    revealCheatDossierIfNew(game, "dez");
    return { ok: true, msg: "Dez — full weapon shuffle at forge (DEZ)." };
  }
  if (c === "acererack") {
    game.invulnerable = !game.invulnerable;
    const on = !!game.invulnerable;
    const p = game.player;
    if (on && p?.score) p.score.usedAcerCheat = true;
    revealCheatDossierIfNew(game, "acererack");
    return {
      ok: true,
      msg: on
        ? "Acererack — invulnerability ON (−1,000,000 final score)."
        : "Acererack — invulnerability OFF.",
    };
  }
  if (c === "gygax") {
    return jumpToSixthLayerMawBoss(game);
  }
  if (c === "bossnow") {
    return jumpToFinalBossFight(game);
  }

  if (c === "lore" || c === "loredump") {
    if (game.scenes?.current instanceof EncyclopediaScene) {
      return { ok: false, msg: "Codex already hogging screen — ESC to close first." };
    }
    revealCheatDossierIfNew(game, "lore");
    game.scenes.push(new EncyclopediaScene(), game);
    return { ok: true, msg: "THE INNER GUTS CODEX is opening nerd." };
  }

  if (c === "wyrm") {
    game.easyMode = !game.easyMode;
    if (game.easyMode) {
      game.hardMode = false;
      game.ultraHardMode = false;
    }
    revealCheatDossierIfNew(game, "wyrm");
    return {
      ok: true,
      msg: game.easyMode ? "Wyrm — EASY bias ON (incoming dmg & bile softened; guardians thinner)." : "Wyrm — easy bias OFF.",
    };
  }
  if (c === "dragon") {
    game.hardMode = !game.hardMode;
    if (game.hardMode) {
      game.easyMode = false;
      game.ultraHardMode = false;
    }
    revealCheatDossierIfNew(game, "dragon");
    return {
      ok: true,
      msg: game.hardMode ? "Dragon — HARD bias ON (more pain, bile, beefier guardians)." : "Dragon — hard bias OFF.",
    };
  }
  if (c === "dealz") {
    game.dealzPacts = !game.dealzPacts;
    revealCheatDossierIfNew(game, "dealz");
    return {
      ok: true,
      msg: game.dealzPacts
        ? "Dealz — pact screen lists EVERY upgradable seal (paged)."
        : "Dealz — normal random pact offers restored.",
    };
  }
  if (c === "greatwyrm") {
    game.ultraHardMode = !game.ultraHardMode;
    if (game.ultraHardMode) {
      game.easyMode = false;
      game.hardMode = false;
    }
    revealCheatDossierIfNew(game, "greatwyrm");
    return {
      ok: true,
      msg: game.ultraHardMode
        ? "Greatwyrm — ANCIENT WORM ON (double classic lap, cruel cadence, debris storm)."
        : "Greatwyrm — ultra bias OFF.",
    };
  }
  if (c === "jilly") {
    game.jillyMode = !game.jillyMode;
    revealCheatDossierIfNew(game, "jilly");
    return {
      ok: true,
      msg: game.jillyMode
        ? "Jilly — climb swaps hazard vs power-up spawn rates (telegraphs still match the real drop)."
        : "Jilly — swapped climb rates OFF.",
    };
  }
  if (c === "bubblegum") {
    game.bubblegumMode = !game.bubblegumMode;
    revealCheatDossierIfNew(game, "bubblegum");
    return {
      ok: true,
      msg: game.bubblegumMode
        ? "Bubblegum — two guardians per valve, then four pact seals (3-cards each)."
        : "Bubblegum — doubled guardians OFF.",
    };
  }
  if (c === "rowan") {
    game.rowanWeirdWeapons = !game.rowanWeirdWeapons;
    revealCheatDossierIfNew(game, "rowan");
    return {
      ok: true,
      msg: game.rowanWeirdWeapons
        ? "Rowan — forge only ROWDY gear (no swords / spears / plain staves)."
        : "Rowan — normal weapon tables restored.",
    };
  }
  if (c === "lemon") {
    game.lemonBoost = !game.lemonBoost;
    revealCheatDossierIfNew(game, "lemon");
    return {
      ok: true,
      msg: game.lemonBoost
        ? "Lemon — climb speed multiplier +0.25 on new heroes forged after this toggles ON."
        : "Lemon — sour speed bonus OFF.",
    };
  }

  return { ok: false, msg: `Unknown cheat: "${c}".` };
}
