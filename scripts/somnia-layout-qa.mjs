/**
 * Headless QA for Somnia device/form detection and compact layout metrics.
 */

globalThis.localStorage = {
  getItem() { return null; },
  setItem() {},
  removeItem() {},
};

function installWindow({
  w,
  h,
  touch = 0,
  coarse = false,
  hover = true,
  dpr = 1,
} = {}) {
  const matchMedia = (query) => ({
    matches: query.includes("pointer: coarse")
      ? coarse
      : query.includes("hover: hover")
        ? hover
        : false,
    addEventListener() {},
  });

  globalThis.window = {
    innerWidth: w,
    innerHeight: h,
    devicePixelRatio: dpr,
    matchMedia,
    addEventListener() {},
    visualViewport: { width: w, height: h },
  };
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { maxTouchPoints: touch, standalone: false },
  });
  globalThis.window.navigator = globalThis.navigator;
  globalThis.document = {
    documentElement: { dataset: {}, style: { setProperty() {}, removeProperty() {} } },
    body: { classList: { toggle() {}, contains() { return false; }, add() {}, remove() {} } },
    querySelector() { return null; },
    getElementById() { return null; },
  };
}

installWindow({ w: 1280, h: 800, touch: 0, dpr: 1 });

const { detectDeviceMode, getCapabilityProfile } = await import("../src/site/somnia/js/device-mode.js");
const { computeMenuViewportMetrics, computeViewportMetrics } = await import("../src/site/somnia/js/panel-layout.js");

const failures = [];

function assert(name, cond, detail) {
  if (cond) {
    console.log(`  ok  ${name}`);
    return;
  }
  failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
  console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
}

function caseStudy(title, viewport, expect) {
  console.log(`\n${title}`);
  installWindow(viewport);
  const profile = getCapabilityProfile();
  const device = detectDeviceMode();
  const menu = computeMenuViewportMetrics();
  const play = computeViewportMetrics();

  if (expect.form) assert(`form=${expect.form}`, profile.form === expect.form, profile.form);
  if (expect.device) assert(`device=${expect.device}`, device === expect.device, device);
  if (expect.menuLayout) {
    assert(`menuLayout=${expect.menuLayout}`, menu.menuLayout === expect.menuLayout, menu.menuLayout);
  }
  if (expect.noMenuOverflow) {
    assert("menu type scale is compact", menu.setupTypeScale <= 1.2, String(menu.setupTypeScale));
  }
  if (expect.sidebarHidden) {
    assert("sidebar hidden", play.sidebarW === 0, String(play.sidebarW));
  }
  if (expect.sidebarNarrow) {
    assert("sidebar narrow", play.sidebarW > 0 && play.sidebarW <= 228, String(play.sidebarW));
  }
  if (expect.boardMajority) {
    const board = play.h - play.chromeH - play.handH;
    assert("board taller than hand", board > play.handH, `board=${board} hand=${play.handH}`);
  }
}

caseStudy("iPhone 14 portrait", { w: 390, h: 844, touch: 5, coarse: true, hover: false, dpr: 3 }, {
  form: "phone",
  device: "mobile",
  menuLayout: "stack",
  noMenuOverflow: true,
  sidebarHidden: true,
  boardMajority: true,
});

caseStudy("iPhone 14 landscape", { w: 844, h: 390, touch: 5, coarse: true, hover: false, dpr: 3 }, {
  form: "phone",
  device: "mobile",
  menuLayout: "stack",
  sidebarHidden: true,
});

caseStudy("iPad 11 landscape", { w: 1180, h: 820, touch: 5, coarse: true, hover: false, dpr: 2 }, {
  form: "tablet",
  device: "tablet",
  menuLayout: "split",
  noMenuOverflow: true,
  sidebarNarrow: true,
  boardMajority: true,
});

caseStudy("iPad 11 portrait", { w: 820, h: 1180, touch: 5, coarse: true, hover: false, dpr: 2 }, {
  form: "tablet",
  device: "tablet",
  menuLayout: "stack",
  sidebarHidden: true,
  boardMajority: true,
});

caseStudy("iPad Pro 12.9 landscape", { w: 1366, h: 1024, touch: 5, coarse: true, hover: true, dpr: 2 }, {
  form: "tablet",
  device: "tablet",
  menuLayout: "split",
  sidebarNarrow: true,
  boardMajority: true,
});

caseStudy("Desktop 1600x900 mouse", { w: 1600, h: 900, touch: 0, coarse: false, hover: true, dpr: 1 }, {
  form: "desktop",
  device: "desktop",
  menuLayout: "triad",
});

caseStudy("Laptop 1366x768 no touch", { w: 1366, h: 768, touch: 0, coarse: false, hover: true, dpr: 1 }, {
  form: "desktop",
  device: "desktop",
  menuLayout: "triad",
});

console.log("");
if (failures.length) {
  console.error(`${failures.length} layout QA failure(s)`);
  process.exit(1);
}
console.log("All layout QA checks passed.");
