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
    body: "Discuss who should spend Elasticity, then unlock shared moves. Click Dreamer chips in the bottom-left dock and green hexes in any order until moves run out.",
    target: "#board-viewport",
    phase: "Explore",
  },
  {
    id: "meet",
    title: "Meet Phase",
    body: "Discuss who spends Willpower, then take Meet actions in any order. For Encounters, only the Dreamer on that Landscape may spend Psyche (up to 3).",
    target: "#phase-actions",
    phase: "Meet",
  },
  {
    id: "done",
    title: "You're Ready",
    body: "Use the Guide panel anytime for your next step. Open Overview or Help for the three-page rules reference (Overview · R.E.M. · Details). Good luck escaping the Dreamscape!",
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
        "Top card of each Mindstream deck is Repressed; objects and Power Tokens are lost.",
        "They return to The Bed with 4/3/2/1 Psyche (by death count) and 2 Power Tokens; an Additional Dream resolves.",
      ],
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
            ? `**${best.name}** has the best Lucidity bonus (+${totalStat(best, stat, state)}).`
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
            ? `**${best.name}** has the best Elasticity bonus (+${totalStat(best, stat, state)}).`
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
          `${state.exploreMovesLeft} team move(s) remaining — use all or click **Next Phase** to skip to Meet.`,
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
            ? `**${best.name}** has the best Willpower bonus (+${totalStat(best, stat, state)}).`
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
      "Only the Dreamer on the selected Landscape may click Psyche to pool up to **3** for Meet plays there.",
      `Current pool: **${count}/3** cards, total **${pool}**.`,
    ];
    if (state.activeEncounter) {
      const enc = state.activeEncounter;
      lines.push(`Encounter **${enc.name}**: Accept (${enc.accept}) or Reject (${enc.reject ?? enc.repress}).`);
    } else {
      lines.push("Use actions in any order — Landscape, Trade, Quests, or **End Round**. **Objects** are free anytime (Persistent Objects cost 1 Power Token to activate).");
    }
    return {
      phase: "Meet",
      suit: "willpower",
      title: state.activeEncounter ? "Meet the Encounter" : "Spend Meet actions",
      steps: lines,
      tip: "A Dreamer cannot repeat the same action twice in a row — switch Dreamers or use a different action.",
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

const RULES_TABS = [
  { id: RULES_TAB_FEED, label: "Dream Feed" },
  { id: RULES_TAB_INTRO, label: "Overview" },
  { id: RULES_TAB_REM, label: "R.E.M." },
  { id: RULES_TAB_DETAILS, label: "Details" },
];

/** One-page brief shown before the interactive tutorial walkthrough. */
export function tutorialBriefHtml() {
  return `
    <div class="rules-page tutorial-brief-page">
      <h2>Somnia — Quick Start</h2>
      <p class="rules-lead">You are Dreamers in a shared Dreamscape. Cooperate to earn Archetype points and escape before the Dream Deck runs out.</p>

      <section class="overview-block">
        <h3>Goal</h3>
        <p>Complete both quests on the <strong>Active Archetype</strong>, spend <strong>1 Power Token</strong> to mark each quest, then <strong>Acquire</strong> it for points. Reach <strong>12 points</strong> (this tutorial), then get every living Dreamer onto <strong>The Bed</strong> to win.</p>
      </section>

      <section class="overview-block">
        <h3>Every Round: R.E.M.</h3>
        <p>Phases always run in order. Within each phase, talk first — then act in any order. There is <strong>no turn order</strong>.</p>
        <ul class="tutorial-brief-rem">
          <li><strong>Reveal</strong> (${SUIT_LABELS.lucidity}) — Head Dreamer (★) draws a Dream; one Dreamer spends Lucidity to reveal Landscapes on the map.</li>
          <li><strong>Explore</strong> (${SUIT_LABELS.elasticity}) — one Dreamer spends Elasticity to unlock shared team moves on the hex board.</li>
          <li><strong>Meet</strong> (${SUIT_LABELS.willpower}) — one Dreamer spends Willpower to unlock shared Meet actions for Encounters, Landscapes, and quests.</li>
        </ul>
        <p class="tutorial-brief-note">Each phase spender plays <strong>1–2 suited Psyche cards</strong>. Higher matching Dreamer stats add bonus budget.</p>
      </section>

      <section class="overview-block overview-cols">
        <div>
          <h3>Core Pieces</h3>
          <ul>
            <li><strong>Psyche</strong> — your hand (Lucidity, Elasticity, Willpower)</li>
            <li><strong>Landscapes</strong> — hex tiles; reveal, move onto, and use their actions</li>
            <li><strong>Encounters</strong> — Dreambeasts; <strong>Accept</strong> (join your hand) or <strong>Reject</strong> (Subconscious + reward)</li>
            <li><strong>Power Tokens</strong> — mark quests, powers, and survival (team pool, max 24)</li>
            <li><strong>Subconscious</strong> — face-up repressed cards; Return effects recycle them</li>
          </ul>
        </div>
        <div>
          <h3>This Tutorial</h3>
          <ul>
            <li><strong>5 rounds</strong> with a guided step card you can move and resize</li>
            <li>Round 1: full R.E.M. loop + your first Encounter</li>
            <li>Round 2: earn <strong>The Innocent</strong> Archetype</li>
            <li>Round 3: a <strong>Boss Dream</strong></li>
            <li>Rounds 4–5: death rules and final practice</li>
          </ul>
        </div>
      </section>

      <p class="tutorial-brief-footer-note">Press <strong>Begin Guided Tutorial</strong> when ready. The guide will highlight what to click and unlock Continue after each action.</p>
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
        <p>Complete both quests on the <strong>Active Archetype</strong>, spend 1 Power Token per quest to mark them, then <strong>Acquire</strong> it for points. Repeat until you reach your goal (<strong>12 / 18 / 24</strong> for Daydream, Nap, or Deep Sleep). When you have enough points, <strong>every living Dreamer must stand on The Bed</strong> to escape.</p>
      </section>

      <section class="overview-block">
        <h3>How You Lose</h3>
        <p>The <strong>Dream Deck</strong> empties before you reach your goal (<strong>14 / 17 / 21</strong> Dreams for Daydream, Nap, or Deep Sleep, plus Final Recurrence cards). In <strong>Final Recurrence</strong>, you lose if Dreams run out while Remaining Archetypes still stand on the map.</p>
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
            <li><strong>One Dreamer per phase</strong> spends 1–2 suited cards to set the team budget</li>
            <li>Unresolved Encounters fail at end of Meet; roaming Dreambeasts hunger for the Timeline (see Encounters)</li>
          </ul>
        </div>
      </section>

      <section class="overview-block">
        <h3>In This Reference</h3>
        <p>Use the <strong>R.E.M.</strong> tab for the three phases in depth. Use <strong>Details</strong> for encounters, death, bosses, objects, Mindstream, and Final Recurrence. The in-game <strong>Guide</strong> panel shows your next step every turn.</p>
      </section>

            <p class="overview-footer">Somnia v 15.0 — cooperative rules reference.</p>
      ${footerCreditsHtml()}
    </div>
  `;
}

/** Page 2 — R.E.M. phases (Reveal, Explore, Meet). */
export function rulesRemHtml() {
  return `
    <div class="rules-page rules-page-rem">
      <h2>R.E.M. — Every Round</h2>
      <p class="rules-lead">Each round has three phases in order. One Dreamer spends 1–2 suited Psyche cards to open each phase; the whole team shares the resulting budget.</p>

      <p class="rules-formula"><strong>Budget formula:</strong> sum of card values + that Dreamer's matching stat (minimum 1 card).</p>

      <section class="overview-block overview-phases">
        <div class="overview-phase suit-lucidity">
          <div class="overview-phase-head">${suitIconHtml("lucidity", { size: 16 })} <strong>Reveal</strong> — ${SUIT_LABELS.lucidity}</div>
          <p><strong>Head Dreamer (★)</strong> draws and resolves one <strong>Dream</strong> card each round (anyone may click Draw once the group agrees). Then <strong>one Dreamer</strong> spends 1–2 Lucidity cards.</p>
          <ul>
            <li><strong>Reveal budget</strong> = card values + Lucidity stat → click that many Wasteland hexes to flip Landscapes face-up</li>
            <li>Draw the Dream and spend Lucidity in either order during Reveal</li>
            <li><strong>Round 1:</strong> each Dreamer already has 5 Psyche — no round-start draw</li>
            <li><strong>Round 2+:</strong> each alive Dreamer draws <strong>2 Psyche</strong> at the start of Reveal</li>
          </ul>
        </div>

        <div class="overview-phase suit-elasticity">
          <div class="overview-phase-head">${suitIconHtml("elasticity", { size: 16 })} <strong>Explore</strong> — ${SUIT_LABELS.elasticity}</div>
          <p><strong>One Dreamer</strong> spends 1–2 Elasticity cards to unlock <strong>shared team moves</strong>.</p>
          <ul>
            <li><strong>Move budget</strong> = card values + Elasticity stat → that many moves for the whole team</li>
            <li>Click Dreamer chips and green dashed hexes in any order; you do not have to use every move</li>
            <li>Entering the <strong>Wasteland</strong> during Explore discards 1 Psyche (can trigger death)</li>
            <li><strong>Paradox Dream:</strong> Explore uses Willpower stat instead (card suits unchanged)</li>
          </ul>
        </div>

        <div class="overview-phase suit-willpower">
          <div class="overview-phase-head">${suitIconHtml("willpower", { size: 16 })} <strong>Meet</strong> — ${SUIT_LABELS.willpower}</div>
          <p><strong>One Dreamer</strong> spends 1–2 Willpower cards to gain <strong>shared Meet actions</strong> for the team.</p>
          <ul>
            <li><strong>Action budget</strong> = card values + Willpower stat → spend on Encounters, Landscapes, Trade, or End Round</li>
            <li><strong>Cannot repeat</strong> the same action twice in a row for the same Dreamer — another Dreamer may take the same action</li>
            <li>Each Landscape offers <strong>Action A</strong> (Draw matching Mindstream) and <strong>Action B</strong> (its unique action from the rulebook)</li>
            <li><strong>Objects</strong> are free during Meet; Persistent Objects cost 1 Power Token to activate</li>
            <li>At Meet end, unresolved Encounters <strong>fail</strong> — Dreamers on those tiles lose Psyche to the Subconscious</li>
            <li><strong>Paradox Dream:</strong> Meet uses Elasticity stat instead</li>
          </ul>
        </div>
      </section>

      <section class="overview-block">
        <h3>Phase Spender Tips</h3>
        <p>Pick the Dreamer with the <strong>highest matching stat</strong> to maximize budget. The UI highlights the best candidate. Only one Dreamer spends per phase — discuss first, then commit cards.</p>
      </section>

      <section class="overview-block">
        <h3>Round End</h3>
        <p>After Meet actions are spent (or skipped), click <strong>End Round</strong>. Head Dreamer rotates clockwise. Round counter increments and a new Reveal begins.</p>
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

      <h3>Psyche &amp; Hand Limits</h3>
      <ul>
        <li>Click to select · double-click to inspect · play 1–2 suited cards per phase opener</li>
        <li>Max <strong>10 Psyche cards</strong> in hand (+2 with Persistent Severed Torso); overflow discards to the Psyche discard pile</li>
        <li>Max <strong>10 accepted allies</strong> (Dreambeasts) — separate from the Psyche limit</li>
        <li><strong>Wild Psyche</strong> (value 5) counts as any suit; also Represses the top card of each Mindstream deck when spent</li>
        <li><strong>Power Psyche</strong> resolves immediately for 1 Power Token (Power Surge) — never kept in hand</li>
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
        <li>Spent allies return to their Mindstream deck; spent Psyche goes to discard or Subconscious</li>
      </ul>

      <h3>Bosses</h3>
      <ul>
        <li><strong>Cerberus</strong> — Accept with exactly 3 Psyche sharing a value or suit; on Accept, Repress top 3 Psyche from team hands</li>
        <li><strong>Double</strong> — Accept with at least 2 Psyche of matching values; on Accept, Forget Day in the Life + Naked Classroom</li>
        <li><strong>Leviathan</strong> — Accept with exactly 3 Psyche, one of each suit (Wilds fill gaps); on Accept, Forget 1 Landscape + Repress top 3 Psyche</li>
        <li>Boss Dreams spawn the boss as an Encounter on <strong>The Bed</strong> (typically Reveal rounds <strong>3, 6, and 9</strong>)</li>
      </ul>

      <h3>Power Tokens</h3>
      <p>Team pool cap <strong>24</strong>. Start with <strong>1</strong> per Dreamer. Spend on quest marks (1 each), Dreamer Powers (1), Archetype Powers (1), Persistent Object activation (1), coin-flip Meet bonus (1), Timeline hunger (1 per roaming Dreambeast at end of Meet), and avoiding death.</p>

      <h3>Archetypes &amp; Quests</h3>
      <p>Active Archetype shows 2 quests. Meet each condition, spend 1 Power Token to mark it, then Acquire for points (1–3). Quintessential Archetypes (Sage, Magician, Warrior) grant passive stat bonuses only; their Psyche quest requires <strong>one Dreamer to hold 10 Psyche cards</strong> (full hand). Others have activatable powers during Meet for 1 Power Token.</p>

      <h3>Objects</h3>
      <ul>
        <li><strong>Instant</strong> — play from hand during Meet at no action cost</li>
        <li><strong>Persistent</strong> — stays in play; activate for 1 Power Token</li>
        <li><strong>Must-play</strong> — auto-resolves on draw (e.g. The Nothing, All Seeing Eye)</li>
      </ul>

      <h3>Subconscious, Trade &amp; Landscapes</h3>
      <ul>
        <li><strong>Subconscious</strong> — face-up Repressed piles (Psyche, Dreambeasts, Mindstream by suit, Objects). Return effects pull cards back to matching discard piles</li>
        <li><strong>Trade</strong> — 1 Meet action; partner on same or adjacent hex; offer up to 3 Psyche</li>
        <li><strong>Landscape actions</strong> — 1 Meet action while standing on a tile: draw matching Mindstream, swap Psyche, move pieces, take Power, Return from Subconscious, and more</li>
        <li><strong>Forget</strong> — turns Landscapes to Wasteland; Encounters Repressed; Dreamers there lose 1 Psyche. If all outer tiles are Wasteland → <strong>Final Recurrence</strong></li>
      </ul>

      <h3>Mindstream &amp; Dreams</h3>
      <p>Three 70-card decks (Lucidity, Elasticity, Willpower): Dreambeasts, Objects, Events, Power cards, Draw-Dream cards. During Meet, draw from a Landscape's matching suit → resolve event → discard. Dreams are drawn once per round by the Head Dreamer and resolve their printed effects.</p>

      <h3>Death</h3>
      <p>At 0 Psyche, spend Power Tokens (cost = max(1, floor(alive/2))) to draw 1 Psyche and survive, or accept death: Repress top of each Mindstream deck, lose all Objects/Persistent/Power, return to The Bed with 4/3/2/1 Psyche (by death #), gain 2 Power, resolve an Additional Dream. Fifth death removes the Dreamer permanently.</p>

      <h3>Final Recurrence</h3>
      <p>Triggered when The Bed is Forgotten or all outer Landscapes become Wasteland. Goal points reset; remaining Archetypes become map Encounters. Defeat each with a Meet action, <strong>≥ 12</strong> pooled Psyche from <strong>all Dreamers</strong>, including at least one card of the <strong>opposing suit</strong>. Or sacrifice acquired Archetypes 1:1 to auto-defeat. Win by clearing all; lose if Dreams run out first.</p>
    </div>
  `;
}

/** Tabbed rules reference shell — activeTab is intro | rem | details. */
export function rulesReferenceHtml(activeTab = RULES_TAB_FEED, options = {}) {
  const { feedHtml = "<p class=\"dream-feed-empty\">Start a game to see the dream feed.</p>" } = options;
  const tabs = RULES_TABS.map(
    (t) => `<button type="button" class="rules-reference-tab${t.id === activeTab ? " active" : ""}" data-rules-tab="${t.id}">${t.label}</button>`,
  ).join("");

  const pages = [
    { id: RULES_TAB_FEED, html: feedHtml },
    { id: RULES_TAB_INTRO, html: rulesIntroHtml() },
    { id: RULES_TAB_REM, html: rulesRemHtml() },
    { id: RULES_TAB_DETAILS, html: rulesDetailsHtml() },
  ]
    .map(
      (p) => `<div class="rules-reference-panel${p.id === activeTab ? " active" : ""}" data-rules-panel="${p.id}">${p.html}</div>`,
    )
    .join("");

  return `
    <div class="rules-reference">
      <nav class="rules-reference-tabs" aria-label="Rules sections">${tabs}</nav>
      <div class="rules-reference-panels">${pages}</div>
    </div>
  `;
}

/** @deprecated Use rulesIntroHtml — kept for imports that expect overviewHtml. */
export function overviewHtml() {
  return rulesIntroHtml();
}

/** @deprecated Use rulesDetailsHtml — kept for imports that expect rulesHtml. */
export function rulesHtml() {
  return rulesDetailsHtml();
}
