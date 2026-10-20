#!/usr/bin/env node
/**
 * Compose CyberMorph's background music as BeepBox songs.
 *
 * Each room gets its own theme: key, mode, tempo, instruments and chord progressions.
 * A seeded composer writes a long loop (64 bars, about 3–4 minutes) in eight sections
 * (intro, A, A', B, break, A'', B', outro), so the loop rarely repeats itself.
 *
 * Output: src/site/cybermorph/js/data/music.js with one BeepBox share hash per room.
 * Every song opens in the BeepBox editor at https://www.beepbox.co/#<hash>
 *
 *   node scripts/compose-cybermorph-music.mjs          (writes music.js, prints editor links)
 */

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const synthFile = path.join(root, 'src/site/cybermorph/vendor/beepbox/beepbox_synth.min.js');
const ctx = { console, Math, Date, Float32Array, Int32Array, Uint8Array, Uint16Array, Array, Object, Map, Set, Error };
ctx.window = ctx;
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(`${fs.readFileSync(synthFile, 'utf8')}\nthis.beepbox = beepbox;`, ctx);
const { Song } = ctx.beepbox;

// ── Music theory helpers ──────────────────────────────────────────

const MODES = {
  ionian: [0, 2, 4, 5, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  aeolian: [0, 2, 3, 5, 7, 8, 10],
  pentaMajor: [0, 2, 4, 7, 9],
};

const QUALITY = {
  maj: [0, 4, 7], min: [0, 3, 7], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], dom7: [0, 4, 7, 10],
  add9: [0, 4, 7, 14], madd9: [0, 3, 7, 14], sus2: [0, 2, 7], sus4: [0, 5, 7], maj9: [0, 4, 11, 14], m9: [0, 3, 10, 14], six: [0, 4, 7, 9], m6: [0, 3, 7, 9],
};

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Chord tones near a target register. */
function voice(chord, center) {
  const [rootSemi, q] = chord;
  const tones = QUALITY[q].map((i) => rootSemi + i);
  return tones.map((p) => { let x = p; while (x < center - 6) x += 12; while (x > center + 6) x -= 12; return x; }).sort((a, b) => a - b);
}

function scalePitches(mode, lo, hi) {
  const out = [];
  for (let p = lo; p <= hi; p++) if (MODES[mode].includes(((p % 12) + 12) % 12)) out.push(p);
  return out;
}

// ── Note writers (ticks are sixteenths: 4 per beat) ───────────────

const note = (pitches, start, len, vol = 80, endVol = null) => ({
  pitches: [].concat(pitches),
  points: [{ tick: start, pitchBend: 0, volume: vol }, { tick: start + len, pitchBend: 0, volume: endVol ?? vol }],
});

function padBar(chord, theme, vol = 70) {
  return [note(voice(chord, theme.padCenter).slice(0, 4), 0, theme.barTicks, vol, vol - 15)];
}

function bassBar(chord, theme, style) {
  const r = chord[0] + theme.bassBase;
  const T = theme.barTicks;
  if (style === 'long') return [note(r, 0, T, 85, 60)];
  if (style === 'halves') return [note(r, 0, T / 2, 85, 60), note(r + (theme.beats === 3 ? 7 : 7), T / 2, T / 2, 70, 50)];
  return [note(r, 0, T * 0.75, 85, 55), note(r + 12, T * 0.75, T * 0.25, 60, 40)];
}

const ARP_STYLES = {
  sparse: (n, T) => [0, T / 2].map((t, i) => [t, T / 2, i]),
  quarters: (n, T) => Array.from({ length: T / 4 }, (_, i) => [i * 4, 4, i]),
  eighths: (n, T) => Array.from({ length: T / 2 }, (_, i) => [i * 2, 2, i]),
  wave: (n, T) => Array.from({ length: T / 2 }, (_, i) => [i * 2, 2, [0, 1, 2, 3, 2, 1, 0, 1, 2, 3, 2, 1][i % 12]]),
  broken: (n, T) => Array.from({ length: T / 2 }, (_, i) => [i * 2, 2, [0, 2, 1, 3, 2, 1, 3, 0][i % 8]]),
};

function arpBar(chord, theme, style, vol = 60) {
  const tones = voice(chord, theme.arpCenter);
  const ext = [...tones, tones[0] + 12];
  return ARP_STYLES[style](ext.length, theme.barTicks).map(([t, len, i]) => note(ext[i % ext.length], t, len, vol, Math.max(10, vol - 30)));
}

