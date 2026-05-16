#!/usr/bin/env node
/**
 * Downloads Physix binaries during build into src/site/physix/.
 * Expected filenames match GODOT_CONFIG in physix.html (executable "physix"):
 *   physix.pck, physix.wasm, optional physix.side.wasm
 *
 * Release assets on GitHub may be named index.pck / index.wasm — that is fine;
 * URLs point to those files; this script saves them as physix.* locally.
 *
 * Vercel env:
 *   PHYSIX_PCK_URL, PHYSIX_WASM_URL, PHYSIX_SIDE_WASM_URL (optional)
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
      console.log('Downloading Physix pack → physix.pck ...');
      const buf = await download(PCK_URL);
      if (buf.length < 1000) {
        throw new Error(`File too small (${buf.length} bytes). Likely LFS pointer or 404.`);
      }
      fs.writeFileSync(path.join(OUT_DIR, 'physix.pck'), buf);
      console.log(`Wrote physix.pck (${(buf.length / 1024 / 1024).toFixed(1)} MB).`);
    } catch (err) {
      console.error('download-physix pck:', err.message);
    }
  }

  if (WASM_URL) {
    try {
      console.log('Downloading Physix wasm → physix.wasm ...');
      const buf = await download(WASM_URL);
      if (buf.length < 1000) {
        throw new Error(`File too small (${buf.length} bytes).`);
      }
      fs.writeFileSync(path.join(OUT_DIR, 'physix.wasm'), buf);
      console.log(`Wrote physix.wasm (${(buf.length / 1024 / 1024).toFixed(1)} MB).`);
    } catch (err) {
      console.error('download-physix wasm:', err.message);
    }
  }

  if (SIDE_WASM_URL) {
    try {
      console.log('Downloading Physix side wasm → physix.side.wasm ...');
      const buf = await download(SIDE_WASM_URL);
      if (buf.length < 1000) {
        throw new Error(`File too small (${buf.length} bytes).`);
      }
      fs.writeFileSync(path.join(OUT_DIR, 'physix.side.wasm'), buf);
      console.log(`Wrote physix.side.wasm (${(buf.length / 1024).toFixed(1)} KB).`);
    } catch (err) {
      console.error('download-physix physix.side.wasm:', err.message);
    }
  }

  process.exit(0);
})();
