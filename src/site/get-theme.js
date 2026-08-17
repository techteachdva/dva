require("dotenv").config();
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { globSync } = require("glob");

const themeCommentRegex = /\/\*[\s\S]*?\*\//g;
const VENDORED_THEME = path.join(__dirname, "styles/ether-theme.vendored.css");

async function fetchRemoteTheme(themeUrl) {
  let url = themeUrl;
  try {
    const res = await axios.get(url);
    return res.data;
  } catch {
    if (url.includes("theme.css")) {
      url = url.replace("theme.css", "obsidian.css");
    } else if (url.includes("obsidian.css")) {
      url = url.replace("obsidian.css", "theme.css");
    } else {
      throw new Error(`Could not fetch theme from ${themeUrl}`);
    }
  }

  const res = await axios.get(url);
  return res.data;
}

function readVendoredTheme() {
  if (!fs.existsSync(VENDORED_THEME)) {
    return null;
  }
  return fs.readFileSync(VENDORED_THEME, "utf8");
}

function writeThemeFile(data) {
  const existing = globSync("src/site/styles/_theme.*.css");
  existing.forEach((file) => {
    fs.rmSync(file);
  });

  let skippedFirstComment = false;
  const cleaned = data.replace(themeCommentRegex, (match) => {
    if (skippedFirstComment) {
      return "";
    }
    skippedFirstComment = true;
    return match;
  });

  const hashSum = crypto.createHash("sha256");
  hashSum.update(cleaned);
  const hex = hashSum.digest("hex");
  fs.writeFileSync(`src/site/styles/_theme.${hex.substring(0, 8)}.css`, cleaned);
}

async function getTheme() {
  const themeUrl = process.env.THEME;
  let data = null;

  if (themeUrl) {
    try {
      data = await fetchRemoteTheme(themeUrl);
      console.log("Fetched Obsidian theme from remote.");
    } catch (err) {
      console.warn(`Remote theme fetch failed (${err.message}); using vendored fallback.`);
    }
  }

  if (!data) {
    data = readVendoredTheme();
    if (data) {
      console.log("Using vendored Obsidian theme.");
    }
  }

  if (!data) {
    console.warn("No theme configured and no vendored fallback found; skipping theme generation.");
    return;
  }

  writeThemeFile(data);
}

getTheme().catch((err) => {
  console.error(err);
  process.exit(1);
});
