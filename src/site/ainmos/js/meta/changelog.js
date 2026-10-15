import {
  musicCreditHtml,
  menuThemeCreditHtml,
  artCreditHtml,
  boxArtCreditHtml,
} from "../audio/audio-settings.js";
import { hideUtilityModal } from "../ui/ui.js";

export const SOMNIA_VERSION = "0.24.2";

/** Ainmos: a roguelike dream forked from Somnia 42.0 (newest first). */
export const CHANGELOG = [
  {
    version: "0.24.2",
    title: "Called Home",
    notes: [
      "Fixed: Call an Archetype (Sky) did nothing when the Archetype stood around a bend in the Dreamscape. It now walks 2 Landscapes along the real path to you.",
      "Landscape actions that can't do anything yet are greyed out and say why (no Archetype on the board, no Dreambeast here, an empty Subconscious, and so on).",
      "If an action does fail, it now tells you why on screen and refunds your Meet Action, instead of failing silently.",
    ],
  },
  {
    version: "0.24.1",
    title: "Archetypes Wait",
    notes: [
      "Archetypes no longer run the moment Explore begins. They hold still through Explore and Meet, then slip 1 Landscape away as Meet ends, so a Dreamer who walks onto one during Explore can Meet it that same Dream.",
      "Dreambeasts still close in 1 Landscape at the start of each Explore.",
      "The rules, glossary, Cycle screen, Archetype choice, and First Night guide say when each one moves.",
    ],
  },
  {
    version: "0.24",
    title: "Landscapes Re-Explored",
    notes: [
      "Every Landscape has two Meet actions: Call a Dreambeast of its suit (Power 3 + the Cycle; beat it for a Power Token or a random Object), and one action no other Landscape has.",
      "24 Landscapes, 24 different actions. Lucidity sees and remembers: Call an Archetype, Sink and Surface, Shatter and Swap, Collector's Fair (a stall of set Objects), Mirage (place 2 Landscapes free), Grand Prize (bank 6 Glimmer), Study (Discard 3 Psyche to level a Dream Form), Remember 2, Daily Routine, Clear the Mist.",
      "Elasticity moves you: Hide in the Trees, Move Your Dreamer 2 Spaces, Endless Doors, Dance with Dreambeasts, Ride the Tide, Sugar Rush. Willpower fights: Rally, Lock the Doors, Pawn Shop, Scorch, Lure a Dreambeast, Feeding Frenzy, Madness, Inner Sanctum.",
      "The Psyche you spend to open a phase does two jobs, and the game now says so everywhere: the top of the screen reads '4 Meet Actions · If unused: 4 Glimmer ✧', and so do the phase menu, the top bar, and the Vault.",
      "Skipping a phase keeps your card but banks no Glimmer; the Skip button says so.",
      "Solo wording everywhere: no more 'each Dreamer', 'Move 2 Dreamers', allies, or Trade. Dreams, the glossary, the rules, and the First Night guide speak to you.",
      "The Shadows shut Lucidity Landscapes' own actions, but you can still Call a Dreambeast there.",
    ],
  },
  {
    version: "0.23",
    title: "Repress/Return Psyche",
    notes: [
      "One rule for two words: Repress always Represses Psyche, and Return always Returns Psyche. The Subconscious holds Psyche and nothing else, and every Return lets you choose which Psyche come back.",
      "The night begins with 12 random Psyche already in the Subconscious. The Psyche deck grew to 78 cards so your Waking Mind starts about where it did.",
      "Dreambeasts are only ever Accepted. Beat a Dreambeast's Power and it leaves the board; take a Power Token or a random Object. The Repress option, Repress rewards, and Fail effects are gone.",
      "Power Tokens come from exactly three places: the 2 you start with, beating a Dreambeast, and Acquiring an Archetype (+2). You hold at most 6, shown as 'N of 6'. There is no pool.",
      "Objects are never Repressed. Spent, lost, and completed Objects are Discarded. Dreams that took Objects now make you Discard them.",
      "Forgetting a Landscape shuffles it back into the Landscape deck to be found again in the Vault. Anyone standing on it dies and wakes on The Bed, Dreambeasts there are discarded, and Archetypes retreat to The Bed.",
      "No more Wasteland: stepping anywhere is free, and nothing punishes you for where you end Meet.",
      "Suburbia, Awards, and Inner Sanctum now Return 2 Psyche (they used to grant Power Tokens). Coins Returns 3 Psyche. The Creator Returns 2 Psyche. The Skeleton Key lets you step out to The Bed instead of dying when your Landscape is Forgotten.",
      "The glossary, the rules, the First Night guide, card text, and every Dreambeast view say the same thing as the engine.",
    ],
  },
  {
    version: "0.22",
    title: "Polish Pass",
    notes: [
      "First Night has a real guide now. It reads the screen you're on and tells you what to do next, points at the button, and explains each rule the first time it matters: the Waking Mind, Reveal, Explore, Meet, Glimmer, the Lost & Found, Dreambeasts, Archetypes, Bright and Dim, Dream Forms, and the dice. It walks your first two Cycles, then steps back.",
      "The guide never covers what it's talking about. It sits in the left rail on the table, docks beside every menu (the menu makes room), waits in the corner on Dream and Event screens, and folds into a small pill on tablets and phones.",
      "Your first Archetype fight on a First Night is kind, like your first Dreambeast fight.",
      "Psyche cards are poker cards: tight corners, a solid printed face, a corner index you can read on a fanned card, and a clean numeral (the 4 no longer shows its traced outline). Hand cards are a little larger.",
      "Phones: your hand lives in a drawer. Tap Hand (it shows your count per suit) and the whole hand slides up at a readable size; it opens by itself when a fight wants a spread. The bottom strip is slimmer, so the board gets more room.",
      "Notices are small sentence-case whispers instead of big banners, and phones show one at a time.",
      "The bottom bar is slimmer: Power Tokens sit in two tidy rows, and empty Object slots say where Objects come from.",
      "Title screen: Dreamer cards show their art across the top with the name beneath it, and the difficulty and Begin Dreaming labels fit.",
      "Smaller fixes: the Vault panel's name fits, the opener no longer shows a stray dash before you pick a card, Done placing says leftover Lucidity becomes Glimmer, and the Dream screen, Crystal Bell, and Fire say Dreambeast, not Mini-Boss.",
    ],
  },
  {
    version: "0.21.1",
    title: "Steady Hands",
    notes: [
      "No more blinking between menus: when one menu leads to the next, the dream stays dim instead of flashing the table in between, and a click inside a menu no longer replays its fade.",
      "The hand is exactly as tall as its cards, and only the cards take taps: the space around them clicks straight through to the board.",
      "The board fits in the space above the hand, so the whole Dreamscape and your cards share the screen.",
      "Hand cards are proper 5:7 cards again, not squashed.",
      "Fixed a crash on load for players whose browser kept an old copy of the game: code is always fetched fresh when online.",
    ],
  },
  {
    version: "0.21",
    title: "First Dreams",
    notes: [
      "The Cycle screen comes first. Your first Dream is drawn only after you Begin Cycle 1.",
      "Glimmer is taught, not hidden: the phase chip shows that unused actions become Glimmer ✧, leftovers burst into the Glimmer counter when a phase ends, the guided night explains it, and the rules have a Glimmer section.",
      "Phones: the hand lives in the bottom strip beside Power Tokens and Objects, so nothing covers the Dreamscape.",
      "Psyche in every menu has a solid suit face with a huge number and sigil; cards that cannot be played stay readable.",
      "Every Dreamer starts with 2 Power Tokens.",
      "The old Mindstream machinery is gone from the engine (about 3,000 lines): no Landscape draws, no Event chains, no deck peeking.",
      "Stress-tested with careful and careless bots across 360 nights: no errors and no stalls.",
    ],
  },
  {
    version: "0.20",
    title: "One Goal",
    notes: [
      "One goal: Acquire Archetypes. A Daydream asks for 3, a Nap for 6, Deep Sleep for all 12. Every Archetype counts the same.",
      "Every Cycle is a Dream to survive, then the Cycle's Dreambeast lands on a Landscape of its suit, then you call 1 of 3 Archetypes.",
      "An Archetype appears on one of its two home Landscapes (The Bed if neither is placed) and slips one Landscape away from you each Explore. Dreambeasts still chase.",
      "Meeting an Archetype opens with one of its Events: Bright (only while its Landscape is placed) costs Psyche, helps the fight, and Returns 2; Dim is free and makes the fight harder. Then beat Power 12 with a spread that makes a Dream Form.",
      "Acquire an Archetype: +1 toward waking, +2 Power Tokens, Return 4 from the Subconscious, and its power is yours. You start with 2 Power Tokens.",
      "Cards flow both ways again: dawn Returns 3, Repressing a Dreambeast Returns half its Power, and every old Mindstream Repress now takes from the Waking Mind, not your hand.",
      "Landscapes no longer draw Mindstream. Forest, Sky, and City Call an Archetype 2 steps toward you; The Attic, Desert, and Scary Classroom bank Glimmer. The Vault stars the homes of the Archetypes about to be offered.",
      "The night does not end on its last Cycle: the Long Night keeps the rounds going until you finish, and its toll now grows by 1 a dusk.",
      "New table: your Psyche hand floats over the board; the bottom bar is Power Tokens and Objects; the left rail is your Wake count, Archetype Powers, and Dream Forms, with no scrolling.",
      "A movable, minimizable Archetypes window tracks every Archetype in play; the Dreamscape Vault moves and minimizes too. Fight buttons sit right under your selected spread.",
      "Golden ripples and echoes when an Archetype appears, slips away, or is Acquired.",
    ],
  },
  {
    version: "0.19",
    title: "Fits Every Screen",
    notes: [
      "The Dream screen fits the window on desktop, tablet, and phone: the card takes the space that is left and Endure it is always on screen. Minimize sits in the corner.",
      "The Cycle screen, Vault, and Boon draft fit on one screen with no scrolling.",
      "Card details (Dreams, Objects, Landscapes) show the art beside the words, with the buttons always in view. A Dream card shows the one thing it does.",
      "The top bar always fits: on narrower screens it scales itself to keep Pause and the Subconscious on screen.",
      "Full-screen layouts are no longer scaled twice, so nothing comes out oversized.",
    ],
  },
  {
    version: "0.18",
    title: "Clean View",
    notes: [
      "View a Dreambeast and see only what matters, big: its Power, suit and kind, any Boss rule, and what Accept or Repress wins you.",
      "View a Dreamer and see their three stats, Psyche, Power Tokens, Objects, their Power in one line, and their cards.",
    ],
  },
  {
    version: "0.17",
    title: "Clear Glass",
    notes: [
      "Every menu fills the screen and scales with it: the Lost & Found, Vault, Cycle screen, card pickers, and card details are about twice as big on a laptop or desktop.",
      "Cards in menus are at least half again as large, and a full fan of cards always fits on screen.",
      "The Lost & Found fits on one screen with its buttons always in view; long card text scrolls inside its card.",
      "Bigger, brighter text everywhere: no faint greys, no tiny labels on the HUD, the Night Bar, the side panel, or the hand bar.",
      "Dreamcore glass all over: windows, tiles, panels, and buttons are frosted lilac glass with a pearly edge, and scrollbars shimmer instead of glaring white.",
    ],
  },
  {
    version: "0.16",
    title: "Glimmer",
    notes: [
      "Unused Reveals, steps, and Meet actions no longer heal you. Each one banks 1 Glimmer ✧ (up to 10) when the phase ends: no tapping.",
      "In the Lost & Found, Glimmer pays first, 1 value of any price in any suit. 3 Glimmer looks again, so Power Tokens stay for phases.",
      "Let go: tap any Object to discard it and draw Psyche equal to its price. A full row can still buy; it just lets one go after. Clearing room for a new set is a real play.",
      "Each Dream now opens with 4 Psyche instead of 2, so your hand is fed without the busywork.",
      "Glimmer sits on the HUD next to Power and pulses when it grows.",
    ],
  },
  {
    version: "0.15",
    title: "Every Object",
    notes: [
      "Every creature is 1 Power stronger again: the Winged Turtle is 2, then 3, then 4, Leviathan is 12, and Mini-Bosses run 3 to 10.",
      "Every Object has one clear job. The eight Remember look-alikes now Remember, redeal the Vault, place a Landscape, add fight dice, refill a low hand, or trade a card for two. Body pieces raise a stat, Jewelry adds a die for its suit, Sticks widen a phase. No Object peeks at a deck any more.",
      "Object sets work: each piece shows how much of its set you hold, and the moment the last piece arrives, even from the Lost & Found, you Acquire an Archetype and the set is Repressed.",
      "Passive Objects say so and never cost a Meet action. Activating the others costs 1 Meet action, not a Power Token. An Instant with nothing to act on stays in your hand and tells you why.",
      "Tooth-Saber works: it wins like a real fight, so a Boss it cuts down clears the Cycle and offers a Boon, and Accept never makes an ally.",
      "Returning a Dreambeast brings it back onto any placed Landscape you choose: put it where a quest needs it.",
      "Every Dreambeast chases you one hex at the start of Explore.",
      "Boons are all distinct: Lover draws an Object, Orphan adds 3 dice, Explorer moves anyone anywhere, Fool places 2 Landscapes, Ruler earns a free Insight, Outlaw banishes a beast, Creator returns one onto a Landscape.",
      "Every follow-up menu now uses the Lost & Found window, and every card menu fans your cards like the hand at the bottom of the screen.",
      "Upgraded Psyche is unmistakable: Vivid splits into both suits, Lucid wears a turning prism rim, Recurring carries its loop, Chaotic smoulders, and each one names itself on a ribbon.",
    ],
  },
  {
    version: "0.14",
    title: "Keepsakes",
    notes: [
      "The hand takes only the room its cards need. Objects and Persistent Objects get the rest of the bar, as full-size cards you can read at a glance.",
      "Swipe, scroll the wheel, or tap the big ‹ › buttons to slide through your Objects.",
      "The Allies box is gone; Ainmos has no allies.",
    ],
  },
  {
    version: "0.13",
    title: "Wake Again",
    notes: [
      "Death works. Start a Dream with no Psyche, or let the Dream take your last card, or owe a cost with nothing to pay, and you die and wake on The Bed with 5 fresh Psyche. No more sitting out a round with an empty hand.",
      "Accepting a Dreambeast no longer gives an ally card. It draws an Object and earns a free Insight at the next Lost & Found, and a reroll keeps it free.",
      "Repressing a Dreambeast draws Psyche equal to half its Power, rounded down.",
      "Pause → Save → Let the night go ends a run you are done with and shows its summary.",
    ],
  },
  {
    version: "0.12",
    title: "Cycles",
    notes: [
      "Antes are now Cycles, like a night of sleep. A night is 4, 7, or 10 Cycles. Each Cycle is 3 Dreams, and each Dream is one Reveal, Explore, Meet: 9 phases, ending on the Boss.",
      "The top bar shows where you are: Cycle 2 of 4, three Dreams of Reveal · Explore · Meet with the current phase lit, and the Boss on phase 9.",
      "The Cycle screen maps all nine phases, shows what Dream 2 and Dream 3 bring, and lines up every Boss of the night with its Power so you can see them grow stronger.",
      "The Dream screen and each phase opener name the Cycle, the Dream, and the phase.",
    ],
  },
  {
    version: "0.11",
    title: "Windows",
    notes: [
      "Each Cycle opens on its own screen: the Dream, the Mini-Boss, and the Boss with its twist, and what beating each one pays. Walk in when you are ready.",
      "Mini-Bosses pay a bounty: +1 Power Token when one falls.",
      "During Reveal the Dreamscape Vault fills the screen. Each Landscape shows what it does and whether a quest wants it. Choose one, place it on the board, and the Vault returns for the next.",
      "The phase opener and the Dream screen now match the Lost & Found: one window language, one set of buttons.",
      "Fix: Repressing cards from your hand works again. The Confirm button had slipped out of sight behind the hand.",
    ],
  },
  {
    version: "0.10",
    title: "Solo Night",
    notes: [
      "Ainmos is now a solo run. Choose one Dreamer; every hand, action, and fight is yours. Fights and Mindstream draws repeat as long as your Meet actions last.",
      "Dreambeasts arrive on the Dream Deck timer. Each Cycle is a Dream, a Dream that brings a Mini-Boss to The Bed, then a Boss that lands on a random Landscape. Mini-Bosses are face up on the Night Bar.",
      "Mindstream is Events and Power Tokens only. The Draw-a-Dream cards and the Events and Objects that called up beasts are gone. City and Lava now move Dreambeasts.",
      "Dreams are conditions you survive: no Bright side, one card, one button.",
      "Every creature is 1 Power weaker, and ties now go to you.",
      "The night no longer ends with the Dream Deck. The Long Night begins: each dusk Represses 2, then 4, then 6 more from the Waking Mind until you wake or forget.",
      "Faster flow: each round opens on its Dream by itself, and each phase opens on one full screen with your hand, a live preview, and big buttons.",
    ],
  },
  {
    version: "0.9",
    title: "Wide Awake",
    notes: [
      "The Night Bar spans the top of the screen. Every Dream and Boss sits in its Cycle, with a tick for each card and a pip for every Dreambeast that arrived that round.",
      "The table fills the screen. Commands sit in one bar under the Night Bar, the Dreamer info lives in a column on the right, and the decks sit in a small dock on the board. Objects are one shared deck.",
      "Phones play sideways: the board takes the screen and the Table button opens the Dreamer info full screen.",
      "No more walls of text. The menu primer opens only from the spiral, and the unused-actions note is now a First Night hint.",
      "Fixes: the win banner no longer sends you to The Bed, Reveal help describes the Dreamscape Vault, and coach hints sit above the Lost & Found.",
    ],
  },
  {
    version: "0.8",
    title: "First Night",
    notes: [
      "First Night on the menu is a real Daydream with gentle hints. Each hint shows once, the first time its moment comes, and never locks a click. The first Dream is gentle and the first fight is a sure win. When the Winged Turtle falls, the training wheels come off.",
      "The Dream Guide and glossary now teach Ainmos: Cycles and the Boss ladder, Dream Forms, Psyche upgrades, the Lost & Found, Boons, and the Dreamscape Reset.",
    ],
  },
  {
    version: "0.7",
    title: "The Story of the Night",
    notes: [
      "The end screen tells the night: the Cycle you reached, every Boss on the ladder, your best spread card by card, your favorite Dream Form, the Dreamer who won the most fights, your Boons, and the numbers behind the score.",
      "New score: Archetype points ×2, plus each Boss's climb (the Turtle 1 up to Leviathan 10), plus your best spread's Power, plus 20 for waking, plus 1 per Object, Power Token, and ally. Psyche left in hand no longer scores.",
    ],
  },
  {
    version: "0.6",
    title: "Twists and Boons",
    notes: [
      "Every Boss bends one rule while it stands. Winged Turtle is three fights (Power 2, then 3, then 4). Shadows darken Lucidity Landscape actions. Jackalope hops 2 hexes each Meet. Baku eats a Dream at dusk. Mindless ignores your stats. Devourer eats an Object in play at dusk. Bogey shuts The Bed and punishes sleeping there. Cerberus seals The Bed. Double gains your matching stat. Leviathan Forgets the farthest edge at dusk.",
      "Archetypes are now points and quests only. Their powers and passives are Boss Boons: when a Boss falls, choose 1 of 3 Boons for the rest of the night.",
      "Three new Boons: Study (1 Power Token, raise a Dream Form a level, once per round), Wider Vault (4 Landscapes in the Vault), and Deep Pockets (hold 1 more Object, up to 10).",
      "The Caregiver Boon draws 3.",
    ],
  },
  {
    version: "0.5",
    title: "Lost & Found",
    notes: [
      "Between rounds the Lost & Found opens: three Objects from one shared Object deck, and one Insight. Draw the Dream when you leave it.",
      "An Object costs 1–5 Psyche value of its own suit. Wild, Lucid, and Vivid cards count. The window shows exactly which cards you will pay; overpaying is lost.",
      "The Insight is a Dream Form level (3) or a Psyche upgrade (Chaotic 3, Vivid 4, Lucid 5, Recurring 6), paid in Psyche value of any suit.",
      "Look again for 1 Power Token: new Objects and a new Insight. Unbought Objects sink under the deck.",
      "Each Dreamer can hold 6 Objects. Past that, choose one to let go. The three Nothing curses are gone from the Object deck.",
    ],
  },
  {
    version: "0.4",
    title: "Dream Forms",
    notes: [
      "A spread can make a Dream Form: Echo (two of one value), Ladder (three in a row), Chord (three of one suit), Trinity (one of each suit), Trifecta (three of a kind), or Unity (three 1s). The best Form adds its dice: +1 to start, +1 per level. The Dream Forms panel shows every level.",
      "Six Objects are now Form Objects: Mirror (Echo), Rope (Ladder), Conch Shell (Chord), Spark of Sun (Trinity), Monkey Paw (Trifecta), and Egg (Unity). Play one, Repress 1 Psyche of its suit, and its Form rises a level. The Object is Repressed too.",
      "Psyche cards can carry one upgrade: Chaotic (a d6 value, rolled when drawn), Vivid (a second suit), Lucid (any suit, same value), or Recurring (returns to hand after a spread). A new upgrade replaces the old one; the same upgrade twice changes nothing and is not spent.",
    ],
  },
  {
    version: "0.3",
    title: "The Dream Re-forms",
    notes: [
      "When the Dreamscape Vault and the tile deck are both empty, the next round begins with a Dreamscape Reset: every Landscape but The Bed shuffles back into the tile deck, Dreambeasts on them are Repressed, Bosses drift back to The Bed, and every Dreamer wakes on The Bed.",
      "Dawn between Cycles: the round after a Boss arrives, the Waking Mind reshuffles and every Dreamer draws 3 Psyche.",
      "The Bed no longer draws 3. It Dreams Onward: flip the top tile of the deck, then place it free or put it back.",
    ],
  },
  {
    version: "0.2",
    title: "Ten Nightmares",
    notes: [
      "A night is a run of Cycles: two Dreams, then a Boss. Daydream climbs 4 Cycles, Nap 7, Deep Sleep 10.",
      "The Boss ladder runs from rung 10 to rung 1: Winged Turtle, Shadows, Jackalope, Baku, Mindless, Devourer, Bogey, Cerberus, Double, Leviathan. These ten no longer wander the Mindstream.",
      "Wake by defeating the night's final Boss with the Archetype goal met. If the last round ends first, you never wake. There is no Final Recurrence.",
      "The Night Bar across the top shows every Dream of the night, face down, with each Cycle's Boss face up so you can plan for it.",
      "Sage, Magician, and Warrior now ask you to defeat a Lucidity, Elasticity, or Willpower Boss.",
    ],
  },
  {
    version: "0.1",
    title: "The Mirror Dream",
    notes: [
      "Ainmos begins as a parallel dream of Somnia. Every night is built on a Freeform Board: only The Bed is on the table, and the Dreamscape Vault offers three Landscapes to place.",
      "A new Dreambeast fixes an old, poor design choice.",
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
      <h2>Ainmos Changelog</h2>
      <p class="changelog-lead">Major versions and revisions for <strong>Ainmos v ${SOMNIA_VERSION}</strong>.</p>
      <div class="changelog-scroll">${changelogHtml()}</div>
      <section class="changelog-credits-section">
        <h3>Credits &amp; attributions</h3>
        ${menuThemeCreditHtml()}
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
