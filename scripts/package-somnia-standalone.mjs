#!/usr/bin/env node
/**
 * Build a self-contained Somnia folder + zip for itch.io HTML5 upload.
 *
 * Output:
 *   dist/somnia-standalone/     playable folder (index.html at root)
 *   dist/somnia-standalone.zip  upload this to itch.io
 *
 * Usage: npm run package:somnia-standalone
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..");
const SOURCE = path.join(REPO, "src/site/somnia");
const OUT_DIR = path.join(REPO, "dist/somnia-standalone");
const OUT_ZIP = path.join(REPO, "dist/somnia-standalone.zip");

const GOOGLE_FONTS_CSS =
  "https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Kalnia+Glaze&family=Source+Sans+3:wght@400;600&display=swap";

const FONT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const HTML_FILES = [
  { file: "index.html", module: "js/setup.js" },
  { file: "play.html", module: "js/play.js" },
];

const FILE_PROTOCOL_WARNING = String.raw`<div id="file-protocol-warning" style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:2rem;background:#0b0a14;color:#e8e4ff;font-family:system-ui,sans-serif;text-align:center">
  <div style="max-width:40rem">
    <h1 style="font-size:1.75rem;margin:0 0 1rem">Open Somnia with the launcher</h1>
    <p style="line-height:1.6;color:#9b93c4;margin:0 0 1rem">
      This game cannot run when opened directly from a folder (<code style="color:#c9a0ff">file://</code>).
      Browsers block its scripts for security.
    </p>
    <p style="line-height:1.6;margin:0 0 1rem">
      <strong style="color:#c9a0ff">Windows:</strong> double-click <strong>Start Somnia.bat</strong><br>
      <strong style="color:#c9a0ff">macOS:</strong> double-click <strong>Start Somnia.command</strong>
    </p>
    <p style="line-height:1.6;color:#9b93c4;margin:0">
      On itch.io, the game runs in your browser over HTTPS and does not need the launcher.
    </p>
  </div>
</div>`;

function rimraf(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
}

function injectBootLoader(html, moduleSrc) {
  const bootScript = `<script>
(function () {
  if (location.protocol === "file:") {
    function mount() {
      document.body.innerHTML = ${JSON.stringify(FILE_PROTOCOL_WARNING)};
      document.title = "Somnia — use Start Somnia.bat";
    }
    if (document.body) mount();
    else document.addEventListener("DOMContentLoaded", mount);
    return;
  }
  var el = document.createElement("script");
  el.type = "module";
  el.src = ${JSON.stringify(`./${moduleSrc}`)};
  document.body.appendChild(el);
})();
</script>`;

  const pattern = `<script type="module" src="${moduleSrc}"></script>`;
  if (!html.includes(pattern)) {
    throw new Error(`Expected module tag not found: ${moduleSrc}`);
  }
  return html.replace(pattern, bootScript);
}

function patchAssetPaths(html) {
  return html
    .replace(/href="css\//g, 'href="./css/')
    .replace(/src="images\//g, 'src="./images/')
    .replace(/href="images\//g, 'href="./images/');
}

function patchHtml(filePath, moduleSrc) {
  let html = fs.readFileSync(filePath, "utf8");

  if (!html.includes('name="somnia-standalone"')) {
    html = html.replace(
      /<meta charset="UTF-8">/,
      '<meta charset="UTF-8">\n  <meta name="somnia-standalone" content="1">'
    );
  }

  if (!html.includes("<base ")) {
    html = html.replace(
      /<meta name="viewport"/,
      '<base href="./">\n  <meta name="viewport"'
    );
  }

  html = html.replace(
    /<!--[^>]*fonts[^>]*-->\s*/gi,
    ""
  );

  html = html.replace(
    /<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com">\s*/g,
    ""
  );
  html = html.replace(
    /<link rel="preconnect" href="https:\/\/fonts\.gstatic\.com" crossorigin>\s*/g,
    ""
  );
  html = html.replace(
    /<link href="https:\/\/fonts\.googleapis\.com\/css2[^"]+" rel="stylesheet">\s*/g,
    '<link rel="stylesheet" href="./css/fonts-local.css">\n  '
  );

  html = patchAssetPaths(html);

  if (filePath.endsWith("play.html")) {
    html = html.replace("<h3>Leaderboard</h3>", "<h3>Local High Scores</h3>");
    html = html.replace(
      "Enter your name to save your score.",
      "Enter your name to save on this device."
    );
  }

  html = injectBootLoader(html, moduleSrc);
  fs.writeFileSync(filePath, html, "utf8");
}

function writeLaunchers(outDir) {
  fs.copyFileSync(
    path.join(REPO, "scripts/somnia-standalone-server.ps1"),
    path.join(outDir, "somnia-server.ps1")
  );
  fs.copyFileSync(
    path.join(REPO, "scripts/somnia-standalone-launch.bat"),
    path.join(outDir, "Start Somnia.bat")
  );
  fs.copyFileSync(
    path.join(REPO, "scripts/somnia-standalone-launch.command"),
    path.join(outDir, "Start Somnia.command")
  );
}

