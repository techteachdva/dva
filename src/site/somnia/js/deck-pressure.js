/**
 * Warn before a lose-condition deck runs out.
 * Soft at 10% (fades), critical at 5% (persistent flash), severe at 1% (unstable table).
 */
import {
  LENGTHS,
  BOSS_DREAM_DECK_SLOTS,
  PSYCHE_DECK_SIZE,
  MINDSTREAM_DECK_SIZE,
} from "./data.js";
import { MINDSTREAM_SUIT_IDS, countMindstreamCirculation } from "./mindstream-supply.js";
import { repressCard } from "./subconscious.js";

const SOURCE_IDS = ["dream", "psyche", ...MINDSTREAM_SUIT_IDS];
const TIER_RANK = { soft: 1, critical: 2, severe: 3 };
const LABELS = {
  dream: "the Dream Deck",
  psyche: "the Psyche Deck",
  lucidity: "the Lucidity Mindstream",
  elasticity: "the Elasticity Mindstream",
  willpower: "the Willpower Mindstream",
};
const SOFT_FADE_MS = 8000;
const SOFT_RESET_RATIO = 0.12;

let forcedReadings = null;
let softFadeTimer = null;
let lastSoftSig = "";

export function ensureDeckCaps(state) {
  if (!state) return null;
  const length = LENGTHS[state.lengthKey];
  const fallbackDream = (length?.dreams || 14) + BOSS_DREAM_DECK_SLOTS.length;
  const current = state.deckCaps || {};
  state.deckCaps = {
    dream: current.dream || Math.max(fallbackDream, state.dreamDeck?.length || 0),
    psyche: current.psyche || PSYCHE_DECK_SIZE,
    lucidity: current.lucidity || MINDSTREAM_DECK_SIZE,
    elasticity: current.elasticity || MINDSTREAM_DECK_SIZE,
    willpower: current.willpower || MINDSTREAM_DECK_SIZE,
  };
  return state.deckCaps;
}

export function snapshotDeckCaps(state) {
  if (!state) return null;
  state.deckCaps = {
    dream: state.dreamDeck?.length || 0,
    psyche: PSYCHE_DECK_SIZE,
    lucidity: MINDSTREAM_DECK_SIZE,
    elasticity: MINDSTREAM_DECK_SIZE,
    willpower: MINDSTREAM_DECK_SIZE,
  };
  return state.deckCaps;
}

export function remainingForSource(state, id) {
  if (id === "dream") return state.dreamDeck?.length || 0;
  if (id === "psyche") {
    return (state.psycheDeck?.length || 0) + (state.psycheDiscard?.length || 0);
  }
  return countMindstreamCirculation(state, id);
}

export function capForSource(state, id) {
  const caps = ensureDeckCaps(state);
  return caps?.[id] || 1;
}

export function pressureTier(remaining, cap) {
  if (!cap || remaining <= 0) return null;
  const softN = Math.max(1, Math.ceil(cap * 0.10));
  const critN = Math.max(1, Math.ceil(cap * 0.05));
  const sevN = Math.max(1, Math.ceil(cap * 0.01));
  if (remaining <= sevN) return "severe";
  if (remaining <= critN) return "critical";
  if (remaining <= softN) return "soft";
  return null;
}

export function readDeckPressure(state) {
  ensureDeckCaps(state);
  if (forcedReadings) return forcedReadings.map((row) => ({ ...row }));
  return SOURCE_IDS.map((id) => {
    const remaining = remainingForSource(state, id);
    const cap = capForSource(state, id);
    const pct = cap > 0 ? (remaining / cap) * 100 : 100;
    return {
      id,
      label: LABELS[id],
      remaining,
      cap,
      pct,
      tier: pressureTier(remaining, cap),
    };
  });
}

export function forceDeckPressure(readings) {
  forcedReadings = readings;
}

export function clearForcedDeckPressure() {
  forcedReadings = null;
}

