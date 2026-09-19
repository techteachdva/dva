#!/usr/bin/env node
/**
 * Search Pixabay for a better sting per landscape, download, trim, and update the manifest.
 * Run: node scripts/refresh-landscape-sfx.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "node:child_process";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..");
const OUT_DIR = path.join(REPO, "src/site/somnia/audio/landscapes");
const MANIFEST_PATH = path.join(REPO, "src/site/somnia/data/landscape-sfx.json");
const SOURCES_PATH = path.join(__dirname, "pixabay-landscape-cdn.json");
const MAX_CLIP_SEC = 2.6;

const QUERIES = {
  bed: "gentle rain on window",
  city: "city traffic street cars",
  forest: "forest birdsong nature ambient",
  house: "old house wood creaking ambient",
  road: "highway cars passing traffic",
  sky: "strong wind blowing open air",
  suburbia: "suburban neighborhood evening",
  lava: "lava bubbling magma",
  "black-void": "deep space drone ambient",
  "field-of-broken-glass": "broken glass debris crunch",
  "the-attic": "old attic wood wind",
  "the-basement": "dungeon dripping basement",
  desert: "desert wind sand dunes",
  "endless-hallway": "echo hallway footsteps",
  "the-party": "party crowd chatter",
  awards: "audience applause cheering",
  "sea-of-teeth": "underwater ambience deep",
  "endless-ocean": "ocean waves beach",
  "candy-mountain": "music box chime sparkle",
  "naked-classroom": "classroom school ambience",
  "tranquil-grove": "birds stream forest",
  "day-in-the-life": "morning birds city",
  insanity: "horror ambient drone",
  "inner-sanctum": "church bells cathedral",
  "silver-mist": "fog wind ethereal ambient",
  wasteland: "cold wind desolate howling",
};

function extractCdnUrl(html) {
  const m = html.match(/https:\/\/cdn\.pixabay\.com\/download\/audio\/[^"']+\.mp3/);
  return m?.[0]?.split("?")[0] || null;
}

async function firstSearchResult(page, query) {
  const url = `https://pixabay.com/sound-effects/search/${encodeURIComponent(query)}/`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(2500);
  const href = await page.evaluate(() => {
    const links = [...document.querySelectorAll('a[href*="/sound-effects/"]')];
    const hit = links.find((a) => /\/sound-effects\/[a-z0-9-]+-\d+\/?$/i.test(a.getAttribute("href") || ""));
    return hit ? new URL(hit.getAttribute("href"), location.origin).href : null;
  });
  if (!href) throw new Error(`no search result for "${query}"`);
  return href;
}

async function fetchCdnAndMeta(page, pageUrl) {
  let cdnUrl = null;
  const onResponse = (res) => {
    const u = res.url();
    if (u.includes("cdn.pixabay.com/download/audio/") && u.includes(".mp3")) {
      cdnUrl = u.split("?")[0];
    }
  };
  page.on("response", onResponse);
  try {
    await page.goto(pageUrl, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(4000);
    let html = await page.content();
    cdnUrl = cdnUrl || extractCdnUrl(html);
    if (!cdnUrl) {
      const btn = page.locator('button:has-text("Free download")').first();
      if (await btn.count()) {
        await btn.click({ timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(2500);
        html = await page.content();
        cdnUrl = cdnUrl || extractCdnUrl(html);
      }
    }
    const meta = await page.evaluate(() => {
      const title = document.querySelector("h1")?.textContent?.trim() || document.title.replace(" | Royalty-free Music - Pixabay", "").trim();
      const artistLink = [...document.querySelectorAll("a")].find((a) => /\/users\//.test(a.getAttribute("href") || "") && a.textContent.trim());
      return {
        title,
        artist: artistLink?.textContent.trim() || "Pixabay",
        artistUrl: artistLink ? new URL(artistLink.getAttribute("href"), location.origin).href : "https://pixabay.com/",
      };
    });
    if (!cdnUrl) throw new Error(`no CDN url on ${pageUrl}`);
    return { cdnUrl, ...meta, sourceUrl: pageUrl };
  } finally {
    page.off("response", onResponse);
  }
}

async function downloadFile(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${res.status}`);
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

function trimWithFfmpeg(src, dest) {
  let ffmpeg = "ffmpeg";
  try {
    const loc = spawnSync("node", ["-e", "console.log(require('@ffmpeg-installer/ffmpeg').path)"], { encoding: "utf8" });
    if (loc.status === 0 && loc.stdout.trim()) ffmpeg = loc.stdout.trim();
  } catch {
    /* system ffmpeg */
  }
  const fadeOutStart = Math.max(0.2, MAX_CLIP_SEC - 0.5);
  const result = spawnSync(ffmpeg, [
    "-y", "-i", src,
    "-t", String(MAX_CLIP_SEC),
    "-af", `afade=t=in:st=0:d=0.12,afade=t=out:st=${fadeOutStart}:d=0.5`,
    "-ar", "44100", "-ac", "1", "-b:a", "96k",
    dest,
  ], { stdio: "pipe" });
  if (result.status !== 0) fs.copyFileSync(src, dest);
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const previous = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
  const sources = {};
  const manifest = { ...previous };
  const failures = [];

  const browser = await chromium.launch({
    headless: true,
    channel: "chrome",
    args: ["--disable-blink-features=AutomationControlled"],
  });
  const page = await browser.newPage({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });

  for (const [id, query] of Object.entries(QUERIES)) {
    try {
      const pageUrl = await firstSearchResult(page, query);
      const meta = await fetchCdnAndMeta(page, pageUrl);
      const tmp = path.join(OUT_DIR, `_tmp-${id}.mp3`);
      const outPath = path.join(OUT_DIR, `${id}.mp3`);
      await downloadFile(meta.cdnUrl, tmp);
      trimWithFfmpeg(tmp, outPath);
      if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
      sources[id] = {
        pageUrl,
        title: meta.title,
        artist: meta.artist,
        artistUrl: meta.artistUrl,
        sourceUrl: meta.sourceUrl,
      };
      manifest[id] = {
        file: `audio/landscapes/${id}.mp3`,
        label: id.replace(/-/g, " "),
        title: meta.title,
        artist: meta.artist,
        artistUrl: meta.artistUrl,
        sourceUrl: meta.sourceUrl,
        license: "Pixabay Content License",
      };
      console.log(`OK ${id} ← ${meta.title}`);
    } catch (err) {
      failures.push({ id, error: String(err.message || err) });
      console.error(`FAIL ${id}:`, err.message || err);
    }
  }

  await browser.close();
  fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  fs.writeFileSync(SOURCES_PATH, `${JSON.stringify(sources, null, 2)}\n`, "utf8");
  console.log(`\nWrote ${MANIFEST_PATH}`);
  if (failures.length) {
    console.error(JSON.stringify({ failures }, null, 2));
    process.exitCode = 1;
  }
}

main();
