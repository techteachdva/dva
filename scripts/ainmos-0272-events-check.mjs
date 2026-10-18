/**
 * Ainmos 0.27.2 browser check: Archetype Events. Bright is paid with cards you
 * pick, its Return opens the Return picker, and a "play up to 4" Bright lets the
 * spread hold 4 Psyche. Needs the static server (ainmos-static on :8788).
 *
 *   node scripts/ainmos-0272-events-check.mjs [baseUrl] [outDir]
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const BASE = process.argv[2] || "http://localhost:8788";
const OUT = resolve(process.argv[3] || "promo/ainmos-0272-check");
mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ channel: "msedge" }).catch(() => chromium.launch());
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errors.push(`${m.text()} ${m.location()?.url || ""}`); });
ctx.on("response", (r) => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });

const snap = async (name) => { await page.screenshot({ path: `${OUT}/${name}.png` }); console.log("saved", name); };
const g = (fn, arg) => page.evaluate(fn, arg);
let failures = 0;
const check = (label, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${label}${detail ? ` · ${detail}` : ""}`);
  if (!ok) failures += 1;
};

await page.goto(`${BASE}/index.html`);
await g(() => { try { localStorage.clear(); } catch { /* fresh */ } });
await page.goto(`${BASE}/index.html`);
await wait(2500);
await g(() => {
  const img = [...document.querySelectorAll("img")].find((el) => el.alt === "The Immovable");
  (img?.closest("button, [role=button], .dreamer-card, .setup-dreamer") || img)?.click();
});
await wait(400);
await g(() => [...document.querySelectorAll("button")].find((el) => /Begin Dreaming/i.test(el.textContent))?.click());
await page.waitForURL(/play.html/, { timeout: 20000 });
await page.goto(`${BASE}/play.html?dev=1`);
await page.waitForFunction(() => !!window.__ainmos?.state(), null, { timeout: 20000 });
await wait(1500);
await page.mouse.click(10, 10);
await wait(4000);

/**
 * Stage a Meet against an Archetype on the Dreamer's tile, with a chosen Event
 * on top of its deck, a placed Landscape for that Event, and a set hand.
 */
async function stage(eventId, hand) {
  return g(async ({ eventId, hand }) => {
    document.body.classList.remove("opening-cinematic-pending");
    const s = window.__ainmos.state();
    const board = await import("./js/dreamers/archetype-board.js");
    s.anteIntroSeen = 99;
    s.pendingMindstreamChoice = null;
    s.pendingEffectChoice = null;
    s.pendingRepress = null;
    s.pendingReturn = null;
    s.resolutionQueue = [];
    s.landscapePick = null;
    s.archetypeFight = null;
    s.selectedHand = [];
    const me = s.players[0];
    const event = s.eventCatalog.find((e) => e.id === eventId);
    const arch = s.boonCatalog.find((a) => a.landscapes.includes(event.landscape));
    // Place the Event's Landscape and stand the Dreamer on it with the Archetype.
    let tile = s.board.find((t) => t.id === event.landscape) || null;
    if (!tile) {
      const vault = await import("./js/board/dreamscape-vault.js");
      const stateMod = await import("./js/core/state.js");
      const piles = [s.landscapeTileDeck, s.landscapeVault, s.landscapesSetAside].filter(Array.isArray);
      let card = null;
      for (const pile of piles) {
        const at = pile.findIndex((c) => c?.id === event.landscape);
        if (at >= 0) { card = pile.splice(at, 1)[0]; break; }
      }
      const slot = vault.placementSlots(s)[0];
      tile = vault.makeBoardTile(card, slot.q, slot.r);
      s.board.push(tile);
      stateMod.revealLandscapeTile(s, tile);
    }
    const where = tile;
    me.landscapeId = where.id;
    s.board.forEach((t) => { t.finalArchetypes = []; t.finalArchetype = null; });
    where.finalArchetypes = [{ ...arch, defeated: false, landscapeId: where.id }];
    where.finalArchetype = where.finalArchetypes[0];
    s.archetypeEventDecks = { [arch.id]: [eventId] };
    s.phaseIndex = 2;
    s.meetActionBudget = 3;
    s.meetActionsUsed = 0;
    s.selectedLandscapeId = where.id;
    let n = 0;
    me.hand = hand.map(([suit, value]) => ({
      id: `${suit}-${value}`, type: "psyche", suit, value,
      name: `${suit[0].toUpperCase()}${suit.slice(1)} ${value}`, instanceId: `test-${n += 1}`,
    }));
    // Something to Return.
    s.subconscious.psyche = [1, 2, 3].map((v) => ({ id: `lucidity-${v}`, type: "psyche", suit: "lucidity", value: v, name: `Lucidity ${v}`, instanceId: `sub-${v}` }));
    const game = await import("./js/core/game.js");
    game.faceArchetype(s, arch.id);
    window.__ainmos.render();
    return { arch: arch.name, landscape: where.name, pending: s.pendingMindstreamChoice?.kind || null };
  }, { eventId, hand });
}

