/**
 * Supplemental bidirectional graph edges between related pages.
 * Used when pages should be connected for navigation/graph but don't need
 * prominent in-page copy. Pairs are connected both ways at build time.
 */
module.exports = [
  ["/technology/", "/media-arts/"],
  ["/technology/", "/video-production/"],
  ["/technology/", "/pixel-art-museum/"],
  ["/technology/", "/qr-code-hub/"],
  ["/technology/", "/game-design/"],
  ["/media-arts/", "/video-production/"],
  ["/media-arts/", "/pixel-art-museum/"],
  ["/game-design/", "/games/"],
  ["/games/", "/diagnostic-writing/"],
  ["/pedagogy/about-mr-phil/", "/about-mr-phil/"],
  ["/pedagogy/about-mr-phil/", "/qr-code-hub/"],
  ["/notes/morphology/", "/morphology/"],
  ["/notes/peda-go-gee/", "/peda-go-gee/"],
  ["/notes/peda-go-gee/", "/pedagogy-profile/"],
  ["/5-12-methods-literature-and-reading/", "/notes/morphology/"],
  ["/5-12-methods-literature-and-reading/", "/notes/peda-go-gee/"],
  ["/escape-tech-game/", "/tech-escape/"],
  ["/purple-worm-escape/", "/worm-escape/"],
  ["/dungeon-class/", "/dungeonclass/"],
  ["/crystal-wizards/", "/crystalwizards/"],
  ["/notes/physix/", "/physix/"],
  ["/mr-phil-s-digital-garden/", "/technology/"],
  ["/mr-phil-s-digital-garden/", "/game-design/"],
  ["/mr-phil-s-digital-garden/", "/games/"],
  ["/mr-phil-s-digital-garden/", "/5-12-methods-literature-and-reading/"],
  ["/5-12-methods-literature-and-reading/", "/desiderata/"],
  ["/diagnostic-writing/", "/technology/"],
  ["/games/", "/writeflow/"],
  ["/games/", "/item-diagnostic/"],
  ["/games/", "/tech-trail/"],
  ["/writeflow/", "/diagnostic-writing/"],
  ["/item-diagnostic/", "/tech-escape/"],
  ["/tech-trail/", "/tech-escape/"],
  ["/tech-trail/", "/technology/"],
];

/**
 * Passthrough game/app routes that are not Eleventy templates but should
 * appear as nodes in the site graph.
 */
module.exports.passthroughApps = [
  { url: "/tech-escape/", title: "Tech Escape", group: "Games" },
  { url: "/worm-escape/", title: "Purple Worm Escape", group: "Games" },
  { url: "/dungeonclass/", title: "Dungeon Class", group: "Games" },
  { url: "/crystalwizards/", title: "Crystal Wizards", group: "Games" },
  { url: "/dragon-trail/", title: "Dragon Trail", group: "Games" },
  { url: "/physix/", title: "Physix", group: "Games" },
  { url: "/writeflow/", title: "WriteFlow Studio", group: "Tools" },
  { url: "/item-diagnostic/", title: "ITEM 2025 Diagnostic", group: "Tools" },
  { url: "/tech-trail/", title: "Global Tech Gauntlet", group: "Games" },
];
