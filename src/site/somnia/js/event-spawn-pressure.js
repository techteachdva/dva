import { uid } from "./data.js";
import { addLog, setEncounterOnLandscape, landscapeById } from "./state.js";
import { pullDreambeastFromMindstream, encounterFromDreambeastCard } from "./mindstream-supply.js";
import { logMoment } from "./narrator.js";

function popSubconsciousDreambeast(state) {
  state.subconscious = state.subconscious || {};
  const pile = state.subconscious.dreambeasts || [];
  if (!pile.length) return null;
  return pile.pop();
}

function pickSpawnLandscape(state, player) {
  const preferred = landscapeById(state, player.landscapeId);
  if (preferred?.revealed && !preferred.wasteland) return preferred.id;
  const revealed = (state.board || []).filter((t) => t.revealed && !t.wasteland && !t.center);
  if (!revealed.length) return player.landscapeId || "bed";
  return revealed[Math.floor(Math.random() * revealed.length)].id;
}

/** Spawn a Dreambeast from Mindstream decks or Subconscious dreambeasts pile. */
export function spawnDreambeastFromSupply(state, player, helpers, { suit = null, chance = 1 } = {}) {
  if (chance < 1 && Math.random() > chance) return false;

  const pulled = pullDreambeastFromMindstream(state, { suit });
  let card = pulled?.card;
  if (!card) {
    const sub = popSubconsciousDreambeast(state);
    if (sub) card = { ...sub, type: "dreambeast" };
  }
  if (!card && helpers?.spawnEncounter) {
    helpers.spawnEncounter(state, pickSpawnLandscape(state, player));
    addLog(state, "A nightmare stirs — an Encounter claws into the Dreamscape.");
    return true;
  }
  if (!card) return false;

  const landId = pickSpawnLandscape(state, player);
  const encounter = encounterFromDreambeastCard(card);
  encounter.instanceId = uid("enc");
  setEncounterOnLandscape(state, landId, encounter);
  logMoment(state, `${encounter.name} erupts from the depths onto ${landscapeById(state, landId)?.name || landId}!`);
  return true;
}

/** ~40% of resolved Events also spawn pressure unless already wasted. */
export function maybeSpawnAfterEvent(state, player, helpers, event) {
  if (!event || event.eventWasted) return;
  spawnDreambeastFromSupply(state, player, helpers, { chance: 0.45 });
}
