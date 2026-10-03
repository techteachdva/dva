#!/usr/bin/env node
/**
 * Render scripts/beepbox-somnia-theme.url with BeepBox's synth (headless Edge).
 *
 * Do not replace the menu mp3 with this. A headless re-render does not match
 * the original BeepBox export: the pad sits at one volume and the piece
 * becomes a drone. The menu file is an edit of that original recording.
 * Pass --force to render anyway, and it writes scripts/beepbox-theme-render.mp3.
 */
import { spawn } from "child_process";
import { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

if (!process.argv.includes("--force")) {
  console.error("Refusing to render over the menu theme. See the note at the top of this file.");
  process.exit(1);
}
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const hash = readFileSync(join(root, "scripts/beepbox-somnia-theme.url"), "utf8").trim().split("#")[1];
const outMp3 = join(root, "scripts/beepbox-theme-render.mp3");
const edge = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const port = 9334;

const dir = mkdtempSync(join(tmpdir(), "somnia-beepbox-"));
const htmlPath = join(dir, "render.html");
const wavPath = join(dir, "theme.wav");

const pageHtml = await (await fetch("https://www.beepbox.co/")).text();
const match = pageHtml.match(/src="([^"]*beepbox_editor[^"]*)"/);
if (!match) throw new Error("Could not find beepbox_editor script on beepbox.co");
let scriptUrl = match[1];
if (scriptUrl.startsWith("//")) scriptUrl = "https:" + scriptUrl;
else if (scriptUrl.startsWith("/")) scriptUrl = "https://www.beepbox.co" + scriptUrl;
else if (!scriptUrl.startsWith("http")) scriptUrl = "https://www.beepbox.co/" + scriptUrl;
console.log("Synth:", scriptUrl);
const script = Buffer.from(await (await fetch(scriptUrl)).arrayBuffer());
writeFileSync(join(dir, "beepbox_editor.js"), script);
writeFileSync(htmlPath, `<!DOCTYPE html><meta charset="utf-8"><script src="./beepbox_editor.js"></script>`);

const userData = join(dir, "profile");
mkdirSync(userData);
const edgeProc = spawn(edge, [
  "--headless=new",
  "--disable-gpu",
  "--no-first-run",
  "--mute-audio",
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${userData}`,
  "--allow-file-access-from-files",
  `file:///${htmlPath.replace(/\\/g, "/")}`,
], { stdio: "ignore" });

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

let wsUrl = null;
for (let i = 0; i < 40; i++) {
  try {
    const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
    const page = list.find((t) => t.type === "page");
    if (page?.webSocketDebuggerUrl) { wsUrl = page.webSocketDebuggerUrl; break; }
  } catch { /* edge still starting */ }
  await sleep(250);
}
if (!wsUrl) throw new Error("Edge did not open a debugging port");

const ws = new WebSocket(wsUrl);
await new Promise((resolve, reject) => {
  ws.addEventListener("open", resolve);
  ws.addEventListener("error", reject);
});

let nextId = 0;
const pending = new Map();
ws.addEventListener("message", (ev) => {
  const msg = JSON.parse(ev.data);
  if (!msg.id || !pending.has(msg.id)) return;
  const { resolve, reject } = pending.get(msg.id);
  pending.delete(msg.id);
  if (msg.error) reject(new Error(JSON.stringify(msg.error)));
  else resolve(msg.result);
});
const cdp = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++nextId;
  pending.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params }));
});

await cdp("Runtime.enable");
await cdp("Page.enable");
await cdp("Page.navigate", { url: `file:///${htmlPath.replace(/\\/g, "/")}` });
let boot = null;
for (let i = 0; i < 40; i++) {
  await sleep(250);
  boot = await cdp("Runtime.evaluate", {
    expression: `({ href: location.href, has: typeof window.beepbox, ready: document.readyState, scripts: document.scripts.length })`,
    returnByValue: true,
  });
  if (boot.result?.value?.has === "object") break;
}
if (!boot.result?.value?.has || boot.result.value.has !== "object") {
  throw new Error("BeepBox did not load: " + JSON.stringify(boot));
}

