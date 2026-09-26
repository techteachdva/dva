import {
  loadSettings,
  saveSettings,
  MUSIC_TRACKS,
  RADIO_PLAYLIST,
  MENU_THEME_TRACK,
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
let themeMode = false;
let audioCtx = null;
let musicSource = null;
let musicGain = null;
let musicPan = null;
let sfxGain = null;
let sfxPan = null;
let musicChainReady = false;
let landscapeSfxMap = null;
let landscapeSfxLoading = null;
const landscapeAudioCache = new Map();
let lastLandscapeSfxId = "";
let lastLandscapeSfxAt = 0;
let activeLandscapePlayback = null;

const LANDSCAPE_FADE_IN = 0.12;
const LANDSCAPE_FADE_OUT = 0.5;
const LANDSCAPE_MAX_SEC = 2.6;
const LANDSCAPE_INTERRUPT_FADE = 0.1;

function trackById(id) {
  if (id === MENU_THEME_TRACK.id) return MENU_THEME_TRACK;
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
  // iOS reports "interrupted" (Siri, FaceTime, app switch) as well as
  // "suspended"; anything short of running needs a resume.
  if (audioCtx.state !== "running" && audioCtx.state !== "closed") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * After an iOS interruption the graph stays silent even though the media
 * element still reports playing. Kick the context and the element together.
 */
function recoverAfterInterruption() {
  const ac = ensureAudioContext();
  if (!ac) return;
  if (!bgm || !musicStarted) return;
  settings = loadSettings();
  if (settings.musicMuted || settings.musicMode === "off") return;
  const kick = () => {
    if (bgm.paused) {
      bgm.play().catch(() => {});
    }
  };
  if (ac.state === "running") kick();
  else ac.resume().then(kick).catch(() => {});
}

let visibilityBound = false;
function bindVisibilityRecovery() {
  if (visibilityBound) return;
  visibilityBound = true;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") recoverAfterInterruption();
  });
  window.addEventListener("pageshow", recoverAfterInterruption);
  window.addEventListener("focus", recoverAfterInterruption);
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
    loadLandscapeSfxMap();
    window.removeEventListener("click", unlock, true);
    window.removeEventListener("keydown", unlock, true);
    window.removeEventListener("pointerdown", unlock, true);
    window.removeEventListener("touchstart", unlock, true);
  };
  window.addEventListener("click", unlock, { capture: true });
  window.addEventListener("keydown", unlock, { capture: true });
  window.addEventListener("pointerdown", unlock, { capture: true });
  window.addEventListener("touchstart", unlock, { capture: true, passive: true });
}

async function loadLandscapeSfxMap() {
  if (landscapeSfxMap || landscapeSfxLoading) return landscapeSfxLoading;
  landscapeSfxLoading = fetch("data/landscape-sfx.json")
    .then((res) => (res.ok ? res.json() : {}))
    .then((data) => {
      landscapeSfxMap = data || {};
      return landscapeSfxMap;
    })
    .catch(() => {
      landscapeSfxMap = {};
      return landscapeSfxMap;
    });
  return landscapeSfxLoading;
}

/**
 * iOS keeps a hardware decoder per <audio> element and caps how many can be
 * alive at once; past the cap new stings fail silently. Keep a small LRU.
 */
const LANDSCAPE_CACHE_MAX = 6;
function evictLandscapeAudio() {
  while (landscapeAudioCache.size > LANDSCAPE_CACHE_MAX) {
    const oldestId = landscapeAudioCache.keys().next().value;
    const oldest = landscapeAudioCache.get(oldestId);
    landscapeAudioCache.delete(oldestId);
    if (!oldest || activeLandscapePlayback?.audio === oldest) continue;
    try {
      oldest.pause();
      oldest.removeAttribute("src");
      oldest.load();
    } catch {
      /* already released */
    }
  }
}

function proceduralLandscapeTone(landscapeId) {
  let hash = 0;
  for (let i = 0; i < landscapeId.length; i += 1) {
    hash = (hash * 31 + landscapeId.charCodeAt(i)) >>> 0;
  }
  const freq = 80 + (hash % 720);
  const slide = ((hash >> 8) % 200) - 80;
  tone({ freq, dur: 1.1 + (hash % 80) / 100, type: "sine", vol: 0.08, slide, echo: 0.12 });
}

