#!/usr/bin/env node
/**
 * Downloads Physix web export assets into src/site/physix/.
 * All files must come from the SAME Godot Web export (same upload to GitHub Release).
 *
 * Vercel env (optional, full https URLs):
 *   PHYSIX_PCK_URL, PHYSIX_WASM_URL, PHYSIX_SIDE_WASM_URL
 *   PHYSIX_JS_URL, PHYSIX_AUDIO_WORKLET_URL, PHYSIX_AUDIO_POSITION_WORKLET_URL
 *
 * Defaults: https://github.com/techteachdva/dva/releases/download/v1.3-web/...
 * Chrome/Edge/Firefox: monolithic threaded wasm (no .side.wasm).
 * Safari/iOS: safe/physix.* single-thread build. One shared physix.pck.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { URL } = require('url');

const OUT_DIR = path.join(__dirname, '..', 'src', 'site', 'physix');
const SAFE_DIR = path.join(OUT_DIR, 'safe');

const DEFAULT_RELEASE = 'https://github.com/techteachdva/dva/releases/download/v1.3-web';
const DEFAULTS = {
  pck: `${DEFAULT_RELEASE}/physix.pck`,
  wasm: `${DEFAULT_RELEASE}/physix.wasm`,
  js: `${DEFAULT_RELEASE}/physix.js`,
  audioWorklet: `${DEFAULT_RELEASE}/physix.audio.worklet.js`,
  audioPositionWorklet: `${DEFAULT_RELEASE}/physix.audio.position.worklet.js`,
  safeWasm: `${DEFAULT_RELEASE}/physix.safe.wasm`,
  safeJs: `${DEFAULT_RELEASE}/physix.safe.js`,
  safeAudioWorklet: `${DEFAULT_RELEASE}/physix.safe.audio.worklet.js`,
  safeAudioPositionWorklet: `${DEFAULT_RELEASE}/physix.safe.audio.position.worklet.js`,
};

const BLOCKED_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '[::1]']);

function isBlockedHost(hostname) {
  return BLOCKED_HOSTS.has(String(hostname).toLowerCase());
}

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
          `  Using default:\n  ${fallback}`
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

function formatSize(bytes) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }
  return `${(bytes / 1024).toFixed(1)} KB`;
}

async function fetchAsset(url, destPath, label, minBytes = 1000) {
  console.log(`Downloading ${label} → ${path.basename(destPath)} ...`);
  const buf = await download(url);
  if (buf.length < minBytes) {
    throw new Error(`File too small (${buf.length} bytes). Likely 404 or LFS pointer.`);
  }
  const tmpPath = `${destPath}.download`;
  fs.writeFileSync(tmpPath, buf);
  fs.renameSync(tmpPath, destPath);
  console.log(`Wrote ${path.basename(destPath)} (${formatSize(buf.length)}).`);
  return buf.length;
}

function validateWasmJsPair(wasmBytes) {
  const jsPath = path.join(OUT_DIR, 'physix.js');
  if (!fs.existsSync(jsPath)) {
    throw new Error('Missing physix.js after download');
  }
  const js = fs.readFileSync(jsPath, 'utf8');
  const safeWasm = path.join(SAFE_DIR, 'physix.wasm');
  const safeBytes = fs.existsSync(safeWasm) ? fs.statSync(safeWasm).size : 0;
  if (wasmBytes < 8 * 1024 * 1024) {
    throw new Error(
      `physix.wasm is ${formatSize(wasmBytes)}. Expected the threaded engine (~35 MB), not a GDExtension side-module stub.`
    );
  }
  if (!js.includes('isPthread')) {
    throw new Error('physix.js is not the threaded Godot export. Re-export Web Release with thread support on.');
  }
  if (safeBytes < 8 * 1024 * 1024) {
    throw new Error(`safe/physix.wasm is missing or too small (${formatSize(safeBytes)}).`);
  }
  console.log(
    `Threaded engine ${formatSize(wasmBytes)}, Safari engine ${formatSize(safeBytes)}. No side wasm.`
  );
}

(async () => {
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  const skip =
    String(process.env.PHYSIX_SKIP_DOWNLOAD || '').toLowerCase() === '1' ||
    String(process.env.PHYSIX_SKIP_DOWNLOAD || '').toLowerCase() === 'true';
  if (skip) {
    console.log('PHYSIX_SKIP_DOWNLOAD set — skipping download.');
    process.exit(0);
  }

  const urls = {
    pck: resolveAssetUrl(process.env.PHYSIX_PCK_URL, DEFAULTS.pck, 'PHYSIX_PCK_URL'),
    wasm: resolveAssetUrl(process.env.PHYSIX_WASM_URL, DEFAULTS.wasm, 'PHYSIX_WASM_URL'),
    js: resolveAssetUrl(process.env.PHYSIX_JS_URL, DEFAULTS.js, 'PHYSIX_JS_URL'),
    audioWorklet: resolveAssetUrl(
      process.env.PHYSIX_AUDIO_WORKLET_URL,
      DEFAULTS.audioWorklet,
      'PHYSIX_AUDIO_WORKLET_URL'
    ),
    audioPositionWorklet: resolveAssetUrl(
      process.env.PHYSIX_AUDIO_POSITION_WORKLET_URL,
      DEFAULTS.audioPositionWorklet,
      'PHYSIX_AUDIO_POSITION_WORKLET_URL'
    ),
    safeWasm: resolveAssetUrl(process.env.PHYSIX_SAFE_WASM_URL, DEFAULTS.safeWasm, 'PHYSIX_SAFE_WASM_URL'),
    safeJs: resolveAssetUrl(process.env.PHYSIX_SAFE_JS_URL, DEFAULTS.safeJs, 'PHYSIX_SAFE_JS_URL'),
    safeAudioWorklet: resolveAssetUrl(
      process.env.PHYSIX_SAFE_AUDIO_WORKLET_URL,
      DEFAULTS.safeAudioWorklet,
      'PHYSIX_SAFE_AUDIO_WORKLET_URL'
    ),
    safeAudioPositionWorklet: resolveAssetUrl(
      process.env.PHYSIX_SAFE_AUDIO_POSITION_WORKLET_URL,
      DEFAULTS.safeAudioPositionWorklet,
      'PHYSIX_SAFE_AUDIO_POSITION_WORKLET_URL'
    ),
  };

  let failed = false;
  let wasmBytes = 0;

  const jsAssets = [
    { url: urls.js, file: 'physix.js', label: 'loader JS', minBytes: 50000 },
    {
      url: urls.audioWorklet,
      file: 'physix.audio.worklet.js',
      label: 'audio worklet',
      minBytes: 200,
    },
    {
      url: urls.audioPositionWorklet,
      file: 'physix.audio.position.worklet.js',
      label: 'audio position worklet',
      minBytes: 200,
    },
  ];

  for (const asset of jsAssets) {
    try {
      await fetchAsset(asset.url, path.join(OUT_DIR, asset.file), asset.label, asset.minBytes);
    } catch (err) {
      console.error(`download-physix ${asset.file}:`, err.message);
      console.error(
        `Upload ${asset.file} from the same Godot Web export to the GitHub release (v1.3-web).`
      );
      failed = true;
    }
  }

  try {
    await fetchAsset(urls.pck, path.join(OUT_DIR, 'physix.pck'), 'pack');
  } catch (err) {
    console.error('download-physix pck:', err.message);
    failed = true;
  }

  try {
    wasmBytes = await fetchAsset(urls.wasm, path.join(OUT_DIR, 'physix.wasm'), 'wasm');
  } catch (err) {
    console.error('download-physix wasm:', err.message);
    failed = true;
  }

  if (!fs.existsSync(SAFE_DIR)) {
    fs.mkdirSync(SAFE_DIR, { recursive: true });
  }
  const safeAssets = [
    { url: urls.safeJs, file: 'physix.js', label: 'Safari loader JS', minBytes: 50000 },
    { url: urls.safeWasm, file: 'physix.wasm', label: 'Safari wasm', minBytes: 8 * 1024 * 1024 },
    { url: urls.safeAudioWorklet, file: 'physix.audio.worklet.js', label: 'Safari audio worklet', minBytes: 200 },
    {
      url: urls.safeAudioPositionWorklet,
      file: 'physix.audio.position.worklet.js',
      label: 'Safari audio position worklet',
      minBytes: 200,
    },
  ];
  for (const asset of safeAssets) {
    try {
      await fetchAsset(asset.url, path.join(SAFE_DIR, asset.file), asset.label, asset.minBytes);
    } catch (err) {
      console.error(`download-physix safe/${asset.file}:`, err.message);
      failed = true;
    }
  }
  const staleSide = path.join(OUT_DIR, 'physix.side.wasm');
  if (fs.existsSync(staleSide)) {
    fs.unlinkSync(staleSide);
    console.log('Removed stale physix.side.wasm');
  }

  if (!failed) {
    try {
      validateWasmJsPair(wasmBytes);
    } catch (err) {
      console.error('download-physix validate:', err.message);
      failed = true;
    }
  }

  if (failed) {
    process.exit(1);
  }
  console.log('Physix export assets ready in src/site/physix/ (JS + wasm from same release).');
  process.exit(0);
})();
