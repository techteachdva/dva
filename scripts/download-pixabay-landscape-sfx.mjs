#!/usr/bin/env node
/**
 * Download landscape stings from Pixabay CDN (via Playwright page scrape).
 * Run: node scripts/download-pixabay-landscape-sfx.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..");
const OUT_DIR = path.join(REPO, "src/site/somnia/audio/landscapes");
const SOURCES_PATH = path.join(__dirname, "pixabay-landscape-cdn.json");
const MANIFEST_PATH = path.join(REPO, "src/site/somnia/data/landscape-sfx.json");

const MAX_CLIP_SEC = 4;

function extractCdnUrl(html) {
  const m = html.match(/https:\/\/cdn\.pixabay\.com\/download\/audio\/[^"']+\.mp3/);
  return m?.[0]?.split("?")[0] || null;
}

async function fetchCdnUrl(page, pageUrl) {
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
    await page.waitForTimeout(5000);
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
  } finally {
    page.off("response", onResponse);
  }
  if (!cdnUrl) throw new Error(`no CDN url on ${pageUrl}`);
  return cdnUrl;
}

async function downloadFile(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(dest, buf);
  return buf.length;
}

async function trimWithFfmpeg(src, dest, seconds = MAX_CLIP_SEC) {
  const { spawnSync } = await import("node:child_process");
  const result = spawnSync("ffmpeg", [
    "-y", "-i", src,
    "-t", String(seconds),
    "-af", "afade=t=out:st=" + String(Math.max(0, seconds - 0.4)) + ":d=0.4",
    "-ar", "44100", "-ac", "1",
    dest,
  ], { stdio: "pipe" });
  if (result.status !== 0) {
    fs.copyFileSync(src, dest);
  }
}

async function main() {
  const sources = JSON.parse(fs.readFileSync(SOURCES_PATH, "utf8"));
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-blink-features=AutomationControlled"],
  });
  const page = await browser.newPage({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });
  const manifest = {};
  const failures = [];

  for (const [id, meta] of Object.entries(sources)) {
    const outFile = `${id}.mp3`;
    const outPath = path.join(OUT_DIR, outFile);
    const sourceUrl = meta.sourceUrl || meta.pageUrl;
    try {
      if (!meta.skip) {
        const cdnUrl = meta.cdnUrl || await fetchCdnUrl(page, meta.pageUrl);
        const tmp = path.join(OUT_DIR, `_tmp-${id}.mp3`);
        await downloadFile(cdnUrl, tmp);
        await trimWithFfmpeg(tmp, outPath);
        if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
        console.log(`OK ${id}`);
      } else if (!fs.existsSync(outPath)) {
        throw new Error("user file missing");
      } else {
        console.log(`SKIP ${id}`);
      }
      manifest[id] = {
        file: `audio/landscapes/${outFile}`,
        label: id.replace(/-/g, " "),
        title: meta.title,
        artist: meta.artist,
        artistUrl: meta.artistUrl,
        sourceUrl,
        license: "Pixabay Content License",
      };
    } catch (err) {
      failures.push({ id, error: String(err.message || err) });
      console.error(`FAIL ${id}:`, err.message || err);
      const wav = path.join(OUT_DIR, `${id}.wav`);
      if (fs.existsSync(wav)) {
        manifest[id] = {
          file: `audio/landscapes/${id}.wav`,
          label: id.replace(/-/g, " "),
          title: meta.title,
          artist: meta.artist,
          artistUrl: meta.artistUrl,
          sourceUrl,
          license: "Pixabay Content License (fallback: procedural placeholder)",
        };
      }
    }
  }

  await browser.close();
  fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`\nWrote ${MANIFEST_PATH}`);
  if (failures.length) {
    console.error(JSON.stringify({ failures }, null, 2));
    process.exitCode = 1;
  }
}

main();
