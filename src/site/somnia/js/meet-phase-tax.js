import { addLog } from "./state.js";
import { logMoment } from "./narrator.js";
import { countBoardDreambeasts } from "./phase-skip.js";
import { enqueueRepressFromHand } from "./subconscious.js";
import { requestForgetLandscapes } from "./landscapes.js";

/** Roaming Dreambeasts tax at the start of each Meet Phase. */
export function applyMeetPhaseDreambeastTax(state) {
  if (state.tutorialMode) return;
  const beastCount = countBoardDreambeasts(state);
  if (beastCount <= 0) return;

  const alive = state.players.filter((p) => p.alive);
  logMoment(
    state,
    `${beastCount} Dreambeast${beastCount === 1 ? "" : "s"} roam — each Dreamer Represses ${beastCount} Psyche; the Dreamscape Forgets ${beastCount} Landscape${beastCount === 1 ? "" : "s"}.`,
    { forget: true },
  );

  alive.forEach((player) => {
    enqueueRepressFromHand(state, player, beastCount, {
      reason: `${player.name}: ${beastCount} roaming Dreambeast${beastCount === 1 ? "" : "s"} — Repress ${beastCount} Psyche from hand.`,
    });
  });

  requestForgetLandscapes(state, beastCount);
  addLog(
    state,
    `Meet toll: ${beastCount} Dreambeast(s) on the board — each Dreamer Represses ${beastCount} Psyche; Forget ${beastCount} Landscape(s).`,
  );
}
