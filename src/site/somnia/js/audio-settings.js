export const SETTINGS_KEY = "somnia.settings";

export const MUSIC_TRACKS = [
  { id: "dreams-become-real", title: "Dreams Become Real", file: "audio/dreams-become-real.mp3" },
  { id: "ethereal-relaxation", title: "Ethereal Relaxation", file: "audio/ethereal-relaxation.mp3" },
  { id: "magic-escape-room", title: "Magic Escape Room", file: "audio/magic-escape-room.mp3" },
  { id: "that-zen-moment", title: "That Zen Moment", file: "audio/that-zen-moment.mp3" },
];

export const RADIO_PLAYLIST = MUSIC_TRACKS.map((t) => t.id);

export const MUSIC_ATTRIBUTION = {
  artist: "Kevin MacLeod",
  license: "CC BY 4.0",
  licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
  sourceUrl: "https://incompetech.com",
  tracks: MUSIC_TRACKS,
};

export const VIEW_PRESETS = {
  small: { sidebarW: 148, handH: 108, chromeH: 68, footerH: 88, uiScale: 0.92 },
  medium: { sidebarW: 210, handH: 155, chromeH: 96, footerH: 108, uiScale: 1 },
  large: { sidebarW: 280, handH: 210, chromeH: 128, footerH: 132, uiScale: 1.12 },
};

const DEFAULT_SETTINGS = {
  musicMode: "radio",
  trackId: "dreams-become-real",
  musicVolume: 0.4,
  sfxVolume: 0.5,
  musicMuted: false,
  sfxMuted: false,
  musicPan: 0,
  sfxPan: 0,
  viewMode: "medium",
  guideOpen: false,
  panels: {
    sidebarW: null,
    handH: null,
    chromeH: null,
    footerH: null,
  },
};

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS, panels: { ...DEFAULT_SETTINGS.panels } };
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      panels: { ...DEFAULT_SETTINGS.panels, ...(parsed.panels || {}) },
    };
  } catch {
    return { ...DEFAULT_SETTINGS, panels: { ...DEFAULT_SETTINGS.panels } };
  }
}

export function saveSettings(partial) {
  const current = loadSettings();
  const next = {
    ...current,
    ...partial,
    panels: { ...current.panels, ...(partial.panels || {}) },
  };
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}

export function musicCreditHtml() {
  const { artist, license, licenseUrl, sourceUrl, tracks } = MUSIC_ATTRIBUTION;
  const host = sourceUrl.replace(/^https?:\/\//, "");
  const list = tracks
    .map((t) => `<a href="${sourceUrl}" rel="noopener noreferrer">"${t.title}"</a>`)
    .join(", ");
  return `<p class="music-credit">Music: ${list} by ${artist} (${host}), licensed under <a href="${licenseUrl}" rel="noopener noreferrer">${license}</a>.</p>`;
}
