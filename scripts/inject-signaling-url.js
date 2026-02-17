#!/usr/bin/env node
require("dotenv").config();
/**
 * Injects SIGNALING_BASE_URL into Crystal Wizards index.html at build time.
 * Runs BEFORE eleventy build; modifies src/site/crystalwizards/index.html so the
 * passthrough copy includes the injected URL. Also runs on dist after build as fallback.
 * Set Vercel env: SIGNALING_BASE_URL = wss://crystal-wizards-signaling.YOUR_USERNAME.partykit.dev/parties/main
 */
const fs = require("fs");
const path = require("path");

const url = process.env.SIGNALING_BASE_URL || "wss://crystal-wizards-signaling.techteachdva.partykit.dev/parties/main";
const placeholder = "__SIGNALING_BASE_URL__";
const escaped = (url || "").replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/"/g, '\\"');

function injectIntoFile(filePath, label) {
  if (!fs.existsSync(filePath)) {
    return false;
  }
  let html = fs.readFileSync(filePath, "utf8");

  // 1. Custom shell: replace placeholder
  if (html.includes(placeholder)) {
    html = html.replace(placeholder, escaped);
    fs.writeFileSync(filePath, html);
    console.log("inject-signaling-url: injected (placeholder) into " + label);
    return true;
  }

  // 1b. Fix old URL - PartyKit production requires /parties/main/ (plural "parties")
  if (html.includes("partykit.dev/party") && !html.includes("partykit.dev/parties/main")) {
    html = html.replace(/partykit\.dev\/party\/main"/g, 'partykit.dev/parties/main"');
    html = html.replace(/partykit\.dev\/party\/main'/g, "partykit.dev/parties/main'");
    html = html.replace(/partykit\.dev\/party"/g, 'partykit.dev/parties/main"');
    html = html.replace(/partykit\.dev\/party'/g, "partykit.dev/parties/main'");
    fs.writeFileSync(filePath, html);
    console.log("inject-signaling-url: fixed URL (parties/main) in " + label);
    return true;
  }

  // 2. Default Godot template: inject script before Engine
  const safeUrl = (url || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const injectScript = `<script>window.SIGNALING_BASE_URL="${safeUrl}";</script>\n\t\t`;
  if (html.includes("<script src=\"index.js\"></script>") && !html.includes("SIGNALING_BASE_URL")) {
    html = html.replace("<script src=\"index.js\"></script>", injectScript + "<script src=\"index.js\"></script>");
    fs.writeFileSync(filePath, html);
    console.log("inject-signaling-url: injected (default template) into " + label);
    return true;
  }

  return false;
}

// 1. Inject into source BEFORE eleventy (so passthrough copies the injected file)
const srcPath = path.join(__dirname, "..", "src", "site", "crystalwizards", "index.html");
if (injectIntoFile(srcPath, "src/site/crystalwizards/index.html")) {
  process.exit(0);
}

// 2. Fallback: inject into dist AFTER eleventy (in case build order differs)
const distPath = path.join(__dirname, "..", "dist", "crystalwizards", "index.html");
if (injectIntoFile(distPath, "dist/crystalwizards/index.html")) {
  process.exit(0);
}

console.log("inject-signaling-url: no suitable target in src or dist, skipping");
process.exit(0);
