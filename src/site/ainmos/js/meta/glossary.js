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
    term: "Dusk",
    group: "round",
    text: "The end of each round. Each Dreambeast still on the board Represses 1 Psyche from the Waking Mind. Some Bosses act at dusk too: the Baku eats a Dream, the Devourer eats an Object, Leviathan Forgets a Landscape. The −1 badge on a beast and the Mind counter's forecast show what dusk will take.",
  },
  {
    term: "Memory Landscape",
    group: "places",
    text: "Tranquil Grove, Silver Mist, Day in the Life, and Black Void. Their action is Remember 2, once per table on each of them every Meet. Every Lucidity Landscape sees or remembers; Elasticity Landscapes move Dreamers; Willpower Landscapes fight and move beasts.",
  },
  {
    term: "Remember",
    group: "cards",
    aka: "remember n",
    text: "Remember N: discard up to N Psyche from your hand, then Return that many cards plus 1 from the Subconscious. Discard none and you still Return 1. Every Psyche you Return is +1 Waking Mind. Memory Landscapes Remember 2. Remember Objects, fixed Brights, and the Innocent and Fool all Remember.",
  },
  {
    term: "Waking Mind",
    group: "win",
    aka: "mind psyche deck",
    text: "The Psyche deck plus its discard: the Psyche you can still draw. The Mind counter in the top bar shows it, and what dusk will take. If it empties, you forget yourself and the table loses. Remember wins it back.",
  },
  {
    term: "Accept",
    group: "meet",
    aka: "befriend",
    text: "One way to win a dice battle. Pay the Dreambeast's own suit. If you have more successes than it does, it leaves the map, joins your hand as an ally worth half its Power (rounded down), and you draw 1 Object of its suit. Its printed Accept effect also happens.",
  },
  {
    term: "Acquire",
    group: "win",
    aka: "commit",
    text: "Take a face-up Archetype for its points once both of its quests are already true. Acquire is free: no Power Token and no Meet action. A finished Object set can also Acquire an Archetype that is still in the deck. In Ainmos, Acquiring gives the Archetype's points; its power is a Boon.",
  },
  {
    term: "Active Archetype",
    group: "win",
    text: "Any of the three face-up Archetypes in the row. Each shows two quests. When both quests on any one are true, Acquire it, score its points, and the next Archetype in the deck fills the row. Click a row chip to focus one.",
  },
  {
    term: "Affinity",
    group: "meet",
    aka: "fantasy nightmare",
    text: "A Dreamer and a Dreambeast are each Fantasy or Nightmare. Rested, Visionary, and Weaver are Fantasy. Runner, Hunter, and Immovable are Nightmare. A matching kind adds 1 to your Power. Matching the beast's suit adds 1 more.",
  },
  {
    term: "Ally",
    group: "cards",
    aka: "befriended dreambeast",
    text: "A Dreambeast you Accepted. It stays in your hand and is worth half its Power, rounded down. Allies do not count toward the 3-card spread and do not pay costs. Spent allies are Repressed. They count toward the 10-card hand limit.",
  },
  {
    term: "Archetype",
    group: "win",
    text: "The prize. Twelve of them, three face up at a time. Two-point Archetypes (Innocent, Orphan, Outlaw) ask for a Mindstream draw on any Landscape of their suit and a won Meet against a Dreambeast of that suit. Three-point Archetypes name two Landscapes. Four-point Archetypes (Sage, Magician, Warrior) ask you to defeat their boss and sacrifice one Object; they sit in the bottom half of the deck. Most have a power that costs 1 Power Token. Sage, Magician, and Warrior have no power; once Acquired they give every Dreamer +1 Lucidity, Elasticity, or Willpower.",
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
    text: "The center hex. It starts face-up and can never be Forgotten. Its Meet action is Dream Onward, once per table: on a Fixed Board, Reveal 1 Landscape; on a Freeform Board, flip the top tile of the deck and place it free or put it back. When your points are done, every living Dreamer must stand on The Bed to wake. Bosses spawn here.",
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
    text: "Cerberus, Double, and Leviathan. Each is Power 11 and appears on The Bed, usually on Reveal rounds 3, 6, and 9. At the start of Meet, a boss steps one hex toward the nearest Dreamer unless a Dreamer is already on its hex. You Accept or Repress them like any other Dreambeast. Cerberus on Accept Represses the top 3 Psyche. Double on Accept Forgets Day in the Life and Scary Classroom.",
  },
  {
    term: "Bright",
    group: "cards",
    aka: "good path toll gate",
    text: "The paid path on a Dream or Event. Dim is the other path, and it is free. On a Dream, Bright stays shut until its condition is true, and it costs a Repress, a discarded Psyche, or a Forgotten Landscape. On an Event, Bright opens when a Landscape named on the card is revealed. If it is not, you may Dream it open: pay Bright's cost plus 1 Lucidity Psyche to Reveal that Landscape, then take Bright. Bright pays what it prints. The card remembers which path you chose.",
  },
  {
    term: "Caregiver",
    group: "people",
    text: "A 3-point Archetype. Power: the Dreamer with the fewest Psyche draws up to 5, stopping at the hand limit. Costs 1 Power Token.",
  },
  {
    term: "Cerberus",
    group: "meet",
    text: "A boss. Power 11, spawned on The Bed. On Accept, Repress the top 3 cards of the Psyche Deck. The Magician's quest is to defeat Cerberus and sacrifice one Object.",
  },
  {
    term: "Creator",
    group: "people",
    text: "A 3-point Archetype. Power: each Dreamer Returns 1 Dreambeast from the Subconscious. Costs 1 Power Token.",
  },
  {
    term: "Daydream",
    group: "win",
    aka: "length difficulty",
    text: "The short game. Acquire 8 points before a Dream Deck of 11 regular Dreams runs out. Same rules as Nap and Deep Sleep. The goal is closer.",
  },
  {
    term: "Death",
    group: "win",
    aka: "respawn",
    text: "If a Dreamer must pay a Psyche cost and has no Psyche left, they die. Allies do not count as Psyche for this. The Death Clock ticks. Their Objects are discarded, their Power Tokens return to the pool, and they draw 3 Psyche on The Bed. The Mindstream is not touched.",
  },
  {
    term: "Death Clock",
    group: "win",
    text: "A shared count of deaths. It starts at 0. The sixth death ends the game at once. The Dreamer who takes that tick does not redraw.",
  },
  {
    term: "Deep Sleep",
    group: "win",
    text: "The long game. Acquire 24 points before a Dream Deck of 18 regular Dreams runs out. Same rules as Daydream and Nap.",
  },
  {
    term: "Dim",
    group: "cards",
    aka: "bad path",
    text: "The free path on a Dream or Event. You can always choose it. It does not pay Bright's toll. On an Event, Dim Represses a card or Forgets Landscapes, and it gives no reward. The card remembers that you chose Dim.",
  },
  {
    term: "Discard",
    group: "cards",
    text: "Put a card into its discard pile. Discarded Psyche can be drawn again when the deck is reshuffled, or drawn directly by some powers. This is not Repress. Repressed cards go to the Subconscious instead.",
  },
  {
    term: "Double",
    group: "meet",
    text: "A boss. Power 11, spawned on The Bed. On Accept, Forget Day in the Life and Scary Classroom. The Sage's quest is to defeat Double and sacrifice one Object.",
  },
  {
    term: "Draw Dream",
    group: "round",
    text: "During Reveal, draw the top Dream and resolve its Bright or Dim choice. Do this before spending Lucidity. The button sits to the left of Next Phase. The Head Dreamer is the one named on that draw.",
  },
  {
    term: "Dream",
    group: "cards",
    text: "One card from the Dream Deck, drawn at the start of Reveal. Every Dream, including the first, offers Bright and Dim. Bright costs something and may be shut. Dim is free. Only the path you choose happens.",
  },
  {
    term: "Dream Deck",
    group: "win",
    aka: "clock",
    text: "The round clock, shown as the Night Bar across the top. It is laid out in Antes: two Dreams, then a Boss. Daydream has 4 Antes, Nap 7, Deep Sleep 10. When the final Boss round ends, the night is over.",
  },
  {
    term: "Ante",
    group: "win",
    aka: "night bar",
    text: "One step of the night: two Dreams, then a Boss Dream. The Boss is face up on the Night Bar from the start. Defeat it to clear the Ante and choose a Boon. The round after a Boss arrives is dawn: the Waking Mind reshuffles and everyone draws 3.",
  },
  {
    term: "Boss Ladder",
    group: "meet",
    aka: "turtle shadows jackalope baku mindless devourer bogey cerberus double leviathan",
    text: "Ten Bosses from rung 10 to rung 1: Winged Turtle, Shadows, Jackalope, Baku, Mindless, Devourer, Bogey, Cerberus, Double, Leviathan. Each bends one rule while it stands. A short night stops partway up: Daydream ends on the Baku, Nap on the Bogey.",
  },
  {
    term: "Dream Form",
    group: "meet",
    aka: "echo ladder chord trinity trifecta unity",
    text: "A spread pattern that adds dice. Echo: two of one value. Ladder: three in a row. Chord: three of one suit. Trinity: one of each suit. Trifecta: three of a kind. Unity: three 1s. A spread counts as its best Form. Every Form starts at +1 die and gains +1 per level.",
  },
  {
    term: "Psyche Upgrade",
    group: "cards",
    aka: "chaotic vivid lucid recurring",
    text: "One upgrade per Psyche card, for the whole night. Chaotic: a d6 value, rolled when drawn. Vivid: a second suit. Lucid: any suit, same value. Recurring: returns to hand after a spread. A new upgrade replaces the old; the same one again changes nothing.",
  },
  {
    term: "Lost & Found",
    group: "cards",
    aka: "shop insight reroll",
    text: "Opens between rounds: three Objects (1–5 Psyche value of their suit) and one Insight (3–6 of any suit: a Form level or a Psyche upgrade). Look again for 1 Power Token. Draw the Dream when you leave.",
  },
  {
    term: "Boon",
    group: "win",
    aka: "study wider vault deep pockets",
    text: "Chosen when a Boss falls, 1 of 3, kept all night. Archetype powers (1 Power Token) and the Sage, Magician, and Warrior passives are Boons. So are Study, Wider Vault, and Deep Pockets.",
  },
  {
    term: "Dreamscape Reset",
    group: "places",
    aka: "reset vault empty",
    text: "When the Dreamscape Vault and the tile deck are both empty, the next round begins with only The Bed. Every Landscape shuffles back into the tile deck, Dreambeasts on them are Repressed, Bosses drift to The Bed, and every Dreamer wakes on The Bed.",
  },
  {
    term: "Dreambeast",
    group: "meet",
    aka: "encounter beast",
    text: "A creature on a Landscape. It has one Power, a suit, and a Fantasy or Nightmare kind. During Meet, the Dreamer standing on its hex may Accept or Repress it. A beast left on the board at round end Represses 1 Psyche from the top of the Psyche Deck. It stays until you win a fight against it.",
  },
  {
    term: "Dreamer",
    group: "people",
    text: "A player. The table picks 2, 3, or 4. Each has Lucidity, Elasticity, and Willpower that add up to 3, a free passive once a round, and a power that costs 1 Power Token. You share one map, one Dream Deck, and one fate.",
  },
  {
    term: "Dreamscape",
    group: "map",
    text: "The whole hex map: The Bed plus 24 Landscapes. Forgotten hexes show as Wasteland until you Reveal them.",
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
    text: "A Dreambeast sitting on a Landscape, waiting to be Accepted or Repressed. Only the Dreamer on that hex can fight it.",
  },
  {
    term: "Event",
    group: "cards",
    text: "A Mindstream card that is not a Dreambeast, an Object draw, or a Power Token. It names one or two Landscapes. Bright is open only while one of those Landscapes is revealed. Dim Represses something or Forgets a Landscape.",
  },
  {
    term: "Explore",
    group: "round",
    aka: "explore phase",
    text: "The second phase. One Dreamer spends 1 Elasticity, or 1 Power Token (that counts as 1 plus their Elasticity). The table shares that many moves. On your turn, click an adjacent hex to step. Pass Turn or Give Turn to let someone else walk. Stepping onto Wasteland discards 1 Psyche. Each unused move draws 1 Psyche, passed around the table.",
  },
  {
    term: "Explorer",
    group: "people",
    text: "A 3-point Archetype. Power: move 1 Dreamer or 1 Dreambeast onto a Landscape of its suit. Costs 1 Power Token.",
  },
  {
    term: "Fail",
    group: "meet",
    text: "The punishment printed on a Dreambeast for a lost fight. It runs when you lose Accept or Repress against a beast you just drew from the Mindstream. A beast that was only spawned onto the map does not Fail when you lose; the cards you played are still spent, and the beast stays.",
  },
  {
    term: "Fantasy",
    group: "meet",
    text: "One of the two Dreambeast kinds. Rested, Visionary, and Weaver are Fantasy Dreamers. Matching the beast's kind adds 1 to your Power.",
  },

  {
    term: "Fool",
    group: "people",
    text: "A 3-point Archetype. Power: Return a number of Subconscious cards equal to Dreamers + 2. Costs 1 Power Token.",
  },
  {
    term: "Forget",
    group: "map",
    aka: "forgotten wasteland",
    text: "Turn a Landscape into Wasteland. Encounters there are Repressed. Each Dreamer standing there Represses 1 Psyche. The Bed cannot be Forgotten. You can Reveal a Wasteland again later. Forgetting a Landscape still in the Vault sets it aside until the Dreamscape Reset.",
  },
  {
    term: "Give Turn",
    group: "round",
    text: "Hand the rest of the shared Reveals, moves, or Meet actions to a Dreamer you choose. Pass Turn sends them clockwise instead.",
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
    text: "The Dreamer marked with a star. They are the one named when the round's Dream is drawn. At the end of the round the star moves clockwise to the next living Dreamer.",
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
    text: "Elasticity 2, Willpower 1, Lucidity 0. Nightmare. Passive: after their first fight, if the beast stays, they may shove it 1 hex. Power (1 token): move each Dreambeast 1 hex toward the nearest Dreamer, or 1 hex away from The Bed. If no beasts are out, the token is not spent.",
  },
  {
    term: "Immovable",
    group: "people",
    aka: "the immovable",
    text: "Willpower 2, Lucidity 1, Elasticity 0. Nightmare. Power: Hold the Line. There is no free ignore-the-tax passive. The round-end deck tax does not care where you stand.",
  },
  {
    term: "Innocent",
    group: "people",
    text: "A 2-point Lucidity Archetype. Quests: Draw Mindstream on any Lucidity Landscape, and win a Meet against a Lucidity Dreambeast. Power: Return 4 cards from the Subconscious. Costs 1 Power Token.",
  },
  {
    term: "Instant",
    group: "cards",
    text: "An Object you play from the Objects row, then Repress. It does not spend a Meet action. Must-play Objects are Instants that resolve the moment they are drawn.",
  },
  {
    term: "Landscape",
    group: "map",
    aka: "hex tile",
    text: "One hex on the Dreamscape. It has a suit. During Meet you may Draw its Mindstream as often as you have actions, and use its one unique action once for the whole table this Meet. Quests can still name a Landscape after it has been Forgotten.",
  },
  {
    term: "Leviathan",
    group: "meet",
    text: "A boss. Power 11, spawned on The Bed. Accept befriends it. Repress sends it to the Subconscious, and it stays there. The Warrior's quest is to defeat Leviathan and sacrifice one Object.",
  },
  {
    term: "Lover",
    group: "people",
    text: "A 3-point Archetype. Power: Return 1 Object from the Subconscious. Costs 1 Power Token.",
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
    text: "A 4-point Archetype. Quests: defeat Cerberus, and have one Dreamer sacrifice one Object. No paid power. Once Acquired, every Dreamer has +1 Elasticity.",
  },
  {
    term: "Meet",
    group: "round",
    aka: "meet phase",
    text: "The third phase. At the start, each boss steps toward the nearest Dreamer. One Dreamer spends 1 Willpower, or 1 Power Token (that counts as 1 plus their Willpower). The table shares that many actions. Spend them to fight, Draw Mindstream, use a Landscape action, or activate a Persistent Object. The Dreamer who opened takes the first action, then Pass Turn moves clockwise. Each unused action draws 1 Psyche.",
  },
  {
    term: "Mindstream",
    group: "cards",
    text: "Three decks, one per suit. They hold Dreambeasts, Events, Power Token cards, and extra Dream draws. Objects are not in these decks. Draw Mindstream costs 1 Meet action and is repeatable. If a suit is entirely in the Subconscious, with nothing left in its deck, discard, or in play, the table loses.",
  },
  {
    term: "Must-play",
    group: "cards",
    aka: "the nothing all seeing eye",
    text: "An Instant Object that resolves as soon as it is drawn, then is Repressed. The Nothing makes someone lose 1 Power Token, or the table Represses Dreamers + 6 from the top of the Psyche Deck.",
  },
  {
    term: "Nap",
    group: "win",
    text: "The middle game. Acquire 12 points before a Dream Deck of 14 regular Dreams runs out. Same rules as Daydream and Deep Sleep.",
  },
  {
    term: "Next Phase",
    group: "round",
    text: "The round button at the top-right of the map. It ends the current phase. If you never opened the phase, you spend nothing. Leftover Reveals, moves, and Meet actions each draw 1 Psyche before the phase changes. During Reveal, if the Dream is not drawn yet, Next Phase draws it first.",
  },
  {
    term: "Nightmare",
    group: "meet",
    text: "One of the two Dreambeast kinds. Runner, Hunter, and Immovable are Nightmare Dreamers. Matching the beast's kind adds 1 to your Power.",
  },
  {
    term: "Object",
    group: "cards",
    text: "A card from one of three Object decks, one per suit. You get one by Accepting a Dreambeast, by a Mindstream or Dream that says so, or from the Object discard. Instant: play it, then Repress it. Must-play: it resolves when drawn. Persistent: it stays in play, and turning it on costs 1 Meet action. Jewelry and sticks in play add +1 Power in a fight. A body Object doubles the highest Psyche in the spread.",
  },
  {
    term: "Object set",
    group: "cards",
    aka: "sticks jewelry chess elements body",
    text: "Five families: 3 sticks, 3 jewelry, 3 chess, 4 elements, or 5 body parts. Finish any one set and you may Acquire an Archetype that is still in the deck. The set is then Repressed. If the Archetype deck is empty, the set stays.",
  },
  {
    term: "Orphan",
    group: "people",
    text: "A 2-point Willpower Archetype. Quests: Draw Mindstream on any Willpower Landscape, and win a Meet against a Willpower Dreambeast. Power: every Dreamer draws 2 Psyche. Costs 1 Power Token.",
  },
  {
    term: "Outlaw",
    group: "people",
    text: "A 2-point Elasticity Archetype. Quests: Draw Mindstream on any Elasticity Landscape, and win a Meet against an Elasticity Dreambeast. Power: draw 1 Object from the discard. Costs 1 Power Token.",
  },
  {
    term: "Pass Turn",
    group: "round",
    aka: "pass token",
    text: "Send the action clockwise without spending the budget. After the Dreamer who opened the phase takes the first action, Pass Turn walks the remaining Reveals, moves, or Meet actions around the table.",
  },
  {
    term: "Persistent",
    group: "cards",
    text: "The only Object that stays in play. Putting it down is free. Activating it costs 1 Meet action, not a Power Token, and each one taps once per Meet. Remember Objects tap to Remember. Jewelry and sticks add +1 to a fight. A body part doubles the highest Psyche you played. Severed Torso raises the hand limit to 12. Beating Heart draws 1 extra Psyche at the start of each round after the first.",
  },
  {
    term: "Power",
    group: "meet",
    aka: "beast power dreamer power dice",
    text: "How many dice a side rolls. A Dreambeast has one Power, used for both Accept and Repress. Yours is the Psyche you play, plus your matching stat, affinity, suit match, jewelry and sticks, a doubled body card, Hold the Line, and up to 3 Power Tokens. Recommended Power is the beast's Power + 2. You may play less.",
  },
  {
    term: "Power Token",
    group: "cards",
    text: "A token, not a Psyche card. The pool holds 24. Each Dreamer starts with 1. A Mindstream Power Token card lets you take 1, or Return one Subconscious card per Dreamer. A token does three things: open a phase as 1 plus that Dreamer's stat, add 1 die to a spread before you roll (max 3), or use a Dreamer or Archetype power. It does not Acquire. Dying returns your tokens to the pool.",
  },
  {
    term: "Psyche",
    group: "cards",
    aka: "hand",
    text: "The cards in a Dreamer's hand. They are Lucidity, Elasticity, Willpower, or Wild. They open phases, fight, and keep you alive. Round 1 starts at 5. From round 2, each living Dreamer draws 2 at the start of Reveal. The deck is six 1s, five 2s, four 3s, three 4s, and two 5s in each suit, plus 6 Wilds.",
  },
  {
    term: "Psyche Deck",
    group: "cards",
    text: "The draw pile for Psyche. With its discard, it is the Waking Mind. When the deck is empty, shuffle the discard. If the deck and the discard are both empty, the table loses. At dusk, each Dreambeast still on the board Represses 1 card from the top of this deck.",
  },
  {
    term: "Quest",
    group: "win",
    text: "One of the two tasks on a face-up Archetype. A quest stays done once it is done, even if the Landscape is later Forgotten, and it counts for every Archetype that asks for it. Both must be true before Acquire. Winning the fight is what counts as Meeting a beast. Drawing the Mindstream is the other half for most Archetypes.",
  },

  {
    term: "Repress",
    group: "cards",
    aka: "banish subconscious",
    text: "Two uses of one word. As a fight: pay the next suit of the cycle — Lucidity represses Willpower, Willpower represses Elasticity, Elasticity represses Lucidity — and if you win, the beast goes to the Subconscious and its reward happens. As a cost: a Repressed card leaves play and sits face-up in the Subconscious. It is not in the discard until someone Returns it.",
  },
  {
    term: "Rested",
    group: "people",
    aka: "the rested",
    text: "Lucidity 2, Elasticity 1, Willpower 0. Fantasy. Passive: if they opened no phase this round, they draw 1 Psyche at round end. Power (1 token): each Dreamer draws 1 from the Psyche discard.",
  },
  {
    term: "Return",
    group: "cards",
    text: "Move a card from the Subconscious back to the matching discard, so it can be drawn again. A Returned Psyche is +1 Waking Mind. A Returned Dreambeast goes to the bottom of its Mindstream. Most Returns happen through Remember.",
  },
  {
    term: "Reveal",
    group: "round",
    aka: "reveal phase",
    text: "The first phase. Draw the Dream and choose Bright or Dim. Then one Dreamer spends 1 Lucidity, or 1 Power Token (that counts as 1 plus their Lucidity). Click that many Wasteland hexes to turn them face-up. Each unused Reveal draws 1 Psyche, passed around the table. If the map is already open, the whole budget is draws.",
  },
  {
    term: "Ruler",
    group: "people",
    text: "A 3-point Archetype. Power: each Dreamer Returns 1 Event from the Subconscious. Costs 1 Power Token.",
  },
  {
    term: "Runner",
    group: "people",
    aka: "the runner",
    text: "Elasticity 2, Lucidity 1, Willpower 0. Nightmare. Passive: their first Explore step costs no team move. Power (1 token): every Dreamer moves 2 hexes toward The Bed, or 2 hexes away from it.",
  },
  {
    term: "Sage",
    group: "people",
    text: "A 4-point Archetype. Quests: defeat Double, and have one Dreamer sacrifice one Object. No paid power. Once Acquired, every Dreamer has +1 Lucidity.",
  },
  {
    term: "Spread",
    group: "meet",
    text: "The Psyche you commit to a dice battle before you roll. Play 1 to 3 Psyche. At least one must match the suit that Accept or Repress is asking for. Wild counts. Allies may be added on top and do not count toward the 3.",
  },
  {
    term: "Subconscious",
    group: "cards",
    text: "The face-up piles of Repressed cards: Psyche, Dreambeasts, Mindstream by suit, and Objects. Return sends them to their discards. Remember is how the table wins them back.",
  },
  {
    term: "Trade",
    group: "meet",
    text: "Free during Meet. The other Dreamer must be on your hex or next to it. Each of you may offer up to 3 Psyche. Both hands are visible.",
  },
  {
    term: "Visionary",
    group: "people",
    aka: "the visionary",
    text: "Lucidity 2, Willpower 1, Elasticity 0. Fantasy. Power (1 token): Reveal a number of Landscapes equal to the number of Dreamers + 1.",
  },
  {
    term: "Warrior",
    group: "people",
    text: "A 4-point Archetype. Quests: defeat Leviathan, and have one Dreamer sacrifice one Object. No paid power. Once Acquired, every Dreamer has +1 Willpower.",
  },
  {
    term: "Wasteland",
    group: "map",
    text: "A Forgotten Landscape. It is face-down. Reveal flips it back. Stepping onto it during Explore discards 1 Psyche. Ending Meet while standing on one Represses 1 Psyche from your hand. The Bed is never Wasteland.",
  },
  {
    term: "Weaver",
    group: "people",
    aka: "the weaver",
    text: "Willpower 2, Elasticity 1, Lucidity 0. Fantasy. Passive: once per Meet, swap 1 Psyche with an adjacent Dreamer. That swap is free. Power (1 token): each Dreamer may discard 1 Psyche to draw 1.",
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
    text: "The last card of the Dream Deck. Drawing it loses the game.",
  },
  {
    term: "Awards",
    group: "places",
    text: "A Lucidity Landscape. Once this Meet, the table may take 1 Power Token.",
  },
  {
    term: "Black Void",
    group: "places",
    text: "A Lucidity Landscape. Once this Meet, swap Psyche between two Dreamers.",
  },
  {
    term: "Candy Mountain",
    group: "places",
    text: "An Elasticity Landscape. Once this Meet, draw Psyche equal to your Elasticity.",
  },
  {
    term: "City",
    group: "places",
    text: "A Willpower Landscape. Once this Meet, draw 1 Psyche.",
  },
  {
    term: "Day in the Life",
    group: "places",
    text: "A Lucidity Landscape. Once this Meet, resolve the last discarded Dream again.",
  },
  {
    term: "Desert",
    group: "places",
    text: "A Lucidity Landscape. Once this Meet, every Dreamer steps 1 hex toward The Bed.",
  },
  {
    term: "Endless Hallway",
    group: "places",
    text: "An Elasticity Landscape. Once this Meet, move 1 Dreamer 1 hex.",
  },
  {
    term: "Endless Ocean",
    group: "places",
    text: "An Elasticity Landscape. Once this Meet, draw 2 cards from any deck, keep 1, and discard the other.",
  },
  {
    term: "Field of Broken Glass",
    group: "places",
    text: "A Lucidity Landscape. Once this Meet, swap the positions of 2 Landscapes.",
  },
  {
    term: "Forest",
    group: "places",
    text: "An Elasticity Landscape. Once this Meet, draw 1 card from any Mindstream.",
  },
  {
    term: "House",
    group: "places",
    text: "A Willpower Landscape. Once this Meet, Return 2 cards from the Subconscious.",
  },
  {
    term: "Inner Sanctum",
    group: "places",
    text: "A Willpower Landscape. Once this Meet, Return 1 Event from the Subconscious.",
  },
  {
    term: "Insanity",
    group: "places",
    text: "A Willpower Landscape. Once this Meet, Return 1 card from the Subconscious.",
  },
  {
    term: "Lava",
    group: "places",
    text: "A Willpower Landscape. Once this Meet, spawn a Dreambeast: cycle a Mindstream until a beast appears, place it on a matching Landscape, and discard the rest.",
  },
  {
    term: "Road",
    group: "places",
    text: "An Elasticity Landscape. Once this Meet, move 2 Dreamers 1 hex each.",
  },
  {
    term: "Scary Classroom",
    group: "places",
    text: "A Lucidity Landscape. Once this Meet, discard 1 Psyche, then draw Psyche equal to its value.",
  },
  {
    term: "Sea of Teeth",
    group: "places",
    text: "A Willpower Landscape. Once this Meet, swap 2 Dreambeasts between Landscapes.",
  },
  {
    term: "Silver Mist",
    group: "places",
    text: "A Lucidity Landscape. Once this Meet, Return 1 Object from the Subconscious.",
  },
  {
    term: "Sky",
    group: "places",
    text: "A Lucidity Landscape. Once this Meet, look at one adjacent forgotten Landscape, then move 1 step.",
  },
  {
    term: "Suburbia",
    group: "places",
    text: "A Willpower Landscape. Once this Meet, look at the top 3 cards of any deck.",
  },
  {
    term: "The Attic",
    group: "places",
    text: "A Lucidity Landscape. Once this Meet, move 1 Dreamer 2 hexes.",
  },
  {
    term: "The Basement",
    group: "places",
    text: "A Willpower Landscape. Once this Meet, move 2 Dreambeasts 1 hex each.",
  },
  {
    term: "The Party",
    group: "places",
    text: "An Elasticity Landscape. Once this Meet, swap the Active Archetype with the next one in the deck.",
  },
  {
    term: "Tranquil Grove",
    group: "places",
    text: "A Lucidity Landscape. Once this Meet, Return 1 Psyche from the Subconscious.",
  },
];

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function playerPrimerHtml() {
  return `
    <div class="player-primer">
      <p class="player-primer-lead">2–4 Dreamers, one team. Three Archetypes are face up: make one true, Acquire it, and repeat until the goal. Then stand together on <strong>The Bed</strong> before the <strong>Dream Deck</strong> runs out — and before you forget yourself.</p>
      <div class="player-primer-grid">
        <section>
          <h3>Win and lose</h3>
          <p><strong>Win.</strong> Both quests true on any face-up Archetype, then <strong>Acquire</strong> for free. Innocent, Orphan, and Outlaw are 2 points: draw that suit's Mindstream and win a Meet against a beast of that suit. Most others are 3 and name two Landscapes. Sage, Magician, and Warrior are 4: defeat a Boss of their suit and sacrifice one Object. Reach Daydream 8, Nap 12, or Deep Sleep 24, and defeat the night's final Boss, to wake.</p>
          <p><strong>Lose.</strong> The <strong>Waking Mind</strong> runs dry (watch the Mind counter). The sixth death. The final Boss round ends before you wake.</p>
          <h3>Remember</h3>
          <p>Each beast still out at <strong>dusk</strong> Represses 1 Psyche from the Mind. <strong>Remember N</strong>: discard up to N Psyche, Return that many +1. Memory Landscapes (Tranquil Grove, Silver Mist, Day in the Life, Black Void), Remember Objects, and fixed Brights all Remember.</p>
          <h3>One formula</h3>
          <p>Each phase, one Dreamer spends <strong>1 card</strong> of that color, or <strong>1 Power Token</strong> (counts as 1 + their stat). The table shares that total. The opener acts first. <strong>Pass Turn</strong> goes clockwise. <strong>Give Turn</strong> picks someone. Leftover actions each draw 1 Psyche. Skipping a phase you never opened is free.</p>
        </section>
        <section>
          <h3>Reveal · Lucidity</h3>
          <p>Draw the Dream first. <strong>Bright</strong> costs Psyche, usually of one suit, and stays shut until that cost can be paid. On an Event whose Landscape is still Wasteland, pay 1 more Lucidity to <strong>Dream it open</strong>. <strong>Dim</strong> is free and Represses cards or Forgets Landscapes. Then flip that many Wasteland hexes, or on a Freeform Board place that many Landscapes from the Dreamscape Vault.</p>
          <h3>Explore · Elasticity</h3>
          <p>Step to an adjacent hex. The Dreamer whose turn it is is the one who walks. Stepping onto Wasteland discards 1 Psyche.</p>
          <h3>Meet · Willpower</h3>
          <p>Bosses step toward the nearest Dreamer. Spend actions to fight, <strong>Draw Mindstream</strong> (repeatable), use the hex's one action (once for the table on that hex — its suit tells you the verb), or tap a Persistent Object (once each). The Bed Dreams Onward (Reveal or place 1 Landscape). Trade is free with someone on your hex or next door.</p>
        </section>
        <section>
          <h3>The fight</h3>
          <p>Only the Dreamer on the hex plays. 1–3 Psyche. <strong>Accept</strong> pays the beast's suit: win and it joins your hand at half Power, and you draw an Object. <strong>Repress</strong> pays the next suit of the cycle — Lucidity represses Willpower, Willpower represses Elasticity, Elasticity represses Lucidity: win and it goes to the Subconscious and the reward happens. Roll that many d6. A 5 or 6 succeeds. More successes than the beast wins. Ties go to the beast. A Power Token adds a die only before the roll.</p>
          <h3>Your hand</h3>
          <p>Psyche is health and fuel. Start at 5. From round 2, draw 2. Limit 10. No Psyche when a payment is due: Death Clock +1, discard your Objects, return your tokens, draw 3 on The Bed.</p>
          <h3>Round end</h3>
          <p>Dusk: each beast still out Represses 1 Psyche from the Waking Mind. Standing on Wasteland Represses 1 from hand. The star moves clockwise. Open <strong>?</strong> for every term.</p>
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
