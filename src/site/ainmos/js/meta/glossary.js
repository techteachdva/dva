/**
 * Player primer and glossary for Ainmos 41.0.
 * Definitions follow the engine, not older guide sentences.
 */

const GROUPS = [
  { id: "round", label: "The round" },
  { id: "cards", label: "Cards and hands" },
  { id: "map", label: "The map" },
  { id: "meet", label: "Meet and dice" },
  { id: "win", label: "Winning and losing" },
  { id: "people", label: "Dreamers and Archetypes" },
  { id: "places", label: "Landscapes" },
];

/** @type {{ term: string, group: string, aka?: string, text: string }[]} */
const TERMS = [
  {
    term: "City",
    group: "places",
    text: "A Willpower Landscape. Its two Meet actions, each once per Meet: Rally (Your next fight rolls +2 dice), or Call a Willpower Dreambeast to fight for 2 Power Tokens or an Object of its suit.",
  },
  {
    term: "Forest",
    group: "places",
    text: "An Elasticity Landscape. Its two Meet actions, each once per Meet: Hide in the Trees (At the next Explore, Dreambeasts do not chase you), or Call an Elasticity Dreambeast to fight for 2 Power Tokens or an Object of its suit.",
  },
  {
    term: "House",
    group: "places",
    text: "A Willpower Landscape. Its two Meet actions, each once per Meet: Lock the Doors (At this dusk, Dreambeasts Repress nothing), or Call a Willpower Dreambeast to fight for 2 Power Tokens or an Object of its suit.",
  },
  {
    term: "Road",
    group: "places",
    text: "An Elasticity Landscape. Its two Meet actions, each once per Meet: Open Road (Travel to a Landscape 2 steps away), or Call an Elasticity Dreambeast to fight for 2 Power Tokens or an Object of its suit.",
  },
  {
    term: "Sky",
    group: "places",
    text: "A Lucidity Landscape. Its two Meet actions, each once per Meet: Call an Archetype (The nearest Archetype steps 2 Landscapes toward you), or Call a Lucidity Dreambeast to fight for 2 Power Tokens or an Object of its suit.",
  },
  {
    term: "Suburbia",
    group: "places",
    text: "A Willpower Landscape. Its two Meet actions, each once per Meet: Pawn Shop (Discard 1 of your Objects, then draw Psyche up to your hand limit), or Call a Willpower Dreambeast to fight for 2 Power Tokens or an Object of its suit.",
  },
  {
    term: "Lava",
    group: "places",
    text: "A Willpower Landscape. Its two Meet actions, each once per Meet: Scorch (The Dreambeast on your Landscape loses 2 Power for good (never below 1)), or Call a Willpower Dreambeast to fight for 2 Power Tokens or an Object of its suit.",
  },
  {
    term: "Black Void",
    group: "places",
    text: "A Lucidity Landscape. Its two Meet actions, each once per Meet: Sink and Surface (Repress 1 to 3 Psyche from your hand, then Return that many of your choice from the Subconscious), or Call a Lucidity Dreambeast to fight for 2 Power Tokens or an Object of its suit.",
  },
  {
    term: "Field of Broken Glass",
    group: "places",
    text: "A Lucidity Landscape. Its two Meet actions, each once per Meet: Shatter and Swap (Swap the places of 2 Landscapes on the Dreamscape. Everything on them moves too), or Call a Lucidity Dreambeast to fight for 2 Power Tokens or an Object of its suit.",
  },
  {
    term: "The Attic",
    group: "places",
    text: "A Lucidity Landscape. Its two Meet actions, each once per Meet: Collector's Fair (A stall of up to 3 Objects that belong to sets. Buy one with Psyche of its suit), or Call a Lucidity Dreambeast to fight for 2 Power Tokens or an Object of its suit.",
  },
  {
    term: "The Basement",
    group: "places",
    text: "A Willpower Landscape. Its two Meet actions, each once per Meet: Lure a Dreambeast (The nearest Dreambeast moves onto your Landscape), or Call a Willpower Dreambeast to fight for 2 Power Tokens or an Object of its suit.",
  },
  {
    term: "Desert",
    group: "places",
    text: "A Lucidity Landscape. Its two Meet actions, each once per Meet: Mirage (Place 2 Landscapes from the Dreamscape Vault for free), or Call a Lucidity Dreambeast to fight for 2 Power Tokens or an Object of its suit.",
  },
  {
    term: "Endless Hallway",
    group: "places",
    text: "An Elasticity Landscape. Its two Meet actions, each once per Meet: Endless Doors (Move your Dreamer to any placed Elasticity Landscape), or Call an Elasticity Dreambeast to fight for 2 Power Tokens or an Object of its suit.",
  },
  {
    term: "The Party",
    group: "places",
    text: "An Elasticity Landscape. Its two Meet actions, each once per Meet: Dance with Dreambeasts (Move up to 2 Dreambeasts 1 Landscape each), or Call an Elasticity Dreambeast to fight for 2 Power Tokens or an Object of its suit.",
  },
  {
    term: "Awards",
    group: "places",
    text: "A Lucidity Landscape. Its two Meet actions, each once per Meet: Grand Prize (Bank 6 Glimmer for the next Lost & Found), or Call a Lucidity Dreambeast to fight for 2 Power Tokens or an Object of its suit.",
  },
  {
    term: "Sea of Teeth",
    group: "places",
    text: "A Willpower Landscape. Its two Meet actions, each once per Meet: Feeding Frenzy (Every Dreambeast steps 1 Landscape toward you), or Call a Willpower Dreambeast to fight for 2 Power Tokens or an Object of its suit.",
  },
  {
    term: "Endless Ocean",
    group: "places",
    text: "An Elasticity Landscape. Its two Meet actions, each once per Meet: Ride the Tide (Move your Dreamer to any Landscape next to an Archetype), or Call an Elasticity Dreambeast to fight for 2 Power Tokens or an Object of its suit.",
  },
  {
    term: "Candy Mountain",
    group: "places",
    text: "An Elasticity Landscape. Its two Meet actions, each once per Meet: Sugar Rush (Your next Explore gets +2 steps), or Call an Elasticity Dreambeast to fight for 2 Power Tokens or an Object of its suit.",
  },
  {
    term: "Scary Classroom",
    group: "places",
    text: "A Lucidity Landscape. Its two Meet actions, each once per Meet: Study (Discard 3 Psyche to raise one Dream Form 1 level for the rest of the night), or Call a Lucidity Dreambeast to fight for 2 Power Tokens or an Object of its suit.",
  },
  {
    term: "Tranquil Grove",
    group: "places",
    text: "A Lucidity Landscape. Its two Meet actions, each once per Meet: Remember 2 (Discard up to 2 Psyche from your hand, then Return that many +1 from the Subconscious, your choice), or Call a Lucidity Dreambeast to fight for 2 Power Tokens or an Object of its suit.",
  },
  {
    term: "Day in the Life",
    group: "places",
    text: "A Lucidity Landscape. Its two Meet actions, each once per Meet: Daily Routine (Name a suit. Draw the next Psyche of that suit from the Psyche deck), or Call a Lucidity Dreambeast to fight for 2 Power Tokens or an Object of its suit.",
  },
  {
    term: "Insanity",
    group: "places",
    text: "A Willpower Landscape. Its two Meet actions, each once per Meet: Madness (Discard your whole hand, then draw that many Psyche), or Call a Willpower Dreambeast to fight for 2 Power Tokens or an Object of its suit.",
  },
  {
    term: "Inner Sanctum",
    group: "places",
    text: "A Willpower Landscape. Its two Meet actions, each once per Meet: Inner Sanctum (Return 1 Psyche of your choice from the Subconscious straight to your hand), or Call a Willpower Dreambeast to fight for 2 Power Tokens or an Object of its suit.",
  },
  {
    term: "Silver Mist",
    group: "places",
    text: "A Lucidity Landscape. Its two Meet actions, each once per Meet: Clear the Mist (Redeal the Dreamscape Vault for free), or Call a Lucidity Dreambeast to fight for 2 Power Tokens or an Object of its suit.",
  },
  {
    term: "Dusk",
    group: "round",
    text: "The end of each round. Each Dreambeast still on the board Represses 1 Psyche from the Waking Mind into the Subconscious. Some Bosses act at dusk too: the Baku eats a Dream, the Devourer makes the table Discard an Object, Leviathan Forgets a Landscape. The −1 badge on a beast and the Mind counter's forecast show what dusk will take.",
  },
  {
    term: "Memory Landscape",
    group: "places",
    text: "Tranquil Grove's action is Remember 2. Black Void's Sink and Surface lets you trade Psyche with the Subconscious. Lucidity Landscapes see and remember, Elasticity Landscapes move you, and Willpower Landscapes fight.",
  },
  {
    term: "Remember",
    group: "cards",
    aka: "remember n",
    text: "Remember N: discard up to N Psyche from your hand, then Return that many Psyche plus 1 from the Subconscious, your choice. Discard none and you still Return 1. Every Psyche you Return is +1 Waking Mind. Tranquil Grove Remembers 2; Remember Objects and the Innocent Remember too.",
  },
  {
    term: "Waking Mind",
    group: "win",
    aka: "mind psyche deck",
    text: "The Psyche deck plus its discard: the Psyche you can still draw. The Mind counter in the top bar shows it, and what dusk will take. If it empties, you forget yourself and you lose. Remember wins it back.",
  },
  {
    term: "Accept",
    group: "meet",
    aka: "befriend, free insight",
    text: "The only way to beat a Dreambeast. Play 1 to 3 Psyche of any suit and beat its Power (ties go to you). A card of its suit adds your matching stat, and its Ward takes dice off one Dream Form. The beast leaves the board and you take your reward: 2 Power Tokens, or an Object of its suit.",
  },
  {
    term: "Acquire",
    group: "win",
    aka: "commit",
    text: "Beat an Archetype's fight and it is yours: it counts 1 toward waking, pays 1 Power Token, and its power (or passive) joins your Archetype Powers. Completing an Object set also Acquires one, straight from the deck.",
  },
  {
    term: "Active Archetype",
    group: "win",
    text: "Gone. Archetypes now stand on the Dreamscape; the Archetypes window shows where.",
  },
  {
    term: "Affinity",
    group: "meet",
    aka: "fantasy nightmare",
    text: "Gone in 0.26.1. Dreamers have no hidden fight bonuses: your stat adds to a fight only when a card of the beast's suit is in your spread.",
  },
  {
    term: "Ally",
    group: "cards",
    aka: "befriended dreambeast",
    text: "Ainmos has no allies. A beaten Dreambeast leaves the board; you take 2 Power Tokens or an Object of its suit.",
  },
  {
    term: "Archetype",
    group: "win",
    text: "The goal. Twelve of them; a night asks for 3, 6, or all 12. The third Dream of each Cycle offers 1 of 3. You can only call one whose home Landscape (it has two) is revealed; it appears there and slips 1 Landscape away from you as each Meet ends. If none of the three has a home revealed, Repress 1 Psyche from your hand to search the Landscape deck for the first missing home, which is placed on a random hex. Meet it on its Landscape: its Event first (Bright or Dim), then a spread that makes a Dream Form against Power 12. Win, and it is Acquired: +1 toward waking, +1 Power Token, and its power.",
  },
  {
    term: "Back",
    group: "round",
    aka: "undo",
    text: "The button at the top-left of the map. It undoes the last action.",
  },
  {
    term: "Bed",
    group: "places",
    aka: "the bed",
    text: "The center hex. It starts face-up and can never be Forgotten. Its Meet action is Dream Onward, once per Meet: flip the top tile of the deck and place it, or put it back. Each Cycle's Mini-Boss rises here.",
  },
  {
    term: "Dreamscape Vault",
    group: "places",
    aka: "vault freeform board tile deck refresh",
    text: "Freeform Board only. Three Landscapes lie face up beside a shuffled tile deck. In Reveal, each Lucidity places one Vault tile on an empty hex touching the dream. Refresh redeals the Vault for 1 Lucidity, +1 for each refresh already made this round.",
  },
  {
    term: "Boss",
    group: "meet",
    aka: "cerberus double leviathan",
    text: "Each Cycle's Dreambeast: the Winged Turtle first (a plain Power 3 beast), climbing to Leviathan. It arrives at its Power plus the Cycle, lands on a Landscape of its suit (The Bed if none), chases you each Explore, bends one rule while it stands (all but the Turtle), and Represses 1 Psyche from the Waking Mind every dusk. Beating it is optional but stops the bleeding: Accept it for 2 Power Tokens, an Object of its suit, or a missing piece of a Set you have started.",
  },
  {
    term: "Bright",
    group: "cards",
    aka: "good path toll gate",
    text: "The good side of an Archetype's Event, open only while the Event's Landscape is placed. It costs Psyche you choose from your hand: some of a suit (2 Willpower), one of a suit worth enough (a Lucidity worth 3+), or one of an exact value (any 2). Each point of cost buys one small thing: +1 die, −1 Power, Return 1 (you pick), Draw 2 Psyche, Reveal 1 Landscape, Draw 1 Object, or +1 card in the spread. No Form needed, or a lost spread coming back to hand, is worth 2.",
  },
  {
    term: "Caregiver",
    group: "people",
    text: "A Willpower Archetype. It appears on Sea of Teeth or Field of Broken Glass, and its Events come from those two Landscapes. Once Acquired, its power is yours (1 Power Token, any phase): Draw 3 Psyche, up to your hand limit.",
  },
  {
    term: "Cerberus",
    group: "meet",
    text: "A Boss. Power 11. While it stands, no one enters or leaves The Bed. Accept it for 2 Power Tokens or an Object of its suit.",
  },
  {
    term: "Creator",
    group: "people",
    text: "A Lucidity Archetype. It appears on Day in the Life or Inner Sanctum, and its Events come from those two Landscapes. Once Acquired, its power is yours (1 Power Token, any phase): Return 2 Psyche of your choice from the Subconscious.",
  },
  {
    term: "Daydream",
    group: "win",
    aka: "length difficulty",
    text: "The short night: Acquire 3 Archetypes within 3 Cycles.",
  },
  {
    term: "Death",
    group: "win",
    aka: "respawn",
    text: "If you start a Dream with no Psyche, the Dream takes your last Psyche, you must pay a Psyche cost with none left, or a Landscape you stand on is Forgotten, you die. The Death Clock ticks. Your Objects are discarded (you keep your Power Tokens), and you wake on The Bed with 6 fresh Psyche. A notice always tells you what was lost. The sixth death ends the run.",
  },
  {
    term: "Death Clock",
    group: "win",
    text: "A count of deaths. It starts at 0. The sixth death ends the run at once.",
  },
  {
    term: "Deep Sleep",
    group: "win",
    text: "The long night: Acquire all 12 Archetypes within 15 Cycles.",
  },
  {
    term: "Dim",
    group: "cards",
    aka: "bad path",
    text: "The free side of an Archetype's Event. It makes the coming fight harder: a stronger Archetype, fewer cards, no stats, a stricter Form, a costlier loss, or fewer dice.",
  },
  {
    term: "Discard",
    group: "cards",
    text: "Put a card into its discard pile. Discarded Psyche can be drawn again when the deck is reshuffled. Objects that are lost, spent, or completed are always Discarded, never Repressed. Only Psyche is Repressed.",
  },
  {
    term: "Double",
    group: "meet",
    text: "A Boss. Power 11. It gains Power equal to the fighter's matching stat. Accept it for 2 Power Tokens or an Object of its suit.",
  },
  {
    term: "Draw Dream",
    group: "round",
    text: "Each round opens on its Dream. It is drawn for you at the start of Reveal, and you endure it before spending Lucidity.",
  },
  {
    term: "Dream",
    group: "cards",
    text: "One card from the Dream Deck, drawn at the start of each round. A Dream is a condition you survive: it Represses Psyche, makes you Discard Objects, Forgets Landscapes, or spawns Dreambeasts, and there is no way around it. Dream 2 of each Cycle brings that Cycle's Dreambeast.",
  },
  {
    term: "Dream Deck",
    group: "win",
    aka: "clock",
    text: "The night's timeline, three cards per Cycle: a Dream, the Cycle's Dreambeast, and an Archetype Dream. When it runs out, the Long Night begins; Archetypes still standing can still be Acquired.",
  },
  {
    term: "Cycle",
    group: "win",
    aka: "sleep cycle, ante, night bar, nine phases",
    text: "Three Dreams, nine phases. Dream 1: a Dream card to survive. Dream 2: the Cycle's Dreambeast lands. Dream 3: choose 1 of 3 Archetypes to appear. Then dawn: the Waking Mind reshuffles and you draw 4. A night is 3, 7, or 15 Cycles.",
  },
  {
    term: "Mini-Boss",
    group: "win",
    aka: "mini boss",
    text: "Gone. Each Cycle's second Dream brings its Dreambeast instead.",
  },
  {
    term: "Long Night",
    group: "win",
    aka: "deck empty",
    text: "The Dream Deck is empty: no more Archetypes will be called, but those standing can still be Acquired. Each dusk Represses more from the Waking Mind until you wake or forget yourself.",
  },
  {
    term: "Boss Ladder",
    group: "meet",
    aka: "turtle shadows jackalope baku mindless devourer bogey cerberus double leviathan",
    text: "The Dreambeasts of the night, one per Cycle, growing from Power 4 to 12. A Deep Sleep night past the ladder adds Power 12 Nightmares.",
  },
  {
    term: "Dream Form",
    group: "meet",
    aka: "echo ladder chord trinity trifecta unity",
    text: "A spread pattern that adds dice. Echo: two of one value. Ladder: three in a row. Chord: three of one suit. Trinity: one of each suit. Trifecta: three of a kind. Unity: three 1s. Forms stack: a spread scores every Form it makes (1-2-3 in three suits is a Ladder and a Trinity, so both add). Every Form starts at +1 die and gains +1 per level, up to +24. A Dreambeast's Ward takes dice off one Form.",
  },
  {
    term: "Ward",
    group: "meet",
    aka: "block form bonus",
    text: "Every Dreambeast wards one Dream Form. If your spread makes that Form, that Form loses 1 to 5 of its dice (stronger beasts ward harder). Every other Form in the spread still adds in full. The beast's card and the spread tray show the Ward.",
  },
  {
    term: "Endless Mode",
    group: "win",
    aka: "keep dreaming continue",
    text: "After you wake, Keep Dreaming carries on from the same board. Archetypes and Dreambeasts keep coming, Cycle after Cycle. Once every Archetype is Acquired, each Cycle ends with a new Leviathan instead: Leviathan+ (13), Leviathan_x (14), LeviaTHAN (16), L3V1@+H@N (20), and L3V1@+H@N D3$TR0Y3R 0F DR3@M$ (99). It ends when you lose, or when the last one falls. Your wake still counts toward the score.",
  },
  {
    term: "Endless Leviathans",
    group: "meet",
    aka: "leviathan+ leviathan_x l3v1athan destroyer of dreams",
    text: "The five Leviathans of Endless Mode, each more broken than the last. Their Power is printed and does not grow with the Cycle, each wards a Form by 5 (the last wards every Form), and while any stands the tide Forgets the edge Landscape farthest from The Bed each dusk. Felling them scores 10, 15, 25, 40, and 99.",
  },
  {
    term: "Final Cycle",
    group: "round",
    aka: "last cycle morning",
    text: "The last Cycle of the night. Morning is close: the dream brightens and sways a little while you chase the last Archetypes you need.",
  },
  {
    term: "Psyche Upgrade",
    group: "cards",
    aka: "chaotic vivid lucid recurring",
    text: "One upgrade per Psyche card, for the whole night. Chaotic: a d6 value, rolled when drawn. Vivid: a second suit. Lucid: any suit, same value. Recurring: returns to hand after a spread. A new upgrade replaces the old; the same one again changes nothing.",
  },
  {
    term: "Glimmer",
    group: "cards",
    aka: "glimmer discount leftover unused actions",
    text: "✧ What an unused Reveal, step, or Meet action you paid for leaves behind when the phase ends (up to 10 banked). In the Lost & Found each Glimmer pays 1 value of any price, any suit, before your Psyche. 3 Glimmer looks again.",
  },
  {
    term: "Let go",
    group: "cards",
    aka: "sell discard object clear room set",
    text: "Tap an Object, then Let go: it goes to the discard and you draw Psyche equal to its price. An Object found this round draws nothing yet. This is how a full row makes room for a new set.",
  },
  {
    term: "Lost & Found",
    group: "cards",
    aka: "shop insight reroll",
    text: "Opens at the end of every Dream, with the hand you finished on in view: three Objects (1–5 Psyche value of their suit) and one Insight (3–6 of any suit: a Form level or a Psyche upgrade). Glimmer pays first. Reroll for 3 Glimmer. At the Object limit you can still buy, then let one go. Leaving starts the next round: you draw 3 Psyche, then the Dream.",
  },
  {
    term: "Boon",
    group: "win",
    aka: "study wider vault deep pockets",
    text: "The power or passive of an Archetype you have Acquired, listed under Archetype Powers on the left.",
  },
  {
    term: "Dreamscape Reset",
    group: "places",
    aka: "reset vault empty",
    text: "When the Dreamscape Vault and the Landscape deck are both empty, the next round begins with only The Bed. Every Landscape shuffles back into the Landscape deck, Dreambeasts on them are discarded, Bosses drift to The Bed, and every Dreamer wakes on The Bed.",
  },
  {
    term: "Dreambeast",
    group: "meet",
    aka: "encounter beast",
    text: "A creature on a Landscape. It has one Power, a suit, a Ward, and a Fantasy or Nightmare kind. Every Dreambeast arrives at its printed Power plus the Cycle it arrives in (Cycle 1 +1, Cycle 2 +2, and so on). At the start of each Explore every beast chases you one hex. During Meet, Accept the one on your hex with 1 to 3 Psyche of any suit by beating its Power, then take 2 Power Tokens or an Object of its suit. A beast left standing at dusk Represses 1 Psyche from the Waking Mind. It stays until you beat it.",
  },
  {
    term: "Dreamer",
    group: "people",
    text: "You. Choose one at the start of the run. Each has Lucidity, Elasticity, and Willpower that add up to 3 (your free Actions in Reveal, Explore, and Meet) and one Power that costs 1 Power Token and works in the phase of its best stat. No passives.",
  },
  {
    term: "Dreamscape",
    group: "map",
    text: "The whole hex map: The Bed plus the Landscapes you have placed from the Vault. A Forgotten Landscape leaves the map and shuffles back into the Landscape deck; its hex is open again.",
  },
  {
    term: "Elasticity",
    group: "cards",
    aka: "yellow explore suit",
    text: "The yellow suit. Spend 1 Elasticity to open Explore. The move budget is that card's value plus the opener's Elasticity. The Runner (2) and the Hunter (2) are the high Elasticity Dreamers.",
  },
  {
    term: "Encounter",
    group: "meet",
    text: "A Dreambeast sitting on a Landscape, waiting to be Accepted. Only the Dreamer on that hex can fight it.",
  },
  {
    term: "Event",
    group: "cards",
    text: "Every Meet with an Archetype opens with one of its 4 Events: 2 from each of its home Landscapes. Bright is open while the Event's Landscape is placed: pay its Psyche cost for one small thing per point paid. Dim is free and puts one drawback on the fight.",
  },
  {
    term: "Explore",
    group: "round",
    aka: "explore phase",
    text: "The second phase of each Dream (phases 2, 5, and 8 of a Cycle). First every Dreambeast chases you one Landscape. Archetypes hold still, so this is your chance to reach one. Your Elasticity is your free steps; spend 1 Elasticity card for +its value. Only steps you paid for bank Glimmer if unused.",
  },
  {
    term: "Explorer",
    group: "people",
    text: "An Elasticity Archetype. It appears on Endless Ocean or Lava, and its Events come from those two Landscapes. Once Acquired, its power is yours (1 Power Token, any phase): Move yourself or any Dreambeast to any placed Landscape.",
  },
  {
    term: "Fail",
    group: "meet",
    text: "Ainmos has no Fail effects. Lose a fight and the cards you played are spent; the Dreambeast stays.",
  },
  {
    term: "Fantasy",
    group: "meet",
    text: "One of the two Dreambeast kinds. Rested, Visionary, and Weaver are Fantasy Dreamers. Matching the beast's kind adds 1 to your Power.",
  },

  {
    term: "Fool",
    group: "people",
    text: "An Elasticity Archetype. It appears on Insanity or Black Void, and its Events come from those two Landscapes. Once Acquired, its power is yours (1 Power Token, any phase): Place 2 Landscapes from the Dreamscape Vault, free.",
  },
  {
    term: "Forget",
    group: "map",
    aka: "forgotten wasteland",
    text: "A Forgotten Landscape leaves the Dreamscape and shuffles back into the Landscape deck, to be found again in the Vault. Its hex is open again. A Dreamer standing there dies and wakes on The Bed, a Dreambeast there is discarded, and an Archetype there retreats to The Bed. The Bed cannot be Forgotten. Forgetting a Landscape still in the Vault shuffles it back into the deck.",
  },
  {
    term: "Give Turn",
    group: "round",
    text: "A table rule from Somnia. Ainmos is played by one Dreamer, so every action is yours.",
  },
  {
    term: "Hand limit",
    group: "cards",
    text: "10 cards, allies included. Persistent Severed Torso raises it to 12. Cards past the limit are discarded.",
  },
  {
    term: "Head Dreamer",
    group: "round",
    aka: "head star",
    text: "A table rule from Somnia. In Ainmos you are the only Dreamer, so you draw every Dream.",
  },
  {
    term: "Hold the Line",
    group: "people",
    aka: "immovable power",
    text: "The Immovable's power. Spend 1 Power Token. For the rest of this Meet, every spread may add +1 Psyche. If you use it before Meet, it waits until Meet begins. It does not spend a Meet action.",
  },
  {
    term: "Hunter",
    group: "people",
    aka: "the hunter",
    text: "Elasticity 2, Willpower 1, Lucidity 0. Power (1 Power Token, in Explore) Lure: every Dreambeast moves up to 2 Landscapes toward you, or away from you.",
  },
  {
    term: "Immovable",
    group: "people",
    aka: "the immovable",
    text: "Willpower 2, Lucidity 1, Elasticity 0. Power (1 Power Token, in Meet) Hold the Line: every fight this Meet rolls 2 more dice.",
  },
  {
    term: "Innocent",
    group: "people",
    text: "A Lucidity Archetype. It appears on Candy Mountain or The Attic, and its Events come from those two Landscapes. Once Acquired, its power is yours (1 Power Token, any phase): Remember 3: discard up to 3 Psyche, Return that many +1.",
  },
  {
    term: "Instant",
    group: "cards",
    text: "An Object you play from the Objects row, then Discard. It does not spend a Meet action. If it has nothing to act on yet (Knife with no beast on your Landscape, say), it stays in your hand and tells you why. Must-play Objects resolve the moment they are drawn.",
  },
  {
    term: "Landscape",
    group: "map",
    aka: "hex tile",
    text: "One hex on the Dreamscape, with a suit and two Meet actions: Call a Dreambeast of its suit, and one action no other Landscape has. Each works once per Meet on that Landscape and costs 1 Meet Action.",
  },
  {
    term: "Leviathan",
    group: "meet",
    text: "The last Boss. Power 12. Each dusk it stands, the edge Landscape farthest from The Bed is Forgotten. Accept it for 2 Power Tokens or an Object of its suit.",
  },
  {
    term: "Lover",
    group: "people",
    text: "An Elasticity Archetype. It appears on Awards or The Party, and its Events come from those two Landscapes. Once Acquired, its power is yours (1 Power Token, any phase): Draw 1 Object from the Object deck.",
  },
  {
    term: "Lucidity",
    group: "cards",
    aka: "blue reveal suit",
    text: "The blue suit. Spend 1 Lucidity to open Reveal. The reveal budget is that card's value plus the opener's Lucidity. The Rested (2) and the Visionary (2) are the high Lucidity Dreamers.",
  },
  {
    term: "Magician",
    group: "people",
    text: "An Elasticity Archetype. It appears on Desert or Forest, and its Events come from those two Landscapes. Once Acquired: +1 Elasticity, always.",
  },
  {
    term: "Meet",
    group: "round",
    aka: "meet phase",
    text: "The third phase of each Dream (phases 3, 6, and 9 of a Cycle). Your Willpower is your free Meet Actions; spend 1 Willpower card for +its value. Each one can fight the Dreambeast on your Landscape, Meet the Archetype there (its Event, then the fight), use one of your Landscape's two actions, or tap a Persistent Object. Only Meet Actions you paid for become Glimmer if unused. As Meet ends, every Archetype slips 1 Landscape away.",
  },
  {
    term: "Mindstream",
    group: "cards",
    text: "The Events. They no longer sit on Landscapes to be drawn; each Archetype draws its own Events when you Meet it.",
  },
  {
    term: "Must-play",
    group: "cards",
    aka: "the nothing all seeing eye",
    text: "An Instant Object that resolves as soon as it is drawn, then is Discarded.",
  },
  {
    term: "Nap",
    group: "win",
    text: "The middle night: Acquire 6 Archetypes within 7 Cycles.",
  },
  {
    term: "Next Phase",
    group: "round",
    text: "The round button at the top-right of the map. It ends the current phase. If you never opened the phase, you spend nothing. Leftover Reveals, moves, and Meet actions each bank 1 Glimmer before the phase changes. During Reveal, if the Dream is not drawn yet, Next Phase draws it first.",
  },
  {
    term: "Nightmare",
    group: "meet",
    text: "One of the two Dreambeast kinds. Runner, Hunter, and Immovable are Nightmare Dreamers. Matching the beast's kind adds 1 to your Power.",
  },
  {
    term: "Object",
    group: "cards",
    text: "A card from one of three Object decks, one per suit. You get one from the Lost & Found, by beating a Dreambeast (if you choose an Object over a Power Token), or when a Dream or Archetype says so. Instant: play it, then Discard it. Must-play: it resolves when drawn. Persistent: it stays in play, and turning it on costs 1 Meet action. Lost Objects are Discarded, never Repressed.",
  },
  {
    term: "Object set",
    group: "cards",
    aka: "sticks jewelry chess elements body",
    text: "Four families: Body (5 pieces), Elements (4), Jewelry (3), and Sticks (3). Each piece shows how much of its set you hold. The moment the last piece arrives, even straight from the Lost & Found, you Acquire an Archetype of your choice from the deck and the set is Discarded. The One counts as any 1 piece.",
  },
  {
    term: "Orphan",
    group: "people",
    text: "A Willpower Archetype. It appears on House or Suburbia, and its Events come from those two Landscapes. Once Acquired, its power is yours (1 Power Token, any phase): Your next fight rolls +3 dice.",
  },
  {
    term: "Outlaw",
    group: "people",
    text: "An Elasticity Archetype. It appears on Road or The Basement, and its Events come from those two Landscapes. Once Acquired, its power is yours (1 Power Token, any phase): Banish the Dreambeast on your Landscape without a fight (not a Boss); no reward.",
  },
  {
    term: "Pass Turn",
    group: "round",
    aka: "pass token",
    text: "A table rule from Somnia. Ainmos is played by one Dreamer, so every action is yours.",
  },
  {
    term: "Persistent",
    group: "cards",
    text: "An Object that stays in play. Putting it down is free. Some work on their own (the Body, Jewelry, and Stick pieces, Beating Heart, Skeleton Key, Flower). The rest you activate for 1 Meet action, once each per Meet: Remember, redeal the Vault, place a Landscape, extra fight dice, draw, move, or pull a beast to you.",
  },
  {
    term: "Power",
    group: "meet",
    aka: "beast power dreamer power dice",
    text: "How many dice a side rolls. A Dreambeast has one Power. Yours is the Psyche you play, plus your matching stat (when a card of the beast's suit is in the spread), and your Dream Forms (less the beast's Ward). Recommended Power is the beast's Power + 2. You may play less. Ties go to you.",
  },
  {
    term: "Power Token",
    group: "cards",
    text: "A token, not a card. You hold up to 6. You start with 2, beating a Dreambeast pays 2 (or an Object of its suit instead), and each Archetype you Acquire pays 1. A Power Token does one thing: it activates a power, your Dreamer\'s Power or an Acquired Archetype\'s.",
  },
  {
    term: "Psyche",
    group: "cards",
    aka: "hand",
    text: "The cards in a Dreamer's hand. They are Lucidity, Elasticity, Willpower, or Wild. They buy extra phase Actions, fight, and keep you alive. Round 1 starts at 6. From round 2 you draw 3 as each round begins (after the Lost & Found), and 4 more at the dawn between Cycles. Unused actions no longer draw: they bank Glimmer. Each difficulty has its own deck, mostly 1s and 2s. Per suit: Daydream eleven 1s, six 2s, two 3s, one 4, plus 2 Wilds (62 cards); Nap twelve 1s, six 2s, two 3s, one 4, plus 1 Wild (64); Deep Sleep nine 1s, six 2s, three 3s, two 4s, one 5, plus 3 Wilds (66).",
  },
  {
    term: "Psyche Deck",
    group: "cards",
    text: "The draw pile for Psyche: 78 cards, 12 of which start the night in the Subconscious. With its discard, it is the Waking Mind. When the deck is empty, shuffle the discard. If the deck and the discard are both empty, the table loses. At dusk, each Dreambeast still on the board Represses 1 card from the top of this deck.",
  },
  {
    term: "Quest",
    group: "win",
    text: "Gone. An Archetype appears on one of its two home Landscapes; walk there and Meet it.",
  },

  {
    term: "Repress",
    group: "cards",
    aka: "banish subconscious",
    text: "Only Psyche is ever Repressed. A Repressed Psyche leaves play and waits face-up in the Subconscious until it is Returned. Dreams and Dreambeasts Repress Psyche from your hand or from the top of the Waking Mind; that is how the night wears you down.",
  },
  {
    term: "Rested",
    group: "people",
    aka: "the rested",
    text: "Lucidity 2, Elasticity 1, Willpower 0. Power (1 Power Token, in Reveal) Lucid Rest: this Reveal, each Landscape you place draws you 1 Psyche (up to 3).",
  },
  {
    term: "Return",
    group: "cards",
    text: "Move Psyche from the Subconscious back into play. You always choose which Psyche. A Returned Psyche goes to the Psyche discard and is +1 Waking Mind. Most Returns come through Remember, Landscapes, Bright Events, and Acquiring Archetypes.",
  },
  {
    term: "Reveal",
    group: "round",
    aka: "reveal phase",
    text: "The first phase of each Dream (phases 1, 4, and 7 of a Cycle). The Dream is drawn and endured. Your Lucidity is your free Reveal Actions; spend 1 Lucidity card for +its value. Each Reveal places one Landscape from the Dreamscape Vault on a glowing slot beside the dream. Each unused Reveal you paid for banks 1 Glimmer.",
  },
  {
    term: "Ruler",
    group: "people",
    text: "A Willpower Archetype. It appears on Tranquil Grove or Endless Hallway, and its Events come from those two Landscapes. Once Acquired, its power is yours (1 Power Token, any phase): Earn a free Insight at the next Lost & Found.",
  },
  {
    term: "Runner",
    group: "people",
    aka: "the runner",
    text: "Elasticity 2, Lucidity 1, Willpower 0. Power (1 Power Token, in Explore) Dash: +3 steps this Explore.",
  },
  {
    term: "Sage",
    group: "people",
    text: "A Lucidity Archetype. It appears on Sky or Silver Mist, and its Events come from those two Landscapes. Once Acquired: +1 Lucidity, always.",
  },
  {
    term: "Spread",
    group: "meet",
    text: "The Psyche you commit to a dice battle before you roll. Play 1 to 3 Psyche. At least one must match the suit the fight asks for. Wild counts.",
  },
  {
    term: "Subconscious",
    group: "cards",
    text: "Where Repressed Psyche waits, face-up. It holds Psyche and nothing else. The night begins with 12 random Psyche already there. Return brings Psyche back, your choice; Remember is how the table wins it back.",
  },
  {
    term: "Trade",
    group: "meet",
    text: "A table rule from Somnia. Ainmos is played by one Dreamer, so there is no one to trade with.",
  },
  {
    term: "Visionary",
    group: "people",
    aka: "the visionary",
    text: "Lucidity 2, Willpower 1, Elasticity 0. Power (1 Power Token, in Reveal) Second Sight: place 2 Landscapes from the Vault, free.",
  },
  {
    term: "Warrior",
    group: "people",
    text: "A Willpower Archetype. It appears on Scary Classroom or City, and its Events come from those two Landscapes. Once Acquired: +1 Willpower, always.",
  },
  {
    term: "Wasteland",
    group: "map",
    text: "Ainmos has no Wasteland. A Forgotten Landscape leaves the map and shuffles back into the Landscape deck instead.",
  },
  {
    term: "Weaver",
    group: "people",
    aka: "the weaver",
    text: "Willpower 2, Elasticity 1, Lucidity 0. Power (1 Power Token, in Meet) Reweave: discard up to 3 Psyche, then draw that many plus 1.",
  },
  {
    term: "Wild Psyche",
    group: "cards",
    aka: "wild",
    text: "A Psyche of value 5 that counts as any suit. When you spend it, it goes to the Psyche discard like any other card. It does not Repress extra cards.",
  },
  {
    term: "Willpower",
    group: "cards",
    aka: "red meet suit",
    text: "The red suit. Spend 1 Willpower to open Meet. The action budget is that card's value plus the opener's Willpower. The Immovable (2) and the Weaver (2) are the high Willpower Dreamers.",
  },
  {
    term: "You Never Wake Up",
    group: "win",
    text: "How a night is lost: the Waking Mind runs dry, or the Death Clock strikes six. The Long Night makes the first one come fast.",
  },
                                                ];

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** The short primer behind the menu spiral and the ? hub. Every term lives in the glossary. */
export function playerPrimerHtml() {
  return `
    <div class="player-primer">
      <p class="player-primer-lead">One Dreamer, one night. Build the dream, walk it, and <strong>Acquire Archetypes</strong>: 3 on a Daydream, 6 on a Nap, all 12 in Deep Sleep. Collect them and you wake.</p>
      <div class="player-primer-grid">
        <section>
          <h3>The night</h3>
          <p>A night is 3, 7, or 15 <strong>Cycles</strong>. Each Cycle is <strong>3 Dreams</strong>, and each Dream is one Reveal, Explore, Meet: <strong>9 phases</strong>. Dream 1 is a Dream to endure; Dream 2 brings the Cycle's <strong>Dreambeast</strong>; Dream 3 lets you call <strong>1 of 3 Archetypes</strong>.</p>
          <p>Every <strong>Dream</strong> hurts. Endure it, then play the round.</p>
        </section>
        <section>
          <h3>Each round</h3>
          <p><strong>Reveal</strong>, <strong>Explore</strong>, <strong>Meet</strong>. Your stat is your free Actions; 1 card of that suit adds its value. Place Landscapes, walk, then fight.</p>
          <p><strong>Fight</strong> with 1–3 Psyche: roll that many d6, 5s and 6s succeed, ties go to you. Patterns make <strong>Dream Forms</strong> for extra dice.</p>
        </section>
        <section>
          <h3>Grow and survive</h3>
          <p>Beat a Dreambeast for Power Tokens or an Object. Shop the <strong>Lost &amp; Found</strong> between Dreams. Each beast left at dusk bleeds your Waking Mind. Die and you wake on The Bed without your Objects.</p>
          <p>When the Dream Deck runs dry, the <strong>Long Night</strong> bleeds you harder every dusk until you wake or forget.</p>
          <p class="player-primer-more">Psyche is your health and your coin. <a href="how-to-play.html">How to Play</a> puts it all on one page; in game, <strong>?</strong> explains every rule.</p>
        </section>
      </div>
    </div>
  `;
}

