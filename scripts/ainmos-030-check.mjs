/**
 * Ainmos 0.30 browser check: JILLY opens Whole, a complete set waits for you and
 * spirals into its Archetype, dusk plays its toll as its own beat, the hand sorts,
 * and every Dreambeast shows a twist. Needs ainmos-static on :8788.
 *
 *   node scripts/ainmos-030-check.mjs [baseUrl] [outDir]
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const BASE = process.argv[2] || "http://localhost:8788";
const OUT = resolve(process.argv[3] || "promo/ainmos-030-check");
mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ channel: "msedge" }).catch(() => chromium.launch());
const [VW, VH] = (process.env.AINMOS_VP || "1600x900").split("x").map(Number);
const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, ...(VW < 1000 ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
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

await page.goto(`${BASE}/index.html?dev=1`);
await g(() => { try { localStorage.clear(); } catch { /* fresh */ } });
await page.goto(`${BASE}/index.html?dev=1`);
await wait(2500);
await g(() => {
  const img = [...document.querySelectorAll("img")].find((el) => el.alt === "The Immovable");
  (img?.closest("button, [role=button], .dreamer-card, .setup-dreamer") || img)?.click();
  const seed = document.getElementById("setup-seed");
  if (seed) { seed.value = "JILLY"; seed.dispatchEvent(new Event("input", { bubbles: true })); }
});
await wait(300);
await g(() => [...document.querySelectorAll("button")].find((el) => /Begin Dreaming/i.test(el.textContent))?.click());
await page.waitForURL(/play.html/, { timeout: 20000 });
await page.waitForFunction(() => !!window.__ainmos?.state(), null, { timeout: 20000 });
const sawWhole = await page.waitForSelector(".dream-whole", { timeout: 9000 }).then(() => true).catch(() => false);
await wait(1200);
await snap("01a-jilly-whole-fanfare");
check("The Dream is Whole fanfare plays", sawWhole);
await page.mouse.click(10, 10);
await wait(1500);
await snap("01-jilly-cycle");
await g(() => [...document.querySelectorAll("#cycle-screen button")].find((b) => /Begin/i.test(b.textContent))?.click());
await wait(700);
await wait(1400);
await snap("01b-jilly-after-begin");
const whole = await g(() => {
  const s = window.__ainmos.state();
  return { tiles: s.board.length, vault: s.landscapeVault.length, deck: s.landscapeTileDeck.length, at: s.dreamscapeWholeAt, jilly: s.seedFlags?.jilly };
});
check("JILLY places every Landscape", whole.jilly && whole.tiles >= 25 && !whole.vault && !whole.deck, JSON.stringify(whole));
check("JILLY counts as the Dream Whole", whole.at === 0);
const values = await g(() => window.__ainmos.state().psycheDeck.map((c) => c.value));
check("JILLY leaves Psyche values alone", new Set(values).size > 1, `${new Set(values).size} distinct values`);
await wait(3500);

// Clear whatever opened (Return picker from the Whole reward) to stage the rest.
const clearPending = () => g(() => {
  const s = window.__ainmos.state();
  document.body.classList.remove("opening-cinematic-pending");
  s.anteIntroSeen = 99;
  s.pendingReturn = null; s.pendingRepress = null; s.resolutionQueue = [];
  s.pendingEffectChoice = null; s.pendingObjectChoice = null; s.pendingMindstreamChoice = null;
  s.pendingDreamChoice = null; s.pendingDreamQueue = []; s.dreamDrawn = true;
  s.lostFound = { ...(s.lostFound || {}), open: false };
  document.getElementById("utility-modal")?.classList.add("hidden");
  window.__ainmos.render();
});
await clearPending();
await wait(600);

// ---- Sets: a full Jewelry set waits for you -----------------------------------------
await g(async () => {
  const s = window.__ainmos.state();
  const me = s.players[0];
  const res = await fetch("./data/objects.json").then((r) => r.json());
  const pick = (id) => ({ ...res.find((o) => o.id === id), type: "object", instanceId: `t-${id}` });
  me.persistent = [pick("silver-sapphire-ring"), pick("golden-ruby-necklace"), pick("yellow-diamond-bracelet")];
  const eff = await import("./js/effects/object-effects.js");
  eff.checkObjectTagSet(s, me, "jewelry");
  window.__ainmos.render();
});
await wait(800);
const readyBtn = await g(() => !!document.querySelector("#ready-sets:not([hidden]) [data-set-tag='jewelry']"));
check("A complete set shows a Use button (no auto Acquire)", readyBtn);
const autoAcq = await g(() => window.__ainmos.state().players[0].acquiredArchetypes.length);
check("Set did not Acquire by itself", autoAcq === 0, `acquired ${autoAcq}`);
await snap("02-ready-set");
await g(() => document.querySelector("#ready-sets [data-set-tag='jewelry']")?.click());
await wait(900);
const grid = await g(() => {
  const host = document.getElementById("set-archetype");
  const pills = [...host.querySelectorAll(".sa-pill")];
  const scroll = host.querySelector(".sa-grid");
  return { open: !host.hidden, pills: pills.length, taken: pills.filter((p) => p.classList.contains("is-taken")).length, overflow: scroll ? scroll.scrollHeight > scroll.clientHeight + 2 || scroll.scrollWidth > scroll.clientWidth + 2 : null };
});
check("Picker shows all 12 Archetypes without scrolling", grid.open && grid.pills === 12 && !grid.overflow, JSON.stringify(grid));
const firstFree = await g(() => document.querySelector("#set-archetype .sa-pill:not(.is-taken)")?.dataset.sa);
await page.hover(`#set-archetype [data-sa="${firstFree}"]`);
await wait(300);
const tip = await g((id) => {
  const el = document.querySelector(`#sa-tip-${id}`);
  return el ? { text: el.textContent.replace(/\s+/g, " ").trim(), opacity: getComputedStyle(el).opacity } : null;
}, firstFree);
check("Hover tooltip shows the Archetype power", tip && Number(tip.opacity) > 0.5 && /⚡|Passive/.test(tip.text), JSON.stringify(tip));
await snap("03-set-picker-tooltip");
await page.click(`#set-archetype [data-sa="${firstFree}"]`);
await wait(200);
await page.click("#set-archetype [data-sa-go]");
await page.waitForSelector(".set-spiral.is-vortex", { timeout: 8000 }).catch(() => {});
await wait(500);
await snap("04-spiral-vortex");
await page.waitForSelector(".set-spiral.is-shadow", { timeout: 8000 }).catch(() => {});
await wait(450);
await snap("05-spiral-shadow");
await page.waitForSelector(".set-spiral.is-lit", { timeout: 8000 }).catch(() => {});
await wait(550);
await snap("06-spiral-lit");
const after = await g(() => {
  const s = window.__ainmos.state();
  return { acquired: s.players[0].acquiredArchetypes.map((a) => a.id), spent: (s.spentSets || []).map((x) => x.cards.length), persistent: s.players[0].persistent.length };
});
check("Using the set Acquires the pick and moves the set out of play", after.acquired.length === 1 && after.spent[0] === 3 && after.persistent === 0, JSON.stringify(after));
await wait(1500);

