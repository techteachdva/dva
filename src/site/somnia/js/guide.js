import { getPhase, activePlayer, headPlayer } from "./state.js";
import {
  revealBudget,
  exploreBudget,
  meetActionBudgetFromWillpower,
  coopMeetPlayTotal,
  allSelectedCards,
  SUIT_LABELS,
  suitIconHtml,
} from "./rules.js";

const TUTORIAL_KEY = "somnia_tutorial_seen";

export const TUTORIAL_STEPS = [
  {
    id: "welcome",
    title: "Welcome to Somnia",
    body: "You are Dreamers trapped in a collapsing Dreamscape. Cooperate to earn Archetype points before the Dream Deck runs out — or never wake up.",
    target: null,
  },
  {
    id: "goal",
    title: "How You Win",
    body: "Complete quests on the Active Archetype (right panel), acquire it for points, and repeat until you reach your goal. The Head Dreamer draws a new Dream card each round.",
    target: "#active-archetype",
  },
  {
    id: "suits",
    title: "Three Suits of Psyche",
    body: "Blue Lucidity reveals the map. Yellow Elasticity moves Dreamers. Red Willpower powers Meet actions. Your Dreamer's stats add to card values you play.",
    target: "#hand-bar",
  },
  {
    id: "reveal",
    title: "Reveal Phase",
    body: "Select 1–2 blue Lucidity cards in your hand, then click Reveal Landscapes. The Head Dreamer should also Draw the Dream card once per round.",
    target: "#phase-actions",
    phase: "Reveal",
  },
  {
    id: "explore",
    title: "Explore Phase",
    body: "Select 1–2 yellow Elasticity cards, click Spend Elasticity, then click green highlighted hexes to move the active Dreamer.",
    target: "#hex-board",
    phase: "Explore",
  },
  {
    id: "meet",
    title: "Meet Phase",
    body: "The focused Dreamer selects 1–2 red Willpower cards and clicks Gain Actions. Then everyone pools up to 3 Psyche to Accept or Repress Encounters.",
    target: "#phase-actions",
    phase: "Meet",
  },
  {
    id: "done",
    title: "You're Ready",
    body: "Use the Guide panel anytime for your next step. Open Help → How to Play for the full reference. Good luck escaping the Dreamscape!",
    target: "#guide-panel",
  },
];

export function hasSeenTutorial() {
  try {
    return localStorage.getItem(TUTORIAL_KEY) === "1";
  } catch {
    return false;
  }
}

