/**
 * Somnia 38.3 — Dream Bright / Dim pairs.
 * Dim is free. Bright always costs a Repress, a Psyche discard, or a Forgotten
 * Landscape, and it stays shut until its gate is true. The toll is steep enough
 * that Dim is the right call a good share of the time.
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
      hint: "Forget 1 Landscape if an Encounter is on the Dreamscape — all Dreamers draw 2 Psyche",
      toll: { kind: "forget", count: 1 },
      gate: { kind: "encounter", label: "An Encounter is on the Dreamscape" },
      effect: "drawPsycheAll",
      params: { count: 2 },
    },
    bad: {
      label: "Glory Turns Hollow",
      hint: "Discard 1 Dream",
      effect: "discardDream",
      params: { count: 1 },
    },
  },

  injury: {
    good: {
      label: "Bind the Wound",
      hint: "Repress 1 Psyche if you hold Lucidity — you stay whole",
      toll: { kind: "repress", count: 1 },
      gate: { kind: "suit", suit: "lucidity", count: 1, label: "Hold a Lucidity Psyche" },
    },
    bad: {
      label: "Bleed Out",
      hint: "All Dreamers discard 2 Psyche",
      effect: "discardPsycheAll",
      params: { count: 2 },
    },
  },

  judgement: {
    good: {
      label: "Face the Tribunal",
      hint: "Discard 3 Psyche if you hold Willpower — the verdict holds",
      toll: { kind: "psyche", count: 3 },
      gate: { kind: "suit", suit: "willpower", count: 1, label: "Hold a Willpower Psyche" },
    },
    bad: {
      label: "Leviathan Awakens",
      hint: "Flip Leviathan onto the Dreamscape",
      effect: "flipLeviathan",
      params: {},
    },
  },

  loss: {
    good: {
      label: "Hold the Corners",
      hint: "Discard 3 Psyche if at least 3 Landscapes are awake — the map holds",
      toll: { kind: "psyche", count: 3 },
      gate: { kind: "revealed", count: 3, label: "At least 3 Landscapes are awake" },
    },
    bad: {
      label: "The Edges Unmake",
      hint: "Forget 4 Landscapes",
      effect: "forgetLandscapes",
      params: { count: 4 },
    },
  },

  misunderstanding: {
    good: {
      label: "Speak Plainly",
      hint: "Discard 2 Psyche if you hold Lucidity — the air clears",
      toll: { kind: "psyche", count: 2 },
      gate: { kind: "suit", suit: "lucidity", count: 1, label: "Hold a Lucidity Psyche" },
    },
    bad: {
      label: "Words Twist Back",
      hint: "All repress 1 Psyche",
      effect: "repressPsycheAll",
      params: { count: 1 },
    },
  },

  mortality: {
    good: {
      label: "Bargain With Death",
      hint: "Repress 2 Psyche if you hold Willpower — you buy another breath",
      toll: { kind: "repress", count: 2 },
      gate: { kind: "suit", suit: "willpower", count: 1, label: "Hold a Willpower Psyche" },
    },
    bad: {
      label: "The Reaper Takes Relics",
      hint: "Repress 3 Objects from hand",
      effect: "repressObjects",
      params: { count: 3 },
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
      hint: "Discard 3 Psyche if you hold an Object — you tear free",
      toll: { kind: "psyche", count: 3 },
      gate: { kind: "object", label: "You hold an Object" },
    },
    bad: {
      label: "Dragged Into Shadow",
      hint: "Meet is your only action this round",
      effect: "meetOnlyThisRound",
      params: {},
    },
  },

  absurdity: {
    good: {
      label: "Laugh Until It Breaks",
      hint: "Repress 2 Psyche if you hold Elasticity — draw 2 Psyche",
      toll: { kind: "repress", count: 2 },
      gate: { kind: "suit", suit: "elasticity", count: 1, label: "Hold an Elasticity Psyche" },
      effect: "drawPsyche",
      params: { count: 2 },
    },
    bad: {
      label: "Logic Collapses",
      hint: "Forget 3 Landscapes",
      effect: "forgetLandscapes",
      params: { count: 3 },
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
      hint: "Discard 2 Psyche if the Subconscious holds a card — all Dreamers Return 1",
      toll: { kind: "psyche", count: 2 },
      gate: { kind: "subconscious", label: "The Subconscious holds a card" },
      effect: "returnCardsAll",
      params: { count: 1 },
    },
    bad: {
      label: "Healing Fails",
      hint: "Discard 1 Psyche",
      effect: "discardPsyche",
      params: { count: 1 },
    },
  },

  responsibility: {
    good: {
      label: "Carry the Weight",
      hint: "Discard 3 Psyche if you hold Willpower — you own it",
      toll: { kind: "psyche", count: 3 },
      gate: { kind: "suit", suit: "willpower", count: 1, label: "Hold a Willpower Psyche" },
    },
    bad: {
      label: "Everyone Pays",
      hint: "All Dreamers discard 2 Psyche",
      effect: "discardPsycheAll",
      params: { count: 2 },
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
      hint: "Skip the next Explore Phase",
      effect: "skipNextExplore",
      params: {},
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
      hint: "Skip the next Explore Phase",
      effect: "skipNextExplore",
      params: {},
    },
  },

  transformation: {
    good: {
      label: "Choose Your Shape",
      hint: "Discard 2 Psyche if you hold Willpower — draw 1 Object",
      toll: { kind: "psyche", count: 2 },
      gate: { kind: "suit", suit: "willpower", count: 1, label: "Hold a Willpower Psyche" },
      effect: "drawObject",
      params: {},
    },
    bad: {
      label: "Something Else Emerges",
      hint: "Spawn an Encounter here",
      effect: "spawnEncounter",
      params: {},
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
      hint: "Skip the next Explore Phase",
      effect: "skipNextExplore",
      params: {},
    },
  },

  lost: {
    good: {
      label: "Find the Bed Again",
      hint: "Discard 3 Psyche if at least 3 Landscapes are awake — you keep your bearings",
      toll: { kind: "psyche", count: 3 },
      gate: { kind: "revealed", count: 3, label: "At least 3 Landscapes are awake" },
    },
    bad: {
      label: "Home Unmakes Itself",
      hint: "Forget 3 Landscapes",
      effect: "forgetLandscapes",
      params: { count: 3 },
    },
  },

  misplaced: {
    good: {
      label: "Hunt Every Pocket",
      hint: "Discard 2 Psyche if you hold an Object — your relics stay",
      toll: { kind: "psyche", count: 2 },
      gate: { kind: "object", label: "You hold an Object" },
    },
    bad: {
      label: "Relics Sink Away",
      hint: "Repress 2 Objects from hand",
      effect: "repressObjects",
      params: { count: 2 },
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

  paradox: {
    good: {
      label: "Hold Both Truths",
      hint: "Repress 1 Psyche if you hold Lucidity and Willpower — Return 2 Cards",
      toll: { kind: "repress", count: 1 },
      gate: {
        kind: "suits",
        suits: ["lucidity", "willpower"],
        label: "Hold a Lucidity Psyche and a Willpower Psyche",
      },
      effect: "returnCards",
      params: { count: 2 },
    },
    bad: {
      label: "Mind Splits",
      hint: "Repress 2 Psyche from hand",
      effect: "repressPsyche",
      params: { count: 2 },
    },
  },

  powerlessness: {
    good: {
      label: "Claim One Inch of Ground",
      hint: "Discard 3 Psyche if you hold Willpower — you hold the line",
      toll: { kind: "psyche", count: 3 },
      gate: { kind: "suit", suit: "willpower", count: 1, label: "Hold a Willpower Psyche" },
    },
    bad: {
      label: "Edges Swarm",
      hint: "Spawn Encounters on every Dreamer",
      effect: "spawnEncountersOnDreamers",
      params: {},
    },
  },

  "well-being": {
    good: {
      label: "Breathe Deep",
      hint: "Forget 1 Landscape if your Landscape is clear — all Dreamers draw 3 Psyche",
      toll: { kind: "forget", count: 1 },
      gate: { kind: "clear", label: "No Encounter stands on your Landscape" },
      effect: "drawPsycheAll",
      params: { count: 3 },
    },
    bad: {
      label: "Comfort Softens You",
      hint: "Discard 1 Dream",
      effect: "discardDream",
      params: { count: 1 },
    },
  },

  quiet: {
    good: {
      label: "Keep the Silence",
      hint: "Discard 2 Psyche if your Landscape is clear — gain 1 PT",
      toll: { kind: "psyche", count: 2 },
      gate: { kind: "clear", label: "No Encounter stands on your Landscape" },
      effect: "grantPT",
      params: { count: 1 },
    },
    bad: {
      label: "Silence Curdles",
      hint: "Repress 1 Psyche from hand",
      effect: "repressPsyche",
      params: { count: 1 },
    },
  },

  circadia: {
    good: {
      label: "Reset the Clock",
      hint: "Discard 3 Psyche if at least 4 Landscapes are awake — all Dreamers Return 2",
      toll: { kind: "psyche", count: 3 },
      gate: { kind: "revealed", count: 4, label: "At least 4 Landscapes are awake" },
      effect: "returnCardsAll",
      params: { count: 2 },
    },
    bad: {
      label: "Rhythm Fractures",
      hint: "All discard 1 Psyche",
      effect: "discardPsycheAll",
      params: { count: 1 },
    },
  },

  somnambulance: {
    good: {
      label: "Walk With Intent",
      hint: "Repress 1 Psyche if you hold Elasticity — gain 1 PT and a free Meet Action",
      toll: { kind: "repress", count: 1 },
      gate: { kind: "suit", suit: "elasticity", count: 1, label: "Hold an Elasticity Psyche" },
      steps: [
        { effect: "grantPT", params: { count: 1 } },
        { effect: "freeMeetAction", params: { count: 1 } },
      ],
    },
    bad: {
      label: "Sleepwalk Into Danger",
      hint: "Spawn an Encounter here",
      effect: "spawnEncounter",
      params: {},
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
      hint: "Discard 3 Psyche if you hold Lucidity — the residue burns",
      toll: { kind: "psyche", count: 3 },
      gate: { kind: "suit", suit: "lucidity", count: 1, label: "Hold a Lucidity Psyche" },
    },
    bad: {
      label: "Gland Overloads",
      hint: "Repress 2 Psyche from hand",
      effect: "repressPsyche",
      params: { count: 2 },
    },
  },
};

export function getDreamResolution(id) {
  return DREAM_RESOLUTIONS[id] || null;
}
