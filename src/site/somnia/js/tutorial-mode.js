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
    dreamsDrawn: 0,
    encounterResolved: false,
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
    "Tutorial Mode — 5 scripted rounds. Follow each objective to unlock Continue.",
    "Round 1 begins in the Reveal Phase.",
  ];
  return state;
}

// ── Progress helpers (robust gates for tutorial steps) ──

function bossOnBed(state) {
  return landscapeById(state, "bed")?.encounter?.id === "cerberus"
    || state.activeDream?.id === "cerberus";
}

function hasLuciditySelected(state) {
  const ids = new Set(state.selectedHand);
  return state.players.some((p) => p.hand.some((c) => ids.has(c.instanceId) && c.suit === "lucidity"));
}

function hasElasticitySelected(state) {
  const ids = new Set(state.selectedHand);
  return state.players.some((p) => p.hand.some((c) => ids.has(c.instanceId) && c.suit === "elasticity"));
}

function hasWillpowerSelected(state) {
  const ids = new Set(state.selectedHand);
  return state.players.some((p) => p.hand.some((c) => ids.has(c.instanceId) && c.suit === "willpower"));
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

function houseSelected(state) {
  return state.selectedLandscapeId === "house";
}

function houseEncounterCleared(state) {
  return !landscapeById(state, "house")?.encounter;
}

function phaseAfter(state, phase) {
  const order = ["Reveal", "Explore", "Meet"];
  const idx = order.indexOf(getPhase(state));
  return idx > order.indexOf(phase);
}

function atRound(state, minRound) {
  return state.round >= minRound;
}

function revealDone(state, minRound = 1) {
  if (state.round < minRound) return false;
  if (!state.dreamDrawn) return false;
  return state.revealLandscapeUsed || phaseAfter(state, "Reveal");
}

function houseMeetReady(state) {
  return dreamerOnHouse(state) && houseSelected(state);
}

/** R.E.M. loop steps for rounds 2, 4, and 5 (practice rounds). */
function remPracticeSteps(round, { introTitle, introBody, endBody, teachLandscapeActions = false } = {}) {
  const r = round;
  const steps = [
    {
      id: `r${r}-intro`,
      round: r,
      title: introTitle || `Round ${r} — R.E.M.`,
      body: introBody || `Run the loop: Reveal (Dream + Lucidity) → Explore (Elasticity + moves) → Meet (Willpower + actions). The phase tracker shows where you are.`,
      target: "#phase-stepper",
    },
    {
      id: `r${r}-dream`,
      round: r,
      title: `Round ${r} — Reveal: Draw Dream`,
      body: "Reveal always starts with the Head Dreamer (★) drawing one Dream card. Anyone may click Draw once the group agrees.",
      target: "#phase-actions",
      until: (s) => atRound(s, r) && s.dreamDrawn,
      objective: (s) => {
        if (!atRound(s, r)) return `Finish Round ${r - 1} first (click Next Phase).`;
        return s.dreamDrawn
          ? "Dream drawn — press Continue."
          : "Click Draw & Resolve Dream in the action bar.";
      },
    },
    {
      id: `r${r}-lucidity`,
      round: r,
      title: `Round ${r} — Reveal: Spend Lucidity`,
      body: "Select 1–2 Lucidity cards from any Dreamer's hand, click Reveal Landscapes, then flip at least one hidden hex.",
      targets: ["#hand-bar", "#phase-actions", "#board-viewport"],
      until: (s) => revealDone(s, r),
      objective: (s) => {
        if (!s.dreamDrawn) return "Draw the Dream first.";
        if (revealDone(s, r)) return "Reveal complete — press Continue.";
        if (s.landscapePick?.mode === "reveal") return "Click hidden hex tiles on the map to reveal them.";
        if (hasLuciditySelected(s)) return "Click Reveal Landscapes, then pick hex tiles.";
        return "Select 1–2 Lucidity cards, then click Reveal Landscapes.";
      },
    },
    {
      id: `r${r}-to-explore`,
      round: r,
      title: `Round ${r} — Enter Explore`,
      body: "When Reveal is finished, click Next Phase at the top of the table.",
      target: "#phase-advance-bar",
      until: (s) => atRound(s, r) && phaseAfter(s, "Reveal"),
      objective: (s) => (phaseAfter(s, "Reveal")
        ? "Explore phase started — press Continue."
        : "Click Next Phase to leave Reveal."),
    },
    {
      id: `r${r}-elasticity`,
      round: r,
      title: `Round ${r} — Explore: Spend Elasticity`,
      body: "Select 1–2 Elasticity cards, then Spend Elasticity to unlock shared team moves.",
      targets: ["#hand-bar", "#phase-actions"],
      until: (s) => atRound(s, r) && (s.exploreActivated || getPhase(s) === "Meet"),
      objective: (s) => {
        if (s.exploreActivated || getPhase(s) === "Meet") return "Elasticity spent — press Continue.";
        if (hasElasticitySelected(s)) return "Click Spend Elasticity in the action bar.";
        return "Select 1–2 Elasticity cards, then click Spend Elasticity.";
      },
    },
    {
      id: `r${r}-to-meet`,
      round: r,
      title: `Round ${r} — Enter Meet`,
      body: "Move Dreamers on the map if you want, then click Next Phase. Unused Explore moves can be skipped.",
      targets: ["#phase-advance-bar", "#board-viewport"],
      until: (s) => atRound(s, r) && getPhase(s) === "Meet",
      objective: (s) => (getPhase(s) === "Meet"
        ? "Meet phase started — press Continue."
        : "Click Next Phase to enter Meet."),
    },
    {
      id: `r${r}-willpower`,
      round: r,
      title: `Round ${r} — Meet: Spend Willpower`,
      body: "Select 1–2 Willpower cards, then Gain Actions. Each Landscape offers Draw [suit] Mindstream (Action A) plus a unique Action B.",
      targets: ["#hand-bar", "#phase-actions"],
      until: (s) => atRound(s, r) && s.meetActionBudget > 0,
      objective: (s) => {
        if (s.meetActionBudget > 0) return "Meet actions unlocked — press Continue.";
        if (hasWillpowerSelected(s)) return "Click Gain Actions in the action bar.";
        return "Select 1–2 Willpower cards, then click Gain Actions.";
      },
    },
  ];

  if (teachLandscapeActions) {
    steps.push({
      id: `r${r}-landscape-actions`,
      round: r,
      title: `Round ${r} — Landscape Actions`,
      body: "Stand on a Landscape, select its hex, and spend a Meet action. Action A draws that tile's Mindstream; Action B is unique. Switch Dreamer chips to act as a different Dreamer.",
      targets: ["#board-viewport", "#phase-actions", "#player-list"],
      objective: "Try a Landscape action if you like, then press Continue.",
    });
  }

  steps.push({
    id: `r${r}-end`,
    round: r,
    title: `End Round ${r}`,
    body: endBody || "Spend remaining Meet actions if you want, then click Next Phase to end the round.",
    target: "#phase-advance-bar",
    until: (s) => s.round >= r + 1,
    objective: (s) => (s.round >= r + 1
      ? `Round ${r + 1} started — press Continue.`
      : "Click Next Phase to end the Meet phase and start the next round."),
  });

  return steps;
}

/** Linear guided script — player must complete highlighted actions between steps. */
export const TUTORIAL_SCRIPT = [
  {
    id: "welcome",
    round: 1,
    title: "Welcome to Somnia",
    body: "Five guided rounds teach cooperative play. Each step shows an objective — complete it to unlock Continue. Discuss and plan together; there is no turn order within a phase.",
    target: null,
  },
  {
    id: "rem-intro",
    round: 1,
    title: "R.E.M. & Psyche",
    body: "Every round: Reveal (Lucidity) → Explore (Elasticity) → Meet (Willpower). One Dreamer spends 1–2 suited Psyche cards per phase to set the team budget; their Dreamer stat adds bonus value.",
    target: "#phase-stepper",
  },
  {
    id: "progress",
    round: 1,
    title: "Archetypes & Power",
    body: "Complete both quests on the Active Archetype (1 Power Token each), then Acquire for points. Reach 12 points before the Dream Deck runs out. Power Tokens (max 24 team-wide) also fuel Dreamer powers.",
    targets: ["#active-archetype", "#power-tokens"],
  },
  {
    id: "subconscious",
    round: 1,
    title: "The Subconscious",
    body: "Repressed cards go face-up here. Return effects pull cards back to discard piles so decks cycle. Repress and Return are core to survival.",
    target: "#subconscious-graveyard",
  },
  {
    id: "draw-dream-r1",
    round: 1,
    title: "Draw the Dream",
    body: "The Head Dreamer (★) draws one Dream per round. Click Draw & Resolve Dream — Round 1 uses Quiet (no effect).",
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
    body: "Select 1–2 Lucidity cards from The Visionary's hand (best Lucidity stat), then click Reveal Landscapes.",
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
    body: "Click hidden hex tiles on the map to flip them face-up. Reveal at least one Landscape.",
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
    body: "Click Next Phase at the top of the table to enter Explore.",
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
    body: "Select 1–2 Elasticity cards from The Runner's hand (best Elasticity stat), then click Spend Elasticity.",
    targets: ["#hand-bar", "#phase-actions"],
    until: (s) => s.exploreActivated,
    objective: (s) => {
      if (s.exploreActivated) return "Elasticity spent — press Continue.";
      if (hasElasticitySelected(s)) return "Click Spend Elasticity in the action bar.";
      return "Select 1–2 Elasticity cards from The Runner's hand.";
    },
  },
  {
    id: "explore-move-r1",
    round: 1,
    title: "Explore the Map",
    body: "Click a Dreamer chip, then move onto House — a Mandrake Encounter waits there.",
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
    body: "Click Next Phase to enter Meet. Confirm if prompted to forfeit unused Explore moves.",
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
    body: "Select 1–2 Willpower cards, then click Gain Actions to unlock shared Meet actions.",
    targets: ["#hand-bar", "#phase-actions"],
    until: (s) => s.meetActionBudget > 0,
    objective: (s) => {
      if (s.meetActionBudget > 0) return "Meet actions unlocked — press Continue.";
      if (hasWillpowerSelected(s)) return "Click Gain Actions in the action bar.";
      return "Select 1–2 Willpower cards, then click Gain Actions.";
    },
  },
  {
    id: "select-house-r1",
    round: 1,
    title: "Select House on the Map",
    body: "Click the House hex so the Encounter panel appears. Only the Dreamer standing on that Landscape may pool Psyche for it.",
    targets: ["#board-viewport", "#active-encounter"],
    until: (s) => houseMeetReady(s) || houseEncounterCleared(s),
    objective: (s) => {
      if (houseEncounterCleared(s)) return "Encounter already resolved — press Continue.";
      if (houseMeetReady(s)) return "House selected — press Continue.";
      if (dreamerOnHouse(s)) return "Click the House hex on the map.";
      return "Move a Dreamer onto House, then click the House hex.";
    },
  },
  {
    id: "encounter-r1",
    round: 1,
    title: "Resolve the Encounter",
    body: "Pool up to 3 Psyche from the Dreamer on House, then Accept (ally joins hand as 3 Psyche) or Reject (exile to Subconscious + reward).",
    targets: ["#hand-bar", "#active-encounter", "#phase-actions"],
    until: (s) => houseEncounterCleared(s) || s.tutorialFlags?.encounterResolved,
    objective: (s) => {
      if (houseEncounterCleared(s)) return "Encounter resolved — press Continue.";
      if (hasMeetPool(s)) return "Click Accept or Reject to resolve the Encounter.";
      if (!houseMeetReady(s)) return "Select the House hex on the map.";
      return "Select up to 3 Psyche cards from the Dreamer on House.";
    },
  },
  {
    id: "end-r1",
    round: 1,
    title: "End Round 1",
    body: "Click Next Phase to end Meet and start Round 2. From Round 2 on, each Dreamer draws 2 Psyche at round start (Round 1 started with 5 each).",
    target: "#phase-advance-bar",
    until: (s) => s.round >= 2,
    objective: (s) => (s.round >= 2
      ? "Round 2 started — press Continue."
      : "Click Next Phase to end Round 1."),
  },
  ...remPracticeSteps(2, {
    introTitle: "Round 2 — Practice R.E.M.",
    introBody: "Round 1 walked through each step. Now run Reveal → Explore → Meet with less hand-holding. Each screen lists what unlocks Continue.",
    endBody: "Round 3 brings a Boss Dream. End this round when ready.",
    teachLandscapeActions: true,
  }),
  {
    id: "r3-intro",
    round: 3,
    title: "Round 3 — Boss Dream",
    body: "The third Dream in this tutorial awakens Cerberus on The Bed. Bosses have strict play shapes and harsh Fail effects if ignored at end of Meet.",
    target: "#phase-stepper",
  },
  {
    id: "r3-dream",
    round: 3,
    title: "Round 3 — Reveal: Boss Dream",
    body: "Draw & Resolve Dream. Cerberus spawns on The Bed. During Meet, only the Dreamer on The Bed may pool Psyche to face a boss.",
    targets: ["#phase-actions", "#active-encounter"],
    until: (s) => atRound(s, 3) && s.dreamDrawn && bossOnBed(s),
    objective: (s) => {
      if (bossOnBed(s) && s.dreamDrawn) return "Cerberus awakened — press Continue.";
      if (!atRound(s, 3)) return "End Round 2 first (click Next Phase).";
      if (!s.dreamDrawn) return "Click Draw & Resolve Dream.";
      return "Resolve the Dream to spawn Cerberus on The Bed.";
    },
  },
  {
    id: "r3-lucidity",
    round: 3,
    title: "Round 3 — Reveal: Spend Lucidity",
    body: "Finish Reveal — spend Lucidity and reveal Landscapes as usual.",
    targets: ["#hand-bar", "#phase-actions"],
    until: (s) => revealDone(s, 3),
    objective: (s) => {
      if (revealDone(s, 3)) return "Reveal complete — press Continue.";
      if (!s.dreamDrawn) return "Draw the Dream first.";
      if (!s.revealLandscapeUsed) return "Spend Lucidity and reveal at least one Landscape.";
      return "Finish revealing, or click Next Phase.";
    },
  },
  {
    id: "r3-to-explore",
    round: 3,
    title: "Round 3 — Enter Explore",
    body: "Click Next Phase when Reveal is done. Consider moving onto The Bed before Meet.",
    target: "#phase-advance-bar",
    until: (s) => atRound(s, 3) && phaseAfter(s, "Reveal"),
    objective: (s) => (phaseAfter(s, "Reveal")
      ? "Explore phase started — press Continue."
      : "Click Next Phase to enter Explore."),
  },
  {
    id: "r3-elasticity",
    round: 3,
    title: "Round 3 — Explore: Spend Elasticity",
    body: "Spend Elasticity and move Dreamers. The Bed holds Cerberus if you want to face the boss during Meet.",
    targets: ["#hand-bar", "#phase-actions", "#board-viewport"],
    until: (s) => atRound(s, 3) && (s.exploreActivated || getPhase(s) === "Meet"),
    objective: (s) => (s.exploreActivated || getPhase(s) === "Meet"
      ? "Elasticity spent — press Continue."
      : "Select 1–2 Elasticity cards, then click Spend Elasticity."),
  },
  {
    id: "r3-to-meet",
    round: 3,
    title: "Round 3 — Enter Meet",
    body: "Click Next Phase to enter Meet. You may face Cerberus or end the round — bosses fail if left unresolved.",
    target: "#phase-advance-bar",
    until: (s) => atRound(s, 3) && getPhase(s) === "Meet",
    objective: (s) => (getPhase(s) === "Meet"
      ? "Meet phase started — press Continue."
      : "Click Next Phase to enter Meet."),
  },
  {
    id: "r3-willpower",
    round: 3,
    title: "Round 3 — Meet: Spend Willpower",
    body: "Gain Meet actions. Facing Cerberus requires a specific Psyche spread (set of 3) — read the Encounter panel.",
    targets: ["#hand-bar", "#phase-actions"],
    until: (s) => atRound(s, 3) && s.meetActionBudget > 0,
    objective: (s) => (s.meetActionBudget > 0
      ? "Meet actions unlocked — press Continue."
      : "Select 1–2 Willpower cards, then click Gain Actions."),
  },
  {
    id: "r3-end",
    round: 3,
    title: "End Round 3",
    body: "You've seen a Boss spawn. Two practice rounds remain.",
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
    body: "This round's Dream is Heroism — each Dreamer draws Psyche equal to their Willpower. You'll also learn what happens at 0 Psyche.",
    target: "#phase-stepper",
  },
  {
    id: "r4-dream",
    round: 4,
    title: "Round 4 — Reveal: Draw Dream",
    body: "Draw Heroism and resolve its effect, then continue Reveal as usual.",
    target: "#phase-actions",
    until: (s) => atRound(s, 4) && s.dreamDrawn,
    objective: (s) => {
      if (!atRound(s, 4)) return "End Round 3 first.";
      return s.dreamDrawn
        ? "Dream drawn — press Continue."
        : "Click Draw & Resolve Dream.";
    },
  },
  {
    id: "r4-death-rules",
    round: 4,
    title: "Death & Respawn",
    body: "At 0 Psyche, spend Power Tokens to survive or accept death: respawn on The Bed with 4/3/2/1 Psyche (by death count) and 2 Power. Fifth death removes that Dreamer. Death Represses the top of each Mindstream deck.",
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
      if (!s.dreamDrawn) return "Draw the Dream first.";
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
    until: (s) => atRound(s, 4) && phaseAfter(s, "Reveal"),
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
    until: (s) => atRound(s, 4) && (s.exploreActivated || getPhase(s) === "Meet"),
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
    until: (s) => atRound(s, 4) && getPhase(s) === "Meet",
    objective: (s) => (getPhase(s) === "Meet"
      ? "Meet phase started — press Continue."
      : "Click Next Phase to enter Meet."),
  },
  {
    id: "r4-willpower",
    round: 4,
    title: "Round 4 — Meet: Spend Willpower",
    body: "Gain Meet actions and use them freely. Switch Dreamer chips to act as different Dreamers.",
    targets: ["#hand-bar", "#phase-actions", "#player-list"],
    until: (s) => atRound(s, 4) && s.meetActionBudget > 0,
    objective: (s) => (s.meetActionBudget > 0
      ? "Meet actions unlocked — press Continue."
      : "Select 1–2 Willpower cards, then click Gain Actions."),
  },
  {
    id: "r4-end",
    round: 4,
    title: "End Round 4",
    body: "One more practice round after this.",
    target: "#phase-advance-bar",
    until: (s) => s.round >= 5,
    objective: (s) => (s.round >= 5
      ? "Round 5 started — press Continue."
      : "Click Next Phase to end Round 4."),
  },
  ...remPracticeSteps(5, {
    introTitle: "Round 5 — Final Practice",
    introBody: "Last guided round. Run R.E.M. one more time, then graduate.",
    endBody: "Finish Meet and click Next Phase to complete the tutorial.",
  }),
  {
    id: "graduate",
    round: 5,
    title: "Tutorial Complete!",
    body: "You learned R.E.M., Encounters, Landscape actions, Dreams, Bosses, Power Tokens, and the Subconscious. Use the Guide panel in-game and Help for the full rules. Press Finish to return to setup.",
    target: "#phase-stepper",
  },
];

export function getTutorialObjective(state, step) {
  if (!step) return "";

  if (!step.until) {
    if (typeof step.objective === "function") return step.objective(state);
    if (typeof step.objective === "string") return step.objective;
    return "Read the step, then press Continue.";
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

/** Skip past steps whose gates are already satisfied (e.g. after reload or fast play). */
function catchUpTutorialIndex(state) {
  let guard = 0;
  while (guard++ < TUTORIAL_SCRIPT.length) {
    const step = TUTORIAL_SCRIPT[state.tutorialStepIndex];
    if (!step) break;
    if (!step.until || !step.until(state)) break;
    if (state.tutorialStepIndex >= TUTORIAL_SCRIPT.length - 1) break;
    state.tutorialStepIndex += 1;
  }
}

export function syncTutorial(state) {
  if (!state?.tutorialMode || state.tutorialComplete) return null;

  catchUpTutorialIndex(state);

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

export function notifyTutorialEncounterResolved(state, landscapeId) {
  if (!state?.tutorialMode) return;
  if (landscapeId === "house") {
    state.tutorialFlags.encounterResolved = true;
  }
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
