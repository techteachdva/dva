// Inner Guts Codex cheat dossiers — random id on each VICTORY, plus keypad `markCheatKnownInSave`.

export const ALL_CHEAT_IDS = [
  "jackson",
  "dez",
  "acererack",
  "gygax",
  "bossnow",
  "lore",
  "wyrm",
  "dragon",
  "greatwyrm",
  "jilly",
  "bubblegum",
  "rowan",
  "lemon",
  "nocheats",
  "pinkfloyd",
  "mrphil",
];

/**
 * Marks a cheat dossier as known for the Inner Guts Codex (mutates `save` in place).
 * @returns {boolean} true if `knownCheats` changed.
 */
export function markCheatKnownInSave(save, cheatId) {
  if (!save || typeof cheatId !== "string") return false;
  if (!ALL_CHEAT_IDS.includes(cheatId)) return false;
  const cur = Array.isArray(save.knownCheats) ? save.knownCheats : [];
  if (cur.includes(cheatId)) return false;
  save.knownCheats = [...cur, cheatId];
  return true;
}

/** @type {Record<string, { code: string, title: string, facts: string[], flavor: string }>} */
export const CHEAT_CODEX_DETAILS = {
  jackson: {
    code: "jackson",
    title: "Jackson",
    facts: [
      "Unlocks NECROMANCER in the forge (persists in save).",
      "Does not require beating the game.",
      "No automatic score row for jackson alone — pick NECROMANCER and play like any other class unless other cheats are ON.",
    ],
    flavor: "They say he left a rib in every dungeon. The worm found three.",
  },
  dez: {
    code: "dez",
    title: "Dez",
    facts: [
      "Next forge session uses the full weapon pool (DEZ browse).",
      "Toggle again does nothing special — re-forge to use it.",
      "If pick-any forge is ON when you finish the run: −2400 on Victory / Game Over score (same bucket as MrPhil’s forge browse).",
    ],
    flavor: "Inventory goblin energy. Smells like rerolls and hubris.",
  },
  acererack: {
    code: "acererack",
    title: "Acererack",
    facts: [
      "Toggles invulnerability to damage, acid, bile, and corrosion ticks.",
      "First time you turn it ON this run: −1,000,000 on final score (win or loss tally) — separate from the smaller rows in engine/cheatScore.js.",
    ],
    flavor: "Lich king of nope. The scoreboard still remembers you cheated.",
  },
  gygax: {
    code: "gygax",
    title: "Gygax",
    facts: [
      "Drops you into THE MAW at worm layer 6 (Endless palette + scaling) for testing.",
      "Builds a fresh Swift + sword test hero.",
      "No dedicated score row for gygax alone — only the usual cheat flags (wyrm, pinkfloyd, etc.) add lines if they are ON at run end.",
    ],
    flavor: "Roll for initiative vs five molars. Nat 1 still hurts.",
  },
  bossnow: {
    code: "bossnow",
    title: "Bossnow",
    facts: [
      "Warps to THE MAW finale with a test Swift + sword hero.",
      "Clears Endless-layer flags first so pacing matches a normal cheat drop.",
      "No dedicated score row for bossnow alone — other toggles still apply if left ON (see Codex Mechanics / Cheat keypad).",
    ],
    flavor: "Speedrunner cosplay. Teeth applaud your impatience.",
  },
  lore: {
    code: "lore",
    title: "Lore / Loredump",
    facts: [
      "Opens the Inner Guts Codex overlay (aliases: lore, loredump).",
      "Same shelf as the title-screen Codex button — now with cheat dossiers.",
      "No score impact — pure UI. Mechanics tab documents pact ranks and cheat score rows.",
    ],
    flavor: "Meta-reading the manual while inside the appendix.",
  },
  wyrm: {
    code: "wyrm",
    title: "Wyrm",
    facts: [
      "Easier bias: incoming damage ×0.5, bile/acid chewing ×0.5, guardians & MAW molars ×0.5 HP.",
      "Mutually exclusive with dragon / greatwyrm. Toggle to OFF.",
      "If easy bias is ON at run end: −3400 on Victory / Game Over score.",
    ],
    flavor: "Baby’s first parasite. Almost polite.",
  },
  dragon: {
    code: "dragon",
    title: "Dragon",
    facts: [
      "Hard bias: incoming damage ×2, bile/armor-chewing ×2, guardians & molars ×2 HP.",
      "Mutually exclusive with wyrm / greatwyrm. Toggle OFF from the keypad.",
      "If hard bias is ON at run end: +2600 on Victory / Game Over score.",
    ],
    flavor: "Soulsborne but the hollow is a esophagus.",
  },
  greatwyrm: {
    code: "greatwyrm",
    title: "Greatwyrm",
    facts: [
      "Ancient Worm bias: same incoming/enemy HP scaling as Dragon, plus cruel climb cadence, faster debris cycles, and you must clear the full worm TWICE before victory.",
      "Mutually exclusive with wyrm / dragon.",
      "Greatwyrm ON at run end: +4200 score bonus (see cheatScore.js).",
    ],
    flavor: "The worm wears a worm. Time doubles; mercy does not.",
  },
  jilly: {
    code: "jilly",
    title: "Jilly",
    facts: [
      "Climbing only: the roll for “power-up vs hazard” uses (1 − chamber power-up chance) instead of the normal chance.",
      "Telegraph color and falling art still match the real effect — only spawn frequencies swap.",
      "If Jilly is ON at run end: −2100 on Victory / Game Over score.",
    ],
    flavor: "The worm serves a balanced diet; Jilly swaps the kitchen’s portion sizes.",
  },
  bubblegum: {
    code: "bubblegum",
    title: "Bubblegum",
    facts: [
      "Each sphincter climb: TWO guardian fights back-to-back — beat the first (normal colors), then DOUBLE TROUBLE, then a hue-twisted twin with an inverted palette.",
      "THE MAW stays a single showdown (bubble doesn’t twin the finale).",
      "After both falls: four separate 3-card pact seals (elite 4-card reward is suppressed).",
      "If Bubblegum is ON at run end: −2800 on Victory / Game Over score (extra pacts & twin fights).",
    ],
    flavor: "Stretchy. Sticky. Unfair negotiation practice.",
  },
  rowan: {
    code: "rowan",
    title: "Rowan",
    facts: [
      "Forge step 2 only offers “weird” loadouts — pans, chairs, megaphones, chainsaws, cats, sci‑fi toys, bile whips, etc.",
      "Ban list: swords, sabers, spears (bone spear), fists, club, hammer, Ember/Frost staffs, Hex staff.",
      "If Rowan is ON at run end: −900 on Victory / Game Over score.",
    ],
    flavor: "No boring pointy sticks. If it belongs in a kitchen, toolbox, circus, or lab, Rowan approved.",
  },
  lemon: {
    code: "lemon",
    title: "Lemon",
    facts: [
      "Adds +0.25 to the hero’s climb speed multiplier when `makePlayer` runs (chairs / void multipliers stack first).",
      "Does not shorten hop cooldowns or combat lane swaps — wall climb pacing only.",
      "Toggle OFF from the keypad; re-forge mid-run cheats for test heroes.",
      "If Lemon is ON at run end: −700 on Victory / Game Over score.",
    ],
    flavor: "Pucker up — the bile tide still rises, but your boots taste faster.",
  },
  nocheats: {
    code: "nocheats",
    title: "Nocheats",
    facts: [
      "Clears runtime cheat flags: wyrm/dragon, jilly, bubblegum, rowan, lemon, dez browse, invulnerability, pinkfloyd, pending Maw warps.",
      "Does not remove NECROMANCER or other permanent save unlocks.",
      "Clears the runtime flags that add Victory / Game Over score rows (cheatScore.js); use before finishing if you want a clean tally (Acererack’s −1M surcharge still sticks if it was already flagged on the player).",
    ],
    flavor: "Hard reset on the fun dial — the worm pretends it never saw the fine print.",
  },
  pinkfloyd: {
    code: "pinkfloyd",
    title: "Pink Floyd",
    facts: [
      "Skewed flesh backdrop, rainbow veins & bile, stronger screen washes (screen / soft-light / color-dodge / overlay sweeps).",
      "Rainbow chroma on most UI text, panels, and HP bars; combat action tiles get a double neon stroke.",
      "Motion trails follow the hero in climb, sphincter combat, and THE MAW; sparkles + edge starbursts layer on top.",
      "The whole canvas gets a slow hue-rotate + saturate + micro-skew filter (disabled while \\ cheat terminal is open for readability).",
      "If Pink Floyd visuals are ON at run end: +1700 on Victory / Game Over score (difficulty-style bonus).",
    ],
    flavor: "Comfortably numb is not on the playlist. The playlist is the worm.",
  },
  mrphil: {
    code: "mrphil",
    title: "MrPhil",
    facts: [
      "One-shot: enables wyrm-style easy bias, jilly climb rate swap, bubblegum, rowan forge, lemon, dez browse, and pinkfloyd visuals.",
      "Does not run bossnow, gygax, jackson, acererack, or lore — forge / play normally after typing.",
      "Score rows stack from cheatScore.js if all of that stays ON: easy forge −2400, Pink Floyd +1700, Jilly −2100, Bubblegum −2800, Wyrm −3400, Rowan −900, Lemon −700 (net is still heavily negative).",
    ],
    flavor: "Maximum chaos, minimum paperwork — leave the DM screen at home.",
  },
};

