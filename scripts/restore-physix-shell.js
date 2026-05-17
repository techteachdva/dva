#!/usr/bin/env node
/**
 * Copy physix.shell.html → physix.html (never use Godot-exported HTML on deploy).
 * Run after download-physix so fileSizes match downloaded binaries.
 */
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'src', 'site', 'physix');
const SHELL = path.join(OUT_DIR, 'physix.shell.html');
const HTML = path.join(OUT_DIR, 'physix.html');

if (!fs.existsSync(SHELL)) {
  console.error('restore-physix-shell: missing', SHELL);
  process.exit(1);
}

fs.copyFileSync(SHELL, HTML);

const sizes = {};
for (const name of ['physix.pck', 'physix.wasm', 'physix.side.wasm']) {
  const filePath = path.join(OUT_DIR, name);
  if (fs.existsSync(filePath)) {
    sizes[name] = fs.statSync(filePath).size;
  }
}

let html = fs.readFileSync(HTML, 'utf8');
if (Object.keys(sizes).length > 0) {
  html = html.replace(/"fileSizes":\{[^}]*\}/, `"fileSizes":${JSON.stringify(sizes)}`);
  fs.writeFileSync(HTML, html);
}

if (html.includes('$GODOT')) {
  console.error('restore-physix-shell: physix.shell.html still contains $GODOT placeholders');
  process.exit(1);
}

console.log('restore-physix-shell: wrote physix.html from physix.shell.html');
