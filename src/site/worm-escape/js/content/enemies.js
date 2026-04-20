// Sphincter guardians and their telegraph / attack patterns.
// v0.7 tuning: HP bumped ~60% so fights last long enough for 3-5 exchanges
// (was ending in 2-3 button mashes). Acid gout cadence tightened so the
// dodge lane actually matters.
//
// Each guardian's `art` key is matched against a weapon's strongVs/weakVs
// (see content/player.js) for the damage matchup multiplier.

export const ENEMIES = {
  gulletTentacle: {
    id: "gulletTentacle",
    name: "GULLET TENTACLE",
    hp: 115,                        // was 65
    acidInterval: [1.8, 2.6],       // was 2.4-3.4
    attackDmg: [8, 14],
    art: "tentacle",
    color: "#7a2a8a",
    flavorHit: [
      "The tentacle WHIPS you in the ribs!",
      "A slimy coil slaps you silly!",
      "SLAP! Tentacle to the face.",
    ],
    flavorDeath: "The tentacle coils, twitches, and goes SPLAT.",
    flavorIntro: "A slick purple tentacle slithers out of the sphincter, hungry.",
  },
  toothBeast: {
    id: "toothBeast",
    name: "TOOTH BEAST",
    hp: 135,                        // was 80
    acidInterval: [1.6, 2.4],       // was 2.2-3.1
    attackDmg: [10, 16],
    art: "teeth",
    color: "#f0e6c8",
    flavorHit: [
      "CHOMP! The tooth-maw bites down!",
      "A ring of fangs clamps on your shield!",
    ],
    flavorDeath: "Its teeth clatter to the floor like hailstones.",
    flavorIntro: "A ball of wet fangs unrolls from the wall. It clicks. Then it SNARLS.",
  },
  zombieGoblin: {
    id: "zombieGoblin",
    name: "DIGESTED GOBLIN",
    hp: 105,                        // was 60
    acidInterval: [2.0, 2.8],       // was 2.6-3.6
    attackDmg: [6, 10],
    art: "zombie",
    color: "#6ea34a",
    flavorHit: [
      "The zombie goblin rakes you with half-melted claws.",
      "Groooaaar! It gums at your kneecap.",
    ],
    flavorDeath: "The goblin collapses. It was already dead. Now more so.",
    flavorIntro: "A half-digested goblin lurches forward, drooling bile. Classy.",
  },
  fleshHorror: {
    id: "fleshHorror",
    name: "FLESH HORROR",
    hp: 180,                        // was 110
    acidInterval: [1.4, 2.1],       // was 1.9-2.7
    attackDmg: [12, 18],
    art: "flesh",
    color: "#b04050",
    flavorHit: [
      "A wet tongue of flesh slaps you across the chest!",
      "The horror GURGLES and slams you!",
    ],
    flavorDeath: "The horror deflates with a sad wheeze, like a meaty whoopee cushion.",
    flavorIntro: "A wall of twitching meat peels itself off the sphincter ring.",
  },
  bileElemental: {
    id: "bileElemental",
    name: "BILE ELEMENTAL",
    hp: 210,                        // was 130
    acidInterval: [1.2, 1.8],       // was 1.7-2.4
    attackDmg: [14, 22],
    art: "bile",
    color: "#9bff66",
    flavorHit: [
      "A wave of searing bile washes over you!",
      "The elemental SPITS a jet of stomach juice!",
    ],
    flavorDeath: "The bile elemental loses cohesion, splashing into the acid.",
    flavorIntro: "The acid lifts itself up, eyes open, and GRINS.",
  },
};
