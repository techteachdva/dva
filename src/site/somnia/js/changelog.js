import {
  musicCreditHtml,
  artCreditHtml,
  boxArtCreditHtml,
} from "./audio-settings.js";
import { hideUtilityModal } from "./ui.js";

export const SOMNIA_VERSION = "29.2";

/** Major releases and notable revisions (newest first). */
export const CHANGELOG = [
  {
    version: "29.2",
    title: "Objects, Subconscious Binder & Hand Fan",
    notes: [
      "Instant Objects are free in every phase (hand + Dreamer radial). Persistent sets count hand and play zone; Monkey Paw shows golden token chips.",
      "Return picker uses a 12×4 paginated Subconscious binder with deck tags and a detail view with prev/next.",
      "Object and Return steps show a sticky action banner plus moment toasts; Psyche fans spread a bit wider and read more solid.",
    ],
  },
  {
    version: "29.1",
    title: "Tutorial Archetype Power & Spotlight",
    notes: [
      "Tutorial step 15 grants a Meet action and Power Token so Innocent Power is always clickable after quest marks.",
      "The highlight circle re-tracks during board focus animation and when Dreamer radials open.",
    ],
  },
  {
    version: "29.0",
    title: "The Tutorial Shine Update",
    notes: [
      "Tutorial Mode is a scripted two-round story: Heroism and Misunderstanding instead of Quiet, a stacked lose-then-win Mandrake fight, skip-phase teaching, Innocent acquire, powers, and the real wake-up fanfare.",
      "The highlight circle tracks the board camera after zoom and pan, and follows each rail beat (Psyche in hand, then Reveal / Elasticity / Gain Actions on the spread opener).",
      "Skipping Reveal no longer spends Lucidity. Leftover Dreambeasts still show the end-of-Meet Forget tax in the lesson.",
      "New galaxy binary favicon site-wide.",
    ],
  },
  {
    version: "28.1",
    title: "Shared Landscape Play",
    notes: [
      "When two Dreamers share a Landscape, the focused Dreamer can play their own Psyche. Sharing The Bed no longer greys the second hand for the Head.",
      "Draw Dream still belongs to the Head Dreamer. Meet actions on a tile go to whoever you have selected there.",
    ],
  },
  {
    version: "28.0",
    title: "Unstable Dreamscape",
    notes: [
      "A Dreamer with no Psyche cards and no allies dies immediately. Objects go to Mindstream discards, Power Tokens return to the pool, and they respawn on The Bed with 1 fewer starting Psyche (5→4→3→2→1). Respawn does not grant Power Tokens — only the opening 1 per Dreamer. The fifth death of any Dreamer ends the game at once.",
      "Mindstream suits, the Psyche Deck, and the Dream Deck warn before they can end the game: a fading banner at 10% remaining, a flashing persistent banner at 5%, and a severe unstable-table warning at 1%.",
      "Combat dice keep their cube shape instead of flattening after they land. Dev console: pressure, warn, unstable, and dice.",
    ],
  },
  {
    version: "27.0.1",
    title: "Undo and Leviathan",
    notes: [
      "Back no longer crashes the table after undoing a card picker, and opening a discard pile ignores missing cards.",
      "Judgement no longer stacks extra Leviathans onto The Bed. If Leviathan is already in play, Judgement moves that one. Reloading a save collapses duplicate bosses.",
    ],
  },
  {
    version: "27.0",
    title: "Underpay Dice Battles",
    notes: [
      "Accept and Reject no longer require matching the beast's Power. You need at least 1 Psyche of the required suit (1–3 cards; allies extra). Recommended Dreamer Power is beast Power + 2. Play less and you might still win the roll.",
      "A Dreambeast's Power is the dice it rolls. Your Power is the Psyche you played (Nightmare/Fantasy and Suit included), plus matching Dreamer stat, +1d6 for matching type, +1d6 for matching the beast's suit, and +1d6 per Power Token on the spread (max 3). Pools display up to 22d6. Wild mill is paid before the dice hit the table.",
    ],
  },
  {
    version: "26.0",
    title: "The Dreambeast Dice Battle Update",
    notes: [
      "Meet Phase is now three beats. Start: each Dreamer Represses 1 Psyche from hand per roaming Dreambeast. Middle: spend Willpower for shared Actions. End: Forget 1 random Landscape per remaining beast, then each remaining beast's Fail cost resolves in spawn order. Roaming beasts stay on the map until you Accept or Reject them.",
      "Accept and Reject are dice battles. Your pool is Nd6 equal to the Psyche you played; the beast rolls dice equal to its Accept or Reject cost. 5s and 6s succeed. Most successes wins. Win to resolve the Meet. Lose and the play is spent — the beast stays and will Fail at the end of Meet. White dice on the left, black dice on the right, rolling on the table.",
      "Reject costs now match Accept point values (different suit). Fail costs are harsher: about half the Accept value in Repressed cards, plus Forget where the creature's theme calls for it.",
    ],
  },
  {
    version: "25.0",
    title: "Map chrome, spread spend, and Wild cost",
    notes: [
      "Draw Dream sits left of Next Phase during Reveal. Back is visible at the top-left of the map, just right of the deck rail. Select 1 Psyche and press the button beside it to open Reveal, Explore, or Meet — the table then flashes blue, yellow, or red.",
      "Dreamer radials are View, Dreamer Power, and landscape or Meet actions only. Quests, Token as Psyche, and Persistent Object activation live on the Power Token radial. Click a ready quest on the Active Archetype to spend a token. Click an occupied Landscape for its options. Drawing a Dream blinks the table to black.",
      "Playing a Wild Psyche Represses the top 5 cards of the Psyche Deck. If the Psyche draw pile and discard are both empty, the table loses immediately. The guided tutorial follows these controls.",
    ],
  },
  {
    version: "24.3",
    title: "Bed restock and Meet action costs",
    notes: [
      "The Bed keeps Draw 3 Psyche as Action A. Action B is now Play 3 Psyche Points, then Draw 3 Psyche Cards. Each Bed action is once per Dreamer per Meet.",
      "During Meet, using a Dreamer Power or an Archetype Power spends 1 of the shared action budget. Placing a Power Token for +1 on a spread, activating an Object, and marking a completed quest stay free.",
      "The Dream Guide, rules overview, and tutorial match 24.3: skippable Next Phase, map Back, Bed actions, and which Meet clicks cost an action.",
    ],
  },
  {
    version: "24.2",
    title: "Skip any phase, undo any action",
    notes: [
      "Next Phase stays in the top-right of the map. You can skip a phase without spending Psyche. The circle is the color of the phase you are about to enter: yellow into Explore, red into Meet, blue into Reveal.",
      "Back sits in the top-left of the map, the same size as Next. It restores the table to the moment before your last action.",
    ],
  },
  {
    version: "24.1",
    title: "Dreamer radial hotfix",
    notes: [
      "Clicking a Dreamer on the board opens the action radial again. It no longer hides behind the table or gets eaten by a second tap.",
      "Tutorial starts with one Mandrake on House. Goofus Bird arrives on The Basement in Round 2, and that Meet must be Rejected.",
    ],
  },
  {
    version: "24.0",
    title: "Card backs, deck flips, and Lucidity Reveals",
    notes: [
      "Official Somnia wordmark in the top-left. Psyche, Archetype, and three Mindstream card backs are in the game and on the print tray.",
      "Draw piles show those backs. Drawing a card flips from back to face. Discard piles stay clickable; deck tops stay peekable.",
      "In Meet, a Dreamer on a matching Landscape (or Forest) can Draw Mindstream by clicking that Mindstream's card back.",
      "When every Landscape is Revealed, leftover Lucidity Reveals flip the next facedown card of a Mindstream. Flipped cards stay face-up; a pile can show ten or more.",
    ],
  },
  {
    version: "23.1",
    title: "Tutorial window, why-copy, and rules",
    notes: [
      "The tutorial guide docks at a readable default size (about 420×280 and up) and forgets the old cramped window size.",
      "Each step keeps the punchy one-sentence Objective and adds one or two sentences of why/what you are doing.",
      "Highlights follow every click: Dreamer token first, then the matching radial button, then the map Next Phase control.",
      "Rules Details and the Dream Guide match 23.1: Next Phase on the map, Draw Mindstream vs unique Landscape actions, Meet tax, spawn mill, and Dream deck sizes 11 / 14 / 18.",
      "Removed unauthorized Event pressure (a ~45% extra Dreambeast after resolved Events). Dreambeasts spawn only from authored card and effect text, Draw Mindstream when the card itself is a Dreambeast, and explicit Spawn a Dreambeast effects.",
    ],
  },
  {
    version: "23.0",
    title: "Readable Psyche, Next Phase, Spawn & Subconscious",
    notes: [
      "Psyche rank and suit icons are three times larger, Power Surge is yellowish-purple, and the hand fans with tighter stacking.",
      "After Reveal, Explore, or Meet budgets are spent, a circular Next Phase button appears at the top-right of the map. Dreamer radials no longer advance the phase.",
      "Ebony Pawn now spawns a Nightmare (Ivory a Fantasy) on a chosen revealed Landscape. Spawn a Dreambeast cycles a Mindstream from the top until a beast, then discards the rest of that suit and reshuffles. Dreams and Events spawn on the acting Dreamer's tile (bosses on The Bed). Printed Spawn 1: 2 Dreams, Ebony/Ivory/Polyhedral/Marble Grid, Lava's unique action.",
      "Draw Mindstream is repeatable; each unique Landscape action is once per Dreamer. Archetype Powers cost a Meet action. Instant Objects and spent allies Repress. Empty Mindstream discard reshuffles; a fully Repressed Mindstream suit loses the game.",
      "Meet tax is louder: at the start of Meet, each Dreamer Represses 1 Psyche and the table Forgets 1 Landscape per active Dreambeast. Moment toasts stay on screen longer.",
    ],
  },
  {
    version: "22.3",
    title: "Shuffled Dreamscape & one Psyche per phase",
    notes: [
      "Every Landscape is shuffled at setup. The Bed is face-up. Only one Landscape touching The Bed starts Revealed; the rest begin forgotten.",
      "Further Reveals require playing 1 Lucidity Psyche. Each R.E.M. phase opener is now 1 Psyche card (or 1 Power Token as that card).",
      "Dreamer, Object, and Acquired Archetype bonuses still add to the phase budget. Encounter Play Spreads still allow 1–3 Psyche.",
    ],
  },
  {
    version: "22.2",
    title: "Readable Psyche hands, holographic spreads, map thresholds",
    notes: [
      "A tester console with playtest commands exists for development. It is not needed to play, and this page does not list how to turn it on.",
      "Psyche hands fan like a held deck so a full 10-card hand stays readable, with rank and suit in the upper-left corner of each card.",
      "Selected Psyche leave the hand and sit on the table as a holographic spread; the shimmer and parallax glow only while a card is selected.",
      "Revealing every Landscape Returns Dreamers+3 cards from the Subconscious. Forgetting every Landscape but The Bed Represses Dreamers+3 Psyche from hands.",
      "The Visionary now Reveals Dreamers+1 Landscapes (or still peeks deck tops).",
    ],
  },
  {
    version: "22.1",
    title: "Archetype goals 8/12/24 & meet quests on 1-point Archetypes",
    notes: [
      "Victory goals are now 8 (Daydream), 12 (Nap), and 24 (Deep Sleep — the maximum if you acquire every Archetype: three 1-pt, six 2-pt, three 3-pt).",
      "Innocent, Orphan, and Outlaw now require Meeting a Dreambeast on their quest Landscapes (not just Mindstream draws).",
    ],
  },
  {
    version: "22.0",
    title: "Final Nightmare — recurrence pressure & Meet toll",
    notes: [
      "Each Meet Phase: for every Dreambeast on the board, each Dreamer Represses 1 Psyche per beast and the table Forgets 1 Landscape per beast.",
      "Final Recurrence requires 15-Psyche opposing-suit plays; final Dream cards (Delta–Homeostasis) hit harder.",
      "While the Final Recurrence runs, the table dims as Dreams dwindle and a nightmare hellscape fades in behind the veil.",
      "A tester console with playtest commands exists for development (not needed to play).",
    ],
  },
  {
    version: "21.5",
    title: "Harder dreamscape & clearer escape/forget cues",
    notes: [
      "After you hit the Archetype point goal, a persistent banner reminds the table to rally on The Bed to wake up.",
      "Forget-Landscape picks show a bold banner and moment text; wasted Events cost 2 Psyche each when their Landscapes are hidden.",
      "Stat riders use Dreamer stats: 2+ boon, 1 strain, 0 harsh (×2). Encounter fails hit harder; Dream/Mindstream draws skew ~66% hazard.",
      "Shorter Dream decks per length (−3 regular Dreams each): Daydream 11, Nap 14, Deep Sleep 18.",
    ],
  },
  {
    version: "21.4",
    title: "Boss dreams, Silver spawn, save repair",
    notes: [
      "Boss Dreambeasts (Cerberus, Double, Leviathan) spawn on The Bed when discarded instead of vanishing in the Dream Discard pile.",
      "Continuing a saved game moves misplaced bosses from Dream Discard into the Subconscious so Silver and quests can reach them.",
      "Silver lets you pick a Dreambeast from Mindstream discard, Dream Discard, or Subconscious, spawn it on a landscape with a Dreamer, and Meet with Accept only.",
      "Radial focus audit no longer crashes in CI when document stubs are minimal.",
    ],
  },
  {
    version: "21.3",
    title: "Taller table chrome & object use modal",
    notes: [
      "Dreamers, Overview, and Tips left the top bar — the roster lives in the hand, rules live in ? and Pause → Help.",
      "The phase tracker is taller and bolder, the top bar is about twice as high, and the Active Archetype card is larger.",
      "The bottom third lines up all six Dreamers, Power Tokens, a 10-card Psyche spread, allies, Objects, and Persistent Objects.",
      "Click an Object to view it and Use it. Instants discard to their Mindstream pile unless the card says to Repress; Persistent Objects spend a Power Token to activate.",
      "View on a Dreamer radial opens a zoomed card with stats, Power Tokens, Psyche, allies, Objects, and Persistent Objects.",
    ],
  },
  {
    version: "21.2",
    title: "Phone landscape Dreamer picker",
    notes: [
      "Phone landscape no longer stacks full-size portrait cards. Settings and Tutorial / Begin sit on the left; all six Dreamers sit in a 3×2 grid on the right.",
      "Phone picker tiles drop the desktop 5:7 card floor so the roster fits on a real phone without scrolling past two giant cards.",
    ],
  },
  {
    version: "21.1",
    title: "Quiet table, smaller phone menu",
    notes: [
      "In-game essays are gone — Meet pool, hand tips, and tutorial bodies no longer cover Psyche cards. Click instructions stay; rules live in ? and Tips (!).",
      "Phone and stacked menus use a much smaller type scale so Settings, Dreamers, Tutorial, and Begin fit on one screen.",
    ],
  },
  {
    version: "21.0",
    title: "Dreamer radials replace the action bar",
    notes: [
      "The always-on Action Button Bar is gone. Click a Dreamer on the board to open a phase-contextual radial for Draw Dream, Reveal, Spend Elasticity, Gain Actions, Accept/Reject, landscape actions, quests, Power Token spends, and Next / End Round.",
      "The hand and map reclaim that bottom strip — especially on iPad — so cards and hexes have room again.",
      "Tutorial highlights the board Dreamer card first, then the matching radial button, and the copy tells you to open actions that way.",
      "Board and FX rendering skip full hex rebuilds when nothing changed, cap tile resolution on phones and tablets, and pause mist/blend filters that flickered on Safari.",
    ],
  },
  {
    version: "20.1",
    title: "Device chrome & installable PWA",
    notes: [
      "Phone, iPad, and desktop share one 20.1 build — the table picks a stack, split, or triad menu and a play layout that leaves the hex map room.",
      "Phone and iPad play fold Overview, Tips, and Subconscious into ⋯; decks and the archetype table become edge drawers.",
      "Add to Home Screen installs Somnia from the live site. A Reload toast appears when a new dreamscape is waiting.",
      "Launch config and device autosave survive iOS tab eviction, so a Home Screen cold start can Continue Dream offline.",
      "The itch.io zip is the same 20.1 table. Install-to-Home-Screen is first-class on the hosted site.",
    ],
  },
  {
    version: "20.0",
    title: "Touch table & device-aware camera",
    notes: [
      "One-finger drag pans the table; pinch zooms; on-screen + / − / Fit buttons sit on the board.",
      "Long-press a Landscape or card to inspect — the same action as right-click.",
      "Double-tap a Dreamer chip or board token to zoom in on them.",
      "The table detects phone, tablet, and desktop, including large iPads, and swaps hover-only chrome for touch copy.",
      "Audio unlocks on the first tap, not only click or key.",
    ],
  },
  {
    version: "19.1",
    title: "Board clicks, radials & landscape stings",
    notes: [
      "Click a Dreamer on the board for a full 360° radial of phase-contextual actions — no competing camera zoom.",
      "Right-click a Landscape for the occupant and action overview; click a Dreamer or Dreambeast there to open the same radial.",
      "Double-click a Dreamer on the board or in the dock to max-zoom and center the camera on that card.",
      "The radial stays locked to the live Dreamer token after pan or zoom.",
      "New Pixabay ambient stings for every Landscape.",
    ],
  },
  {
    version: "19.0",
    title: "Fullscreen Dream Guide",
    notes: [
      "The top Guide strip is gone so the map can breathe.",
      "Landscape hexes show only their name, colored by suit.",
      "The ? button opens one full-screen Dream Guide: live feed plus a concise rules digest, with PLAY to return.",
    ],
  },
  {
    version: "18.6",
    title: "First-session tutorial & Guide",
    notes: [
      "Tutorial Mode is two guided rounds: Reveal, Explore, Meet, then earn The Innocent.",
      "On-rails clicks: the table keeps your Reveal/Explore/Meet choices; Continue no longer swaps Landscapes.",
      "Shorter 11-step script with a visible step progress bar.",
      "Candy Mountain's wasteland side is named and glowing so the Reveal click is obvious.",
      "Selecting Psyche shows a live suit total beside the cursor; Accept/Reject need at least one matching color plus that Dreamer's stat.",
      "Tutorial starts each Dreamer with 1 Power Token, leaves Visionary Psyche after Mandrake, and draws Power Surge in Round 2.",
      "Steps auto-advance; Skip leaves a practice table. First visit leads with Tutorial.",
      "Contextual Guide strip is visible in real games; first Daydream pins Innocent and Quiet.",
    ],
  },
  {
    version: "18.5.1",
    title: "Brief landscape stings & credits cleanup",
    notes: [
      "Landscape stings trimmed to ~2.6s with smooth fade in/out on every play.",
      "Main-menu footer and splash attributions removed; credits live in the logo panel only.",
    ],
  },
  {
    version: "18.5",
    title: "Changelog & landscape soundscape",
    notes: [
      "Click the Somnia logo on the main menu to open the running changelog and full credits.",
      "All 26 landscapes use Pixabay ambient stings with per-landscape attribution.",
    ],
  },
  {
    version: "18.4",
    title: "Tutorial & stacked encounters",
    notes: [
      "Tutorial snapshots and copy aligned with stacked Dreambeasts and radial board menus.",
      "Effect-wire audit handles quoted beast ids; seven wiring gaps closed.",
    ],
  },
  {
    version: "18.3",
    title: "Choice modal guard & Bargaining fix",
    notes: [
      "Required card choices minimize instead of dismissing; dock bar to resume.",
      "Bargaining dream now grants a matching Active Archetype when you pay 6 Psyche.",
    ],
  },
  {
    version: "18.2",
    title: "Card choice UX",
    notes: [
      "Left-click to select, right-click to preview, Confirm to commit across pickers.",
      "Larger portrait cards for encounters, psyche spends, and subconscious returns.",
    ],
  },
  {
    version: "18.1",
    title: "Radial menu positioning",
    notes: [
      "Dreamer radial menus anchor to live board tokens after camera focus moves.",
    ],
  },
  {
    version: "18.0",
    title: "Audio & atmosphere mega-update",
    notes: [
      "Four BGM tracks with menu attribution; landscape SFX system and camera focus stings.",
      "Psyche holographic energy, golden power sparkle, HD landscapes, parallax mist.",
      "Boss stingers, moment FX, menu motion, suit table washes, victory layer.",
    ],
  },
  {
    version: "17.7",
    title: "Stacked encounters & moment narration",
    notes: [
      "Dreambeasts stack on landscapes; moment toasts and history panel.",
      "Bot sim stability and multi-encounter migration across game systems.",
    ],
  },
  {
    version: "17.6",
    title: "Dream card detail modal",
    notes: ["Draw and discard views show art, name, kind, flavor, and effect text."],
  },
  {
    version: "17.5",
    title: "Meet phase skip gate",
    notes: ["End Meet with unused actions after confirmation, mirroring Explore."],
  },
  {
    version: "17.4",
    title: "Board feel & radial menus",
    notes: [
      "Click ripple/sparkle FX, phase-aware cursors, Dreamer/Dreambeast radial menus.",
      "Meet pooling banner and object click-to-view.",
    ],
  },
  {
    version: "17.3",
    title: "Board interactivity",
    notes: [
      "Fit-table hotkey (F), larger default board zoom, single-click Explore moves.",
      "Clickable Dreamer and Dreambeast tokens; cleaner move animation.",
    ],
  },
  {
    version: "17.2",
    title: "Landscape occupants as cards",
    notes: ["Detail modal shows occupant cards instead of text-only lists."],
  },
  {
    version: "17.1",
    title: "Object draw vs play",
    notes: [
      "Objects go to hand on draw; instants resolve on play. Set completion fixes.",
    ],
  },
  {
    version: "17.0",
    title: "Fullscreen landscape detail",
    notes: ["Right-click landscape view expands to near-fullscreen hero art layout."],
  },
  {
    version: "16.x",
    title: "Co-op polish & saves",
    notes: [
      "Continue Dream, autosave, tutorial mode, and expanded rules reference.",
      "Dreamer powers, subconscious deck, and encounter balance passes.",
    ],
  },
  {
    version: "15.x",
    title: "Dreamscape core loop",
    notes: [
      "Hex board, Reveal/Explore/Meet phases, Dreambeasts, quests, and mindstream.",
      "Dreamer archetypes, landscape actions, and cooperative win conditions.",
    ],
  },
  {
    version: "14.x",
    title: "Play shell & layout",
    notes: [
      "Dedicated play window, resizable panels, top phase bar, and device view modes.",
      "Foundation for standalone packaging and itch.io distribution.",
    ],
  },
];

