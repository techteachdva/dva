/**
 * The Morph Compiler panel. One interface, several jobs:
 *   compile  build the word a meaning asks for         (requests, terminals, cores, the finale)
 *   patch    turn the ending ring until the sentence works   (firewall locks)
 *   choice   pick the formal words a slang sentence means   (Lingo translation lock)
 *   unpack   compile the pieces a Lingo word came from, then watch speech reshape them
 *   free     the toy: every learned morpheme on five rings, no goal
 *
 * Feedback rules come from Tech Escape's terminal (van der Kleij et al., 2015): every attempt
 * gets an explanation, including correct ones; retry until right; first try is recorded quietly;
 * a wrong answer blames the machine ("the joint won't hold"), never the student.
 */

import { el, $, shuffle } from '../core/util.js';
import { openPanel, closeButton } from './host.js';
import { createDrum } from '../compiler/drum.js';
import { build, glossLine } from '../compiler/wordsum.js';
import { loopJoint } from '../compiler/joint.js';
import { morph, MORPHEMES, TYPE_LABEL } from '../data/morphemes.js';
import { DICTIONARY } from '../data/world.js';
import { R, onUpdate, pickFocus } from '../engine/renderer.js';
import { sfx, speak, sayMorph } from '../core/audio.js';
import { settings } from '../core/settings.js';
import { touch } from '../core/mastery.js';
import { logAttempt, logError } from '../core/session.js';
import { addLexicon, addMadeUp, save } from '../core/save.js';

const OPEN_LOCKOUT_MS = 350;

function distractors(targetId, pool, count) {
  const t = morph(targetId);
  const ok = (id) => id !== targetId && MORPHEMES[id] && morph(id).type === t.type && morph(id).text !== t.text;
  let c = shuffle([...new Set(pool)].filter(ok));
  const same = c.filter((id) => morph(id).origin === t.origin);
  const other = c.filter((id) => morph(id).origin !== t.origin);
  c = [...same, ...other];
  // One sibling spelling of the same meaning (tain for ten, duc for duct) makes the student read the word, not just the meaning.
  const sib = shuffle(Object.keys(MORPHEMES).filter((id) => ok(id) && morph(id).meaning === t.meaning && morph(id).origin === t.origin));
  if (sib.length) c = [sib[0], ...c.filter((id) => id !== sib[0])];
  if (c.length < count) {
    const extra = shuffle(Object.keys(MORPHEMES).filter((id) => ok(id) && morph(id).origin === t.origin && !c.includes(id)));
    c = [...c, ...extra];
  }
  return c.slice(0, count);
}

function columnsFor(task, mode, pool) {
  if (mode === 'choice') {
    const options = task.choices.map((text) => ({ text, type: 'word', origin: 'lingo' }));
    return [{ options, index: (task.a + 1 + Math.floor(Math.random() * (options.length - 1))) % options.length, answer: task.a }];
  }
  if (mode === 'patch') {
    const cols = task.fixed.map((id) => ({ options: [{ id }], index: 0 }));
    const options = task.ring.map((chain) => (chain.length ? { text: chain.map((id) => morph(id).text).join('·'), type: 'sfx', origin: morph(chain[0]).origin, chain } : { blank: true, type: 'sfx', chain: [] }));
    let index = Math.floor(Math.random() * options.length);
    if (index === task.a) index = (index + 1) % options.length;
    cols.push({ options, index, answer: task.a, type: 'sfx' });
    return cols;
  }
  // compile / unpack / finale: one ring per piece of the target.
  return task.p.map((id) => {
    const m = morph(id);
    if (m.type === 'link') return { options: [{ id }], index: 0 };
    const opts = shuffle([id, ...distractors(id, pool, m.type === 'word' ? 3 : 4)]).map((x) => ({ id: x }));
    let index = Math.floor(Math.random() * opts.length);
    if (opts[index].id === id) index = (index + 1) % opts.length;
    return { options: opts, index, answer: opts.findIndex((o) => o.id === id) };
  });
}

function freeColumns(learned) {
  const by = (type) => learned.filter((id) => morph(id).type === type && morph(id).origin !== 'lingo');
  const blank = (type) => ({ blank: true, type });
  const bases = by('base');
  const cols = [
    { options: [blank('pfx'), ...by('pfx').map((id) => ({ id }))], index: 0, type: 'pfx' },
    { options: bases.map((id) => ({ id })), index: 0, type: 'base' },
    { options: [blank('base'), ...by('link').map((id) => ({ id })), ...bases.map((id) => ({ id }))], index: 0, type: 'base' },
    { options: [blank('sfx'), ...by('sfx').map((id) => ({ id }))], index: 0, type: 'sfx' },
    { options: [blank('sfx'), ...by('sfx').map((id) => ({ id }))], index: 0, type: 'sfx' },
  ];
  return cols.filter((c) => c.options.length > 0);
}

