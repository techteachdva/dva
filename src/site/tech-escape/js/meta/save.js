/**
 * Player profiles and everything that survives death.
 *
 * This is deliberately NOT authentication. There is no password, no email, no
 * server, and nothing leaves the machine: a "login" is a name typed on a shared
 * Chromebook that selects which slot in localStorage to write. Several named
 * profiles can live on one device so a class can share a cart, and GUEST plays
 * with no save at all.
 *
 * Storage is treated as a privilege, not a guarantee. School policy can disable
 * it, a shared device can fill it up, and private windows throw on write. Every
 * path here degrades to an in-memory profile that works for the current session
 * instead of failing the run.
 */

// Namespace import on purpose. The question bank is owned by another author and
// is still growing: a named import of an export it does not have yet is a fatal
// module error, while a missing property on a namespace is just undefined.
import * as bank from '../data/questions.js';
import * as selBank from '../data/twoTruths.js';
import { LEVEL_COUNT } from './levels.js';

const TERMINALS = Array.isArray(bank.TERMINALS) ? bank.TERMINALS : [];

const INDEX_KEY = 'techescape.players.v1';
const PLAYER_KEY = (id) => `techescape.player.${id}.v1`;
const LAST_KEY = 'techescape.lastPlayer.v1';

const NAME_MAX = 16;
const PROFILE_MAX = 12;          // a cart-sized class, then oldest must be freed
const RECENT_WINDOW = 24;        // question ids held back from the next draws

/**
 * How the Study Guide earns its answers.
 *
 * An entry joins the guide the moment it is answered. Answer it correctly the
 * first time and there is nothing to withhold, so it is filed as MASTERED with
 * the answer showing. Miss it and the card is LOCKED: it shows the prompt, the
 * ITEM standard code, every option, and the one you chose - but not which option
 * was right, and not the explanation.
 *
 * The only key to a locked card is answering that same prompt correctly on a
 * later run. Nothing else opens it: not time, not repetition, not encountering
 * it again. That is what makes the guide a reason to play again instead of an
 * answer key, and it means the collection is a record of things the player
 * genuinely learned rather than things they were shown.
 */
export const REVEAL_RULE = 'answer-it-right';

/* ------------------------------------------------------------------ storage */

function probeStorage() {
  try {
    const k = '__te_probe__';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return true;
  } catch (e) {
    return false;
  }
}

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const v = JSON.parse(raw);
    return v && typeof v === 'object' ? v : fallback;
  } catch (e) {
    // Corrupt or truncated entry: treat it as absent rather than crashing boot
    return fallback;
  }
}

/* --------------------------------------------------------------------- names */

/**
 * Classroom-safe name cleanup. Middle schoolers will try to type an email or a
 * phone number into any box that accepts text, so anything that looks like
 * personal data is refused with an explanation rather than silently stripped.
 */