function termHay(entry) {
  return `${entry.term} ${entry.aka || ""} ${entry.text}`.toLowerCase();
}

function termArticle(entry) {
  const hay = escapeHtml(termHay(entry));
  return `
    <article class="glossary-item" data-glossary-item data-glossary-group="${entry.group}" data-glossary-letter="${escapeHtml(entry.term[0].toUpperCase())}" data-glossary-hay="${hay}">
      <h3>${escapeHtml(entry.term)}</h3>
      <p>${entry.text}</p>
    </article>
  `;
}

function alphaHtml() {
  const sorted = [...TERMS].sort((a, b) => a.term.localeCompare(b.term));
  const letters = [];
  let current = "";
  sorted.forEach((entry) => {
    const letter = entry.term[0].toUpperCase();
    if (letter !== current) {
      if (current) letters.push("</section>");
      current = letter;
      letters.push(`<section class="glossary-letter" data-glossary-bucket><h2 id="gloss-${letter}">${letter}</h2>`);
    }
    letters.push(termArticle(entry));
  });
  if (current) letters.push("</section>");
  const jumps = [...new Set(sorted.map((entry) => entry.term[0].toUpperCase()))]
    .map((letter) => `<a href="#gloss-${letter}">${letter}</a>`)
    .join("");
  return `<nav class="glossary-alpha" aria-label="Letters">${jumps}</nav><div class="glossary-list">${letters.join("")}</div>`;
}

