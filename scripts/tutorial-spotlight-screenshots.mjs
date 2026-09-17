#!/usr/bin/env node
/**
 * Browser screenshots at every tutorial rail beat — verifies spotlight DOM targets exist.
 * Requires: npx playwright install chromium
 */
import fs from "fs";
import path from "path";
import http from "http";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..");
const SOMNIA = path.join(REPO, "src/site/somnia");
const OUT_DIR = path.join(REPO, "scripts/tutorial-spotlight-screenshots");
const LAUNCH_KEY = "somnia.launch";

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.error("Install Playwright first: npm install -D playwright && npx playwright install chromium");
  process.exit(1);
}

function contentType(filePath) {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".json")) return "application/json; charset=utf-8";
  if (filePath.endsWith(".wasm")) return "application/wasm";
  if (filePath.endsWith(".png")) return "image/png";
  if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")) return "image/jpeg";
  if (filePath.endsWith(".webp")) return "image/webp";
  if (filePath.endsWith(".svg")) return "image/svg+xml";
  if (filePath.endsWith(".mp3")) return "audio/mpeg";
  if (filePath.endsWith(".wav")) return "audio/wav";
  if (filePath.endsWith(".woff2")) return "font/woff2";
  return "application/octet-stream";
}

function startServer(root) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent(req.url.split("?")[0]);
      const rel = urlPath === "/" ? "/play.html" : urlPath;
      const filePath = path.normalize(path.join(root, rel.replace(/^\//, "")));
      if (!filePath.startsWith(root)) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
      }
      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404);
          res.end("Not found");
          return;
        }
        res.writeHead(200, { "Content-Type": contentType(filePath) });
        res.end(data);
      });
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function pad(n) {
  return String(n).padStart(2, "0");
}

async function dismissFullscreenPrompt(page) {
  const prompt = page.locator("#fullscreen-prompt");
  if (await prompt.isVisible().catch(() => false)) {
    await prompt.click();
    await page.waitForTimeout(400);
  }
}

async function launchTutorial(page, base) {
  await page.goto(`${base}/play.html`);
  await page.evaluate((key) => {
    sessionStorage.setItem(key, JSON.stringify({
      lengthKey: "daydream",
      selectedDreamerIds: ["the-visionary", "the-immovable"],
      tutorialMode: true,
      launchedAt: Date.now(),
    }));
  }, LAUNCH_KEY);
  await page.goto(`${base}/play.html`, { waitUntil: "networkidle" });
  await dismissFullscreenPrompt(page);
}

async function waitForTutorialReady(page) {
  await page.waitForSelector("#screen-game:not(.hidden)", { timeout: 45000 });
  await page.waitForSelector("#tutorial-brief:not(.hidden)", { timeout: 45000 });
  await page.click("#tutorial-brief-begin");
  await page.waitForSelector("#tutorial-overlay:not(.hidden)", { timeout: 15000 });
  await page.waitForSelector(".tutorial-spotlight:not(.hidden)", { timeout: 15000 });
}