export function cleanName(raw) {
  const s = String(raw ?? '').replace(/[\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim();
  if (!s) return { ok: false, reason: 'empty', message: 'Type a name first.' };
  if (s.includes('@') || /\d{7,}/.test(s)) {
    return {
      ok: false,
      reason: 'personal',
      message: 'Use a first name or a nickname - no emails or phone numbers.',
    };
  }
  if (!/^[\p{L}\p{N} '._-]+$/u.test(s)) {
    return { ok: false, reason: 'chars', message: 'Letters, numbers, spaces and - _ . only.' };
  }
  return { ok: true, name: s.slice(0, NAME_MAX) };
}

const idFromName = (name) => (
  `p${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`
  + `_${name.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 8)}`
);

/* ------------------------------------------------------------------ progress */

function blankData(id, name) {
  return {
    v: 1,
    id,
    name,
    createdAt: Date.now(),
    lastPlayed: Date.now(),
    // Lifetime counters. These are the "you gained something" numbers on the
    // death screen, so they only ever go up.
    runs: 0,
    escapes: 0,
    answered: 0,
    correct: 0,
    micePopped: 0,
    virusesKilled: 0,
    cheetosEaten: 0,
    sodasDrunk: 0,
    piecesEarned: 0,
    playSeconds: 0,
    levelsUnlocked: 1,
    deepestLevel: 0,
    bestTime: null,
    bestPieces: 0,
    levelBest: {},     // levelId -> { time, difficulty }
    guide: {},         // question id -> entry
    recent: [],        // recently served ids, newest last
  };
}

/**
 * One player's saved progress, plus the deltas for the run in progress so the
 * death screen can always report what this attempt earned.
 */
export class Progress {
  constructor(data, store) {
    this.data = data;
    this.store = store;
    this.run = null;
  }

  get id() { return this.data.id; }
  get name() { return this.data.name; }
  get isGuest() { return !!this.data.guest; }

  // ------------------------------------------------------------- study guide

  get collected() { return Object.keys(this.data.guide).length; }

  get mastered() {
    return Object.values(this.data.guide).filter((e) => e.r > 0).length;
  }

  get locked() {
    return Object.values(this.data.guide).filter((e) => !e.v).length;
  }

  get bankSize() {
    // The bank grows; never report more collected than exists
    return Math.max(bank.QUESTION_COUNT || 0, this.collected);
  }

  entry(id) { return this.data.guide[id] || null; }

  /**
   * Ids to keep out of the next draw: everything already mastered, plus a
   * rolling window of whatever was served recently. Locked questions age out of
   * the window on purpose - a question you got wrong has to come back around
   * for you to ever unlock its answer.
   */
  excludeIds() {
    const out = new Set(this.data.recent);
    for (const [id, e] of Object.entries(this.data.guide)) {
      if (e.r > 0 && e.v) out.add(id);
    }
    return out;
  }

  /** Called as questions are handed to a terminal, before they are answered. */
  noteServed(ids) {
    const list = this.data.recent;
    for (const id of ids) {
      if (!id) continue;
      const at = list.indexOf(id);
      if (at >= 0) list.splice(at, 1);
      list.push(id);
    }
    if (list.length > RECENT_WINDOW) list.splice(0, list.length - RECENT_WINDOW);
  }

  /**
   * Files an answered question in the guide.
   *
   * @param {object} q the drawn question ({ id, text, std, options, ... })
   * @param {boolean} right
   * @param {string[]} pickedTexts what the player actually chose
   * @param {number} terminalIndex
   * @returns {{collected:boolean, revealed:boolean, mastered:boolean}}
   */
  recordAnswer(q, right, pickedTexts, terminalIndex) {
    const id = q?.id;
    // A bank without stable ids still plays; it just cannot build a guide
    if (!id) return { collected: false, revealed: false, mastered: false };

    const guide = this.data.guide;
    const fresh = !guide[id];
    const e = guide[id] || {
      t: q.text || q.preview || '',
      s: q.std || q.standard || q.topic || '',
      k: terminalIndex ?? 0,
      n: 0,
      w: 0,
      r: 0,
      v: 0,
      p: '',
    };

    e.n++;
    if (right) e.r++;
    else {
      e.w++;
      // Keep the most recent wrong choice: that is what the card shows back
      e.p = (pickedTexts || []).join(' + ').slice(0, 180);
    }

    // Answering it right is the one and only key to the answer
    const wasRevealed = !!e.v;
    if (right) e.v = 1;

    guide[id] = e;

    this.data.answered++;
    if (right) this.data.correct++;
    if (this.run) {
      if (fresh) this.run.collected++;
      if (right && e.r === 1) this.run.mastered++;
      if (!wasRevealed && e.v) this.run.revealed++;
    }

    return {
      collected: fresh,
      revealed: !wasRevealed && !!e.v,
      mastered: right && e.r === 1,
    };
  }

  /**
   * Guide contents grouped by terminal topic, newest-locked first so the things
   * a student still owes themselves are at the top of each section.
   */
  guideByTopic() {
    const groups = TERMINALS.map((t, i) => ({
      index: i,
      name: t.name,
      topic: t.topic,
      blurb: t.blurb,
      items: [],
    }));
    const selGroup = {
      index: 'sel',
      name: selBank.SEL_TOPIC?.name || 'TEXTS & TRUTHS',
      topic: selBank.SEL_TOPIC?.topic || 'SEL & Digital Citizenship',
      blurb: selBank.SEL_TOPIC?.blurb || '',
      items: [],
    };
    const spare = { index: -1, name: 'OTHER', topic: 'Unfiled', blurb: '', items: [] };

    for (const [id, e] of Object.entries(this.data.guide)) {
      const live = safeQuestion(id);
      const twoTruths = !!live?.twoTruths;
      const item = {
        id,
        text: live?.q || e.t || id,
        // ITEM standard code, e.g. 8.3.3.1
        std: live?.std || e.s || '',
        standard: live?.standard || '',
        why: live?.why || '',
        twoTruths,
        options: live ? live.a.map((text, i) => ({
          text,
          correct: twoTruths ? i === live.correct[0] : live.correct.includes(i),
        })) : null,
        picked: e.p || '',
        seen: e.n,
        wrong: e.w,
        right: e.r,
        revealed: !!e.v,
        mastered: e.r > 0,
      };
      const g = e.k === 'sel' ? selGroup : groups[e.k] || spare;
      g.items.push(item);
    }

    if (selGroup.items.length) groups.push(selGroup);
    if (spare.items.length) groups.push(spare);
    for (const g of groups) {
      g.items.sort((a, b) => (
        (a.revealed ? 1 : 0) - (b.revealed ? 1 : 0)
        || a.text.localeCompare(b.text)
      ));
    }
    return groups;
  }

  // -------------------------------------------------------------- run cycle

  beginRun(levelIndex, difficulty) {
    this.data.runs++;
    this.run = {
      levelIndex,
      difficulty,
      collected: 0,
      mastered: 0,
      revealed: 0,
      micePopped: 0,
      virusesKilled: 0,
      startedAt: Date.now(),
    };
    this.data.lastPlayed = Date.now();
    this.save();
  }

  /** @param {{escaped:boolean, seconds:number, pieces:number, stats:object}} result */
  finishRun(result) {
    const d = this.data;
    const lvl = this.run?.levelIndex ?? 0;

    d.playSeconds += Math.max(0, Math.round(result.seconds || 0));
    d.piecesEarned += result.pieces || 0;
    d.micePopped += this.run?.micePopped || 0;
    d.virusesKilled += this.run?.virusesKilled || 0;
    d.cheetosEaten += result.stats?.cheetosEaten || 0;
    d.sodasDrunk += result.stats?.sodasDrunk || 0;
    d.bestPieces = Math.max(d.bestPieces, result.pieces || 0);
    d.deepestLevel = Math.max(d.deepestLevel, lvl);

    const unlocked = [];
    if (result.escaped) {
      d.escapes++;
      const t = Math.round(result.seconds || 0);
      if (t > 0 && (d.bestTime === null || t < d.bestTime)) d.bestTime = t;

      const key = result.levelId || `l${lvl}`;
      const prev = d.levelBest[key];
      if (!prev || t < prev.time) {
        d.levelBest[key] = { time: t, difficulty: result.difficulty || '' };
      }
      // Escaping opens the next room
      if (lvl + 1 < LEVEL_COUNT && d.levelsUnlocked < lvl + 2) {
        d.levelsUnlocked = lvl + 2;
        unlocked.push(lvl + 1);
      }
    }

    const delta = {
      ...(this.run || { collected: 0, mastered: 0, revealed: 0, micePopped: 0, virusesKilled: 0 }),
      unlocked,
    };
    this.run = null;
    this.save();
    return delta;
  }

  notePop() { if (this.run) this.run.micePopped++; }
  noteVirusKill() { if (this.run) this.run.virusesKilled++; }

  get accuracy() {
    return this.data.answered ? this.data.correct / this.data.answered : 0;
  }

  levelUnlocked(index) {
    return index === 0 || index < (this.data.levelsUnlocked || 1);
  }

  save() { this.store?.write(this); }
}

/**
 * The authored question behind an id, or null. Falls back to the snapshot stored
 * in the guide entry when the bank cannot look it up, so a guide built against
 * an older bank still reads.
 */
function safeQuestion(id) {
  try {
    if (String(id).startsWith('SEL-') && typeof selBank.getTwoTruthById === 'function') {
      const t = selBank.getTwoTruthById(id);
      if (!t || !Array.isArray(t.statements)) return null;
      return {
        q: `${t.preview} Which one is the lie?`,
        std: t.topic,
        why: t.why,
        a: t.statements,
        correct: [t.lieIndex],
        twoTruths: true,
      };
    }
    if (typeof bank.getQuestionById !== 'function') return null;
    const q = bank.getQuestionById(id);
    return q && Array.isArray(q.a) && Array.isArray(q.correct) ? q : null;
  } catch (e) {
    return null;
  }
}

/* ----------------------------------------------------------------- the store */

class SaveStore {
  constructor() {
    this.available = false;
    this.degraded = false;      // storage exists but a write has failed
    this.index = [];            // [{ id, name, lastPlayed }]
    this.active = null;
  }

  init() {
    this.available = probeStorage();
    const idx = this.available ? readJson(INDEX_KEY, null) : null;
    this.index = Array.isArray(idx?.players) ? idx.players.filter((p) => p && p.id && p.name) : [];
    this.index.sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0));
    return this;
  }

  get lastPlayerId() {
    if (!this.available) return null;
    try {
      return localStorage.getItem(LAST_KEY);
    } catch (e) {
      return null;
    }
  }

  /** Summary rows for the profile picker, cheap enough to build on demand. */
  listProfiles() {
    return this.index.map((p) => {
      const data = readJson(PLAYER_KEY(p.id), null);
      return {
        id: p.id,
        name: p.name,
        lastPlayed: p.lastPlayed || 0,
        collected: data ? Object.keys(data.guide || {}).length : 0,
        levelsUnlocked: data?.levelsUnlocked || 1,
        escapes: data?.escapes || 0,
        runs: data?.runs || 0,
      };
    });
  }

  findByName(name) {
    const want = name.toLowerCase();
    return this.index.find((p) => p.name.toLowerCase() === want) || null;
  }

  /**
   * @returns {{ok:true, progress:Progress}
   *   | {ok:false, reason:string, message:string, existingId?:string}}
   */
  createProfile(rawName, { allowDuplicate = false } = {}) {
    const clean = cleanName(rawName);
    if (!clean.ok) return { ok: false, reason: clean.reason, message: clean.message };

    let name = clean.name;
    const existing = this.findByName(name);
    if (existing && !allowDuplicate) {
      return {
        ok: false,
        reason: 'exists',
        message: `${name} already has a save on this device.`,
        existingId: existing.id,
      };
    }
    if (existing) {
      // Same name on purpose (two students called Sam): number the newcomer
      let n = 2;
      while (this.findByName(`${name} ${n}`)) n++;
      name = `${name} ${n}`.slice(0, NAME_MAX + 3);
    }

    if (this.index.length >= PROFILE_MAX) {
      return {
        ok: false,
        reason: 'full',
        message: `This device is holding ${PROFILE_MAX} saves. Remove one first.`,
      };
    }

    const id = idFromName(name);
    const progress = new Progress(blankData(id, name), this);
    this.index.unshift({ id, name, lastPlayed: Date.now() });
    this.active = progress;
    this._writeIndex();
    this.write(progress);
    this._rememberLast(id);
    return { ok: true, progress };
  }

  selectProfile(id) {
    const row = this.index.find((p) => p.id === id);
    if (!row) return null;
    const data = readJson(PLAYER_KEY(id), null);
    const merged = { ...blankData(id, row.name), ...(data || null) };
    // Trust the index for the display name, and repair anything a partial write
    // or an older build left missing
    merged.id = id;
    merged.name = row.name;
    merged.guide = merged.guide && typeof merged.guide === 'object' ? merged.guide : {};
    merged.recent = Array.isArray(merged.recent) ? merged.recent : [];
    merged.levelBest = merged.levelBest && typeof merged.levelBest === 'object' ? merged.levelBest : {};
    merged.levelsUnlocked = Math.max(1, Math.min(LEVEL_COUNT, merged.levelsUnlocked || 1));

    row.lastPlayed = Date.now();
    this.active = new Progress(merged, this);
    this._writeIndex();
    this._rememberLast(id);
    return this.active;
  }

  /** A throwaway profile that is never written to disk. */
  useGuest() {
    const data = blankData('guest', 'GUEST');
    data.guest = true;
    this.active = new Progress(data, this);
    this._rememberLast('guest');
    return this.active;
  }

  deleteProfile(id) {
    this.index = this.index.filter((p) => p.id !== id);
    try {
      localStorage.removeItem(PLAYER_KEY(id));
    } catch (e) { /* nothing to remove, or storage is gone */ }
    this._writeIndex();
    if (this.active?.id === id) this.active = null;
  }

  write(progress) {
    if (!progress || progress.isGuest || !this.available) return false;
    const row = this.index.find((p) => p.id === progress.id);
    if (row) row.lastPlayed = progress.data.lastPlayed || Date.now();
    try {
      localStorage.setItem(PLAYER_KEY(progress.id), JSON.stringify(progress.data));
      this._writeIndex();
      return true;
    } catch (e) {
      // Almost always a full quota. Drop the cheapest thing we hold and retry
      // once; the guide itself is far too valuable to prune.
      progress.data.recent = [];
      try {
        localStorage.setItem(PLAYER_KEY(progress.id), JSON.stringify(progress.data));
        return true;
      } catch (e2) {
        this.degraded = true;
        return false;
      }
    }
  }

  _writeIndex() {
    if (!this.available) return;
    try {
      localStorage.setItem(INDEX_KEY, JSON.stringify({ v: 1, players: this.index }));
    } catch (e) {
      this.degraded = true;
    }
  }

  _rememberLast(id) {
    if (!this.available) return;
    try {
      localStorage.setItem(LAST_KEY, id);
    } catch (e) { /* non-fatal: we just will not preselect next time */ }
  }
}

export const saveStore = new SaveStore();
