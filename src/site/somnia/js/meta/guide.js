import { getPhase, activePlayer, headPlayer, allEncountersOnBoard } from "../core/state.js";
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
} from "../core/rules.js";
import { footerCreditsHtml } from "../audio/audio.js";

const TUTORIAL_KEY = "somnia_tutorial_seen";
const BASIC_TUTORIAL_KEY = "somnia_basic_tutorial_complete";
const ADVANCED_TUTORIAL_KEY = "somnia_advanced_tutorial_complete";
const GENTLE_START_KEY = "somnia_gentle_daydream_used";

export const COOP_PLAY_TIP = "Discuss and plan together. Any Dreamer may open a phase and takes the first action. After that, Pass Turn or Give Turn hands the night on.";

export const TUTORIAL_STEPS = [
  {
    id: "welcome",
    title: "Welcome to Somnia",
    body: "You are Dreamers trapped in a collapsing Dreamscape. Cooperate to earn Archetype points before the Dream Deck runs out — or never wake up. Any Dreamer may open a phase and acts first. Then Pass Turn or Give Turn.",
    target: null,
  },
  {
    id: "goal",
    title: "How You Win",
    body: "Complete quests on the Active Archetype (right panel), acquire it for points, and repeat until you reach your goal. Round 1's Dream is already drawn. Later rounds, the Head Dreamer draws a new Dream.",
    target: "#active-archetype",
  },
  {
    id: "suits",
    title: "Three Suits of Psyche",
    body: "Any Dreamer may open a phase by spending 1 suited Psyche. That Dreamer takes the first action. Afterward, Pass Turn moves clockwise. Pick a high matching stat when you can. Dreamer, Object, and Acquired Archetype bonuses still add.",
    target: "#hand-bar",
  },
  {
    id: "reveal",
    title: "Reveal Phase",
    body: "Discuss, then draw the Dream. Click **Draw Dream** left of Next Phase for the Head Dreamer (★). Select 1 Lucidity, then press **Reveal Landscapes** beside that Psyche. On your turn, click a glowing hex, or click your Dreamer portrait for actions.",
    target: "#board-viewport",
    phase: "Reveal",
  },
  {
    id: "explore",
    title: "Explore Phase",
    body: "Discuss who should spend Elasticity, then select 1 Elasticity and press **Spend Elasticity** beside that Psyche. Dreamers take turns. On your turn, click a green hex to move, or click your Dreamer portrait for actions.",
    target: "#board-viewport",
    phase: "Explore",
  },
  {
    id: "meet",
    title: "Meet Phase",
    body: "Discuss who spends Willpower, then select 1 Willpower and press **Gain Actions** beside that Psyche. Click a Dreamer or occupied Landscape for Meet actions. Encounters, Landscape actions, and Persistent Objects spend 1 action. Trade is free. A Power Token opens a phase, adds a die before the roll, or uses a Dreamer or Archetype power. Acquire is free once both quests are true. For Encounters, only the Dreamer on that Landscape may spend Psyche (up to 3).",
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

export function hasCompletedBasicTutorial() {
  try {
    return localStorage.getItem(BASIC_TUTORIAL_KEY) === "1";
  } catch {
    return false;
  }
}

export function markBasicTutorialComplete() {
  markTutorialSeen();
  try {
    localStorage.setItem(BASIC_TUTORIAL_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function hasCompletedAdvancedTutorial() {
  try {
    return localStorage.getItem(ADVANCED_TUTORIAL_KEY) === "1";
  } catch {
    return false;
  }
}

export function markAdvancedTutorialComplete() {
  markTutorialSeen();
  try {
    localStorage.setItem(ADVANCED_TUTORIAL_KEY, "1");
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
        "Their Objects are cleared and their Power Tokens return to the pool. The Mindstream is not touched.",
        "They return to The Bed with 3 Psyche and no new Power Tokens. The Bed's Draw 3 is available as normal.",
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
        steps.push(`When the group agrees, click **Draw Dream** to the left of Next Phase (${head.name} is Head ★).`);
      }
      if (state.dreamDrawn && !state.revealLandscapeUsed) {
        steps.push(
          "One Dreamer spends **1 Lucidity** to set the team reveal budget.",
          best
            ? `**${best.name}** has the best Lucidity bonus (+${totalStat(best, stat, state)}).`
            : "Pick the Dreamer with the highest Lucidity stat.",
        );
        if (budget >= 1) {
          steps.push(`Select 1 Lucidity, then click **Reveal Landscapes** beside that Psyche (${budget} reveals). On your turn, click a glowing hex, or click your Dreamer portrait for actions.`);
        }
      }
      return {
        phase: "Reveal",
        suit: state.dreamDrawn ? "lucidity" : null,
        title: state.dreamDrawn ? "Reveal Landscapes" : "Draw the Dream",
        steps,
        tip: state.dreamDrawn
          ? "After the Dream is resolved, one Dreamer spends Lucidity for team reveals."
          : "Click **Draw Dream** first — Lucidity reveals unlock afterward.",
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
      steps: ["Click **Next: Explore** in the top-right of the map when your group is ready. You do not have to spend Lucidity."],
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
            ? `Select 1 Elasticity, then click **Spend Elasticity** beside that Psyche (${budget} moves for everyone).`
            : "Select 1 Elasticity, then click Spend Elasticity beside that Psyche to unlock moves.",
        ],
        tip: "The Dreamer who opens takes the first move. On your turn, click your portrait for actions.",
      };
    }
    if (state.exploreMovesLeft > 0) {
      return {
        phase: "Explore",
        suit: "elasticity",
        title: "Move on the board",
        steps: [
          `Click a **green dashed hex** to move ${player.name}.`,
          `${state.exploreMovesLeft} team move(s) remaining. On your turn, click a green hex to move, or click your Dreamer portrait and choose **Draw 1 Psyche**. **Next: Meet** turns whatever is left into Psyche draws around the table.`,
        ],
        tip: "Click your Dreamer portrait on the board to open actions on your turn.",
      };
    }
    return {
      phase: "Explore",
      suit: "elasticity",
      title: "Exploration done",
      steps: ["Click **Next: Meet** in the top-right of the map whenever you are ready. Unused moves draw Psyche around the table."],
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
        tip: "Select 1 Willpower, then click Gain Actions beside that Psyche. Spend Meet actions from the Dreamer's radial or by clicking an occupied Landscape.",
      };
    }
    const pool = coopMeetPlayTotal(state);
    const count = allSelectedCards(state).length;
    const beasts = allEncountersOnBoard(state).length;
    const meter = beasts > 0
      ? `If you end the round now, ${beasts} Dreambeast${beasts === 1 ? "" : "s"} will Repress ${beasts} Psyche from the deck.`
      : "No Dreambeasts are roaming. Ending the round will not tax the Psyche deck.";
    const lines = [
      meter,
      `**${state.meetActionsUsed}/${state.meetActionBudget}** shared actions used.`,
      "Only the Dreamer on the selected Landscape may click Psyche to pool up to **3** for Meet plays there.",
      `Current pool: **${count}/3** cards, total **${pool}**.`,
    ];
    if (state.activeEncounter) {
      const enc = state.activeEncounter;
      lines.push(`Encounter **${enc.name}**: Accept (${enc.accept}) or Repress (${enc.reject ?? enc.repress}).`);
    } else {
      lines.push("On your turn, click your Dreamer portrait for Landscape actions, Trade, Dreamer Powers, or **Draw 1 Psyche**. Mark quests on the Archetype card. Next Phase turns unused actions into Psyche draws around the table.");
    }
    return {
      phase: "Meet",
      suit: "willpower",
      title: state.activeEncounter ? "Meet the Encounter" : "Spend Meet actions",
      steps: lines,
        tip: "Draw Mindstream as often as you have actions. Unique Landscape actions are once per table this Meet. Trade is free. The turn holder takes one Meet action, draws 1 Psyche, or passes. Dreamer Powers and Archetype Powers cost 1 Power Token. Unused actions draw Psyche around the table when Meet ends.",
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
      return `${name} — ${state.exploreMovesLeft} shared move(s) left. Click this portrait on the board for actions.`;
    }
    if (!state.exploreActivated) {
      return `${name} — discuss who spends Elasticity. The Dreamer who opens takes the first move.`;
    }
    return `${name} — click their portrait on the board for actions. Shared moves: ${state.exploreMovesLeft || "—"}.`;
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
      return `${state.meetActionsUsed}/${state.meetActionBudget} actions used · pool ${pool}/3. On your turn, click your portrait for actions.`;
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
      <p class="rules-lead">Wake up. Capture the Archetype for points, then stand together on The Bed before the Dream Deck runs out. Psyche cards are your hand: power and health. Blue Lucidity sees, yellow Elasticity walks, red Willpower acts. Each round is Reveal, Explore, Meet. Follow the sparkles.</p>
      <section class="overview-block tutorial-brief-outcomes">
        <h3>You will learn</h3>
        <ul>
          <li>Why you spend a color, and when to <strong>skip a phase</strong></li>
          <li>A fight you are meant to lose, then one you stack and win</li>
          <li>Who a beast can reach, and how to pass the Meet</li>
          <li>A Mindstream draw, one Commit, and a power that brings cards back</li>
        </ul>
        <p>Finish this lesson and the <strong>Advanced Tutorial</strong> unlocks: trade, objects, the other powers, death, and the boss on The Bed. You can also Begin Dreaming now, or skip this lesson and return to it from the menu.</p>
      </section>
    </div>
  `;
}

export function advancedTutorialBriefHtml() {
  return `
    <div class="rules-page tutorial-brief-page">
      <p class="rules-lead">The longer night. The Weaver and The Hunter are already in Meet. The sparkles still show every click.</p>
      <section class="overview-block tutorial-brief-outcomes">
        <h3>You will learn</h3>
        <ul>
          <li>The six free passives, and The Weaver's swap</li>
          <li>Trade, with both hands open</li>
          <li>Instant, Persistent, and Must-play Objects</li>
          <li>A paid Dreamer power, the Death Clock, and a boss on The Bed</li>
          <li>The <strong>?</strong> Dream Guide, which stays with you in a real dream</li>
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
      <p class="rules-lead">You wake within a place you've never been, with a feeling like you've never left. Capture the Archetypes. Stand together on The Bed. Wake before the Dream Deck runs out.</p>

      <section class="overview-block">
        <h3>How You Win</h3>
        <p>When both quests on the <strong>Active Archetype</strong> are already true, <strong>Acquire</strong> is free. Innocent, Orphan, and Outlaw (2 points) ask you to Draw Mindstream on any Landscape of their suit and Meet a Dreambeast of that suit. The 3-point Archetypes still name two Landscapes for each quest. <strong>Magician, Warrior, and Sage</strong> require defeating their boss and one Dreamer sacrificing one Object. Repeat until you reach your goal (<strong>8 / 12 / 24</strong> for Daydream, Nap, or Deep Sleep). Then every living Dreamer must stand on <strong>The Bed</strong> before the Dream Deck ends.</p>
      </section>

      <section class="overview-block">
        <h3>How You Lose</h3>
        <p>The <strong>Death Clock</strong> reaches 6. Or the <strong>Dream Deck</strong> empties before you reach your goal (<strong>11 / 14 / 18</strong> regular Dreams for Daydream, Nap, or Deep Sleep, plus Final Recurrence cards and three boss Dreams). The table also loses if the <strong>Psyche Deck</strong> and its discard are both empty, or if any Mindstream suit is entirely Repressed. In <strong>Final Recurrence</strong>, you lose if Dreams run out while Remaining Archetypes still stand on the map.</p>
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
            <li><strong>Power Tokens</strong> — open a phase, add a die before the roll, or use a power. Acquire costs nothing once both quests are true</li>
          </ul>
        </div>
        <div>
          <h3>Each Round</h3>
          <ul>
            <li><strong>Head Dreamer (★)</strong> rotates; their name is on the Dream draw</li>
            <li><strong>Round 1:</strong> each Dreamer starts with <strong>5 Psyche</strong></li>
            <li><strong>Round 2+:</strong> alive Dreamers draw <strong>2 Psyche</strong> at round start</li>
            <li><strong>One Dreamer per phase</strong> spends 1 suited card to set the team budget</li>
            <li>Unresolved Dreambeasts stay on the map. When the round ends, each one Represses 1 Psyche from the deck. During Final Recurrence, each undefeated Archetype does that instead. Fail hits only when Accept or Repress loses</li>
          </ul>
        </div>
      </section>

      <section class="overview-block">
        <h3>In This Reference</h3>
        <p>Use the <strong>R.E.M.</strong> tab for the three phases in depth. Use <strong>Details</strong> for encounters, death, bosses, objects, Mindstream, and Final Recurrence. The in-game <strong>Guide</strong> panel shows your next step every turn.</p>
      </section>

            <p class="overview-footer">Somnia v 40.0. Cooperative rules reference.</p>
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

      <p class="rules-formula"><strong>Budget formula:</strong> that 1 card's value + that Dreamer's matching stat, including Object and Acquired Archetype bonuses. A Power Token opens as <strong>1 + that Dreamer's suited stat</strong> instead of a card. You may also skip the phase without spending.</p>

      <section class="overview-block overview-phases">
        <div class="overview-phase suit-lucidity">
          <div class="overview-phase-head">${suitIconHtml("lucidity", { size: 16 })} <strong>Reveal</strong> — ${SUIT_LABELS.lucidity}</div>
          <p><strong>Head Dreamer (★)</strong> draws and resolves one <strong>Dream</strong> card each round — click <strong>Draw Dream</strong> left of Next Phase once the group agrees. Then <strong>one Dreamer</strong> spends 1 Lucidity card from the spread.</p>
          <ul>
            <li><strong>Setup:</strong> every Landscape is shuffled. The Bed is face-up. One random Landscape touching The Bed starts Revealed; all others start forgotten</li>
            <li><strong>Reveal budget</strong> = that 1 card's value + Lucidity bonuses (Dreamer, Objects, Acquired Archetypes) → click that many Wasteland hexes to flip Landscapes face-up</li>
            <li><strong>Unused Reveals</strong> draw 1 Psyche each, one Dreamer at a time, clockwise. If the map is already face-up, the whole Lucidity budget draws Psyche this way</li>
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
            <li>Click a Dreamer chip to choose who walks, then click a glowing Landscape. Each click is one adjacent hex</li>
            <li>While moves remain, green hexes are the only steps. A picture on a green hex is that hex</li>
            <li>Entering the <strong>Wasteland</strong> during Explore discards 1 Psyche (can trigger death)</li>
            <li><strong>Unused moves</strong> draw 1 Psyche each. Open the Dreamer and choose Draw 1 Psyche, or end Explore and the table draws whatever is left, one card at a time, clockwise</li>
          </ul>
        </div>

        <div class="overview-phase suit-willpower">
          <div class="overview-phase-head">${suitIconHtml("willpower", { size: 16 })} <strong>Meet</strong> — ${SUIT_LABELS.willpower}</div>
          <p><strong>One Dreamer</strong> spends 1 Willpower card to gain <strong>shared Meet actions</strong> for the team.</p>
          <ul>
            <li><strong>Start:</strong> each Boss steps 1 hex toward the nearest Dreamer, unless a Dreamer already shares its hex. There is no hand tax</li>
            <li><strong>Middle:</strong> action budget = that 1 card's value + Willpower bonuses. Spend on Encounters and Landscape actions. Accept and Repress are <strong>dice battles</strong>. You need at least 1 Psyche of the required suit (1–3 cards; allies extra). Beast Power = its dice. Recommended Dreamer Power is beast Power + 2 — you may play less and get lucky. +1d6 for matching Fantasy/Nightmare type and +1d6 for matching the beast's suit. Up to 3 Power Tokens add +1d6 each. 5s and 6s succeed</li>
            <li><strong>End of the round:</strong> each Dreambeast still on the board Represses 1 Psyche from the deck. During Final Recurrence, count undefeated Archetypes instead. If the Psyche deck and discard are both empty, you lose. Beasts stay until Accepted or Repressed. Fail hits only when Accept or Repress loses</li>
            <li>Each Landscape offers <strong>Draw Mindstream</strong> (repeatable) and one <strong>unique action</strong> (once per table this Meet). <strong>The Bed</strong> has Draw 3 Psyche, once per Dreamer this Meet</li>
            <li><strong>Opening:</strong> any Dreamer may spend the suited Psyche, no matter whose turn it was. The Dreamer who opens takes the first action</li>
            <li><strong>Pass Token:</strong> after that first action, Pass Turn or Give Turn moves clockwise through the remaining shared actions. Next Phase can still end Meet early</li>
            <li><strong>Dreamer passives,</strong> once a round, free: Runner's first move costs no team move. Hunter may shove the beast 1 hex after their first battle if it stays. Rested draws 1 Psyche at round end if they opened no phase. Weaver swaps 1 Psyche with an adjacent Dreamer once per Meet</li>
            <li><strong>Unused Meet actions</strong> draw 1 Psyche each, one Dreamer at a time. Ending Meet draws whatever is left the same way</li>
            <li>Innocent, Orphan, and Outlaw ask for a Mindstream draw on any Landscape of their suit and a Meet against a Dreambeast of that suit. The 3-point Archetypes still name two Landscapes. Magician, Warrior, and Sage require defeating their boss and one Dreamer sacrificing one Object</li>
            <li><strong>During Meet:</strong> Trade up to 3 Psyche with a Dreamer on the same or adjacent hex, and that is free. Declare up to 3 Power Tokens for +1d6 each before the dice roll. A Dreamer or Archetype Power costs 1 token. A Persistent Object costs 1 Meet action. Acquire is free once both quests are already true</li>
            <li><strong>After the dice land</strong>, stand. Ties favor the beast. A token cannot change the dice after they land.</li>
            <li>Using an Instant Object Represses it</li>
          </ul>
        </div>
      </section>

      <section class="overview-block">
        <h3>Phase Spender Tips</h3>
        <p>Pick the Dreamer with the <strong>highest matching stat</strong> to maximize budget. The UI highlights the best candidate. Only one Dreamer spends per phase — discuss first, then commit a card.</p>
      </section>

      <section class="overview-block">
        <h3>Round End</h3>
        <p>A circular <strong>Next Phase</strong> button stays in the top-right of the map, with <strong>Draw Dream</strong> to its left during Reveal. You may press Next after the budget is spent, or early. Unused Reveals, moves, and Meet actions draw 1 Psyche each, one Dreamer at a time, clockwise. Skipping a phase you never opened spends no Psyche. It is tinted the color of the phase you are about to enter (yellow Explore, red Meet, blue Reveal). <strong>Back</strong> sits in the top-left of the map, just right of the deck rail, and undoes the last action. Head Dreamer rotates clockwise at round end. Dreamer radials do not advance the phase.</p>
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
        <li>The guided tutorial plays opener rotation, a scripted loss where you Stand after the dice, beast reach, the Meet Pass, a stacked rematch, Mindstreams, quests, and powers. The guide window docks on the map. Drag the header or resize the corner if you want it elsewhere.</li>
        <li>Follow the sparkle: <strong>Draw Dream</strong> is left of Next Phase. Select 1 Psyche, then press the button beside it to open Reveal, Explore, or Meet. Click a Dreamer or an occupied Landscape for landscape options. Click Commit on the Active Archetype once both quests are true, or spend a Power Token. Every required click is highlighted, including hand cards, hexes, and Next Phase. <strong>Back</strong> sits at the top-left of the map if you need to undo.</li>
        <li>Each step shows a punchy Objective plus one or two sentences of why that action matters. <strong>?</strong> and Pause → Help stay available after you graduate.</li>
      </ul>

      <h3>Psyche &amp; Hand Limits</h3>
      <ul>
        <li>Tap or click to select · double-tap, long-press, or right-click to inspect · play 1 suited card per phase opener</li>
        <li>Max <strong>10 cards</strong> in hand, including accepted allies (+2 with Persistent Severed Torso); overflow discards to the Psyche discard pile</li>
        <li><strong>Wild Psyche</strong> (value 5) counts as any suit and discards like any other Psyche when spent</li>
        <li>Power Tokens are not in the Psyche deck. A Mindstream Power Token card offers <strong>Take 1 Power Token</strong>, or <strong>Return one Subconscious card for each Dreamer</strong></li>
        <li>Psyche is health. Allies do not pay a cost. With no Psyche left when a payment is due, you die and respawn on The Bed</li>
      </ul>

      <h3>Encounters (Dreambeasts)</h3>
      <ul>
        <li>Only the Dreamer <strong>standing on the Landscape</strong> may Meet the Encounter and pool Psyche (up to <strong>3</strong> cards; allies do not count toward the 3-card spread and may be any number)</li>
        <li><strong>Dice battle</strong> — at least 1 Psyche of the required suit. Beast <strong>Power</strong> is how many d6 it rolls (the old Accept/Repress cost). Recommended Dreamer Power is beast Power + 2; you may play less. Your Power is Psyche played (Nightmare/Fantasy and Suit bonuses included) plus matching Dreamer stat, +1d6 type, +1d6 suit, and +1d6 per Power Token on the spread (max 3). A 5 or 6 is a success. Most successes wins (ties favor the beast). Pools display up to 22d6</li>
        <li><strong>Accept</strong> (win) — beast joins hand as an ally worth half its Power, rounded down. Allies do not count toward the 3-card spread</li>
        <li><strong>Repress</strong> (win) — same Power, opposing suit; the beast goes to the Subconscious; resolve the printed reward</li>
        <li><strong>Lose the battle</strong> — Psyche and Power Tokens in the play are spent. The beast stays. Fail resolves when Accept or Repress loses. Leaving a hex is Explore</li>
        <li><strong>Round end</strong> — each Dreambeast still on the board Represses 1 Psyche from the deck. During Final Recurrence, each undefeated Archetype does that instead. An empty Psyche deck and discard loses the game. Beasts remain until Accepted or Repressed</li>
        <li>Meet bonuses: +1d6 if fantasy/nightmare affinity matches; +1d6 if primary suit matches the Dreambeast's suit; jewelry/stick Objects +1 each; body tag doubles highest card</li>
        <li>Spent allies are Repressed to the Subconscious. Spent Psyche, including Wild, goes to the discard</li>
      </ul>

      <h3>Spawning Dreambeasts</h3>
      <ul>
        <li>When an effect says <strong>Spawn a Dreambeast</strong>, cycle the Mindstream from the top until a Dreambeast appears, then discard the rest of that Mindstream and reshuffle the discard into a new draw pile</li>
        <li>Ebony Pawn spawns a <strong>Nightmare</strong>; Ivory Pawn a <strong>Fantasy</strong>. Choose a revealed Landscape for those Objects</li>
        <li>If the effect does not ask you to choose a tile, the beast appears on the acting Dreamer's Landscape. Bosses spawn on <strong>The Bed</strong></li>
      </ul>

      <h3>Bosses</h3>
      <ul>
        <li><strong>Cerberus</strong> — Power 11. On Accept, Repress top 3 Psyche</li>
        <li><strong>Double</strong> — Power 11. On Accept, Forget Day in the Life + Scary Classroom</li>
        <li><strong>Leviathan</strong> — Power 11 on The Bed. Accept befriends it. Repress sends it to the Subconscious, and it stays there</li>
        <li>Boss Dreams spawn the boss as an Encounter on <strong>The Bed</strong> (typically Reveal rounds <strong>3, 6, and 9</strong>)</li>
      </ul>

      <h3>Power Tokens</h3>
      <p>Team pool cap <strong>24</strong>. Start with <strong>1</strong> per Dreamer. Cards grant tokens only from Mindstream: take 1, or Return one Subconscious card per Dreamer. A token does three things: open a phase when nobody spends a suited card (<strong>1 plus that Dreamer's suited stat</strong>), add <strong>+1d6</strong> to a spread before the roll (max <strong>3</strong>), or use a Dreamer or Archetype power. Acquire is free once both quests are true. A Persistent Object costs 1 Meet action. Dying returns held tokens to the pool.</p>

      <h3>Dreamer Powers</h3>
      <p>Each costs <strong>1 Power Token</strong> and can be used in any phase. Lucidity Dreamers help Reveal, Elasticity Dreamers help Explore, Willpower Dreamers help Meet.</p>
      <ul>
        <li><strong>The Rested</strong> — each Dreamer draws 1 from the Psyche discard.</li>
        <li><strong>The Visionary</strong> — reveal a number of Landscapes equal to Dreamers + 1.</li>
        <li><strong>The Runner</strong> — all Dreamers move 2 spaces toward or away from The Bed.</li>
        <li><strong>The Hunter</strong> — move each active Dreambeast 1 space toward the nearest Dreamer or away from The Bed. If none are out, the token is not spent.</li>
        <li><strong>The Immovable</strong> — this Meet, every spread may add +1 Psyche. Used before Meet, the bonus waits until Meet begins.</li>
        <li><strong>The Weaver</strong> — each Dreamer may discard 1 Psyche to draw 1.</li>
      </ul>

      <h3>Archetypes &amp; Quests</h3>
      <p>Active Archetype shows 2 quests. When both are already true, Acquire is free, for <strong>2, 3, or 4</strong> points. <strong>Magician, Warrior, and Sage are worth 4</strong>. They grant passive stat bonuses only. Their quests are defeating that boss and one living Dreamer sacrificing one Object. Innocent, Orphan, and Outlaw are the 2-point Archetypes: Draw Mindstream on any Landscape of their suit, and Meet a Dreambeast of that suit. The 3-point Archetypes still name two Landscapes for each quest. Their powers cost 1 Power Token.</p>
      <ul>
        <li><strong>Innocent</strong> — Return 4 cards of any type from the Subconscious.</li>
        <li><strong>Orphan</strong> — everyone draws 2 Psyche.</li>
        <li><strong>Outlaw</strong> — the acting Dreamer draws 1 Object from the discard.</li>
        <li><strong>Caregiver</strong> — the Dreamer with the fewest Psyche draws 5, up to the hand limit.</li>
        <li><strong>Lover</strong> — Return 1 Object from the Subconscious.</li>
        <li><strong>Explorer</strong> — move 1 Dreamer or 1 Dreambeast to any Landscape of its suit.</li>
        <li><strong>Fool</strong> — Return Dreamers+2 cards from the Subconscious.</li>
        <li><strong>Creator</strong> — each Dreamer returns 1 Dreambeast from the Subconscious.</li>
        <li><strong>Ruler</strong> — each Dreamer returns 1 Event from the Subconscious.</li>
      </ul>

      <h3>Objects</h3>
      <ul>
        <li><strong>Object decks</strong> — three piles, one per suit. You acquire an Object only by drawing a Mindstream that says so, by successfully Accepting a Dreambeast, or as part of a Dream card. An empty pile reshuffles its discard. These decks do not end the dream</li>
        <li><strong>Instant</strong> — play from hand during Meet; the Object is then <strong>Repressed</strong></li>
        <li><strong>Persistent</strong> — the only Object that stays in play. Activating it costs 1 Meet action</li>
        <li><strong>Must-play</strong> — this Instant resolves when drawn, then is Repressed</li>
        <li><strong>Sets</strong> — 3 sticks, 3 jewelry, 3 chess, 4 elements, or 5 body parts. Completing any set lets you pick an Archetype still in the deck and Acquire it at once. The set is then Repressed. If the deck is empty, the set stays</li>
      </ul>

      <h3>Subconscious, Trade &amp; Landscapes</h3>
      <ul>
        <li><strong>Subconscious</strong> — face-up Repressed piles (Psyche, Dreambeasts, Mindstream by suit, Objects). Return puts those cards back into their discards so they can be drawn again. Clearing every card sparks the table, then the Head Dreamer may search the Dream discard and replay one Dream. It stays in the discard and does not spend the round's draw. A Mindstream suit left entirely in the Subconscious ends the dream</li>
        <li><strong>Trade</strong>: free during Meet. Partner stands on the same or adjacent hex. The trade window shows both hands, and each Dreamer offers up to 3 Psyche.</li>
        <li><strong>Landscape actions</strong> — Draw matching Mindstream as often as you have Meet actions. Each unique Landscape action is once per table this Meet. <strong>The Bed:</strong> Draw 3 Psyche, once per Dreamer this Meet. Quests still name their Landscape even if it is forgotten</li>
        <li><strong>Map setup</strong> — shuffle every Landscape. The Bed is face-up. One random Landscape touching The Bed starts Revealed; all others start forgotten. Further Reveals require 1 Lucidity Psyche</li>
        <li><strong>Forget</strong> — turns Landscapes to Wasteland; Encounters Repressed; Dreamers there lose 1 Psyche. If all outer tiles are Wasteland → <strong>Final Recurrence</strong></li>
      </ul>

      <h3>Mindstream &amp; Dreams</h3>
      <p>Three 56-card decks (Lucidity, Elasticity, Willpower): Dreambeasts, Events, 8 Power Token cards, and Draw-Dream cards. Objects are not in the Mindstream. When a Mindstream draw pile is empty, shuffle its discard into a new draw pile. If a suit is entirely Repressed in the Subconscious — none left in that Mindstream, its discard, or in play — the table loses immediately. The Psyche Deck works the same way: when its draw pile is empty, shuffle the discard. If both the Psyche draw pile and discard are empty, the table loses immediately. Spawn a Dreambeast by cycling from the top until a beast, then discard the rest of that Mindstream. Every Dream, including the first, uses the card's printed condition. Bright if that condition is met. Otherwise Dim. The Head Dreamer draws one Dream each round. Bright then costs a Repress, a discarded Psyche, or a Forgotten Landscape. You choose which cards to discard or repress. Dim is free. A banner stays up at <strong>10%</strong> remaining and tells the table to <strong>Return</strong> cards from the Subconscious; it flashes at <strong>5%</strong>; at <strong>1%</strong> the Dreamscape turns unstable and the nightmare closes in. Each low deck is tagged on the rail.</p>

      <h3>Death</h3>
      <p>A Dreamer with <strong>no Psyche</strong> who must pay even one dies. The Death Clock ticks. Their Objects are cleared and their tokens return to the pool. They redraw <strong>3 Psyche</strong> on <strong>The Bed</strong>. The Mindstream is not touched. The <strong>sixth death</strong>, shared by the whole table, ends the night at once.</p>

      <h3>Final Recurrence</h3>
      <p>Triggered when <strong>The Final Recurrence</strong> is drawn (first of the ten endgame Dreams), or when every outer Landscape has been forgotten. The Bed cannot be forgotten. Goal points reset. Each remaining Archetype appears on a Landscape named in its quests, or on a revealed Landscape of its suit, or on The Bed. Defeat each with a Meet action: pool up to 3 Psyche from the table, including that Archetype's suit, and win a dice battle against <strong>Power 12</strong>. A win Acquires the Archetype immediately and its power is ready. Win by clearing every Remaining Archetype. If the Dream Deck runs out first, you never wake up.</p>
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
          <p class="info-hub-kicker">Somnia v 40.0</p>
          <h2>Dream Guide</h2>
          <p class="info-hub-lead">You wake within a place you've never been, with a feeling like you've never left. Capture the Archetypes. Stand together on The Bed. Wake before the Dream Deck runs out.</p>
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
            <p><strong>Win:</strong> when both Active Archetype quests are already true, <strong>Acquire</strong> is free, for 2, 3, or 4 points. Repeat until the goal. Magician, Warrior, and Sage are worth 4: defeat their boss, and have one Dreamer sacrifice one Object. Daydream asks for <strong>8</strong>, Nap for <strong>12</strong>, Deep Sleep for <strong>24</strong>. Then stand together on <strong>The Bed</strong> before the Dream Deck ends.</p>
            <p><strong>Lose:</strong> the Death Clock reaches 6, the Dream Deck empties first, the Psyche Deck and discard are both empty, or any Mindstream suit is entirely Repressed in the Subconscious. A top-of-screen warning appears when those decks hit 10%, stays flashing at 5%, and makes the table unstable at 1%. In Final Recurrence you lose if Dreams run out while remaining Archetypes still stand.</p>
          </div>
          <div class="info-hub-rule">
            <h3>Play Together</h3>
            <p>${COOP_PLAY_TIP} Opening costs <strong>1 suited Psyche</strong> (or <strong>1 Power Token as 1 plus that suited stat</strong>). Budget = that card's value + Dreamer, Object, and Acquired Archetype bonuses. Bright is the paid path. Dim is free. The card remembers which one you chose.</p>
          </div>
          <div class="info-hub-rule info-hub-rem">
            <h3>R.E.M. — Every Round</h3>
            <ul>
              <li class="suit-lucidity"><strong>Reveal</strong> — Head (★) draws a Dream. Spend Lucidity to flip Wastelands. Unused Reveals draw 1 Psyche each, around the table.</li>
              <li class="suit-elasticity"><strong>Explore</strong> — Spend Elasticity for shared moves. Entering Wasteland discards 1 Psyche. Unused moves draw 1 Psyche each, one Dreamer at a time.</li>
              <li class="suit-willpower"><strong>Meet</strong> — Spend Willpower. Pass Turn moves around the table, one Meet action at a time. One Power: Accept befriends, Repress banishes, and 5s and 6s succeed. Beasts left behind Repress 1 Psyche from the deck each. During Final Recurrence, undefeated Archetypes do that instead. If the Psyche deck is gone, you lose. Unused Meet actions draw 1 Psyche each, around the table.</li>
            </ul>
          </div>
          <div class="info-hub-rule">
            <h3>Meet Pass</h3>
            <p>After Meet opens, a Pass Token starts with a living Dreamer who did not open the phase. If the Head opened it, the next Dreamer clockwise holds it. They take one Meet action, or pass. Passing moves the token clockwise. A Dreamer who dies drops the token. Next Phase can still end Meet early.</p>
          </div>
          <div class="info-hub-rule">
            <h3>Free Passives</h3>
            <p>Once a round, and free:</p>
            <ul>
              <li><strong>Runner</strong>'s first move costs no team move.</li>
              <li><strong>Immovable</strong> has no free tax ignore. The round tax does not care where you stand.</li>
              <li><strong>Hunter</strong> may shove the beast 1 hex after their first battle, if it stays.</li>
              <li><strong>Rested</strong> draws 1 Psyche at round end if they opened no phase.</li>
              <li><strong>Weaver</strong> swaps 1 Psyche with an adjacent Dreamer once per Meet.</li>
            </ul>
          </div>
          <div class="info-hub-rule">
            <h3>Paid Dreamer Powers</h3>
            <p>Each costs <strong>1 Power Token</strong>. During Meet it does not spend the action budget.</p>
            <ul>
              <li><strong>Rested:</strong> each Dreamer draws 1 from the Psyche discard.</li>
              <li><strong>Visionary:</strong> reveal a number of Landscapes equal to Dreamers + 1.</li>
              <li><strong>Runner:</strong> everyone moves 2 hexes toward or away from The Bed.</li>
              <li><strong>Hunter:</strong> move each Dreambeast 1 hex toward the nearest Dreamer or away from The Bed.</li>
              <li><strong>Immovable:</strong> Hold the Line. This Meet, every spread may add +1 Psyche. Used earlier, it waits until Meet.</li>
              <li><strong>Weaver:</strong> each Dreamer may discard 1 Psyche to draw 1.</li>
            </ul>
          </div>
          <div class="info-hub-rule">
            <h3>Encounters</h3>
            <p>Only the Dreamer on the tile may Meet and pool up to <strong>3 Psyche</strong> (allies extra). At least 1 card of the required suit. A beast has one Power. Accept befriends it: the ally is worth half that Power, rounded down, and you draw an Object of its suit. Repress banishes it to the Subconscious and resolves its printed reward. 5s and 6s succeed. Ties favor the beast. A token adds a die only before the roll. Lose and the play is spent; the beast stays. Each beast left on the board Represses 1 Psyche from the deck at the end of the round.</p>
          </div>
          <div class="info-hub-rule">
            <h3>Hands, Tokens &amp; Objects</h3>
            <p>Your hand is your life. Round 1 starts at 5. From round 2, each living Dreamer draws 2. Wild (5) is any suit and discards when spent. A token opens a phase, adds a die, or uses a power. Instant Objects resolve and are Repressed. Must-play is an Instant that resolves when drawn. Persistent is the only Object that stays, and it costs 1 Meet action. A finished Object set lets you Acquire an Archetype from the deck, then Represses the set.</p>
          </div>
          <div class="info-hub-rule">
            <h3>Bosses</h3>
            <p>Cerberus, Double, and Leviathan are Power 11. Their Dreams spawn them on <strong>The Bed</strong>. Leviathan is met like any other beast. Accept befriends it. Repress sends it to the Subconscious, and it stays. Other spawned beasts land on the acting Dreamer's Landscape unless the card says to choose a tile.</p>
          </div>
          <div class="info-hub-rule">
            <h3>Death &amp; Final Recurrence</h3>
            <p>No Psyche when a payment is due: the Death Clock ticks, that Dreamer's Objects clear, their tokens return to the pool, and they redraw 3 Psyche on The Bed. The Mindstream is not touched. Six deaths end the night. When the outer map is gone, the remaining Archetypes are Power 12. Win those dice battles or you do not wake.</p>
          </div>
          <p class="info-hub-footer">Draw Dream sits left of Next Phase during Reveal. Select 1 Psyche, then press the button beside it to open that phase. A token can open a phase when nobody spends a card. Back in the top-left undoes the last action. Click Commit on the Active Archetype once both quests are true. The Head (★) rotates at round end.</p>
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
