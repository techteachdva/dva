/**
 * Ainmos mobile walk: the smart bot (js/dev/autoplay.js) plays a seeded night in a real
 * phone- or tablet-sized browser, and every new screen is screenshotted and measured
 * (tap targets under 44px, clipped text, controls off screen or covered). Dice battles
 * are caught mid-roll and at the result, exactly as a player would see them.
 *
 *   node scripts/ainmos-mobile-walk.mjs --vp phone-landscape [--out dir] [--seed WAKE0210] [--rounds 3]
 *
 * Needs the Ainmos static server on :8788 (launch config "ainmos-static").
 */
import { chromium, devices } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : fallback;
};
const BASE = arg("--base", "http://localhost:8788");
const SEED = arg("--seed", "WAKE0210");
const DREAMER = arg("--dreamer", "The Immovable");
const ROUNDS = Number(arg("--rounds", "3"));
const GUIDED = process.argv.includes("--guided");
// --until <shot-name-prefix> stops there; --eval <file.js> then runs that file's body in the page and prints the result.
const UNTIL = arg("--until", "");
const EVAL = arg("--eval", "");
const VP_NAME = arg("--vp", "phone-landscape");
const OUT = resolve(arg("--out", "promo/ainmos-mobile-walk"));
mkdirSync(OUT, { recursive: true });

