#!/usr/bin/env node
/**
 * Downloads Physix binaries during build into src/site/physix/.
 * Saves as physix.pck / physix.wasm / physix.side.wasm (matches physix.html executable name).
 *
 * Vercel environment variables (full https URL, no quotes):
 *   PHYSIX_PCK_URL
 *   PHYSIX_WASM_URL
 *   PHYSIX_SIDE_WASM_URL (optional)
 *
 * If unset or set to localhost, defaults to GitHub Release v1.0 assets.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { URL } = require('url');

const OUT_DIR = path.join(__dirname, '..', 'src', 'site', 'physix');

const DEFAULT_RELEASE = 'https://github.com/techteachdva/dva/releases/download/v1.0';
const DEFAULTS = {
  pck: `${DEFAULT_RELEASE}/physix.pck`,
  wasm: `${DEFAULT_RELEASE}/physix.wasm`,
  side: `${DEFAULT_RELEASE}/physix.side.wasm`,
};

const BLOCKED_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '[::1]']);

function isBlockedHost(hostname) {
  return BLOCKED_HOSTS.has(String(hostname).toLowerCase());
}

/**
 * Normalize env URL: trim, strip quotes, add https:// if missing.
 * @returns {string|null}
 */
function normalizeUrl(raw) {
  if (raw == null) {
    return null;
  }
  let value = String(raw).trim();
  if (!value) {
    return null;
  }
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1).trim();
  }
  if (!/^https?:\/\//i.test(value)) {
    value = `https://${value.replace(/^\/+/, '')}`;
  }
  const parsed = new URL(value);
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`unsupported protocol ${parsed.protocol}`);
  }
  return parsed.href;
}

/**
 * Pick env URL or GitHub default; never use localhost (common misconfigured Vercel .env).
 */
function resolveAssetUrl(envValue, fallback, label) {
  if (envValue == null || String(envValue).trim() === '') {
    console.log(`${label} not set — using default:\n  ${fallback}`);
    return fallback;
  }
  try {
    const href = normalizeUrl(envValue);
    const host = new URL(href).hostname;
    if (isBlockedHost(host)) {
      console.warn(
        `${label} is "${String(envValue).trim()}" (host ${host}) — cannot use localhost on Vercel.\n` +
          `  Using default:\n  ${fallback}\n` +
          `  Fix in Vercel → Settings → Environment Variables: set full GitHub release URLs.`
      );
      return fallback;
    }
    console.log(`${label} → ${href}`);
    return href;
  } catch (err) {
    console.warn(`${label} invalid ("${String(envValue).trim()}"): ${err.message}`);
    console.warn(`  Using default:\n  ${fallback}`);
    return fallback;
  }
}

function download(url, redirectCount = 0) {
  const MAX_REDIRECTS = 8;
  if (redirectCount > MAX_REDIRECTS) {
    return Promise.reject(new Error('Too many redirects'));
  }
  return new Promise((resolve, reject) => {
    let parsed;
    try {
      parsed = new URL(url);
    } catch (err) {
      reject(new Error(`Invalid URL: ${url}`));
      return;
    }
    if (isBlockedHost(parsed.hostname)) {
      reject(new Error(`Refusing to download from localhost: ${url}`));
      return;
    }
    const client = parsed.protocol === 'https:' ? https : http;
    const opts = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Node-download-physix (Vercel build)',
        Accept: '*/*',
      },
    };
    if (parsed.port) {
      opts.port = parsed.port;
    }
    const req = client.request(opts, (res) => {
      const status = res.statusCode || 0;
      if (status >= 300 && status < 400 && res.headers.location) {
        const loc = res.headers.location;
        const next = loc.startsWith('http') ? loc : new URL(loc, url).href;
        return download(next, redirectCount + 1).then(resolve, reject);
      }
      if (status !== 200) {
        reject(new Error(`HTTP ${status} for ${url}`));
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

async function fetchAsset(url, destPath, label) {
  console.log(`Downloading ${label} → ${path.basename(destPath)} ...`);
  const buf = await download(url);
  if (buf.length < 1000) {
    throw new Error(`File too small (${buf.length} bytes). Likely 404 or LFS pointer.`);
  }
  fs.writeFileSync(destPath, buf);
  console.log(`Wrote ${path.basename(destPath)} (${(buf.length / 1024 / 1024).toFixed(1)} MB).`);
  return buf.length;
}

(async () => {
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  const skip =
    String(process.env.PHYSIX_SKIP_DOWNLOAD || '').toLowerCase() === '1' ||
    String(process.env.PHYSIX_SKIP_DOWNLOAD || '').toLowerCase() === 'true';
  if (skip) {
    console.log('PHYSIX_SKIP_DOWNLOAD set — skipping binary download.');
    process.exit(0);
  }

  const pckUrl = resolveAssetUrl(process.env.PHYSIX_PCK_URL, DEFAULTS.pck, 'PHYSIX_PCK_URL');
  const wasmUrl = resolveAssetUrl(process.env.PHYSIX_WASM_URL, DEFAULTS.wasm, 'PHYSIX_WASM_URL');
  const sideUrl = resolveAssetUrl(
    process.env.PHYSIX_SIDE_WASM_URL,
    DEFAULTS.side,
    'PHYSIX_SIDE_WASM_URL'
  );

  let failed = false;
  let wasmBytes = 0;

  try {
    await fetchAsset(pckUrl, path.join(OUT_DIR, 'physix.pck'), 'pack');
  } catch (err) {
    console.error('download-physix pck:', err.message);
    failed = true;
  }

  try {
    wasmBytes = await fetchAsset(wasmUrl, path.join(OUT_DIR, 'physix.wasm'), 'wasm');
    if (wasmBytes < 5 * 1024 * 1024) {
      console.warn(
        `WARNING: physix.wasm is ${(wasmBytes / 1024 / 1024).toFixed(1)} MB — with extensions_support expect ~35–40 MB (audio worklets need this + physix.side.wasm).`
      );
    }
  } catch (err) {
    console.error('download-physix wasm:', err.message);
    failed = true;
  }

  const jsPath = path.join(OUT_DIR, 'physix.js');
  const needsSideWasm =
    fs.existsSync(jsPath) && fs.readFileSync(jsPath, 'utf8').includes('.side.wasm');

  if (needsSideWasm || wasmBytes >= 5 * 1024 * 1024) {
    try {
      await fetchAsset(sideUrl, path.join(OUT_DIR, 'physix.side.wasm'), 'side wasm');
    } catch (err) {
      console.error(
        'download-physix side wasm (required for web audio with extensions_support):',
        err.message
      );
      console.error(
        'Upload physix.side.wasm from the same Godot export to the GitHub release (tag v1.0).'
      );
      failed = true;
    }
  } else {
    console.warn(
      'Skipping physix.side.wasm — main wasm looks like a non-extensions build; web audio may not work.'
    );
  }

  if (failed) {
    process.exit(1);
  }
  console.log('Physix binaries ready in src/site/physix/');
  process.exit(0);
})();
