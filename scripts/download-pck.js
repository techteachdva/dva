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
const { URL } = require('url');

const OUT_DIR = path.join(__dirname, '..', 'src', 'site', 'dungeonclass');
const OUT_FILE = path.join(OUT_DIR, 'Dungeon_Class.pck');
const ENV_URL = process.env.DUNGEONCLASS_PCK_URL;

if (!ENV_URL) {
  console.log('DUNGEONCLASS_PCK_URL not set — skipping .pck download (game may show " .pck file missing" unless LFS is on).');
  process.exit(0);
}

function download(url, redirectCount = 0) {
  const MAX_REDIRECTS = 5;
  if (redirectCount > MAX_REDIRECTS) {
    return Promise.reject(new Error('Too many redirects'));
  }
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const client = parsed.protocol === 'https:' ? https : http;
    const opts = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers: { 'User-Agent': 'Node-download-pck (Vercel build)' },
    };
    if (parsed.port) opts.port = parsed.port;
    const req = client.request(opts, (res) => {
      const loc = res.headers.location;
      if (loc && (res.statusCode === 301 || res.statusCode === 302)) {
        const next = loc.startsWith('http') ? loc : new URL(loc, url).href;
        return download(next, redirectCount + 1).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        reject(new Error(`Download failed: ${res.statusCode} ${res.statusMessage} for ${url}`));
        return;
      }
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.end();
  });
}

(async () => {
  try {
    if (!fs.existsSync(OUT_DIR)) {
      fs.mkdirSync(OUT_DIR, { recursive: true });
    }
    console.log('Downloading Dungeon_Class.pck from DUNGEONCLASS_PCK_URL...');
    const buf = await download(ENV_URL);
    if (buf.length < 1000) {
      throw new Error(`Downloaded file is too small (${buf.length} bytes). Likely an LFS pointer or 404 page. Use a URL to the real .pck (e.g. GitHub Release asset).`);
    }
    fs.writeFileSync(OUT_FILE, buf);
    console.log(`Wrote ${OUT_FILE} (${(buf.length / 1024 / 1024).toFixed(1)} MB).`);
  } catch (err) {
    console.error("download-pck failed:", err.message);
    console.warn("Build will continue using .pck from repo (if present). Remove or fix DUNGEONCLASS_PCK_URL in Vercel to avoid this.");
    process.exit(0);  // Don't fail build - use existing .pck in repo
  }
})();
