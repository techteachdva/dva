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

function phaseAfter(state, phase) {
  const order = ["Reveal", "Explore", "Meet"];
  const idx = order.indexOf(getPhase(state));
  return idx > order.indexOf(phase);
}

function revealDone(state, minRound = 1) {
  return state.round >= minRound
    && state.dreamDrawn
    && (state.revealLandscapeUsed || phaseAfter(state, "Reveal"));
}

/** R.E.M. loop steps for rounds 2, 4, and 5 (practice rounds). */
function remPracticeSteps(round, { introTitle, introBody, endBody, endUntil } = {}) {
  const r = round;
  const endGate = endUntil === false
    ? null
    : (endUntil || ((s) => s.round >= r + 1));
  return [
    {
      id: `r${r}-intro`,
      round: r,
      title: introTitle || `Round ${r} — R.E.M.`,
      body: introBody || `Run the loop yourself: Reveal (Dream + Lucidity) → Explore (Elasticity + moves) → Meet (Willpower + actions). The phase tracker shows where you are.`,
      target: "#phase-stepper",
    },
    {
      id: `r${r}-dream`,
      round: r,
      title: `Round ${r} — Reveal: Draw Dream`,
      body: "Reveal always starts with the Head Dreamer drawing one Dream card.",
      target: "#phase-actions",
      until: (s) => s.round >= r && s.dreamDrawn,
      objective: (s) => (s.dreamDrawn
        ? "Dream drawn — press Continue."
        : "Click Draw & Resolve Dream in the action bar."),
    },
    {
      id: `r${r}-lucidity`,
      round: r,
      title: `Round ${r} — Reveal: Spend Lucidity`,
      body: "Select 1–2 blue Lucidity cards from a Dreamer's hand, then click Reveal Landscapes and flip at least one hidden hex.",
      targets: ["#hand-bar", "#phase-actions"],
      until: (s) => revealDone(s, r),
      objective: (s) => {
        if (!s.dreamDrawn) return "Draw the Dream first.";
        if (s.revealLandscapeUsed || phaseAfter(s, "Reveal")) return "Reveal complete — press Continue.";
        if (hasLuciditySelected(s)) return "Click Reveal Landscapes, then pick a hidden hex on the map.";
        return "Select 1–2 Lucidity cards, then click Reveal Landscapes.";
      },
    },
    {
      id: `r${r}-to-explore`,
      round: r,
      title: `Round ${r} — Enter Explore`,
      body: "When Reveal is finished, click Next Phase at the top of the table.",
      target: "#phase-advance-bar",
      until: (s) => s.round >= r && phaseAfter(s, "Reveal"),
      objective: (s) => (phaseAfter(s, "Reveal")
        ? "Explore phase started — press Continue."
        : "Click Next Phase to leave Reveal."),
    },
    {
      id: `r${r}-elasticity`,
      round: r,
      title: `Round ${r} — Explore: Spend Elasticity`,
      body: "Select 1–2 yellow Elasticity cards, then Spend Elasticity to unlock shared moves.",
      targets: ["#hand-bar", "#phase-actions"],
      until: (s) => s.round >= r && (s.exploreActivated || getPhase(s) === "Meet"),
      objective: (s) => (s.exploreActivated || getPhase(s) === "Meet"
        ? "Elasticity spent — press Continue."
        : "Select 1–2 Elasticity cards, then click Spend Elasticity."),
    },
    {
      id: `r${r}-to-meet`,
      round: r,
      title: `Round ${r} — Enter Meet`,
      body: "Move Dreamers on the map if you want, then click Next Phase. You may skip unused Explore moves.",
      targets: ["#phase-advance-bar", "#board-viewport"],
      until: (s) => s.round >= r && getPhase(s) === "Meet",
      objective: (s) => (getPhase(s) === "Meet"
        ? "Meet phase started — press Continue."
        : "Click Next Phase to enter Meet."),
    },
    {
      id: `r${r}-willpower`,
      round: r,
      title: `Round ${r} — Meet: Spend Willpower`,
      body: "Select 1–2 red Willpower cards, then Gain Actions. Use Meet actions for Encounters, Landscapes, Trade, Objects, or Quests.",
      targets: ["#hand-bar", "#phase-actions"],
      until: (s) => s.round >= r && s.meetActionBudget > 0,
      objective: (s) => (s.meetActionBudget > 0
        ? "Meet actions unlocked — press Continue."
        : "Select 1–2 Willpower cards, then click Gain Actions."),
    },
    {
      id: `r${r}-end`,
      round: r,
      title: `End Round ${r}`,
      body: endBody || "Spend any remaining Meet actions you want, then click Next Phase to end the round.",
      target: "#phase-advance-bar",
      ...(endGate ? {
        until: endGate,
        objective: (s) => (endGate(s)
          ? "Round ended — press Continue."
          : "Click Next Phase to end the Meet phase and start the next round."),
      } : {
        objective: "End the round when ready, then press Continue.",
      }),
    },
  ];
}

