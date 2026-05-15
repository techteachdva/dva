/**
 * Download Physix game binaries from GitHub Releases during Vercel build.
 *
 * Set these environment variables in Vercel:
 *   PHYSIX_PCK_URL  = https://github.com/OWNER/REPO/releases/download/TAG/Physix.pck
 *   PHYSIX_WASM_URL = https://github.com/OWNER/REPO/releases/download/TAG/Physix.wasm
 *
 * The script places them in web/ alongside the exported HTML/JS files.
 */

const https = require("https");
const fs = require("fs");
const path = require("path");

const OUT_DIR = path.join(__dirname, "..", "web");
const MAX_REDIRECTS = 5;
const MIN_BYTES = 1024; // reject LFS pointers or 404 pages

function download(url, dest) {
  return new Promise((resolve, reject) => {
    let redirects = 0;

    function doRequest(targetUrl) {
      const req = https.get(targetUrl, { timeout: 60000 }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          redirects++;
          if (redirects > MAX_REDIRECTS) {
            reject(new Error(`Too many redirects for ${url}`));
            return;
          }
          doRequest(res.headers.location);
          return;
        }

        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`HTTP ${res.statusCode} for ${url}`));
          return;
        }

        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const buffer = Buffer.concat(chunks);
          if (buffer.length < MIN_BYTES) {
            reject(new Error(`File too small (${buffer.length} B) — possible LFS pointer or 404 for ${url}`));
            return;
          }
          fs.mkdirSync(path.dirname(dest), { recursive: true });
          fs.writeFileSync(dest, buffer);
          const mb = (buffer.length / (1024 * 1024)).toFixed(2);
          console.log(`Downloaded ${path.basename(dest)} (${mb} MB)`);
          resolve();
        });
      });

      req.on("error", (err) => reject(err));
      req.on("timeout", () => {
        req.destroy();
        reject(new Error(`Request timeout for ${url}`));
      });
    }

    doRequest(url);
  });
}

async function main() {
  const pckUrl = process.env.PHYSIX_PCK_URL;
  const wasmUrl = process.env.PHYSIX_WASM_URL;

  if (!pckUrl && !wasmUrl) {
    console.log("PHYSIX_PCK_URL and PHYSIX_WASM_URL not set — skipping binary download.");
    console.log("Place your .pck and .wasm in web/ manually, or set the env vars.");
    return;
  }

  const tasks = [];
  if (pckUrl) {
    tasks.push(download(pckUrl, path.join(OUT_DIR, "index.pck")));
  }
  if (wasmUrl) {
    tasks.push(download(wasmUrl, path.join(OUT_DIR, "index.wasm")));
  }

  try {
    await Promise.all(tasks);
    console.log("Physix binaries ready in web/");
  } catch (err) {
    console.error("Download failed:", err.message);
    process.exit(1);
  }
}

main();
