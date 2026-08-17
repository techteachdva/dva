/**
 * Tech Escape - central tuning file.
 *
 * Every gameplay number lives here so the game can be rebalanced for a class
 * without hunting through logic files. Distances are in world units where
 * 1 unit is roughly half a meter; the maze cell is CELL units wide.
 */

export const CELL = 4.4;          // width of one maze cell
export const WALL_H = 3.5;        // wall height
export const GRID = 21;           // default maze size; levels override it (odd number)

/**
 * Default layout knobs. A level in `meta/levels.js` overrides any of these to
 * change the SHAPE of the lab rather than just its numbers, which is what makes
 * one level feel different from the next.
 */
export const LAYOUT = {
  size: GRID,
  loopChance: 0.3,                // interior walls removed to create loops
  rooms: 4,                       // larger open work areas carved out
  roomMin: 3,
  roomMax: 5,
  trimStubs: true,
};

/**
 * Table geometry, shared by the mesh builder and the collider builder so the
 * thing you see and the thing you bump into can never drift apart.
 *
 * `bandY0`/`bandY1` are the solid slab of the tabletop. A standing body is
 * taller than bandY0 so it is blocked; a crouched body is shorter, so it slides
 * underneath. That single relationship is the whole hiding mechanic.
 */
export const TABLE = {
  topW: CELL * 0.58,              // narrow enough to squeeze past while standing
  topThickness: 0.1,
  topY: 1.06,
  legInset: CELL * 0.22,
  legW: 0.14,
  bandY0: 1.0,
  bandY1: 1.24,
};

export const PLAYER = {
  eyeHeight: 1.62,
  crouchEyeHeight: 0.74,
  // Collision body spans 0..standHeight, or 0..crouchHeight while crouched.
  // crouchHeight must stay below TABLE.bandY0 or you cannot crawl under a desk.
  standHeight: 1.75,
  crouchHeight: 0.9,
  radius: 0.42,
  walkSpeed: 4.1,
  sprintSpeed: 7.0,
  crouchSpeed: 1.65,
  accel: 26,                      // ground acceleration
  friction: 12,
  maxHealth: 4,                   // shown as cheeto bags
  hurtInvuln: 1.15,               // seconds of immunity after a hit
  // Stamina
  staminaMax: 100,
  staminaDrain: 26,               // per second while sprinting
  staminaRegen: 15,               // per second while not sprinting
  staminaRegenDelay: 0.7,         // pause before regen starts
  staminaExhaustLock: 1.6,        // forced walk after hitting zero
  // Flashlight. The light is both vision AND the only weapon against viruses,
  // so the drain is deliberately gentle while idle and expensive while burning.
  batteryMax: 100,
  batteryDrain: 2.6,              // per second while the light is on
  batteryBurnDrain: 5.5,          // EXTRA per second while burning a virus
  batteryPickup: 42,              // restored per battery
  // Footstep noise radius (how far enemies can hear you)
  noiseWalk: 7.5,
  noiseSprint: 15.5,
  noiseCrouch: 2.5,
  // Soda. A can is the answer to "I ran out of stamina in the worst hallway":
  // it refills the bar, clears the exhaustion lock, and buys a window of cheap
  // sprinting. Deliberately generous, because running away is never the wrong
  // instinct for a scared player.
  sodaBoostTime: 12,
  sodaSprintScale: 1.14,
  sodaDrainScale: 0.45,
};

export const FLASHLIGHT = {
  angle: 0.74,                    // radians (cone half-angle) — wide beam
  penumbra: 0.48,
  distance: 28,
  intensity: 68,
  color: 0xdfefff,
  // The dying-battery waver. Because the flashlight modulates the ENTIRE screen,
  // these two numbers are the difference between atmosphere and a WCAG 2.3.1
  // seizure risk: at or below 2Hz with less than a 10% luminance delta, no rate
  // of change counts as a flash at all.
  flickerHz: 2,
  flickerDepth: 0.08,             // dips to 92% brightness, never below
};

/**
 * Hard limits on anything that changes the brightness of the whole screen.
 *
 * WCAG 2.3.1 is a non-interference criterion: it applies to the entire page
 * regardless of what the rest of the game does right, and a general flash is
 * defined as a luminance change of 10% or more. Three per second is the ceiling,
 * so 334ms is the closest two opposing full-screen changes may ever be.
 *
 * These are engine limits, not preferences. They apply with every accessibility
 * toggle switched off, because a student having a seizure is not a settings
 * problem.
 */
