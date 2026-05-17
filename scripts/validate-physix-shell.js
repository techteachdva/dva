#!/usr/bin/env node
/**
 * Fail the Vercel build if physix.html was overwritten by an unprocessed Godot custom shell.
 */
const fs = require('fs');
const path = require('path');

const HTML_PATH = path.join(__dirname, '..', 'src', 'site', 'physix', 'physix.html');

if (!fs.existsSync(HTML_PATH)) {
  console.error('validate-physix-shell: missing', HTML_PATH);
  process.exit(1);
}

const html = fs.readFileSync(HTML_PATH, 'utf8');
let failed = false;

if (html.includes('$GODOT')) {
  console.error(
    'physix.html contains Godot template placeholders (e.g. $GODOT_BASENAME.js).\n' +
      'Do not copy custom_shell.html directly. Restore src/site/physix/physix.html from git,\n' +
      'or export Web to src/site/physix/_godot_export/ only (see Physix export preset).'
  );
  failed = true;
}

if (!html.includes('src="physix.js"')) {
  console.error('physix.html must load <script src="physix.js"></script>');
  failed = true;
}

if (!html.includes('new Engine(')) {
  console.error('physix.html is missing the Engine bootstrap script.');
  failed = true;
}

const jsPath = path.join(path.dirname(HTML_PATH), 'physix.js');
if (!fs.existsSync(jsPath)) {
  console.error('Missing src/site/physix/physix.js — run Godot Web export and copy JS/worklets into this folder.');
  failed = true;
}

if (failed) {
  process.exit(1);
}

console.log('validate-physix-shell: OK');
