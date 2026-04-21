// Tiny WebAudio SFX synth so we have no external files.
// First interaction unlocks the context.

let ctx = null;
let muted = false;

// --- v0.11 Background Music ---
// One looping HTMLAudioElement streamed from disk. Browsers won't let us
// autoplay before the user interacts, so we arm it on first keydown/click.
let bgm = null;
let bgmStarted = false;
let bgmVolume = 0.35;

function ensure() {
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      muted = true;
    }
  }
  return ctx;
}

function kickBgm() {
  if (!bgm || bgmStarted || muted) return;
  // play() returns a Promise; swallow errors so a denied autoplay doesn't
  // spam the console. The next user gesture will retry.
  const p = bgm.play();
  if (p && typeof p.then === "function") {
    p.then(() => { bgmStarted = true; }).catch(() => { /* try again on next input */ });
  } else {
    bgmStarted = true;
  }
}

window.addEventListener("keydown", () => { ensure(); kickBgm(); }, { capture: true });
window.addEventListener("click", () => { ensure(); kickBgm(); }, { capture: true });

// Caller hands us a URL. Safe to call twice; second call is ignored.
export function initBGM(src, { volume = 0.35, loop = true } = {}) {
  if (bgm) return bgm;
  bgmVolume = volume;
  bgm = new Audio(src);
  bgm.loop = loop;
  bgm.preload = "auto";
  bgm.volume = muted ? 0 : bgmVolume;
  return bgm;
}

export function setBgmVolume(v) {
  bgmVolume = Math.max(0, Math.min(1, v));
  if (bgm) bgm.volume = muted ? 0 : bgmVolume;
}

export function stopBGM() {
  if (!bgm) return;
  try { bgm.pause(); bgm.currentTime = 0; } catch (e) { /* ignore */ }
  bgmStarted = false;
}

function beep({ freq = 440, dur = 0.1, type = "square", vol = 0.15, slide = 0 }) {
  const ac = ensure();
  if (!ac || muted) return;
  const t0 = ac.currentTime;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t0 + dur);
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  osc.connect(gain).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur);
}

export const SFX = {
  click: () => beep({ freq: 620, dur: 0.05, type: "square", vol: 0.08 }),
  confirm: () => beep({ freq: 880, dur: 0.12, type: "square", vol: 0.12, slide: 220 }),
  deny: () => beep({ freq: 220, dur: 0.15, type: "sawtooth", vol: 0.12, slide: -80 }),
  jump: () => beep({ freq: 520, dur: 0.08, type: "triangle", vol: 0.1, slide: 180 }),
  grab: () => beep({ freq: 300, dur: 0.06, type: "square", vol: 0.08 }),
  hit: () => beep({ freq: 160, dur: 0.18, type: "sawtooth", vol: 0.2, slide: -120 }),
  crunch: () => {
    beep({ freq: 120, dur: 0.12, type: "sawtooth", vol: 0.2, slide: -60 });
    setTimeout(() => beep({ freq: 90, dur: 0.1, type: "square", vol: 0.15, slide: -40 }), 40);
  },
  slash: () => beep({ freq: 1100, dur: 0.08, type: "sawtooth", vol: 0.15, slide: -700 }),
  cast: () => {
    beep({ freq: 300, dur: 0.1, type: "sine", vol: 0.12, slide: 600 });
    setTimeout(() => beep({ freq: 900, dur: 0.12, type: "triangle", vol: 0.1, slide: -200 }), 60);
  },
  acid: () => beep({ freq: 200, dur: 0.25, type: "sawtooth", vol: 0.12, slide: -80 }),
  die: () => {
    beep({ freq: 440, dur: 0.2, type: "square", vol: 0.2, slide: -380 });
    setTimeout(() => beep({ freq: 120, dur: 0.4, type: "sawtooth", vol: 0.18, slide: -60 }), 200);
  },
  victory: () => {
    beep({ freq: 523, dur: 0.12, type: "square", vol: 0.15 });
    setTimeout(() => beep({ freq: 659, dur: 0.12, type: "square", vol: 0.15 }), 130);
    setTimeout(() => beep({ freq: 784, dur: 0.2, type: "square", vol: 0.18 }), 260);
    setTimeout(() => beep({ freq: 1046, dur: 0.3, type: "square", vol: 0.2 }), 460);
  },
  dodge: () => beep({ freq: 720, dur: 0.06, type: "triangle", vol: 0.1, slide: 300 }),
  thud: () => beep({ freq: 80, dur: 0.12, type: "sine", vol: 0.25 }),
};

export function toggleMute() {
  muted = !muted;
  if (bgm) bgm.volume = muted ? 0 : bgmVolume;
  return muted;
}

export function isMuted() {
  return muted;
}