// Real device CSS viewports (Playwright's device table).
const VIEWPORTS = {
  "phone-landscape": { viewport: { width: 844, height: 390 }, dpr: 3, ua: devices["iPhone 13"].userAgent },
  "phone-small": { viewport: { width: 667, height: 375 }, dpr: 2, ua: devices["iPhone SE"].userAgent },
  // iPhone 16e: 1170x2532 at 3x. Pixel 10: 1080x2424 at 2.625x.
  "iphone-16e": { viewport: { width: 844, height: 390 }, dpr: 3, ua: devices["iPhone 13"].userAgent },
  "iphone-16e-portrait": { viewport: { width: 390, height: 844 }, dpr: 3, ua: devices["iPhone 13"].userAgent },
  "pixel-10": { viewport: { width: 923, height: 412 }, dpr: 2.625, ua: devices["Pixel 7"]?.userAgent || devices["Pixel 5"].userAgent },
  // Pixel 10 in Chrome with the address bar and status bar showing (landscape).
  "pixel-10-chrome": { viewport: { width: 923, height: 340 }, dpr: 2.625, ua: devices["Pixel 7"]?.userAgent || devices["Pixel 5"].userAgent },
  "pixel-10-portrait": { viewport: { width: 412, height: 923 }, dpr: 2.625, ua: devices["Pixel 7"]?.userAgent || devices["Pixel 5"].userAgent },
  "phone-android": { viewport: { width: 915, height: 412 }, dpr: 2.625, ua: devices["Pixel 7"]?.userAgent || devices["Pixel 5"].userAgent },
  "tablet-landscape": { viewport: { width: 1180, height: 820 }, dpr: 2, ua: devices["iPad Pro 11"].userAgent },
  "tablet-portrait": { viewport: { width: 820, height: 1180 }, dpr: 2, ua: devices["iPad Pro 11"].userAgent },
  "tablet-mini": { viewport: { width: 1024, height: 768 }, dpr: 2, ua: devices["iPad Mini"].userAgent },
  // A desktop control run: nothing in the phone/tablet pass should change it.
  desktop: { viewport: { width: 1920, height: 1080 }, dpr: 1, ua: null, desktop: true },
};
const VP = VIEWPORTS[VP_NAME];
if (!VP) throw new Error(`unknown --vp ${VP_NAME}`);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ channel: "msedge" }).catch(() => chromium.launch());
const context = await browser.newContext({
  viewport: VP.viewport,
  deviceScaleFactor: VP.dpr,
  hasTouch: !VP.desktop,
  isMobile: !VP.desktop,
  ...(VP.ua ? { userAgent: VP.ua } : {}),
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

const TAG = `${VP_NAME}${GUIDED ? "-guided" : ""}`;
const report = { viewport: VP_NAME, guided: GUIDED, size: VP.viewport, shots: [] };
let shotN = 0;

async function measure() {
  return page.evaluate(() => {
    const vw = innerWidth;
    const vh = innerHeight;
    const visible = (el) => {
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) < 0.05) return false;
      if (el.closest("[hidden], .hidden")) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    const label = (el) => {
      const t = (el.getAttribute("aria-label") || el.textContent || "").trim().replace(/\s+/g, " ");
      const cls = typeof el.className === "string" ? el.className.trim().split(/\s+/).slice(0, 2).join(".") : "";
      return `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}${cls ? `.${cls}` : ""} "${t.slice(0, 36)}"`;
    };
    const covered = (el) => {
      const r = el.getBoundingClientRect();
      const x = Math.min(vw - 1, Math.max(0, r.left + r.width / 2));
      const y = Math.min(vh - 1, Math.max(0, r.top + r.height / 2));
      const hit = document.elementFromPoint(x, y);
      return !(!hit || el === hit || el.contains(hit) || hit.contains(el));
    };
    const taps = [];
    document.querySelectorAll("button, a[href], [role=button], input, select, .lf-item, .lf-btn").forEach((el) => {
      if (!visible(el)) return;
      const r = el.getBoundingClientRect();
      const off = r.left < -2 || r.top < -2 || r.right > vw + 2 || r.bottom > vh + 2;
      const cov = !off && covered(el);
      if (cov) return; // under a menu: not reachable now, not a size problem now
      const small = Math.min(r.width, r.height) < 44;
      if (small || off) taps.push({ el: label(el), w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.left), y: Math.round(r.top), small, off });
    });
    const clipped = [];
    document.querySelectorAll("p, h1, h2, h3, h4, span, li, button, div").forEach((el) => {
      if (!visible(el) || covered(el)) return;
      const cs = getComputedStyle(el);
      const textual = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (!textual) return;
      const x = el.scrollWidth > el.clientWidth + 2 && /hidden|clip/.test(cs.overflowX);
      const y = el.scrollHeight > el.clientHeight + 2 && /hidden|clip/.test(cs.overflowY);
      const ell = cs.textOverflow === "ellipsis" && el.scrollWidth > el.clientWidth + 1;
      if (x || y || ell) clipped.push({ el: label(el), sw: el.scrollWidth, cw: el.clientWidth, sh: el.scrollHeight, ch: el.clientHeight, fs: cs.fontSize });
    });
    const tiny = [];
    document.querySelectorAll("p, li, span, button, h1, h2, h3, h4, small, em, strong, b").forEach((el) => {
      if (!visible(el) || covered(el)) return;
      if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 2)) return;
      const fs = parseFloat(getComputedStyle(el).fontSize);
      if (fs < 11) tiny.push({ el: label(el), fs });
    });
    const scrollers = [...document.querySelectorAll("*")].filter((el) => {
      if (!visible(el)) return false;
      const cs = getComputedStyle(el);
      return /auto|scroll/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 4;
    }).map((el) => ({ el: label(el), sh: el.scrollHeight, ch: el.clientHeight }));
    // Text drawn on top of other text: leaf text boxes in the same window that intersect.
    const overlaps = [];
    const leafText = [...document.querySelectorAll("p, h1, h2, h3, h4, span, li, button, small, strong, b, em")].filter((el) => {
      // Not filtered by covered(): overlapping text is exactly what covers another element.
      if (!visible(el)) return false;
      if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1)) return false;
      return ![...el.children].some((c) => /^(P|H\d|LI|BUTTON)$/.test(c.tagName));
    });
    // The text's own box, clipped by every scrolling or clipping ancestor: what is actually seen.
    const textRect = (el) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      const t = range.getBoundingClientRect();
      let r = { left: t.left, top: t.top, right: t.right, bottom: t.bottom };
      for (let a = el; a && a !== document.body; a = a.parentElement) {
        const cs = getComputedStyle(a);
        if (cs.overflowX === "visible" && cs.overflowY === "visible") continue;
        const b = a.getBoundingClientRect();
        r = { left: Math.max(r.left, b.left), top: Math.max(r.top, b.top), right: Math.min(r.right, b.right), bottom: Math.min(r.bottom, b.bottom) };
      }
      return { ...r, width: Math.max(0, r.right - r.left), height: Math.max(0, r.bottom - r.top) };
    };
    const boxes = leafText.map((el) => ({ el, r: textRect(el), host: el.closest(".lf-item, .lf-window, .modal-content, .utility-content, .coach-card, header, footer") }));
    for (let i = 0; i < boxes.length && overlaps.length < 12; i += 1) {
      for (let j = i + 1; j < boxes.length; j += 1) {
        const a = boxes[i];
        const b = boxes[j];
        if (a.host !== b.host || a.el.contains(b.el) || b.el.contains(a.el)) continue;
        const w = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
        const h = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
        if (!a.host || w <= 6 || h <= 4) continue;
        if (a.r.width && b.r.width) overlaps.push(`${label(a.el)} × ${label(b.el)} (${Math.round(w)}×${Math.round(h)})`);
      }
    }
    return {
      form: document.documentElement.dataset.form,
      overlaps,
      taps,
      clipped: clipped.slice(0, 30),
      tiny: tiny.slice(0, 30),
      scrollers: scrollers.slice(0, 10),
      page: { sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight, vw, vh },
    };
  });
}