async function modalText() {
  return g(() => {
    const m = document.querySelector("#utility-modal:not(.hidden) .ms-choice-fullscreen");
    if (!m) return null;
    return {
      kicker: m.querySelector(".ms-choice-kicker")?.textContent.trim(),
      title: m.querySelector(".ms-choice-title")?.textContent.trim(),
      message: m.querySelector(".ms-choice-message")?.textContent.trim(),
      img: m.querySelector("img.ms-choice-card")?.getAttribute("src"),
      bright: m.querySelector(".ms-choice-btn--good")?.textContent.replace(/\s+/g, " ").trim(),
      brightDisabled: m.querySelector(".ms-choice-btn--good")?.disabled,
      dim: m.querySelector(".ms-choice-btn--bad")?.textContent.replace(/\s+/g, " ").trim(),
    };
  });
}

// 1) The Council of the Years: pay a Lucidity worth 3+, get −1 Power, +1 die, Return 1 (you pick).
const one = await stage("the-council-of-the-years", [["lucidity", 1], ["lucidity", 4], ["lucidity", 5], ["willpower", 2], ["willpower", 2]]);
console.log("staged", one);
await wait(3500);
const m1 = await modalText();
console.log("modal", m1);
check("event modal opens", !!m1);
check("modal shows the Event's own flavor", /judges/i.test(m1?.message || ""), m1?.message);
check("Bright text lists every reward and the cost", /Power 11/.test(m1?.bright || "") && /\+1 die/.test(m1?.bright || "") && /Return 1/.test(m1?.bright || "") && /Lucidity 3\+/.test(m1?.bright || ""), m1?.bright);
check("image matches the Event", /the-council-of-the-years/.test(m1?.img || ""), m1?.img);
await snap("01-council-event");
await g(() => document.querySelector("#utility-modal .ms-choice-btn--good")?.click());
await wait(1500);
const pay1 = await g(() => {
  const s = window.__ainmos.state();
  return {
    pending: !!s.pendingRepress,
    payFor: s.pendingRepress?.payFor,
    bar: document.querySelector("#hand-choice-text")?.textContent.trim(),
    fight: s.archetypeFight && { side: s.archetypeFight.side, mods: s.archetypeFight.mods },
    handBefore: s.players[0].hand.map((c) => c.name),
  };
});
console.log("pay step", pay1);
check("Bright waits for you to pick the payment", pay1.pending && pay1.payFor === "Make Your Case", JSON.stringify(pay1.payFor));
await snap("02-council-pay");
// The Lucidity 1 must not pay (worth 3+ needed); pick the Lucidity 4.
const lowRejected = await g(async () => {
  const sub = await import("./js/dreamers/subconscious.js");
  const s = window.__ainmos.state();
  return !sub.toggleRepressPick(s, "test-1");
});
check("a Lucidity 1 can't pay a 'worth 3+' cost", lowRejected);
await g(async () => {
  const sub = await import("./js/dreamers/subconscious.js");
  const s = window.__ainmos.state();
  sub.toggleRepressPick(s, "test-2");
  sub.confirmRepressStep(s);
  window.__ainmos.render();
});
await wait(1500);
const ret1 = await g(() => {
  const s = window.__ainmos.state();
  return {
    pendingReturn: s.pendingReturn && { remaining: s.pendingReturn.remaining, reason: s.pendingReturn.reason },
    hand: s.players[0].hand.map((c) => c.name),
    subLeft: s.subconscious.psyche.length,
    pickerShown: !!document.querySelector("#utility-modal:not(.hidden) .subconscious-binder-fullscreen, #utility-modal:not(.hidden) #return-skip, #utility-modal:not(.hidden) [data-choice='return']"),
  };
});
console.log("return step", ret1);
check("paid with the card you picked", !ret1.hand.includes("Lucidity 4") && ret1.hand.includes("Lucidity 5"), ret1.hand.join(", "));
check("Return asks you which Psyche (not automatic)", ret1.pendingReturn?.remaining === 1 && ret1.subLeft === 3, JSON.stringify(ret1));
check("Return picker is on screen", ret1.pickerShown);
await snap("03-council-return-picker");
await g(async () => {
  const sub = await import("./js/dreamers/subconscious.js");
  const s = window.__ainmos.state();
  sub.pickReturnCard(s, "sub-1");
  window.__ainmos.render();
});
await wait(800);
const after1 = await g(async () => {
  const s = window.__ainmos.state();
  const board = await import("./js/dreamers/archetype-board.js");
  return { sub: s.subconscious.psyche.map((c) => c.name), rules: board.fightRules(s) };
});
check("the Psyche you picked came back", !after1.sub.includes("Lucidity 1") && after1.sub.length === 2, after1.sub.join(", "));
check("fight is Power 11 with +1 die", after1.rules.power === 11 && after1.rules.dice === 1, JSON.stringify(after1.rules));

