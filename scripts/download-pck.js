#!/usr/bin/env node
/**
 * Downloads Dungeon_Class.pck and Dungeon_Class.wasm during build.
 * Use when Git LFS is off on Vercel so the real files are deployed.
 * Set Vercel env:
 *   DUNGEONCLASS_PCK_URL = https://github.com/USER/REPO/releases/download/TAG/Dungeon_Class.pck
 *   DUNGEONCLASS_WASM_URL = https://github.com/USER/REPO/releases/download/TAG/Dungeon_Class.wasm
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { URL } = require('url');

const OUT_DIR = path.join(__dirname, '..', 'src', 'site', 'dungeonclass');
const PCK_URL = process.env.DUNGEONCLASS_PCK_URL;
const WASM_URL = process.env.DUNGEONCLASS_WASM_URL;

if (!PCK_URL && !WASM_URL) {
  console.log('DUNGEONCLASS_PCK_URL and DUNGEONCLASS_WASM_URL not set — skipping (game may show ".pck file missing" unless files are in repo).');
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
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  if (PCK_URL) {
    try {
      console.log('Downloading Dungeon_Class.pck...');
      const buf = await download(PCK_URL);
      if (buf.length < 1000) {
        throw new Error(`File too small (${buf.length} bytes). Likely LFS pointer or 404.`);
      }
      fs.writeFileSync(path.join(OUT_DIR, 'Dungeon_Class.pck'), buf);
      console.log(`Wrote Dungeon_Class.pck (${(buf.length / 1024 / 1024).toFixed(1)} MB).`);
    } catch (err) {
      console.error('download-pck Dungeon_Class.pck:', err.message);
      console.warn('Build will continue using .pck from repo (if present).');
    }
  }

  if (WASM_URL) {
    try {
      console.log('Downloading Dungeon_Class.wasm...');
      const buf = await download(WASM_URL);
      if (buf.length < 1000) {
        throw new Error(`File too small (${buf.length} bytes). Likely 404.`);
      }
      fs.writeFileSync(path.join(OUT_DIR, 'Dungeon_Class.wasm'), buf);
      console.log(`Wrote Dungeon_Class.wasm (${(buf.length / 1024 / 1024).toFixed(1)} MB).`);
    } catch (err) {
      console.error('download-pck Dungeon_Class.wasm:', err.message);
      console.warn('Build will continue using .wasm from repo (if present).');
    }
  }

  process.exit(0);
})();
