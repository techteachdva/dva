/**
 * Somnia 40.2 — Dream Bright / Dim pairs.
 * Dim is the free fallback: Repress cards, or Forget Landscapes (often the
 * pair an Archetype quest is asking for). Bright always costs Psyche, usually
 * of one suit, and pays a reward that is worth the tax.
 */

export const DREAM_RESOLUTIONS = {
  betrayal: {
    good: {
      label: "Catch the Thief",
      hint: "Discard 3 Psyche if you hold an Object — your Objects stay",
      toll: { kind: "psyche", count: 3 },
      gate: { kind: "object", label: "You hold an Object" },
    },
    bad: {
      label: "They Vanish With Everything",
      hint: "Repress 2 Objects from hand",
      effect: "repressObjects",
      params: { count: 2 },
    },
  },

  chase: {
    good: {
      label: "Outrun the Pack",
      hint: "Forget 1 Landscape if you hold Elasticity — you escape",
      toll: { kind: "forget", count: 1 },
      gate: { kind: "suit", suit: "elasticity", count: 1, label: "Hold an Elasticity Psyche" },
    },
    bad: {
      label: "Cornered",
      hint: "Spawn Encounters on every Dreamer",
      effect: "spawnEncountersOnDreamers",
      params: {},
    },
  },

  heroism: {
    good: {
      label: "Stand Over the Fallen",
      hint: "Discard 2 Willpower — every Dreamer draws 2 Psyche",
      toll: { kind: "psyche", count: 2, suit: "willpower" },
      gate: { kind: "suit", suit: "willpower", count: 2, label: "Hold 2 Willpower Psyche" },
      effect: "drawPsycheAll",
      params: { count: 2 },
    },
    bad: {
      label: "Glory Turns Hollow",
      hint: "Each Dreamer Represses 1 Object",
      effect: "repressObjectsAll",
      params: { count: 1 },
    },
  },

  injury: {
    good: {
      label: "Bind the Wound",
      hint: "Discard 3 Lucidity — draw 1 Object",
      toll: { kind: "psyche", count: 3, suit: "lucidity" },
      gate: { kind: "suit", suit: "lucidity", count: 3, label: "Hold 3 Lucidity Psyche" },
      effect: "drawObject",
      params: { count: 1 },
    },
    bad: {
      label: "Bleed Out",
      hint: "Each Dreamer Represses 2 Psyche",
      effect: "repressPsycheAll",
      params: { count: 2 },
    },
  },

  judgement: {
    good: {
      label: "Face the Tribunal",
      hint: "Each Dreamer Represses 3 Psyche — Return every Dreambeast from the Subconscious",
      toll: { kind: "repressAll", count: 3 },
      gate: { kind: "tableHand", count: 3, label: "Every Dreamer holds 3 Psyche" },
      effect: "returnAllDreambeasts",
      params: {},
    },
    bad: {
      label: "The Verdict Hunts",
      hint: "Spawn 1 Dreambeast on each Dreamer's Landscape",
      effect: "spawnEncountersOnDreamers",
      params: {},
    },
  },

  loss: {
    good: {
      label: "Hold What Remains",
      hint: "Remember: discard 4 Willpower — Return 5",
      toll: { kind: "psyche", count: 4, suit: "willpower" },
      gate: { kind: "suit", suit: "willpower", count: 4, label: "Hold 4 Willpower Psyche" },
      effect: "returnCards",
      params: { count: 5 },
    },
    bad: {
      label: "The Caregiver's Map Tears",
      hint: "Forget Sea of Teeth and Field of Broken Glass",
      effect: "forgetNamed",
      params: { ids: ["sea-of-teeth", "field-of-broken-glass"] },
    },
  },

  misunderstanding: {
    good: {
      label: "Speak Plainly",
      hint: "Discard 2 Lucidity — Reveal 1 Landscape",
      toll: { kind: "psyche", count: 2, suit: "lucidity" },
      gate: { kind: "suit", suit: "lucidity", count: 2, label: "Hold 2 Lucidity Psyche" },
      effect: "revealLandscapes",
      params: { count: 1 },
    },
    bad: {
      label: "Words Twist Back",
      hint: "Repress 3 cards from the Lucidity Mindstream",
      effect: "repressTopMindstream",
      params: { suit: "lucidity", count: 3 },
    },
  },

  mortality: {
    good: {
      label: "Bargain With Death",
      hint: "Discard 3 Willpower — every Dreamer draws 1 Psyche",
      toll: { kind: "psyche", count: 3, suit: "willpower" },
      gate: { kind: "suit", suit: "willpower", count: 3, label: "Hold 3 Willpower Psyche" },
      effect: "drawPsycheAll",
      params: { count: 1 },
    },
    bad: {
      label: "The Reaper Takes Relics",
      hint: "Each Dreamer Represses 2 Objects",
      effect: "repressObjectsAll",
      params: { count: 2 },
    },
  },

  abandonment: {
    good: {
      label: "Call Them Back",
      hint: "Discard 2 Psyche if you hold Willpower — gain a free Meet Action",
      toll: { kind: "psyche", count: 2 },
      gate: { kind: "suit", suit: "willpower", count: 1, label: "Hold a Willpower Psyche" },
      effect: "freeMeetAction",
      params: { count: 1 },
    },
    bad: {
      label: "Alone on Empty Ground",
      hint: "Meet is your only action this round",
      effect: "meetOnlyThisRound",
      params: {},
    },
  },

  abduction: {
    good: {
      label: "Break the Grip",
      hint: "Discard 2 Elasticity — gain 1 free Meet action",
      toll: { kind: "psyche", count: 2, suit: "elasticity" },
      gate: { kind: "suit", suit: "elasticity", count: 2, label: "Hold 2 Elasticity Psyche" },
      effect: "freeMeetAction",
      params: { count: 1 },
    },
    bad: {
      label: "Dragged Into the House",
      hint: "Forget The Attic and The Basement",
      effect: "forgetNamed",
      params: { ids: ["the-attic", "the-basement"] },
    },
  },

  absurdity: {
    good: {
      label: "Laugh Until It Breaks",
      hint: "Discard 3 Elasticity — draw 2 Psyche",
      toll: { kind: "psyche", count: 3, suit: "elasticity" },
      gate: { kind: "suit", suit: "elasticity", count: 3, label: "Hold 3 Elasticity Psyche" },
      effect: "drawPsyche",
      params: { count: 2 },
    },
    bad: {
      label: "The Fool's Ground Fails",
      hint: "Forget Insanity and Black Void",
      effect: "forgetNamed",
      params: { ids: ["insanity", "black-void"] },
    },
  },

  bargaining: {
    good: {
      label: "Pay the Price",
      hint: "Discard 3 Psyche if you hold a Power Token — gain 1 PT",
      toll: { kind: "psyche", count: 3 },
      gate: { kind: "token", label: "You hold a Power Token" },
      effect: "grantPT",
      params: { count: 1 },
    },
    bad: {
      label: "Deal Falls Through",
      hint: "Repress 2 Psyche from hand",
      effect: "repressPsyche",
      params: { count: 2 },
    },
  },

  recovery: {
    good: {
      label: "Sun Through the Mist",
      hint: "Remember: discard 2 Lucidity — Return 3",
      toll: { kind: "psyche", count: 2, suit: "lucidity" },
      gate: { kind: "suit", suit: "lucidity", count: 2, label: "Hold 2 Lucidity Psyche" },
      effect: "returnCards",
      params: { count: 3 },
    },
    bad: {
      label: "Healing Fails",
      hint: "Repress 3 cards from the Psyche deck",
      effect: "repressTopPsycheDeck",
      params: { count: 3 },
    },
  },

  responsibility: {
    good: {
      label: "Carry the Weight",
      hint: "Discard 3 Willpower — gain 1 Power Token",
      toll: { kind: "psyche", count: 3, suit: "willpower" },
      gate: { kind: "suit", suit: "willpower", count: 3, label: "Hold 3 Willpower Psyche" },
      effect: "grantPT",
      params: { count: 1 },
    },
    bad: {
      label: "The Lover's Night Ends",
      hint: "Forget Awards and The Party",
      effect: "forgetNamed",
      params: { ids: ["awards", "the-party"] },
    },
  },

  travel: {
    good: {
      label: "Chart the Open Road",
      hint: "Forget 1 Landscape if at least 2 Landscapes are awake — gain 1 PT",
      toll: { kind: "forget", count: 1 },
      gate: { kind: "revealed", count: 2, label: "At least 2 Landscapes are awake" },
      effect: "grantPT",
      params: { count: 1 },
    },
    bad: {
      label: "Roads Seal Shut",
      hint: "Forget 1 Landscape",
      effect: "forgetLandscapes",
      params: { count: 1 },
    },
  },

  wanderlust: {
    good: {
      label: "Walk Until Dawn",
      hint: "Forget 1 Landscape if you hold Elasticity — all Dreamers draw 2 Psyche",
      toll: { kind: "forget", count: 1 },
      gate: { kind: "suit", suit: "elasticity", count: 1, label: "Hold an Elasticity Psyche" },
      effect: "drawPsycheAll",
      params: { count: 2 },
    },
    bad: {
      label: "Feet Refuse to Move",
      hint: "Repress 1 Psyche from hand",
      effect: "repressPsyche",
      params: { count: 1 },
    },
  },

  transformation: {
    good: {
      label: "Choose Your Shape",
      hint: "Discard 2 Willpower — draw 1 Object",
      toll: { kind: "psyche", count: 2, suit: "willpower" },
      gate: { kind: "suit", suit: "willpower", count: 2, label: "Hold 2 Willpower Psyche" },
      effect: "drawObject",
      params: { count: 1 },
    },
    bad: {
      label: "The Shape You Refused",
      hint: "Repress 2 cards from the Willpower Mindstream",
      effect: "repressTopMindstream",
      params: { suit: "willpower", count: 2 },
    },
  },

  trapped: {
    good: {
      label: "Force the Latch",
      hint: "Repress 2 Psyche if you hold Willpower — you break free",
      toll: { kind: "repress", count: 2 },
      gate: { kind: "suit", suit: "willpower", count: 1, label: "Hold a Willpower Psyche" },
    },
    bad: {
      label: "Walls Close In",
      hint: "Repress 2 from the Waking Mind",
      effect: "repressTopPsycheDeck",
      params: { count: 2 },
    },
  },

  lost: {
    good: {
      label: "Find the Bed Again",
      hint: "Discard 3 Lucidity — Reveal 2 Landscapes",
      toll: { kind: "psyche", count: 3, suit: "lucidity" },
      gate: { kind: "suit", suit: "lucidity", count: 3, label: "Hold 3 Lucidity Psyche" },
      effect: "revealLandscapes",
      params: { count: 2 },
    },
    bad: {
      label: "The Explorer's Horizon Closes",
      hint: "Forget Endless Ocean and Lava",
      effect: "forgetNamed",
      params: { ids: ["endless-ocean", "lava"] },
    },
  },

  misplaced: {
    good: {
      label: "Hunt Every Pocket",
      hint: "Discard 2 Elasticity — Return 1 Object",
      toll: { kind: "psyche", count: 2, suit: "elasticity" },
      gate: { kind: "suit", suit: "elasticity", count: 2, label: "Hold 2 Elasticity Psyche" },
      effect: "returnCards",
      params: { count: 1, filter: "object" },
    },
    bad: {
      label: "Relics Sink Away",
      hint: "Each Dreamer Represses 1 Object",
      effect: "repressObjectsAll",
      params: { count: 1 },
    },
  },

  rivalry: {
    good: {
      label: "Settle It Yourself",
      hint: "Discard 2 Psyche if an Encounter is on the Dreamscape — gain a free Meet Action",
      toll: { kind: "psyche", count: 2 },
      gate: { kind: "encounter", label: "An Encounter is on the Dreamscape" },
      effect: "freeMeetAction",
      params: { count: 1 },
    },
    bad: {
      label: "Rivals Flood The Bed",
      hint: "Spawn an Encounter here",
      effect: "spawnEncounter",
      params: {},
    },
  },

  temptation: {
    good: {
      label: "Refuse the Bait",
      hint: "Repress 2 Psyche if you hold an Object — you resist",
      toll: { kind: "repress", count: 2 },
      gate: { kind: "object", label: "You hold an Object" },
    },
    bad: {
      label: "Bite Down Hard",
      hint: "Repress 2 Objects from hand",
      effect: "repressObjects",
      params: { count: 2 },
    },
  },


  powerlessness: {
    good: {
      label: "Claim One Inch of Ground",
      hint: "Discard 4 Willpower — gain 1 free Meet action",
      toll: { kind: "psyche", count: 4, suit: "willpower" },
      gate: { kind: "suit", suit: "willpower", count: 4, label: "Hold 4 Willpower Psyche" },
      effect: "freeMeetAction",
      params: { count: 1 },
    },
    bad: {
      label: "The Ruler's Roads Vanish",
      hint: "Forget Tranquil Grove and Endless Hallway",
      effect: "forgetNamed",
      params: { ids: ["tranquil-grove", "endless-hallway"] },
    },
  },

  "well-being": {
    good: {
      label: "Breathe Deep",
      hint: "Discard 2 Lucidity — every Dreamer draws 2 Psyche",
      toll: { kind: "psyche", count: 2, suit: "lucidity" },
      gate: { kind: "suit", suit: "lucidity", count: 2, label: "Hold 2 Lucidity Psyche" },
      effect: "drawPsycheAll",
      params: { count: 2 },
    },
    bad: {
      label: "Comfort Numbs the Table",
      hint: "Each Dreamer Represses 1 Psyche",
      effect: "repressPsycheAll",
      params: { count: 1 },
    },
  },

  quiet: {
    good: {
      label: "Keep the Silence",
      hint: "Discard 1 Lucidity — gain 1 Power Token",
      toll: { kind: "psyche", count: 1, suit: "lucidity" },
      gate: { kind: "suit", suit: "lucidity", count: 1, label: "Hold 1 Lucidity Psyche" },
      effect: "grantPT",
      params: { count: 1 },
    },
    bad: {
      label: "Silence Eats Motion",
      hint: "Repress 3 cards from the Elasticity Mindstream",
      effect: "repressTopMindstream",
      params: { suit: "elasticity", count: 3 },
    },
  },

  circadia: {
    good: {
      label: "Reset the Clock",
      hint: "Remember: discard 3 Lucidity — Return 4",
      toll: { kind: "psyche", count: 3, suit: "lucidity" },
      gate: { kind: "suit", suit: "lucidity", count: 3, label: "Hold 3 Lucidity Psyche" },
      effect: "returnCards",
      params: { count: 4 },
    },
    bad: {
      label: "The Clock Eats the Deck",
      hint: "Repress 4 cards from the Psyche deck",
      effect: "repressTopPsycheDeck",
      params: { count: 4 },
    },
  },

  somnambulance: {
    good: {
      label: "Walk With Intent",
      hint: "Discard 2 Elasticity — the next Explore is free",
      toll: { kind: "psyche", count: 2, suit: "elasticity" },
      gate: { kind: "suit", suit: "elasticity", count: 2, label: "Hold 2 Elasticity Psyche" },
      effect: "freeExplore",
      params: {},
    },
    bad: {
      label: "Sleepwalk Off the Path",
      hint: "Forget Candy Mountain and Scary Classroom",
      effect: "forgetNamed",
      params: { ids: ["candy-mountain", "scary-classroom"] },
    },
  },

  homeostasis: {
    good: {
      label: "Balance the Scales",
      hint: "Discard 2 Psyche if you hold Lucidity and Elasticity — all Dreamers draw 2 Psyche",
      toll: { kind: "psyche", count: 2 },
      gate: {
        kind: "suits",
        suits: ["lucidity", "elasticity"],
        label: "Hold a Lucidity Psyche and an Elasticity Psyche",
      },
      effect: "drawPsycheAll",
      params: { count: 2 },
    },
    bad: {
      label: "Equilibrium Shatters",
      hint: "All repress 1 Psyche",
      effect: "repressPsycheAll",
      params: { count: 1 },
    },
  },

  "pineal-purge": {
    good: {
      label: "Burn the Residue",
      hint: "Remember: discard 4 Lucidity — Return 5",
      toll: { kind: "psyche", count: 4, suit: "lucidity" },
      gate: { kind: "suit", suit: "lucidity", count: 4, label: "Hold 4 Lucidity Psyche" },
      effect: "returnCards",
      params: { count: 5 },
    },
    bad: {
      label: "The Third Eye Spills",
      hint: "Repress 1 card from each Mindstream",
      effect: "repressTopEachMindstream",
      params: { count: 1 },
    },
  },

  delta: {
    good: {
      label: "Ride the Slow Wave",
      hint: "Discard 2 Elasticity — every Dreamer draws 1 Psyche",
      toll: { kind: "psyche", count: 2, suit: "elasticity" },
      gate: { kind: "suit", suit: "elasticity", count: 2, label: "Hold 2 Elasticity Psyche" },
      effect: "drawPsycheAll",
      params: { count: 1 },
    },
    bad: {
      label: "The Tide Takes the Desert",
      hint: "Forget Desert and Silver Mist",
      effect: "forgetNamed",
      params: { ids: ["desert", "silver-mist"] },
    },
  },

  beta: {
    good: {
      label: "Stay Awake Inside It",
      hint: "Discard 3 Willpower — gain 1 Power Token",
      toll: { kind: "psyche", count: 3, suit: "willpower" },
      gate: { kind: "suit", suit: "willpower", count: 3, label: "Hold 3 Willpower Psyche" },
      effect: "grantPT",
      params: { count: 1 },
    },
    bad: {
      label: "Arousal Without Rest",
      hint: "Each Dreamer Represses 2 Psyche",
      effect: "repressPsycheAll",
      params: { count: 2 },
    },
  },
};

export function getDreamResolution(id) {
  return DREAM_RESOLUTIONS[id] || null;
}
