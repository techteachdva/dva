/**
 * Every accessibility and comfort setting, plus the engine's flash limiter.
 *
 * Two principles run through this file.
 *
 * The first is that the safe configuration is the DEFAULT. A teacher deploying
 * this to thirty Chromebooks cannot walk round and configure each one, so nothing
 * important is hidden behind a toggle the student has to find. Captions are on.
 * Sensitivity starts low. If the operating system reports a motion preference, it
 * is honoured before the first frame is drawn. Students who want more intensity
 * can turn it up; nobody has to turn anything down to be safe.
 *
 * The second is that motion sensitivity and photosensitivity are DIFFERENT
 * CONDITIONS and get separate switches. Vestibular symptoms come from camera
 * movement the body did not ask for; seizure risk comes from luminance changing
 * fast across a large area. Lumping them into one "accessibility mode" forces a
 * student who only needs one to give up effects they were enjoying.
 */

import { FLASH_SAFETY } from '../config.js';
import { BIND_DEFAULTS, normalizeBinds } from './binds.js';

const KEY = 'techEscape.settings.v1';

export const DEFAULTS = {
  // --- the two that matter most, both on the first-run screen -------------
  reduceMotion: false,
  reduceFlashing: false,

  // --- captions: on by default, because sound IS the danger signal -------
  subtitles: true,
  soundCaptions: true,
  captionScale: 1,          // 1..2, multiplies the 22px base
  captionOpacity: 0.75,

  // --- looking around ----------------------------------------------------
  // 0.8x default: a trackpad reports movementX/Y on a completely different scale
  // to a mouse, and starting fast is how a new player ends up spinning on the
  // spot and deciding the game is broken.
  sensitivity: 0.8,
  sensitivityTrackpad: 0.8,
  sensX: 1,
  sensY: 1,
  invertX: false,
  invertY: false,
  rawInput: false,          // only ever enabled for a real mouse
  cameraMode: 'mouse',      // mouse | clickturn | keyboard
  crosshair: 'dot',         // off | dot | full

  // --- reading -----------------------------------------------------------
  textPreset: 'standard',   // standard | wide | dyslexic
  textScale: 1,
  highContrastHud: false,

  // --- intensity dials, independent of the safety toggles ----------------
  fxGrain: 0.6,
  fxAberration: 0.5,
  fxVignette: 0.7,
  fxStatic: 0.6,

  // --- pacing ------------------------------------------------------------
  tension: 'standard',      // mild | standard
  difficulty: 'normal',
  showLegend: true,
  skipBoot: false,          // remembered once they skip the loading screen
  seenFirstRun: false,
  seenTutorial: false,

  /** Gameplay key codes; remapped from the pause menu. */
  binds: { ...BIND_DEFAULTS },
};

/** Wide spacing is the intervention with actual evidence behind it. */
export const TEXT_PRESETS = {
  standard: { letter: '0.02em', word: '0.16em', line: '1.5' },
  wide: { letter: '0.05em', word: '0.2em', line: '1.7' },
  // Offered because some students ask for it by name, labelled neutrally as a
  // typeface choice. It is deliberately NOT the default and is not described as
  // a reading aid: the two controlled studies on it (Wery & Diliberto 2017,
  // Kuster et al. 2018) found reduced reading rate and no benefit respectively.
  dyslexic: { letter: '0.02em', word: '0.16em', line: '1.6' },
};

class Settings {
  constructor() {
    this.values = { ...DEFAULTS };
    this._listeners = new Set();
    this._mqMotion = null;
    this.inputDevice = 'unknown';   // mouse | trackpad | unknown
  }

  get(k) { return this.values[k]; }

  /** @returns {boolean} true when the value actually changed. */
  set(k, v) {
    if (this.values[k] === v) return false;
    if (k === 'binds') {
      const merged = normalizeBinds(v);
      if (JSON.stringify(merged) === JSON.stringify(this.values.binds)) return false;
      this.values.binds = merged;
    } else {
      this.values[k] = v;
    }
    this.save();
    this.apply();
    for (const fn of this._listeners) fn(k, v);
    return true;
  }

  toggle(k) { return this.set(k, !this.values[k]); }

