/**
 * Download Somnia's display fonts so the table can play offline.
 * Writes src/site/somnia/fonts and css/fonts-local.css.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src/site/somnia");
const fontsDir = path.join(root, "fonts");
const cssUrls = [
  "https://fonts.googleapis.com/css2?family=Cinzel:wght@400&display=swap",
  "https://fonts.googleapis.com/css2?family=Cinzel:wght@600&display=swap",
  "https://fonts.googleapis.com/css2?family=Cinzel:wght@700&display=swap",
  "https://fonts.googleapis.com/css2?family=Kalnia+Glaze&display=swap",
  "https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400&display=swap",
  "https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@600&display=swap",
];
const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

fs.mkdirSync(fontsDir, { recursive: true });
let css = "";
for (const cssUrl of cssUrls) {
  const cssRes = await fetch(cssUrl, { headers: { "User-Agent": userAgent } });
  if (!cssRes.ok) throw new Error(`Google Fonts CSS ${cssRes.status}`);
  css += `${await cssRes.text()}\n`;
}
const urls = [...new Set([...css.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)].map((match) => match[1]))];
if (!urls.length) throw new Error("No font files in Google Fonts CSS.");

const localByRemote = new Map();
urls.forEach((remote, index) => {
  const ext = remote.includes(".woff2") ? "woff2" : "woff";
  localByRemote.set(remote, `font-${index}.${ext}`);
});

for (const [remote, name] of localByRemote) {
  const fontRes = await fetch(remote);
  if (!fontRes.ok) throw new Error(`Font ${fontRes.status}: ${remote}`);
  fs.writeFileSync(path.join(fontsDir, name), Buffer.from(await fontRes.arrayBuffer()));
  css = css.split(remote).join(`../fonts/${name}`);
  console.log(name);
}

fs.writeFileSync(path.join(root, "css/fonts-local.css"), css);
console.log(`Wrote ${urls.length} fonts.`);