/** A melody phrase over 2 bars: rhythm templates, chord tones on strong beats, steps between. */
const RHYTHMS4 = [
  [[0, 8], [8, 4], [12, 4], [16, 12]],
  [[0, 12], [12, 4], [16, 16]],
  [[4, 4], [8, 4], [12, 4], [16, 8], [24, 8]],
  [[0, 8], [8, 8], [16, 4], [20, 4], [24, 8]],
  [[0, 16], [16, 16]],
  [[8, 8], [16, 6], [22, 2], [24, 8]],
  [[0, 6], [6, 2], [8, 8], [16, 16]],
  [[0, 4], [4, 4], [8, 8], [20, 12]],
];
const RHYTHMS3 = [
  [[0, 8], [8, 4], [12, 12]],
  [[0, 12], [12, 12]],
  [[4, 4], [8, 4], [12, 8], [20, 4]],
  [[0, 6], [6, 2], [8, 4], [12, 12]],
  [[0, 24]],
];

function phrase(chords2, theme, r, prevPitch) {
  const scale = scalePitches(theme.mode, theme.melLo, theme.melHi);
  const T = theme.barTicks;
  const rhythms = theme.beats === 3 ? RHYTHMS3 : RHYTHMS4;
  const rh = rhythms[Math.floor(r() * rhythms.length)];
  const notes = [[], []];
  let p = prevPitch;
  for (const [start, len] of rh) {
    const bar = start < T ? 0 : 1;
    const chord = chords2[bar];
    const strong = (start % T) === 0 || (start % T) === T / 2;
    if (strong) {
      const tones = voice(chord, p).filter((x) => x >= theme.melLo && x <= theme.melHi);
      const pool = tones.length ? tones : voice(chord, (theme.melLo + theme.melHi) / 2);
      p = pool.reduce((a, b) => (Math.abs(b - p) < Math.abs(a - p) ? b : a));
    } else {
      const idx = scale.reduce((best, x, i) => (Math.abs(x - p) < Math.abs(scale[best] - p) ? i : best), 0);
      const step = [-2, -1, -1, 1, 1, 2][Math.floor(r() * 6)];
      p = scale[Math.max(0, Math.min(scale.length - 1, idx + step))];
    }
    const local = start % T;
    const l = Math.min(len, T - local);
    notes[bar].push(note(p, local, l, 75, 55));
  }
  return { bars: notes, last: p };
}

// ── Song builder ──────────────────────────────────────────────────

function compose(theme) {
  const r = rng(theme.seed);
  theme.barTicks = theme.beats * 4;
  const sections = [
    { prog: 'A', pad: 1, bass: 'long', arp: null, mel: null },
    { prog: 'A', pad: 1, bass: 'long', arp: theme.arps[0], mel: null },
    { prog: 'A', pad: 1, bass: 'halves', arp: theme.arps[0], mel: 'a' },
    { prog: 'B', pad: 1, bass: 'halves', arp: theme.arps[1], mel: 'b' },
    { prog: 'A', pad: 0, bass: 'long', arp: theme.arps[2], mel: null },
    { prog: 'A', pad: 1, bass: 'pulse', arp: theme.arps[1], mel: 'a2' },
    { prog: 'B', pad: 1, bass: 'halves', arp: theme.arps[0], mel: 'b2' },
    { prog: 'A', pad: 1, bass: 'long', arp: 'sparse', mel: null },
  ];
  const ch = { pad: [], bass: [], arp: [], mel: [], perc: [] };
  const motifs = {};
  let lastPitch = (theme.melLo + theme.melHi) >> 1;
  const writeMel = (chords, key) => {
    const out = [];
    for (let b = 0; b < 8; b += 2) {
      const ph = phrase([chords[b], chords[b + 1]], theme, r, lastPitch);
      lastPitch = ph.last;
      out.push(...ph.bars);
    }
    motifs[key] = out;
    return out;
  };
  const vary = (bars, transpose = 0, thin = false) => bars.map((notes, i) => notes
    .filter((_, j) => !thin || j % 2 === 0 || i % 2 === 1)
    .map((n) => ({ ...n, pitches: n.pitches.map((p) => p + transpose) })));

  for (const s of sections) {
    const chords = theme.progressions[s.prog];
    let mel = null;
    if (s.mel === 'a') mel = writeMel(chords, 'a');
    else if (s.mel === 'b') mel = writeMel(chords, 'b');
    else if (s.mel === 'a2') mel = motifs.a ? vary(motifs.a.slice(0, 4).concat(writeMel(chords, 'a2x').slice(4))) : writeMel(chords, 'a2');
    else if (s.mel === 'b2') mel = motifs.b ? vary(motifs.b, 0, true) : writeMel(chords, 'b2');
    for (let b = 0; b < 8; b++) {
      const chord = chords[b];
      ch.pad.push(s.pad ? padBar(chord, theme, theme.padVol) : []);
      ch.bass.push(bassBar(chord, theme, s.bass));
      ch.arp.push(s.arp ? arpBar(chord, theme, s.arp, theme.arpVol) : []);
      ch.mel.push(mel ? mel[b] : []);
      if (theme.perc) ch.perc.push(theme.perc(b, s, theme.barTicks));
    }
  }

  const channel = (type, instrument, bars, octave = 3) => {
    const patterns = [];
    const sequence = bars.map((notes) => {
      if (!notes.length) return 0;
      patterns.push({ instruments: [1], notes });
      return patterns.length;
    });
    const c = { type, instruments: [instrument], patterns: patterns.length ? patterns : [{ instruments: [1], notes: [] }], sequence };
    if (type === 'pitch') c.octaveScrollBar = octave;
    return c;
  };

  const channels = [
    channel('pitch', theme.inst.mel, ch.mel, 4),
    channel('pitch', theme.inst.arp, ch.arp, 3),
    channel('pitch', theme.inst.pad, ch.pad, 3),
    channel('pitch', theme.inst.bass, ch.bass, 1),
  ];
  if (theme.perc) channels.push(channel('drum', theme.inst.perc, ch.perc));

  const json = {
    format: 'BeepBox', version: 9, scale: 'expert', key: theme.key,
    introBars: 0, loopBars: 64, beatsPerBar: theme.beats, ticksPerBeat: 4, beatsPerMinute: theme.bpm,
    layeredInstruments: false, patternInstruments: false, channels,
  };
  const song = new Song();
  song.fromJsonObject(json);
  const hash = song.toBase64String();
  const check = new Song(hash);
  if (check.barCount !== 64) throw new Error(`${theme.id}: round trip lost bars (${check.barCount})`);
  return { hash, seconds: Math.round((64 * theme.beats * 60) / theme.bpm) };
}

