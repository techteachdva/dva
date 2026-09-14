/** Player-facing explanations: what just happened + what to do next. */

import { getPhase, addLog } from "./state.js";
import { getCurrentObjective } from "./guide.js";
import { showMomentFromNarration, flashMoment } from "./moment-overlay.js";

/** Log to the dream feed and flash a one-line HUD moment. */
export function logMoment(state, message) {
  const text = String(message || "").trim();
  if (!text) return;
  addLog(state, text);
  flashMoment(text.endsWith(".") ? text : `${text}.`);
}

export function announce(state, { title, detail, consequences = [], moment = null }) {
  state.narrator = {
    title: title || "Something happened",
    detail: detail || title || "",
    consequences: Array.isArray(consequences) ? consequences : [],
    at: Date.now(),
  };
  if (title) {
    state.log.unshift(title);
    state.log = state.log.slice(0, 40);
  }
  if (moment) {
    showMomentFromNarration({ title, detail, consequences, moment });
  }
}

/** Log + narrator detail (use instead of bare addLog for player-visible events). */
export function narrate(state, shortMessage, detail = null, consequences = [], options = {}) {
  const fullDetail = detail || shortMessage;
  announce(state, {
    title: shortMessage,
    detail: fullDetail,
    consequences,
    moment: options.moment ?? null,
  });
}

export function getLandscapePickNarration(state) {
  const pick = state.landscapePick;
  if (!pick) return null;
  if (pick.mode === "reveal") {
    return {
      title: "Choose Landscapes to Reveal",
      detail: `Click ${pick.remaining} hex tile(s) on the map showing the Wasteland back. Each click flips a tile to its active Landscape face.`,
      consequences: pick.remaining > 0
        ? [`${pick.remaining} reveal(s) remaining`]
        : [],
    };
  }
  if (pick.mode === "forget") {
    return {
      title: "Choose Landscapes to Forget",
      detail: `Click ${pick.remaining} revealed Landscape tile(s) on the map. Each becomes a Wasteland (face-down). Dreamers on forgotten tiles discard 1 Psyche to the Subconscious.`,
      consequences: pick.remaining > 0
        ? [`${pick.remaining} forget(s) remaining`]
        : [],
    };
  }
  if (pick.mode === "choose") {
    return {
      title: pick.title || "Choose a Landscape",
      detail: pick.detail || "Click a highlighted hex on the map.",
      consequences: ["Click 1 highlighted Landscape"],
    };
  }
  return null;
}

export function getNarratorView(state) {
  const pick = getLandscapePickNarration(state);
  if (pick) return pick;

  if (state.pendingRepress) {
    return {
      title: "Repress cards",
      detail: state.pendingRepress.reason || "Choose cards to send face-up into The Subconscious (graveyard).",
      consequences: ["Complete the picker before taking other actions."],
    };
  }

  if (state.pendingReturn) {
    const rem = state.pendingReturn.remaining - state.pendingReturn.picked.length;
    return {
      title: "Return from Subconscious",
      detail: `Choose ${rem} card(s) from The Subconscious to Return to their discard piles.`,
      consequences: ["Returned cards re-enter play through future draws."],
    };
  }

  if (state.pendingNothingChoice) {
    const count = state.players.filter((p) => p.alive).length + 6;
    return {
      title: "The Nothing",
      detail: `Lose 1 Power Token, or Repress ${count} Psyche from the top of the Psyche deck.`,
      consequences: ["Then The Nothing is discarded to its Mindstream discard pile."],
    };
  }

  if (state.pendingObjectFollowup) {
    return {
      title: "Finish the Object",
      detail: "The Object still needs a map pick or a follow-up choice.",
      consequences: ["Complete the highlighted hexes or popup."],
    };
  }

  if (state.pendingDreamChoice || state.pendingEffectChoice) {
    const pending = state.pendingDreamChoice || state.pendingEffectChoice;
    return {
      title: pending.title || "Dream effect",
      detail: pending.message || "Choose one effect.",
      consequences: (pending.choices || []).map((choice) => choice.label),
    };
  }

  if (state.pendingObjectChoice) {
    const pending = state.pendingObjectChoice;
    return {
      title: pending.title || "Object effect",
      detail: pending.message || "Choose one effect.",
      consequences: (pending.choices || []).map((choice) => choice.label),
    };
  }

  if (state.narrator) {
    return state.narrator;
  }

  const phase = getPhase(state);
  return {
    title: `${phase} Phase`,
    detail: `Round ${state.round}. Follow the steps below.`,
    consequences: [],
  };
}

export function listPhaseActionHints(state, actions) {
  const obj = getCurrentObjective(state);
  const hints = [];
  if (obj?.steps) {
    obj.steps.forEach((s) => hints.push(s.replace(/\*\*/g, "")));
  }
  actions
    .filter((a) => !a.disabled && a.section !== "phase" && a.section !== "round")
    .slice(0, 6)
    .forEach((a) => {
      const line = a.hint ? `${a.label} — ${a.hint}` : a.label;
      if (!hints.some((h) => h.includes(a.label.split("(")[0].trim()))) {
        hints.push(line);
      }
    });
  return hints;
}
