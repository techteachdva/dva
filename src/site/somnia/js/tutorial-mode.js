import {
  createInitialState,
  getPhase,
  addLog,
  setEncounterOnLandscape,
  landscapeById,
} from "./state.js";
import { meetPsycheActor } from "./rules.js";
import { uid } from "./data.js";
import { encounterFromDreambeastCard } from "./mindstream-supply.js";

export const TUTORIAL_DREAMER_IDS = ["the-visionary", "the-runner"];
export const TUTORIAL_MAX_ROUND = 5;

function makePsyche(suit, value, tag) {
  const label = suit.charAt(0).toUpperCase() + suit.slice(1);
  return {
    id: `${suit}-${value}-${tag}`,
    type: "psyche",
    suit,
    value,
    name: `${label} ${value}`,
    instanceId: uid(`tut-${tag}`),
  };
}

function mkDream(template, extra = {}) {
  return { ...template, ...extra, instanceId: uid("tut-dream") };
}

export function createTutorialState(data) {
  const dreamers = TUTORIAL_DREAMER_IDS
    .map((id) => data.dreamers.find((d) => d.id === id))
    .filter(Boolean);

  const state = createInitialState(data, {
    lengthKey: "daydream",
    selectedDreamers: dreamers,
  });

  state.tutorialMode = true;
  state.tutorialStepIndex = 0;
  state.tutorialCanAdvance = false;
  state.tutorialComplete = false;
  state.tutorialFlags = {
    movedExplore: false,
    pooledMeet: false,
    dreamsDrawn: 0,
  };

  state.players[0].hand = [
    makePsyche("lucidity", 3, "v-l3"),
    makePsyche("lucidity", 2, "v-l2"),
    makePsyche("elasticity", 2, "v-e2"),
    makePsyche("willpower", 2, "v-w2"),
    makePsyche("lucidity", 1, "v-l1"),
  ];
  state.players[1].hand = [
    makePsyche("elasticity", 3, "r-e3"),
    makePsyche("elasticity", 2, "r-e2"),
    makePsyche("lucidity", 2, "r-l2"),
    makePsyche("willpower", 3, "r-w3"),
    makePsyche("elasticity", 1, "r-e1"),
  ];

  const quiet = data.dreams.find((d) => d.id === "quiet");
  const heroism = data.dreams.find((d) => d.id === "heroism");
  const cerberus = data.dreambeasts.find((b) => b.id === "cerberus");

  state.dreamDeck = [
    mkDream(quiet),
    mkDream(quiet),
    mkDream(cerberus, { type: "boss-dream", boss: true }),
    mkDream(heroism),
    mkDream(quiet),
    ...state.dreamDeck.slice(5),
  ];

  ["bed", "house", "forest", "sky", "the-attic"].forEach((id) => {
    const tile = landscapeById(state, id);
    if (tile) tile.revealed = true;
  });

  const mandrake = data.dreambeasts.find((b) => b.id === "mandrake");
  if (mandrake) {
    setEncounterOnLandscape(state, "house", encounterFromDreambeastCard(mandrake));
  }

  state.log = [
    "Tutorial Mode — 5 scripted rounds. Follow the highlighted steps.",
    "Round 1 begins in the Reveal Phase.",
  ];
  return state;
}

function bossOnBed(state) {
  return landscapeById(state, "bed")?.encounter?.id === "cerberus"
    || state.activeDream?.id === "cerberus";
}

function hasLuciditySelected(state) {
  const ids = new Set(state.selectedHand);
  return state.players.some((p) => p.hand.some((c) => ids.has(c.instanceId) && c.suit === "lucidity"));
}

function hasMeetPool(state) {
  const actor = meetPsycheActor(state);
  if (!actor || getPhase(state) !== "Meet" || state.meetActionBudget <= 0) return false;
  const ids = new Set(state.selectedHand);
  return actor.hand.some((c) => ids.has(c.instanceId));
}

