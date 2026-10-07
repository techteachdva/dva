/** Nightmare backdrop. Final Recurrence still darkens the veil.
 *  The hellscape also fades in as the table nears a loss: the Death Clock
 *  toward 6, or any lose-condition deck toward 1% remaining.
 */

import { readDeckPressure } from "../cards/deck-pressure.js";
import { DEATH_CLOCK_CAP } from "../core/state.js";

function deathVeil(clock) {
  const t = Math.max(0, Math.min(1, (Number(clock) || 0) / DEATH_CLOCK_CAP));
  if (t <= 0) return 0;
  return Math.min(1, t * t * 0.55 + t * 0.45);
}

function deckVeil(state) {
  if (!state || state.tutorialMode) return 0;
  let worst = 0;
  readDeckPressure(state).forEach((row) => {
    const ratio = row.cap > 0 ? row.remaining / row.cap : 1;
    if (ratio >= 0.1) return;
    const t = ratio <= 0.01 ? 1 : (0.1 - ratio) / 0.09;
    worst = Math.max(worst, t);
  });
  return worst;
}

export function snapshotFinalRecurrenceDreams(state) {
  if (!state?.finalRecurrence) return;
  if (state.finalRecurrenceDreamsAtStart == null) {
    state.finalRecurrenceDreamsAtStart = Math.max(1, state.dreamDeck?.length || 1);
  }
}

export function updateFinalRecurrenceAtmosphere(state) {
  const body = document.body;
  const backdrop = document.getElementById("final-nightmare-backdrop");
  const veil = document.getElementById("final-recurrence-veil");
  if (!body || !backdrop || !veil) return;

  const playing = state && (state.status === "playing" || state.status === "lost");
  if (!playing) {
    body.classList.remove("final-recurrence-active", "loss-nightmare");
    body.style.removeProperty("--loss-veil");
    delete body.dataset.deathClock;
    delete body.dataset.lossVeil;
    backdrop.style.opacity = "0";
    veil.style.opacity = "0";
    return;
  }

  snapshotFinalRecurrenceDreams(state);
  const deaths = state.deathClock || 0;
  const fromDeaths = deathVeil(deaths);
  const fromDecks = state.status === "lost" ? 1 : deckVeil(state);
  const lossVeil = state.status === "lost" ? 1 : Math.max(fromDeaths, fromDecks);

  let recurrence = 0;
  if (state.finalRecurrence) {
    const start = state.finalRecurrenceDreamsAtStart || 1;
    const left = Math.max(0, state.dreamDeck?.length || 0);
    const drained = 1 - Math.min(1, left / start);
    recurrence = 0.12 + drained * 0.88;
    body.classList.add("final-recurrence-active");
    const veilStrength = 0.78 * (left / start) + 0.08;
    veil.style.opacity = String(Math.min(0.88, Math.max(0.06, veilStrength)));
  } else {
    body.classList.remove("final-recurrence-active");
    veil.style.opacity = String(Math.min(0.42, lossVeil * 0.34));
  }

  const opacity = Math.max(lossVeil * 0.92, recurrence);
  backdrop.style.opacity = String(opacity);
  body.classList.toggle("loss-nightmare", opacity > 0.04);
  body.style.setProperty("--loss-veil", lossVeil.toFixed(3));
  body.dataset.deathClock = String(deaths);
  body.dataset.deathCap = String(DEATH_CLOCK_CAP);
  body.dataset.lossVeil = lossVeil.toFixed(3);
  backdrop.dataset.deathClock = String(deaths);
  backdrop.dataset.deathCap = String(DEATH_CLOCK_CAP);
  backdrop.dataset.lossVeil = lossVeil.toFixed(3);
  backdrop.dataset.deckVeil = fromDecks.toFixed(3);
}
