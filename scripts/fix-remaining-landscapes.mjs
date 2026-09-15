import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "../src/site/somnia/audio/landscapes");

const FIXES = {
  "black-void": "https://pixabay.com/sound-effects/synth-wind-25628/",
  "the-basement": "https://pixabay.com/sound-effects/dripping-water-tap-233602/",
  desert: "https://pixabay.com/sound-effects/desert-monolith-6369/",
  awards: "https://pixabay.com/sound-effects/applause-86759/",
  "sea-of-teeth": "https://pixabay.com/sound-effects/bone-cracking-sound-effect-6829/",
  "day-in-the-life": "https://pixabay.com/sound-effects/alarm-clock-short-6402/",
  insanity: "https://pixabay.com/sound-effects/horror-scaryviolins-6829/",
};

async function scrape(page, url) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(5000);
  const html = await page.content();
  const m = html.match(/https:\/\/cdn\.pixabay\.com\/download\/audio\/[^"']+\.mp3/);
  return m?.[0]?.split("?")[0] || null;
}

const browser = await chromium.launch({ headless: true, args: ["--disable-blink-features=AutomationControlled"] });
const page = await browser.newPage({ userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" });

for (const [id, url] of Object.entries(FIXES)) {
  try {
    const cdn = await scrape(page, url);
    if (!cdn) { console.log("FAIL", id, url); continue; }
    const res = await fetch(cdn);
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(path.join(OUT, `${id}.mp3`), buf);
    console.log("OK", id, buf.length);
  } catch (e) {
    console.log("ERR", id, e.message);
  }
}
await browser.close();