// ---- Dusk toll as its own beat ---------------------------------------------------------
await clearPending();
await g(() => [...document.querySelectorAll("#utility-modal button")].find((b) => /Take|Open/i.test(b.textContent))?.click());
await wait(800);
await clearPending();
await wait(300);
await g(async () => {
  const s = window.__ainmos.state();
  const st = await import("./js/core/state.js");
  const tiles = s.board.filter((t) => !t.center && t.id !== "bed" && t.id !== s.players[0].landscapeId).slice(0, 2);
  const cat = s.endless?.beastCatalog || {};
  const beasts = ["gorgon", "vampyre"].map((id) => s.nightmarePool.find((b) => b.id === id) || Object.values(cat).find((b) => b.id === id) || s.nightmarePool[0]);
  tiles.forEach((t, i) => st.setEncounterOnLandscape(s, t.id, { ...beasts[i], type: "dreambeast", instanceId: `dusk-${i}` }));
  const meet = await import("./js/encounters/meet-phase.js");
  s.__mindBefore = s.psycheDeck.length + s.psycheDiscard.length;
  meet.applyMeetEndConsequences(s);
  window.__ainmos.render();
});
await page.waitForSelector(".dusk-toll.is-paying", { timeout: 8000 }).catch(() => {});
await wait(300);
await snap("07-dusk-toll");
const dusk = await g(() => {
  const s = window.__ainmos.state();
  return { lost: s.__mindBefore - (s.psycheDeck.length + s.psycheDiscard.length), shown: !!document.querySelector(".dusk-toll"), flightsDuring: document.querySelectorAll("#fx-layer .fx-flying-card").length };
});
check("Dusk Represses 2 per standing Dreambeast and shows the toll", dusk.lost >= 4 && dusk.shown, JSON.stringify(dusk));
await wait(3500);

// ---- The fold ----------------------------------------------------------------------------
await clearPending();
await g(async () => {
  const s = window.__ainmos.state();
  const land = await import("./js/board/landscapes.js");
  land.resetDreamscape(s);
  window.__ainmos.render();
});
await page.waitForSelector(".dream-fold-banner", { timeout: 8000 }).catch(() => {});
await wait(700);
await snap("07b-dream-fold");
check("The fold plays and leaves only The Bed", await g(() => !!document.querySelector(".dream-fold-banner") && window.__ainmos.state().board.length === 1));
await wait(2600);

// ---- Hand sort -------------------------------------------------------------------------
await clearPending();
await g(() => {
  const s = window.__ainmos.state();
  const me = s.players[0];
  const mk = (suit, value, i) => ({ type: "psyche", suit, value, name: `${suit} ${value}`, instanceId: `h-${i}` });
  me.hand = [mk("willpower", 3, 1), mk("lucidity", 5, 2), mk("elasticity", 1, 3), mk("lucidity", 2, 4), mk("willpower", 1, 5)];
  window.__ainmos.render();
});
await wait(400);
await g(() => document.querySelector("[data-hand-sort='suit']")?.click());
await wait(300);
const bySuit = await g(() => window.__ainmos.state().players[0].hand.map((c) => `${c.suit[0]}${c.value}`).join(" "));
check("Sort by suit then value", bySuit === "l2 l5 e1 w1 w3", bySuit);
await g(() => document.querySelector("[data-hand-sort='value']")?.click());
await wait(300);
const byValue = await g(() => window.__ainmos.state().players[0].hand.map((c) => `${c.suit[0]}${c.value}`).join(" "));
check("Sort by value", byValue === "e1 w1 l2 w3 l5", byValue);
await snap("08-hand-sorted");

// ---- Every Dreambeast has a twist ----------------------------------------------------------
const twists = await g(async () => {
  const s = window.__ainmos.state();
  const t = await import("./js/encounters/beast-twists.js");
  const all = await fetch("./data/dreambeasts.json").then((r) => r.json());
  return all.filter((b) => !t.twistInfo(b)).map((b) => b.id);
});
check("Every Dreambeast has a twist", twists.length === 0, twists.join(", "));

const real = errors.filter((e) => !/favicon/.test(e));
check("No page errors", real.length === 0, real.slice(0, 5).join(" | "));
await browser.close();
console.log(failures ? `${failures} FAILED` : "ALL PASS");
process.exit(failures ? 1 : 0);