async function shot(name) {
  // Let finite animations (menu fades, slides) land first: never measure a half-faded frame.
  await page.evaluate(() => Promise.race([
    Promise.all(document.getAnimations()
      .filter((a) => a.playState === "running" && Number.isFinite(a.effect?.getComputedTiming?.().endTime))
      .map((a) => a.finished.catch(() => {}))),
    new Promise((r) => setTimeout(r, 2500)),
  ]));
  shotN += 1;
  const file = `${String(shotN).padStart(2, "0")}-${name}`;
  await page.screenshot({ path: `${OUT}/${TAG}--${file}.png` });
  const m = await measure();
  report.shots.push({ name: file, ...m });
  if (UNTIL && name.startsWith(UNTIL)) {
    if (EVAL) {
      const { readFileSync } = await import("node:fs");
      const body = readFileSync(EVAL, "utf8");
      const out = await page.evaluate(`(async () => { ${body} })()`);
      console.log(typeof out === "string" ? out : JSON.stringify(out, null, 1));
    }
    writeFileSync(`${OUT}/${TAG}-report.json`, JSON.stringify({ ...report, errors }, null, 2));
    await browser.close();
    process.exit(0);
  }
  console.log(`${file}: overlap=${m.overlaps.length} small=${m.taps.filter((t) => t.small).length} off=${m.taps.filter((t) => t.off).length} clipped=${m.clipped.length} tiny=${m.tiny.length} scrollers=${m.scrollers.length}`);
}

async function install() {
  await page.evaluate(async () => {
    const ap = await import("/js/dev/autoplay.js");
    const dice = await import("/js/encounters/dice-battle.js");
    const rules = await import("/js/core/rules.js");
    const st = await import("/js/core/state.js");
    const ui = await import("/js/ui/ui.js");
    const memo = {};
    window.__walk = {
      inspect() {
        const s = window.__ainmos.state();
        const ms = s.pendingMindstreamChoice;
        const stage = document.getElementById("dice-battle-stage");
        const banner = stage?.querySelector("[data-banner]");
        return {
          status: s.status,
          round: s.round,
          phase: st.getPhase(s),
          dice: dice.isDiceBattleOpen() || !!s.diceBattle,
          diceShown: !!stage && !stage.hidden,
          diceBanner: !!banner && !banner.hidden,
          cycleScreen: !!document.querySelector("[data-cy-enter]") && !document.querySelector("[data-cy-enter]").closest("[hidden]"),
          mindstream: ms ? (ms.card?.name || "choice") : null,
          effect: s.pendingEffectChoice?.cardId || null,
          archChoice: !!(s.pendingArchetypeChoice || s.pendingArchetypeCall),
          opener: rules.phaseOpeningActive(s),
          pick: s.landscapePick?.mode || null,
          lostFound: !!s.lostFound?.open,
          cinematic: document.body.classList.contains("opening-cinematic") || document.body.classList.contains("opening-cinematic-pending"),
        };
      },
      step() {
        const s = window.__ainmos.state();
        if (dice.isDiceBattleOpen() || s.diceBattle) return "busy";
        const did = ap.stepAutoplay(s, memo);
        window.__ainmos.render();
        const modal = document.getElementById("utility-modal");
        if (modal && !modal.classList.contains("hidden") && modal.querySelector(".ms-choice-btn")
          && !s.pendingMindstreamChoice && !s.pendingEffectChoice && !s.pendingDreamChoice) {
          ui.hideUtilityModal?.(true);
        }
        return did;
      },
    };
  });
}
const inspect = () => page.evaluate(() => window.__walk.inspect());

