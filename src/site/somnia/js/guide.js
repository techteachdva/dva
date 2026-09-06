import { getPhase, activePlayer, headPlayer } from "./state.js";
import {
  revealBudget,
  exploreBudget,
  meetActionBudgetFromWillpower,
  coopMeetPlayTotal,
  allSelectedCards,
  SUIT_LABELS,
  suitIconHtml,
  findPhaseContributor,
  bestPhaseContributor,
  projectedPhaseBudget,
  statForPhaseBudget,
  totalStat,
} from "./rules.js";
import { musicCreditHtml } from "./audio.js";

const TUTORIAL_KEY = "somnia_tutorial_seen";

export const COOP_PLAY_TIP = "Discuss and plan together — there is no turn order within a phase. Act in whatever sequence helps the team.";

export const TUTORIAL_STEPS = [
  {
    id: "welcome",
    title: "Welcome to Somnia",
    body: "You are Dreamers trapped in a collapsing Dreamscape. Cooperate to earn Archetype points before the Dream Deck runs out — or never wake up. Talk through each phase; there is no turn order.",
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
    body: "Each phase, one Dreamer spends 1–2 suited Psyche to set the team's budget. Pick the Dreamer with the highest matching stat. The table may discuss and act in any order before advancing.",
    target: "#hand-bar",
  },
  {
    id: "reveal",
    title: "Reveal Phase",
    body: "Discuss, then draw the Dream and/or set reveal budget in any order. Anyone may click Draw & Resolve Dream for the Head Dreamer (★). One Dreamer spends Lucidity for team reveals.",
    target: "#phase-actions",
    phase: "Reveal",
  },
  {
    id: "explore",
    title: "Explore Phase",
    body: "Discuss who should spend Elasticity, then unlock shared moves. Click Dreamer chips and green hexes in any order until moves run out.",
    target: "#board-viewport",
    phase: "Explore",
  },
  {
    id: "meet",
    title: "Meet Phase",
    body: "Discuss who spends Willpower, then take Meet actions in any order. Pool up to 3 Psyche from any Dreamers for Encounters and other actions.",
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

  if (state.pendingDeathAdditionalDream) {
    return {
      phase: getPhase(state),
      suit: "lucidity",
      title: "Dreamer died — new Dream",
      steps: [
        "A Dreamer lost all Psyche and died in the Dream.",
        "They respawned on The Bed with 5 Psyche; an Additional Dream is resolving.",
      ],
    };
  }

  const phase = getPhase(state);
  const player = activePlayer(state);
  const head = headPlayer(state);

  if (state.landscapePick?.mode === "forget") {
    return {
      phase: getPhase(state),
      suit: "willpower",
      title: "Click map tiles to Forget",
      steps: [
        `Click **${state.landscapePick.remaining}** active Landscape hex tile(s) on the map.`,
        "Each becomes a Wasteland. If all Landscapes fall, The Bed flips to Final Recurrence.",
      ],
      tip: "Tiles glow red when clickable.",
    };
  }

  if (phase === "Reveal") {
    if (!state.dreamDrawn || (!state.revealLandscapeUsed && !state.landscapePick)) {
      if (state.landscapePick?.mode === "reveal" && !state.revealLandscapeUsed) {
        return {
          phase: "Reveal",
          suit: "lucidity",
          title: "Click map tiles to Reveal",
          steps: [
            `Click **${state.landscapePick.remaining}** hex tile(s) with the Wasteland back on the map.`,
            "Anyone may click tiles — order does not matter.",
          ],
          tip: "Tiles glow cyan when clickable.",
        };
      }
      const contributor = findPhaseContributor(state);
      const best = bestPhaseContributor(state);
      const budget = contributor ? revealBudget(state, contributor) : (best ? projectedPhaseBudget(state, best) : 0);
      const stat = statForPhaseBudget("Reveal", state);
      const steps = [
        COOP_PLAY_TIP,
      ];
      if (!state.dreamDrawn) {
        steps.push(`When the group agrees, anyone clicks **Draw & Resolve Dream** (${head.name} is Head ★).`);
      }
      if (state.dreamDrawn && !state.revealLandscapeUsed) {
        steps.push(
          "One Dreamer spends **1–2 Lucidity** to set the team reveal budget.",
          best
            ? `**${best.name}** has the best Lucidity bonus (+${totalStat(best, stat)}).`
            : "Pick the Dreamer with the highest Lucidity stat.",
        );
        if (budget >= 1) {
          steps.push(`Click **Reveal Landscapes** (${budget} reveals), then click hex tiles in any order.`);
        }
      }
      return {
        phase: "Reveal",
        suit: state.dreamDrawn ? "lucidity" : null,
        title: state.dreamDrawn ? "Reveal Landscapes" : "Draw the Dream",
        steps,
        tip: state.dreamDrawn
          ? "After the Dream is resolved, one Dreamer spends Lucidity for team reveals."
          : "Draw & Resolve the Dream first — Lucidity reveals unlock afterward.",
      };
    }
    if (state.landscapePick?.mode === "reveal" && !state.revealLandscapeUsed) {
      return {
        phase: "Reveal",
        suit: "lucidity",
        title: "Click map tiles to Reveal",
        steps: [
          `Click **${state.landscapePick.remaining}** hex tile(s) with the Wasteland back on the map.`,
          "Each click flips a tile to its active Landscape face.",
        ],
        tip: "Tiles glow cyan when clickable.",
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
      const contributor = findPhaseContributor(state);
      const best = bestPhaseContributor(state);
      const budget = contributor ? exploreBudget(state, contributor) : (best ? projectedPhaseBudget(state, best) : 0);
      const stat = statForPhaseBudget("Explore", state);
      return {
        phase: "Explore",
        suit: "elasticity",
        title: "Activate movement",
        steps: [
          COOP_PLAY_TIP,
          "One Dreamer spends **1–2 Elasticity** cards to set **shared team moves**.",
          best
            ? `**${best.name}** has the best Elasticity bonus (+${totalStat(best, stat)}).`
            : "Pick the Dreamer with the highest Elasticity stat.",
          budget >= 1
            ? `Click **Spend Elasticity** (${budget} moves for everyone).`
            : "Then click Spend Elasticity to unlock moves.",
        ],
        tip: "After unlocking, move any Dreamer in any order.",
      };
    }
    if (state.exploreMovesLeft > 0) {
      return {
        phase: "Explore",
        suit: "elasticity",
        title: "Move on the board",
        steps: [
          `Click a **green dashed hex** to move ${player.name}.`,
          `${state.exploreMovesLeft} team move(s) remaining — any order.`,
        ],
        tip: "Click Dreamer chips to choose who moves next.",
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
      const contributor = findPhaseContributor(state);
      const best = bestPhaseContributor(state);
      const budget = contributor ? meetActionBudgetFromWillpower(state, contributor) : (best ? projectedPhaseBudget(state, best) : 0);
      const stat = statForPhaseBudget("Meet", state);
      return {
        phase: "Meet",
        suit: "willpower",
        title: "Gain shared actions",
        steps: [
          COOP_PLAY_TIP,
          "One Dreamer spends **1–2 Willpower** cards to set **shared Meet actions**.",
          best
            ? `**${best.name}** has the best Willpower bonus (+${totalStat(best, stat)}).`
            : "Pick the Dreamer with the highest Willpower stat.",
          budget >= 1 ? `Budget will be: **${budget}** team actions.` : "Cards played + Willpower stat = action count.",
        ],
        tip: "Then spend Meet actions in any order.",
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
      lines.push("Use actions in any order — Landscape, Objects, Trade, Quests, or **End Round**.");
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
  const best = bestPhaseContributor(state);

  if (phase === "Reveal") {
    if (player.isHead) {
      return `${name} ★ Head — anyone can Draw the Dream after the group agrees.`;
    }
    if (best?.id === player.id) {
      return `${name} — best Lucidity bonus (+${totalStat(player, "lucidity")}). Strong candidate to spend for reveals.`;
    }
    return `${name} — discuss Reveal plans. Anyone may draw the Dream or spend Lucidity when ready.`;
  }

  if (phase === "Explore") {
    const best = bestPhaseContributor(state);
    if (!state.exploreActivated && best?.id === player.id) {
      return `${name} — best Elasticity bonus (+${totalStat(player, statForPhaseBudget("Explore", state))}). Strong candidate to unlock team moves.`;
    }
    if (isActive && state.exploreActivated) {
      return `Moving ${name} — ${state.exploreMovesLeft} team move(s) left. Switch chips anytime.`;
    }
    if (!state.exploreActivated) {
      return `${name} — discuss who spends Elasticity, then focus chips to move in any order.`;
    }
    return `Click to move ${name}. Team shares ${state.exploreMovesLeft || "—"} move(s).`;
  }

  if (phase === "Meet") {
    const best = bestPhaseContributor(state);
    if (state.meetActionBudget === 0 && best?.id === player.id) {
      return `${name} — best Willpower bonus (+${totalStat(player, statForPhaseBudget("Meet", state))}). Strong candidate to unlock Meet actions.`;
    }
    if (isActive) {
      if (state.meetActionBudget === 0) {
        return `Discuss who spends Willpower for shared Meet actions.`;
      }
      const pool = allSelectedCards(state).length;
      return `${state.meetActionsUsed}/${state.meetActionBudget} actions used · pool ${pool}/3. Meet actions may be taken in any order.`;
    }
    if (state.meetActionBudget > 0) {
      return `Click ${name}'s Psyche to add to the cooperative pool (max 3 total).`;
    }
    return `${name} — discuss Meet plans. Spend Willpower when the group is ready.`;
  }

  return `Click to focus ${name}.`;
}


export function overviewHtml() {
  return `
    <div class="overview-page">
      <h2>Somnia — One-Page Overview</h2>
      <p class="overview-tagline">Cooperative dream escape. Discuss each phase, act in any order, and earn Archetype points before the Dream Deck runs out.</p>

      <section class="overview-block">
        <h3>How to play together</h3>
        <p>${COOP_PLAY_TIP} Phases still happen in order (Reveal → Explore → Meet), but within each phase your group chooses what to do first.</p>
      </section>
        <h3>Goal</h3>
        <p>Complete both quests on the Active Archetype, acquire it for points, repeat until you hit your goal. Lose if the Dream Deck empties or everyone is trapped.</p>
      </section>

      <section class="overview-block overview-phases">
        <h3>Every Round (3 Phases)</h3>
        <div class="overview-phase suit-lucidity">
          <div class="overview-phase-head">${suitIconHtml("lucidity", { size: 16 })} <strong>Reveal</strong></div>
          <p>Head Dreamer (★) draws the Dream. <strong>One Dreamer</strong> spends blue <strong>Lucidity</strong> to set how many Landscapes the team may reveal.</p>
        </div>
        <div class="overview-phase suit-elasticity">
          <div class="overview-phase-head">${suitIconHtml("elasticity", { size: 16 })} <strong>Explore</strong></div>
          <p><strong>One Dreamer</strong> spends yellow <strong>Elasticity</strong> to set shared moves; then anyone can move Dreamers across green hexes.</p>
        </div>
        <div class="overview-phase suit-willpower">
          <div class="overview-phase-head">${suitIconHtml("willpower", { size: 16 })} <strong>Meet</strong></div>
          <p><strong>One Dreamer</strong> spends red <strong>Willpower</strong> to set shared Meet actions. Pool up to 3 Psyche to Accept/Repress Encounters. <strong>Accept</strong> puts the Dreambeast in hand (worth 3 Psyche); <strong>Repress</strong> draws 1 Psyche. Spent Dreambeasts go to <strong>☠ The Subconscious</strong> (right panel).</p>
        </div>
      </section>

      <section class="overview-block overview-cols">
        <div>
          <h3>Psyche</h3>
          <ul>
            <li>Click to select · double-click to inspect</li>
            <li>Play 1–2 cards once per phase; one Dreamer spends, team shares the budget</li>
            <li>Dreamer stat bonus adds to card values — pick the highest stat</li>
          </ul>
        </div>
        <div>
          <h3>Key Actions</h3>
          <ul>
            <li><strong>Encounter</strong> — Accept (beast → hand) or Repress (draw 1)</li>
            <li><strong>Subconscious</strong> — face-up graveyard; Return cards from here</li>
            <li><strong>Quests</strong> — 1 Power each, then Acquire</li>
            <li><strong>Trade</strong> — same or adjacent hex</li>
            <li><strong>End Round</strong> — after Meet actions spent</li>
          </ul>
        </div>
      </section>

      <section class="overview-block">
        <h3>Roles</h3>
        <p><strong>Head Dreamer (★)</strong> rotates each round and draws the Dream (anyone may click Draw once the group agrees). <strong>One Dreamer per phase</strong> spends suited Psyche to set the team budget — pick the best stat bonus after discussing.</p>
      </section>

      <p class="overview-footer">Use the <strong>Guide</strong> panel in-game for your next step. Open <strong>How to Play</strong> for the full rules.</p>
      ${musicCreditHtml()}
    </div>
  `;
}

export function rulesHtml() {
  return `
    <h2>How to Play Somnia</h2>
    <p class="rules-lead">Cooperative escape — discuss, plan, and act in any order within each phase.</p>

    <h3>Each Round</h3>
    <ol class="rules-rounds">
      <li><span class="rules-suit suit-lucidity">${suitIconHtml("lucidity", { size: 14 })} <strong>Reveal</strong></span> — Discuss, then draw the Dream and/or spend Lucidity (any order). One spender sets team reveals.</li>
      <li><span class="rules-suit suit-elasticity">${suitIconHtml("elasticity", { size: 14 })} <strong>Explore</strong></span> — One Dreamer spends Elasticity for shared moves; move any Dreamer in any order.</li>
      <li><span class="rules-suit suit-willpower">${suitIconHtml("willpower", { size: 14 })} <strong>Meet</strong></span> — One Dreamer spends Willpower for shared actions, then the team spends them in any order.</li>
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
    <p>Acquire Archetypes by completing both quests. Reach your point goal before Dreams run out. Psyche cards are your health (start 5, max 10). At 0 Psyche you die in the Dream, discard Objects, draw back to 5, and resolve an Additional Dream.</p>
  `;
}
