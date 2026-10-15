/**
 * Ainmos promo screenshots: drives a real browser through every menu and saves
 * full-resolution PNGs for itch.io. Needs the Ainmos static server running.
 *
 *   node scripts/ainmos-promo-shots.mjs [baseUrl] [outDir]
 *   default base http://localhost:8788, out promo/ainmos-screenshots
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const BASE = process.argv[2] || "http://localhost:8788";
const OUT = resolve(process.argv[3] || "promo/ainmos-screenshots");
mkdirSync(OUT, { recursive: true });

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function launch() {
  try {
    return await chromium.launch({ channel: "msedge" });
  } catch {
    return chromium.launch();
  }
}

const browser = await launch();
const shots = [];

async function snap(page, name) {
  await page.evaluate(() => {
    document.querySelectorAll("button, a, div").forEach((el) => {
      if (el.textContent.trim() === "Dev" && el.children.length === 0) el.style.display = "none";
    });
  });
  const file = `${OUT}/${name}.png`;
  await page.screenshot({ path: file });
  shots.push(file);
  console.log("saved", name);
}

/** Run code in the page against the live game modules. */
async function game(page, fn, arg) {
  return page.evaluate(fn, arg);
}

async function clearFx(page) {
  await page.evaluate(() => {
    document.querySelectorAll("#fx-layer > *, .fx-float-label, .fx-sparkle").forEach((el) => el.remove());
  });
}

async function startRun(page, { dreamer = "The Hunter" } = {}) {
  await page.goto(`${BASE}/index.html`);
  await page.evaluate(() => { try { localStorage.clear(); } catch { /* fresh */ } });
  await page.goto(`${BASE}/index.html`);
  await wait(2500);
  await page.evaluate((name) => {
    const img = [...document.querySelectorAll("img")].find((el) => el.alt === name);
    (img?.closest("button, [role=button], .dreamer-card, .setup-dreamer") || img)?.click();
  }, dreamer);
  await wait(500);
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find((el) => /Begin Dreaming/i.test(el.textContent));
    btn?.click();
  });
  await page.waitForURL(/play.html/, { timeout: 20000 });
  await wait(3000);
  await page.mouse.click(10, 10);
  await wait(4500);
}

async function setup(page) {
  // Reopen the run with dev hooks so states can be staged for each shot.
  await page.goto(`${BASE}/play.html?dev=1`);
  await page.waitForFunction(() => !!window.__ainmos, null, { timeout: 20000 });
  await wait(1500);
  await page.mouse.click(10, 10);
  await page.waitForFunction(() => !!window.__ainmos.state(), null, { timeout: 20000 });
  await wait(4500);
  await game(page, async () => {
    document.body.classList.remove("opening-cinematic-pending");
    const s = window.__ainmos.state();
    s.anteIntroSeen = 99;
  });
}

