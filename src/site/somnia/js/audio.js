import {
  loadSettings,
  saveSettings,
  MUSIC_TRACKS,
  RADIO_PLAYLIST,
  musicCreditHtml,
} from "./audio-settings.js";

export { musicCreditHtml, MUSIC_TRACKS };

let settings = loadSettings();
let bgm = null;
let musicStarted = false;
let radioIndex = 0;
let audioCtx = null;
let musicSource = null;
let musicGain = null;
let musicPan = null;
let sfxGain = null;
let sfxPan = null;
let musicChainReady = false;

function trackById(id) {
  return MUSIC_TRACKS.find((t) => t.id === id) || MUSIC_TRACKS[0];
}

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

function ensureMusicChain() {
  if (musicChainReady || !bgm) return;
  const ac = ensureAudioContext();
  if (!ac) return;
  try {
    musicSource = ac.createMediaElementSource(bgm);
    musicGain = ac.createGain();
    musicPan = ac.createStereoPanner();
    musicSource.connect(musicGain).connect(musicPan).connect(ac.destination);
    musicChainReady = true;
  } catch {
    /* already connected or unsupported */
  }
}

function ensureSfxChain() {
  const ac = ensureAudioContext();
  if (!ac || sfxGain) return;
  sfxGain = ac.createGain();
  sfxPan = ac.createStereoPanner();
  sfxGain.connect(sfxPan).connect(ac.destination);
  applySfxLevels();
}

function applyMusicLevels() {
  settings = loadSettings();
  if (musicGain) {
    musicGain.gain.value = settings.musicMuted || settings.musicMode === "off" ? 0 : settings.musicVolume;
  } else if (bgm) {
    bgm.volume = settings.musicMuted || settings.musicMode === "off" ? 0 : settings.musicVolume;
  }
  if (musicPan) {
    musicPan.pan.value = settings.musicPan;
  }
}

function applySfxLevels() {
  settings = loadSettings();
  if (!sfxGain) return;
  sfxGain.gain.value = settings.sfxMuted ? 0 : settings.sfxVolume;
  if (sfxPan) {
    sfxPan.pan.value = settings.sfxPan;
  }
}

function connectSfxOutput(gainNode) {
  ensureSfxChain();
  if (sfxGain) {
    gainNode.connect(sfxGain);
  } else {
    const ac = ensureAudioContext();
    if (ac) gainNode.connect(ac.destination);
  }
}

function isSfxMuted() {
  settings = loadSettings();
  return settings.sfxMuted;
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
  const peak = vol * settings.sfxVolume;
  gain.gain.setValueAtTime(0.001, t0);
  gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  connectSfxOutput(gain);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

export function initSfx() {
  const unlock = () => {
    ensureAudioContext();
    ensureSfxChain();
  };
  window.addEventListener("click", unlock, { capture: true });
  window.addEventListener("keydown", unlock, { capture: true });
}

export function playSfx(name, opts = {}) {
  settings = loadSettings();
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

function currentTrackFile() {
  settings = loadSettings();
  if (settings.musicMode === "track") {
    return trackById(settings.trackId).file;
  }
  const id = RADIO_PLAYLIST[radioIndex % RADIO_PLAYLIST.length];
  return trackById(id).file;
}

function advanceRadio() {
  settings = loadSettings();
  if (settings.musicMode !== "radio") return;
  radioIndex = (radioIndex + 1) % RADIO_PLAYLIST.length;
  loadCurrentTrack(true);
}

function loadCurrentTrack(autoplay = false) {
  if (!bgm) return;
  const file = currentTrackFile();
  const needsSwap = !bgm.src || !bgm.src.includes(file.replace(/^\//, ""));
  if (needsSwap) {
    bgm.pause();
    bgm.src = file;
    bgm.load();
    musicStarted = false;
  }
  bgm.loop = settings.musicMode === "track";
  applyMusicLevels();
  if (autoplay && !settings.musicMuted && settings.musicMode !== "off") {
    playMusic();
  }
}

function playMusic() {
  if (!bgm) return;
  settings = loadSettings();
  if (settings.musicMuted || settings.musicMode === "off") return;
  ensureMusicChain();
  applyMusicLevels();
  const playPromise = bgm.play();
  if (playPromise?.then) {
    playPromise.then(() => { musicStarted = true; }).catch(() => {});
  } else {
    musicStarted = true;
  }
}

export function initGameAudio() {
  if (bgm) return;
  initSfx();
  settings = loadSettings();
  bgm = new Audio();
  bgm.preload = "auto";
  bgm.addEventListener("ended", () => {
    if (settings.musicMode === "radio") advanceRadio();
  });
  loadCurrentTrack(false);
}

export function startGameRadio() {
  initGameAudio();
  settings = loadSettings();
  if (settings.musicMode === "off" || settings.musicMuted) return;
  loadCurrentTrack(true);
}

export function applyAudioSettings() {
  settings = loadSettings();
  loadCurrentTrack(musicStarted || settings.musicMode !== "off");
  applyMusicLevels();
  applySfxLevels();
  updateMusicToggleButtons();
}

export function getAudioState() {
  settings = loadSettings();
  return { ...settings };
}

export function setMusicMode(mode) {
  settings = saveSettings({ musicMode: mode });
  if (mode === "radio") radioIndex = 0;
  applyAudioSettings();
}

export function setTrackId(id) {
  settings = saveSettings({ trackId: id });
  applyAudioSettings();
}

export function setMusicMuted(value) {
  settings = saveSettings({ musicMuted: Boolean(value) });
  if (settings.musicMuted && bgm) {
    bgm.pause();
    musicStarted = false;
  } else {
    playMusic();
  }
  applyMusicLevels();
  updateMusicToggleButtons();
}

export function setSfxMuted(value) {
  settings = saveSettings({ sfxMuted: Boolean(value) });
  applySfxLevels();
}

export function setMusicVolume(value) {
  settings = saveSettings({ musicVolume: Math.min(1, Math.max(0, value)) });
  applyMusicLevels();
}

export function setSfxVolume(value) {
  settings = saveSettings({ sfxVolume: Math.min(1, Math.max(0, value)) });
  applySfxLevels();
}

export function setMusicPan(value) {
  settings = saveSettings({ musicPan: Math.min(1, Math.max(-1, value)) });
  applyMusicLevels();
}

export function setSfxPan(value) {
  settings = saveSettings({ sfxPan: Math.min(1, Math.max(-1, value)) });
  applySfxLevels();
}

export function isMusicMuted() {
  return loadSettings().musicMuted;
}

function updateMusicToggleButtons() {
  settings = loadSettings();
  const on = !settings.musicMuted && settings.musicMode !== "off";
  document.querySelectorAll("[data-music-toggle]").forEach((btn) => {
    btn.setAttribute("aria-pressed", on ? "true" : "false");
    btn.textContent = on ? "🔊" : "🔇";
    btn.title = on ? "Mute music (Esc for pause menu)" : "Unmute music";
  });
}

export function toggleMusic() {
  setMusicMuted(!loadSettings().musicMuted);
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

/* Menu-only: settings UI without playback */
export function initMenuAudioSettings() {
  initSfx();
}