async function readBeatInfo(page) {
  return page.evaluate(() => {
    const syncKey = window.__tutorialDebug?.();
    return syncKey;
  });
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const server = await startServer(SOMNIA);
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  const failures = [];
  const captures = [];

  await launchTutorial(page, base);
  await waitForTutorialReady(page);

  await page.exposeFunction("__reportSpotlightMiss", (detail) => {
    failures.push(detail);
  });

  await page.evaluate(() => {
    window.__tutorialDebug = () => {
      const step = window.__activeTutorialStep;
      if (!step) return null;
      const beat = step.spotlightBeat;
      const spotlightSel = step.spotlight;
      let el = null;
      if (beat?.kind === "dreamerSelect" && beat.playerId) {
        el = document.querySelector(`.hex-occupant-dreamer[data-dreamer-id="${beat.playerId}"]`)
          || document.querySelector(`.player-chip[data-player-id="${beat.playerId}"]`);
      } else if (spotlightSel) {
        el = document.querySelector(spotlightSel);
      }
      const spotlight = document.querySelector(".tutorial-spotlight:not(.hidden)");
      return {
        stepId: step.id,
        beatKind: beat?.kind || null,
        spotlightSel,
        targetFound: !!el,
        targetTag: el?.tagName || null,
        spotlightVisible: !!spotlight,
      };
    };
  });

  let lastKey = "";
  let stagnant = 0;
  let shotIndex = 0;
  const maxSteps = 80;

  console.log("Capturing tutorial spotlight screenshots…");

  while (stagnant < 24 && shotIndex < maxSteps) {
    const info = await page.evaluate(() => {
      const overlay = document.getElementById("tutorial-overlay");
      if (!overlay || overlay.classList.contains("hidden")) {
        return { done: true };
      }
      window.__activeTutorialStep = window.__lastTutorialDecoratedStep || null;
      const dbg = window.__tutorialDebug?.() || {};
      const title = document.getElementById("tutorial-title")?.textContent || "";
      const body = document.getElementById("tutorial-body")?.textContent || "";
      const hint = document.querySelector(".tutorial-next-hint")?.textContent || "";
      return { done: false, ...dbg, title, body, hint };
    });

    if (info.done) break;

    const key = `${info.stepId}:${info.beatKind}:${info.spotlightSel}:${info.hint}`;
    if (key !== lastKey) {
      stagnant = 0;
      lastKey = key;
      const slug = `${pad(shotIndex++)}_${info.stepId}_${info.beatKind || "info"}`.replace(/[^a-z0-9_-]+/gi, "-");
      const filePath = path.join(OUT_DIR, `${slug}.png`);
      await page.screenshot({ path: filePath, fullPage: false });
      captures.push({ file: path.relative(REPO, filePath), ...info });
      console.log(`  [${shotIndex}] ${info.stepId} / ${info.beatKind || "info"} → ${path.basename(filePath)}`);
      if (info.beatKind && !info.targetFound) {
        failures.push({
          msg: "spotlight selector matched no DOM node",
          ...info,
          file: path.relative(REPO, filePath),
        });
      }
      if (info.beatKind && !info.spotlightVisible) {
        failures.push({
          msg: "tutorial sparkle layer hidden during actionable beat",
          ...info,
          file: path.relative(REPO, filePath),
        });
      }
    }

    let clicked = null;
    if (!info.beatKind) {
      const next = page.locator("#tutorial-next");
      try {
        await page.waitForFunction(() => {
          const btn = document.getElementById("tutorial-next");
          return btn && !btn.disabled;
        }, { timeout: 6000 });
        await next.click();
        clicked = "continue";
      } catch {
        clicked = "waiting-continue";
      }
    } else {
      clicked = await page.evaluate(() => {
        const highlighted = document.querySelector(".tutorial-highlight");
        if (highlighted && !highlighted.disabled) {
          highlighted.click();
          return "highlight";
        }

        const step = window.__lastTutorialDecoratedStep;
        const beat = step?.spotlightBeat;
        if (!beat) return null;

        if (beat.kind === "dreamerSelect" && beat.playerId) {
          const el = document.querySelector(`.hex-occupant-dreamer[data-dreamer-id="${beat.playerId}"]`)
            || document.querySelector(`.player-chip[data-player-id="${beat.playerId}"]`);
          if (el) {
            el.click();
            return beat.kind;
          }
        }

        const sel = step.spotlight;
        const el = sel ? document.querySelector(sel) : null;
        if (el && !el.disabled) {
          el.click();
          return beat.kind;
        }
        return null;
      });
    }

    if (clicked === "waiting-continue" || !clicked) {
      stagnant += 1;
      if (stagnant % 8 === 0) {
        console.log(`  …waiting for next highlight (${stagnant}/24)`, info.stepId, info.beatKind);
      }
      await page.waitForTimeout(400);
    } else {
      stagnant = 0;
      await page.waitForTimeout(500);
    }
  }

  if (shotIndex >= maxSteps) {
    failures.push({ msg: "screenshot walk stopped at maxSteps", maxSteps });
  }

  await browser.close();
  server.close();

  const report = {
    generatedAt: new Date().toISOString(),
    captureCount: captures.length,
    failures,
    captures,
    pass: failures.length === 0,
    outDir: path.relative(REPO, OUT_DIR),
  };

  fs.writeFileSync(
    path.join(REPO, "scripts/tutorial-spotlight-screenshots-report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );

  console.log(JSON.stringify({
    pass: report.pass,
    captureCount: captures.length,
    failureCount: failures.length,
    failures,
    outDir: report.outDir,
  }, null, 2));

  if (!report.pass) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
