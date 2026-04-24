// Sphincter guardians and their telegraph / attack patterns.
//
// v0.9 tuning pass ("Teeth and Bloodier Teeth"):
//   - attackDmg bumped across the board (+25-40%).
//   - `heavyDmg` added: signature big-hit damage used by HEAVY SLAM moves.
//     Heavy slams ignore lane-dodging, so they force BRACE decisions.
//   - `enrageAt` is the HP fraction at which the enemy enters phase 2:
//     faster cadence, double gouts, and +damage. Defaults to 0.5.
//   - Each guardian's `art` key is matched against a weapon's strongVs/weakVs
//     (see content/player.js) for the damage matchup multiplier.

export const ENEMIES = {
  gulletTentacle: {
    id: "gulletTentacle",
    name: "GULLET TENTACLE",
    hp: 115,
    acidInterval: [1.8, 2.6],
    attackDmg: [12, 18],            // was 8-14
    heavyDmg:  [22, 30],
    enrageAt: 0.5,
    art: "tentacle",
    color: "#7a2a8a",
    flavorHit: [
      "The tentacle WHIPS you in the ribs!",
      "A slimy coil slaps you silly!",
      "SLAP! Tentacle to the face.",
    ],
    flavorHeavy: "The tentacle COILS BACK... SLAM! No dodging that.",
    flavorCombo: "It cracks like a WHIP WHIP WHIP - three strikes!",
    flavorDeath: "The tentacle coils, twitches, and goes SPLAT.",
    flavorIntro: "A slick purple tentacle slithers out of the sphincter, hungry.",
  },
  toothBeast: {
    id: "toothBeast",
    name: "TOOTH BEAST",
    hp: 135,
    acidInterval: [1.6, 2.4],
    attackDmg: [14, 20],            // was 10-16
    heavyDmg:  [26, 34],
    enrageAt: 0.5,
    art: "teeth",
    color: "#f0e6c8",
    flavorHit: [
      "CHOMP! The tooth-maw bites down!",
      "A ring of fangs clamps on your shield!",
    ],
    flavorHeavy: "A RING OF TEETH unfurls - MEGA CHOMP incoming!",
    flavorCombo: "The fangs gnash in a triple click-click-CRUNCH!",
    flavorDeath: "Its teeth clatter to the floor like hailstones.",
    flavorIntro: "A ball of wet fangs unrolls from the wall. It clicks. Then it SNARLS.",
  },
  zombieGoblin: {
    id: "zombieGoblin",
    name: "DIGESTED GOBLIN",
    hp: 105,
    acidInterval: [2.0, 2.8],
    attackDmg: [10, 16],            // was 6-10
    heavyDmg:  [18, 26],
    enrageAt: 0.5,
    art: "zombie",
    color: "#6ea34a",
    flavorHit: [
      "The zombie goblin rakes you with half-melted claws.",
      "Groooaaar! It gums at your kneecap.",
    ],
    flavorHeavy: "It rears up and BODY SLAMS you - BRACE!",
    flavorCombo: "Claws rake in a frenzy - three fast swipes!",
    flavorDeath: "The goblin collapses. It was already dead. Now more so.",
    flavorIntro: "A half-digested goblin lurches forward, drooling bile. Classy.",
  },
  fleshHorror: {
    id: "fleshHorror",
    name: "FLESH HORROR",
    hp: 180,
    acidInterval: [1.4, 2.1],
    attackDmg: [16, 24],            // was 12-18
    heavyDmg:  [30, 42],
    enrageAt: 0.5,
    art: "flesh",
    color: "#b04050",
    flavorHit: [
      "A wet tongue of flesh slaps you across the chest!",
      "The horror GURGLES and slams you!",
    ],
    flavorHeavy: "The whole wall heaves - a FULL-BODY SLAM is coming!",
    flavorCombo: "Three tongues lash out - SLAP SLAP SLAP!",
    flavorDeath: "The horror deflates with a sad wheeze, like a meaty whoopee cushion.",
    flavorIntro: "A wall of twitching meat peels itself off the sphincter ring.",
  },
  bileElemental: {
    id: "bileElemental",
    name: "BILE ELEMENTAL",
    hp: 210,
    acidInterval: [1.2, 1.8],
    attackDmg: [18, 28],            // was 14-22
    heavyDmg:  [34, 46],
    enrageAt: 0.5,
    art: "bile",
    color: "#9bff66",
    flavorHit: [
      "A wave of searing bile washes over you!",
      "The elemental SPITS a jet of stomach juice!",
    ],
    flavorHeavy: "The whole elemental compresses into a TIDAL WAVE!",
    flavorCombo: "It spits three acid jets in rapid fire!",
    flavorDeath: "The bile elemental loses cohesion, splashing into the acid.",
    flavorIntro: "The acid lifts itself up, eyes open, and GRINS.",
  },
  // v0.15 FINAL BOSS: The Worm's Maw. Not one creature - the fight is
  // against a ROW of five molars the adventurer must knock out all at
  // the same time, while dodging / bracing the top teeth's chomps.
  // The MawBossScene runs its own multi-tooth HP pool; the fields
  // below feed flavor text and the "teeth" art tag so per-weapon
  // matchups resolve sanely (Warhammer = strongVs teeth = DEVASTATING).
  wormMaw: {
    id: "wormMaw",
    name: "THE WORM'S MAW",
    hp: 450,                  // advisory; real HP lives in the 5 teeth (90 each)
    acidInterval: [2.0, 3.0], // not used by MawBossScene - no acid this fight
    attackDmg: [16, 26],
    heavyDmg:  [28, 46],
    enrageAt: 0.4,
    art: "teeth",
    color: "#f6ecd0",
    flavorHit: [
      "A fang SNAPS down across your shoulders!",
      "A molar the size of a shield GRINDS into your side!",
      "A canine CRUNCHES your braces into scrap!",
    ],
    flavorHeavy: "THE WHOLE MAW IS CLOSING - BRACE FOR IMPACT!",
    flavorCombo: "Chomp after chomp after CHOMP!",
    flavorDeath: "The lower jaw collapses. DAYLIGHT FLOODS IN!",
    flavorIntro: "Five massive molars bar your path out of the throat. Knock them ALL out.",
  },
};
