import { getPhase, allEncountersOnBoard } from "../core/state.js";
import {
  allSelectedCards,
  bestPhaseContributor,
  statForPhaseBudget,
  totalStat,
} from "../core/rules.js";
import { playerPrimerHtml, glossaryPanelHtml, bindGuideHub } from "./glossary.js";
import { SOMNIA_VERSION } from "./changelog.js";

export { bindGuideHub, playerPrimerHtml };

const TUTORIAL_KEY = "ainmos_tutorial_seen";
const BASIC_TUTORIAL_KEY = "ainmos_basic_tutorial_complete";
const ADVANCED_TUTORIAL_KEY = "ainmos_advanced_tutorial_complete";
const GENTLE_START_KEY = "ainmos_gentle_daydream_used";


export const TUTORIAL_STEPS = [
  {
    id: "welcome",
    title: "Welcome to Ainmos",
    body: "You are a Dreamer in a collapsing Dreamscape. One goal: Acquire Archetypes (3, 6, or 12) before the night runs out, or never wake up.",
    target: null,
  },
  {
    id: "goal",
    title: "How You Win",
    body: "The third Dream of each Cycle offers 1 of 3 Archetypes. The one you call appears on one of its two home Landscapes and slips 1 Landscape away as each Meet ends. Walk to it, Meet it (its Event, then a fight against Power 12 with a spread that makes a Form), and Acquire it. The Archetypes window tracks them.",
    target: "#archetype-window",
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
    body: "Discuss who spends Willpower, then select 1 Willpower and press **Gain Actions** beside that Psyche. Click a Dreamer or occupied Landscape for Meet actions. Encounters, Landscape actions, and Persistent Objects spend 1 action (each Persistent Object taps once per Meet). Trade is free. A Power Token opens a phase, adds a die before the roll, or uses a Dreamer or Archetype power. Acquire is free once both quests are true. For Encounters, only the Dreamer on that Landscape may spend Psyche (up to 3).",
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
        "Their Objects are discarded. Power Tokens are kept.",
        "They wake on The Bed with 6 fresh Psyche. The Death Clock ticks.",
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
        "Each shuffles back into the Landscape deck. Anyone standing there dies and wakes on The Bed; Dreambeasts there are discarded; Archetypes retreat to The Bed. The Bed cannot be forgotten.",
      ],
      tip: "Tiles glow red when clickable.",
    };
  }

  // Ainmos is solo: every objective speaks to you, one short step at a time.
  if (phase === "Reveal") {
    if (state.landscapePick?.mode === "reveal" && (state.landscapePick.remaining || 0) > 0) {
      return {
        phase: "Reveal",
        suit: "lucidity",
        title: "Build the dream",
        steps: [
          `Pick a Landscape in the Vault, then tap a glowing hex beside the dream. **${state.landscapePick.remaining}** left.`,
        ],
        tip: "Refreshing the Vault costs 1, then 2, then 3 this round.",
      };
    }
    if (!state.dreamDrawn) {
      return { phase: "Reveal", suit: null, title: "The Dream is coming", steps: ["Each round opens on its Dream. Endure it."] };
    }
    if (!state.revealLandscapeUsed) {
      return {
        phase: "Reveal",
        suit: "lucidity",
        title: "Open Reveal",
        steps: ["Your Lucidity is your free Reveal Actions: each places a Landscape. Add 1 Lucidity card for +its value."],
        tip: "Only Reveals you paid for bank Glimmer ✧ if unused.",
      };
    }
    return { phase: "Reveal", suit: "lucidity", title: "Reveal done", steps: ["Tap **Next** when you are ready to walk."] };
  }

  if (phase === "Explore") {
    if (!state.exploreActivated) {
      return {
        phase: "Explore",
        suit: "elasticity",
        title: "Open Explore",
        steps: ["Your Elasticity is your free steps. Add 1 Elasticity card for +its value. Head for the beasts before dusk."],
      };
    }
    if (state.exploreMovesLeft > 0) {
      return {
        phase: "Explore",
        suit: "elasticity",
        title: "Walk the dream",
        steps: [`Tap a glowing hex to move. **${state.exploreMovesLeft}** step${state.exploreMovesLeft === 1 ? "" : "s"} left.`],
        tip: "Only steps you paid for bank Glimmer ✧ if unused.",
      };
    }
    return { phase: "Explore", suit: "elasticity", title: "Walk done", steps: ["Tap **Next** to Meet."] };
  }

  if (phase === "Meet") {
    if (state.meetActionBudget === 0) {
      return {
        phase: "Meet",
        suit: "willpower",
        title: "Open Meet",
        steps: ["Your Willpower is your free Meet Actions. Add 1 Willpower card for +its value."],
        tip: "Every beast left standing bleeds 1 Psyche from the Waking Mind at dusk.",
      };
    }
    const beasts = allEncountersOnBoard(state).length;
    const left = Math.max(0, state.meetActionBudget - (state.meetActionsUsed || 0));
    const lines = [
      `**${left}** action${left === 1 ? "" : "s"} left. Fight the beast on your hex as often as you can afford.`,
      beasts > 0
        ? `${beasts} Dreambeast${beasts === 1 ? "" : "s"} still stand${beasts === 1 ? "s" : ""}: each bleeds 1 Psyche at dusk.`
        : "Nothing stands. Dusk will be quiet.",
    ];
    if (state.activeEncounter) {
      lines.push(`**${state.activeEncounter.name}**: Power ${state.activeEncounter.accept}. Aim for ${(state.activeEncounter.accept || 0) + 2}; ties go to you.`);
    }
    return {
      phase: "Meet",
      suit: "willpower",
      title: state.activeEncounter ? "Fight" : "Spend your actions",
      steps: lines,
      tip: "Fight the Dreambeast here, Meet the Archetype here, use one of your Landscape's two actions, or tap a Persistent Object. Only Meet Actions you paid for become Glimmer ✧ if unused.",
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


export function infoHubHtml(options = {}) {
  const { feedHtml = "<p class=\"dream-feed-empty\">Start a game to see the dream feed.</p>" } = options;
  return `
    <div class="info-hub">
      <header class="info-hub-header">
        <div class="info-hub-brand">
          <p class="info-hub-kicker">Ainmos v ${SOMNIA_VERSION}</p>
          <h2>Dream Guide</h2>
          <p class="info-hub-lead">Build the dream. Climb the Bosses. Wake before you forget yourself.</p>
        </div>
        <div class="info-hub-tabs" role="tablist" aria-label="Dream Guide">
          <button type="button" class="is-on" role="tab" data-guide-tab="now" aria-selected="true">Now</button>
          <button type="button" role="tab" data-guide-tab="primer" aria-selected="false">Primer</button>
          <button type="button" role="tab" data-guide-tab="glossary" aria-selected="false">Glossary</button>
        </div>
        <button type="button" class="btn primary info-hub-play" data-info-hub-play>PLAY</button>
      </header>
      <div class="info-hub-panel" data-guide-panel="now">
      <div class="info-hub-grid">
        <section class="info-hub-feed" aria-label="Dream Feed">
          ${feedHtml}
        </section>
        <section class="info-hub-rules" aria-label="Rules highlights">
          <p class="info-hub-onepager"><a href="how-to-play.html" target="_blank" rel="noopener">How to Play on one page ↗</a></p>
          <div class="info-hub-rule">
            <h3>Win &amp; Lose</h3>
            <p><strong>Win:</strong> Acquire <strong>3</strong> Archetypes on a Daydream, <strong>6</strong> on a Nap, <strong>all 12</strong> in Deep Sleep.</p>
            <p><strong>Lose:</strong> the Waking Mind runs dry (watch the <strong>Mind</strong> counter and its dusk forecast), or the sixth death.</p>
          </div>
          <div class="info-hub-rule">
            <h3>The Night</h3>
            <p>A night is 3, 7, or 15 <strong>Cycles</strong>. Each Cycle is <strong>3 Dreams</strong> of Reveal · Explore · Meet: <strong>9 phases</strong>. Dream 1 is a <strong>Dream</strong> to endure. Dream 2 brings the Cycle's <strong>Dreambeast</strong> to a Landscape of its suit; it chases you and bleeds you every dusk. Dream 3 lets you call <strong>1 of 3 Archetypes</strong>. Every Dream ends at the <strong>Lost &amp; Found</strong>; then the next round begins and you draw 3 Psyche (4 more at the dawn between Cycles). When the Dream Deck runs dry, the <strong>Long Night</strong> Represses 2, then 4, then 6 more at every dusk.</p>
          </div>
          <div class="info-hub-rule info-hub-rem">
            <h3>R.E.M. — Every Round</h3>
            <ul>
              <li class="suit-lucidity"><strong>Reveal</strong> — the Dream is drawn and endured. Your <strong>Lucidity</strong> is your free Reveal Actions: each places a Landscape from the Vault.</li>
              <li class="suit-elasticity"><strong>Explore</strong> — your <strong>Elasticity</strong> is your free steps.</li>
              <li class="suit-willpower"><strong>Meet</strong> — your <strong>Willpower</strong> is your free Meet Actions: fight a Dreambeast, Meet an Archetype, use one of your Landscape's two actions (Call a Dreambeast of its suit, or its own action), or tap a Persistent Object.</li>
            </ul>
            <p><strong>Your stats are your free Actions every phase.</strong> Want more? Spend 1 Psyche of the phase's suit for +its value. Free Actions are used first; only the ones you paid for bank Glimmer ✧ if unused, which pays toward the next Lost &amp; Found.</p>
          </div>
          <div class="info-hub-rule">
            <h3>Fights</h3>
            <p>Play 1–3 Psyche of any suit. Each Dreambeast arrives at its Power plus the Cycle, and wards one Dream Form (−1 to −5 dice off that Form). Your Power is their values plus your matching stat (if a card of its suit is in the spread), your Dream Form. Each side rolls its Power in d6; 5s and 6s succeed; <strong>ties go to you</strong>. Aim for the beast's Power + 2. Win and you <strong>Accept</strong> it: it leaves the board and you take <strong>2 Power Tokens</strong>, an <strong>Object of its suit</strong>, or (once you have started a Set) <strong>a missing Set piece</strong>. Lose and the cards are spent; the beast stays.</p>
          </div>
          <div class="info-hub-rule">
            <h3>Archetypes</h3>
            <p>Meeting one costs 1 action and opens with one of its <strong>Events</strong>. <strong>Bright</strong> (only while the Event's Landscape is placed) costs Psyche you choose, and each point paid buys one small thing (+1 die, Return 1, Draw 2, Reveal 1, an Object). <strong>Dim</strong> is free and puts one drawback on the fight. Then play a spread that makes a <strong>Dream Form</strong> against Power 12. Win: +1 Archetype, +1 Power Token, and its power is yours. You can only call an Archetype whose home Landscape is revealed.</p>
          </div>
          <div class="info-hub-rule">
            <h3>Repress &amp; Return</h3>
            <p><strong>Only Psyche is Repressed</strong>: it leaves play and waits in the <strong>Subconscious</strong>. The night starts with 12 random Psyche already there. <strong>Return</strong> always brings back Psyche, and you choose which. Lost Objects are Discarded. A <strong>Forgotten</strong> Landscape shuffles back into the Landscape deck; anyone on it dies and wakes on The Bed.</p>
            <p><strong>Dying</strong> (no Psyche left, or a Forgotten Landscape under you): you wake on The Bed with a new hand of 6, lose your <strong>Objects</strong>, and keep your Power Tokens, Forms, and Archetypes. The sixth death ends the night.</p>
            <p><strong>Sets</strong>: collect every piece (Body 5, Elements 4, Jewelry 3, Sticks 3) to Acquire an Archetype. Once you hold a piece, the Lost &amp; Found always shows a missing one, a beaten Dreambeast can pay one, and <strong>The One</strong> Mimics one.</p>
            <p><strong>Power Tokens</strong>: hold up to 6. You start with 2, take 2 for beating a Dreambeast (or an Object of its suit instead), and gain 1 for each Archetype.</p>
          </div>
          <div class="info-hub-rule info-hub-glimmer">
            <h3>Glimmer ✧</h3>
            <p><strong>Any</strong> Reveal, step, or Meet action you leave unspent becomes <strong>1 Glimmer</strong> when the phase ends (up to 10 banked, shown at the top). In the <strong>Lost &amp; Found</strong> at the start of the next round, Glimmer pays first: 1 value of any price, in any suit. 3 Glimmer looks again. Awards banks 6.</p>
          </div>
          <div class="info-hub-rule">
            <h3>Between Rounds</h3>
            <p>The <strong>Lost &amp; Found</strong> sells Objects for Psyche of their suit, and one Insight that levels a Dream Form or upgrades a card. Psyche is your health and your coin.</p>
          </div>
          <div class="info-hub-rule">
            <h3>Remember</h3>
            <p><strong>Remember N:</strong> discard up to N Psyche, then Return that many plus 1 from the Subconscious. You choose which Psyche come back. Tranquil Grove, Remember Objects, and the Innocent Remember.</p>
          </div>
          <p class="info-hub-footer">Back in the top-left undoes the last action.</p>
        </section>
      </div>
      </div>
      <div class="info-hub-panel info-hub-panel-primer" data-guide-panel="primer" hidden>
        ${playerPrimerHtml()}
      </div>
      <div class="info-hub-panel info-hub-panel-glossary" data-guide-panel="glossary" hidden>
        ${glossaryPanelHtml()}
      </div>
    </div>
  `;
}

/** @deprecated Tabs were replaced by the v19 info hub. */
export function rulesReferenceHtml(_activeTab = RULES_TAB_FEED, options = {}) {
  return infoHubHtml(options);
}