await page.goto(`${BASE}/index.html?dev=1`);
await page.evaluate(() => {
  try {
    localStorage.clear();
    localStorage.setItem("ainmos_gentle_daydream_used", "1");
  } catch { /* fresh */ }
});
await page.goto(`${BASE}/index.html?dev=1`);
await sleep(2600);
await shot("title");
await page.evaluate((seed) => {
  const input = document.getElementById("setup-seed");
  if (input) {
    input.value = seed;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }
  const sel = document.getElementById("setup-length");
  if (sel) {
    sel.value = "daydream";
    sel.dispatchEvent(new Event("change", { bubbles: true }));
  }
}, SEED);
await page.evaluate((name) => {
  const img = [...document.querySelectorAll("img")].find((el) => el.alt === name);
  (img?.closest("button, [role=button], .dreamer-card, .setup-dreamer") || img)?.click();
}, DREAMER);
await sleep(700);
await shot("title-picked");
await page.evaluate((guided) => (guided
  ? document.getElementById("btn-tutorial-mode")
  : [...document.querySelectorAll("button")].find((el) => /Begin Dreaming/i.test(el.textContent)))?.click(), GUIDED);
await page.waitForURL(/play.html/, { timeout: 20000 });
await page.waitForFunction(() => !!window.__ainmos?.state(), null, { timeout: 30000 });
await install();
await page.evaluate(() => {
  document.querySelectorAll("button, a, div").forEach((el) => {
    if (el.textContent.trim() === "Dev" && el.children.length === 0) el.style.display = "none";
  });
});
await sleep(1200);
await page.waitForSelector("#fullscreen-prompt", { timeout: 6000 }).catch(() => {});
await page.evaluate(() => document.getElementById("fullscreen-prompt")?.click());
for (let i = 0; i < 40 && (await inspect()).cinematic; i += 1) await sleep(300);
await sleep(600);

