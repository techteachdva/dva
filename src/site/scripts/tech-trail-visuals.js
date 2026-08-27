/**
 * Global Tech Gauntlet — scene zones, portraits, and golden-rule metadata.
 */
(() => {
  "use strict";

  const BASE = "/tech-trail/images";

  const ZONES = {
    acme: { bg: `${BASE}/scenes/scene-acme-briefing.png`, tint: "rgba(196, 30, 58, 0.42)", mood: "briefing" },
    design: { bg: `${BASE}/scenes/scene-design-lab.png`, tint: "rgba(146, 64, 14, 0.38)", mood: "warm" },
    simulation: { bg: `${BASE}/scenes/scene-design-lab.png`, tint: "rgba(37, 99, 235, 0.32)", mood: "cool" },
    arena: { bg: `${BASE}/scenes/scene-gauntlet-arena.png`, tint: "rgba(196, 30, 58, 0.45)", mood: "epic" },
    security: { bg: `${BASE}/scenes/scene-data-vault.png`, tint: "rgba(6, 78, 59, 0.42)", mood: "tense" },
    network: { bg: `${BASE}/scenes/scene-network-closet.png`, tint: "rgba(30, 64, 175, 0.38)", mood: "tech" },
    library: { bg: `${BASE}/scenes/scene-sources-library.png`, tint: "rgba(120, 53, 15, 0.35)", mood: "scholar" },
    bridge: { bg: `${BASE}/scenes/scene-collaboration-bridge.png`, tint: "rgba(146, 64, 14, 0.4)", mood: "dramatic" },
    fleet: { bg: `${BASE}/scenes/scene-network-closet.png`, tint: "rgba(59, 130, 246, 0.35)", mood: "tech" },
    bureau: { bg: `${BASE}/scenes/scene-design-lab.png`, tint: "rgba(124, 58, 237, 0.32)", mood: "reflect" },
    code: { bg: `${BASE}/scenes/scene-network-closet.png`, tint: "rgba(16, 185, 129, 0.32)", mood: "code" },
    nasa: { bg: `${BASE}/scenes/scene-acme-briefing.png`, tint: "rgba(30, 58, 138, 0.45)", mood: "precision" },
    vault: { bg: `${BASE}/scenes/scene-data-vault.png`, tint: "rgba(113, 63, 18, 0.38)", mood: "legal" },
    mirrors: { bg: `${BASE}/scenes/scene-sources-library.png`, tint: "rgba(88, 28, 135, 0.4)", mood: "mirror" },
    media: { bg: `${BASE}/scenes/scene-sources-library.png`, tint: "rgba(190, 18, 60, 0.35)", mood: "media" },
  };

  const NODE_ZONE = {
    start: "acme",
    victory: "acme",
    mentor_ending: "acme",
    design_lab: "design",
    define_win: "design",
    define_fail: "design",
    prepare_phase: "simulation",
    prepare_win: "simulation",
    try_phase: "arena",
    try_win: "arena",
    try_fail: "arena",
    final_trial: "arena",
    debug_scene: "fleet",
    debug_win: "fleet",
    debug_fail: "fleet",
    reflect_phase: "bureau",
    reflect_win: "bureau",
    code_bay: "code",
    code_win: "code",
    code_fail: "code",
    network_closet: "network",
    network_win: "network",
    network_fail: "network",
    sources_library: "library",
    sources_win: "library",
    sources_fail: "library",
    ip_chamber: "vault",
    ip_win: "vault",
    ip_fail: "vault",
    collaboration_bridge: "bridge",
    collab_win: "bridge",
    collab_fail: "bridge",
    trajectory_scene: "nasa",
    trajectory_win: "nasa",
    trajectory_fail: "nasa",
    data_vault: "security",
    privacy_win: "security",
    privacy_fail: "security",
    password_temple: "security",
    password_win: "security",
    password_fail: "security",
    footprint_scene: "mirrors",
    footprint_win: "mirrors",
    footprint_fail: "mirrors",
    media_chamber: "media",
    media_win: "media",
    media_fail: "media",
    ai_ethics: "design",
    ai_ethics_win: "design",
    ai_ethics_fail: "design",
    hardware_graveyard: "network",
    hardware_win: "network",
    hardware_fail: "network",
    open_source: "code",
    open_source_win: "code",
    open_source_fail: "code",
    bias_unit: "nasa",
    bias_win: "nasa",
    bias_fail: "nasa",
    data_detective: "security",
    detective_win: "security",
    detective_fail: "security",
    lovelace_deep: "design",
    lovelace_deep_win: "design",
    turing_deep: "security",
    turing_deep_win: "security",
    hopper_deep: "fleet",
    hopper_deep_win: "fleet",
    johnson_deep: "library",
    johnson_deep_win: "library",
  };

  const PORTRAITS = {
    lovelace: `${BASE}/heroes/hero-lovelace.png`,
    turing: `${BASE}/heroes/hero-turing-stylized.png`,
    babbage: `${BASE}/heroes/hero-babbage.png`,
    wright: `${BASE}/heroes/hero-wright.png`,
    meier: `${BASE}/heroes/hero-meier.png`,
    campbell: `${BASE}/heroes/hero-campbell.png`,
    crawford: `${BASE}/heroes/hero-crawford.png`,
    conway: `${BASE}/heroes/hero-conway.png`,
    hopper: `${BASE}/heroes/hero-hopper.png`,
    johnson: `${BASE}/heroes/hero-johnson.png`,
    guide: `${BASE}/heroes/hero-guide.png`,
  };

  const GOLDEN_RULES = [
    {
      n: 1,
      short: "Design for people",
      icon: "🎯",
      detail: "Technology should help real humans — clear interfaces, accessibility, and empathy beat flashy tricks.",
    },
    {
      n: 2,
      short: "Protect data",
      icon: "🛡️",
      detail: "Treat personal information like treasure. Share only what is needed and know who can see it.",
    },
    {
      n: 3,
      short: "Guard your login",
      icon: "🔑",
      detail: "Strong passwords and careful sign-in habits keep your accounts and identity safe.",
    },
    {
      n: 4,
      short: "Think before you post",
      icon: "✋",
      detail: "Pause before you publish. Words and images online can spread fast and last a long time.",
    },
    {
      n: 5,
      short: "Decode media",
      icon: "🔍",
      detail: "Ask who made a message, what they want you to believe, and what evidence supports it.",
    },
  ];

  function zoneForNode(nodeId) {
    return ZONES[NODE_ZONE[nodeId] || "acme"];
  }

  window.TechTrailVisuals = { ZONES, NODE_ZONE, PORTRAITS, GOLDEN_RULES, zoneForNode };
})();
