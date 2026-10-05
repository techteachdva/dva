/**
 * Somnia 36.0 — Mindstream Event Good/Bad resolution pairs.
 * Cost is paid in Psyche of the event's suit before resolving the chosen side.
 */

export const EVENT_RESOLUTIONS = {
  // ═══════════════════════════════════════════════════════════════════════════
  // LUCIDITY
  // ═══════════════════════════════════════════════════════════════════════════

  "fantastic-imagination": {
    polarity: "good",
    suit: "lucidity",
    cost: 2,
    good: {
      label: "Open the Sky",
      hint: "Reveal 2 Landscapes",
      effect: "revealLandscapes",
      params: { count: 2 },
    },
    bad: {
      label: "Vision Blurs",
      hint: "Forget 2 Landscapes",
      effect: "forgetLandscapes",
      params: { count: 2 },
    },
  },

  centering: {
    polarity: "good",
    suit: "lucidity",
    cost: 2,
    good: {
      label: "Breathe Together",
      hint: "All draw 1 Psyche; you gain 1 PT",
      effect: "drawPsycheAndPT",
      params: { draw: 1, pt: 1 },
    },
    bad: {
      label: "Scatter Focus",
      hint: "All discard 1 Psyche",
      effect: "discardPsycheAll",
      params: { count: 1 },
    },
  },

  "the-ascent": {
    polarity: "bad",
    suit: "lucidity",
    cost: 3,
    good: {
      label: "Climb Clear-Eyed",
      hint: "Draw 2 Psyche",
      effect: "drawPsyche",
      params: { count: 2 },
    },
    bad: {
      label: "Drop Your Peak",
      hint: "Discard your highest Psyche",
      effect: "discardHighestPsyche",
      params: {},
    },
  },

  "beyond-comprehension": {
    polarity: "bad",
    suit: "lucidity",
    cost: 5,
    good: {
      label: "Grasp the Unknowable",
      hint: "Return 4 Cards",
      effect: "returnCards",
      params: { count: 4 },
    },
    bad: {
      label: "Mind Unravels",
      hint: "Forget 4 Landscapes",
      effect: "forgetLandscapes",
      params: { count: 4 },
    },
  },

  "just-a-dream": {
    polarity: "good",
    suit: "lucidity",
    cost: 2,
    good: {
      label: "Wake Softly",
      hint: "Draw 3 Psyche",
      effect: "drawPsyche",
      params: { count: 3 },
    },
    bad: {
      label: "Clinging Nightmare",
      hint: "Repress 2 Psyche from hand",
      effect: "repressPsyche",
      params: { count: 2 },
    },
  },

  "morning-routine": {
    polarity: "good",
    suit: "lucidity",
    cost: 1,
    good: {
      label: "Coffee Clarity",
      hint: "Draw 2 Psyche",
      effect: "drawPsyche",
      params: { count: 2 },
    },
    bad: {
      label: "Snooze Again",
      hint: "Repress top Lucidity Mindstream",
      effect: "repressTopMindstream",
      params: { suit: "lucidity", count: 1 },
    },
  },

  "afternoon-nap": {
    polarity: "good",
    suit: "lucidity",
    cost: 1,
    good: {
      label: "Rest and Recall",
      hint: "Draw 1 Psyche and Return 2",
      effect: "drawPsycheAndReturn",
      params: { draw: 1, ret: 2 },
    },
    bad: {
      label: "Heavy Lids",
      hint: "Discard 1 Dream",
      effect: "discardDream",
      params: { count: 1 },
    },
  },

  "evening-plans": {
    polarity: "bad",
    suit: "lucidity",
    cost: 3,
    good: {
      label: "Map Tomorrow",
      hint: "Draw 2 Psyche",
      effect: "drawPsyche",
      params: { count: 2 },
    },
    bad: {
      label: "Plans Go Wrong",
      hint: "Spawn an Encounter here",
      effect: "spawnEncounter",
      params: {},
    },
  },

  "i-know-this-place": {
    polarity: "good",
    suit: "lucidity",
    cost: 2,
    good: {
      label: "Familiar Ground",
      hint: "Return 3 Cards",
      effect: "returnCards",
      params: { count: 3 },
    },
    bad: {
      label: "False Memory",
      hint: "Forget 2 Landscapes",
      effect: "forgetLandscapes",
      params: { count: 2 },
    },
  },

  "im-still-dreaming": {
    polarity: "bad",
    suit: "lucidity",
    cost: 2,
    good: {
      label: "Choose Your Shore",
      hint: "Move to Day in the Life or Insanity",
      effect: "moveToNamed",
      params: { ids: ["day-in-the-life", "insanity"] },
    },
    bad: {
      label: "Cannot Wake",
      hint: "Discard 2 Psyche",
      effect: "discardPsyche",
      params: { count: 2 },
    },
  },

  "a-way-out-forms": {
    polarity: "bad",
    suit: "lucidity",
    cost: 2,
    good: {
      label: "Find the Exit",
      hint: "Reveal 2 Landscapes",
      effect: "revealLandscapes",
      params: { count: 2 },
    },
    bad: {
      label: "Pay the Toll",
      hint: "Discard 1 Psyche",
      effect: "discardPsyche",
      params: { count: 1 },
    },
  },

  "voice-in-the-distance": {
    polarity: "good",
    suit: "lucidity",
    cost: 1,
    good: {
      label: "Follow the Call",
      hint: "Gain 1 PT; move to Road or Hallway",
      effect: "grantPT",
      params: { count: 1 },
    },
    bad: {
      label: "Siren Lies",
      hint: "Discard 1 Psyche",
      effect: "discardPsyche",
      params: { count: 1 },
    },
  },

  "somethings-over-there": {
    polarity: "bad",
    suit: "lucidity",
    cost: 3,
    good: {
      label: "Investigate Carefully",
      hint: "Draw 1 Object",
      effect: "drawObject",
      params: {},
    },
    bad: {
      label: "It Notices You",
      hint: "Spawn an Encounter here",
      effect: "spawnEncounter",
      params: {},
    },
  },

  "a-face-appears": {
    polarity: "bad",
    suit: "lucidity",
    cost: 3,
    good: {
      label: "Meet Its Gaze",
      hint: "Return 3 Cards",
      effect: "returnCards",
      params: { count: 3 },
    },
    bad: {
      label: "Face Emerges",
      hint: "Spawn an Encounter here",
      effect: "spawnEncounter",
      params: {},
    },
  },

  "mist-swirls": {
    polarity: "bad",
    suit: "lucidity",
    cost: 2,
    good: {
      label: "Part the Mist",
      hint: "Reveal 2 Landscapes",
      effect: "revealLandscapes",
      params: { count: 2 },
    },
    bad: {
      label: "Dream Dissolves",
      hint: "Discard 1 Dream",
      effect: "discardDream",
      params: { count: 1 },
    },
  },

  transported: {
    polarity: "good",
    suit: "lucidity",
    cost: 2,
    good: {
      label: "Ride the Coordinates",
      hint: "Draw 2 Psyche",
      effect: "drawPsyche",
      params: { count: 2 },
    },
    bad: {
      label: "Wrong Coordinates",
      hint: "Repress 1 Psyche from hand",
      effect: "repressPsyche",
      params: { count: 1 },
    },
  },

  lightness: {
    polarity: "good",
    suit: "lucidity",
    cost: 2,
    good: {
      label: "Share the Lift",
      hint: "All Dreamers draw 1 Psyche",
      effect: "drawPsycheAll",
      params: { count: 1 },
    },
    bad: {
      label: "Gravity Returns",
      hint: "All repress 1 Psyche",
      effect: "repressPsycheAll",
      params: { count: 1 },
    },
  },

  "the-council-of-the-years": {
    polarity: "bad",
    suit: "lucidity",
    cost: 4,
    good: {
      label: "Keep One Verdict",
      hint: "Draw 2 Psyche",
      effect: "drawPsyche",
      params: { count: 2 },
    },
    bad: {
      label: "Judgment Falls",
      hint: "Repress 3 Psyche from hand",
      effect: "repressPsyche",
      params: { count: 3 },
    },
  },

  sublimation: {
    polarity: "good",
    suit: "lucidity",
    cost: 3,
    good: {
      label: "Refine the Wound",
      hint: "Return 2 Cards and gain 1 PT",
      effect: "returnAndPT",
      params: { ret: 2, pt: 1 },
    },
    bad: {
      label: "Bottled Pressure",
      hint: "Discard 2 Psyche",
      effect: "discardPsyche",
      params: { count: 2 },
    },
  },

  serenity: {
    polarity: "good",
    suit: "lucidity",
    cost: 3,
    good: {
      label: "Enter Stillness",
      hint: "Draw 3 Psyche and gain 1 PT",
      effect: "drawPsycheAndPT",
      params: { draw: 3, pt: 1 },
    },
    bad: {
      label: "Peace Shatters",
      hint: "Discard 2 Psyche",
      effect: "discardPsyche",
      params: { count: 2 },
    },
  },

  "harmonic-resonance": {
    polarity: "good",
    suit: "lucidity",
    cost: 2,
    good: {
      label: "Strike the Chord",
      hint: "Draw 1 Psyche and Return 2",
      effect: "drawPsycheAndReturn",
      params: { draw: 1, ret: 2 },
    },
    bad: {
      label: "Dissonance",
      hint: "Discard 1 Psyche",
      effect: "discardPsyche",
      params: { count: 1 },
    },
  },

  denial: {
    polarity: "good",
    suit: "lucidity",
    cost: 3,
    good: {
      label: "Refuse the Wound",
      hint: "Return 4 Cards",
      effect: "returnCards",
      params: { count: 4 },
    },
    bad: {
      label: "Truth Intrudes",
      hint: "Repress 2 Psyche from hand",
      effect: "repressPsyche",
      params: { count: 2 },
    },
  },

  "keep-it-together": {
    polarity: "bad",
    suit: "lucidity",
    cost: 3,
    good: {
      label: "Grip Your Relics",
      hint: "Draw 1 Object",
      effect: "drawObject",
      params: {},
    },
    bad: {
      label: "Drop Everything",
      hint: "Repress 2 Objects from hand",
      effect: "repressObjects",
      params: { count: 2 },
    },
  },

  metamorphosis: {
    polarity: "bad",
    suit: "lucidity",
    cost: 5,
    good: {
      label: "Shape the Change",
      hint: "Return 3 Cards",
      effect: "returnCards",
      params: { count: 3 },
    },
    bad: {
      label: "World Warps",
      hint: "Forget 4 Landscapes; repress top 2 Psyche",
      effect: "forgetLandscapes",
      params: { count: 4 },
    },
  },

  contagion: {
    polarity: "bad",
    suit: "lucidity",
    cost: 4,
    good: {
      label: "Quarantine Mind",
      hint: "Draw 2 Psyche",
      effect: "drawPsyche",
      params: { count: 2 },
    },
    bad: {
      label: "Infection Spreads",
      hint: "Repress top 2 of Psyche deck",
      effect: "repressTopPsycheDeck",
      params: { count: 2 },
    },
  },

  "forgot-clothes": {
    polarity: "bad",
    suit: "lucidity",
    cost: 2,
    good: {
      label: "Dash Anywhere",
      hint: "Draw 1 Psyche",
      effect: "drawPsyche",
      params: { count: 1 },
    },
    bad: {
      label: "Exposed Shame",
      hint: "Repress 1 Psyche from hand",
      effect: "repressPsyche",
      params: { count: 1 },
    },
  },

  "wrong-classroom": {
    polarity: "bad",
    suit: "lucidity",
    cost: 3,
    good: {
      label: "Slip Out Quietly",
      hint: "Return 2 Cards",
      effect: "returnCards",
      params: { count: 2 },
    },
    bad: {
      label: "Called On",
      hint: "Discard 2 Psyche",
      effect: "discardPsyche",
      params: { count: 2 },
    },
  },

  "everyones-laughing": {
    polarity: "bad",
    suit: "lucidity",
    cost: 3,
    good: {
      label: "Laugh With Them",
      hint: "Gain 1 PT",
      effect: "grantPT",
      params: { count: 1 },
    },
    bad: {
      label: "Punchline Cuts",
      hint: "Repress 2 Objects",
      effect: "repressObjects",
      params: { count: 2 },
    },
  },

  "pop-quiz": {
    polarity: "good",
    suit: "lucidity",
    cost: 2,
    good: {
      label: "Ace the Guess",
      hint: "Draw 1 Psyche and Return 3",
      effect: "drawPsycheAndReturn",
      params: { draw: 1, ret: 3 },
    },
    bad: {
      label: "Blank Stare",
      hint: "Discard 1 Psyche",
      effect: "discardPsyche",
      params: { count: 1 },
    },
  },

  revolving: {
    polarity: "good",
    suit: "lucidity",
    cost: 2,
    good: {
      label: "Spin Free",
      hint: "Draw 3 Psyche",
      effect: "drawPsyche",
      params: { count: 3 },
    },
    bad: {
      label: "Vertigo Takes Hold",
      hint: "Repress 1 Psyche from hand",
      effect: "repressPsyche",
      params: { count: 1 },
    },
  },

  blooming: {
    polarity: "good",
    suit: "lucidity",
    cost: 3,
    good: {
      label: "Rearrange the Garden",
      hint: "Return 2 Cards",
      effect: "returnCards",
      params: { count: 2 },
    },
    bad: {
      label: "Roots Claim You",
      hint: "Repress 1 Psyche from hand",
      effect: "repressPsyche",
      params: { count: 1 },
    },
  },

  "break-out": {
    polarity: "good",
    suit: "lucidity",
    cost: 3,
    good: {
      label: "Match and Escape",
      hint: "Return 4 Cards",
      effect: "returnCards",
      params: { count: 4 },
    },
    bad: {
      label: "Lock Clicks Shut",
      hint: "Discard 1 Psyche",
      effect: "discardPsyche",
      params: { count: 1 },
    },
  },

  "sacred-geometry": {
    polarity: "good",
    suit: "lucidity",
    cost: 3,
    good: {
      label: "Trace the Pattern",
      hint: "Return 4 Cards",
      effect: "returnCards",
      params: { count: 4 },
    },
    bad: {
      label: "Pattern Fractures",
      hint: "Forget 2 Landscapes",
      effect: "forgetLandscapes",
      params: { count: 2 },
    },
  },

  "caught-cheating": {
    polarity: "bad",
    suit: "lucidity",
    cost: 3,
    good: {
      label: "Lucky Matching Hand",
      hint: "Return 4 Cards",
      effect: "returnCards",
      params: { count: 4 },
    },
    bad: {
      label: "Detention",
      hint: "Discard 2 Psyche",
      effect: "discardPsyche",
      params: { count: 2 },
    },
  },

  "feel-deal-heal": {
    polarity: "bad",
    suit: "lucidity",
    cost: 4,
    good: {
      label: "Deal and Heal",
      hint: "Draw 3 Psyche",
      effect: "drawPsyche",
      params: { count: 3 },
    },
    bad: {
      label: "Leviathan Stirs",
      hint: "Discard your highest Psyche",
      effect: "discardHighestPsyche",
      params: {},
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ELASTICITY
  // ═══════════════════════════════════════════════════════════════════════════

  "a-shining-wind": {
    polarity: "good",
    suit: "elasticity",
    cost: 2,
    good: {
      label: "Ride the Gale",
      hint: "Gain 2 PT; move to Mist or Ocean",
      effect: "grantPT",
      params: { count: 2 },
    },
    bad: {
      label: "Wind Scours You",
      hint: "Discard 1 Psyche",
      effect: "discardPsyche",
      params: { count: 1 },
    },
  },

  "a-million-reflections": {
    polarity: "good",
    suit: "elasticity",
    cost: 3,
    good: {
      label: "Choose Which Echoes",
      hint: "Return 4 Cards",
      effect: "returnCards",
      params: { count: 4 },
    },
    bad: {
      label: "Shatter the Mirrors",
      hint: "Forget 2 Landscapes",
      effect: "forgetLandscapes",
      params: { count: 2 },
    },
  },

  "this-will-have-to-do": {
    polarity: "good",
    suit: "elasticity",
    cost: 1,
    good: {
      label: "Make Do",
      hint: "Draw 2 Psyche",
      effect: "drawPsyche",
      params: { count: 2 },
    },
    bad: {
      label: "Not Enough",
      hint: "Discard 1 Psyche",
      effect: "discardPsyche",
      params: { count: 1 },
    },
  },

  "is-that-music": {
    polarity: "good",
    suit: "elasticity",
    cost: 2,
    good: {
      label: "Dance Toward It",
      hint: "Gain 1 PT; move to Awards or Party",
      effect: "grantPT",
      params: { count: 1 },
    },
    bad: {
      label: "Discordant Note",
      hint: "Discard 1 Psyche",
      effect: "discardPsyche",
      params: { count: 1 },
    },
  },

  "roof-dive": {
    polarity: "good",
    suit: "elasticity",
    cost: 2,
    good: {
      label: "Leap Into Joy",
      hint: "Move to Sky, Party, or Candy Mountain",
      effect: "moveToNamed",
      params: { ids: ["sky", "the-party", "candy-mountain"] },
    },
    bad: {
      label: "Miss the Landing",
      hint: "Discard 2 Psyche",
      effect: "discardPsyche",
      params: { count: 2 },
    },
  },

  "cotton-candy": {
    polarity: "good",
    suit: "elasticity",
    cost: 2,
    good: {
      label: "Sugar Rush",
      hint: "Draw 3 Psyche; move to Candy Mountain",
      effect: "drawPsyche",
      params: { count: 3 },
    },
    bad: {
      label: "Sticky Trap",
      hint: "Discard 1 Psyche",
      effect: "discardPsyche",
      params: { count: 1 },
    },
  },

  insulation: {
    polarity: "good",
    suit: "elasticity",
    cost: 1,
    good: {
      label: "Wrap Yourself Soft",
      hint: "Gain 1 PT",
      effect: "grantPT",
      params: { count: 1 },
    },
    bad: {
      label: "Smothered",
      hint: "Discard 1 Dream",
      effect: "discardDream",
      params: { count: 1 },
    },
  },

  "shimmering-slivers": {
    polarity: "good",
    suit: "elasticity",
    cost: 2,
    good: {
      label: "Gather the Slivers",
      hint: "Draw 1 Object",
      effect: "drawObject",
      params: {},
    },
    bad: {
      label: "Cuts Everywhere",
      hint: "Discard 1 Psyche",
      effect: "discardPsyche",
      params: { count: 1 },
    },
  },

  diamonds: {
    polarity: "good",
    suit: "elasticity",
    cost: 3,
    good: {
      label: "Cut and Polish",
      hint: "Return 4 Cards and gain 1 PT",
      effect: "returnAndPT",
      params: { ret: 4, pt: 1 },
    },
    bad: {
      label: "Pressure Cracks",
      hint: "Discard 2 Psyche",
      effect: "discardPsyche",
      params: { count: 2 },
    },
  },

  "desert-oasis": {
    polarity: "good",
    suit: "elasticity",
    cost: 3,
    good: {
      label: "Drink Deep",
      hint: "Draw 3 Psyche and gain 1 PT",
      effect: "drawPsycheAndPT",
      params: { draw: 3, pt: 1 },
    },
    bad: {
      label: "Oasis Was Sand",
      hint: "Discard 2 Psyche",
      effect: "discardPsyche",
      params: { count: 2 },
    },
  },

  "need-water": {
    polarity: "bad",
    suit: "elasticity",
    cost: 3,
    good: {
      label: "Find a Spring",
      hint: "Draw 2 Psyche",
      effect: "drawPsyche",
      params: { count: 2 },
    },
    bad: {
      label: "Thirst Claims Will",
      hint: "Discard 1 Willpower Psyche",
      effect: "discardSuitPsyche",
      params: { suit: "willpower", count: 1 },
    },
  },

  "into-the-next": {
    polarity: "good",
    suit: "elasticity",
    cost: 2,
    good: {
      label: "Step Through",
      hint: "All draw 1; free Meet Action",
      effect: "freeMeetAction",
      params: { count: 1 },
    },
    bad: {
      label: "Doorway Snaps Shut",
      hint: "Repress top Elasticity Mindstream",
      effect: "repressTopMindstream",
      params: { suit: "elasticity", count: 1 },
    },
  },

  "broken-toys": {
    polarity: "bad",
    suit: "elasticity",
    cost: 2,
    good: {
      label: "Mend What Remains",
      hint: "Draw 2 Psyche",
      effect: "drawPsyche",
      params: { count: 2 },
    },
    bad: {
      label: "Playthings Shatter",
      hint: "Discard 2 Psyche",
      effect: "discardPsyche",
      params: { count: 2 },
    },
  },

  flooded: {
    polarity: "good",
    suit: "elasticity",
    cost: 2,
    good: {
      label: "Ride the Flood",
      hint: "Move to Ocean, House, or Suburbia",
      effect: "moveToNamed",
      params: { ids: ["endless-ocean", "house", "suburbia"] },
    },
    bad: {
      label: "Swept Under",
      hint: "Discard 1 Psyche",
      effect: "discardPsyche",
      params: { count: 1 },
    },
  },

  "running-somewhere": {
    polarity: "good",
    suit: "elasticity",
    cost: 2,
    good: {
      label: "Sprint and Recover",
      hint: "Draw 1 Psyche and Return 2",
      effect: "drawPsycheAndReturn",
      params: { draw: 1, ret: 2 },
    },
    bad: {
      label: "Nowhere to Run",
      hint: "Discard 1 Psyche",
      effect: "discardPsyche",
      params: { count: 1 },
    },
  },

  "portal-another-world": {
    polarity: "good",
    suit: "elasticity",
    cost: 2,
    good: {
      label: "Cross the Threshold",
      hint: "Draw 2 Psyche",
      effect: "drawPsyche",
      params: { count: 2 },
    },
    bad: {
      label: "Portal Severs",
      hint: "Repress 1 Psyche from hand",
      effect: "repressPsyche",
      params: { count: 1 },
    },
  },

  "giant-animated-pile": {
    polarity: "bad",
    suit: "elasticity",
    cost: 3,
    good: {
      label: "Bargain With the Pile",
      hint: "Draw 1 Object",
      effect: "drawObject",
      params: {},
    },
    bad: {
      label: "It Lurches Alive",
      hint: "Spawn an Encounter here",
      effect: "spawnEncounter",
      params: {},
    },
  },

  "dust-bunnies": {
    polarity: "bad",
    suit: "elasticity",
    cost: 2,
    good: {
      label: "Find Lost Treasure",
      hint: "Draw 1 Object",
      effect: "drawObject",
      params: {},
    },
    bad: {
      label: "They Nibble Memory",
      hint: "Repress 1 Psyche from hand",
      effect: "repressPsyche",
      params: { count: 1 },
    },
  },

  "lost-treasure": {
    polarity: "good",
    suit: "elasticity",
    cost: 3,
    good: {
      label: "Claim the Hoard",
      hint: "Draw 3 Psyche and Return 1",
      effect: "drawPsycheAndReturn",
      params: { draw: 3, ret: 1 },
    },
    bad: {
      label: "Chest Was Empty",
      hint: "Discard 1 Psyche",
      effect: "discardPsyche",
      params: { count: 1 },
    },
  },

  "wrong-door": {
    polarity: "bad",
    suit: "elasticity",
    cost: 4,
    good: {
      label: "Back Out Fast",
      hint: "Return 2 Cards",
      effect: "returnCards",
      params: { count: 2 },
    },
    bad: {
      label: "Beasts Pour Through",
      hint: "Discard 4 Psyche",
      effect: "discardPsyche",
      params: { count: 4 },
    },
  },

  "hidden-in-the-walls": {
    polarity: "bad",
    suit: "elasticity",
    cost: 4,
    good: {
      label: "Listen Without Opening",
      hint: "Draw 2 Psyche",
      effect: "drawPsyche",
      params: { count: 2 },
    },
    bad: {
      label: "Something Scrapes Out",
      hint: "Spawn an Encounter here",
      effect: "spawnEncounter",
      params: {},
    },
  },

  "deeper-darker": {
    polarity: "bad",
    suit: "elasticity",
    cost: 3,
    good: {
      label: "Bring a Light",
      hint: "Draw 1 Object",
      effect: "drawObject",
      params: {},
    },
    bad: {
      label: "Darkness Bites",
      hint: "Discard 1 Psyche",
      effect: "discardPsyche",
      params: { count: 1 },
    },
  },

  "undulating-floor": {
    polarity: "good",
    suit: "elasticity",
    cost: 2,
    good: {
      label: "Surf the Wave",
      hint: "Gain 1 PT",
      effect: "grantPT",
      params: { count: 1 },
    },
    bad: {
      label: "Floor Swallows Footing",
      hint: "Discard 1 Psyche",
      effect: "discardPsyche",
      params: { count: 1 },
    },
  },

  "the-right-door": {
    polarity: "good",
    suit: "elasticity",
    cost: 2,
    good: {
      label: "Step Through Correctly",
      hint: "Draw 3 Psyche",
      effect: "drawPsyche",
      params: { count: 3 },
    },
    bad: {
      label: "Almost — Not Quite",
      hint: "Discard 1 Psyche",
      effect: "discardPsyche",
      params: { count: 1 },
    },
  },

  "just-out-of-reach": {
    polarity: "good",
    suit: "elasticity",
    cost: 2,
    good: {
      label: "Stretch and Grasp",
      hint: "Return 3 Cards",
      effect: "returnCards",
      params: { count: 3 },
    },
    bad: {
      label: "Fingers Slip",
      hint: "Discard 1 Psyche",
      effect: "discardPsyche",
      params: { count: 1 },
    },
  },

  splinters: {
    polarity: "bad",
    suit: "elasticity",
    cost: 3,
    good: {
      label: "Pull Them Free",
      hint: "Draw 1 Object",
      effect: "drawObject",
      params: {},
    },
    bad: {
      label: "Wood Draws Blood",
      hint: "Discard 2 Psyche",
      effect: "discardPsyche",
      params: { count: 2 },
    },
  },

  "freezing-night": {
    polarity: "good",
    suit: "elasticity",
    cost: 2,
    good: {
      label: "Warm by Will",
      hint: "Draw 2 Psyche",
      effect: "drawPsyche",
      params: { count: 2 },
    },
    bad: {
      label: "Frostbite",
      hint: "Discard 1 Object",
      effect: "repressObjects",
      params: { count: 1 },
    },
  },

  "searing-day": {
    polarity: "bad",
    suit: "elasticity",
    cost: 2,
    good: {
      label: "Endure the Glare",
      hint: "Draw 2 Psyche",
      effect: "drawPsyche",
      params: { count: 2 },
    },
    bad: {
      label: "Sun Burns Clean",
      hint: "Discard 2 Psyche",
      effect: "discardPsyche",
      params: { count: 2 },
    },
  },

  "a-mirage": {
    polarity: "bad",
    suit: "elasticity",
    cost: 4,
    good: {
      label: "See Through It",
      hint: "Reveal 2 Landscapes",
      effect: "revealLandscapes",
      params: { count: 2 },
    },
    bad: {
      label: "Mirage Becomes Real",
      hint: "Spawn an Encounter here",
      effect: "spawnEncounter",
      params: {},
    },
  },

  sandstorm: {
    polarity: "bad",
    suit: "elasticity",
    cost: 3,
    good: {
      label: "Shelter in Sanctum",
      hint: "Move to Grove or Inner Sanctum",
      effect: "moveToNamed",
      params: { ids: ["tranquil-grove", "inner-sanctum"] },
    },
    bad: {
      label: "Sand Strips You Bare",
      hint: "Discard 1 Object or Psyche",
      effect: "discardPsyche",
      params: { count: 1 },
    },
  },

  friendship: {
    polarity: "good",
    suit: "elasticity",
    cost: 2,
    good: {
      label: "Walk Together",
      hint: "Reveal 2 Landscapes; free Meet",
      effect: "revealLandscapes",
      params: { count: 2 },
    },
    bad: {
      label: "Friendship Frays",
      hint: "All discard 1 Psyche",
      effect: "discardPsycheAll",
      params: { count: 1 },
    },
  },

  "get-up": {
    polarity: "good",
    suit: "elasticity",
    cost: 2,
    good: {
      label: "Climb to the Attic",
      hint: "Free Meet Action; move to Attic",
      effect: "freeMeetAction",
      params: { count: 1 },
    },
    bad: {
      label: "Stumble on the Stairs",
      hint: "Discard 1 Psyche",
      effect: "discardPsyche",
      params: { count: 1 },
    },
  },

  "get-down": {
    polarity: "good",
    suit: "elasticity",
    cost: 2,
    good: {
      label: "Descend to Basement",
      hint: "Free Meet Action; move to Basement",
      effect: "freeMeetAction",
      params: { count: 1 },
    },
    bad: {
      label: "Miss a Step",
      hint: "Discard 1 Psyche",
      effect: "discardPsyche",
      params: { count: 1 },
    },
  },

  bronze: {
    polarity: "bad",
    suit: "elasticity",
    cost: 3,
    good: {
      label: "Polish the Medal",
      hint: "Return 2 Cards",
      effect: "returnCards",
      params: { count: 2 },
    },
    bad: {
      label: "Third Place Stings",
      hint: "Spawn an Encounter here",
      effect: "spawnEncounter",
      params: {},
    },
  },

  silver: {
    polarity: "bad",
    suit: "elasticity",
    cost: 4,
    good: {
      label: "Almost Gold",
      hint: "Draw 2 Psyche and gain 1 PT",
      effect: "drawPsycheAndPT",
      params: { draw: 2, pt: 1 },
    },
    bad: {
      label: "Forced Acceptance",
      hint: "Spawn an Encounter here",
      effect: "spawnEncounter",
      params: {},
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // WILLPOWER
  // ═══════════════════════════════════════════════════════════════════════════

  "a-thousand-daggers": {
    polarity: "bad",
    suit: "willpower",
    cost: 5,
    good: {
      label: "Steel Your Skin",
      hint: "Return 3 Cards",
      effect: "returnCards",
      params: { count: 3 },
    },
    bad: {
      label: "Blades Find Everyone",
      hint: "All repress 2 Psyche",
      effect: "repressPsycheAll",
      params: { count: 2 },
    },
  },

  "flashing-lights": {
    polarity: "good",
    suit: "willpower",
    cost: 2,
    good: {
      label: "Seize the Neon",
      hint: "Draw 2 Psyche and gain 2 PT",
      effect: "drawPsycheAndPT",
      params: { draw: 2, pt: 2 },
    },
    bad: {
      label: "Blinded",
      hint: "Discard 1 Psyche",
      effect: "discardPsyche",
      params: { count: 1 },
    },
  },

  "rhythm-of-the-night": {
    polarity: "good",
    suit: "willpower",
    cost: 2,
    good: {
      label: "Keep the Beat",
      hint: "All Dreamers draw 2 Psyche",
      effect: "drawPsycheAll",
      params: { count: 2 },
    },
    bad: {
      label: "Drop the Object",
      hint: "Repress 1 Object",
      effect: "repressObjects",
      params: { count: 1 },
    },
  },

  "roiling-doom": {
    polarity: "bad",
    suit: "willpower",
    cost: 4,
    good: {
      label: "Stand in the Storm",
      hint: "Draw 2 Psyche",
      effect: "drawPsyche",
      params: { count: 2 },
    },
    bad: {
      label: "Doom Descends",
      hint: "Discard 2 Psyche; spawn Encounter",
      effect: "spawnEncounter",
      params: {},
    },
  },

  "perilous-pinnacle": {
    polarity: "bad",
    suit: "willpower",
    cost: 4,
    good: {
      label: "Hold the Peak",
      hint: "Gain 2 PT",
      effect: "grantPT",
      params: { count: 2 },
    },
    bad: {
      label: "Lose Your Grip",
      hint: "Repress 2 Objects",
      effect: "repressObjects",
      params: { count: 2 },
    },
  },

  "cooling-obsidian": {
    polarity: "good",
    suit: "willpower",
    cost: 2,
    good: {
      label: "Harden to Stone",
      hint: "Move to Ocean or Broken Glass",
      effect: "moveToNamed",
      params: { ids: ["endless-ocean", "field-of-broken-glass"] },
    },
    bad: {
      label: "Crack Under Heat",
      hint: "Discard 1 Psyche",
      effect: "discardPsyche",
      params: { count: 1 },
    },
  },

  "from-the-fire": {
    polarity: "good",
    suit: "willpower",
    cost: 3,
    good: {
      label: "Rise Tempered",
      hint: "Return 4 Cards",
      effect: "returnCards",
      params: { count: 4 },
    },
    bad: {
      label: "Ash in the Lungs",
      hint: "Discard 2 Psyche",
      effect: "discardPsyche",
      params: { count: 2 },
    },
  },

  "a-sacrifice": {
    polarity: "good",
    suit: "willpower",
    cost: 3,
    good: {
      label: "Offer and Receive",
      hint: "Return 3 Cards",
      effect: "returnCards",
      params: { count: 3 },
    },
    bad: {
      label: "The Altar Takes",
      hint: "Repress 1 Object",
      effect: "repressObjects",
      params: { count: 1 },
    },
  },

  "heating-up": {
    polarity: "bad",
    suit: "willpower",
    cost: 4,
    good: {
      label: "Channel the Heat",
      hint: "Draw Psyche; free Meet",
      effect: "freeMeetAction",
      params: { count: 1 },
    },
    bad: {
      label: "Boil Over",
      hint: "Spawn an Encounter here",
      effect: "spawnEncounter",
      params: {},
    },
  },

  "no-thing": {
    polarity: "bad",
    suit: "willpower",
    cost: 3,
    good: {
      label: "Hold Onto Something",
      hint: "Draw 2 Psyche",
      effect: "drawPsyche",
      params: { count: 2 },
    },
    bad: {
      label: "Dreams Vanish",
      hint: "Discard 3 Dreams",
      effect: "discardDream",
      params: { count: 3 },
    },
  },

  "no-time": {
    polarity: "bad",
    suit: "willpower",
    cost: 3,
    good: {
      label: "Buy a Moment",
      hint: "Return 2 Cards",
      effect: "returnCards",
      params: { count: 2 },
    },
    bad: {
      label: "Clock Runs Out",
      hint: "All repress 1 Object",
      effect: "repressObjects",
      params: { count: 1 },
    },
  },

  "no-where": {
    polarity: "bad",
    suit: "willpower",
    cost: 5,
    good: {
      label: "Map the Void",
      hint: "All draw 2 Psyche",
      effect: "drawPsycheAll",
      params: { count: 2 },
    },
    bad: {
      label: "Places Unmake",
      hint: "Forget 4 Landscapes",
      effect: "forgetLandscapes",
      params: { count: 4 },
    },
  },

  "choppy-water": {
    polarity: "good",
    suit: "willpower",
    cost: 2,
    good: {
      label: "Ride the Chop",
      hint: "Draw 1 Psyche and Return 4",
      effect: "drawPsycheAndReturn",
      params: { draw: 1, ret: 4 },
    },
    bad: {
      label: "Swallow Seawater",
      hint: "Discard 1 Willpower Psyche",
      effect: "discardSuitPsyche",
      params: { suit: "willpower", count: 1 },
    },
  },

  "big-wave": {
    polarity: "good",
    suit: "willpower",
    cost: 2,
    good: {
      label: "Surf the Crest",
      hint: "Draw 1 Psyche and Return 3",
      effect: "drawPsycheAndReturn",
      params: { draw: 1, ret: 3 },
    },
    bad: {
      label: "Wiped Out",
      hint: "Discard your highest Psyche",
      effect: "discardHighestPsyche",
      params: {},
    },
  },

  fog: {
    polarity: "good",
    suit: "willpower",
    cost: 2,
    good: {
      label: "Enter the Mist",
      hint: "Draw 2 Psyche; move to Silver Mist",
      effect: "drawPsyche",
      params: { count: 2 },
    },
    bad: {
      label: "Lost in Grey",
      hint: "Discard 1 Willpower Psyche",
      effect: "discardSuitPsyche",
      params: { suit: "willpower", count: 1 },
    },
  },

  "clear-as-crystal": {
    polarity: "good",
    suit: "willpower",
    cost: 2,
    good: {
      label: "See Through",
      hint: "Draw 3 Psyche and Return 2",
      effect: "drawPsycheAndReturn",
      params: { draw: 3, ret: 2 },
    },
    bad: {
      label: "Crystal Shatters",
      hint: "Discard 1 Psyche",
      effect: "discardPsyche",
      params: { count: 1 },
    },
  },

  "a-mouth-rises": {
    polarity: "bad",
    suit: "willpower",
    cost: 5,
    good: {
      label: "Speak First",
      hint: "Return 3 Cards and gain 1 PT",
      effect: "returnAndPT",
      params: { ret: 3, pt: 1 },
    },
    bad: {
      label: "Leviathan Awakens",
      hint: "Forget 3 Landscapes",
      effect: "forgetLandscapes",
      params: { count: 3 },
    },
  },

  whirlpool: {
    polarity: "bad",
    suit: "willpower",
    cost: 4,
    good: {
      label: "Steer Toward Shore",
      hint: "Move toward Endless Ocean",
      effect: "moveToNamed",
      params: { ids: ["endless-ocean"] },
    },
    bad: {
      label: "Pulled Under",
      hint: "Discard 2 Psyche",
      effect: "discardPsyche",
      params: { count: 2 },
    },
  },

  "syrup-lake": {
    polarity: "good",
    suit: "willpower",
    cost: 1,
    good: {
      label: "Wade Sweetly",
      hint: "Draw 1 Psyche and gain 1 PT",
      effect: "drawPsycheAndPT",
      params: { draw: 1, pt: 1 },
    },
    bad: {
      label: "Stuck Fast",
      hint: "Discard 1 Psyche",
      effect: "discardPsyche",
      params: { count: 1 },
    },
  },

  "peppermint-peak": {
    polarity: "good",
    suit: "willpower",
    cost: 2,
    good: {
      label: "Summit the Mint",
      hint: "Draw 3 Psyche",
      effect: "drawPsyche",
      params: { count: 3 },
    },
    bad: {
      label: "Tongue Burns Cold",
      hint: "Discard 1 Willpower Psyche",
      effect: "discardSuitPsyche",
      params: { suit: "willpower", count: 1 },
    },
  },

  "licorice-bridge": {
    polarity: "bad",
    suit: "willpower",
    cost: 2,
    good: {
      label: "Cross Safely",
      hint: "Draw 2 Psyche",
      effect: "drawPsyche",
      params: { count: 2 },
    },
    bad: {
      label: "Bridge Sags",
      hint: "Discard 1 Dream",
      effect: "discardDream",
      params: { count: 1 },
    },
  },

  "chocolate-mines": {
    polarity: "good",
    suit: "willpower",
    cost: 2,
    good: {
      label: "Strike a Vein",
      hint: "Draw 3 Psyche",
      effect: "drawPsyche",
      params: { count: 3 },
    },
    bad: {
      label: "Cave-In",
      hint: "Repress 1 Psyche from hand",
      effect: "repressPsyche",
      params: { count: 1 },
    },
  },

  "marshmallow-clouds": {
    polarity: "good",
    suit: "willpower",
    cost: 3,
    good: {
      label: "Float Soft Power",
      hint: "Gain 2 PT",
      effect: "grantPT",
      params: { count: 2 },
    },
    bad: {
      label: "Clouds Dissolve",
      hint: "All discard 1 Psyche",
      effect: "discardPsycheAll",
      params: { count: 1 },
    },
  },

  "jaw-shark": {
    polarity: "bad",
    suit: "willpower",
    cost: 4,
    good: {
      label: "Feed It Willingly",
      hint: "Draw 2 Psyche",
      effect: "drawPsyche",
      params: { count: 2 },
    },
    bad: {
      label: "Jaws Close",
      hint: "Discard 2 Willpower Psyche",
      effect: "discardSuitPsyche",
      params: { suit: "willpower", count: 2 },
    },
  },

  "ivory-calm": {
    polarity: "good",
    suit: "willpower",
    cost: 2,
    good: {
      label: "Settle Into White",
      hint: "Draw 1 Psyche and Return 3",
      effect: "drawPsycheAndReturn",
      params: { draw: 1, ret: 3 },
    },
    bad: {
      label: "Calm Breaks",
      hint: "Discard 1 Psyche",
      effect: "discardPsyche",
      params: { count: 1 },
    },
  },

  "tartar-algae": {
    polarity: "good",
    suit: "willpower",
    cost: 2,
    good: {
      label: "Harvest the Bloom",
      hint: "Draw 2 Psyche and Return 2",
      effect: "drawPsycheAndReturn",
      params: { draw: 2, ret: 2 },
    },
    bad: {
      label: "Choke on Green",
      hint: "Discard 1 Psyche",
      effect: "discardPsyche",
      params: { count: 1 },
    },
  },

  "caramel-forest": {
    polarity: "bad",
    suit: "willpower",
    cost: 3,
    good: {
      label: "Taste the Trees",
      hint: "Draw 2 Psyche",
      effect: "drawPsyche",
      params: { count: 2 },
    },
    bad: {
      label: "Something Hunts Between",
      hint: "Spawn an Encounter here",
      effect: "spawnEncounter",
      params: {},
    },
  },

  "chewed-to-dust": {
    polarity: "bad",
    suit: "willpower",
    cost: 4,
    good: {
      label: "Spit Out the Grit",
      hint: "Return 2 Cards",
      effect: "returnCards",
      params: { count: 2 },
    },
    bad: {
      label: "Ground to Nothing",
      hint: "Discard 3 Psyche or 1 Dream",
      effect: "discardPsyche",
      params: { count: 3 },
    },
  },

  "gap-in-the-teeth": {
    polarity: "good",
    suit: "willpower",
    cost: 2,
    good: {
      label: "Slip Through the Gap",
      hint: "Draw 2 Psyche; move to Candy or Ocean",
      effect: "drawPsyche",
      params: { count: 2 },
    },
    bad: {
      label: "Bite Closes",
      hint: "Discard 1 Psyche",
      effect: "discardPsyche",
      params: { count: 1 },
    },
  },

  "golden-tooth": {
    polarity: "good",
    suit: "willpower",
    cost: 2,
    good: {
      label: "Pull the Prize",
      hint: "Draw 1 Object",
      effect: "drawObject",
      params: {},
    },
    bad: {
      label: "Filling Falls Out",
      hint: "Discard 1 Psyche",
      effect: "discardPsyche",
      params: { count: 1 },
    },
  },

  "who-is-there": {
    polarity: "bad",
    suit: "willpower",
    cost: 3,
    good: {
      label: "Answer the Door",
      hint: "Free Meet Action",
      effect: "freeMeetAction",
      params: { count: 1 },
    },
    bad: {
      label: "Knock Knock — Horror",
      hint: "Spawn an Encounter here",
      effect: "spawnEncounter",
      params: {},
    },
  },

  "no-why": {
    polarity: "good",
    suit: "willpower",
    cost: 3,
    good: {
      label: "Accept Without Reason",
      hint: "All draw 1 Psyche",
      effect: "drawPsycheAll",
      params: { count: 1 },
    },
    bad: {
      label: "Reason Demands Cost",
      hint: "All discard 1 Psyche",
      effect: "discardPsycheAll",
      params: { count: 1 },
    },
  },

  "no-one": {
    polarity: "good",
    suit: "willpower",
    cost: 3,
    good: {
      label: "Empty the Room",
      hint: "Return 3 Cards",
      effect: "returnCards",
      params: { count: 3 },
    },
    bad: {
      label: "Loneliness Bites",
      hint: "Repress 2 Psyche from hand",
      effect: "repressPsyche",
      params: { count: 2 },
    },
  },

  "i-remember": {
    polarity: "good",
    suit: "willpower",
    cost: 2,
    good: {
      label: "Memory Floods Back",
      hint: "Return 3 Cards",
      effect: "returnCards",
      params: { count: 3 },
    },
    bad: {
      label: "Memory Cuts",
      hint: "Discard 1 Psyche",
      effect: "discardPsyche",
      params: { count: 1 },
    },
  },

  "dream-for-landscapes": {
    polarity: "bad",
    suit: "willpower",
    cost: 3,
    good: {
      label: "Pay Dreams for Maps",
      hint: "Reveal 2 Landscapes",
      effect: "revealLandscapes",
      params: { count: 2 },
    },
    bad: {
      label: "Toll of Dreams",
      hint: "Discard 2 Dreams",
      effect: "discardDream",
      params: { count: 2 },
    },
  },
};

export function getEventResolution(id) {
  return EVENT_RESOLUTIONS[id] || null;
}

export function eventResolutionCost(id) {
  const r = getEventResolution(id);
  return r ? { suit: r.suit, cost: r.cost } : null;
}
