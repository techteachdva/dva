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
import { footerCreditsHtml } from "./audio.js";

const TUTORIAL_KEY = "somnia_tutorial_seen";
const GENTLE_START_KEY = "somnia_gentle_daydream_used";

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
    body: "Each phase, one Dreamer spends 1 suited Psyche to set the team's budget. Pick the Dreamer with the highest matching stat. Dreamer, Object, and Acquired Archetype bonuses still add. The table may discuss and act in any order before advancing.",
    target: "#hand-bar",
  },
  {
    id: "reveal",
    title: "Reveal Phase",
    body: "Discuss, then draw the Dream and/or set reveal budget in any order. Click a Dreamer on the board and choose Draw & Resolve Dream for the Head Dreamer (★). One Dreamer spends Lucidity for team reveals. Finish the map: all Landscapes Revealed Returns Dreamers+3 from the Subconscious.",
    target: "#board-viewport",
    phase: "Reveal",
  },
  {
    id: "explore",
    title: "Explore Phase",
    body: "Discuss who should spend Elasticity, then unlock shared moves. Click Dreamer chips in the bottom-left dock and green hexes in any order until moves run out.",
    target: "#board-viewport",
    phase: "Explore",
  },
  {
    id: "meet",
    title: "Meet Phase",
    body: "Discuss who spends Willpower, then click a Dreamer on the board for Meet actions. For Encounters, only the Dreamer on that Landscape may spend Psyche (up to 3). The Accept or Reject icon color is the Psyche you must include at least one of, and that Dreamer's matching stat is added to the total.",
    target: "#board-viewport",
    phase: "Meet",
  },
  {
    id: "done",
    title: "You're Ready",
    body: "Open ? anytime for the Dream Feed and a concise rules hub. Good luck escaping the Dreamscape!",
    target: "#btn-dream-feed",
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

export function hasUsedGentleStart() {
  try {
    return localStorage.getItem(GENTLE_START_KEY) === "1";
  } catch {
    return false;
  }
}

export function markGentleStartUsed() {
  try {
    localStorage.setItem(GENTLE_START_KEY, "1");
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
        "Top card of each Mindstream deck is Repressed; objects and Power Tokens are lost.",
        "They return to The Bed with 4/3/2/1 Psyche (by death count) and 2 Power Tokens; an Additional Dream resolves.",
      ],
    };
  }

  if (state.pendingDreamChoice || state.pendingEffectChoice) {
    const pending = state.pendingDreamChoice || state.pendingEffectChoice;
    return {
      phase: getPhase(state),
      suit: "lucidity",
      title: pending.title || "Choose a Dream effect",
      steps: [
        pending.message || "This Dream asks you to pick one effect.",
        ...(pending.choices || []).map((choice) => `**${choice.label}**${choice.hint ? `: ${choice.hint}` : ""}`),
      ],
      tip: "The popup stays until you pick.",
    };
  }

  if (state.pendingObjectChoice) {
    const pending = state.pendingObjectChoice;
    return {
      phase: getPhase(state),
      suit: "lucidity",
      title: pending.title || "Choose an Object effect",
      steps: [
        pending.message || "This Object asks you to pick one effect.",
        ...(pending.choices || []).map((choice) => `**${choice.label}**${choice.hint ? `: ${choice.hint}` : ""}`),
      ],
      tip: "The popup stays until you pick an effect.",
    };
  }

  if (state.pendingDeathChoice) {
    const player = state.players.find((p) => p.id === state.pendingDeathChoice.playerId);
    const cost = state.pendingDeathChoice.cost;
    return {
      phase: getPhase(state),
      suit: "willpower",
      title: "Avoid death?",
      steps: [
        `${player?.name || "A Dreamer"} has no Psyche left.`,
        `Spend **${cost}** Power Token${cost === 1 ? "" : "s"} to draw 1 Psyche, or accept death.`,
      ],
    };
  }

  const phase = getPhase(state);
  const player = activePlayer(state);
  const head = headPlayer(state);

  if (state.landscapePick?.mode === "choose") {
    return {
      phase: getPhase(state),
      suit: null,
      title: state.landscapePick.title || "Choose a Landscape",
      steps: [
        state.landscapePick.detail || "Click a highlighted hex on the map.",
        "Violet glow marks the Landscapes you may choose.",
      ],
      tip: "The card asked you to choose — pick the hex that fits the dream.",
    };
  }

  if (state.landscapePick?.mode === "forget") {
    return {
      phase: getPhase(state),
      suit: "willpower",
      title: "Click map tiles to Forget",
      steps: [
        `Click **${state.landscapePick.remaining}** active Landscape hex tile(s) on the map.`,
        "Each becomes a Wasteland. The Bed cannot be forgotten. If every outer Landscape falls, The Bed flips to Final Recurrence.",
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
        steps.push(`When the group agrees, click a Dreamer on the board and choose **Draw & Resolve Dream** (${head.name} is Head ★).`);
      }
      if (state.dreamDrawn && !state.revealLandscapeUsed) {
        steps.push(
          "One Dreamer spends **1 Lucidity** to set the team reveal budget.",
          best
            ? `**${best.name}** has the best Lucidity bonus (+${totalStat(best, stat, state)}).`
            : "Pick the Dreamer with the highest Lucidity stat.",
        );
        if (budget >= 1) {
          steps.push(`Open that Dreamer's radial and click **Reveal Landscapes** (${budget} reveals), then click hex tiles in any order.`);
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
      steps: ["Click a Dreamer on the board, then **Next: Explore** when your group is ready."],
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
          "One Dreamer spends **1 Elasticity** card to set **shared team moves**.",
          best
            ? `**${best.name}** has the best Elasticity bonus (+${totalStat(best, stat, state)}).`
            : "Pick the Dreamer with the highest Elasticity stat.",
          budget >= 1
            ? `Click that Dreamer on the board, then **Spend Elasticity** (${budget} moves for everyone).`
            : "Then open that Dreamer's radial and click Spend Elasticity to unlock moves.",
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
          `${state.exploreMovesLeft} team move(s) remaining — use all or click a Dreamer on the board, then **Next: Meet**.`,
        ],
        tip: "Click a Dreamer on the board to open their actions, or a dock chip to focus them.",
      };
    }
    return {
      phase: "Explore",
      suit: "elasticity",
      title: "Exploration done",
      steps: ["Click a Dreamer on the board, then **Next: Meet** to continue the round."],
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
          "One Dreamer spends **1 Willpower** card to set **shared Meet actions**.",
          best
            ? `**${best.name}** has the best Willpower bonus (+${totalStat(best, stat, state)}).`
            : "Pick the Dreamer with the highest Willpower stat.",
          budget >= 1 ? `Budget will be: **${budget}** team actions.` : "Cards played + Willpower stat = action count.",
        ],
        tip: "Click that Dreamer on the board, then Gain Actions. Spend Meet actions from the same radial.",
      };
    }
    const pool = coopMeetPlayTotal(state);
    const count = allSelectedCards(state).length;
    const lines = [
      "At the start of every Meet, each Dreamer Represses 1 Psyche from hand and the table Forgets 1 Landscape per active Dreambeast.",
      `**${state.meetActionsUsed}/${state.meetActionBudget}** shared actions used.`,
      "Only the Dreamer on the selected Landscape may click Psyche to pool up to **3** for Meet plays there.",
      `Current pool: **${count}/3** cards, total **${pool}**.`,
    ];
    if (state.activeEncounter) {
      const enc = state.activeEncounter;
      lines.push(`Encounter **${enc.name}**: Accept (${enc.accept}) or Reject (${enc.reject ?? enc.repress}).`);
    } else {
      lines.push("Open a Dreamer on the board for Landscape, Trade, or Quests. After all Meet actions are spent, tap the circular Next Phase button on the map.");
    }
    return {
      phase: "Meet",
      suit: "willpower",
      title: state.activeEncounter ? "Meet the Encounter" : "Spend Meet actions",
      steps: lines,
        tip: "Draw Mindstream as often as you have actions. Each Dreamer's unique Landscape action is once per Meet. Archetype Powers also cost a Meet action.",
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
      return `${name} — best Lucidity bonus (+${totalStat(player, "lucidity", state)}). Strong candidate to spend for reveals.`;
    }
    return `${name} — discuss Reveal plans. Anyone may draw the Dream or spend Lucidity when ready.`;
  }

  if (phase === "Explore") {
    const best = bestPhaseContributor(state);
    if (!state.exploreActivated && best?.id === player.id) {
      return `${name} — best Elasticity bonus (+${totalStat(player, statForPhaseBudget("Explore", state), state)}). Strong candidate to unlock team moves.`;
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
      return `${name} — best Willpower bonus (+${totalStat(player, statForPhaseBudget("Meet", state), state)}). Strong candidate to unlock Meet actions.`;
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


export const RULES_TAB_FEED = "feed";
export const RULES_TAB_INTRO = "intro";
export const RULES_TAB_REM = "rem";
export const RULES_TAB_DETAILS = "details";

/** Short welcome shown before the interactive tutorial walkthrough. */
export function tutorialBriefHtml() {
  return `
    <div class="rules-page tutorial-brief-page">
      <p class="rules-lead">Welcome to Somnia — follow the sparkles through two guided rounds and learn the dream by playing.</p>
      <section class="overview-block tutorial-brief-outcomes">
        <h3>You will learn</h3>
        <ul>
          <li>The <strong>Reveal → Explore → Meet</strong> loop each round</li>
          <li>How to open the map, move Dreamers, and resolve your first Dreambeast</li>
          <li>How Mindstream and Archetype quests earn <strong>The Innocent</strong></li>
        </ul>
      </section>
    </div>
  `;
}

/** Page 1 — one-page intro brief. */
export function rulesIntroHtml() {
  return `
    <div class="rules-page rules-page-intro">
      <h2>Somnia</h2>
      <p class="rules-lead">A cooperative dream-escape game. You are Dreamers trapped in a collapsing Dreamscape. Work together to earn Archetype points and wake up before the Dream Deck runs out.</p>

      <section class="overview-block">
        <h3>How You Win</h3>
        <p>Complete both quests on the <strong>Active Archetype</strong>, spend 1 Power Token per quest to mark them, then <strong>Acquire</strong> it for points. Repeat until you reach your goal (<strong>8 / 12 / 24</strong> for Daydream, Nap, or Deep Sleep — 24 is every Archetype in the deck). When you have enough points, <strong>every living Dreamer must stand on The Bed</strong> to escape.</p>
      </section>

      <section class="overview-block">
        <h3>How You Lose</h3>
        <p>The <strong>Dream Deck</strong> empties before you reach your goal (<strong>11 / 14 / 18</strong> regular Dreams for Daydream, Nap, or Deep Sleep, plus Final Recurrence cards and three boss Dreams). In <strong>Final Recurrence</strong>, you lose if Dreams run out while Remaining Archetypes still stand on the map, or if any Mindstream suit is entirely Repressed.</p>
      </section>

      <section class="overview-block">
        <h3>Play Together</h3>
        <p>${COOP_PLAY_TIP} Phases always run <strong>Reveal → Explore → Meet</strong>, but within each phase your group chooses what to do first.</p>
      </section>

      <section class="overview-block overview-cols">
        <div>
          <h3>Core Pieces</h3>
          <ul>
            <li><strong>Psyche</strong> — your hand of suited cards (Lucidity, Elasticity, Willpower)</li>
            <li><strong>Landscapes</strong> — hex tiles on the map; reveal, move to, and act on them</li>
            <li><strong>Encounters</strong> — Dreambeasts on Landscapes; Accept or Repress during Meet</li>
            <li><strong>Archetypes</strong> — quest cards that award victory points</li>
            <li><strong>Power Tokens</strong> — shared currency for quests, powers, and survival</li>
          </ul>
        </div>
        <div>
          <h3>Each Round</h3>
          <ul>
            <li><strong>Head Dreamer (★)</strong> rotates; their name is on the Dream draw</li>
            <li><strong>Round 1:</strong> each Dreamer starts with <strong>5 Psyche</strong></li>
            <li><strong>Round 2+:</strong> alive Dreamers draw <strong>2 Psyche</strong> at round start</li>
            <li><strong>One Dreamer per phase</strong> spends 1 suited card to set the team budget</li>
            <li>Unresolved Encounters fail at end of Meet; roaming Dreambeasts hunger for the Timeline (see Encounters)</li>
          </ul>
        </div>
      </section>

      <section class="overview-block">
        <h3>In This Reference</h3>
        <p>Use the <strong>R.E.M.</strong> tab for the three phases in depth. Use <strong>Details</strong> for encounters, death, bosses, objects, Mindstream, and Final Recurrence. The in-game <strong>Guide</strong> panel shows your next step every turn.</p>
      </section>

            <p class="overview-footer">Somnia v 24.0 — cooperative rules reference.</p>
      ${footerCreditsHtml()}
    </div>
  `;
}

/** Page 2 — R.E.M. phases (Reveal, Explore, Meet). */
export function rulesRemHtml() {
  return `
    <div class="rules-page rules-page-rem">
      <h2>R.E.M. — Every Round</h2>
      <p class="rules-lead">Each round has three phases in order. One Dreamer spends 1 suited Psyche card to open each phase; the whole team shares the resulting budget.</p>

      <p class="rules-formula"><strong>Budget formula:</strong> that 1 card's value + that Dreamer's matching stat, including Object and Acquired Archetype bonuses. You may spend <strong>1 Power Token as 1 suited Psyche</strong> instead of a card. Minimum 1 Psyche or 1 token.</p>

      <section class="overview-block overview-phases">
        <div class="overview-phase suit-lucidity">
          <div class="overview-phase-head">${suitIconHtml("lucidity", { size: 16 })} <strong>Reveal</strong> — ${SUIT_LABELS.lucidity}</div>
          <p><strong>Head Dreamer (★)</strong> draws and resolves one <strong>Dream</strong> card each round (anyone may click Draw once the group agrees). Then <strong>one Dreamer</strong> spends 1 Lucidity card.</p>
          <ul>
            <li><strong>Setup:</strong> every Landscape is shuffled. The Bed is face-up. One random Landscape touching The Bed starts Revealed; all others start forgotten</li>
            <li><strong>Reveal budget</strong> = that 1 card's value + Lucidity bonuses (Dreamer, Objects, Acquired Archetypes) → click that many Wasteland hexes to flip Landscapes face-up</li>
            <li><strong>Map fully Revealed:</strong> leftover Lucidity Reveals flip the next facedown card of a Mindstream (click the card back). Flipped cards stay face-up on that pile</li>
            <li>Draw the Dream and spend Lucidity in either order during Reveal</li>
            <li><strong>Round 1:</strong> each Dreamer already has 5 Psyche — no round-start draw</li>
            <li><strong>Round 2+:</strong> each alive Dreamer draws <strong>2 Psyche</strong> at the start of Reveal</li>
          </ul>
        </div>

        <div class="overview-phase suit-elasticity">
          <div class="overview-phase-head">${suitIconHtml("elasticity", { size: 16 })} <strong>Explore</strong> — ${SUIT_LABELS.elasticity}</div>
          <p><strong>One Dreamer</strong> spends 1 Elasticity card to unlock <strong>shared team moves</strong>.</p>
          <ul>
            <li><strong>Move budget</strong> = that 1 card's value + Elasticity bonuses → that many moves for the whole team</li>
            <li>Click Dreamer chips and green dashed hexes in any order; you do not have to use every move</li>
            <li>Entering the <strong>Wasteland</strong> during Explore discards 1 Psyche (can trigger death)</li>
            <li><strong>Paradox Dream:</strong> Explore uses Willpower stat instead (card suits unchanged)</li>
          </ul>
        </div>

        <div class="overview-phase suit-willpower">
          <div class="overview-phase-head">${suitIconHtml("willpower", { size: 16 })} <strong>Meet</strong> — ${SUIT_LABELS.willpower}</div>
          <p><strong>One Dreamer</strong> spends 1 Willpower card to gain <strong>shared Meet actions</strong> for the team.</p>
          <ul>
            <li><strong>Action budget</strong> = that 1 card's value + Willpower bonuses → spend on Encounters, Landscapes, Trade, or Archetype Powers</li>
            <li><strong>Meet tax:</strong> at the start of every Meet, each Dreamer Represses 1 Psyche from hand and the table Forgets 1 Landscape per active Dreambeast on the board</li>
            <li><strong>Once per action</strong> for each Dreamer this Meet, except Draw Mindstream which may be repeated. Unique Landscape actions are once. Archetype Powers cost 1 Meet action + 1 Power Token</li>
            <li>Each Landscape offers <strong>Draw Mindstream</strong> (repeatable) and one <strong>unique action</strong> (once per Dreamer this Meet)</li>
            <li><strong>Objects</strong> are free during Meet; using an Instant Object Represses it. Persistent Objects cost 1 Power Token to activate</li>
            <li>At Meet end, unresolved Encounters <strong>fail</strong> — Dreamers on those tiles lose Psyche to the Subconscious</li>
            <li><strong>Paradox Dream:</strong> Meet uses Elasticity stat instead</li>
          </ul>
        </div>
      </section>

      <section class="overview-block">
        <h3>Phase Spender Tips</h3>
        <p>Pick the Dreamer with the <strong>highest matching stat</strong> to maximize budget. The UI highlights the best candidate. Only one Dreamer spends per phase — discuss first, then commit a card.</p>
      </section>

      <section class="overview-block">
        <h3>Round End</h3>
        <p>After Reveals are spent, Explore moves are spent, or Meet actions are spent, a circular <strong>Next Phase</strong> button appears in the top-right of the map. You may also press it early to skip leftover budget. Head Dreamer rotates clockwise at round end. Dreamer radials do not advance the phase.</p>
      </section>
    </div>
  `;
}

/** Page 3 — detailed minor rules and systems. */
export function rulesDetailsHtml() {
  return `
    <div class="rules-page rules-page-details">
      <h2>Detailed Rules</h2>
      <p class="rules-lead">Encounters, hands, tokens, and edge cases — everything beyond the R.E.M. phase loop.</p>

      <h3>Guided Tutorial</h3>
      <ul>
        <li>The in-game tutorial is two scripted rounds. The guide window docks on the map at a readable size; drag the header or resize the corner if you want it elsewhere.</li>
        <li>Follow the sparkle: click the highlighted <strong>Dreamer on the board</strong>, then the highlighted <strong>radial button</strong>. Every required click is highlighted, including hand cards, hexes, and the circular <strong>Next Phase</strong> control at the top-right of the map.</li>
        <li>Each step shows a punchy Objective plus one or two sentences of why that action matters. <strong>?</strong> and Pause → Help stay available after you graduate.</li>
      </ul>

      <h3>Psyche &amp; Hand Limits</h3>
      <ul>
        <li>Tap or click to select · double-tap, long-press, or right-click to inspect · play 1 suited card per phase opener</li>
        <li>Max <strong>10 Psyche cards</strong> in hand (+2 with Persistent Severed Torso); overflow discards to the Psyche discard pile</li>
        <li>Max <strong>10 accepted allies</strong> (Dreambeasts) — separate from the Psyche limit</li>
        <li><strong>Wild Psyche</strong> (value 5) counts as any suit; also Represses the top card of each Mindstream deck when spent</li>
        <li><strong>Power Psyche</strong> (Power Surge, yellowish-purple) stays in hand — click it anytime, any phase, for 1 Power Token</li>
        <li>Effective health = regular Psyche + allies; at 0 you face death</li>
      </ul>

      <h3>Encounters (Dreambeasts)</h3>
      <ul>
        <li>Only the Dreamer <strong>standing on the Landscape</strong> may Meet the Encounter and pool Psyche (up to <strong>3</strong> cards; allies do not count toward the 3-card spread)</li>
        <li><strong>Accept</strong> — meet or exceed Accept threshold; beast joins hand as a 3-value ally. Accept ≥ 10: draw 1 Object</li>
        <li><strong>Repress</strong> — meet Reject threshold; beast goes to Subconscious; resolve the Reject reward (draw Psyche, Power, Object, Return, etc.)</li>
        <li><strong>Fail</strong> — end of Meet with no resolution: lose Psyche to Subconscious per the Encounter's fail count</li>
        <li><strong>Timeline hunger</strong> — at end of Meet, each Dreambeast still on the map costs <strong>1 Power Token</strong> (team-wide). If you cannot pay, <strong>1 Dream card is discarded</strong> from the deck per unpaid beast ("The Timeline frays")</li>
        <li>Meet bonuses: +1 if fantasy/nightmare affinity matches; +1 if primary suit matches Encounter suit; jewelry/stick Objects +1 each; body tag doubles highest card</li>
        <li>Spent allies are Repressed to the Subconscious; spent Psyche goes to discard or Subconscious</li>
      </ul>

      <h3>Spawning Dreambeasts</h3>
      <ul>
        <li>When an effect says <strong>Spawn a Dreambeast</strong>, cycle the Mindstream from the top until a Dreambeast appears, then discard the rest of that Mindstream and reshuffle the discard into a new draw pile</li>
        <li>Ebony Pawn spawns a <strong>Nightmare</strong>; Ivory Pawn a <strong>Fantasy</strong>. Choose a revealed Landscape for those Objects</li>
        <li>If the effect does not ask you to choose a tile, the beast appears on the acting Dreamer's Landscape. Bosses spawn on <strong>The Bed</strong></li>
      </ul>

      <h3>Bosses</h3>
      <ul>
        <li><strong>Cerberus</strong> — Accept with exactly 3 Psyche sharing a value or suit; on Accept, Repress top 3 Psyche from team hands</li>
        <li><strong>Double</strong> — Accept with at least 2 Psyche of matching values; on Accept, Forget Day in the Life + Naked Classroom</li>
        <li><strong>Leviathan</strong> — Accept with exactly 3 Psyche, one of each suit (Wilds fill gaps); on Accept, Forget 1 Landscape + Repress top 3 Psyche</li>
        <li>Boss Dreams spawn the boss as an Encounter on <strong>The Bed</strong> (typically Reveal rounds <strong>3, 6, and 9</strong>)</li>
      </ul>

      <h3>Power Tokens</h3>
      <p>Team pool cap <strong>24</strong>. Start with <strong>1</strong> per Dreamer. Spend on quest marks (1 each, any phase), Dreamer Powers (1, any phase), Archetype Powers (1 Meet action + 1 Token), Persistent Object activation (1), <strong>1 as a suited Psyche</strong> for a Reveal / Explore / Meet opener (max 1 per opener), stacking <strong>+1 per token</strong> on a Psyche spread (no coin flip), Timeline hunger (1 per roaming Dreambeast at end of Meet), and avoiding death.</p>

      <h3>Dreamer Powers</h3>
      <p>Each costs <strong>1 Power Token</strong> and can be used in any phase. Lucidity Dreamers help Reveal, Elasticity Dreamers help Explore, Willpower Dreamers help Meet.</p>
      <ul>
        <li><strong>The Rested</strong> — All Dreamers Draw from the Psyche Discard, or Refresh: put 1 Psyche on the deck bottom and Draw 1.</li>
        <li><strong>The Visionary</strong> — Reveal Dreamers+1 Landscapes, or each Dreamer Peeks at 1 deck top and may send it to the bottom.</li>
        <li><strong>The Runner</strong> — All Dreamers Move 2 spaces toward or away from The Bed / Final Recurrence.</li>
        <li><strong>The Hunter</strong> — Move each active Dreambeast 1 space toward the nearest Dreamer or away from The Bed.</li>
        <li><strong>The Immovable</strong> — Hold the Line: during the next Meet Phase, all Dreamers may add +1 Psyche to any Accept or Reject spread.</li>
        <li><strong>The Weaver</strong> — Threads of Will: each Dreamer Discards 1 Psyche and Draws 1.</li>
      </ul>

      <h3>Archetypes &amp; Quests</h3>
      <p>Active Archetype shows 2 quests. Meet each condition, spend 1 Power Token to mark it, then Acquire for points (1–3). Quintessential Archetypes (Sage, Magician, Warrior) grant passive stat bonuses only; their Psyche quest requires <strong>one Dreamer to hold 10 Psyche cards</strong> (full hand). Others have activatable powers during Meet for 1 Meet action and 1 Power Token.</p>

      <h3>Objects</h3>
      <ul>
        <li><strong>Instant</strong> — play from hand during Meet at no action cost; the Object is then <strong>Repressed</strong></li>
        <li><strong>Persistent</strong> — stays in play; activate for 1 Power Token</li>
        <li><strong>Must-play</strong> — auto-resolves on draw (e.g. The Nothing, All Seeing Eye), then Repressed</li>
      </ul>

      <h3>Subconscious, Trade &amp; Landscapes</h3>
      <ul>
        <li><strong>Subconscious</strong> — face-up Repressed piles (Psyche, Dreambeasts, Mindstream by suit, Objects). Return effects pull cards back to matching discard piles</li>
        <li><strong>Trade</strong> — 1 Meet action; partner on same or adjacent hex; offer up to 3 Psyche</li>
        <li><strong>Landscape actions</strong> — Draw matching Mindstream as often as you have Meet actions. Each unique Landscape action is once per Dreamer this Meet</li>
        <li><strong>Map setup</strong> — shuffle every Landscape. The Bed is face-up. One random Landscape touching The Bed starts Revealed; all others start forgotten. Further Reveals require 1 Lucidity Psyche</li>
        <li><strong>Map thresholds</strong> — Revealing every Landscape Returns <strong>Dreamers+3</strong> from the Subconscious. Forgetting every Landscape but The Bed Represses <strong>Dreamers+3</strong> Psyche from hands (and still starts Final Recurrence)</li>
        <li><strong>Forget</strong> — turns Landscapes to Wasteland; Encounters Repressed; Dreamers there lose 1 Psyche. If all outer tiles are Wasteland → <strong>Final Recurrence</strong></li>
      </ul>

      <h3>Mindstream &amp; Dreams</h3>
      <p>Three 70-card decks (Lucidity, Elasticity, Willpower): Dreambeasts, Objects, Events, Power cards, Draw-Dream cards. When a Mindstream draw pile is empty, shuffle its discard into a new draw pile. If a suit is entirely Repressed in the Subconscious — none left in that Mindstream, its discard, or in play — the table loses immediately. Spawn a Dreambeast by cycling from the top until a beast, then discard the rest of that Mindstream. Dreams are drawn once per round by the Head Dreamer.</p>

      <h3>Death</h3>
      <p>At 0 Psyche, spend Power Tokens (cost = max(1, floor(alive/2))) to draw 1 Psyche and survive, or accept death: Repress top of each Mindstream deck, lose all Objects/Persistent/Power, return to The Bed with 4/3/2/1 Psyche (by death #), gain 2 Power, resolve an Additional Dream. Fifth death removes the Dreamer permanently.</p>

      <h3>Final Recurrence</h3>
      <p>Triggered when <strong>The Final Recurrence</strong> is drawn (first of the ten endgame Dreams), or when every outer Landscape has been forgotten. The Bed cannot be forgotten. Goal points reset; remaining Archetypes become map Encounters. Defeat each with a Meet action, <strong>≥ 15</strong> pooled Psyche from <strong>all Dreamers</strong>, including at least one card of the <strong>opposing suit</strong>. Or sacrifice acquired Archetypes 1:1 to auto-defeat. Win by clearing all. The last card is always <strong>You Never Wake Up</strong>.</p>
    </div>
  `;
}

/** Full-screen info hub: live Dream Feed plus a concise rules digest. */
export function infoHubHtml(options = {}) {
  const { feedHtml = "<p class=\"dream-feed-empty\">Start a game to see the dream feed.</p>" } = options;
  return `
    <div class="info-hub">
      <header class="info-hub-header">
        <div class="info-hub-brand">
          <p class="info-hub-kicker">Somnia v 24.0</p>
          <h2>Dream Guide</h2>
          <p class="info-hub-lead">What just happened, and the rules you need to wake up.</p>
        </div>
        <button type="button" class="btn primary info-hub-play" data-info-hub-play>PLAY</button>
      </header>
      <div class="info-hub-grid">
        <section class="info-hub-feed" aria-label="Dream Feed">
          ${feedHtml}
        </section>
        <section class="info-hub-rules" aria-label="Rules highlights">
          <div class="info-hub-rule">
            <h3>Win &amp; Lose</h3>
            <p><strong>Win:</strong> finish both Active Archetype quests (1 Power Token each), <strong>Acquire</strong> for 1–3 points, and repeat to your goal (<strong>8 / 12 / 24</strong>). When you reach the goal, a banner reminds the table: every living Dreamer must stand on <strong>The Bed</strong> to wake up.</p>
            <p><strong>Lose:</strong> the Dream Deck empties first, or any Mindstream suit is entirely Repressed in the Subconscious. In Final Recurrence you lose if Dreams run out while remaining Archetypes still stand.</p>
          </div>
          <div class="info-hub-rule">
            <h3>Play Together</h3>
            <p>${COOP_PLAY_TIP} One Dreamer opens each phase with <strong>1 suited Psyche</strong> (or <strong>1 Power Token as 1 Psyche</strong>). Budget = that card's value + Dreamer, Object, and Acquired Archetype bonuses.</p>
          </div>
          <div class="info-hub-rule info-hub-rem">
            <h3>R.E.M. — Every Round</h3>
            <ul>
              <li class="suit-lucidity"><strong>Reveal</strong> — Head (★) draws a Dream. Spend Lucidity to flip Wastelands, or Mindstream tops once the map is fully Revealed.</li>
              <li class="suit-elasticity"><strong>Explore</strong> — Spend Elasticity for shared moves. Entering Wasteland discards 1 Psyche.</li>
              <li class="suit-willpower"><strong>Meet</strong> — Spend Willpower. Start of Meet: Repress 1 Psyche and Forget 1 Landscape per active Dreambeast. Draw Mindstream is repeatable; unique Landscape actions and Archetype Powers cost 1 action.</li>
            </ul>
          </div>
          <div class="info-hub-rule">
            <h3>Encounters</h3>
            <p>Only the Dreamer on the tile may Meet and pool up to <strong>3 Psyche</strong>. <strong>Accept</strong> meets the threshold and the beast joins as a 3-value ally (Accept ≥ 10 draws an Object). <strong>Repress</strong> meets Reject and pays that reward. Fail at Meet end: lose Psyche. Each beast still on the map costs <strong>1 Power Token</strong> at round end — or a Dream card frays.</p>
          </div>
          <div class="info-hub-rule">
            <h3>Hands, Tokens &amp; Objects</h3>
            <p>Max <strong>10 Psyche</strong>. Wild (5) is any suit. Power Surge is yellowish-purple — click anytime for 1 Power Token. Instant Objects Repress when used. Spent allies Repress to the Subconscious.</p>
          </div>
          <div class="info-hub-rule">
            <h3>Death &amp; Final Recurrence</h3>
            <p>At 0 Psyche, spend Power Tokens to draw 1 and live, or die: return to The Bed with 4/3/2/1 Psyche. Fifth death is permanent. Forget every outer Landscape — or draw <strong>The Final Recurrence</strong> — to start the endgame. Defeat remaining Archetypes with <strong>≥ 15</strong> pooled Psyche including the opposing suit, or sacrifice acquired Archetypes 1:1. Last card: <strong>You Never Wake Up</strong>.</p>
          </div>
          <p class="info-hub-footer">After a phase budget is spent, a circular Next Phase button appears at the top-right of the map. The guided tutorial highlights the Dreamer, then the radial, then Next Phase. Landscapes are named in their suit color. Draw Mindstream is repeatable; the unique tile action is once per Meet.</p>
        </section>
      </div>
    </div>
  `;
}

/** @deprecated Tabs were replaced by the v19 info hub. */
export function rulesReferenceHtml(_activeTab = RULES_TAB_FEED, options = {}) {
  return infoHubHtml(options);
}

/** @deprecated Use rulesIntroHtml — kept for imports that expect overviewHtml. */
export function overviewHtml() {
  return rulesIntroHtml();
}

/** @deprecated Use rulesDetailsHtml — kept for imports that expect rulesHtml. */
export function rulesHtml() {
  return rulesDetailsHtml();
}