function conceptHtml() {
  return GROUPS.map((group) => {
    const items = TERMS.filter((entry) => entry.group === group.id)
      .sort((a, b) => a.term.localeCompare(b.term))
      .map(termArticle)
      .join("");
    return `
      <section class="glossary-concept" data-glossary-bucket>
        <h2>${escapeHtml(group.label)}</h2>
        ${items}
      </section>
    `;
  }).join("");
}

export function glossaryPanelHtml() {
  return `
    <div class="glossary-panel">
      <div class="glossary-tools">
        <label class="glossary-search-label">
          <span>Search</span>
          <input type="search" data-glossary-search placeholder="Repress, Bed, Bright, Willpower…" autocomplete="off">
        </label>
        <div class="glossary-modes" role="group" aria-label="Glossary layout">
          <button type="button" class="is-on" data-glossary-mode="alpha" aria-pressed="true">A–Z</button>
          <button type="button" data-glossary-mode="concept" aria-pressed="false">By concept</button>
        </div>
      </div>
      <p class="glossary-empty" data-glossary-empty hidden>No term matches that search.</p>
      <div class="glossary-view" data-glossary-view="alpha">${alphaHtml()}</div>
      <div class="glossary-view" data-glossary-view="concept" hidden>${conceptHtml()}</div>
    </div>
  `;
}