// 2) Flashing Lights: pay 2 Elasticity, play up to 4 Psyche and +1 die.
await g(() => { document.querySelector("#utility-modal")?.classList.add("hidden"); });
const two = await stage("flashing-lights", [["elasticity", 1], ["elasticity", 2], ["willpower", 3], ["willpower", 3], ["willpower", 4], ["lucidity", 3], ["lucidity", 2]]);
console.log("staged", two);
await wait(3500);
const m2 = await modalText();
console.log("modal", m2);
check("Flashing Lights offers 4 Psyche", /Up to 4 Psyche/.test(m2?.bright || ""), m2?.bright);
await g(() => document.querySelector("#utility-modal .ms-choice-btn--good")?.click());
await wait(1200);
await g(async () => {
  const sub = await import("./js/dreamers/subconscious.js");
  const s = window.__ainmos.state();
  sub.toggleRepressPick(s, "test-1");
  sub.toggleRepressPick(s, "test-2");
  sub.confirmRepressStep(s);
  window.__ainmos.render();
});
await wait(1000);
const spread = await g(async () => {
  const s = window.__ainmos.state();
  const game = await import("./js/core/game.js");
  const rules = await import("./js/core/rules.js");
  const me = s.players[0];
  const ids = ["test-3", "test-4", "test-5", "test-6", "test-7"];
  ids.forEach((id) => game.toggleHandCard(s, me.hand.find((c) => c.instanceId === id), me));
  window.__ainmos.render();
  return { selected: s.selectedHand.length, cap: rules.meetSpreadCap(s), status: document.querySelector("#hand-status, .hand-stats, .psyche-hand-section .hand-title-stats")?.textContent || "" };
});
console.log("spread", spread);
check("spread holds 4 Psyche (and no more)", spread.selected === 4 && spread.cap === 4, JSON.stringify(spread));
await snap("04-flashing-lights-4-spread");

// 3) Dim is free and sets its one drawback.
await g(() => { document.querySelector("#utility-modal")?.classList.add("hidden"); });
await stage("jaw-shark", [["willpower", 1], ["willpower", 2]]);
await wait(3500);
const m3 = await modalText();
console.log("modal", m3);
check("Bright locked when no card can pay", m3?.brightDisabled === true, m3?.bright);
await snap("05-jaw-shark-locked");
await g(() => document.querySelector("#utility-modal .ms-choice-btn--bad")?.click());
await wait(800);
const dim = await g(async () => {
  const s = window.__ainmos.state();
  const board = await import("./js/dreamers/archetype-board.js");
  return { side: s.archetypeFight?.side, rules: board.fightRules(s), hand: s.players[0].hand.length };
});
check("Dim: at most 2 Psyche, nothing paid", dim.side === "dim" && dim.rules.cap === 2 && dim.hand === 2, JSON.stringify(dim));

console.log(errors.length ? `errors:\n${errors.join("\n")}` : "no page errors");
console.log(failures ? `${failures} check(s) failed` : "all checks passed");
await browser.close();
process.exit(failures ? 1 : 0);
