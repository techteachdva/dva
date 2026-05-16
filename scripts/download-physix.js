#!/usr/bin/env node
/**
 * Downloads Physix index.pck, index.wasm, and optional index.side.wasm during build.
 * Mirrors Crystal Wizards / Dungeon Class — binaries stay off GitHub; CI pulls from Releases.
 *
 * Vercel (or local) env:
 *   PHYSIX_PCK_URL = https://.../index.pck (or GitHub Release asset URL)
 *   PHYSIX_WASM_URL = https://.../index.wasm
 *   PHYSIX_SIDE_WASM_URL = https://.../index.side.wasm (optional; required if export uses GDExtensions side module)
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { URL } = require('url');

const OUT_DIR = path.join(__dirname, '..', 'src', 'site', 'physix');
const PCK_URL = process.env.PHYSIX_PCK_URL;
const WASM_URL = process.env.PHYSIX_WASM_URL;
const SIDE_WASM_URL = process.env.PHYSIX_SIDE_WASM_URL;

if (!PCK_URL && !WASM_URL && !SIDE_WASM_URL) {
  console.log(
    'PHYSIX_PCK_URL, PHYSIX_WASM_URL, PHYSIX_SIDE_WASM_URL not set — skipping (place binaries locally or game fails unless files exist).'
  );
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
      headers: { 'User-Agent': 'Node-download-physix (Vercel build)' },
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
      console.log('Downloading Physix index.pck...');
      const buf = await download(PCK_URL);
      if (buf.length < 1000) {
        throw new Error(`File too small (${buf.length} bytes). Likely LFS pointer or 404.`);
      }
      fs.writeFileSync(path.join(OUT_DIR, 'index.pck'), buf);
      console.log(`Wrote index.pck (${(buf.length / 1024 / 1024).toFixed(1)} MB).`);
    } catch (err) {
      console.error('download-physix pck:', err.message);
    }
  }

  if (WASM_URL) {
    try {
      console.log('Downloading Physix index.wasm...');
      const buf = await download(WASM_URL);
      if (buf.length < 1000) {
        throw new Error(`File too small (${buf.length} bytes).`);
      }
      fs.writeFileSync(path.join(OUT_DIR, 'index.wasm'), buf);
      console.log(`Wrote index.wasm (${(buf.length / 1024 / 1024).toFixed(1)} MB).`);
    } catch (err) {
      console.error('download-physix wasm:', err.message);
    }
  }

  if (SIDE_WASM_URL) {
    try {
      console.log('Downloading Physix index.side.wasm...');
      const buf = await download(SIDE_WASM_URL);
      if (buf.length < 1000) {
        throw new Error(`File too small (${buf.length} bytes).`);
      }
      fs.writeFileSync(path.join(OUT_DIR, 'index.side.wasm'), buf);
      console.log(`Wrote index.side.wasm (${(buf.length / 1024).toFixed(1)} KB).`);
    } catch (err) {
      console.error('download-physix index.side.wasm:', err.message);
    }
  }

  process.exit(0);
})();