function highestTier(rows) {
  let best = null;
  let rank = 0;
  rows.forEach((row) => {
    const next = TIER_RANK[row.tier] || 0;
    if (next > rank) {
      rank = next;
      best = row.tier;
    }
  });
  return best;
}

function bannerCopy(rows, tier) {
  const named = rows.filter((row) => row.tier);
  if (!named.length) return "";
  const list = named.map((row) => {
    const n = row.remaining;
    const cards = n === 1 ? "1 card" : `${n} cards`;
    return `${row.label} (${cards} left)`;
  });
  const joined = list.length === 1
    ? list[0]
    : `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`;
  if (tier === "severe") {
    return `The Dreamscape is unstable — ${joined}. If these run out, the table loses.`;
  }
  if (tier === "critical") {
    return `Critical — ${joined}. If these decks run out, the table loses.`;
  }
  return `${joined.charAt(0).toUpperCase()}${joined.slice(1)} ${list.length === 1 ? "is" : "are"} running low.`;
}

function ensureBanner() {
  let el = document.getElementById("deck-pressure-banner");
  if (el) return el;
  el = document.createElement("div");
  el.id = "deck-pressure-banner";
  el.className = "deck-pressure-banner hidden";
  el.setAttribute("role", "alert");
  el.setAttribute("aria-live", "assertive");
  document.body.prepend(el);
  return el;
}

function clearSoftTimer() {
  if (softFadeTimer) {
    window.clearTimeout(softFadeTimer);
    softFadeTimer = null;
  }
}

function trackSoftWarnings(state, readings) {
  if (!state.deckPressureSoftFaded) state.deckPressureSoftFaded = {};
  readings.forEach((row) => {
    const ratio = row.cap > 0 ? row.remaining / row.cap : 1;
    if (ratio > SOFT_RESET_RATIO) {
      delete state.deckPressureSoftFaded[row.id];
    }
  });
  const visibleSoft = readings.filter((row) => row.tier === "soft" && !state.deckPressureSoftFaded[row.id]);
  const highest = highestTier(readings.filter((row) => row.tier && !(row.tier === "soft" && state.deckPressureSoftFaded[row.id])));
  if (highest !== "soft") {
    clearSoftTimer();
    lastSoftSig = "";
    return;
  }
  const sig = visibleSoft.map((row) => row.id).sort().join(",");
  if (!sig || sig === lastSoftSig) return;
  lastSoftSig = sig;
  clearSoftTimer();
  softFadeTimer = window.setTimeout(() => {
    visibleSoft.forEach((row) => {
      state.deckPressureSoftFaded[row.id] = true;
    });
    softFadeTimer = null;
    syncDeckPressure(state);
  }, SOFT_FADE_MS);
}

function applyHudDreamUrgency(reading) {
  const wrap = document.querySelector(".hud-dreams-wrap");
  if (!wrap) return;
  wrap.classList.remove("hud-urgent-critical", "hud-urgent-warn");
  if (reading?.tier === "severe" || reading?.tier === "critical") {
    wrap.classList.add("hud-urgent-critical");
  } else if (reading?.tier === "soft") {
    wrap.classList.add("hud-urgent-warn");
  }
}