// ── Instruments ───────────────────────────────────────────────────

const I = {
  softPad: (vol = 40) => ({ type: 'harmonics', volume: vol, effects: ['chord type', 'chorus', 'reverb'], chord: 'simultaneous', chorus: 70, reverb: 70, unison: 'hum', fadeInSeconds: 0.8, fadeOutTicks: 96, envelopes: [] }),
  glassPad: (vol = 35) => ({ type: 'supersaw', volume: vol, effects: ['chord type', 'reverb'], chord: 'simultaneous', reverb: 85, pulseWidth: 50, dynamism: 20, spread: 30, shape: 0, fadeInSeconds: 1.2, fadeOutTicks: 144, envelopes: [] }),
  organ: (vol = 35) => ({ type: 'harmonics', volume: vol, effects: ['chord type', 'reverb'], chord: 'simultaneous', reverb: 80, unison: 'none', fadeInSeconds: 0.3, fadeOutTicks: 72, harmonics: [100, 86, 71, 57, 43, 29, 14, 0, 14, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], envelopes: [] }),
  harp: (vol = 55) => ({ type: 'Picked String', volume: vol, effects: ['echo', 'reverb'], echoSustain: 35, echoDelayBeats: 1.5, reverb: 55, unison: 'piano', stringSustain: 55, fadeInSeconds: 0, fadeOutTicks: 48, harmonics: [100, 57, 43, 29, 14, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], envelopes: [] }),
  bell: (vol = 45) => ({ type: 'chip', wave: 'rounded', unison: 'octave', volume: vol, effects: ['echo', 'reverb'], echoSustain: 45, echoDelayBeats: 0.75, reverb: 70, fadeInSeconds: 0, fadeOutTicks: 72, envelopes: [{ target: 'noteVolume', envelope: 'decay 2' }] }),
  epiano: (vol = 55) => ({ type: 'Picked String', volume: vol, effects: ['chorus', 'reverb'], chorus: 40, reverb: 40, unison: 'piano', stringSustain: 75, fadeInSeconds: 0, fadeOutTicks: 48, harmonics: [100, 86, 29, 14, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], envelopes: [] }),
  flute: (vol = 50) => ({ type: 'chip', wave: 'rounded', unison: 'none', volume: vol, effects: ['vibrato', 'reverb'], vibrato: 'light', reverb: 60, fadeInSeconds: 0.06, fadeOutTicks: 24, envelopes: [] }),
  whistle: (vol = 45) => ({ type: 'chip', wave: 'triangle', unison: 'shimmer', volume: vol, effects: ['vibrato', 'echo', 'reverb'], vibrato: 'delayed', echoSustain: 30, echoDelayBeats: 1, reverb: 70, fadeInSeconds: 0.05, fadeOutTicks: 36, envelopes: [] }),
  square: (vol = 40) => ({ type: 'chip', wave: 'square', unison: 'none', volume: vol, effects: ['reverb'], reverb: 30, fadeInSeconds: 0, fadeOutTicks: 12, envelopes: [] }),
  bass: (vol = 60) => ({ type: 'chip', wave: 'triangle', unison: 'none', volume: vol, effects: ['reverb'], reverb: 20, fadeInSeconds: 0.02, fadeOutTicks: 48, envelopes: [] }),
  softBass: (vol = 55) => ({ type: 'chip', wave: 'rounded', unison: 'none', volume: vol, effects: ['reverb'], reverb: 25, fadeInSeconds: 0.05, fadeOutTicks: 72, envelopes: [] }),
  hats: (vol = 25) => ({ type: 'noise', wave: 'white', volume: vol, effects: ['reverb'], reverb: 30, fadeInSeconds: 0, fadeOutTicks: 6, envelopes: [{ target: 'noteVolume', envelope: 'decay 1' }] }),
};

