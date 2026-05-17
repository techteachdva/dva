#!/usr/bin/env node
/**
 * Fail if large Physix binaries are staged for commit.
 * Run: npm run check:physix-binaries
 */
const { execSync } = require('child_process');

const BLOCKED = /\.(pck|wasm|side\.wasm)$/i;
const ALLOWED_PREFIXES = [
  'src/site/physix/physix.js',
  'src/site/physix/physix.audio',
  'src/site/physix/physix.html',
  'src/site/physix/physix.manifest',
  'src/site/physix/physix.service',
  'src/site/physix/physix.offline',
  'src/site/physix/physix.icon',
  'src/site/physix/physix.apple',
  'src/site/physix/physix.png',
];

function isBlocked(file) {
  if (!BLOCKED.test(file)) {
    return false;
  }
  if (!file.includes('physix')) {
    return false;
  }
  return !ALLOWED_PREFIXES.some((prefix) => file.startsWith(prefix));
}

let staged = [];
try {
  const out = execSync('git diff --cached --name-only', { encoding: 'utf8' });
  staged = out.split('\n').map((s) => s.trim()).filter(Boolean);
} catch {
  process.exit(0);
}

const bad = staged.filter(isBlocked);
if (bad.length === 0) {
  process.exit(0);
}

console.error(
  'Refusing commit: large Physix binaries must not be in git:\n' +
    bad.map((f) => `  - ${f}`).join('\n') +
    '\n\nUpload them to GitHub Release v1.0 instead. Untrack with:\n' +
    '  git rm --cached ' +
    bad.join(' ') +
    '\n'
);
process.exit(1);
