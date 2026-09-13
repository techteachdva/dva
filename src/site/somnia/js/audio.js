import {
  loadSettings,
  saveSettings,
  MUSIC_TRACKS,
  RADIO_PLAYLIST,
  musicCreditHtml,
  artCreditHtml,
  boxArtCreditHtml,
  boxArtSplashCreditHtml,
  footerCreditsHtml,
} from "./audio-settings.js";

export {
  musicCreditHtml,
  artCreditHtml,
  boxArtCreditHtml,
  boxArtSplashCreditHtml,
  footerCreditsHtml,
  MUSIC_TRACKS,
};

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
  attachCathedral(ac);
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

function attachCathedral(ac) {
  if (!sfxGain) return;
  try {
    const delay = ac.createDelay(1.4);
    delay.delayTime.value = 0.18;
    const wet = ac.createGain();
    wet.gain.value = 0.26;
    const feedback = ac.createGain();
    feedback.gain.value = 0.24;
    const filter = ac.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 2200;
    sfxGain.connect(delay);
    delay.connect(filter);
    filter.connect(wet);
    wet.connect(ac.destination);
    delay.connect(feedback);
    feedback.connect(delay);
  } catch {
    /* delay graph unsupported */
  }
}

function isSfxMuted() {
  settings = loadSettings();
  return settings.sfxMuted;
}

function tone({ freq = 440, dur = 0.1, type = "sine", vol = 0.12, slide = 0, delay = 0, echo = 0 }) {
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
  gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  connectSfxOutput(gain);
  osc.connect(gain);
  if (type === "sine" || type === "triangle") {
    const lfo = ac.createOscillator();
    const lfoGain = ac.createGain();
    lfo.type = "sine";
    lfo.frequency.setValueAtTime(4.6, t0);
    lfoGain.gain.setValueAtTime(Math.max(3, freq * 0.012), t0);
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    lfo.start(t0);
    lfo.stop(t0 + dur + 0.03);
  }
  osc.start(t0);
  osc.stop(t0 + dur + 0.03);
  if (echo > 0) {
    tone({
      freq: freq * 0.995,
      dur: dur * 1.15,
      type,
      vol: vol * 0.36,
      slide: slide * 0.4,
      delay: delay + echo,
      echo: 0,
    });
    if (echo >= 0.1) {
      tone({
        freq: freq * 0.5,
        dur: dur * 1.35,
        type: "sine",
        vol: vol * 0.16,
        delay: delay + echo * 2,
        echo: 0,
      });
    }
  }
}

function organ({ freq = 220, dur = 0.28, vol = 0.07, delay = 0 }) {
  tone({ freq, dur, type: "sine", vol, delay, echo: 0.14 });
  tone({ freq: freq * 2, dur: dur * 0.85, type: "triangle", vol: vol * 0.45, delay: delay + 0.012, echo: 0.12 });
  tone({ freq: freq * 3, dur: dur * 0.55, type: "sine", vol: vol * 0.18, delay: delay + 0.02 });
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
      tone({ freq: 523, dur: 0.055, type: "triangle", vol: 0.055, echo: 0.11 });
      tone({ freq: 784, dur: 0.04, type: "sine", vol: 0.028, delay: 0.008 });
      break;
    case "select":
      tone({ freq: 659, dur: 0.07, type: "sine", vol: 0.07, slide: 90, echo: 0.1 });
      break;
    case "deselect":
      tone({ freq: 392, dur: 0.06, type: "sine", vol: 0.045, slide: -70, echo: 0.1 });
      break;
    case "draw": {
      const n = Math.min(opts.count || 1, 4);
      for (let i = 0; i < n; i += 1) {
        organ({ freq: 196 + i * 28, dur: 0.2, vol: 0.055, delay: i * 0.055 });
      }
      break;
    }
    case "discard":
      tone({ freq: 247, dur: 0.14, type: "triangle", vol: 0.07, slide: -120, echo: 0.12 });
      break;
    case "repress":
      tone({ freq: 175, dur: 0.22, type: "sawtooth", vol: 0.05, slide: -80, echo: 0.16 });
      organ({ freq: 110, dur: 0.28, vol: 0.04, delay: 0.04 });
      break;
    case "dream":
      organ({ freq: 220, dur: 0.42, vol: 0.075 });
      organ({ freq: 277, dur: 0.38, vol: 0.05, delay: 0.16 });
      tone({ freq: 659, dur: 0.45, type: "triangle", vol: 0.045, slide: 80, delay: 0.28, echo: 0.18 });
      break;
    case "reveal":
    case "flip":
      organ({ freq: 262, dur: 0.32, vol: 0.065 });
      tone({ freq: 784, dur: 0.22, type: "triangle", vol: 0.05, slide: 140, delay: 0.08, echo: 0.14 });
      break;
    case "move":
      tone({ freq: 196, dur: 0.18, type: "sine", vol: 0.05, slide: 220, echo: 0.12 });
      tone({ freq: 523, dur: 0.16, type: "triangle", vol: 0.04, delay: 0.1, echo: 0.14 });
      break;
    case "phase":
      organ({ freq: 220, dur: 0.2, vol: 0.055 });
      organ({ freq: 277, dur: 0.2, vol: 0.05, delay: 0.1 });
      organ({ freq: 330, dur: 0.26, vol: 0.06, delay: 0.2 });
      break;
    case "acquire":
      organ({ freq: 262, dur: 0.2, vol: 0.06 });
      organ({ freq: 330, dur: 0.2, vol: 0.055, delay: 0.12 });
      organ({ freq: 392, dur: 0.28, vol: 0.07, delay: 0.24 });
      break;
    case "victory":
      [262, 330, 392, 523, 659].forEach((freq, i) => {
        organ({ freq, dur: 0.22, vol: 0.07, delay: i * 0.13 });
      });
      tone({ freq: 784, dur: 0.5, type: "triangle", vol: 0.08, delay: 0.72, echo: 0.2 });
      break;
    case "sparkle":
      tone({ freq: 880 + Math.random() * 360, dur: 0.09, type: "sine", vol: 0.04, echo: 0.1 });
      break;
    default:
      tone({ freq: 440, dur: 0.05, type: "sine", vol: 0.05, echo: 0.1 });
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
