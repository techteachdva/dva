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
    aka: "befriend, free insight",
    text: "One way to win a fight. Play at least one card of the Dreambeast's own suit. Win (ties go to you) and the beast leaves the map, its Accept effect resolves, you draw an Object of its suit, and a free Insight waits for you at the next Lost & Found. Rerolling the shop keeps it free.",
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
    text: "Ainmos has no allies. Accepting a Dreambeast earns a free Insight at the next Lost & Found instead.",
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
    text: "Dream 3 of every Cycle, waiting at the end of its ninth phase. A Boss lands on a random placed Landscape, then stalks one hex toward you at the start of each Meet. Each bends one rule while it stands. Defeat it to clear the Cycle and choose a Boon. The final Boss is the top of the night's ladder.",
  },
  {
    term: "Bright",
    group: "cards",
    aka: "good path toll gate",
    text: "The paid path on an Event. Bright opens when a Landscape named on the card is placed. If it is not, you may Dream it open: pay Bright's cost plus 1 Lucidity Psyche to bring that Landscape in, then take Bright. Dreams have no Bright side.",
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
    text: "If you start a Dream with no Psyche, or the Dream takes your last Psyche, or you must pay a Psyche cost with none left, you die. The Death Clock ticks. Your Objects are discarded, your Power Tokens return to the pool, and you wake on The Bed with 5 fresh Psyche. The sixth death ends the run.",
  },
  {
    term: "Death Clock",
    group: "win",
    text: "A count of deaths. It starts at 0. The sixth death ends the run at once.",
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
    text: "The free path on an Event. You can always choose it. It Represses a card or Forgets Landscapes and gives no reward. Every Dream is Dim: you endure it.",
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
    text: "Each round opens on its Dream. It is drawn for you at the start of Reveal, and you endure it before spending Lucidity.",
  },
  {
    term: "Dream",
    group: "cards",
    text: "One card from the Dream Deck, drawn at the start of each round. A Dream is a condition you survive: it Represses, Forgets, or spawns, and there is no way around it. Dream 2 of each Cycle also brings that Cycle's Mini-Boss to The Bed.",
  },
  {
    term: "Dream Deck",
    group: "win",
    aka: "clock",
    text: "The round clock, shown as the Night Bar across the top. It is laid out in Cycles of three Dreams: Dream 1, Dream 2 (the Mini-Boss), Dream 3 (the Boss). Daydream has 4 Cycles, Nap 7, Deep Sleep 10. When it runs dry, the Long Night begins.",
  },
  {
    term: "Cycle",
    group: "win",
    aka: "sleep cycle, ante, night bar, nine phases",
    text: "One sleep cycle of the night: 3 Dreams, and each Dream is one Reveal, Explore, Meet, so 9 phases in all. Dream 1 is a plain Dream. Dream 2 brings the Cycle's Mini-Boss to The Bed. Dream 3 brings the Boss, waiting at the end of phase 9. Daydream has 4 Cycles, Nap 7, Deep Sleep 10, and each Cycle's Boss is stronger than the last. Beat the Boss for a Boon; the next Dream is dawn, and you draw 3.",
  },
  {
    term: "Mini-Boss",
    group: "win",
    aka: "mini boss",
    text: "An ordinary Dreambeast that guards a Cycle. It rises on The Bed with Dream 2 of the Cycle, face up on the Night Bar from the start. Its Power is two under that Cycle's Boss (2 in the first Cycle). Beat it for +1 Power Token, before it bleeds you at dusk.",
  },
  {
    term: "Long Night",
    group: "win",
    aka: "deck empty",
    text: "When the Dream Deck runs dry and you have not woken, the night goes on. Each dusk Represses 2 more from the Waking Mind than the last (2, then 4, then 6), on top of 1 for every beast still standing. Beat the final Boss and meet the Archetype goal before you forget yourself.",
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
    text: "A creature on a Landscape. It has one Power, a suit, and a Fantasy or Nightmare kind. Dreambeasts arrive only on the Dream Deck timer: Mini-Bosses, Bosses, and a few Dreams. During Meet, fight the one on your hex. A beast left standing at dusk Represses 1 Psyche from the Waking Mind. It stays until you beat it.",
  },
  {
    term: "Dreamer",
    group: "people",
    text: "You. Choose one at the start of the run. Each has Lucidity, Elasticity, and Willpower that add up to 3, a free passive once a round, and a power that costs 1 Power Token.",
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
    text: "A Mindstream card that is not a Power Token. It names one or two Landscapes. Bright is open only while one of those Landscapes is placed. Dim Represses something or Forgets a Landscape.",
  },
  {
    term: "Explore",
    group: "round",
    aka: "explore phase",
    text: "The second phase of each Dream (phases 2, 5, and 8 of a Cycle). Spend 1 Elasticity, or 1 Power Token (that counts as 1 plus your Elasticity). You get that many steps: tap a glowing hex to move. Stepping onto Wasteland discards 1 Psyche. Each unused step draws 1 Psyche.",
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
    text: "A boss. Power 11, spawned on The Bed. Accept earns a free Insight. Repress sends it to the Subconscious, and it stays there. The Warrior's quest is to defeat Leviathan and sacrifice one Object.",
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
    text: "The third phase of each Dream (phases 3, 6, and 9 of a Cycle; the Boss waits in phase 9). At the start, each Boss steps toward you. Spend 1 Willpower, or 1 Power Token (that counts as 1 plus your Willpower). You get that many actions: fight the beast on your hex (as often as you have actions), Draw Mindstream, use your Landscape's action, or tap a Persistent Object. Each unused action draws 1 Psyche.",
  },
  {
    term: "Mindstream",
    group: "cards",
    text: "Three decks, one per suit, of Events and Power Token cards. No Dreambeasts live here. Draw Mindstream costs 1 Meet action and is repeatable. If a suit is entirely in the Subconscious, with nothing left in its deck, discard, or in play, you lose.",
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
    text: "A table rule from Somnia. Ainmos is played by one Dreamer, so every action is yours.",
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
    text: "How many dice a side rolls. A Dreambeast has one Power. Yours is the Psyche you play, plus your matching stat, affinity, suit match, your Dream Form, and up to 3 Power Tokens. Recommended Power is the beast's Power + 2. You may play less. Ties go to you.",
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
    text: "Two uses of one word. As a fight: pay the next suit around the wheel (Lucidity represses Willpower, Willpower represses Elasticity, Elasticity represses Lucidity). Win, and the beast goes to the Subconscious and you draw Psyche equal to half its Power, rounded down. As a cost: a Repressed card leaves play and sits face-up in the Subconscious. It is not in the discard until someone Returns it.",
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
    text: "The first phase of each Dream (phases 1, 4, and 7 of a Cycle). The Dream is drawn and endured. Then spend 1 Lucidity, or 1 Power Token (that counts as 1 plus your Lucidity). Each Reveal places one Landscape from the Dreamscape Vault on a glowing slot beside the dream. Each unused Reveal draws 1 Psyche.",
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
    text: "A table rule from Somnia. Ainmos is played by one Dreamer, so there is no one to trade with.",
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
    text: "How a night is lost: the Waking Mind runs dry, or the Death Clock strikes six. The Long Night makes the first one come fast.",
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
    text: "A Willpower Landscape. Once this Meet, move up to 2 Dreambeasts 1 Landscape each: lure a Boss in, or push a beast away.",
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
    text: "A Willpower Landscape. Once this Meet, move up to 2 Dreambeasts 1 Landscape each: lure a Boss in, or push a beast away.",
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

/** The short primer behind the menu spiral and the ? hub. Every term lives in the glossary. */
export function playerPrimerHtml() {
  return `
    <div class="player-primer">
      <p class="player-primer-lead">One Dreamer, one night. Build the dream, beat a ladder of Bosses, and wake by felling the <strong>final Boss</strong> with your Archetype goal met.</p>
      <div class="player-primer-grid">
        <section>
          <h3>The night</h3>
          <p>A night is 4, 7, or 10 <strong>Cycles</strong>, like a night of sleep. Each Cycle is <strong>3 Dreams</strong>, and each Dream is one Reveal, Explore, Meet: <strong>9 phases</strong>. Dream 2 brings a <strong>Mini-Boss</strong> to The Bed; Dream 3 ends on the <strong>Boss</strong>. Each Cycle's Boss is stronger than the last.</p>
          <p>Every <strong>Dream</strong> hurts. Endure it, then play the round.</p>
        </section>
        <section>
          <h3>Each round</h3>
          <p><strong>Reveal</strong>, <strong>Explore</strong>, <strong>Meet</strong>. Spend 1 card of that suit: its value plus your stat is your budget. Place Landscapes, walk, then fight.</p>
          <p><strong>Fight</strong> with 1–3 Psyche: roll that many d6, 5s and 6s succeed, ties go to you. Patterns make <strong>Dream Forms</strong> for extra dice.</p>
        </section>
        <section>
          <h3>Grow and survive</h3>
          <p>Beat a Boss for a <strong>Boon</strong>. Shop the <strong>Lost &amp; Found</strong> between rounds. Each beast left at dusk bleeds your Waking Mind.</p>
          <p>When the Dream Deck runs dry, the <strong>Long Night</strong> bleeds you harder every dusk until you wake or forget.</p>
          <p class="player-primer-more">Psyche is your health and your coin. In game, <strong>?</strong> explains every rule.</p>
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
