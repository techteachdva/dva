/**
 * Tech Escape - central tuning file.
 *
 * Every gameplay number lives here so the game can be rebalanced for a class
 * without hunting through logic files. Distances are in world units where
 * 1 unit is roughly half a meter; the maze cell is CELL units wide.
 */

export const CELL = 4.4;          // width of one maze cell
export const WALL_H = 3.5;        // wall height
export const GRID = 21;           // maze is GRID x GRID cells (odd number)

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
};

export const FLASHLIGHT = {
  angle: 0.42,                    // radians (cone half-angle)
  penumbra: 0.55,
  distance: 26,
  intensity: 34,
  color: 0xdfefff,
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

export const QUIZ = {
  questionsPerLaptop: 3,
  // Missing a question makes noise and spawns pressure but is not instant death
  wrongAnswerNoise: 22,
  wrongAnswerHealthCost: 0,
  // The world keeps moving while you are at a laptop, just slower
  timeScale: 0.32,
};

export const DECRYPT = {
  pairs: 6,
  scans: 8,                       // wrong-pair budget
  peekTime: 0.85,                 // seconds a mismatched pair stays visible
  timeScale: 0.32,
  // Shown on the cards
  glyphs: ['0', '1', '{', '}', '<', '>', '/', '#', '@', '&', '%', '$', '*', '+', '=', '~'],
};

export const PRINTER = {
  printSeconds: 14,
  // The print is the climax: enemies converge and get faster
  swarmSpeedScale: 1.22,
  swarmSpawn: 3,
};

export const CODE_PARTS = 4;

/** Difficulty presets. Values multiply or replace the defaults above. */
export const DIFFICULTY = {
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
    decryptScans: 6,
    sightScale: 1.15,
    escalationPerPiece: 1.5,
  },
};

/** Renderer presets so old Chromebooks can still hold 60fps. */
export const QUALITY = {
  low: { scale: 0.68, maxDpr: 1, fogDensity: 0.062, extraLights: 3, antialias: false },
  medium: { scale: 0.85, maxDpr: 1.25, fogDensity: 0.055, extraLights: 5, antialias: false },
  high: { scale: 1, maxDpr: 1.5, fogDensity: 0.048, extraLights: 7, antialias: true },
};

export const COLORS = {
  fog: 0x04060b,
  floor: 0x171d28,
  wall: 0x232b3a,
  wallTrim: 0x2f3b4f,
  ceiling: 0x0d1119,
  table: 0x3a4152,
  tableLeg: 0x22262f,
  screenGlow: 0x6fe8ff,
  virus: 0x9d5cff,
  mouse: 0xff3b4d,
  printer: 0x35e0ff,
  exit: 0x52ff9f,
  cheeto: 0xff5a1f,
  battery: 0xffd94a,
  key: 0xffe27a,
};