export const FLASH_SAFETY = {
  maxFlashesPerSecond: 3,
  minGapMs: 334,
  fullScreenDeltaLimit: 0.1,      // fraction of luminance; below this it is safe
  // A single held noise frame instead of per-frame re-rolled static. Re-rolling
  // at 60fps is uncontrolled high-frequency modulation across the whole screen.
  staticHoldMs: 200,
  staticMaxOpacity: 0.25,
  // Anything faster than 3Hz has to stay inside a small region of the screen
  localFlickerMaxPx: 250,
  damageFadeMs: 250,
};

export const MOUSE = {
  radius: 0.36,
  patrolSpeed: 2.5,
  chaseSpeed: 5.35,
  turnRate: 7.5,
  sightRange: 17,
  sightAngle: 1.15,               // half-angle of vision cone
  // The mice are drawn to light: shining the flashlight at one makes it hunt.
  lightLureRange: 21,
  loseInterest: 4.4,              // seconds hunting a lost target before giving up
  damage: 1,
  attackRange: 0.95,
  attackCooldown: 1.5,
  // Short bursts of speed then a pause, which reads as "scurrying"
  dashTime: 1.1,
  restTime: 0.42,
};

export const VIRUS = {
  radius: 0.55,
  floatSpeed: 1.95,
  chaseSpeed: 3.15,
  sightRange: 22,
  hoverHeight: 1.75,
  bobAmount: 0.36,
  damage: 1,
  attackRange: 1.15,
  attackCooldown: 2.0,
  batteryDrainOnHit: 22,
  // Viruses drift through walls, so they need a speed penalty to stay fair
  inWallSpeedScale: 0.42,

  /**
   * The flashlight is the counter to viruses (mice are the opposite - light
   * attracts them). Holding the beam on a virus "burns" it: it recoils, then
   * glitches and teleports far away, then comes back. It is a reprieve, never
   * a kill.
   */
  repelRange: 14,                 // how far the beam can reach a virus
  // Recoil is deliberately gentle. A hard shove let the virus outrun the beam
  // (and phase behind a wall) before the burn could ever finish, which made the
  // mechanic feel broken. It should flinch, not flee.
  repelStrength: 3.4,
  burnCharge: 0.55,               // seconds of beam contact needed to glitch it
  burnGrace: 0.35,                // beam may slip off this long without resetting
  glitchCooldown: 3.2,            // before this virus can be glitched again
  glitchStutter: 0.45,            // jitter/stutter time before it vanishes
  glitchTeleportMinCells: 8,      // path distance of the destination
  glitchReacquire: 1.4,           // dazed wander time before it hunts again
};

export const PICKUP = {
  cheetosHeal: 1,
  radius: 1.05,                   // pickup collection radius
  bobSpeed: 2.2,
  spinSpeed: 1.4,
};

/**
 * The inventory exists so loot becomes a decision instead of a pickup sound.
 * A bag of cheetos is either health or a bomb; a disc is the only permanent
 * answer to a virus. Stacks are small on purpose - hoarding is not a strategy.
 */
export const INVENTORY = {
  order: ['cheetos', 'soda', 'antivirus'],
  max: { cheetos: 3, soda: 2, antivirus: 2 },
  // Held items are thrown from eye height with a gentle arc
  throwSpeed: 12.5,
  throwLift: 3.2,
  gravity: 15,
};

/**
 * Thrown items.
 *
 * A landed bag of hot cheetos LURES mice and sits on the floor. It does not
 * detonate on a timer. Each mouse that eats from it for long enough pops
 * individually; one bag can take out up to three mice before it is empty.
 */
export const THROWN = {
  bagLureRange: 15,               // how far a landed bag pulls mice from
  bagFeedRange: 1.15,             // close enough to be eating it
  bagEatSeconds: 1.35,            // munch time before one mouse pops
  bagMaxKills: 3,                 // mice one bag can pop before it is empty
  bagScareRadius: 6,              // mice that saw a pop flee instead
  bagScareTime: 4.5,
  bagPlayerShoveRadius: 3.4,      // unused — bags no longer blast the player
  // Anti-virus disc: flat, fast, and lethal to exactly one virus
  discSpeed: 24,
  discHitRadius: 1.5,
  discLife: 2.6,
  // Missing is not punished - the disc lands and can be picked back up
  discRecoverable: true,
  maxLive: 6,                     // hard cap on simultaneous projectiles
};