  onChange(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) Object.assign(this.values, JSON.parse(raw));
    } catch {
      // A locked-down or full profile is not a reason to refuse to boot
    }
    this.values.binds = normalizeBinds(this.values.binds);
    this.adoptSystemPreferences();
    this.apply();
    return this.values;
  }

  save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.values));
    } catch { /* ignore */ }
  }

  /**
   * A student who set "reduce motion" in ChromeOS has already told us what they
   * need; making them say it again in our menu is a failure. The toggle is
   * pre-enabled, still visible, and still theirs to turn off - and we keep
   * listening, because the OS preference can change mid-session.
   */
  adoptSystemPreferences() {
    if (typeof matchMedia !== 'function') return;
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    this._mqMotion = mq;
    if (mq.matches && !this.values.seenFirstRun) {
      this.values.reduceMotion = true;
      // Reduced motion is not a statement about flashing, but a player asking
      // for calm almost never wants a strobe either, so this starts on too and
      // stays independently switchable
      this.values.reduceFlashing = true;
    }
    const onChange = (e) => {
      if (e.matches) {
        this.set('reduceMotion', true);
        this.set('reduceFlashing', true);
      }
    };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange);
  }

  /**
   * Pushes everything CSS cares about onto the root element. Keeping this in one
   * place means a new setting is a data attribute and a rule, never a hunt
   * through the stylesheet.
   */
  apply() {
    const el = document.documentElement;
    if (!el) return;
    const v = this.values;
    el.dataset.reduceMotion = v.reduceMotion ? 'on' : 'off';
    el.dataset.reduceFlashing = v.reduceFlashing ? 'on' : 'off';
    el.dataset.textPreset = v.textPreset;
    el.dataset.contrast = v.highContrastHud ? 'high' : 'normal';
    el.dataset.crosshair = v.crosshair;
    el.dataset.captions = v.soundCaptions || v.subtitles ? 'on' : 'off';

    const preset = TEXT_PRESETS[v.textPreset] || TEXT_PRESETS.standard;
    el.style.setProperty('--text-letter', preset.letter);
    el.style.setProperty('--text-word', preset.word);
    el.style.setProperty('--text-line', preset.line);
    el.style.setProperty('--text-scale', String(v.textScale));
    el.style.setProperty('--caption-scale', String(v.captionScale));
    el.style.setProperty('--caption-bg-alpha', String(v.captionOpacity));
    el.style.setProperty('--fx-grain', String(v.reduceMotion ? 0 : v.fxGrain));
    el.style.setProperty('--fx-vignette', String(v.fxVignette));
  }

  /**
   * Trackpad or mouse? A trackpad reports many small movementX values per
   * gesture; a mouse reports fewer, larger ones. Sampling the first few events
   * and comparing the mean magnitude is crude but reliable enough to pick a
   * sensitivity, and it costs nothing.
   *
   * Raw (unaccelerated) input is only ever requested for a real mouse: on a
   * trackpad it strips the OS acceleration curve the student has spent months
   * learning.
   */
  noteMovement(dx, dy) {
    if (this.inputDevice !== 'unknown') return;
    this._samples = this._samples || [];
    this._samples.push(Math.abs(dx) + Math.abs(dy));
    if (this._samples.length < 12) return;
    const mean = this._samples.reduce((a, b) => a + b, 0) / this._samples.length;
    this.inputDevice = mean > 9 ? 'mouse' : 'trackpad';
    this._samples = null;
  }

  /** The sensitivity in force right now, given what we think they are holding. */
  get activeSensitivity() {
    return this.inputDevice === 'mouse'
      ? this.values.sensitivity
      : this.values.sensitivityTrackpad;
  }

  reset() {
    this.values = { ...DEFAULTS };
    this.adoptSystemPreferences();
    this.save();
    this.apply();
  }
}

export const settings = new Settings();

/**
 * Rate limiter for anything that changes the brightness of a large area.
 *
 * Effects ask permission instead of firing directly, so the 3-per-second ceiling
 * holds no matter how many systems want to flash at once - which is exactly the
 * case that would otherwise slip through: a hit, an alarm, and a glitch landing
 * in the same 100ms are individually fine and collectively a strobe.
 *
 * Denied flashes are not queued. A flash that arrives late is worse than one that
 * never arrives, because it has lost the event it was describing.
 */
export class FlashGuard {
  constructor() {
    this._times = [];
  }

  /**
   * @param {number} [nowMs]
   * @returns {boolean} true when the caller may flash
   */
  request(nowMs = performance.now()) {
    // Drop anything older than a second: the cap is per rolling second
    while (this._times.length && nowMs - this._times[0] > 1000) this._times.shift();
    if (this._times.length >= FLASH_SAFETY.maxFlashesPerSecond) return false;
    const last = this._times[this._times.length - 1];
    if (last !== undefined && nowMs - last < FLASH_SAFETY.minGapMs) return false;
    this._times.push(nowMs);
    return true;
  }

  reset() { this._times.length = 0; }
}

export const flashGuard = new FlashGuard();