/** Linear guided script — player must complete highlighted actions between steps. */
export const TUTORIAL_SCRIPT = [
  {
    id: "welcome",
    round: 1,
    title: "Welcome to Somnia",
    body: "This walkthrough covers 5 rounds. Complete each objective to unlock Continue. Talk with your partner — there is no turn order within a phase.",
    target: null,
  },
  {
    id: "phases",
    round: 1,
    title: "R.E.M. — Reveal, Explore, Meet",
    body: "Each round has three phases tied to Psyche suits: ◉ Lucidity (Reveal), ⇄ Elasticity (Explore), ▲ Willpower (Meet). The phase tracker always shows your current step.",
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
    objective: (s) => (s.dreamDrawn
      ? "Dream drawn — press Continue."
      : "Click Draw & Resolve Dream in the action bar."),
  },
  {
    id: "spend-lucidity-r1",
    round: 1,
    title: "Spend Lucidity",
    body: "Select 1–2 blue Lucidity cards from The Visionary's row, then click Reveal Landscapes in the action bar below the map.",
    targets: ["#hand-bar", "#phase-actions"],
    until: (s) => s.revealLandscapeUsed || s.landscapePick?.mode === "reveal",
    objective: (s) => {
      if (s.revealLandscapeUsed || s.landscapePick?.mode === "reveal") return "Lucidity spent — press Continue.";
      if (hasLuciditySelected(s)) return "Click Reveal Landscapes in the action bar.";
      return "Select 1–2 Lucidity cards from The Visionary's hand.";
    },
  },
  {
    id: "reveal-pick-r1",
    round: 1,
    title: "Reveal Landscapes",
    body: "Click hidden hex tiles on the map to flip them face-up. Reveal at least one Landscape, then continue.",
    target: "#board-viewport",
    until: (s) => s.revealLandscapeUsed,
    objective: (s) => (s.revealLandscapeUsed
      ? "Landscape revealed — press Continue."
      : "Click a hidden hex on the map to reveal it."),
  },
  {
    id: "to-explore-r1",
    round: 1,
    title: "Advance to Explore",
    body: "When Reveal is done, click Next Phase at the top of the table to enter Explore.",
    target: "#phase-advance-bar",
    until: (s) => getPhase(s) === "Explore",
    objective: (s) => (getPhase(s) === "Explore"
      ? "Explore phase started — press Continue."
      : "Click Next Phase to enter Explore."),
  },
  {
    id: "spend-elasticity-r1",
    round: 1,
    title: "Spend Elasticity",
    body: "Select 1–2 yellow Elasticity cards from The Runner's row, then click Spend Elasticity in the action bar.",
    targets: ["#hand-bar", "#phase-actions"],
    until: (s) => s.exploreActivated,
    objective: (s) => (s.exploreActivated
      ? "Elasticity spent — press Continue."
      : "Select 1–2 Elasticity cards, then click Spend Elasticity."),
  },
  {
    id: "explore-move-r1",
    round: 1,
    title: "Explore the Map",
    body: "Click a Dreamer chip, then move onto House — a Mandrake Encounter waits there. Unused Explore moves can be skipped when advancing.",
    targets: ["#player-list", "#board-viewport"],
    until: (s) => dreamerOnHouse(s),
    objective: (s) => (dreamerOnHouse(s)
      ? "Dreamer on House — press Continue."
      : "Move a Dreamer onto the House hex."),
  },
  {
    id: "to-meet-r1",
    round: 1,
    title: "Advance to Meet",
    body: "Click Next Phase to enter Meet. If you still have Explore moves left, confirm to forfeit them.",
    target: "#phase-advance-bar",
    until: (s) => getPhase(s) === "Meet",
    objective: (s) => (getPhase(s) === "Meet"
      ? "Meet phase started — press Continue."
      : "Click Next Phase to enter Meet."),
  },
  {
    id: "spend-willpower-r1",
    round: 1,
    title: "Spend Willpower",
    body: "Select 1–2 red Willpower cards, then click Gain Actions in the action bar.",
    targets: ["#hand-bar", "#phase-actions"],
    until: (s) => s.meetActionBudget > 0,
    objective: (s) => (s.meetActionBudget > 0
      ? "Meet actions unlocked — press Continue."
      : "Select 1–2 Willpower cards, then click Gain Actions."),
  },
  {
    id: "encounter-r1",
    round: 1,
    title: "Encounters",
    body: "A Mandrake waits on House. Select the House hex, then pool up to 3 Psyche from the Dreamer standing there. Accept (ally joins hand) or Repress (draw 1 Psyche) from the encounter panel.",
    targets: ["#hand-bar", "#active-encounter"],
    until: (s) => hasMeetPool(s),
    objective: (s) => {
      if (hasMeetPool(s)) return "Psyche pooled — press Continue.";
      if (!dreamerOnHouse(s)) return "Move a Dreamer onto House and select the House hex.";
      return "Select up to 3 Psyche cards from the Dreamer on House.";
    },
  },
  {
    id: "end-r1",
    round: 1,
    title: "End Round 1",
    body: "Click Next Phase to end the Meet phase and start Round 2. Psyche draws happen at round start.",
    target: "#phase-advance-bar",
    until: (s) => s.round >= 2,
    objective: (s) => (s.round >= 2
      ? "Round 2 started — press Continue."
      : "Click Next Phase to end Round 1."),
  },
  ...remPracticeSteps(2, {
    introTitle: "Round 2 — Practice R.E.M.",
    introBody: "Round 1 taught each step in detail. Now run Reveal → Explore → Meet on your own. Each screen lists exactly what unlocks Continue.",
    endBody: "Round 3 brings a Boss Dream. End this round when ready.",
  }),
  {
    id: "r3-intro",
    round: 3,
    title: "Round 3 — Boss Dream",
    body: "The third Dream awakens Cerberus on The Bed — a Boss Dreambeast. Bosses have harsh Fail effects if ignored. You'll still run the full R.E.M. loop this round.",
    target: "#phase-stepper",
  },
  {
    id: "r3-dream",
    round: 3,
    title: "Round 3 — Reveal: Boss Dream",
    body: "Draw & Resolve Dream now. Cerberus spawns on The Bed.",
    target: "#phase-actions",
    until: (s) => s.round >= 3 && s.dreamDrawn && bossOnBed(s),
    objective: (s) => {
      if (bossOnBed(s) && s.dreamDrawn) return "Cerberus awakened — press Continue.";
      if (!s.dreamDrawn) return "Click Draw & Resolve Dream.";
      return "Resolve the Dream to spawn Cerberus.";
    },
  },
  {
    id: "r3-boss-info",
    round: 3,
    title: "Boss Encounters",
    body: "Boss Dreams place a nightmare on The Bed. During Meet, only the Dreamer on The Bed may pool Psyche to Accept or Repress the boss.",
    target: "#active-encounter",
  },
  {
    id: "r3-lucidity",
    round: 3,
    title: "Round 3 — Reveal: Spend Lucidity",
    body: "Continue Reveal — spend Lucidity and reveal Landscapes as usual.",
    targets: ["#hand-bar", "#phase-actions"],
    until: (s) => revealDone(s, 3),
    objective: (s) => {
      if (revealDone(s, 3)) return "Reveal complete — press Continue.";
      if (!s.revealLandscapeUsed) return "Spend Lucidity and reveal at least one Landscape.";
      return "Finish revealing, or advance to Explore.";
    },
  },
  {
    id: "r3-to-explore",
    round: 3,
    title: "Round 3 — Enter Explore",
    body: "Click Next Phase when Reveal is done.",
    target: "#phase-advance-bar",
    until: (s) => s.round >= 3 && phaseAfter(s, "Reveal"),
    objective: (s) => (phaseAfter(s, "Reveal")
      ? "Explore phase started — press Continue."
      : "Click Next Phase to enter Explore."),
  },
  {
    id: "r3-elasticity",
    round: 3,
    title: "Round 3 — Explore: Spend Elasticity",
    body: "Spend Elasticity and move Dreamers. Consider moving onto The Bed before Meet.",
    targets: ["#hand-bar", "#phase-actions"],
    until: (s) => s.round >= 3 && (s.exploreActivated || getPhase(s) === "Meet"),
    objective: (s) => (s.exploreActivated || getPhase(s) === "Meet"
      ? "Elasticity spent — press Continue."
      : "Select 1–2 Elasticity cards, then click Spend Elasticity."),
  },
  {
    id: "r3-to-meet",
    round: 3,
    title: "Round 3 — Enter Meet",
    body: "Click Next Phase to enter Meet. Face Cerberus if you can, or advance the tutorial when ready.",
    target: "#phase-advance-bar",
    until: (s) => s.round >= 3 && getPhase(s) === "Meet",
    objective: (s) => (getPhase(s) === "Meet"
      ? "Meet phase started — press Continue."
      : "Click Next Phase to enter Meet."),
  },
  {
    id: "r3-willpower",
    round: 3,
    title: "Round 3 — Meet: Spend Willpower",
    body: "Gain Meet actions. Pool Psyche on The Bed to face Cerberus, or use other Meet actions.",
    targets: ["#hand-bar", "#phase-actions"],
    until: (s) => s.round >= 3 && s.meetActionBudget > 0,
    objective: (s) => (s.meetActionBudget > 0
      ? "Meet actions unlocked — press Continue."
      : "Select 1–2 Willpower cards, then click Gain Actions."),
  },
  {
    id: "r3-end",
    round: 3,
    title: "End Round 3",
    body: "You've seen a Boss spawn. Two tutorial rounds remain.",
    target: "#phase-advance-bar",
    until: (s) => s.round >= 4,
    objective: (s) => (s.round >= 4
      ? "Round 4 started — press Continue."
      : "Click Next Phase to end Round 3."),
  },
  {
    id: "r4-intro",
    round: 4,
    title: "Round 4 — Heroism & Death",
    body: "This round's Dream is Heroism (team draws Willpower Psyche). Then run R.E.M. again.",
    target: "#phase-stepper",
  },
  {
    id: "r4-dream",
    round: 4,
    title: "Round 4 — Reveal: Draw Dream",
    body: "Draw Heroism — each Dreamer draws one Willpower Psyche card.",
    target: "#phase-actions",
    until: (s) => s.round >= 4 && s.dreamDrawn,
    objective: (s) => (s.dreamDrawn
      ? "Dream drawn — press Continue."
      : "Click Draw & Resolve Dream."),
  },
  {
    id: "r4-death-rules",
    round: 4,
    title: "Death & Respawn",
    body: "At 0 Psyche you may spend Power Tokens to survive, or die: 1st death → 4 Psyche, 2nd → 3, 3rd → 2, 4th → 1. Fifth death removes that Dreamer permanently. Death also Represses the top of each Mindstream deck.",
    target: "#subconscious-graveyard",
  },
  {
    id: "r4-lucidity",
    round: 4,
    title: "Round 4 — Reveal: Spend Lucidity",
    body: "Spend Lucidity and reveal Landscapes.",
    targets: ["#hand-bar", "#phase-actions"],
    until: (s) => revealDone(s, 4),
    objective: (s) => {
      if (revealDone(s, 4)) return "Reveal complete — press Continue.";
      if (!s.revealLandscapeUsed) return "Spend Lucidity and reveal at least one Landscape.";
      return "Finish Reveal or click Next Phase.";
    },
  },
  {
    id: "r4-to-explore",
    round: 4,
    title: "Round 4 — Enter Explore",
    body: "Click Next Phase when Reveal is done.",
    target: "#phase-advance-bar",
    until: (s) => s.round >= 4 && phaseAfter(s, "Reveal"),
    objective: (s) => (phaseAfter(s, "Reveal")
      ? "Explore phase started — press Continue."
      : "Click Next Phase to enter Explore."),
  },
  {
    id: "r4-elasticity",
    round: 4,
    title: "Round 4 — Explore: Spend Elasticity",
    body: "Spend Elasticity and move on the map.",
    targets: ["#hand-bar", "#phase-actions"],
    until: (s) => s.round >= 4 && (s.exploreActivated || getPhase(s) === "Meet"),
    objective: (s) => (s.exploreActivated || getPhase(s) === "Meet"
      ? "Elasticity spent — press Continue."
      : "Select 1–2 Elasticity cards, then click Spend Elasticity."),
  },
  {
    id: "r4-to-meet",
    round: 4,
    title: "Round 4 — Enter Meet",
    body: "Click Next Phase to enter Meet.",
    target: "#phase-advance-bar",
    until: (s) => s.round >= 4 && getPhase(s) === "Meet",
    objective: (s) => (getPhase(s) === "Meet"
      ? "Meet phase started — press Continue."
      : "Click Next Phase to enter Meet."),
  },
  {
    id: "r4-willpower",
    round: 4,
    title: "Round 4 — Meet: Spend Willpower",
    body: "Gain Meet actions and use them freely.",
    targets: ["#hand-bar", "#phase-actions"],
    until: (s) => s.round >= 4 && s.meetActionBudget > 0,
    objective: (s) => (s.meetActionBudget > 0
      ? "Meet actions unlocked — press Continue."
      : "Select 1–2 Willpower cards, then click Gain Actions."),
  },
  {
    id: "r4-end",
    round: 4,
    title: "End Round 4",
    body: "One more tutorial round after this.",
    target: "#phase-advance-bar",
    until: (s) => s.round >= 5,
    objective: (s) => (s.round >= 5
      ? "Round 5 started — press Continue."
      : "Click Next Phase to end Round 4."),
  },
  ...remPracticeSteps(5, {
    introTitle: "Round 5 — Final R.E.M.",
    introBody: "Last practice round. Run Reveal → Explore → Meet one more time, then graduate.",
    endBody: "Finish Meet when ready — this is your last practice round.",
    endUntil: false,
  }),
  {
    id: "graduate",
    round: 5,
    title: "Tutorial Complete!",
    body: "You know the core loop: Dreams reshape the map, Psyche powers R.E.M., Power Tokens fuel abilities, and the Subconscious cycles through Repress and Return. Press Finish to return to setup and start a real Dream.",
    target: "#phase-stepper",
  },
];

export function getTutorialObjective(state, step) {
  if (!step) return "";

  if (!step.until) {
    if (typeof step.objective === "function") return step.objective(state);
    if (typeof step.objective === "string") return step.objective;
    return "";
  }

  if (step.until(state)) return "Objective complete — press Continue.";

  if (typeof step.objective === "function") return step.objective(state);
  if (typeof step.objective === "string") return step.objective;

  return "Complete the highlighted action to unlock Continue.";
}

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

  const objective = getTutorialObjective(state, step);

  return {
    step,
    stepIndex: state.tutorialStepIndex,
    total: TUTORIAL_SCRIPT.length,
    canAdvance: state.tutorialCanAdvance,
    round: step.round || state.round,
    objective,
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