async function desktopShots() {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();

  await page.goto(`${BASE}/index.html`);
  await page.evaluate(() => { try { localStorage.clear(); } catch { /* fresh */ } });
  await page.goto(`${BASE}/index.html`);
  await wait(3000);
  await snap(page, "01-title-choose-your-dreamer");

  await startRun(page);
  await snap(page, "02-cycle-screen-first-night");

  await setup(page);

  // A Dream to endure.
  await game(page, async () => {
    const s = window.__ainmos.state();
    const mc = await import("/js/cards/mindstream-choices.js");
    const card = (s.dreamDeck || []).find((c) => c.type === "dream") || s.activeDream;
    mc.beginDreamCardChoice(s, card, s.players[0], {});
    window.__ainmos.render();
  });
  await wait(3500);
  await snap(page, "03-a-dream-endure-it");
  await game(page, async () => {
    const s = window.__ainmos.state();
    s.pendingMindstreamChoice = null;
    const ui = await import("/js/ui/ui.js");
    ui.hideUtilityModal?.(true);
    window.__ainmos.render();
  });
  await wait(800);

  // The Cycle screen.
  await game(page, async () => {
    const s = window.__ainmos.state();
    const cs = await import("/js/ui/cycle-screen.js");
    cs.renderCycleScreen({ status: "over" }, {});
    await new Promise((r) => setTimeout(r, 400));
    cs.renderCycleScreen({ ...s, round: 1, anteIntroSeen: 0, lostFound: null, pendingBoonDraft: null, dreamDeck: s.nightPlan.slice(1) }, {});
  });
  await wait(1200);
  await snap(page, "03b-cycle-screen");
  await game(page, async () => {
    const cs = await import("/js/ui/cycle-screen.js");
    cs.renderCycleScreen({ status: "over" }, {});
  });
  await wait(600);

  // Build the dream: place a few Landscapes so the board has a shape.
  await game(page, async () => {
    const s = window.__ainmos.state();
    const vault = await import("/js/board/dreamscape-vault.js");
    const g = await import("/js/core/game.js");
    s.pendingMindstreamChoice = null;
    for (let i = 0; i < 6; i += 1) {
      const cards = vault.vaultCards(s);
      if (!cards.length) break;
      s.landscapePick = { mode: "reveal", remaining: 2, picked: [], freeReveal: true };
      g.handleVaultTileSelect(s, 0);
      const slots = vault.placementSlots(s);
      if (!slots.length) break;
      g.handleBoardSlotClick(s, slots[i % slots.length].q, slots[i % slots.length].r);
    }
    s.landscapePick = null;
    window.__ainmos.render();
  });
  await wait(1500);

  // The Vault screen, mid-Reveal.
  await game(page, () => {
    const s = window.__ainmos.state();
    s.phaseIndex = 0;
    s.dreamDrawn = true;
    s.landscapePick = { mode: "reveal", remaining: 3, picked: [] };
    window.__ainmos.render();
  });
  await wait(1500);
  await snap(page, "04-dreamscape-vault");
  await game(page, () => {
    const s = window.__ainmos.state();
    s.landscapePick = null;
    window.__ainmos.render();
  });
  await wait(800);

  // The Lost & Found.
  await game(page, async () => {
    const s = window.__ainmos.state();
    const shop = await import("/js/shop/lost-found.js");
    s.glimmer = 4;
    shop.openLostFound(s);
    window.__ainmos.render();
  });
  await wait(1500);
  await snap(page, "05-lost-and-found");
  await game(page, async () => {
    const s = window.__ainmos.state();
    const shop = await import("/js/shop/lost-found.js");
    shop.closeLostFound(s);
    window.__ainmos.render();
  });
  await wait(800);

  // The Archetype Dream: choose 1 of 3.
  await game(page, () => {
    const s = window.__ainmos.state();
    s.pendingArchetypeChoice = { options: s.archetypeDeck.slice(0, 3).map((a) => a.id), round: s.round };
    window.__ainmos.render();
  });
  await wait(1500);
  await snap(page, "06-an-archetype-stirs");
  await game(page, async () => {
    const s = window.__ainmos.state();
    const ab = await import("/js/dreamers/archetype-board.js");
    ab.chooseArchetype(s, s.pendingArchetypeChoice.options[0]);
    // A Dreambeast on the board too.
    const g = await import("/js/core/game.js");
    const beast = (s.dreamDeck || []).find((c) => c.boss);
    if (beast) g.spawnEncounterOnLandscape(s, (s.board.find((t) => t.revealed && !t.center) || s.board[0]).id, { ...beast, type: "dreambeast" });
    // Meet is open, so no phase menu covers the table.
    s.phaseIndex = 2;
    s.dreamDrawn = true;
    s.meetActionBudget = 3;
    s.meetActionsUsed = 0;
    document.getElementById("utility-modal")?.classList.add("hidden");
    window.__ainmos.render();
  });
  await wait(2500);
  await clearFx(page);
  await snap(page, "07-the-table-archetype-window");

  // Meet the Archetype: its Event.
  await game(page, async () => {
    const s = window.__ainmos.state();
    const ab = await import("/js/dreamers/archetype-board.js");
    const g = await import("/js/core/game.js");
    const { arch, tile } = ab.boardArchetypes(s)[0];
    const p = s.players[0];
    p.landscapeId = tile.id;
    s.selectedLandscapeId = tile.id;
    s.phaseIndex = 2;
    s.meetActionBudget = 3;
    s.meetActionsUsed = 0;
    g.faceArchetype(s, arch.id);
    window.__ainmos.render();
  });
  await wait(3500);
  await snap(page, "08-archetype-event-bright-or-dim");

  // The fight: a spread with a Form, the Fight button under it.
  await game(page, async () => {
    const s = window.__ainmos.state();
    const mc = await import("/js/cards/mindstream-choices.js");
    const g = await import("/js/core/game.js");
    if (s.pendingMindstreamChoice) mc.resolveMindstreamChoice(s, "bad", g.getEffectHelpers());
    document.getElementById("utility-modal")?.classList.add("hidden");
    const p = s.players[0];
    const by = {};
    p.hand.forEach((c) => { if (c.type === "psyche") (by[c.value] = by[c.value] || []).push(c); });
    const pair = Object.values(by).find((a) => a.length >= 2) || p.hand.slice(0, 2);
    s.selectedHand = pair.slice(0, 2).map((c) => c.instanceId);
    window.__ainmos.render();
  });
  await wait(1500);
  await clearFx(page);
  await snap(page, "09-pick-a-spread-and-fight");

  // The dice.
  await game(page, () => {
    const s = window.__ainmos.state();
    if (s.archetypeFight) s.archetypeFight.mods = { ...(s.archetypeFight.mods || {}), dice: 24 };
    window.__ainmos.render();
    document.querySelector(".spread-fight-btn")?.click();
  });
  await wait(1300);
  await snap(page, "10-dice-battle");
  await wait(5000);
  await snap(page, "11-archetype-acquired");

  // Card details: a Dreambeast and a Dreamer.
  await game(page, async () => {
    const s = window.__ainmos.state();
    const ui = await import("/js/ui/ui.js");
    let beast = null;
    (s.board || []).forEach((t) => (t.encounters || []).forEach((e) => { beast = beast || e; }));
    beast = beast || (s.dreamDeck || []).find((c) => c.boss);
    ui.showModal(beast);
  });
  await wait(1200);
  await snap(page, "12-dreambeast-view");
  await game(page, async () => {
    const s = window.__ainmos.state();
    const ui = await import("/js/ui/ui.js");
    ui.hideModal();
    ui.showDreamerDetail(s.players[0].dreamer, { player: s.players[0], state: s });
  });
  await wait(1200);
  await snap(page, "13-dreamer-view");
  await game(page, async () => {
    const ui = await import("/js/ui/ui.js");
    ui.hideUtilityModal?.(true);
  });
  await wait(600);

  // The pause menu.
  await page.keyboard.press("Escape");
  await wait(1200);
  await snap(page, "14-pause-menu");
  await page.keyboard.press("Escape");
  await wait(800);

  await ctx.close();
}

async function phoneShots() {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await startRun(page);
  await snap(page, "20-phone-dream");
  await setup(page);
  await game(page, async () => {
    const s = window.__ainmos.state();
    const ab = await import("/js/dreamers/archetype-board.js");
    s.pendingMindstreamChoice = null;
    s.landscapePick = null;
    document.getElementById("utility-modal")?.classList.add("hidden");
    if (!ab.boardArchetypes(s).length) ab.spawnArchetype(s, s.archetypeDeck.shift());
    window.__ainmos.render();
  });
  await wait(2000);
  await snap(page, "21-phone-build-the-dream");
  await game(page, () => {
    const s = window.__ainmos.state();
    s.phaseIndex = 2;
    s.dreamDrawn = true;
    s.meetActionBudget = 3;
    s.meetActionsUsed = 0;
    document.getElementById("utility-modal")?.classList.add("hidden");
    window.__ainmos.render();
  });
  await wait(2500);
  await clearFx(page);
  await snap(page, "22-phone-table");
  await ctx.close();
}

await desktopShots();
await phoneShots();
await browser.close();
console.log(`\n${shots.length} screenshots in ${OUT}`);
