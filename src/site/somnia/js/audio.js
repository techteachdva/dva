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
