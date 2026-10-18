/**
 * Ainmos Dreams. Each card does one thing when it is drawn.
 * Most are a small hindrance. A few (Well Being, Recovery, Transformation) are a small relief.
 * A phase lock skips the other phases and opens the one phase that remains.
 */

export const DREAM_RESOLUTIONS = {
  abandonment: {
    bad: {
      label: "Alone on Empty Ground",
      hint: "Meet only",
      effect: "onlyPhase",
      params: { phase: "Meet" },
    },
  },

  trapped: {
    bad: {
      label: "No Way Out",
      hint: "Reveal only",
      effect: "onlyPhase",
      params: { phase: "Reveal" },
    },
  },

  chase: {
    bad: {
      label: "Nowhere to Run",
      hint: "Explore only",
      effect: "onlyPhase",
      params: { phase: "Explore" },
    },
  },

  powerlessness: {
    bad: {
      label: "Forms Go Dark",
      hint: "Dream Forms add no dice",
      effect: "blockForms",
      params: { forms: "all" },
    },
  },

  absurdity: {
    bad: {
      label: "The Pattern Breaks",
      hint: "Echo and Ladder add no dice",
      effect: "blockForms",
      params: { forms: ["echo", "ladder"] },
    },
  },

  somnambulance: {
    bad: {
      label: "Half the Pattern",
      hint: "Trinity and Chord add no dice",
      effect: "blockForms",
      params: { forms: ["trinity", "chord"] },
    },
  },

  "pineal-purge": {
    bad: {
      label: "The Third Eye Spills",
      hint: "Trifecta and Unity add no dice",
      effect: "blockForms",
      params: { forms: ["trifecta", "unity"] },
    },
  },

  injury: {
    bad: {
      label: "Bleed Out",
      hint: "Repress 2 Psyche from your hand",
      effect: "repressPsycheAll",
      params: { count: 2 },
    },
  },

  bargaining: {
    bad: {
      label: "The Deal Takes",
      hint: "Repress 2 Psyche from your hand",
      effect: "repressPsycheAll",
      params: { count: 2 },
    },
  },

  beta: {
    bad: {
      label: "Restless Hands",
      hint: "Repress 1 Psyche from your hand",
      effect: "repressPsycheAll",
      params: { count: 1 },
    },
  },

  temptation: {
    bad: {
      label: "Let It Go",
      hint: "Repress 1 Psyche from your hand",
      effect: "repressPsycheAll",
      params: { count: 1 },
    },
  },

  misunderstanding: {
    bad: {
      label: "Words Twist Back",
      hint: "Repress the top 3 of the Waking Mind",
      effect: "repressTopPsycheDeck",
      params: { count: 3 },
    },
  },

  quiet: {
    bad: {
      label: "Silence Eats Motion",
      hint: "Repress the top of the Waking Mind",
      effect: "repressTopPsycheDeck",
      params: { count: 1 },
    },
  },

  abduction: {
    bad: {
      label: "Dragged Under",
      hint: "Repress the top 2 of the Waking Mind",
      effect: "repressTopPsycheDeck",
      params: { count: 2 },
    },
  },

  delta: {
    bad: {
      label: "The Tide Takes",
      hint: "Repress the top 2 of the Waking Mind",
      effect: "repressTopPsycheDeck",
      params: { count: 2 },
    },
  },

  circadia: {
    bad: {
      label: "The Clock Eats the Deck",
      hint: "Repress the top 4 of the Waking Mind",
      effect: "repressTopPsycheDeck",
      params: { count: 4 },
    },
  },

  mortality: {
    bad: {
      label: "The Reaper's Toll",
      hint: "Discard 2 Psyche, then draw 1",
      effect: "discardPsycheDrawPsyche",
      params: { discard: 2, draw: 1 },
    },
  },

  homeostasis: {
    bad: {
      label: "Equilibrium Shatters",
      hint: "Discard 2 Psyche, then draw 1",
      effect: "discardPsycheDrawPsyche",
      params: { discard: 2, draw: 1 },
    },
  },

  wanderlust: {
    bad: {
      label: "Feet Refuse",
      hint: "Discard 2 Psyche, then draw 1",
      effect: "discardPsycheDrawPsyche",
      params: { discard: 2, draw: 1 },
    },
  },

  betrayal: {
    bad: {
      label: "Pay the Pack",
      hint: "Discard Psyche equal to Dreambeasts in play",
      effect: "discardPsycheForBeasts",
      params: {},
    },
  },

  heroism: {
    bad: {
      label: "Glory Turns Hollow",
      hint: "Discard 1 Object",
      effect: "repressObjectsAll",
      params: { count: 1 },
    },
  },

  misplaced: {
    bad: {
      label: "Relics Sink Away",
      hint: "Discard 1 Object",
      effect: "repressObjectsAll",
      params: { count: 1 },
    },
  },

  judgement: {
    bad: {
      label: "The Verdict Hunts",
      hint: "A Dreambeast appears on your Landscape",
      effect: "spawnEncounter",
      params: {},
    },
  },

  rivalry: {
    bad: {
      label: "Rivals Flood the Bed",
      hint: "A Dreambeast appears on your Landscape",
      effect: "spawnEncounter",
      params: {},
    },
  },

  loss: {
    bad: {
      label: "Too Clear to Keep",
      hint: "Discard Psyche above your Lucidity",
      effect: "discardPsycheAboveStat",
      params: { stat: "lucidity" },
    },
  },

  lost: {
    bad: {
      label: "Too Quick to Keep",
      hint: "Discard Psyche above your Elasticity",
      effect: "discardPsycheAboveStat",
      params: { stat: "elasticity" },
    },
  },

  responsibility: {
    bad: {
      label: "Too Strong to Keep",
      hint: "Discard Psyche above your Willpower",
      effect: "discardPsycheAboveStat",
      params: { stat: "willpower" },
    },
  },

  travel: {
    bad: {
      label: "Roads Seal Shut",
      hint: "Forget 1 Landscape",
      effect: "forgetLandscapes",
      params: { count: 1 },
    },
  },

  transformation: {
    bad: {
      label: "A New Shape",
      hint: "Discard 1 Psyche, then draw 1 Object",
      effect: "discardPsycheDrawObject",
      params: { discard: 1, draw: 1 },
    },
  },

  recovery: {
    bad: {
      label: "Sun Through the Mist",
      hint: "Draw 3 Psyche",
      effect: "drawPsycheAll",
      params: { count: 3 },
    },
  },

  "well-being": {
    bad: {
      label: "Breathe Deep",
      hint: "Draw 3 Psyche",
      effect: "drawPsycheAll",
      params: { count: 3 },
    },
  },
};

export function getDreamResolution(id) {
  return DREAM_RESOLUTIONS[id] || null;
}