function changelogHtml() {
  return CHANGELOG.map((entry) => {
    const items = entry.notes.map((n) => `<li>${n}</li>`).join("");
    return `
      <article class="changelog-entry">
        <h3><span class="changelog-version">v ${entry.version}</span> ${entry.title}</h3>
        <ul>${items}</ul>
      </article>`;
  }).join("");
}

function landscapeCreditRow(id, meta) {
  const artistLink = meta.artistUrl
    ? `<a href="${meta.artistUrl}" rel="noopener noreferrer">${meta.artist}</a>`
    : meta.artist;
  const sourceLink = meta.sourceUrl
    ? `<a href="${meta.sourceUrl}" rel="noopener noreferrer">${meta.title}</a>`
    : meta.title;
  const label = meta.label || id.replace(/-/g, " ");
  return `<li><strong>${label}</strong> — ${sourceLink} by ${artistLink}</li>`;
}

async function landscapeCreditsHtml() {
  try {
    const res = await fetch("data/landscape-sfx.json");
    if (!res.ok) throw new Error(String(res.status));
    const map = await res.json();
    const rows = Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([id, meta]) => landscapeCreditRow(id, meta))
      .join("");
    return `
      <section class="changelog-credits-section">
        <h3>Landscape sound effects</h3>
        <p class="changelog-credits-lead">Ambient stings from <a href="https://pixabay.com/sound-effects/" rel="noopener noreferrer">Pixabay</a> (Pixabay Content License).</p>
        <ul class="changelog-landscape-credits">${rows}</ul>
      </section>`;
  } catch {
    return `<p class="changelog-credits-lead">Landscape sound attributions are listed in <code>data/landscape-sfx.json</code>.</p>`;
  }
}