/** Screens the bot never opens: the hand drawer with a spread, the pause menu, a card detail, the night peek. */
async function extras() {
  const tapEl = async (sel) => {
    const r = await page.evaluate((q) => {
      const el = [...document.querySelectorAll(q)].find((e) => e.getClientRects().length);
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
    }, sel);
    if (r) await (VP.desktop ? page.mouse.click(r.x, r.y) : page.touchscreen.tap(r.x, r.y));
    return !!r;
  };
  if (await tapEl("#hand-drawer-btn")) {
    await sleep(900);
    await shot("x-hand-drawer");
    await page.evaluate(() => {
      const cards = [...document.querySelectorAll(".hand-bar .game-card, #player-hand .game-card")].filter((e) => e.getClientRects().length).slice(0, 2);
      cards.forEach((c) => c.click());
    });
    await sleep(900);
    await shot("x-hand-spread");
    await page.evaluate(() => { window.__ainmos.state().selectedHand = []; window.__ainmos.render(); });
    await tapEl("#hand-drawer-btn");
    await sleep(700);
  }
  if (await tapEl("#btn-sidebar-drawer")) { await sleep(900); await shot("x-table-drawer"); await tapEl("#btn-sidebar-drawer"); await sleep(600); }
  if (await tapEl("#hud-cycle")) { await sleep(500); await shot("x-night-peek"); await (VP.desktop ? page.mouse.click(400, 250) : page.touchscreen.tap(400, 250)); await sleep(400); }
  if (await tapEl("#btn-pause")) { await sleep(1000); await shot("x-pause"); await page.keyboard.press("Escape"); await sleep(800); }
  await page.evaluate(async () => {
    const ui = await import("/js/ui/ui.js");
    const s = window.__ainmos.state();
    let beast = null;
    (s.board || []).forEach((t) => (t.encounters || []).forEach((e) => { beast = beast || e; }));
    beast = beast || (s.dreamDeck || []).find((c) => c.boss) || s.players[0].hand[0];
    ui.showModal(beast);
  });
  await sleep(1000);
  await shot("x-card-detail");
  await page.evaluate(async () => { (await import("/js/ui/ui.js")).hideModal(); });
  await sleep(600);
  await page.evaluate(async () => {
    const ui = await import("/js/ui/ui.js");
    const s = window.__ainmos.state();
    ui.showDreamerDetail(s.players[0].dreamer, { player: s.players[0], state: s });
  });
  await sleep(1000);
  await shot("x-dreamer-detail");
  await page.evaluate(async () => { (await import("/js/ui/ui.js")).hideUtilityModal?.(true); });
  await sleep(600);
}

const seen = new Set();
const once = (k) => (seen.has(k) ? false : (seen.add(k), true));
let fight = 0;
let guard = 1200;
let lastKey = "";
while (guard-- > 0) {
  const s = await inspect();
  if (s.status !== "playing") { await sleep(1500); await shot(`end-${s.status}`); break; }
  if (s.round > ROUNDS && !s.lostFound) break;

  if (s.dice) {
    if (s.diceShown && !s.diceBanner && once(`roll-${fight}`)) { await sleep(350); await shot(`dice-rolling-${fight}`); }
    if (s.diceBanner && once(`banner-${fight}`)) { await shot(`dice-result-${fight}`); fight += 1; }
    if (!s.diceShown && once(`dice-invisible-${fight}`)) console.log(`!! dice battle open but stage not shown (fight ${fight})`);
    await sleep(150);
    continue;
  }
  if (s.cycleScreen) {
    if (once(`cycle-${s.round}`)) { await sleep(900); await shot(`cycle-screen-r${s.round}`); }
    await page.evaluate(() => document.querySelector("[data-cy-enter]")?.click());
    await sleep(1200);
    continue;
  }
  const key = `${s.round}:${s.phase}:${s.opener}:${s.pick}:${s.lostFound}:${s.mindstream}:${s.effect}:${s.archChoice}`;
  if (key !== lastKey) {
    lastKey = key;
    let name = null;
    if (s.lostFound) name = `lost-found-r${s.round}`;
    else if (s.archChoice) name = `archetype-choice-r${s.round}`;
    else if (s.mindstream) name = `choice-${s.phase}-r${s.round}`;
    else if (s.effect) name = `effect-${s.effect}-r${s.round}`;
    else if (s.opener) name = `opener-${s.phase}-r${s.round}`;
    else if (s.pick) name = `vault-${s.pick}-r${s.round}`;
    else name = `table-${s.phase}-r${s.round}`;
    if (once(name)) { await sleep(1300); await shot(name); }
    if (name.startsWith("table-Meet") && once("extras")) await extras();
  }
  const did = await page.evaluate(() => window.__walk.step());
  await sleep(did === "busy" ? 150 : 380);
}

writeFileSync(`${OUT}/${TAG}-report.json`, JSON.stringify({ ...report, errors }, null, 2));
console.log(`fights seen: ${fight}; errors: ${errors.length}`);
errors.slice(0, 5).forEach((e) => console.log("  ", e));
await browser.close();
