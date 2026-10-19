/**
 * Sound: synthesized effects and a quiet generative pad (no audio files to download),
 * plus the browser's speech voice for every morpheme and word.
 */

import { settings, onSetting } from './settings.js';
import { morph } from '../data/morphemes.js';

let ctx = null;
let sfxGain = null;
let musicGain = null;
let musicNodes = [];
let musicStyle = null;
let arpTimer = 0;

export function unlockAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  sfxGain = ctx.createGain();
  sfxGain.gain.value = settings.sfx;
  sfxGain.connect(ctx.destination);
  musicGain = ctx.createGain();
  musicGain.gain.value = settings.music * 0.35;
  musicGain.connect(ctx.destination);
  if (musicStyle) startMusic(musicStyle, true);
}

onSetting((k, v) => {
  if (!ctx) return;
  if (k === 'sfx') sfxGain.gain.value = v;
  if (k === 'music') musicGain.gain.value = v * 0.35;
});

function tone({ f = 440, f2 = null, type = 'sine', dur = 0.12, vol = 0.25, delay = 0, attack = 0.005 }) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(sfxGain);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noise(dur = 0.2, vol = 0.2, delay = 0, hp = 800) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = hp;
  const g = ctx.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(sfxGain);
  src.start(t);
}

export const sfx = {
  click: () => tone({ f: 900, type: 'square', dur: 0.04, vol: 0.08 }),
  tick: () => { tone({ f: 1400, type: 'square', dur: 0.025, vol: 0.06 }); tone({ f: 700, type: 'triangle', dur: 0.04, vol: 0.06, delay: 0.015 }); },
  step: () => tone({ f: 180, f2: 120, type: 'triangle', dur: 0.05, vol: 0.03 }),
  open: () => { tone({ f: 330, f2: 660, type: 'sawtooth', dur: 0.18, vol: 0.06 }); },
  close: () => { tone({ f: 660, f2: 330, type: 'sawtooth', dur: 0.15, vol: 0.05 }); },
  good: () => [523, 659, 784, 1047].forEach((f, i) => tone({ f, type: 'triangle', dur: 0.18, vol: 0.14, delay: i * 0.07 })),
  bad: () => { tone({ f: 160, f2: 110, type: 'sawtooth', dur: 0.25, vol: 0.12 }); tone({ f: 166, f2: 100, type: 'square', dur: 0.25, vol: 0.06 }); },
  cut: () => { noise(0.08, 0.15, 0, 2500); tone({ f: 2200, f2: 900, type: 'square', dur: 0.06, vol: 0.05 }); },
  split: () => { noise(0.25, 0.2, 0, 1200); [880, 660, 990].forEach((f, i) => tone({ f, type: 'square', dur: 0.08, vol: 0.06, delay: i * 0.05 })); },
  drop: () => tone({ f: 1200, f2: 300, type: 'sine', dur: 0.22, vol: 0.12 }),
  pickup: () => { tone({ f: 880, type: 'sine', dur: 0.06, vol: 0.1 }); tone({ f: 1320, type: 'sine', dur: 0.08, vol: 0.1, delay: 0.05 }); },
  gate: () => { tone({ f: 220, f2: 440, type: 'sawtooth', dur: 0.5, vol: 0.08 }); noise(0.5, 0.06, 0, 300); },
  bridge: () => [392, 523, 659, 784, 1047, 1319].forEach((f, i) => tone({ f, type: 'triangle', dur: 0.12, vol: 0.1, delay: i * 0.06 })),
  crash: () => { noise(0.8, 0.3, 0, 200); tone({ f: 400, f2: 40, type: 'sawtooth', dur: 0.8, vol: 0.15 }); },
  unlock: () => [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone({ f, type: 'square', dur: 0.14, vol: 0.08, delay: i * 0.09 })),
  rot: () => tone({ f: 90, f2: 70, type: 'sawtooth', dur: 0.3, vol: 0.05 }),
  warp: () => { tone({ f: 200, f2: 1200, type: 'sine', dur: 0.4, vol: 0.08 }); noise(0.3, 0.05, 0.1, 3000); },
};

// ── Music: a slow pad and arpeggio per place ───────────────────────
const SCALES = {
  hub: [220, 261.6, 329.6, 392, 440, 523.3],
  anglo: [196, 233.1, 261.6, 293.7, 349.2, 392],
  latin: [174.6, 220, 261.6, 293.7, 349.2, 440],
  greek: [246.9, 293.7, 370, 440, 493.9, 587.3],
  lingo: [261.6, 293.7, 329.6, 392, 440, 523.3],
  rot: [110, 130.8, 146.8, 164.8, 196, 220],
  arcade: [261.6, 311.1, 392, 466.2, 523.3, 622.3],
};

export function startMusic(style, force = false) {
  if (style === musicStyle && !force) return;
  musicStyle = style;
  if (!ctx) return;
  stopMusicNodes();
  const scale = SCALES[style] || SCALES.hub;
  const t = ctx.currentTime;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 900;
  filter.connect(musicGain);
  [scale[0] / 2, scale[2] / 2].forEach((f) => {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = f;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.05, t + 2);
    o.connect(g).connect(filter);
    o.start();
    musicNodes.push(o, g);
  });
  musicNodes.push(filter);
  let i = 0;
  const beat = style === 'arcade' ? 180 : 420;
  arpTimer = setInterval(() => {
    if (!ctx || settings.music <= 0) return;
    const f = scale[(i * 3 + (i >> 2)) % scale.length] * (i % 8 < 4 ? 1 : 2);
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.value = f;
    const n = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, n);
    g.gain.exponentialRampToValueAtTime(0.06, n + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, n + beat / 1000 * 1.6);
    o.connect(g).connect(filter);
    o.start(n);
    o.stop(n + beat / 1000 * 1.7);
    i++;
  }, beat);
}

function stopMusicNodes() {
  clearInterval(arpTimer);
  musicNodes.forEach((n) => { try { n.stop && n.stop(); } catch { /* already stopped */ } try { n.disconnect(); } catch { /* ignore */ } });
  musicNodes = [];
}

// ── Speech ────────────────────────────────────────────────────────
let voice = null;
function pickVoice() {
  const vs = window.speechSynthesis ? speechSynthesis.getVoices() : [];
  voice = vs.find((v) => v.lang === 'en-US' && v.localService) || vs.find((v) => v.lang && v.lang.startsWith('en') && v.localService) || vs.find((v) => v.lang && v.lang.startsWith('en')) || null;
}
if (window.speechSynthesis) {
  pickVoice();
  speechSynthesis.onvoiceschanged = pickVoice;
}

export function speak(text, { force = false, rate } = {}) {
  if (!window.speechSynthesis || (!settings.speakWords && !force)) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    if (voice) u.voice = voice;
    u.rate = rate || settings.rate;
    u.lang = 'en-US';
    speechSynthesis.speak(u);
  } catch { /* speech not available */ }
}

export function speakDialogue(text) {
  if (settings.speakDialogue) speak(text, { force: true, rate: settings.rate * 1.05 });
}

export function sayMorph(id) {
  const m = morph(id);
  speak(m.say || m.text);
}