function stopLandscapePlayback(fadeOut = true) {
  const active = activeLandscapePlayback;
  if (!active) return;
  activeLandscapePlayback = null;
  if (active.stopTimer) clearTimeout(active.stopTimer);
  const { audio, gain, ac } = active;
  if (fadeOut && ac && gain) {
    const now = ac.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(0, now + LANDSCAPE_INTERRUPT_FADE);
    setTimeout(() => {
      audio.pause();
      audio.currentTime = 0;
    }, LANDSCAPE_INTERRUPT_FADE * 1000 + 30);
  } else {
    audio.pause();
    audio.currentTime = 0;
  }
}

function connectLandscapeAudio(audio, ac) {
  if (audio.__landscapeGain) return audio.__landscapeGain;
  const src = ac.createMediaElementSource(audio);
  const gain = ac.createGain();
  gain.gain.value = 0;
  src.connect(gain).connect(sfxGain);
  audio.__landscapeGain = gain;
  audio.__sfxConnected = true;
  return gain;
}

function fadeLandscapeVolume(audio, target, durationMs) {
  const steps = Math.max(4, Math.round(durationMs / 25));
  const start = audio.volume;
  const delta = (target - start) / steps;
  let step = 0;
  const tick = () => {
    step += 1;
    audio.volume = Math.max(0, Math.min(1, start + delta * step));
    if (step < steps) setTimeout(tick, durationMs / steps);
  };
  tick();
}

function playLandscapeElement(audio, landscapeId, onFail) {
  stopLandscapePlayback(true);
  ensureSfxChain();
  const ac = ensureAudioContext();
  if (!ac || !sfxGain) {
    audio.volume = 0;
    audio.currentTime = 0;
    const stopTimer = setTimeout(() => {
      fadeLandscapeVolume(audio, 0, LANDSCAPE_FADE_OUT * 1000);
      setTimeout(() => {
        audio.pause();
        audio.currentTime = 0;
        if (activeLandscapePlayback?.audio === audio) activeLandscapePlayback = null;
      }, LANDSCAPE_FADE_OUT * 1000 + 40);
    }, LANDSCAPE_MAX_SEC * 1000);
    activeLandscapePlayback = { audio, stopTimer };
    audio.play()
      .then(() => fadeLandscapeVolume(audio, settings.sfxVolume, LANDSCAPE_FADE_IN * 1000))
      .catch(() => onFail?.());
    return;
  }

  let gain;
  try {
    gain = connectLandscapeAudio(audio, ac);
  } catch {
    onFail?.();
    return;
  }

  const startPlayback = () => {
    const fileDur = audio.duration && Number.isFinite(audio.duration) ? audio.duration : LANDSCAPE_MAX_SEC;
    const playSec = Math.min(fileDur, LANDSCAPE_MAX_SEC);
    const now = ac.currentTime;

    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(1, now + LANDSCAPE_FADE_IN);

    const fadeStart = now + Math.max(LANDSCAPE_FADE_IN + 0.05, playSec - LANDSCAPE_FADE_OUT);
    gain.gain.setValueAtTime(1, fadeStart);
    gain.gain.linearRampToValueAtTime(0, fadeStart + LANDSCAPE_FADE_OUT);

    const stopTimer = setTimeout(() => {
      audio.pause();
      audio.currentTime = 0;
      if (activeLandscapePlayback?.audio === audio) activeLandscapePlayback = null;
    }, playSec * 1000 + 60);

    activeLandscapePlayback = { audio, gain, ac, stopTimer };
    audio.currentTime = 0;
    audio.play().catch(() => {
      if (activeLandscapePlayback?.audio === audio) activeLandscapePlayback = null;
      onFail?.();
    });
  };

  audio.currentTime = 0;
  if (audio.readyState >= 1) startPlayback();
  else audio.addEventListener("loadedmetadata", startPlayback, { once: true });
}

export function playLandscapeSfx(landscapeId) {
  if (!landscapeId || isSfxMuted()) return;
  settings = loadSettings();
  const now = Date.now();
  if (landscapeId === lastLandscapeSfxId && now - lastLandscapeSfxAt < 450) return;
  lastLandscapeSfxId = landscapeId;
  lastLandscapeSfxAt = now;

  loadLandscapeSfxMap().then((map) => {
    const entry = map?.[landscapeId];
    if (!entry?.file) {
      proceduralLandscapeTone(landscapeId);
      return;
    }
    let audio = landscapeAudioCache.get(landscapeId);
    if (audio) {
      // Refresh recency: Map iteration order is insertion order.
      landscapeAudioCache.delete(landscapeId);
      landscapeAudioCache.set(landscapeId, audio);
    } else {
      audio = new Audio(entry.file);
      audio.preload = "auto";
      landscapeAudioCache.set(landscapeId, audio);
      evictLandscapeAudio();
    }
    audio.volume = 1;
    playLandscapeElement(audio, landscapeId, () => proceduralLandscapeTone(landscapeId));
  });
}