async function downloadFonts(outDir) {
  const fontsDir = path.join(outDir, "fonts");
  fs.mkdirSync(fontsDir, { recursive: true });

  console.log("Downloading web fonts…");
  const cssRes = await fetch(GOOGLE_FONTS_CSS, {
    headers: { "User-Agent": FONT_USER_AGENT },
  });
  if (!cssRes.ok) {
    throw new Error(`Could not fetch Google Fonts CSS (${cssRes.status}).`);
  }

  let css = await cssRes.text();
  const urlMatches = [...css.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)];
  if (!urlMatches.length) {
    throw new Error("No font URLs found in Google Fonts CSS.");
  }

  const urlToLocal = new Map();
  let index = 0;
  for (const match of urlMatches) {
    const remoteUrl = match[1];
    if (urlToLocal.has(remoteUrl)) continue;

    const ext = remoteUrl.includes(".woff2") ? "woff2" : "woff";
    const localName = `font-${index}.${ext}`;
    index += 1;

    const fontRes = await fetch(remoteUrl);
    if (!fontRes.ok) {
      throw new Error(`Could not download font (${fontRes.status}): ${remoteUrl}`);
    }
    const buffer = Buffer.from(await fontRes.arrayBuffer());
    fs.writeFileSync(path.join(fontsDir, localName), buffer);
    urlToLocal.set(remoteUrl, `../fonts/${localName}`);
    console.log(`  ${localName}`);
  }

  for (const [remoteUrl, localPath] of urlToLocal) {
    css = css.split(remoteUrl).join(localPath);
  }

  const localCssPath = path.join(outDir, "css/fonts-local.css");
  fs.writeFileSync(localCssPath, css, "utf8");
  console.log(`Wrote ${path.relative(REPO, localCssPath)}`);
}

function writeManifest(outDir) {
  const manifest = {
    name: "Somnia",
    version: "14.8",
    standalone: true,
    packagedAt: new Date().toISOString(),
    leaderboard: "local",
  };
  fs.writeFileSync(
    path.join(outDir, "standalone.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8"
  );
}

function zipOutput() {
  rimraf(OUT_ZIP);
  fs.mkdirSync(path.dirname(OUT_ZIP), { recursive: true });

  if (process.platform === "win32") {
    execFileSync(
      "powershell",
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        path.join(REPO, "scripts/zip-forward-slash.ps1"),
        "-Root",
        OUT_DIR,
        "-ZipPath",
        OUT_ZIP,
      ],
      { stdio: "inherit" }
    );
  } else {
    try {
      execFileSync("zip", ["-r", OUT_ZIP, "."], { cwd: OUT_DIR, stdio: "inherit" });
    } catch {
      throw new Error("Could not create zip. Install zip or run on Windows.");
    }
  }

  validateZipPaths();
}

function validateZipPaths() {
  const buf = fs.readFileSync(OUT_ZIP);
  const bad = [];
  for (let i = 0; i < buf.length - 4; i += 1) {
    if (buf[i] !== 0x50 || buf[i + 1] !== 0x4b || buf[i + 2] !== 0x03 || buf[i + 3] !== 0x04) continue;
    const fnLen = buf.readUInt16LE(i + 26);
    const extraLen = buf.readUInt16LE(i + 28);
    const compSize = buf.readUInt32LE(i + 18);
    const name = buf.slice(i + 30, i + 30 + fnLen).toString("utf8");
    if (name.includes("\\") || name.endsWith("/")) bad.push(name);
    i += 30 + fnLen + extraLen + compSize - 1;
  }
  if (bad.length) {
    throw new Error(`Zip has invalid itch.io paths: ${bad.slice(0, 5).join(", ")}`);
  }
}

function countFiles(dir) {
  let count = 0;
  let bytes = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = countFiles(full);
      count += nested.count;
      bytes += nested.bytes;
    } else {
      count += 1;
      bytes += fs.statSync(full).size;
    }
  }
  return { count, bytes };
}

async function main() {
  if (!fs.existsSync(SOURCE)) {
    throw new Error(`Somnia source not found: ${SOURCE}`);
  }

  console.log("Packaging Somnia standalone build…");
  rimraf(OUT_DIR);
  copyDir(SOURCE, OUT_DIR);

  for (const { file, module } of HTML_FILES) {
    patchHtml(path.join(OUT_DIR, file), module);
  }

  await downloadFonts(OUT_DIR);
  writeLaunchers(OUT_DIR);
  writeManifest(OUT_DIR);
  zipOutput();

  const { count, bytes } = countFiles(OUT_DIR);
  const sizeMb = (bytes / (1024 * 1024)).toFixed(1);
  const zipMb = fs.existsSync(OUT_ZIP)
    ? (fs.statSync(OUT_ZIP).size / (1024 * 1024)).toFixed(1)
    : "?";

  console.log("");
  console.log("Done.");
  console.log(`  Folder: ${path.relative(REPO, OUT_DIR)} (${count} files, ${sizeMb} MB)`);
  console.log(`  Zip:    ${path.relative(REPO, OUT_ZIP)} (${zipMb} MB)`);
  console.log("");
  console.log("Local test (do not open index.html directly):");
  console.log(`  Double-click ${path.join(path.relative(REPO, OUT_DIR), "Start Somnia.bat")}`);
  console.log("  Or: npx serve dist/somnia-standalone");
  console.log("");
  console.log("itch.io upload:");
  console.log("  1. Create project → Kind of project: HTML");
  console.log("  2. Upload dist/somnia-standalone.zip");
  console.log("  3. Check “This file will be played in the browser”");
  console.log("  4. Set index.html as the page to run (should auto-detect)");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
