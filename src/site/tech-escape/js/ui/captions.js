/**
 * Captions for a horror game, where sound is not decoration - it is the warning.
 *
 * A deaf or hard-of-hearing player without captions here is not missing flavour,
 * they are missing the only telegraph the game gives before something reaches
 * them. So captions are ON by default, and there are two switches rather than
 * one: Subtitles for anything spoken, Sound Captions for effects. A player who
 * can hear speech fine but misses quiet directional cues on laptop speakers - in
 * a noisy classroom, which is every classroom - wants the second without the
 * first.
 *
 * Format is `[arrow] Source (proximity)`, e.g. `<- Footsteps (close)`.
 *
 *  - The arrow is one of eight compass directions relative to where the player is
 *    facing, so it says where to look, not merely that something happened.
 *  - Proximity is carried by the WORD and by the size of the glyph, never by
 *    colour. Colour-coded urgency is invisible to exactly the players who most
 *    need urgency.
 *  - Enemy sounds use the same triangle glyph as the enemy marker in the world, so
 *    the caption and the thing it describes are recognisably the same object.
 *  - Mixed case, max 40 characters per line, at most two lines, on a solid
 *    background. Small-caps and transparency both cost reading speed at the exact
 *    moment the player has none to spare.
 */

import { settings } from '../meta/settings.js';

/** Eight-way, because four is not enough to tell "beside me" from "behind me". */
const ARROWS = ['\u2191', '\u2197', '\u2192', '\u2198', '\u2193', '\u2199', '\u2190', '\u2196'];

const PROXIMITY = [
  { max: 4, tag: 'right here', size: 1.5 },
  { max: 9, tag: 'close', size: 1.25 },
  { max: 17, tag: 'nearby', size: 1.1 },
  { max: Infinity, tag: 'far', size: 1 },
];

const MAX_LINES = 2;
const MAX_CHARS = 40;
/** Same effect within this window just refreshes rather than stacking up. */
const DEDUPE_MS = 900;

class Captions {
  constructor() {
    this.el = null;
    this.items = [];
    this._lastSeen = new Map();
  }

  init() {
    this.el = document.getElementById('caption-stack');
  }

  /**
   * @param {string} source what made the noise, in plain words
   * @param {object} [opts]
   * @param {number} [opts.dist] world distance from the player
   * @param {number} [opts.angle] radians: sound bearing relative to player facing
   * @param {'effect'|'speech'} [opts.kind]
   * @param {'enemy'|'virus'|'item'|'system'} [opts.type]
   * @param {number} [opts.hold] seconds on screen
   */
  say(source, opts = {}) {
    if (!this.el) return;
    const kind = opts.kind || 'effect';
    if (kind === 'speech' && !settings.get('subtitles')) return;
    if (kind === 'effect' && !settings.get('soundCaptions')) return;

    const now = performance.now();
    const key = `${source}|${opts.type || ''}`;
    const last = this._lastSeen.get(key);
    if (last && now - last < DEDUPE_MS) {
      // Refresh the existing line instead of printing the same footstep twice
      const existing = this.items.find((i) => i.key === key);
      if (existing) {
        existing.life = opts.hold ?? 2.6;
        this._update(existing, source, opts);
        this._paint();
        return;
      }
    }
    this._lastSeen.set(key, now);

    const item = { key, life: opts.hold ?? 2.6, el: document.createElement('div') };
    item.el.className = 'caption';
    this._update(item, source, opts);

    this.items.push(item);
    this.el.appendChild(item.el);
    // Two lines maximum: a third would push the first off before it was read
    while (this.items.length > MAX_LINES) this._drop(this.items[0]);
    this._paint();
  }

  _update(item, source, opts) {
    const dist = opts.dist ?? 0;
    const prox = PROXIMITY.find((p) => dist <= p.max);
    const arrow = opts.angle === undefined ? '' : this._arrow(opts.angle);
    const glyph = opts.type === 'enemy' ? '\u25B2'
      : opts.type === 'virus' ? '\u2B21'
        : opts.type === 'item' ? '\u25C6' : '';

    const text = `${source} (${prox.tag})`.slice(0, MAX_CHARS);
    item.el.dataset.kind = opts.kind || 'effect';
    item.el.innerHTML = '';

    const icon = document.createElement('span');
    icon.className = 'caption-icon';
    // Size, not colour, carries urgency
    icon.style.fontSize = `${prox.size}em`;
    icon.textContent = `${arrow}${glyph}`;
    icon.setAttribute('aria-hidden', 'true');

    const label = document.createElement('span');
    label.className = 'caption-text';
    label.textContent = text;

    item.el.append(icon, label);
  }

  /**
   * Bearing to an eight-way arrow. The angle is already relative to the player's
   * facing, so "up" always means "in front of you" rather than "north".
   */
  _arrow(angle) {
    let a = angle;
    while (a < 0) a += Math.PI * 2;
    while (a >= Math.PI * 2) a -= Math.PI * 2;
    const i = Math.round(a / (Math.PI / 4)) % 8;
    return ARROWS[i];
  }

  /**
   * Convenience for world sounds: works out the bearing and distance from the
   * player so callers do not each reimplement the trigonometry.
   */
  fromWorld(source, worldPos, player, opts = {}) {
    const dx = worldPos.x - player.pos.x;
    const dz = worldPos.z - player.pos.z;
    const dist = Math.hypot(dx, dz);
    // Player yaw 0 looks down -Z, so rotate the bearing into screen space
    const bearing = Math.atan2(dx, -dz) - player.yaw;
    this.say(source, { ...opts, dist, angle: bearing });
  }

  update(dt) {
    if (!this.items.length) return;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      item.life -= dt;
      if (item.life <= 0) this._drop(item);
    }
  }

  _drop(item) {
    const i = this.items.indexOf(item);
    if (i >= 0) this.items.splice(i, 1);
    item.el.remove();
  }

  clear() {
    for (const item of [...this.items]) this._drop(item);
    this._lastSeen.clear();
  }

  _paint() {
    if (this.el) this.el.classList.toggle('hidden', this.items.length === 0);
  }
}

export const captions = new Captions();