export function playBossStinger() {
  playSfx("boss-stinger");
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
    case "dice-roll":
      for (let i = 0; i < 5; i += 1) {
        tone({ freq: 180 + i * 40, dur: 0.05, type: "triangle", vol: 0.045, delay: i * 0.05, echo: 0.08 });
      }
      break;
    case "dice-win":
      [392, 523, 659, 784].forEach((freq, i) => {
        organ({ freq, dur: 0.18, vol: 0.07, delay: i * 0.09 });
      });
      tone({ freq: 880, dur: 0.4, type: "triangle", vol: 0.07, delay: 0.38, echo: 0.18 });
      break;
    case "dice-lose":
      organ({ freq: 196, dur: 0.28, vol: 0.07 });
      tone({ freq: 220, dur: 0.45, type: "sawtooth", vol: 0.05, slide: -90, delay: 0.08, echo: 0.16 });
      tone({ freq: 98, dur: 0.55, type: "sine", vol: 0.07, delay: 0.12, echo: 0.2 });
      break;
    case "boss-stinger":
      organ({ freq: 110, dur: 0.35, vol: 0.09 });
      organ({ freq: 146, dur: 0.32, vol: 0.08, delay: 0.08 });
      tone({ freq: 220, dur: 0.55, type: "sawtooth", vol: 0.06, slide: -80, delay: 0.16, echo: 0.18 });
      tone({ freq: 55, dur: 0.7, type: "sine", vol: 0.08, delay: 0.05, echo: 0.22 });
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
  themeMode = false;
  const file = currentTrackFile();
  // bgm.src is URL-encoded, so compare encoded (the theme file contains a space).
  const encoded = encodeURI(file.replace(/^\//, ""));
  const needsSwap = !bgm.src || !bgm.src.includes(encoded);
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

/** Load "Dreamer's Awakening" — the main menu loop. */
function loadThemeTrack(loop) {
  if (!bgm) return;
  themeMode = true;
  bgm.pause();
  bgm.src = MENU_THEME_TRACK.file;
  bgm.load();
  bgm.loop = loop;
  musicStarted = false;
  applyMusicLevels();
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
  loadLandscapeSfxMap();
  bindVisibilityRecovery();
  settings = loadSettings();
  bgm = new Audio();
  bgm.preload = "auto";
  bgm.setAttribute("playsinline", "");
  bgm.addEventListener("ended", () => {
    if (settings.musicMode === "radio") advanceRadio();
  });
  loadCurrentTrack(false);
}

export function startGameRadio() {
  initGameAudio();
  settings = loadSettings();
  if (settings.musicMode === "off" || settings.musicMuted) return;
  // Games open at the top of the radio rotation ("Dreams Become Real");
  // the menu theme only returns as the rotation's finale.
  radioIndex = 0;
  loadCurrentTrack(true);
}

/**
 * Main menu: loop the theme. Browsers need a gesture before audio starts, and
 * WebKit only honours click / touchend / keydown (not the touchstart-derived
 * pointerdown), so listen broadly and stop once playback has actually begun.
 */
export function startMenuTheme() {
  initGameAudio();
  loadThemeTrack(true);
  const GESTURES = ["pointerdown", "pointerup", "touchend", "click", "keydown"];
  let armed = true;
  const tryPlay = () => {
    const s = loadSettings();
    if (s.musicMuted || s.musicMode === "off") return;
    if (!bgm || (!bgm.paused && musicStarted)) {
      disarm();
      return;
    }
    ensureAudioContext();
    playMusic();
  };
  const disarm = () => {
    if (!armed) return;
    armed = false;
    GESTURES.forEach((type) => document.removeEventListener(type, tryPlay, true));
  };
  tryPlay();
  GESTURES.forEach((type) => document.addEventListener(type, tryPlay, { capture: true, passive: true }));
  bgm?.addEventListener("playing", () => {
    // Keep listening a beat longer: iOS can report playing then stall.
    setTimeout(() => { if (bgm && !bgm.paused) disarm(); }, 1500);
  });
}

export function applyAudioSettings() {
  settings = loadSettings();
  if (themeMode) {
    // Keep the theme playing through settings changes; only honor off/mute.
    if (settings.musicMuted || settings.musicMode === "off") {
      bgm?.pause();
      musicStarted = false;
    } else {
      playMusic();
    }
  } else {
    loadCurrentTrack(musicStarted || settings.musicMode !== "off");
  }
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
