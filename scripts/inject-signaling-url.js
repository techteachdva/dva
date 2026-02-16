#!/usr/bin/env node
require("dotenv").config();
/**
 * Injects SIGNALING_BASE_URL into Crystal Wizards index.html at build time.
 * Runs AFTER eleventy build; modifies dist/crystalwizards/index.html.
 * Set Vercel env: SIGNALING_BASE_URL = wss://crystal-wizards-signaling.YOUR_USERNAME.partykit.dev/party/main
 */
const fs = require('fs');
const path = require('path');

const distPath = path.join(__dirname, '..', 'dist', 'crystalwizards', 'index.html');
const url = process.env.SIGNALING_BASE_URL || 'wss://crystal-wizards-signaling.techteachdva.partykit.dev/parties/main';

if (!fs.existsSync(distPath)) {
  console.log('inject-signaling-url: dist/crystalwizards/index.html not found (run build first?), skipping');
  process.exit(0);
}

let html = fs.readFileSync(distPath, 'utf8');
const placeholder = '__SIGNALING_BASE_URL__';
if (html.includes(placeholder)) {
  const escaped = (url || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"');
  html = html.replace(placeholder, escaped);
  fs.writeFileSync(distPath, html);
  console.log('inject-signaling-url: injected', url ? 'SIGNALING_BASE_URL' : '(empty - add ?signaling=wss://... to URL)');
} else {
  console.log('inject-signaling-url: no placeholder in output, skipping');
}
process.exit(0);
