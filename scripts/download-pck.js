#!/usr/bin/env node
/**
 * Downloads Dungeon_Class.pck from DUNGEONCLASS_PCK_URL during build.
 * Use this when Git LFS is off on Vercel so the real .pck is deployed.
 * Set Vercel env: DUNGEONCLASS_PCK_URL = https://github.com/USER/REPO/releases/download/TAG/Dungeon_Class.pck
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const OUT_DIR = path.join(__dirname, '..', 'src', 'site', 'dungeonclass');
const OUT_FILE = path.join(OUT_DIR, 'Dungeon_Class.pck');
const URL = process.env.DUNGEONCLASS_PCK_URL;

if (!URL) {
  console.log('DUNGEONCLASS_PCK_URL not set — skipping .pck download (game may show " .pck file missing" unless LFS is on).');
  process.exit(0);
}

function download(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, { followRedirect: true }, (res) => {
      const redirect = res.headers.location;
      if (redirect && (res.statusCode === 301 || res.statusCode === 302)) {
        return download(redirect).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        reject(new Error(`Download failed: ${res.statusCode} ${res.statusMessage}`));
        return;
      }
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

(async () => {
  try {
    if (!fs.existsSync(OUT_DIR)) {
      fs.mkdirSync(OUT_DIR, { recursive: true });
    }
    console.log('Downloading Dungeon_Class.pck from DUNGEONCLASS_PCK_URL...');
    const buf = await download(URL);
    if (buf.length < 1000) {
      throw new Error(`Downloaded file is too small (${buf.length} bytes). Likely an LFS pointer or 404 page. Use a URL to the real .pck (e.g. GitHub Release asset).`);
    }
    fs.writeFileSync(OUT_FILE, buf);
    console.log(`Wrote ${OUT_FILE} (${(buf.length / 1024 / 1024).toFixed(1)} MB).`);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
})();