export function markTutorialSeen() {
  try {
    localStorage.setItem(TUTORIAL_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function resetTutorialFlag() {
  try {
    localStorage.removeItem(TUTORIAL_KEY);
  } catch {
    /* ignore */
  }
}

/** Plain-language next step for the guide panel. */
export function getCurrentObjective(state) {
  if (!state) return null;
  const phase = getPhase(state);
  const player = activePlayer(state);
  const head = headPlayer(state);

  if (phase === "Reveal") {
    if (!state.dreamDrawn && head === player) {
      return {
        phase: "Reveal",
        suit: "lucidity",
        title: "Draw the Dream",
        steps: [
          "You are the Head Dreamer this round (★).",
          "Click **Draw & Resolve Dream** to see what the Dreamscape does.",
        ],
        tip: "Only the Head draws once per round.",
      };
    }
    if (!state.dreamDrawn && head !== player) {
      return {
        phase: "Reveal",
        suit: "lucidity",
        title: "Wait for the Dream",
        steps: [
          `**${head.name}** (Head) should draw the Dream card.`,
          "Meanwhile, prepare blue Lucidity Psyche in your hand.",
        ],
      };
    }
    if (!state.revealLandscapeUsed) {
      const budget = revealBudget(state, player);
      return {
        phase: "Reveal",
        suit: "lucidity",
        title: "Reveal Landscapes",
        steps: [
          "Click **1–2 blue Lucidity** cards in your hand to select them.",
          budget >= 1
            ? `Click **Reveal Landscapes** (budget: ${budget} = cards + ${player.dreamer.lucidity} Lucidity).`
            : "Select 1–2 Lucidity cards — value + your Lucidity stat = reveal budget.",
        ],
        tip: "Revealing opens new hexes on the board.",
      };
    }
    return {
      phase: "Reveal",
      suit: "lucidity",
      title: "Reveal complete",
      steps: ["Click **Next: Explore** when your group is ready."],
    };
  }

  if (phase === "Explore") {
    if (!state.exploreActivated) {
      const budget = exploreBudget(state, player);
      return {
        phase: "Explore",
        suit: "elasticity",
        title: "Activate movement",
        steps: [
          "Select **1–2 yellow Elasticity** Psyche cards.",
          budget >= 1
            ? `Click **Spend Elasticity** (${budget} moves).`
            : "Then click Spend Elasticity to unlock moves.",
        ],
      };
    }
    if (state.exploreMovesLeft > 0) {
      return {
        phase: "Explore",
        suit: "elasticity",
        title: "Move on the board",
        steps: [
          `Click a **green dashed hex** to move ${player.name}.`,
          `${state.exploreMovesLeft} move(s) remaining.`,
        ],
        tip: "Click a Dreamer chip (left) to change who moves.",
      };
    }
    return {
      phase: "Explore",
      suit: "elasticity",
      title: "Exploration done",
      steps: ["Click **Next: Meet** to continue the round."],
    };
  }

  if (phase === "Meet") {
    if (state.meetActionBudget === 0) {
      const budget = meetActionBudgetFromWillpower(state, player);
      return {
        phase: "Meet",
        suit: "willpower",
        title: "Gain shared actions",
        steps: [
          `Focused Dreamer: **${player.name}** (click a chip to change).`,
          "Select **1–2 red Willpower** Psyche, then **Gain Actions**.",
          budget >= 1 ? `Budget will be: ${budget}.` : "Cards played + Willpower stat = action count.",
        ],
        tip: "Actions are shared by all Dreamers.",
      };
    }
    const pool = coopMeetPlayTotal(state);
    const count = allSelectedCards(state).length;
    const lines = [
      `**${state.meetActionsUsed}/${state.meetActionBudget}** shared actions used.`,
      "All Dreamers: click Psyche cards to pool up to **3** for Meet plays.",
      `Current pool: **${count}/3** cards, total **${pool}**.`,
    ];
    if (state.activeEncounter) {
      lines.push(`Encounter **${state.activeEncounter.name}**: Accept (${state.activeEncounter.accept}) or Repress (${state.activeEncounter.repress}).`);
    } else {
      lines.push("Use actions for Landscape Actions, Objects, Trade, or Quests — or **End Round**.");
    }
    return {
      phase: "Meet",
      suit: "willpower",
      title: state.activeEncounter ? "Meet the Encounter" : "Spend Meet actions",
      steps: lines,
      tip: "You cannot repeat the same action type twice in a row.",
    };
  }

  return null;
}

/** Short tooltip for a Dreamer chip — changes by phase and player role. */
export function getDreamerChipTooltip(state, player, index) {
  const phase = getPhase(state);
  const isActive = index === state.activePlayerIndex;
  const name = player.name;

  if (!player.alive) {
    return `${name} is lost. Choose a new Dreamer to respawn on The Bed.`;
  }

  if (phase === "Reveal") {
    if (player.isHead && isActive) {
      return `${name} ★ Head — Draw the Dream, then play blue Lucidity to reveal Landscapes.`;
    }
    if (player.isHead) {
      return `${name} ★ Head this round — draws the Dream when active. Click to focus them.`;
    }
    if (isActive) {
      const budget = revealBudget(state, player);
      const b = budget > 0 ? `${budget} reveal budget` : "select 1–2 Lucidity cards";
      return `Active — ${b}, then click Reveal Landscapes.`;
    }
    return `Click to focus ${name}. Play Lucidity to help reveal Landscapes.`;
  }

  if (phase === "Explore") {
    if (isActive) {
      if (!state.exploreActivated) {
        const budget = exploreBudget(state, player);
        const b = budget > 0 ? `${budget} moves` : "select 1–2 Elasticity cards";
        return `Active mover — ${b}, then Spend Elasticity and click green hexes.`;
      }
      return `Active mover — ${state.exploreMovesLeft} move(s) left. Click green hexes on the board.`;
    }
    return `Click to move ${name}. They spend Elasticity, then you pick destination hexes.`;
  }

  if (phase === "Meet") {
    if (isActive) {
      if (state.meetActionBudget === 0) {
        const budget = meetActionBudgetFromWillpower(state, player);
        const b = budget > 0 ? `${budget} actions` : "select 1–2 Willpower cards";
        return `Focused — ${name} pays Willpower for ${b} shared Meet actions.`;
      }
      const pool = allSelectedCards(state).length;
      return `Focused — ${state.meetActionsUsed}/${state.meetActionBudget} actions used. Pool: ${pool}/3 Psyche.`;
    }
    if (state.meetActionBudget > 0) {
      return `Click to focus ${name}. All Dreamers can click Psyche to pool (max 3 total).`;
    }
    return `Click to focus ${name} — they pay Willpower to unlock Meet actions for everyone.`;
  }

  return `Click to focus ${name}.`;
}

export function overviewHtml() {
  return `
    <div class="overview-page">
      <h2>Somnia — One-Page Overview</h2>
      <p class="overview-tagline">Cooperative dream escape. Earn Archetype points before the Dream Deck runs out.</p>

      <section class="overview-block">
        <h3>Goal</h3>
        <p>Complete both quests on the Active Archetype, acquire it for points, repeat until you hit your goal. Lose if the Dream Deck empties or everyone is trapped.</p>
      </section>

      <section class="overview-block overview-phases">
        <h3>Every Round (3 Phases)</h3>
        <div class="overview-phase suit-lucidity">
          <div class="overview-phase-head">${suitIconHtml("lucidity", { size: 16 })} <strong>Reveal</strong></div>
          <p>Head Dreamer (★) draws the Dream. Everyone plays blue <strong>Lucidity</strong> Psyche to reveal Landscapes on the map.</p>
        </div>
        <div class="overview-phase suit-elasticity">
          <div class="overview-phase-head">${suitIconHtml("elasticity", { size: 16 })} <strong>Explore</strong></div>
          <p>Focus a Dreamer (click their chip). Play yellow <strong>Elasticity</strong>, then move them across green hexes.</p>
        </div>
        <div class="overview-phase suit-willpower">
          <div class="overview-phase-head">${suitIconHtml("willpower", { size: 16 })} <strong>Meet</strong></div>
          <p>Focused Dreamer plays red <strong>Willpower</strong> for shared actions. Pool up to 3 Psyche to Accept/Repress Encounters or spend actions on tiles, Objects, Trade, and Quests.</p>
        </div>
      </section>

      <section class="overview-block overview-cols">
        <div>
          <h3>Psyche</h3>
          <ul>
            <li>Click to select · double-click to inspect</li>
            <li>Play 1–2 cards per action; Dreamer stat adds to value</li>
            <li>Blue / yellow / red match Reveal / Explore / Meet</li>
          </ul>
        </div>
        <div>
          <h3>Key Actions</h3>
          <ul>
            <li><strong>Encounter</strong> — pool Psyche, Accept or Repress</li>
            <li><strong>Quests</strong> — 1 Power each, then Acquire</li>
            <li><strong>Trade</strong> — same or adjacent hex</li>
            <li><strong>End Round</strong> — after Meet actions spent</li>
          </ul>
        </div>
      </section>

      <section class="overview-block">
        <h3>Roles</h3>
        <p><strong>Head Dreamer (★)</strong> rotates each round and draws the Dream. <strong>Focused Dreamer</strong> (highlighted chip) is who you move in Explore and who pays Willpower in Meet — click any chip to switch.</p>
      </section>

      <p class="overview-footer">Use the <strong>Guide</strong> panel in-game for your next step. Open <strong>How to Play</strong> for the full rules.</p>
    </div>
  `;
}

export function rulesHtml() {
  return `
    <h2>How to Play Somnia</h2>
    <p class="rules-lead">Cooperative escape — earn Archetype points before the Dream Deck empties.</p>

    <h3>Each Round</h3>
    <ol class="rules-rounds">
      <li><span class="rules-suit suit-lucidity">${suitIconHtml("lucidity", { size: 14 })} <strong>Reveal</strong></span> — Head draws Dream. Play blue Lucidity to reveal Landscapes.</li>
      <li><span class="rules-suit suit-elasticity">${suitIconHtml("elasticity", { size: 14 })} <strong>Explore</strong></span> — Play yellow Elasticity. Move Dreamers on the hex board.</li>
      <li><span class="rules-suit suit-willpower">${suitIconHtml("willpower", { size: 14 })} <strong>Meet</strong></span> — Play red Willpower for shared actions. Pool Psyche to face Encounters.</li>
    </ol>

    <h3>Psyche Cards</h3>
    <p>Click cards to <strong>select</strong> (highlighted border). Double-click to inspect. Play 1–2 suited cards per phase action; your Dreamer's matching stat adds to the budget.</p>

    <h3>Meet Actions</h3>
    <ul>
      <li><strong>Meet Encounter</strong> — Pool up to 3 Psyche (any Dreamers). Accept or Repress.</li>
      <li><strong>Landscape / Mindstream / Objects</strong> — Use a shared action on the selected tile.</li>
      <li><strong>Trade</strong> — With a Dreamer on the same or adjacent hex.</li>
      <li><strong>Quests</strong> — Spend 1 Power Token on the Active Archetype when conditions are met.</li>
    </ul>

    <h3>Win & Lose</h3>
    <p>Acquire Archetypes by completing both quests. Reach your point goal before Dreams run out. If a Dreamer has 0 Psyche at round start, they are lost (respawn on The Bed).</p>
  `;
}
