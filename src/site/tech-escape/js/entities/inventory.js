/**
 * The player's bag.
 *
 * Loot used to be consumed the instant you walked over it. Now it is carried, so
 * every pickup becomes a question: is this bag of cheetos health, or is it a
 * bomb for the mouse that has been following me for two corridors?
 *
 * Pure data - no meshes, no DOM. `main.js` maps keys onto it and `ui.js` draws
 * it, which keeps the decision logic testable without a browser.
 */

import { INVENTORY } from '../config.js';

/**
 * Presentation metadata lives with the item, not in the HUD markup, so adding an
 * item is one entry here. `shape` is the colourblind redundancy: the HUD draws a
 * distinct outline per item so the slots never rely on colour alone.
 */
export const ITEMS = {
  cheetos: {
    label: 'HOT CHEETOS',
    short: 'CHEETOS',
    shape: 'bag',
    useVerb: 'EAT',
    useHint: 'restores 1 snack energy',
    throwHint: 'mice eat, then pop — up to 3 per bag',
    throwable: true,
    usable: true,
  },
  soda: {
    label: 'SODA CAN',
    short: 'SODA',
    shape: 'can',
    useVerb: 'DRINK',
    useHint: 'refills stamina and boosts running',
    throwHint: null,
    throwable: false,
    usable: true,
  },
  antivirus: {
    label: 'ANTI-VIRUS DISC',
    short: 'ANTI-VIRUS',
    shape: 'disc',
    useVerb: null,
    useHint: 'cannot be used by hand',
    throwHint: 'destroys a virus permanently',
    throwable: true,
    usable: false,
  },
};

export class Inventory {
  constructor() {
    this.counts = Object.create(null);
    for (const kind of INVENTORY.order) this.counts[kind] = 0;
    this.selected = INVENTORY.order[0];
    // Bumped whenever the HUD needs a redraw, so the loop can skip DOM work
    this.revision = 0;
  }

  get order() { return INVENTORY.order; }

  max(kind) { return INVENTORY.max[kind] ?? 0; }

  count(kind) { return this.counts[kind] || 0; }

  has(kind) { return this.count(kind) > 0; }

  isFull(kind) { return this.count(kind) >= this.max(kind); }

  get total() {
    return this.order.reduce((n, k) => n + this.count(k), 0);
  }

  /** @returns {boolean} false when the bag is already full of this item. */
  add(kind, n = 1) {
    if (!(kind in this.counts)) return false;
    if (this.isFull(kind)) return false;
    this.counts[kind] = Math.min(this.max(kind), this.count(kind) + n);
    // Picking up something new selects it, which is what a player expects after
    // walking over the only anti-virus disc on the level
    if (this.count(this.selected) === 0) this.selected = kind;
    this.revision++;
    return true;
  }

  /** @returns {boolean} false when there was nothing to spend. */
  remove(kind, n = 1) {
    if (!this.has(kind)) return false;
    this.counts[kind] = Math.max(0, this.count(kind) - n);
    this.revision++;
    return true;
  }

  select(kind) {
    if (!(kind in this.counts) || this.selected === kind) return false;
    this.selected = kind;
    this.revision++;
    return true;
  }

  /**
   * Steps to the next slot the player actually owns. Falls back to stepping
   * through empty slots so the control still responds with an empty bag.
   */
  cycle(dir = 1) {
    const order = this.order;
    const from = Math.max(0, order.indexOf(this.selected));
    for (let step = 1; step <= order.length; step++) {
      const kind = order[(from + dir * step + order.length * step) % order.length];
      if (this.has(kind)) return this.select(kind);
    }
    return this.select(order[(from + 1) % order.length]);
  }

  info(kind = this.selected) { return ITEMS[kind] || null; }

  /** HUD rows. */
  slots() {
    return this.order.map((kind) => ({
      kind,
      count: this.count(kind),
      max: this.max(kind),
      selected: kind === this.selected,
      ...ITEMS[kind],
    }));
  }
}