function applyGlossaryFilter(root) {
  const query = (root.querySelector("[data-glossary-search]")?.value || "").trim().toLowerCase();
  const views = root.querySelectorAll("[data-glossary-view]");
  let shown = 0;
  views.forEach((view) => {
    view.querySelectorAll("[data-glossary-item]").forEach((item) => {
      const ok = !query || (item.dataset.glossaryHay || "").includes(query);
      item.hidden = !ok;
      if (ok && !view.hidden) shown += 1;
    });
    view.querySelectorAll("[data-glossary-bucket]").forEach((bucket) => {
      const any = [...bucket.querySelectorAll("[data-glossary-item]")].some((item) => !item.hidden);
      bucket.hidden = !any;
    });
  });
  const active = root.querySelector("[data-glossary-view]:not([hidden])");
  const visible = active
    ? [...active.querySelectorAll("[data-glossary-item]")].filter((item) => !item.hidden).length
    : shown;
  const empty = root.querySelector("[data-glossary-empty]");
  if (empty) empty.hidden = visible > 0;
}

export function bindGuideHub(root) {
  if (!root) return;
  const tabs = [...root.querySelectorAll("[data-guide-tab]")];
  const panels = [...root.querySelectorAll("[data-guide-panel]")];
  const show = (id) => {
    tabs.forEach((tab) => {
      const on = tab.dataset.guideTab === id;
      tab.classList.toggle("is-on", on);
      tab.setAttribute("aria-selected", on ? "true" : "false");
    });
    panels.forEach((panel) => {
      panel.hidden = panel.dataset.guidePanel !== id;
    });
    if (id === "glossary") {
      root.querySelector("[data-glossary-search]")?.focus();
    }
  };
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => show(tab.dataset.guideTab));
  });

  root.querySelector("[data-glossary-search]")?.addEventListener("input", () => applyGlossaryFilter(root));
  root.querySelectorAll("[data-glossary-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      const mode = button.dataset.glossaryMode;
      root.querySelectorAll("[data-glossary-mode]").forEach((other) => {
        const on = other === button;
        other.classList.toggle("is-on", on);
        other.setAttribute("aria-pressed", on ? "true" : "false");
      });
      root.querySelectorAll("[data-glossary-view]").forEach((view) => {
        view.hidden = view.dataset.glossaryView !== mode;
      });
      applyGlossaryFilter(root);
    });
  });
}