/**
 * @param {object} save merged save object from loadSave()
 * @returns {string|null} new cheat id unlocked, or null if all known / no save
 */
export function grantRandomCheatKnowledge(save) {
  if (!save) return null;
  const known = Array.isArray(save.knownCheats) ? save.knownCheats : [];
  const set = new Set(known);
  const pool = ALL_CHEAT_IDS.filter((id) => !set.has(id));
  if (pool.length === 0) return null;
  const pick = pool[Math.floor(Math.random() * pool.length)];
  known.push(pick);
  save.knownCheats = known;
  return pick;
}

/**
 * Builds codex rows for the Cheats category. Unknown entries show locked blurbs.
 * @param {string[]} knownCheats
 */
export function buildCheatsCodexRows(knownCheats = []) {
  const known = new Set(knownCheats || []);
  /** @type {import("./encyclopediaData.js").CodexEntry[]} */
  const rows = [];

  rows.push({
    id: "cheats:overview",
    category: "cheats",
    title: "Cheats overview",
    subtitle: '\\ key cheat terminal • dossiers unlock on wins… or after you type each code successfully',
    facts: [
      "Type codes in the backslash keypad (see Mechanics / Cheat keypad). Digit7 snaps to CHEATS while browsing tabs.",
      "Each full run WIN reveals one random cheat article here forever.",
      "Successfully typing a cheat in that keypad permanently unlocks THAT cheat’s dossier here.",
      "You can always open this shelf from the title screen.",
    ],
    flavor: "The worm charges tuition in digestion hours; the Codex sells cliff notes.",
  });

  for (const id of ALL_CHEAT_IDS) {
    const def = CHEAT_CODEX_DETAILS[id];
    if (!def) continue;
    const unlocked = known.has(id);
    rows.push({
      id: `cheats:${id}`,
      category: "cheats",
      title: unlocked ? `Cheat • ${def.title}` : "??? cheat phrase",
      subtitle: unlocked
        ? `Type: ${def.code}`
        : "Reveal by winning a run (random), or type the passphrase successfully at \\ cheat terminal.",
      facts: unlocked
        ? def.facts.slice()
        : ["Locked — win for a random reveal, or demonstrate the phrase at \\ keypad."],
      flavor: unlocked ? def.flavor : "Ink won’t settle until destiny drops another name.",
    });
  }

  return rows;
}
