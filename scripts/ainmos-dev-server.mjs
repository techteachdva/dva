#!/usr/bin/env node
/**
 * Local static server for Ainmos. Serves src/site/ainmos, and falls back to
 * src/site/somnia for the shared art, audio, fonts, and movie (the build does
 * the same mapping through Eleventy passthrough copies).
 *
 *   node scripts/ainmos-dev-server.mjs [port]
 */
import { createServer } from "http";
import { readFile, stat } from "fs/promises";
import { extname, join, normalize, resolve } from "path";
import { fileURLToPath } from "url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const AINMOS = join(ROOT, "src/site/ainmos");
const SOMNIA = join(ROOT, "src/site/somnia");
const SHARED = ["images/", "audio/", "fonts/"];
const PORT = Number(process.env.PORT) || Number(process.argv[2]) || 8788;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".mp4": "video/mp4",
  ".vtt": "text/vtt",
};

async function exists(path) {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

createServer(async (req, res) => {
  let rel = decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/^\/+/, "");
  if (!rel || rel.endsWith("/")) rel += "index.html";
  rel = normalize(rel);
  let file = join(AINMOS, rel);
  // Never serve outside the two game folders.
  if (!resolve(file).startsWith(AINMOS)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  if (!(await exists(file)) && SHARED.some((dir) => rel.split("\\").join("/").startsWith(dir))) {
    file = join(SOMNIA, rel);
  }
  if (!(await exists(file))) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }
  res.writeHead(200, {
    "Content-Type": TYPES[extname(file).toLowerCase()] || "application/octet-stream",
    "Cache-Control": "no-store",
  });
  res.end(await readFile(file));
}).listen(PORT, () => console.log(`Ainmos on http://localhost:${PORT}`));