function dreamerOnHouse(state) {
  return state.players.some((p) => p.alive && p.landscapeId === "house");
}

/** Linear guided script — player must complete highlighted actions between steps. */
export const TUTORIAL_SCRIPT = [
  {
    id: "welcome",
    round: 1,
    title: "Welcome to Somnia",
    body: "This interactive tutorial walks you through 5 scripted rounds. Actions are highlighted; complete each step before pressing Continue. Talk with your partner — there is no turn order within a phase.",
    target: null,
  },
  {
    id: "phases",
    round: 1,
    title: "Reveal → Explore → Meet",
    body: "Each round has three phases tied to Psyche suits: ◉ Lucidity (Reveal), ⇄ Elasticity (Explore), ▲ Willpower (Meet). Advance when your team is ready.",
    target: "#phase-stepper",
  },
  {
    id: "archetype",
    round: 1,
    title: "Archetypes & Victory",
    body: "Complete both quests on the Active Archetype, then acquire it for points. Reach the goal before Dreams run out. Quest tokens come from Power Tokens and in-game events.",
    target: "#active-archetype",
  },
  {
    id: "power",
    round: 1,
    title: "Power Tokens",
    body: "Power Tokens (max 24 team-wide) fuel Dreamer powers, Archetype quests, Persistent Object activations, and death avoidance. You start with 2 each.",
    target: "#power-tokens",
  },
  {
    id: "psyche",
    round: 1,
    title: "Psyche Cards",
    body: "Psyche is your health and your budget. Blue Lucidity, yellow Elasticity, red Willpower. One Dreamer spends 1–2 suited cards per phase to set the team budget; their Dreamer stat adds bonus value.",
    target: "#hand-bar",
  },
  {
    id: "subconscious",
    round: 1,
    title: "The Subconscious",
    body: "Repressed cards go face-up here (the graveyard). Return effects pull cards back to their discard piles so decks cycle. Balance Repress and Return to stay alive.",
    target: "#subconscious-graveyard",
  },
  {
    id: "draw-dream-r1",
    round: 1,
    title: "Draw the Dream",
    body: "The Head Dreamer (★) draws one Dream per round. Click Draw & Resolve Dream — this tutorial uses Quiet (nothing happens).",
    target: "#phase-actions",
    until: (s) => s.dreamDrawn,
  },
  {
    id: "spend-lucidity-r1",
    round: 1,
    title: "Spend Lucidity",
    body: "Select 1–2 blue Lucidity cards from The Visionary's row, then click Reveal Landscapes in the action bar below the map.",
    targets: ["#hand-bar", "#phase-actions"],
    until: (s) => s.revealLandscapeUsed || s.landscapePick?.mode === "reveal",
  },
  {
    id: "reveal-pick-r1",
    round: 1,
    title: "Reveal Landscapes",
    body: "Click hidden hex tiles on the map to flip them face-up. Reveal at least one Landscape, then continue.",
    target: "#board-viewport",
    until: (s) => s.revealLandscapeUsed,
  },
  {
    id: "to-explore-r1",
    round: 1,
    title: "Advance to Explore",
    body: "When Reveal is done, click Next Phase at the top of the table to enter Explore.",
    target: "#phase-advance-bar",
    until: (s) => getPhase(s) === "Explore",
  },
  {
    id: "spend-elasticity-r1",
    round: 1,
    title: "Spend Elasticity",
    body: "Select 1–2 yellow Elasticity cards from The Runner's row, then click Spend Elasticity in the action bar.",
    targets: ["#hand-bar", "#phase-actions"],
    until: (s) => s.exploreActivated,
  },
  {
    id: "explore-move-r1",
    round: 1,
    title: "Explore the Map",
    body: "Click a Dreamer chip, then move onto House — a Mandrake Encounter waits there. Unused Explore moves can be skipped when advancing.",
    targets: ["#player-list", "#board-viewport"],
    until: (s) => dreamerOnHouse(s),
  },
  {
    id: "to-meet-r1",
    round: 1,
    title: "Advance to Meet",
    body: "Click Next Phase to enter Meet. If you still have Explore moves left, confirm to forfeit them.",
    target: "#phase-advance-bar",
    until: (s) => getPhase(s) === "Meet",
  },
  {
    id: "spend-willpower-r1",
    round: 1,
    title: "Spend Willpower",
    body: "Select 1–2 red Willpower cards, then click Gain Actions in the action bar.",
    targets: ["#hand-bar", "#phase-actions"],
    until: (s) => s.meetActionBudget > 0,
  },
  {
    id: "encounter-r1",
    round: 1,
    title: "Encounters",
    body: "A Mandrake waits on House. Select the House hex, then pool up to 3 Psyche from the Dreamer standing there. Accept (ally joins hand) or Repress (draw 1 Psyche) from the encounter panel.",
    targets: ["#hand-bar", "#active-encounter"],
    until: (s) => hasMeetPool(s),
  },
  {
    id: "end-r1",
    round: 1,
    title: "End Round 1",
    body: "Click Next Phase to end the Meet phase and start Round 2. Dreams and Psyche draws happen at round start.",
    target: "#phase-advance-bar",
    until: (s) => s.round >= 2,
  },
  {
    id: "draw-dream-r2",
    round: 2,
    title: "Round 2 — Another Dream",
    body: "Draw the second Quiet Dream. Each round the Head Dreamer draws once in Reveal.",
    target: "#phase-actions",
    until: (s) => s.round >= 2 && s.dreamDrawn,
  },
  {
    id: "phases-r2",
    round: 2,
    title: "Psyche Plays Recap",
    body: "Repeat the pattern: spend Lucidity → reveal, spend Elasticity → move, spend Willpower → Meet actions. Objects are free anytime; Persistent Objects cost 1 Power Token to activate.",
    targets: ["#guide-panel-wrap", "#guide-panel"],
    until: (s) => getPhase(s) === "Explore" || s.exploreActivated,
  },
  {
    id: "explore-r2",
    round: 2,
    title: "Explore Again",
    body: "Spend Elasticity and move on the map. Landscape unique actions are available during Meet on their tile.",
    targets: ["#player-list", "#board-viewport"],
    until: (s) => s.round >= 2 && (s.exploreActivated || getPhase(s) === "Meet"),
  },
  {
    id: "meet-r2",
    round: 2,
    title: "Meet Again",
    body: "Spend Willpower for Meet actions. Trade, play Objects, complete quests, and pool Psyche for Encounters.",
    targets: ["#hand-bar", "#phase-actions"],
    until: (s) => s.round >= 2 && s.meetActionBudget > 0,
  },
  {
    id: "end-r2",
    round: 2,
    title: "End Round 2",
    body: "Advance to Round 3 — the Boss Dream arrives.",
    target: "#phase-advance-bar",
    until: (s) => s.round >= 3,
  },
  {
    id: "boss-dream",
    round: 3,
    title: "Boss Dream — Cerberus",
    body: "Draw & Resolve Dream now. The third Dream of this tutorial awakens Cerberus on The Bed — a Boss Dreambeast with a harsh Fail effect.",
    target: "#phase-actions",
    until: (s) => s.round >= 3 && (s.dreamDrawn && bossOnBed(s)),
  },
  {
    id: "boss-explained",
    round: 3,
    title: "Boss Spawning",
    body: "Boss Dreams place a nightmare on The Bed. Meet them with pooled Psyche during Meet phase. Defeating or Repressing bosses is key to surviving the Dreamscape.",
    target: "#active-encounter",
  },
  {
    id: "boss-meet",
    round: 3,
    title: "Face the Boss",
    body: "Spend Willpower, then move onto The Bed if needed. Only the Dreamer on The Bed may pool Psyche to Meet Cerberus — or advance when ready to continue the tutorial.",
    targets: ["#board-viewport", "#active-encounter"],
    until: (s) => s.round >= 3 && (s.meetActionBudget > 0 || getPhase(s) !== "Meet"),
  },
  {
    id: "end-r3",
    round: 3,
    title: "End Round 3",
    body: "You've survived the first Boss. Two tutorial rounds remain.",
    target: "#phase-advance-bar",
    until: (s) => s.round >= 4,
  },
  {
    id: "round-4",
    round: 4,
    title: "Round 4 — Heroism",
    body: "Draw the Dream (Heroism — team draws Willpower Psyche). Death in the Dream Represses the top of each Mindstream deck, loses Objects/Power, respawns on Bed with fewer Psyche, then resolves an extra Dream.",
    target: "#phase-actions",
    until: (s) => s.round >= 4 && s.dreamDrawn,
  },
  {
    id: "death-rules",
    round: 4,
    title: "Death & Respawn",
    body: "At 0 Psyche you may spend Power Tokens to cling to life, or die: 1st death → 4 Psyche, 2nd → 3, 3rd → 2, 4th → 1. Fifth death removes that Dreamer permanently.",
    target: "#hex-board",
  },
  {
    id: "end-r4",
    round: 4,
    title: "End Round 4",
    body: "One more round after this.",
    target: "#phase-advance-bar",
    until: (s) => s.round >= 5,
  },
  {
    id: "round-5",
    round: 5,
    title: "Final Tutorial Round",
    body: "Round 5: run through Reveal, Explore, and Meet one last time. Use the Guide panel anytime for hints.",
    targets: ["#guide-panel-wrap", "#phase-stepper"],
    until: (s) => s.round >= 5 && s.dreamDrawn,
  },
  {
    id: "graduate",
    round: 5,
    title: "Tutorial Complete!",
    body: "You know the core loop: Dreams reshape the map, Psyche powers phases, Power Tokens fuel abilities, and the Subconscious cycles through Repress and Return. Press Finish to return to setup and start a real Dream.",
    target: null,
  },
];