export const QUIZ = {
  questionsPerLaptop: 3,
  // Missing a question makes noise and spawns pressure but is not instant death
  wrongAnswerNoise: 22,
  wrongAnswerHealthCost: 0,
  /**
   * Terminals are the RELIEF beat: tension while you move, calm while you read.
   * Being chased through a multiple-choice question is where most players quit,
   * so on the two lower difficulties the lab genuinely stops. Only SYSTEM CRASH
   * keeps hunting you while you answer.
   *
   * 0 means the world is frozen, not merely slowed.
   */
  timeScale: 0.32,                // fallback for an unknown difficulty key
  timeScaleByDifficulty: {
    beginner: 0, chill: 0, normal: 0, questions: 0, nightmare: 0.32,
  },
};

export const DECRYPT = {
  pairs: 6,
  scans: 8,                       // wrong-pair budget
  peekTime: 0.85,                 // seconds a mismatched pair stays visible
  // The scramble is part of the same terminal visit, so it pauses the same way
  timeScale: 0.32,
  timeScaleByDifficulty: {
    beginner: 0, chill: 0, normal: 0, questions: 0, nightmare: 0.32,
  },
  // Shown on the cards
  glyphs: ['0', '1', '{', '}', '<', '>', '/', '#', '@', '&', '%', '$', '*', '+', '=', '~'],
};

/**
 * Startup "code printing" animation. It is the first thing anyone sees, so it
 * is paced to be READ: a typewriter slow enough to follow, a floor on total
 * duration, and a skip for the impatient. A returning player inside
 * `fastWindowHours` gets the short version instead of the full show.
 */
/**
 * Loading-screen pacing, in reading terms rather than taste.
 *
 * Silent reading for grades 6-8 runs 150-204 words per minute, which is about
 * 15-20 characters per second. 34 cps is comfortably faster than the quickest
 * reader in the room without being a blur to the slowest, and the dwell numbers
 * are what actually make the text readable - type speed alone never did.
 *
 * The 10 second ceiling is a hard cap the sequence measures itself against, not
 * an estimate. A loading screen that overstays is a loading screen people learn
 * to skip.
 */
export const BOOT = {
  charsPerSecond: 34,
  linePause: 1200,          // ms; floor for how long a finished line holds
  minSeconds: 6.5,          // target total, within the 6-9s window
  maxSeconds: 10,           // hard cap, enforced by elapsed-time checks
  finalHold: 1.2,           // last line stays put this long before the title
  fastCharsPerSecond: 90,   // returning the same day: brisk, still legible
  fastMinSeconds: 2.2,
  fastWindowHours: 5,
  skipHintAfter: 1.5,
};

export const PRINTER = {
  printSeconds: 14,
  // The print is the climax: enemies converge and get faster
  swarmSpeedScale: 1.22,
  swarmSpawn: 3,
};

export const CODE_PARTS = 4;

/** Periodic SEL / digital citizenship "text" notifications (Two Truths & a Lie). */
export const NOTIFY = {
  minRunSeconds: 50,       // no pings right after spawn
  minGapSeconds: 75,       // cooldown after one closes
  minInterval: 90,         // random timer floor
  maxInterval: 165,
  /** chill/normal freeze enemies; nightmare keeps hunting */
  timeScaleByDifficulty: {
    beginner: 0, chill: 0, normal: 0, questions: 0, nightmare: 1,
  },
};

/** Difficulty presets. Values multiply or replace the defaults above. */
export const DIFFICULTY = {
  beginner: {
    label: 'BEGINNER',
    mice: 2,
    viruses: 0,
    enemySpeedScale: 0.62,
    batteryDrainScale: 0.5,
    damageScale: 0.45,
    startHealth: 6,
    cheetos: 12,
    batteries: 12,
    sodas: 6,
    antivirus: 2,
    decryptScans: 12,
    sightScale: 0.7,
    escalationPerPiece: 0.15,
  },
  chill: {
    label: 'FIELD TRIP',
    mice: 3,
    viruses: 1,
    enemySpeedScale: 0.84,
    batteryDrainScale: 0.7,
    damageScale: 1,
    startHealth: 4,
    cheetos: 9,
    batteries: 10,
    sodas: 5,
    antivirus: 2,
    decryptScans: 11,
    sightScale: 0.82,
    escalationPerPiece: 0.5,
  },
  normal: {
    label: 'AFTER HOURS',
    mice: 4,
    viruses: 2,
    enemySpeedScale: 1,
    batteryDrainScale: 1,
    damageScale: 1,
    startHealth: 4,
    cheetos: 7,
    batteries: 8,
    sodas: 4,
    antivirus: 1,
    decryptScans: 8,
    sightScale: 1,
    escalationPerPiece: 1,
  },
  nightmare: {
    label: 'SYSTEM CRASH',
    mice: 6,
    viruses: 3,
    enemySpeedScale: 1.16,
    batteryDrainScale: 1.4,
    damageScale: 1,
    startHealth: 3,
    cheetos: 5,
    batteries: 6,
    sodas: 3,
    antivirus: 1,
    decryptScans: 6,
    sightScale: 1.15,
    escalationPerPiece: 1.5,
  },
  questions: {
    label: 'QUESTIONS ONLY',
    noEnemies: true,
    mice: 0,
    viruses: 0,
    enemySpeedScale: 1,
    batteryDrainScale: 0.85,
    damageScale: 0,
    startHealth: 4,
    cheetos: 6,
    batteries: 8,
    sodas: 4,
    antivirus: 1,
    decryptScans: 10,
    sightScale: 1,
    escalationPerPiece: 0,
  },
};