const init = await cdp("Runtime.evaluate", {
  expression: `(() => {
    const song = new window.beepbox.Song(${JSON.stringify(hash)});
    const synth = new window.beepbox.Synth(song);
    synth.loopRepeatCount = 0;
    synth.samplesPerSecond = 48000;
    if (typeof synth.computeDelayBufferSizes === "function") synth.computeDelayBufferSizes();
    const samplesPerBar = Math.round(synth.getSamplesPerBar());
    const total = samplesPerBar * song.barCount;
    window.__synth = synth;
    window.__left = new Float32Array(12000);
    window.__right = new Float32Array(12000);
    window.__pcm = new Int16Array(total * 2);
    window.__written = 0;
    window.__total = total;
    return { barCount: song.barCount, tempo: song.tempo, samplesPerBar, total, rate: synth.samplesPerSecond };
  })()`,
  returnByValue: true,
});
if (init.exceptionDetails) throw new Error(JSON.stringify(init.exceptionDetails));
const info = init.result.value;
console.log("Rendering", info);

const stepSamples = 12000;
while (true) {
  const step = await cdp("Runtime.evaluate", {
    expression: `(() => {
      const n = Math.min(${stepSamples}, window.__total - window.__written);
      if (n <= 0) return window.__written;
      window.__synth.synthesize(window.__left, window.__right, n, true);
      const pcm = window.__pcm;
      const base = window.__written * 2;
      const gain = 0.45;
      for (let i = 0; i < n; i++) {
        const lRaw = window.__left[i] || 0;
        const rRaw = window.__right[i] || 0;
        window.__peak = Math.max(window.__peak || 0, Math.abs(lRaw), Math.abs(rRaw));
        const l = Math.max(-1, Math.min(1, lRaw * gain));
        const r = Math.max(-1, Math.min(1, rRaw * gain));
        pcm[base + i * 2] = l < 0 ? l * 32768 : l * 32767;
        pcm[base + i * 2 + 1] = r < 0 ? r * 32768 : r * 32767;
      }
      window.__written += n;
      return window.__written;
    })()`,
    returnByValue: true,
  });
  if (step.exceptionDetails) throw new Error(JSON.stringify(step.exceptionDetails));
  const written = step.result.value;
  if (written % (stepSamples * 20) < stepSamples) {
    console.log(`  ${Math.round(written / info.total * 100)}%`);
  }
  if (written >= info.total) break;
}
const peak = await cdp("Runtime.evaluate", { expression: "window.__peak", returnByValue: true });
console.log("Raw peak before gain:", peak.result?.value);

const header = Buffer.alloc(44);
const dataBytes = info.total * 4;
header.write("RIFF", 0);
header.writeUInt32LE(36 + dataBytes, 4);
header.write("WAVE", 8);
header.write("fmt ", 12);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20);
header.writeUInt16LE(2, 22);
header.writeUInt32LE(48000, 24);
header.writeUInt32LE(48000 * 4, 28);
header.writeUInt16LE(4, 32);
header.writeUInt16LE(16, 34);
header.write("data", 36);
header.writeUInt32LE(dataBytes, 40);

const pcm = Buffer.alloc(dataBytes);
const chunkBytes = 1000000;
for (let offset = 0; offset < dataBytes; offset += chunkBytes) {
  const n = Math.min(chunkBytes, dataBytes - offset);
  const part = await cdp("Runtime.evaluate", {
    expression: `(() => {
      const bytes = new Uint8Array(window.__pcm.buffer, ${offset}, ${n});
      let s = "";
      for (let i = 0; i < bytes.length; i += 32768) {
        s += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(bytes.length, i + 32768)));
      }
      return btoa(s);
    })()`,
    returnByValue: true,
  });
  if (part.exceptionDetails) throw new Error(JSON.stringify(part.exceptionDetails));
  Buffer.from(part.result.value, "base64").copy(pcm, offset);
  console.log(`  saved ${Math.round((offset + n) / dataBytes * 100)}% of wav`);
}

writeFileSync(wavPath, Buffer.concat([header, pcm]));
ws.close();
edgeProc.kill();

await new Promise((resolve, reject) => {
  const ff = spawn("ffmpeg", [
    "-y", "-i", wavPath,
    "-ar", "48000", "-ac", "2", "-b:a", "160k",
    outMp3,
  ], { stdio: "inherit" });
  ff.on("exit", (code) => code === 0 ? resolve() : reject(new Error("ffmpeg " + code)));
});

rmSync(dir, { recursive: true, force: true });
console.log("Wrote", outMp3);
