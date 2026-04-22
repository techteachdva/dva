// v0.12 Persistent save: localStorage wrapper for high scores and unlocks.
//
// The save blob is tiny (a few bytes) and lives under a single JSON key so we
// can swap schema easily later without colliding with other sites on the
// domain. Every helper here is defensive: if localStorage is unavailable
// (private browsing, old browsers, iframe sandbox) we return in-memory
// defaults and silently no-op on writes, so gameplay is never blocked.

const SAVE_KEY = "wormEscape.save.v1";

// Unlock keys - kept as a flat shape so checks stay trivial.
//   viperBuild : unlocked after the first full run victory.
//   bileWhip   : unlocked after clearing the Gullet climb hitless.
//   hexStaff   : unlocked after defeating any Elite boss.
//   anyElite   : informational flag (used for changelog/unlock text).
const DEFAULT_SAVE = {
  version: 1,
  highScores: [],
  unlocks: {
    viperBuild: false,
    bileWhip:   false,
    hexStaff:   false,
    anyElite:   false,
  },
  stats: {
    runs: 0,
    wins: 0,
    elitesKilled: 0,
    hitlessChambersCleared: 0,
  },
};

// Cheap deep-clone for the default object so callers can mutate freely.
function cloneDefault() {
  return JSON.parse(JSON.stringify(DEFAULT_SAVE));
}

// Detect storage availability once; cache the answer. Some browsers throw
// on merely ACCESSING localStorage (e.g. iframe + cookies blocked).
let _available = null;
function storageAvailable() {
  if (_available !== null) return _available;
  try {
    const probeKey = "__wormProbe__";
    window.localStorage.setItem(probeKey, "1");
    window.localStorage.removeItem(probeKey);
    _available = true;
  } catch (e) {
    _available = false;
  }
  return _available;
}

export function loadSave() {
  if (!storageAvailable()) return cloneDefault();
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return cloneDefault();
    const parsed = JSON.parse(raw);
    // Merge with defaults so new fields don't crash old saves.
    const base = cloneDefault();
    return {
      ...base,
      ...parsed,
      unlocks: { ...base.unlocks, ...(parsed.unlocks || {}) },
      stats:   { ...base.stats,   ...(parsed.stats   || {}) },
      highScores: Array.isArray(parsed.highScores) ? parsed.highScores : [],
    };
  } catch (e) {
    return cloneDefault();
  }
}

export function saveGame(save) {
  if (!storageAvailable()) return false;
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    return true;
  } catch (e) {
    return false;
  }
}

// Record a completed run (win OR loss). `result` is:
//   {
//     win:             boolean,
//     score:           number,
//     rank:            string,      // e.g. "S+"
//     buildId:         string,
//     loadoutId:       string,
//     chambersCleared: number,
//     hitlessChambers: number,      // count of chambers cleared without taking a hit
//     gullethitless:   boolean,     // specifically the Gullet climb cleared hitless
//     elitesKilled:    number,
//   }
// Returns { save, newUnlocks: [...] } so callers can surface a NEW! banner.
export function recordRun(save, result) {
  if (!save) save = cloneDefault();
  const newUnlocks = [];

  save.stats.runs = (save.stats.runs || 0) + 1;
  if (result.win) save.stats.wins = (save.stats.wins || 0) + 1;
  save.stats.elitesKilled = (save.stats.elitesKilled || 0) + (result.elitesKilled || 0);
  save.stats.hitlessChambersCleared =
    (save.stats.hitlessChambersCleared || 0) + (result.hitlessChambers || 0);

  // Insert into the high-score table if the run qualifies.
  const entry = {
    score:           Math.max(0, Math.floor(result.score || 0)),
    rank:            result.rank || "-",
    buildId:         result.buildId,
    loadoutId:       result.loadoutId,
    chambersCleared: result.chambersCleared || 0,
    win:             !!result.win,
    date:            new Date().toISOString().slice(0, 10), // YYYY-MM-DD
  };
  save.highScores.push(entry);
  save.highScores.sort((a, b) => b.score - a.score);
  save.highScores = save.highScores.slice(0, 5);

  // Unlocks - one-shot; only flag as "new" the first time each is triggered.
  if (result.win && !save.unlocks.viperBuild) {
    save.unlocks.viperBuild = true;
    newUnlocks.push({ id: "viperBuild", label: "NEW BUILD: VIPER unlocked!" });
  }
  if (result.gullethitless && !save.unlocks.bileWhip) {
    save.unlocks.bileWhip = true;
    newUnlocks.push({ id: "bileWhip", label: "NEW WEAPON: BILE WHIP unlocked!" });
  }
  if ((result.elitesKilled || 0) > 0) {
    if (!save.unlocks.anyElite) save.unlocks.anyElite = true;
    if (!save.unlocks.hexStaff) {
      save.unlocks.hexStaff = true;
      newUnlocks.push({ id: "hexStaff", label: "NEW WEAPON: HEX STAFF unlocked!" });
    }
  }

  saveGame(save);
  return { save, newUnlocks, entry };
}

// Find the index of `entry` in `save.highScores` (or -1). Useful for the
// victory screen's "NEW TOP RUN!" indicator.
export function findScoreRank(save, entry) {
  if (!save || !Array.isArray(save.highScores)) return -1;
  return save.highScores.findIndex((e) =>
    e.score === entry.score &&
    e.date === entry.date &&
    e.buildId === entry.buildId &&
    e.loadoutId === entry.loadoutId
  );
}