// Gentle percussion for the livelier themes (drum pitches 0–11).
const lofiPerc = (b, s, T) => (s.arp ? [note(2, 0, 2, 45), note(7, T / 4, 1, 25), note(9, T / 2, 2, 35), note(7, (3 * T) / 4, 1, 25)] : []);
const arcadePerc = (b, s, T) => Array.from({ length: T / 2 }, (_, i) => note(i % 4 === 0 ? 1 : 8, i * 2, 1, i % 4 === 0 ? 60 : 30));

// Chords are [semitones above the key, quality]. Eight per progression, one per bar.
const THEMES = [
  {
    id: 'hub', title: 'The Core: Leaves of Light', key: 'D', mode: 'lydian', bpm: 68, beats: 4, seed: 11,
    progressions: { A: [[0, 'maj9'], [7, 'add9'], [9, 'm7'], [2, 'sus2'], [0, 'maj7'], [4, 'm7'], [7, 'six'], [2, 'add9']], B: [[9, 'm9'], [5, 'maj7'], [0, 'six'], [7, 'sus2'], [4, 'm7'], [9, 'm7'], [2, 'sus4'], [2, 'add9']] },
    inst: { mel: I.bell(42), arp: I.harp(48), pad: I.glassPad(38), bass: I.softBass(52) },
    arps: ['sparse', 'wave', 'quarters'], padCenter: 40, arpCenter: 50, bassBase: 12, melLo: 52, melHi: 69, padVol: 65, arpVol: 55,
  },
  {
    id: 'anglo', title: 'Anglo-Saxon Room: Amber Hearth', key: 'A', mode: 'dorian', bpm: 74, beats: 4, seed: 23,
    progressions: { A: [[0, 'min'], [10, 'maj'], [5, 'maj'], [0, 'sus2'], [3, 'maj'], [10, 'maj'], [7, 'm7'], [0, 'sus4']], B: [[5, 'add9'], [3, 'maj'], [0, 'min'], [10, 'six'], [8, 'maj7'], [10, 'maj'], [5, 'maj'], [7, 'sus4']] },
    inst: { mel: I.flute(50), arp: I.harp(55), pad: I.softPad(36), bass: I.bass(55) },
    arps: ['broken', 'eighths', 'sparse'], padCenter: 38, arpCenter: 48, bassBase: 12, melLo: 50, melHi: 67, padVol: 60, arpVol: 60,
  },
  {
    id: 'latin', title: 'Latin Room: Marble Chorale', key: 'F', mode: 'ionian', bpm: 64, beats: 3, seed: 37,
    progressions: { A: [[0, 'maj'], [9, 'min'], [5, 'maj7'], [7, 'sus4'], [0, 'add9'], [4, 'min'], [5, 'six'], [7, 'dom7']], B: [[2, 'm7'], [7, 'maj'], [0, 'maj7'], [9, 'm7'], [5, 'maj'], [2, 'min'], [10, 'maj'], [7, 'sus4']] },
    inst: { mel: I.whistle(46), arp: I.harp(45), pad: I.organ(40), bass: I.softBass(55) },
    arps: ['sparse', 'quarters', 'eighths'], padCenter: 40, arpCenter: 52, bassBase: 12, melLo: 53, melHi: 69, padVol: 62, arpVol: 50,
  },
  {
    id: 'greek', title: 'Greek Room: Star Map', key: 'E', mode: 'phrygian', bpm: 70, beats: 4, seed: 41,
    progressions: { A: [[0, 'min'], [1, 'maj7'], [0, 'sus2'], [10, 'min'], [8, 'maj7'], [1, 'maj'], [3, 'six'], [0, 'sus4']], B: [[5, 'm9'], [3, 'maj'], [1, 'maj9'], [0, 'madd9'], [8, 'maj'], [10, 'm7'], [1, 'add9'], [0, 'min']] },
    inst: { mel: I.bell(40), arp: I.harp(42), pad: I.glassPad(40), bass: I.softBass(50) },
    arps: ['wave', 'broken', 'sparse'], padCenter: 40, arpCenter: 52, bassBase: 12, melLo: 52, melHi: 71, padVol: 66, arpVol: 48,
  },
  {
    id: 'lingo', title: 'Lingo Room: Study Hall', key: 'C', mode: 'pentaMajor', bpm: 82, beats: 4, seed: 53,
    progressions: { A: [[0, 'maj7'], [9, 'm7'], [5, 'maj7'], [7, 'six'], [0, 'add9'], [4, 'm7'], [2, 'm7'], [7, 'sus4']], B: [[5, 'maj9'], [4, 'm7'], [9, 'm9'], [7, 'dom7'], [2, 'm7'], [5, 'six'], [0, 'maj7'], [7, 'sus2']] },
    inst: { mel: I.epiano(48), arp: I.epiano(42), pad: I.softPad(32), bass: I.bass(55), perc: I.hats(22) },
    arps: ['quarters', 'broken', 'sparse'], padCenter: 40, arpCenter: 50, bassBase: 12, melLo: 52, melHi: 69, padVol: 55, arpVol: 50, perc: lofiPerc,
  },
  {
    id: 'rot', title: 'The Rot: Slow Static', key: 'D', mode: 'aeolian', bpm: 76, beats: 4, seed: 67,
    progressions: { A: [[0, 'min'], [8, 'maj7'], [3, 'maj'], [10, 'sus2'], [0, 'm9'], [5, 'min'], [8, 'maj'], [7, 'sus4']], B: [[5, 'm7'], [10, 'maj'], [3, 'add9'], [8, 'maj7'], [1, 'maj'], [0, 'min'], [10, 'sus2'], [7, 'dom7']] },
    inst: { mel: I.whistle(42), arp: I.bell(38), pad: I.glassPad(42), bass: I.bass(60) },
    arps: ['broken', 'eighths', 'wave'], padCenter: 38, arpCenter: 50, bassBase: 12, melLo: 50, melHi: 67, padVol: 66, arpVol: 45,
  },
  {
    id: 'arcade', title: 'Overclock', key: 'G', mode: 'mixolydian', bpm: 118, beats: 4, seed: 79,
    progressions: { A: [[0, 'maj'], [10, 'maj'], [5, 'maj'], [0, 'sus4'], [0, 'maj'], [10, 'add9'], [5, 'six'], [7, 'min']], B: [[5, 'maj'], [7, 'min'], [10, 'maj'], [0, 'maj'], [3, 'maj'], [5, 'maj'], [10, 'sus2'], [0, 'sus4']] },
    inst: { mel: I.square(38), arp: I.square(32), pad: I.softPad(30), bass: I.bass(60), perc: I.hats(28) },
    arps: ['eighths', 'broken', 'eighths'], padCenter: 40, arpCenter: 52, bassBase: 12, melLo: 55, melHi: 72, padVol: 50, arpVol: 45, perc: arcadePerc,
  },
];

const out = {};
const lines = [];
for (const t of THEMES) {
  const { hash, seconds } = compose(t);
  out[t.id] = { title: t.title, hash, seconds };
  lines.push(`${t.title} (${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')} loop): https://www.beepbox.co/#${hash}`);
}

const file = path.join(root, 'src/site/cybermorph/js/data/music.js');
fs.writeFileSync(file, `/**
 * CyberMorph's background music: one BeepBox song per room, written by
 * scripts/compose-cybermorph-music.mjs. Paste any hash after https://www.beepbox.co/# to edit it.
 */

export const MUSIC = ${JSON.stringify(out, null, 2)};
`);
console.log(lines.join('\n'));
console.log(`\nWrote ${path.relative(root, file)}`);
