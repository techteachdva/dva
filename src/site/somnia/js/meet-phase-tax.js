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
    `Meet Phase tax: ${beastCount} active Dreambeast${beastCount === 1 ? "" : "s"} on the board. Each Dreamer Represses 1 Psyche from hand per Dreambeast (${beastCount} total), and the table Forgets 1 Landscape per Dreambeast (${beastCount} total).`,
    { forget: true, durationMs: 18000 },
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
