/**
 * Somnia 36.0 — Dream Good/Bad resolution pairs.
 * Dreams are mini-quests: strive (good) or suffer the consequence (bad).
 */

export const DREAM_RESOLUTIONS = {
  betrayal: {
    good: {
      label: "Catch the Thief",
      hint: "Discard 3 Psyche to keep your Objects",
      effect: "discardPsyche",
      params: { count: 3 },
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
      hint: "Discard 2 Psyche to escape",
      effect: "discardPsyche",
      params: { count: 2 },
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
      hint: "All Dreamers draw 2 Psyche",
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
      hint: "Discard 2 Psyche to stay whole",
      effect: "discardPsyche",
      params: { count: 2 },
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
      hint: "Discard 4 Psyche to stay the verdict",
      effect: "discardPsyche",
      params: { count: 4 },
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
      hint: "Discard 3 Psyche to keep the map",
      effect: "discardPsyche",
      params: { count: 3 },
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
      hint: "Discard 2 Psyche to clear the air",
      effect: "discardPsyche",
      params: { count: 2 },
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
      hint: "Discard 5 Psyche to buy another breath",
      effect: "discardPsyche",
      params: { count: 5 },
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
      hint: "Discard 2 Psyche; free Meet Action",
      steps: [
        { effect: "discardPsyche", params: { count: 2 } },
        { effect: "freeMeetAction", params: { count: 1 } },
      ],
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
      hint: "Discard 3 Psyche to tear free",
      effect: "discardPsyche",
      params: { count: 3 },
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
      hint: "Draw 2 Psyche",
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
      hint: "Discard 4 Psyche; gain 1 PT",
      steps: [
        { effect: "discardPsyche", params: { count: 4 } },
        { effect: "grantPT", params: { count: 1 } },
      ],
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
      hint: "All Dreamers Return 1 Card",
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
      hint: "Discard 3 Psyche and own it",
      effect: "discardPsyche",
      params: { count: 3 },
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
      hint: "Gain 1 PT; discard 1 Psyche",
      steps: [
        { effect: "grantPT", params: { count: 1 } },
        { effect: "discardPsyche", params: { count: 1 } },
      ],
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
      hint: "All Dreamers draw 2 Psyche",
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
      hint: "Draw 1 Object",
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
      hint: "Discard 3 Psyche to break free",
      effect: "discardPsyche",
      params: { count: 3 },
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
      hint: "Discard 3 Psyche to keep your bearings",
      effect: "discardPsyche",
      params: { count: 3 },
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
      hint: "Discard 2 Psyche to save your relics",
      effect: "discardPsyche",
      params: { count: 2 },
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
      hint: "Discard 2 Psyche; free Meet Action",
      steps: [
        { effect: "discardPsyche", params: { count: 2 } },
        { effect: "freeMeetAction", params: { count: 1 } },
      ],
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
      hint: "Discard 2 Psyche to resist",
      effect: "discardPsyche",
      params: { count: 2 },
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
      hint: "Return 2 Cards",
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
      hint: "Discard 3 Psyche to hold the line",
      effect: "discardPsyche",
      params: { count: 3 },
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
      hint: "All Dreamers draw 3 Psyche",
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
      hint: "Gain 1 PT",
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

  // ── Final Recurrence choice dreams ────────────────────────────────────────

  circadia: {
    good: {
      label: "Reset the Clock",
      hint: "All Dreamers Return 2 Cards",
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
      hint: "Gain 1 PT; free Meet Action",
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
      hint: "All Dreamers draw 2 Psyche",
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
      hint: "Discard 3 Psyche to cleanse",
      effect: "discardPsyche",
      params: { count: 3 },
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
