/**
 * Sound: synthesized effects, BeepBox background songs (no audio files to download),
 * plus the browser's speech voice for every morpheme and word.
 */

import { settings, onSetting } from './settings.js';
import { morph } from '../data/morphemes.js';
import { MUSIC } from '../data/music.js';

let ctx = null;
let sfxGain = null;
let musicStyle = null;

export function unlockAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  sfxGain = ctx.createGain();
  sfxGain.gain.value = settings.sfx;
  sfxGain.connect(ctx.destination);
  if (musicStyle) startMusic(musicStyle, true);
}

onSetting((k, v) => {
  if (!ctx) return;
  if (k === 'sfx') sfxGain.gain.value = v;
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
  pop: () => { tone({ f: 520, f2: 1400, type: 'sine', dur: 0.09, vol: 0.14 }); tone({ f: 1800, f2: 900, type: 'sine', dur: 0.06, vol: 0.06, delay: 0.05 }); },
  bounce: () => tone({ f: 260 + Math.random() * 120, f2: 140, type: 'triangle', dur: 0.07, vol: 0.09 }),
  crit: () => { [392, 523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone({ f, type: 'square', dur: 0.12, vol: 0.09, delay: i * 0.05 })); noise(0.4, 0.08, 0.35, 2000); },
  warp: () => { tone({ f: 200, f2: 1200, type: 'sine', dur: 0.4, vol: 0.08 }); noise(0.3, 0.05, 0.1, 3000); },
};

// ── Music: one BeepBox song per place (js/data/music.js) ──────────
// The BeepBox player (vendor/beepbox, MIT) is loaded by index.html as window.beepbox.
// Songs are long loops written by scripts/compose-cybermorph-music.mjs.

const SONG_FOR = { title: 'hub', hub: 'hub', anglo: 'anglo', latin: 'latin', greek: 'greek', lingo: 'lingo', rot: 'rot', arcade: 'arcade' };
let bb = null;
let bbSong = null;

function musicVolume() { return Math.max(0, Math.min(1, settings.music)) * 0.8; }

export function startMusic(style, force = false) {
  const id = SONG_FOR[style] || 'hub';
  if (id === musicStyle && !force && bb && bb.playing) return;
  musicStyle = id;
  if (!ctx || !window.beepbox || !MUSIC[id]) return;
  try {
    if (!bb) bb = new window.beepbox.Synth();
    if (bbSong !== id) {
      bb.pause();
      bb.setSong(MUSIC[id].hash);
      bb.snapToStart();
      bbSong = id;
    }
    bb.loopRepeatCount = -1;
    bb.volume = musicVolume();
    if (settings.music > 0) bb.play(); else bb.pause();
  } catch (e) { console.warn('music unavailable', e); }
}

onSetting((k) => {
  if (k !== 'music' || !bb) return;
  bb.volume = musicVolume();
  if (settings.music > 0 && !bb.playing) bb.play();
  if (settings.music <= 0) bb.pause();
});

document.addEventListener('visibilitychange', () => {
  if (!bb) return;
  if (document.visibilityState === 'hidden') bb.pause();
  else if (settings.music > 0 && bbSong) bb.play();
});

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
