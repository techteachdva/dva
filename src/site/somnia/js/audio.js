const STORAGE_KEY = "somnia.musicMuted";
const TRACK = "audio/dreams-become-real.mp3";
const DEFAULT_VOLUME = 0.4;

export const MUSIC_ATTRIBUTION = {
  title: "Dreams Become Real",
  artist: "Kevin MacLeod",
  license: "CC BY 4.0",
  licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
  sourceUrl: "https://incompetech.com",
};

let bgm = null;
let started = false;
let muted = false;
let audioCtx = null;

function ensureAudioContext() {
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      return null;
    }
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function isSfxMuted() {
  return muted;
}

function tone({ freq = 440, dur = 0.1, type = "sine", vol = 0.12, slide = 0, delay = 0 }) {
  const ac = ensureAudioContext();
  if (!ac || isSfxMuted()) return;
  const t0 = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slide) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t0 + dur);
  }
  gain.gain.setValueAtTime(0.001, t0);
  gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  osc.connect(gain).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

export function initSfx() {
  const unlock = () => ensureAudioContext();
  window.addEventListener("click", unlock, { capture: true });
  window.addEventListener("keydown", unlock, { capture: true });
}

export function playSfx(name, opts = {}) {
  switch (name) {
    case "click":
      tone({ freq: 520, dur: 0.04, type: "triangle", vol: 0.07 });
      break;
    case "select":
      tone({ freq: 660, dur: 0.05, type: "sine", vol: 0.08, slide: 120 });
      break;
    case "deselect":
      tone({ freq: 440, dur: 0.04, type: "sine", vol: 0.05, slide: -60 });
      break;
    case "draw": {
      const n = Math.min(opts.count || 1, 4);
      for (let i = 0; i < n; i += 1) {
        tone({
          freq: 360 + i * 45,
          dur: 0.12,
          type: "sine",
          vol: 0.09,
          slide: 180,
          delay: i * 0.055,
        });
      }
      break;
    }
    case "discard":
      tone({ freq: 280, dur: 0.1, type: "triangle", vol: 0.08, slide: -140 });
      tone({ freq: 180, dur: 0.08, type: "sine", vol: 0.05, slide: -80, delay: 0.04 });
      break;
    case "repress":
      tone({ freq: 200, dur: 0.15, type: "sawtooth", vol: 0.07, slide: -100 });
      tone({ freq: 140, dur: 0.2, type: "sine", vol: 0.06, delay: 0.08 });
      break;
    case "dream":
      tone({ freq: 220, dur: 0.25, type: "sine", vol: 0.1, slide: 400 });
      tone({ freq: 440, dur: 0.35, type: "triangle", vol: 0.08, slide: 200, delay: 0.15 });
      tone({ freq: 660, dur: 0.4, type: "sine", vol: 0.06, delay: 0.3 });
      break;
    case "reveal":
      tone({ freq: 520, dur: 0.2, type: "sine", vol: 0.1, slide: 300 });
      tone({ freq: 880, dur: 0.25, type: "triangle", vol: 0.07, delay: 0.1 });
      break;
    case "phase":
      tone({ freq: 440, dur: 0.12, type: "sine", vol: 0.1 });
      tone({ freq: 554, dur: 0.12, type: "sine", vol: 0.1, delay: 0.1 });
      tone({ freq: 659, dur: 0.18, type: "sine", vol: 0.12, delay: 0.2 });
      break;
    case "acquire":
      tone({ freq: 523, dur: 0.12, type: "sine", vol: 0.1 });
      tone({ freq: 659, dur: 0.12, type: "sine", vol: 0.1, delay: 0.12 });
      tone({ freq: 784, dur: 0.2, type: "triangle", vol: 0.12, delay: 0.24 });
      break;
    case "sparkle":
      tone({ freq: 900 + Math.random() * 400, dur: 0.08, type: "sine", vol: 0.05 });
      break;
    default:
      tone({ freq: 440, dur: 0.05, type: "sine", vol: 0.06 });
  }
}

export function bindButtonRipples() {
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".btn");
    if (!btn || btn.disabled) return;
    if (!btn.hasAttribute("data-music-toggle")) playSfx("click");
    const rect = btn.getBoundingClientRect();
    btn.style.setProperty("--ripple-x", `${((e.clientX - rect.left) / rect.width) * 100}%`);
    btn.style.setProperty("--ripple-y", `${((e.clientY - rect.top) / rect.height) * 100}%`);
    btn.classList.remove("ripple");
    void btn.offsetWidth;
    btn.classList.add("ripple");
    setTimeout(() => btn.classList.remove("ripple"), 420);
  }, { capture: true });
}

function loadMutedPref() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function saveMutedPref(value) {
  try {
    localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export function musicCreditHtml() {
  const { title, artist, license, licenseUrl, sourceUrl } = MUSIC_ATTRIBUTION;
  const host = sourceUrl.replace(/^https?:\/\//, "");
  return `<p class="music-credit">Music: <a href="${sourceUrl}" rel="noopener noreferrer">"${title}"</a> by ${artist} (${host}), licensed under <a href="${licenseUrl}" rel="noopener noreferrer">${license}</a>.</p>`;
}

export function initSoundtrack() {
  if (bgm) return;
  initSfx();
  muted = loadMutedPref();
  bgm = new Audio(TRACK);
  bgm.loop = true;
  bgm.preload = "auto";
  bgm.volume = muted ? 0 : DEFAULT_VOLUME;

  const kick = () => {
    if (!bgm || muted || started) return;
    const playPromise = bgm.play();
    if (playPromise?.then) {
      playPromise.then(() => { started = true; }).catch(() => {});
    } else {
      started = true;
    }
  };

  window.addEventListener("click", kick, { capture: true });
  window.addEventListener("keydown", kick, { capture: true });
}

export function startSoundtrack() {
  initSoundtrack();
  if (!bgm || muted) return;
  const playPromise = bgm.play();
  if (playPromise?.then) {
    playPromise.then(() => { started = true; }).catch(() => {});
  } else {
    started = true;
  }
}

export function isMusicMuted() {
  return muted;
}

function updateMusicToggleButtons() {
  document.querySelectorAll("[data-music-toggle]").forEach((btn) => {
    const on = !muted;
    btn.setAttribute("aria-pressed", on ? "true" : "false");
    btn.textContent = on ? "🔊" : "🔇";
    btn.title = on ? "Mute music" : "Unmute music";
  });
}

export function setMusicMuted(value) {
  muted = Boolean(value);
  saveMutedPref(muted);
  if (!bgm) return;
  bgm.volume = muted ? 0 : DEFAULT_VOLUME;
  if (muted) {
    bgm.pause();
    started = false;
  } else {
    startSoundtrack();
  }
  updateMusicToggleButtons();
}

export function toggleMusic() {
  setMusicMuted(!muted);
}

export function bindMusicToggle() {
  document.querySelectorAll("[data-music-toggle]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleMusic();
    });
  });
  updateMusicToggleButtons();
}