const MODE_LABEL = {
  compile: 'REQUEST · build the word that means',
  finale: 'FINAL COMPILE · rebuild the word clean',
  patch: 'FIREWALL LOCK · pick the ending that fits',
  choice: 'FIREWALL LOCK · translate the slang',
  unpack: 'UNPACK · compile the pieces it came from',
  free: 'MORPH COMPILER · free build',
};

/**
 * @returns Promise<{ done: number, total: number }>
 */
export function openCompile({ mode = 'compile', tasks = [], profile, pool = [], title = null, onSolved = null, onMadeUp = null }) {
  return new Promise((resolve) => {
    const panel = openPanel({ dim: 0.68, focus: true, className: 'compile-panel' });
    const top = el('section', { class: 'glass panel-top' });
    const ctlLayer = el('div');
    const sumLine = el('div', { class: 'sum-line' });
    let sumLoop = null; // the word-sum teaching loop under the rings
    const showSum = (ids, opts) => { if (sumLoop) sumLoop.stop(); sumLoop = loopJoint(sumLine, ids, opts); };
    const feedback = el('div');
    const compileBtn = el('button', { class: 'btn btn-primary compile-btn', type: 'button' }, 'COMPILE');
    const nextBtn = el('button', { class: 'btn btn-good compile-btn', type: 'button', hidden: true }, 'NEXT ▸');
    const sum = el('section', { class: 'glass sum-bar' }, el('div', {}, sumLine, feedback), el('div', { class: 'sum-actions' }, compileBtn, nextBtn));
    panel.root.append(top, ctlLayer, sum, closeButton(() => finish()));

    let idx = 0;
    let done = 0;
    let drum = null;
    let attempts = 0;
    let solved = false;
    let openedAt = 0;
    let cols = [];
    let unhook = null;
    const learned = [...new Set([...profile.learned, ...pool])];

    const task = () => tasks[idx];
    const isFree = mode === 'free';
    const effMode = () => (mode === 'patch' && task() && task().choices ? 'choice' : mode);

    function selectedIds() {
      const sel = drum.selection();
      if (effMode() === 'patch') {
        const t = task();
        return [...t.fixed, ...sel[sel.length - 1].chain];
      }
      return sel.filter((o) => o.id).map((o) => o.id);
    }

    function setupTask() {
      solved = false;
      attempts = 0;
      feedback.innerHTML = '';
      nextBtn.hidden = true;
      compileBtn.hidden = false;
      compileBtn.disabled = true;
      openedAt = performance.now();
      setTimeout(() => { compileBtn.disabled = false; }, OPEN_LOCKOUT_MS);
      if (drum) { R.focusScene.remove(drum.root); drum.dispose(); }
      cols = isFree ? freeColumns(learned) : columnsFor(task(), effMode(), learned);
      drum = createDrum(cols);
      drum.onChange = () => { if (isFree) feedback.innerHTML = ''; renderLive(); };
      R.focusScene.add(drum.root);
      buildControls();
      renderTop();
      renderLive();
    }

    function renderTop() {
      top.innerHTML = '';
      const m = effMode();
      top.append(el('div', { class: 'kicker' }, title || MODE_LABEL[m]));
      if (!isFree) top.append(el('div', { class: 'progress' }, `${idx + 1} / ${tasks.length}`));
      const t = task();
      if (m === 'compile' || m === 'finale') top.append(el('div', { class: 'prompt' }, `“${t.m}”`));
      else if (m === 'patch' || m === 'choice') {
        const [a, b] = t.s.split('___');
        top.append(el('div', { class: 'prompt' }, a, el('span', { class: 'blank', id: 'patch-blank' }, '   '), b ?? ''));
      } else if (m === 'unpack') {
        top.append(el('div', { class: 'prompt' }, el('span', { class: 'mtile big', 'data-type': 'word', 'data-origin': 'lingo' }, t.w), '  means  “', t.means, '”'));
        top.append(el('div', { style: { color: 'var(--ink-dim)', marginTop: '0.3rem' } }, `It came from ${t.p.length} piece${t.p.length > 1 ? 's' : ''}. Turn the rings to find them.`));
      } else if (isFree) {
        top.append(el('div', { class: 'prompt', style: { fontSize: '1.05rem' } }, 'Turn any ring. Prefix · base · base · suffix · suffix. Read left to right, and don\'t skip a column. Real words go in your Lexicon; new ones become Made-up Words.'));
      }
      top.append(el('div', { style: { fontSize: '1rem', color: 'var(--ink-dim)', marginTop: '0.4rem' } }, '▲▼ or scroll to turn a ring · ←→ pick a ring · Enter to compile'));
    }

    function buildControls() {
      ctlLayer.innerHTML = '';
      drum.rings.forEach((ring, i) => {
        if (ring.fixed) {
          ring.ctl = null;
          ring.gloss = el('div', { class: 'ring-gloss' });
          ctlLayer.append(ring.gloss);
          return;
        }
        const up = el('button', { class: 'ring-btn', type: 'button', 'aria-label': `Turn ring ${i + 1} up` }, '▲');
        const down = el('button', { class: 'ring-btn', type: 'button', 'aria-label': `Turn ring ${i + 1} down` }, '▼');
        up.addEventListener('click', () => { drum.setFocus(i); drum.turn(i, 1); });
        down.addEventListener('click', () => { drum.setFocus(i); drum.turn(i, -1); });
        ring.up = up;
        ring.down = down;
        ring.gloss = el('div', { class: 'ring-gloss' });
        ctlLayer.append(up, down, ring.gloss);
        [up, down].forEach((b) => { b.style.position = 'absolute'; b.style.transform = 'translate(-50%, -50%)'; });
      });
      position();
    }

    function position() {
      if (!drum) return;
      const slots = drum.screenSlots();
      drum.rings.forEach((ring, i) => {
        const s = slots[i];
        if (ring.up) {
          ring.up.style.left = `${s.x}px`; ring.up.style.top = `${s.top - 6}px`;
          ring.down.style.left = `${s.x}px`; ring.down.style.top = `${s.bottom + 8}px`;
        }
        ring.gloss.style.left = `${s.x}px`;
        ring.gloss.style.top = `${s.bottom + (ring.up ? 44 : 14)}px`;
        ring.gloss.style.maxWidth = `${Math.max(120, s.width + 30)}px`;
      });
    }

    function renderLive() {
      const sel = drum.selection();
      drum.rings.forEach((ring, i) => {
        const o = sel[i];
        ring.gloss.innerHTML = '';
        if (o.blank) { ring.gloss.append(el('b', {}, '—'), 'empty'); return; }
        if (o.chain) {
          ring.gloss.append(el('b', {}, o.text), o.chain.map((id) => morph(id).meaning).join(' + '));
          return;
        }
        if (o.id) {
          const m = morph(o.id);
          ring.gloss.append(el('b', {}, m.text), m.meaning);
          if (settings.cognates && m.es) ring.gloss.append(el('span', { class: 'es' }, `es: ${m.es}`));
        } else ring.gloss.append(el('b', {}, o.text));
      });
      const m = effMode();
      if (sumLoop) { sumLoop.stop(); sumLoop = null; }
      sumLine.innerHTML = '';
      if (m === 'choice') {
        const choice = sel[0].text;
        const blank = $('patch-blank');
        if (blank) blank.textContent = choice;
        sumLine.append('Reads: ', el('span', { class: 'eq' }, task().s.replace('___', choice)));
        return;
      }
      const ids = selectedIds();
      if (!ids.length) { sumLine.append('Pick a base to start.'); return; }
      if (isFree && sel[3] && sel[4] && sel[3].blank && !sel[4].blank) { sumLine.append('No skipping columns: fill the first suffix ring before the second.'); return; }
      try {
        const res = build(ids);
        if (m === 'patch') {
          const blank = $('patch-blank');
          if (blank) blank.textContent = res.word;
        }
        showSum(ids);
      } catch { sumLine.append('…'); }
    }

    function record(ids, ok, word) {
      touch(profile, ids, ok);
      logAttempt(ids, ok, { word: !!word });
      profile.stats.tasks += 1;
      if (ok) profile.stats.firstTry += 1;
      save();
      if (word) addLexicon(profile, word, ids);
    }

    async function compile() {
      if (solved || performance.now() - openedAt < OPEN_LOCKOUT_MS) return;
      const m = effMode();
      const t = task();
      attempts += 1;
      feedback.innerHTML = '';
      const fb = (cls, title, ...rows) => {
        feedback.innerHTML = '';
        feedback.append(el('div', { class: `feedback ${cls}` }, el('span', { class: 'title' }, title), ...rows.filter(Boolean).map((r) => el('span', { class: 'row' }, r))));
      };

      if (m === 'choice') {
        const pickIdx = drum.rings[0].sel;
        if (pickIdx === t.a) return succeed([], null, () => fb('good', 'TRANSLATED ✔', t.why));
        sfx.bad();
        drum.flash(false);
        return fb('bad', 'The lock rejects that translation.', `"${t.choices[pickIdx]}" changes the meaning. ${attempts >= 2 ? t.why : 'Read the slang word again: what does it mean?'}`);
      }

      if (isFree) {
        const sel = drum.selection();
        if (sel[3] && sel[4] && sel[3].blank && !sel[4].blank) { sfx.bad(); return fb('bad', 'Compile error: a column was skipped.', 'Matrix rule: read left to right, one piece per column, no skipping.'); }
        const ids = selectedIds();
        if (!ids.length) return;
        const res = build(ids);
        if (DICTIONARY.has(res.word)) {
          sfx.good();
          drum.flash(true);
          speak(res.word);
          touch(profile, ids, true);
          addLexicon(profile, res.word, ids);
          profile.stats.compiled += 1;
          fb('good', `REAL WORD ✔  ${res.word}`, glossLine(ids));
          showSum(ids, { solved: true });
          onSolved && onSolved(null, { ids, word: res.word, real: true });
        } else {
          sfx.click();
          speak(res.word);
          const saveBtn = el('button', { class: 'btn btn-pink', type: 'button' }, 'Save as a Made-up Word');
          saveBtn.addEventListener('click', () => { addMadeUp(profile, res.word, ids); saveBtn.disabled = true; saveBtn.textContent = 'Saved ✔'; onMadeUp && onMadeUp(res.word); });
          fb('info', `"${res.word}" isn't in the Lexicon yet.`, `Built meaning: ${ids.map((id) => morph(id).meaning).join(' + ')}.`, 'That\'s a legal build. Want to keep it?', saveBtn);
        }
        return;
      }

      if (m === 'patch') {
        const pickIdx = drum.rings[drum.rings.length - 1].sel;
        const ids = selectedIds();
        const word = build(ids).word;
        if (pickIdx === t.a) return succeed(ids, word, () => fb('good', 'LOCK RELEASED ✔', `${word}: ${t.why}`, glossLine(ids)));
        sfx.bad();
        drum.flash(false);
        logError(t.ring[t.a], 'meaning');
        const fit = DICTIONARY.has(word) ? `"${word}" is a real word, but it doesn't fit this sentence.` : `"${word}" isn't a word the lock knows.`;
        return fb('bad', 'The lock rejects that shape.', fit, attempts >= 2 ? `Hint: ${t.why}` : 'Read the whole sentence aloud with your word in the blank.');
      }

      // compile / finale / unpack: compare piece by piece.
      const ids = selectedIds();
      const target = t.p;
      // Sibling spellings can build the same word (pose + ition, pos + ition), and that still counts.
      const same = ids.length === target.length && (ids.every((id, i) => id === target[i]) || (m !== 'unpack' && build(ids).word === build(target).word));
      if (same) {
        if (m === 'unpack') return succeed(ids, null, () => unpackReveal(t));
        const word = build(ids).word;
        return succeed(ids, word, () => fb('good', `COMPILED ✔  ${word}`, glossLine(ids), t.today ? `Today: ${t.today}` : null));
      }
      sfx.bad();
      drum.flash(false);
      const rows = [];
      if (m !== 'unpack') {
        const word = build(ids).word;
        if (DICTIONARY.has(word)) rows.push(`That compiles "${word}", a real word, but not the one requested.`);
        else rows.push(`"${word}" isn't in the Lexicon.`);
      }
      ids.forEach((id, i) => {
        if (id !== target[i]) {
          const have = morph(id);
          const need = morph(target[i]);
          logError([target[i]], have.meaning === need.meaning ? 'family' : 'meaning');
          if (have.meaning === need.meaning) rows.push(`Ring ${i + 1}: ${have.text} has the right meaning, but this word uses a different spelling of it. Read the word you are building.`);
          else rows.push(`Ring ${i + 1}: ${have.text} means "${have.meaning}". This spot needs a ${TYPE_LABEL[need.type]} that means "${attempts >= 2 ? need.meaning : '…'}".`);
        }
      });
      fb('bad', 'Compile error: the joint won\'t hold.', ...rows);
    }

    async function succeed(ids, word, showFeedback) {
      solved = true;
      sfx.good();
      drum.flash(true);
      compileBtn.hidden = true;
      const firstTry = attempts === 1;
      if (ids.length) record(ids, firstTry, word);
      else { profile.stats.tasks += 1; if (firstTry) profile.stats.firstTry += 1; save(); }
      if (word) { profile.stats.compiled += 1; speak(word); }
      showFeedback();
      if (word && ids.length) showSum(ids, { solved: true });
      done += 1;
      onSolved && onSolved(task(), { firstTry, ids, word });
      nextBtn.hidden = false;
      nextBtn.textContent = idx + 1 < tasks.length ? 'NEXT ▸' : 'DONE ✔';
      nextBtn.focus();
    }

    function unpackReveal(t) {
      speak(t.w);
      const chain = el('div', { class: 'chain' });
      t.chain.forEach((c, i) => {
        if (i) chain.append(el('span', { class: 'arrow' }, '→'));
        chain.append(el('span', {}, c));
      });
      const card = el('div', { class: 'feedback good lingo-card' },
        el('span', { class: 'title' }, `UNPACKED ✔  ${t.w}`), chain,
        el('dl', { class: 'lingo-lines' },
          el('dt', {}, 'MEANS'), el('dd', {}, t.means),
          el('dt', {}, 'MORPHEMES'), el('dd', {}, t.p.map((id) => morph(id).text).join(' + ')),
          el('dt', {}, 'HOW IT CHANGED'), el('dd', {}, t.kind),
          el('dt', {}, 'COMES FROM'), el('dd', {}, t.from),
          el('dt', {}, 'CONNECTION'), el('dd', {}, t.link)));
      feedback.innerHTML = '';
      feedback.append(card);
      const spans = [...chain.children];
      spans.forEach((s, i) => setTimeout(() => s.classList.add('on'), settings.reducedMotion ? 0 : i * 260));
    }

    function next() {
      if (!solved) return;
      idx += 1;
      if (idx >= tasks.length) { finish(); return; }
      setupTask();
    }

    function finish() {
      if (panel.closed) return;
      if (unhook) unhook();
      R.renderer.domElement.removeEventListener('pointerdown', onCanvasDown);
      R.renderer.domElement.removeEventListener('wheel', onWheel);
      if (drum) { R.focusScene.remove(drum.root); drum.dispose(); }
      panel.close();
      resolve({ done, total: tasks.length });
    }

    function onCanvasDown(e) {
      if (!drum) return;
      const hits = pickFocus(e.clientX, e.clientY, [drum.root]);
      if (!hits.length) return;
      const i = drum.hitRing(hits[0].object);
      if (i < 0 || drum.rings[i].fixed) return;
      drum.setFocus(i);
      const slot = drum.screenSlots()[i];
      const mid = (slot.top + slot.bottom) / 2;
      drum.turn(i, e.clientY < mid ? 1 : -1);
    }
    function onWheel(e) {
      if (!drum) return;
      e.preventDefault();
      const hits = pickFocus(e.clientX, e.clientY, [drum.root]);
      let i = hits.length ? drum.hitRing(hits[0].object) : drum.focus;
      if (i < 0 || drum.rings[i].fixed) i = drum.focus;
      drum.setFocus(i);
      drum.turn(i, e.deltaY < 0 ? 1 : -1);
    }

    compileBtn.addEventListener('click', compile);
    nextBtn.addEventListener('click', next);
    R.renderer.domElement.addEventListener('pointerdown', onCanvasDown);
    R.renderer.domElement.addEventListener('wheel', onWheel, { passive: false });
    panel.onKey((e) => {
      if (e.key === 'Escape') { e.preventDefault(); finish(); return; }
      if (!drum) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); drum.moveFocus(-1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); drum.moveFocus(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); drum.turn(drum.focus, 1); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); drum.turn(drum.focus, -1); }
      else if (e.key === 'Enter') {
        if (e.target && e.target.tagName === 'BUTTON' && e.target !== document.body) return;
        e.preventDefault();
        if (solved) next(); else compile();
      } else if (e.key.toLowerCase() === 'r') {
        const sel = drum.selection()[drum.focus];
        if (sel && sel.id) sayMorph(sel.id);
      }
    });
    unhook = onUpdate({ update: (dt) => { if (drum) drum.update(dt); position(); }, resize: () => { if (drum) drum.fitCamera(); } });
    setupTask();
    // Playtest hook (read-only view of the open panel).
    window.__cmPanel = { kind: 'compile', get mode() { return effMode(); }, get task() { return task(); }, get drum() { return drum; }, get cols() { return cols; } };
  });
}
