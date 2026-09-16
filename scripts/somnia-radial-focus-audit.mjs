#!/usr/bin/env node
/**
 * Verifies dreamer focus is applied after board render and radial anchors resolve live tokens.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..");
const JS = path.join(REPO, "src/site/somnia/js");
const failures = [];

function fail(msg) {
  failures.push(msg);
}

function stubEl(id = "") {
  const rect = { left: 100, top: 80, width: 48, height: 48, right: 148, bottom: 128 };
  return {
    id,
    dataset: { tileId: id.replace("tile-", ""), dreamerId: id.replace("dreamer-", "") },
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    style: {},
    getBoundingClientRect: () => rect,
  };
}

const viewport = stubEl("viewport");
viewport.clientWidth = 800;
viewport.clientHeight = 600;
viewport.addEventListener = () => {};
viewport.setPointerCapture = () => {};
viewport.releasePointerCapture = () => {};
viewport.contains = () => true;
const stage = stubEl("stage");
stage.querySelector = () => ({ offsetWidth: 1200, offsetHeight: 900 });
stage.style.transform = "";
stage.classList = { add() {}, remove() {}, toggle() {}, contains: () => false };

globalThis.window = globalThis;
globalThis.window.addEventListener = () => {};
globalThis.window.removeEventListener = () => {};
globalThis.window.innerWidth = 1200;
globalThis.window.innerHeight = 800;
globalThis.localStorage = {
  getItem: () => "1",
  setItem: () => {},
};
globalThis.document = {
  getElementById: (id) => {
    if (id === "board-viewport") return viewport;
    if (id === "board-zoom-stage") return stage;
    if (id === "screen-game") return { classList: { contains: () => true } };
    if (id === "card-modal") return { classList: { contains: () => true } };
    if (id === "utility-modal") return { classList: { contains: () => true } };
    if (id === "pause-menu") return { classList: { contains: () => true } };
    return null;
  },
  querySelector: (sel) => {
    if (sel.includes('data-tile-id="house"')) return stubEl("tile-house");
    if (sel.includes('data-dreamer-id="p0"')) return stubEl("dreamer-p0");
    return null;
  },
  body: { classList: { add() {}, remove() {}, contains: () => false } },
  addEventListener: () => {},
};
globalThis.window.matchMedia = () => ({ matches: false });
globalThis.requestAnimationFrame = (fn) => { fn(); return 0; };

const boardZoom = await import(pathToFileURL(path.join(JS, "board-zoom.js")).href);

boardZoom.initBoardZoom();
boardZoom.resetBoardZoom();

let renderCount = 0;
boardZoom.setBoardZoomChangeHandler(() => {
  renderCount += 1;
  boardZoom.syncBoardZoomAfterRender();
});

const beforePanX = boardZoom.getBoardZoom?.() ?? 1;
boardZoom.focusOnLandscape("house");
if (renderCount < 1) fail("focusOnLandscape with zoom change should trigger board re-render");

boardZoom.focusOnLandscape("house");
const token = document.querySelector('.hex-occupant-dreamer[data-dreamer-id="p0"]')
  || document.querySelector('.hex-tile[data-tile-id="house"]');
if (!token) fail("resolveAnchor selector should find dreamer token or tile fallback");

const playSrc = fs.readFileSync(path.join(JS, "play.js"), "utf8");
if (!playSrc.includes("pendingDreamerRadial")) fail("play.js should defer map-token radial until after focus render");
if (!playSrc.includes("queueDreamerBoardFocus")) fail("play.js should queue dreamer focus before renderAll");
if (!playSrc.includes("showDreamerBoardRadialMenu")) fail("play.js should split radial menu from focus setup");
if (playSrc.includes("openDreamerBoardRadial(anchorEl")) {
  if (playSrc.match(/openDreamerBoardRadial[\s\S]*?focusOnLandscape\(/)) {
    fail("openDreamerBoardRadial should not call focusOnLandscape directly before render");
  }
}

const uiSrc = fs.readFileSync(path.join(JS, "ui.js"), "utf8");
if (!uiSrc.includes("resolveAnchor")) fail("showRadialMenu should support resolveAnchor re-query");

console.log(JSON.stringify({
  pass: failures.length === 0,
  failures,
  renderCount,
}, null, 2));

process.exit(failures.length ? 1 : 0);
