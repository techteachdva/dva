/**
 * Ainmos 0.26 browser check: free base Actions on the phase opener, the top-up
 * button, the death notice, and The One's Mimic choice. Needs the static server.
 *
 *   node scripts/ainmos-026-check.mjs [baseUrl] [outDir]
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const BASE = process.argv[2] || "http://localhost:8788";
const OUT = resolve(process.argv[3] || "promo/ainmos-026-check");
mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ channel: "msedge" }).catch(() => chromium.launch());
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errors.push(`${m.text()} ${m.location()?.url || ""}`); });
ctx.on("response", (r) => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
ctx.on("requestfailed", (r) => errors.push(`failed ${r.url()}`));

async function snap(name) {
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log("saved", name);
}
const g = (fn, arg) => page.evaluate(fn, arg);

await page.goto(`${BASE}/index.html`);
await g(() => { try { localStorage.clear(); } catch { /* fresh */ } });
await page.goto(`${BASE}/index.html`);
await wait(2500);
await g(() => {
  const img = [...document.querySelectorAll("img")].find((el) => el.alt === "The Rested");
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
await g(() => {
  document.body.classList.remove("opening-cinematic-pending");
  const s = window.__ainmos.state();
  s.anteIntroSeen = 99;
  s.pendingMindstreamChoice = null;
  s.pendingEffectChoice = null;
  window.__ainmos.render();
});
await wait(1500);
// Endure the opening Dream (and any follow-up choice) so the Reveal opener comes up.
for (let i = 0; i < 6; i += 1) {
  const clicked = await g(() => {
    const btn = document.querySelector("#utility-modal:not(.hidden) .ms-choice-btn, #utility-modal:not(.hidden) .effect-choice-btn");
    if (!btn || document.querySelector("#phase-opener-menu")) return false;
    btn.click();
    return true;
  });
  if (!clicked) break;
  await wait(1800);
}
await wait(1000);

// 1) The Reveal opener: free Actions from Lucidity, nothing selected.
const opener = await g(() => {
  const s = window.__ainmos.state();
  return {
    phase: ["Reveal", "Explore", "Meet"][s.phaseIndex],
    lead: document.querySelector("#phase-opener-menu .fullscreen-browser-lead")?.textContent || "",
    confirm: document.querySelector("#btn-spread-opener")?.textContent.trim() || "",
    disabled: document.querySelector("#btn-spread-opener")?.disabled,
    preview: document.querySelector(".phase-opener-preview")?.textContent.replace(/\s+/g, " ").trim() || "",
  };
});
console.log("opener", opener);
await snap("01-reveal-opener-free");

// 2) Select a Lucidity card: the opener adds its value.
await g(() => {
  const el = document.querySelector("#phase-opener-menu .opener-usable");
  el?.click();
});
await wait(500);
const withCard = await g(() => ({
  confirm: document.querySelector("#btn-spread-opener")?.textContent.trim() || "",
  preview: document.querySelector(".phase-opener-preview")?.textContent.replace(/\s+/g, " ").trim() || "",
}));
console.log("with card", withCard);
await snap("02-reveal-opener-with-card");

// 3) Deselect and take the free Actions; then the top-up button appears once a card is chosen.
await g(() => {
  const s = window.__ainmos.state();
  s.selectedHand = [];
  window.__ainmos.render();
});
await wait(400);
await g(() => document.querySelector("#btn-spread-opener")?.click());
await wait(1200);
const afterFree = await g(async () => {
  const s = window.__ainmos.state();
  const game = await import("/js/core/game.js");
  const rules = await import("/js/core/rules.js");
  const p = s.players[0];
  const luc = p.hand.find((c) => rules.cardCountsAsSuit(c, "lucidity", s));
  if (luc) s.selectedHand = [luc.instanceId];
  window.__ainmos.render();
  await new Promise((r) => setTimeout(r, 300));
  return {
    pick: s.landscapePick?.remaining,
    bought: game.boughtActionsThisPhase(s),
    topUp: game.phaseTopUpValue(s),
    topUpButton: [...document.querySelectorAll("button")].map((b) => b.textContent.trim()).filter((t) => /Spend for \+/.test(t)),
    budgetChip: document.querySelector(".turn-plaque")?.textContent.replace(/\s+/g, " ").trim() || "",
  };
});
console.log("after free open", afterFree);
await snap("03-reveal-free-open-topup");

// 3b) The Vault offers "+N" top-ups; use one.
await g(() => { window.__ainmos.state().selectedHand = []; window.__ainmos.render(); });
await wait(600);
const vaultTopUps = await g(() => [...document.querySelectorAll("[data-vs-topup]")].map((b) => b.textContent.trim()));
console.log("vault top-ups", vaultTopUps);
await snap("03b-vault-topup-row");
await g(() => document.querySelector("[data-vs-topup]")?.click());
await wait(800);
console.log("after vault top-up", await g(async () => {
  const s = window.__ainmos.state();
  const game = await import("/js/core/game.js");
  return { pick: s.landscapePick?.remaining, bought: game.boughtActionsThisPhase(s), rowGone: !document.querySelector("[data-vs-topup]") };
}));

// 3c) Explore: open free, then the table shows a top-up action once an Elasticity card is chosen.
await g(async () => {
  const s = window.__ainmos.state();
  const game = await import("/js/core/game.js");
  s.landscapePick = null;
  s.revealLandscapeUsed = true;
  game.endPhase(s);
  window.__ainmos.render();
});
await wait(1500);
console.log("explore opener", await g(() => ({
  confirm: document.querySelector("#btn-spread-opener")?.textContent.trim() || "",
  lead: document.querySelector("#phase-opener-menu .fullscreen-browser-lead")?.textContent || "",
})));
await snap("03c-explore-opener");
await g(() => document.querySelector("#btn-spread-opener")?.click());
await wait(1200);
console.log("explore after free", await g(async () => {
  const s = window.__ainmos.state();
  const rules = await import("/js/core/rules.js");
  const p = s.players[0];
  const ela = p.hand.find((c) => rules.cardCountsAsSuit(c, "elasticity", s));
  if (ela) s.selectedHand = [ela.instanceId];
  window.__ainmos.render();
  await new Promise((r) => setTimeout(r, 400));
  return {
    moves: s.exploreMovesLeft,
    buttons: [...document.querySelectorAll("button")].map((b) => b.textContent.trim()).filter((t) => /Spend for/.test(t)),
  };
}));
await snap("03d-explore-topup");

// 4) Death notice.
await g(async () => {
  const s = window.__ainmos.state();
  const st = await import("/js/core/state.js");
  s.selectedHand = [];
  s.landscapePick = null;
  const p = s.players[0];
  const deck = s.objectDecks.lucidity;
  const head = deck.findIndex((o) => o.id === "severed-head");
  if (head >= 0) p.persistent.push(deck.splice(head, 1)[0]);
  p.powerTokens = 3;
  p.hand = [];
  st.applyDreamerDeath(s, p);
  window.__ainmos.render();
});
await wait(1500);
const death = await g(() => ({
  text: document.querySelector("#utility-modal")?.textContent.replace(/\s+/g, " ").trim().slice(0, 400) || "",
  tokens: window.__ainmos.state().players[0].powerTokens,
}));
console.log("death", death);
await snap("04-death-notice");

console.log("errors", errors);
await browser.close();
