/**
 * Ainmos 0.30 story check: the smart bot plays a whole Daydream in the browser,
 * then the end credits tell its story. Saves the story text and screenshots of
 * the crawl. Needs ainmos-static on :8788.
 *
 *   node scripts/ainmos-030-story-check.mjs [baseUrl] [outDir] [lengthKey]
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const BASE = process.argv[2] || "http://localhost:8788";
const OUT = resolve(process.argv[3] || "promo/ainmos-030-story");
const LENGTH = process.argv[4] || "daydream";
mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ channel: "msedge" }).catch(() => chromium.launch());
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto(`${BASE}/index.html?dev=1`);
await page.evaluate(() => { try { localStorage.clear(); } catch { /* fresh */ } });
await page.goto(`${BASE}/index.html?dev=1`);
await wait(2000);
await page.evaluate((len) => {
  const img = [...document.querySelectorAll("img")].find((el) => el.alt === "The Weaver");
  (img?.closest("button, [role=button], .dreamer-card, .setup-dreamer") || img)?.click();
  const sel = document.getElementById("setup-length");
  if (sel) { sel.value = len; sel.dispatchEvent(new Event("change", { bubbles: true })); }
  const seed = document.getElementById("setup-seed");
  if (seed) { seed.value = "STORY-0001"; seed.dispatchEvent(new Event("input", { bubbles: true })); }
}, LENGTH);
await wait(300);
await page.evaluate(() => [...document.querySelectorAll("button")].find((el) => /Begin Dreaming/i.test(el.textContent))?.click());
await page.waitForURL(/play.html/, { timeout: 20000 });
await page.waitForFunction(() => !!window.__ainmos?.state(), null, { timeout: 20000 });
await wait(1500);

// The bot plays headless-fast inside the page; the table re-renders at the end.
const result = await page.evaluate(async () => {
  globalThis.__SOMNIA_INSTANT_DICE__ = true;
  const auto = await import("./js/dev/autoplay.js");
  auto.configureAutoplay({});
  const s = window.__ainmos.state();
  document.body.classList.remove("opening-cinematic-pending");
  const memo = {};
  let steps = 0;
  while (s.status === "playing" && steps < 20000) {
    if (!auto.stepAutoplay(s, memo)) break;
    steps += 1;
  }
  return { steps, status: s.status, round: s.round, acquired: s.acquiredPoints, events: s.chronicle?.events?.length || 0 };
});
console.log("bot", JSON.stringify(result));
const story = await page.evaluate(async () => {
  const m = await import("./js/meta/dream-story.js");
  const sc = await import("./js/core/scoring.js");
  const s = window.__ainmos.state();
  return m.dreamStoryText(s, sc.calculateFinalScore(s));
});
writeFileSync(`${OUT}/story.txt`, story);
console.log(`story: ${story.split("\n").length} lines, ${story.split(/\s+/).length} words`);

// Force the credits even on a loss, to look at the crawl.
await page.evaluate(async () => {
  const c = await import("./js/ui/dream-credits.js");
  const sc = await import("./js/core/scoring.js");
  const s = window.__ainmos.state();
  c.showDreamCredits(s, sc.calculateFinalScore(s));
});
await page.waitForSelector(".dc-anagram.is-morphing", { timeout: 20000 }).catch(() => {});
await wait(1100);
await page.screenshot({ path: `${OUT}/crawl-1-morphing.png` });
await page.waitForSelector(".dc-anagram.is-somnia", { timeout: 8000 }).catch(() => {});
await wait(300);
await page.screenshot({ path: `${OUT}/crawl-2-somnia.png` });
const word = await page.evaluate(() => {
  const letters = [...document.querySelectorAll(".dc-anagram .dc-letter")];
  return letters.map((el) => ({ ch: el.textContent, x: el.getBoundingClientRect().left })).sort((a, b) => a.x - b.x).map((l) => l.ch).join("");
});
console.log("title word reads", word);
await wait(9000);
await page.screenshot({ path: `${OUT}/crawl-3.png` });
console.log(errors.length ? `ERRORS ${errors.slice(0, 3).join(" | ")}` : "no page errors");
await browser.close();