/** Phone / tablet tuning — pointer lock is skipped; touch UI drives play. */
export const MOBILE = {
  interactRange: 3.35,
  lookScale: 1.9,
  stickRadius: 62,
  autoQuality: 'low',
};

/** Renderer presets so old Chromebooks can still hold 60fps. */
export const QUALITY = {
  low: { scale: 0.68, maxDpr: 1, fogDensity: 0.062, extraLights: 3, antialias: false },
  medium: { scale: 0.85, maxDpr: 1.25, fogDensity: 0.055, extraLights: 5, antialias: false },
  high: { scale: 1, maxDpr: 1.5, fogDensity: 0.048, extraLights: 7, antialias: true },
};

/**
 * World colours.
 *
 * This object is MUTATED by `applyPalette()` rather than replaced, because every
 * module reads `COLORS.mouse` and friends at mesh-build time. Switching palette
 * before a run is built is therefore all it takes to recolour the whole lab.
 */
export const COLORS = {};

/**
 * There is ONE palette, and it is safe for every form of colour vision
 * deficiency. Per-CVD modes were considered and rejected: shape redundancy does
 * the same job for every player at once, and a palette nobody has to opt into
 * cannot be missed by the student who needs it.
 *
 * The old palette had only two luminance tiers, so when hue perception fails,
 * everything inside a tier collapses together. Measured against the fog colour
 * #04060b it put enemy red at 5.78 and pickup orange at 6.50 - close enough that
 * under deuteranopia and protanopia "run away" and "pick this up" became the
 * same colour, which is the worst confusion this game could produce.
 *
 * These values spread the same hues across FOUR luminance tiers, so they stay
 * separable in full greyscale:
 *
 *   enemy  #FF5C6E   6.76 : 1
 *   virus  #C79BFF   9.23 : 1
 *   loot   #FFA23A  10.12 : 1
 *   screen #7FE9FF  14.48 : 1
 *   power  #FFE566  16.07 : 1
 *   exit   #7CFFB2  16.22 : 1
 *
 * Colour is still only ever the SECOND cue. Every entity class has its own
 * silhouette in world space and its own glyph in the HUD.
 */
const PALETTES = {
  default: {
    fog: 0x04060b,
    floor: 0x171d28,
    wall: 0x232b3a,
    wallTrim: 0x2f3b4f,
    ceiling: 0x0d1119,
    table: 0x3a4152,
    tableLeg: 0x22262f,
    screenGlow: 0x7fe9ff,
    virus: 0xc79bff,
    mouse: 0xff5c6e,
    printer: 0x7fe9ff,
    exit: 0x7cffb2,
    cheeto: 0xffa23a,
    battery: 0xffe566,
    soda: 0xff8cb0,
    antivirus: 0xbfe9ff,
    key: 0xffe566,
  },
  /** Optional HUD/world mode that drops hue entirely and leans on shape alone. */
  highContrast: {
    screenGlow: 0xffffff,
    virus: 0xd8d8ff,
    mouse: 0xffffff,
    printer: 0xffffff,
    exit: 0xffffff,
    cheeto: 0xffffff,
    battery: 0xffffff,
    soda: 0xffffff,
    antivirus: 0xffffff,
    key: 0xffffff,
  },
};

/** @param {'default'|'highContrast'} name */
export function applyPalette(name) {
  Object.assign(COLORS, PALETTES.default, PALETTES[name] || null);
  return COLORS;
}

applyPalette('default');