export function getTutorialStep(state) {
  if (!state?.tutorialMode) return null;
  return TUTORIAL_SCRIPT[state.tutorialStepIndex] || null;
}

export function syncTutorial(state) {
  if (!state?.tutorialMode || state.tutorialComplete) return null;

  const step = getTutorialStep(state);
  if (!step) {
    return { complete: true };
  }

  if (step.until) {
    state.tutorialCanAdvance = step.until(state);
  } else {
    state.tutorialCanAdvance = true;
  }

  return {
    step,
    stepIndex: state.tutorialStepIndex,
    total: TUTORIAL_SCRIPT.length,
    canAdvance: state.tutorialCanAdvance,
    round: step.round || state.round,
  };
}

export function advanceTutorialStep(state) {
  if (!state?.tutorialMode) return;
  state.tutorialStepIndex += 1;
  state.tutorialCanAdvance = false;
  if (state.tutorialStepIndex >= TUTORIAL_SCRIPT.length) {
    state.tutorialComplete = true;
  }
}

export function notifyTutorialDreamDrawn(state) {
  if (!state?.tutorialMode) return;
  state.tutorialFlags.dreamsDrawn = (state.tutorialFlags.dreamsDrawn || 0) + 1;
}

export function notifyTutorialExploreMove(state) {
  if (!state?.tutorialMode) return;
  state.tutorialFlags.movedExplore = true;
}

export function completeTutorialGame(state) {
  state.tutorialComplete = true;
  state.status = "won";
  state.tutorialVictory = true;
  addLog(state, "Tutorial complete — you're ready for the full Dreamscape.");
}

export function isInteractiveTutorialActive(state) {
  return !!(state?.tutorialMode && !state.tutorialComplete);
}