export function syncDeckPressure(state) {
  const body = document.body;
  const banner = ensureBanner();
  if (!body || !banner) return;

  if (!state || state.status !== "playing" || state.tutorialMode) {
    clearSoftTimer();
    lastSoftSig = "";
    banner.className = "deck-pressure-banner hidden";
    banner.textContent = "";
    banner.dataset.sig = "";
    body.classList.remove(
      "deck-pressure-active",
      "deck-pressure-soft",
      "deck-pressure-critical",
      "deck-pressure-severe",
      "dreamscape-unstable",
    );
    applyHudDreamUrgency(null);
    return;
  }

  const readings = readDeckPressure(state);
  trackSoftWarnings(state, readings);
  const visible = readings.filter((row) => (
    row.tier && !(row.tier === "soft" && state.deckPressureSoftFaded?.[row.id])
  ));
  const tier = highestTier(visible);
  const message = bannerCopy(visible, tier);
  const sig = `${tier || "none"}:${visible.map((row) => `${row.id}:${row.tier}`).join(",")}`;

  if (!tier) {
    banner.className = "deck-pressure-banner hidden";
    banner.textContent = "";
    banner.dataset.sig = "";
  } else {
    if (banner.dataset.sig !== sig) {
      banner.className = `deck-pressure-banner tier-${tier}`;
      banner.dataset.sig = sig;
    }
    banner.classList.remove("hidden");
    banner.textContent = message;
  }

  body.classList.toggle("deck-pressure-active", !!tier);
  body.classList.toggle("deck-pressure-soft", tier === "soft");
  body.classList.toggle("deck-pressure-critical", tier === "critical");
  body.classList.toggle("deck-pressure-severe", tier === "severe");
  body.classList.toggle("dreamscape-unstable", tier === "severe");
  applyHudDreamUrgency(readings.find((row) => row.id === "dream"));
}

export function pressureStatusLines(state) {
  return readDeckPressure(state).map((row) => {
    const pct = row.pct.toFixed(1);
    return `${row.id}: ${row.remaining}/${row.cap} (${pct}%)${row.tier ? ` · ${row.tier}` : ""}`;
  });
}

function dumpCards(state, cards) {
  cards.forEach((card) => repressCard(state, card));
}

export function setSourceRemaining(state, id, want) {
  ensureDeckCaps(state);
  const keep = Math.max(1, Math.floor(want));
  if (id === "dream") {
    state.dreamDiscard = state.dreamDiscard || [];
    while (state.dreamDeck.length > keep) {
      state.dreamDiscard.push(state.dreamDeck.pop());
    }
    return remainingForSource(state, id);
  }
  if (id === "psyche") {
    const pool = [...(state.psycheDeck || []), ...(state.psycheDiscard || [])];
    state.psycheDiscard = [];
    const extra = pool.splice(keep);
    state.psycheDeck = pool;
    dumpCards(state, extra);
    return remainingForSource(state, id);
  }
  if (!MINDSTREAM_SUIT_IDS.includes(id)) return remainingForSource(state, id);
  const deck = [...(state.mindstreamDecks?.[id] || []), ...(state.mindstreamDiscard?.[id] || [])];
  state.mindstreamDiscard[id] = [];
  const extra = deck.splice(keep);
  state.mindstreamDecks[id] = deck;
  dumpCards(state, extra);
  return remainingForSource(state, id);
}

export function setSourceRemainingRatio(state, id, ratio) {
  const cap = capForSource(state, id);
  const want = Math.max(1, Math.ceil(cap * ratio));
  return setSourceRemaining(state, id, want);
}

export function parsePressureSource(token) {
  const raw = String(token || "all").toLowerCase();
  if (raw === "all" || raw === "*") return SOURCE_IDS.slice();
  if (raw === "mindstream" || raw === "ms") return [...MINDSTREAM_SUIT_IDS];
  const match = SOURCE_IDS.find((id) => id === raw || id.startsWith(raw));
  return match ? [match] : [];
}

export function forcedReadingsForTier(tier, ids = SOURCE_IDS) {
  return ids.map((id) => {
    const cap = id === "dream" ? 14 : id === "psyche" ? PSYCHE_DECK_SIZE : MINDSTREAM_DECK_SIZE;
    const remaining = tier === "severe"
      ? Math.max(1, Math.ceil(cap * 0.01))
      : tier === "critical"
        ? Math.max(1, Math.ceil(cap * 0.05))
        : Math.max(1, Math.ceil(cap * 0.10));
    return {
      id,
      label: LABELS[id],
      remaining,
      cap,
      pct: (remaining / cap) * 100,
      tier,
    };
  });
}