export async function showSomniaChangelogModal() {
  const modal = document.getElementById("utility-modal");
  const body = document.getElementById("utility-modal-body");
  if (!modal || !body) return;

  body.innerHTML = `
    <div class="somnia-changelog-modal">
      <h2>Somnia Changelog</h2>
      <p class="changelog-lead">Major versions and revisions for <strong>Somnia v ${SOMNIA_VERSION}</strong>.</p>
      <div class="changelog-scroll">${changelogHtml()}</div>
      <section class="changelog-credits-section">
        <h3>Credits &amp; attributions</h3>
        ${musicCreditHtml()}
        ${boxArtCreditHtml()}
        ${artCreditHtml()}
      </section>
      <div id="changelog-landscape-credits"><p class="changelog-credits-lead">Loading landscape credits…</p></div>
    </div>`;

  modal.querySelector(".utility-content")?.classList.add("somnia-changelog-modal-wrap");
  modal.classList.remove("hidden");
  document.body.classList.add("utility-modal-open");

  const landscapeEl = document.getElementById("changelog-landscape-credits");
  if (landscapeEl) {
    landscapeEl.innerHTML = await landscapeCreditsHtml();
  }

  const closeBtn = modal.querySelector(".utility-close");
  const backdrop = modal.querySelector(".utility-backdrop");
  const onClose = () => {
    hideUtilityModal(true);
    modal.querySelector(".utility-content")?.classList.remove("somnia-changelog-modal-wrap");
    closeBtn?.removeEventListener("click", onClose);
    backdrop?.removeEventListener("click", onClose);
  };
  closeBtn?.addEventListener("click", onClose);
  backdrop?.addEventListener("click", onClose);
}
