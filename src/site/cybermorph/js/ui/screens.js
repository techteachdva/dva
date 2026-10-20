import { $, el } from '../core/util.js';
import { settings, setSetting } from '../core/settings.js';
import { profiles, canAddProfile, deleteProfile, loadScores } from '../core/save.js';
import { AVATAR, AVATAR_CATEGORIES, UNLOCK_LABEL, INSPIRATIONS, DISTRICTS, MAIN_ORDER, DEFAULT_AVATAR, ACHIEVEMENTS, rewardsOf } from '../data/world.js';
import { morph, ORIGIN_LABEL } from '../data/morphemes.js';
import { glow } from '../core/mastery.js';
import { R, setFocus, setDim } from '../engine/renderer.js';
import { createMorpher } from '../engine/characters.js';
import { sfx, unlockAudio } from '../core/audio.js';
import { mtile } from './hud.js';
import { openPanel, closeButton } from '../panels/host.js';

export const VERSION = '1.2.0';

const layer = () => $('screen-layer');
let stack = [];

export function showScreen(node, { clear = false } = {}) {
  const s = el('div', { class: `screen${clear ? ' clear' : ''}` }, node);
  layer().append(s);
  stack.push(s);
  document.body.classList.add('screen-open');
  return () => {
    s.remove();
    stack = stack.filter((x) => x !== s);
    if (!stack.length) document.body.classList.remove('screen-open');
  };
}
export const screenOpen = () => stack.length > 0;
export function closeAllScreens() { stack.forEach((s) => s.remove()); stack = []; document.body.classList.remove('screen-open'); }

const progressOf = (p) => {
  const cleared = MAIN_ORDER.filter((d) => p.districts[d] && p.districts[d].cleared).length;
  const extra = [p.deskOpen ? 'desk open' : null, p.finale.beaten ? 'Rot defeated' : null].filter(Boolean);
  return `${cleared}/3 rooms${extra.length ? ' · ' + extra.join(' · ') : ''} · ${p.lexicon.length} words`;
};

// ── Title ─────────────────────────────────────────────────────────
export function titleScreen({ onPlay, onNew, onTimed }) {
  const list = el('div', { class: 'profiles' });
  const render = () => {
    list.innerHTML = '';
    profiles().forEach((p) => {
      const torso = AVATAR.torso.find((x) => x.id === p.avatar.torso) || AVATAR.torso[0];
      const card = el('button', { class: 'profile-card', type: 'button' },
        el('div', { class: 'nm' }, p.name), el('div', { class: 'pr' }, progressOf(p)),
        el('span', { class: 'swatch', style: { background: torso.color } }));
      card.addEventListener('click', () => { unlockAudio(); sfx.click(); close(); onPlay(p); });
      const del = el('button', { class: 'profile-del', type: 'button' }, 'delete');
      del.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (await confirmBox(`Delete ${p.name}? This erases that save from this browser.`, 'Delete')) { deleteProfile(p.id); render(); }
      });
      card.append(del);
      list.append(card);
    });
  };
  render();
  const newBtn = el('button', { class: 'btn btn-pink', type: 'button', disabled: !canAddProfile() }, canAddProfile() ? '+ NEW MORPHER' : 'Six saves max: delete one first');
  newBtn.addEventListener('click', () => { unlockAudio(); sfx.click(); close(); onNew(); });
  const btn = (label, fn) => { const b = el('button', { class: 'btn', type: 'button' }, label); b.addEventListener('click', () => { unlockAudio(); sfx.click(); fn(); }); return b; };
  const wrap = el('div', { class: 'title-wrap' },
    el('div', { class: 'logo' }, 'CYBERMORPH'),
    el('div', { class: 'tagline' }, 'BUILD WORDS · DEBUG THE ROT'),
    profiles().length ? el('div', { class: 'kicker', style: { alignSelf: 'flex-start' } }, 'CONTINUE') : null,
    list,
    el('div', { class: 'row-btns', style: { justifyContent: 'center' } }, newBtn,
      btn('How to play', () => howToScreen()),
      btn('Settings', () => settingsScreen()),
      btn('Overclock scores', () => scoresScreen()),
      btn('Inspirations', () => inspirationsScreen())),
    el('div', { style: { color: 'var(--ink-dim)', fontSize: '1rem', textAlign: 'center', marginTop: '0.6rem' } }, 'A morphology game by Mr. Phil · Saves stay in this browser.'));
  const close = showScreen(el('div', {}, wrap, el('div', { class: 'version' }, `v${VERSION}`)));
  return close;
}

// ── Avatar creator ────────────────────────────────────────────────
export function avatarScreen({ profile = null, unlocked = [], onDone }) {
  const av = { ...DEFAULT_AVATAR, ...(profile ? profile.avatar : {}) };
  const bot = createMorpher(av);
  bot.group.scale.setScalar(2.1);
  bot.group.position.set(-1.6, -2.0, 0);
  R.focusScene.add(bot.group);
  const cam = R.focusCam;
  const camSave = cam.position.clone();
  cam.position.set(0, 0.2, 9);
  cam.lookAt(0, -0.2, 0);
  setFocus(true);
  setDim(0.5);
  let spin = 0;
  const upd = { update: (dt) => { spin += dt * 0.6; bot.group.rotation.y = Math.sin(spin) * 0.7; bot.update(dt, false); } };
  R.updates.add(upd);

  const side = el('div', { class: 'avatar-side' });
  const name = el('input', { type: 'text', maxlength: '16', value: profile ? profile.name : '', placeholder: 'First name', 'aria-label': 'Your Morpher name' });
  const note = el('div', { class: 'unlock-note' });
  const all = Object.values(AVATAR).flat();
  const open = all.filter((o) => !o.unlock || unlocked.includes(o.unlock)).length;
  side.append(el('div', { class: 'kicker' }, profile ? 'CUSTOMIZE YOUR MORPHER' : 'NEW MORPHER'), el('h2', { style: { margin: '0.3rem 0' } }, 'Build your repair bot'),
    el('div', { style: { color: 'var(--ink-dim)', fontSize: '1rem' } }, `${open} of ${all.length} parts unlocked. Achievements unlock the rest.`));
  if (!profile) side.append(el('label', {}, 'Name'), name);
  AVATAR_CATEGORIES.forEach(({ key, label }) => {
    const sw = el('div', { class: 'swatches' });
    const paint = () => [...sw.children].forEach((b) => b.classList.toggle('on', b.dataset.id === av[key]));
    AVATAR[key].forEach((opt) => {
      const locked = opt.unlock && !unlocked.includes(opt.unlock);
      const dark = key === 'face' || key === 'top';
      const b = el('button', { class: `swatch-btn${locked ? ' locked' : ''}`, type: 'button', 'data-id': opt.id, title: locked ? `${opt.name}: ${UNLOCK_LABEL[opt.unlock]}` : opt.name, 'aria-label': `${label}: ${opt.name}${locked ? ' (locked)' : ''}`, style: { background: dark ? '#05060c' : opt.color, color: opt.color } }, locked ? '' : key === 'face' ? '☻' : (opt.icon || ''));
      b.addEventListener('click', () => {
        if (locked) { note.textContent = `🔒 ${opt.name}. ${UNLOCK_LABEL[opt.unlock]}`; sfx.bad(); return; }
        av[key] = opt.id;
        note.textContent = opt.name;
        sfx.click();
        bot.setAvatar(av);
        paint();
      });
      sw.append(b);
    });
    paint();
    side.append(el('label', {}, label), sw);
  });
  const go = el('button', { class: 'btn btn-primary', type: 'button', style: { marginTop: '1rem', width: '100%', minHeight: '56px' } }, profile ? 'SAVE ✔' : 'START ▸');
  go.addEventListener('click', () => {
    const n = (name.value || '').trim().slice(0, 16) || (profile ? profile.name : 'Morpher');
    cleanup();
    onDone({ name: n, avatar: av });
  });
  const ach = el('button', { class: 'btn btn-ghost', type: 'button', style: { marginTop: '0.6rem', width: '100%' } }, '🏆 Achievements');
  ach.addEventListener('click', () => achievementsScreen(unlocked));
  side.append(note, go);
  if (profile) side.append(ach);
  if (profile) {
    const cancel = el('button', { class: 'btn btn-ghost', type: 'button', style: { marginTop: '0.4rem', width: '100%' } }, 'Cancel');
    cancel.addEventListener('click', () => { cleanup(); onDone(null); });
    side.append(cancel);
  }
  const close = showScreen(el('div', { class: 'avatar-screen' }, el('div'), side), { clear: true });
  setTimeout(() => (profile ? go : name).focus(), 50);
  function cleanup() {
    R.updates.delete(upd);
    R.focusScene.remove(bot.group);
    cam.position.copy(camSave);
    setFocus(false);
    setDim(0);
    close();
  }
}

// ── Settings ──────────────────────────────────────────────────────
export function settingsScreen() {
  const grid = el('div', { class: 'settings-grid' });
  const toggle = (key, label) => {
    const b = el('button', { class: `toggle${settings[key] ? ' on' : ''}`, type: 'button', role: 'switch', 'aria-checked': String(!!settings[key]), 'aria-label': label });
    b.addEventListener('click', () => { setSetting(key, !settings[key]); b.classList.toggle('on', settings[key]); b.setAttribute('aria-checked', String(settings[key])); sfx.click(); });
    grid.append(el('label', {}, label), b);
  };
  const range = (key, label) => {
    const r = el('input', { type: 'range', min: '0', max: '1', step: '0.05', value: String(settings[key]), 'aria-label': label });
    r.addEventListener('input', () => setSetting(key, Number(r.value)));
    grid.append(el('label', {}, label), r);
  };
  const seg = (key, label, options) => {
    const s = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    options.forEach(([v, t]) => {
      const b = el('button', { class: settings[key] === v ? 'on' : '', type: 'button' }, t);
      b.addEventListener('click', () => { setSetting(key, v); [...s.children].forEach((x) => x.classList.remove('on')); b.classList.add('on'); sfx.click(); });
      s.append(b);
    });
    grid.append(el('label', {}, label), s);
  };
  range('music', 'Music volume');
  range('sfx', 'Sound effects');
  toggle('speakWords', 'Say words and morphemes aloud');
  toggle('speakDialogue', 'Read mentor lines aloud');
  seg('rate', 'Speech speed', [[0.8, 'Slow'], [0.95, 'Normal'], [1.15, 'Fast']]);
  seg('textSize', 'Text size', [[0.9, 'A−'], [1, 'A'], [1.15, 'A+'], [1.3, 'A++']]);
  toggle('reducedMotion', 'Reduce motion');
  toggle('cognates', 'Show Spanish cognates');
  seg('quality', 'Graphics (reload to apply)', [['auto', 'Auto'], ['low', 'Low'], ['high', 'High']]);
  const done = el('button', { class: 'btn btn-primary', type: 'button' }, 'DONE');
  const close = showScreen(el('section', { class: 'sheet glass' }, el('h2', {}, 'SETTINGS'), grid, el('div', { class: 'row-btns' }, done)));
  done.addEventListener('click', close);
  done.focus();
}

// ── How to play ───────────────────────────────────────────────────
export function howToScreen() {
  const done = el('button', { class: 'btn btn-primary', type: 'button' }, 'GOT IT');
  const close = showScreen(el('section', { class: 'sheet glass' },
    el('h2', {}, 'HOW TO PLAY'),
    el('div', { class: 'howto-grid' },
      el('div', {}, el('b', {}, 'MOVE'), 'Click a floor tile to walk there. W A S D or the arrow keys walk the way you face on screen, even after you turn the camera.'),
      el('div', {}, el('b', {}, 'USE'), 'Click a person or a machine to walk over and use it. The big button at the bottom (or SPACE) does the same.'),
      el('div', {}, el('b', {}, 'CAMERA'), 'Q and E (or the round buttons in the corners) turn the camera. Z zooms in, X zooms out. VIEW (or V) puts it back.'),
      el('div', {}, el('b', {}, 'COMPILE'), 'Turn the rings with ▲▼ (or scroll) until the pieces build the word the request means. Press COMPILE.'),
      el('div', {}, el('b', {}, 'DEBUG'), 'Click Rotlings. Cut their word between morphemes, then decide: real word or Rot fake? Every run brings new Rotlings. Golden ones carry long words worth bonus bits. Three clean splits in a row start a streak.'),
      el('div', {}, el('b', {}, 'PATCH'), 'Firewall locks: turn the ending ring until the word fits the sentence.'),
      el('div', {}, el('b', {}, 'LINK'), 'Hang words on their family branch. Watch for look-alikes that are not family.'),
      el('div', {}, el('b', {}, 'UNLOCK'), 'Achievements unlock new Morpher parts: heads, faces, toppers and more. Some are secret, so click around. See them all in the pause menu.')),
    el('h3', {}, 'SHAPES TELL YOU THE TYPE'),
    el('div', { class: 'legend' },
      el('span', { class: 'mtile', 'data-type': 'pfx', 'data-origin': 'anglo' }, 'un'), 'prefix: pin on the right',
      el('span', { class: 'mtile', 'data-type': 'base', 'data-origin': 'latin' }, 'port'), 'base: square',
      el('span', { class: 'mtile', 'data-type': 'sfx', 'data-origin': 'greek' }, 'ic'), 'suffix: socket on the left',
      el('span', { class: 'mtile', 'data-type': 'link', 'data-origin': 'greek' }, 'o'), 'linking vowel'),
    el('h3', {}, 'THE LOOK TELLS YOU THE ORIGIN'),
    el('div', { class: 'legend' }, ['anglo', 'latin', 'greek', 'lingo'].map((o) => [el('span', { class: 'mtile', 'data-type': 'base', 'data-origin': o }, ORIGIN_LABEL[o]), ' '])),
    el('div', { class: 'row-btns' }, done)));
  done.addEventListener('click', close);
  done.focus();
}

// ── Inspirations ──────────────────────────────────────────────────
export function inspirationsScreen() {
  const done = el('button', { class: 'btn btn-primary', type: 'button' }, 'CLOSE');
  const body = el('section', { class: 'sheet glass' }, el('h2', {}, 'INSPIRATIONS'), el('p', {}, 'CyberMorph stands on the shoulders of these programs, researchers and designers. It never copies their lessons; it practises the ideas.'));
  INSPIRATIONS.forEach((g) => {
    body.append(el('h3', {}, g.group.toUpperCase()), el('ul', { class: 'insp-list' }, g.items.map((it) => el('li', {}, it.u ? el('a', { href: it.u, target: '_blank', rel: 'noopener noreferrer' }, it.t) : it.t))));
  });
  body.append(el('div', { class: 'row-btns' }, done));
  const close = showScreen(body);
  done.addEventListener('click', close);
  done.focus();
}

// ── Overclock Mode scores (browser only) ──────────────────────────────
export function scoresTable(highlight = -1) {
  const list = loadScores();
  if (!list.length) return el('p', {}, 'No Overclock Mode scores in this browser yet.');
  return el('table', { class: 'report' },
    el('tr', {}, el('th', {}, '#'), el('th', {}, 'NAME'), el('th', {}, 'SCORE'), el('th', {}, 'WORDS'), el('th', {}, 'DATE')),
    list.map((s, i) => el('tr', { style: i === highlight ? { color: 'var(--yellow)', fontWeight: '800' } : {} }, el('td', {}, i + 1), el('td', {}, s.name), el('td', {}, s.score), el('td', {}, s.words), el('td', {}, new Date(s.t).toLocaleDateString()))));
}
export function scoresScreen() {
  const done = el('button', { class: 'btn btn-primary', type: 'button' }, 'CLOSE');
  const close = showScreen(el('section', { class: 'sheet glass' }, el('h2', {}, 'OVERCLOCK MODE · TOP 10 (THIS BROWSER)'), scoresTable(), el('div', { class: 'row-btns' }, done)));
  done.addEventListener('click', close);
  done.focus();
}

// ── Progress report ───────────────────────────────────────────────
export function reportScreen(profile) {
  const stars = (l) => '★'.repeat(l) + '☆'.repeat(4 - l);
  const body = el('section', { class: 'sheet glass' }, el('h2', {}, `PROGRESS REPORT · ${profile.name}`));
  const st = profile.stats;
  const rate = st.tasks ? Math.round((st.firstTry / st.tasks) * 100) : 0;
  body.append(el('p', {}, `Words compiled: ${st.compiled} · First-try rate: ${rate}% · Rotlings debugged: ${st.splits} · Lexicon: ${profile.lexicon.length} words · Made-up Words: ${profile.madeUp.length} · Rooms cleared: ${MAIN_ORDER.filter((d) => profile.districts[d] && profile.districts[d].cleared).length}/3`));
  ['anglo', 'latin', 'greek', 'lingo'].forEach((o) => {
    const ids = profile.learned.filter((id) => morph(id).origin === o);
    if (!ids.length) return;
    body.append(el('h3', {}, ORIGIN_LABEL[o].toUpperCase()));
    body.append(el('table', { class: 'report' },
      el('tr', {}, el('th', {}, 'MORPHEME'), el('th', {}, 'MEANING'), el('th', {}, 'MASTERY'), el('th', {}, 'FIRST TRY'), el('th', {}, 'STATUS')),
      ids.map((id) => {
        const r = profile.mastery[id];
        const g = glow(profile, id);
        return el('tr', {}, el('td', {}, morph(id).text), el('td', {}, morph(id).meaning), el('td', { class: 'stars' }, stars(r ? r.l : 0)), el('td', {}, r ? `${r.ok}/${r.n}` : '—'), el('td', {}, !r ? 'not practised' : g.fading ? 'needs review' : g.tier));
      })));
  });
  const print = el('button', { class: 'btn', type: 'button' }, 'Print');
  const done = el('button', { class: 'btn btn-primary', type: 'button' }, 'CLOSE');
  body.append(el('div', { class: 'row-btns' }, print, done));
  const close = showScreen(body);
  print.addEventListener('click', () => printReport(profile));
  done.addEventListener('click', close);
  done.focus();
}

/** One printable page: Letter, 0.4in margins. */
const PAGE_W = 7.7 * 96;
const PAGE_H = 10.1 * 96;

/**
 * The printed report is its own plain black-on-white page, not the game screen
 * (that one scrolls inside a fixed-height window, which a printer clips).
 * It is measured off-screen, then scaled down until it fits on one page.
 */
function printReport(profile) {
  const stars = (l) => '★'.repeat(l) + '☆'.repeat(4 - l);
  const st = profile.stats;
  const rate = st.tasks ? Math.round((st.firstTry / st.tasks) * 100) : 0;
  const rooms = MAIN_ORDER.filter((d) => profile.districts[d] && profile.districts[d].cleared).length;
  const page = el('div', { class: 'print-report measuring' },
    el('h1', {}, `CyberMorph progress report · ${profile.name}`),
    el('div', { class: 'pr-meta' }, new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })),
    el('div', { class: 'pr-stats' }, `Words compiled: ${st.compiled} · First-try rate: ${rate}% · Rotlings debugged: ${st.splits} · Lexicon: ${profile.lexicon.length} words · Made-up Words: ${profile.madeUp.length} · Rooms cleared: ${rooms}/3`),
    el('div', { class: 'pr-key' }, 'Morphemes grouped by mastery (★ out of 4). (2/5) = right on the first try 2 times out of 5. Meanings are in the game\'s Lexicon and on-screen report.'));
  ['anglo', 'latin', 'greek', 'lingo'].forEach((o) => {
    const ids = profile.learned.filter((id) => morph(id).origin === o);
    if (!ids.length) return;
    page.append(el('h2', {}, `${ORIGIN_LABEL[o]} (${ids.length})`));
    // Grouped by mastery as flowing lists, so a whole game's morphemes fit on one page.
    const shown = (id) => { const m = morph(id); return m.type === 'pfx' ? `${m.text}-` : m.type === 'sfx' ? `-${m.text}` : m.text; };
    const score = (id) => { const r = profile.mastery[id]; return r ? ` (${r.ok}/${r.n})` : ''; };
    const groups = [
      ['Needs review', (r, g) => r && g.fading, true],
      [`${stars(4)} mastered`, (r, g) => r && !g.fading && r.l >= 4, false],
      [stars(3), (r, g) => r && !g.fading && r.l === 3, false],
      [stars(2), (r, g) => r && !g.fading && r.l === 2, true],
      [stars(1), (r, g) => r && !g.fading && r.l <= 1, true],
      ['Not practised yet', (r) => !r, false],
    ];
    groups.forEach(([label, test, withScore]) => {
      const list = ids.filter((id) => test(profile.mastery[id], glow(profile, id)));
      if (!list.length) return;
      page.append(el('div', { class: `pr-line${label === 'Needs review' ? ' review' : ''}` },
        el('span', { class: 'pr-label' }, `${label} (${list.length}): `),
        list.map((id) => `${shown(id)}${withScore ? score(id) : ''}`).join(', ')));
    });
  });
  document.querySelectorAll('.print-report').forEach((n) => n.remove());
  document.body.append(page);
  page.style.width = `${PAGE_W}px`;
  const h = page.scrollHeight;
  // Fit one page; below half size it would be unreadable, so then it flows onto a second page instead.
  const zoom = Math.max(0.5, Math.min(1, PAGE_H / h));
  page.style.width = `${PAGE_W / zoom}px`;
  page.style.zoom = String(zoom);
  page.classList.remove('measuring');
  const cleanup = () => { page.remove(); window.removeEventListener('afterprint', cleanup); };
  window.addEventListener('afterprint', cleanup);
  window.print();
}

// ── Lexicon viewer (from the Lexicon Tree) ────────────────────────
export function lexiconPanel(profile) {
  return new Promise((resolve) => {
    const panel = openPanel({ dim: 0.65 });
    const fam = new Map();
    profile.lexicon.forEach(({ w, p }) => p.filter((id) => morph(id).type === 'base').forEach((b) => { if (!fam.has(b)) fam.set(b, []); fam.get(b).push(w); }));
    const body = el('section', { class: 'glass lesson' }, el('div', { class: 'kicker' }, 'THE LEXICON TREE'), el('h2', {}, `${profile.lexicon.length} words on your tree`));
    const grid = el('div', { class: 'lesson-grid' });
    [...fam.entries()].sort((a, b) => b[1].length - a[1].length).forEach(([b, words]) => {
      grid.append(el('div', { class: 'lesson-item' }, mtile(b, { profile }), el('div', { class: 'meta' }, `${words.length} word${words.length > 1 ? 's' : ''}`), el('div', { class: 'mean' }, words.join(', '))));
    });
    if (!fam.size) grid.append(el('p', {}, 'Compile words to grow the tree. Each word becomes a leaf.'));
    body.append(grid);
    body.append(el('h3', {}, 'MADE-UP WORDS'), el('p', {}, profile.madeUp.length ? profile.madeUp.map((m) => `${m.w} (${m.p.map((id) => morph(id).meaning).join(' + ')})`).join(' · ') : 'None yet. Build a legal word that isn\'t in the dictionary at the Morph Compiler, then save it.'));
    const done = el('button', { class: 'btn btn-primary', type: 'button' }, 'CLOSE');
    body.append(el('div', { class: 'lesson-foot' }, el('span'), done));
    panel.root.append(body, closeButton(() => { panel.close(); resolve(); }));
    done.addEventListener('click', () => { panel.close(); resolve(); });
    panel.onKey((e) => { if (e.key === 'Escape') { panel.close(); resolve(); } });
  });
}

// ── Pause ─────────────────────────────────────────────────────────
export function pauseScreen({ profile, onResume, onQuit, onLexicon, onAvatar, onEndSession }) {
  const b = (label, fn, cls = 'btn') => { const x = el('button', { class: cls, type: 'button', style: { width: '100%' } }, label); x.addEventListener('click', () => { sfx.click(); fn(); }); return x; };
  const col = el('div', { style: { display: 'grid', gap: '0.5rem', marginTop: '0.6rem' } },
    b('RESUME', () => { close(); onResume(); }, 'btn btn-primary'),
    b('How to play', () => howToScreen()),
    b('Progress report', () => reportScreen(profile)),
    b('Achievements', () => achievementsScreen(profile.milestones)),
    b('Lexicon', () => { close(); onLexicon(); }),
    b('Customize Morpher', () => { close(); onAvatar(); }),
    b('Settings', () => settingsScreen()),
    b('Inspirations', () => inspirationsScreen()),
    onEndSession ? b('End session · exit ticket', () => { close(); onEndSession(); }) : null,
    b('Save and quit to title', () => { close(); onQuit(); }));
  const close = showScreen(el('section', { class: 'sheet glass', style: { width: 'min(420px, 92vw)' } }, el('h2', {}, 'PAUSED'), el('div', { style: { color: 'var(--ink-dim)' } }, `${profile.name} · saved in this browser`), col));
  col.firstChild.focus();
  return close;
}

// ── Confirm ───────────────────────────────────────────────────────
export function confirmBox(text, yes = 'Yes', no = 'Cancel') {
  return new Promise((resolve) => {
    const y = el('button', { class: 'btn btn-pink', type: 'button' }, yes);
    const n = el('button', { class: 'btn', type: 'button' }, no);
    const close = showScreen(el('section', { class: 'sheet glass', style: { width: 'min(460px, 92vw)' } }, el('p', { style: { fontSize: '1.1rem' } }, text), el('div', { class: 'row-btns' }, y, n)));
    y.addEventListener('click', () => { close(); resolve(true); });
    n.addEventListener('click', () => { close(); resolve(false); });
    n.focus();
  });
}

// ── Overclock Mode result ─────────────────────────────────────────────
export function timedResultScreen({ profile, result, rank, onAgain, onExit }) {
  const again = el('button', { class: 'btn btn-pink', type: 'button' }, 'PLAY AGAIN');
  const exit = el('button', { class: 'btn btn-primary', type: 'button' }, 'BACK TO THE HUB');
  const close = showScreen(el('section', { class: 'sheet glass score-card' },
    el('div', { class: 'kicker' }, 'OVERCLOCK MODE · FINAL SCORE'),
    el('div', { class: 'big' }, String(result.score)),
    el('div', { style: { fontSize: '1.2rem', fontWeight: '800' } }, `${profile.name} · ${new Date().toLocaleString()}`),
    el('div', { class: 'score-grid' },
      el('div', {}, el('b', {}, result.words), 'words debugged'),
      el('div', {}, el('b', {}, `${result.accuracy}%`), 'first-try'),
      el('div', {}, el('b', {}, result.bestStreak), 'best streak')),
    rank >= 0 ? el('div', { style: { color: 'var(--yellow)', fontWeight: '800' } }, `#${rank + 1} on this browser's top 10!`) : null,
    el('p', { style: { color: 'var(--ink-dim)' } }, '📸 Take a screenshot of this card to show Mr. Phil.'),
    el('div', { class: 'row-btns', style: { justifyContent: 'center' } }, again, exit)));
  again.addEventListener('click', () => { close(); onAgain(); });
  exit.addEventListener('click', () => { close(); onExit(); });
  exit.focus();
}

// ── Ending ────────────────────────────────────────────────────────
export function endingScreen({ profile, onDone }) {
  const st = profile.stats;
  const rate = st.tasks ? Math.round((st.firstTry / st.tasks) * 100) : 0;
  const done = el('button', { class: 'btn btn-primary', type: 'button' }, 'BACK TO THE HUB');
  const body = el('section', { class: 'sheet glass credits' },
    el('div', { class: 'kicker' }, 'THE ROT IS GONE'),
    el('h1', { class: 'logo', style: { fontSize: '3rem' } }, 'LEXINET RESTORED'),
    el('p', { style: { fontSize: '1.15rem' } }, `${profile.name} rebuilt the Lexinet: ${profile.lexicon.length} words on the tree, ${st.compiled} compiles, ${st.splits} Rotlings debugged, ${rate}% on the first try.`),
    el('p', {}, 'Every word you know is built from parts. Every part you know opens a door.'),
    el('p', { style: { color: 'var(--yellow)' } }, 'New Rot Slayer parts are unlocked in Customize.'),
    el('p', { style: { color: 'var(--ink-dim)' } }, '📸 Take a screenshot of this screen to show Mr. Phil.'));
  INSPIRATIONS.forEach((g) => body.append(el('h3', {}, g.group.toUpperCase()), el('div', { style: { color: 'var(--ink-dim)', fontSize: '0.9rem' } }, g.items.map((i) => i.t).join(' · '))));
  body.append(el('h3', {}, 'MADE BY'), el('div', {}, 'Mr. Phil · Games Mr. Phil Has Made'), el('div', { class: 'row-btns', style: { justifyContent: 'center' } }, done));
  const close = showScreen(body);
  done.addEventListener('click', () => { close(); onDone(); });
  done.focus();
}

export { DISTRICTS };

// ── Exit ticket ───────────────────────────────────────────────────
/**
 * The end of a class session: what the student practised, one "say it" prompt for a partner,
 * the morphemes to look at again, and the report code for the teacher's Google Form.
 * form: the teacher's pre-filled form link; the word CODE in it is replaced by the code.
 */
export function exitTicketScreen({ profile, ticket, form = '', timeUp = false, onDone }) {
  const t = ticket;
  const body = el('section', { class: 'sheet glass ticket' },
    el('h2', {}, timeUp ? "TIME'S UP · EXIT TICKET" : 'EXIT TICKET'),
    el('div', { class: 'meta' }, `${profile.name} · ${new Date().toLocaleDateString()} · ${t.minutes} min · ${t.words} word${t.words === 1 ? '' : 's'} built · ${t.rotlings} Rotling${t.rotlings === 1 ? '' : 's'} debugged`));
  if (t.practised.length) {
    body.append(el('h3', {}, 'YOU PRACTISED'), el('div', { class: 'chips' }, t.practised.slice(0, 12).map((x) => el('div', { class: 'chip' },
      mtile(x.id, { button: false }), el('span', {}, `${x.ft}/${x.a} first try`), el('small', {}, t.lessonName(x.id))))));
  } else body.append(el('p', {}, 'No morphemes practised this session yet.'));
  if (t.focus) {
    const m = morph(t.focus);
    const ans = el('span', { class: 'ans', hidden: true }, ` ${m.text} means "${m.meaning}".`);
    const show = el('button', { class: 'btn', type: 'button', style: { marginLeft: '0.6rem' } }, 'Check');
    show.addEventListener('click', () => { ans.hidden = false; show.remove(); });
    body.append(el('h3', {}, 'SAY IT'), el('div', { class: 'sayit' }, `Turn to a partner: what does `, el('b', {}, m.type === 'pfx' ? `${m.text}-` : m.type === 'sfx' ? `-${m.text}` : m.text), ` mean? Name one word that uses it.`, show, ans));
  }
  if (t.shaky.length) body.append(el('h3', {}, 'LOOK AGAIN NEXT TIME'), el('div', { class: 'chips' }, t.shaky.map((id) => mtile(id, { button: false }))));
  const code = el('textarea', { class: 'code', readonly: true, rows: 3, 'aria-label': 'Your report code' });
  code.value = t.code;
  code.addEventListener('focus', () => code.select());
  const copy = el('button', { class: 'btn btn-primary', type: 'button' }, 'COPY CODE');
  copy.addEventListener('click', async () => {
    let ok = false;
    try { await navigator.clipboard.writeText(t.code); ok = true; } catch { code.select(); try { ok = document.execCommand('copy'); } catch { ok = false; } }
    copy.textContent = ok ? 'COPIED ✔' : 'Select the code and press Ctrl+C';
    sfx.click();
  });
  const btns = [copy];
  if (form) {
    const open = el('button', { class: 'btn btn-pink', type: 'button' }, 'OPEN THE FORM ▸');
    open.addEventListener('click', () => {
      const url = /=CODE(&|#|$)/.test(form) ? form.replace(/=CODE(&|#|$)/, `=${encodeURIComponent(t.code)}$1`) : form;
      window.open(url, '_blank', 'noopener');
    });
    btns.push(open);
  }
  const done = el('button', { class: 'btn', type: 'button' }, 'DONE · SAVE AND LOG OFF');
  btns.push(done);
  body.append(el('h3', {}, 'YOUR REPORT CODE'),
    el('div', { class: 'how' }, form ? 'Press OPEN THE FORM, check your code is in the answer box, then press Submit.' : "Copy the code and paste it into your teacher's form."),
    code, el('div', { class: 'row-btns' }, ...btns));
  const close = showScreen(body);
  done.addEventListener('click', () => { close(); onDone && onDone(); });
  copy.focus();
  return close;
}

/** Shown instead of the game when a timed session ended recently in this browser. */
export function sessionDoneScreen({ profile, minutes, onTicket, onBack }) {
  const ticket = el('button', { class: 'btn btn-primary', type: 'button' }, 'SHOW MY EXIT TICKET');
  const back = el('button', { class: 'btn', type: 'button' }, 'BACK');
  const close = showScreen(el('section', { class: 'sheet glass', style: { width: 'min(520px, 92vw)' } },
    el('h2', {}, 'SESSION COMPLETE'),
    el('p', {}, `Nice work today, ${profile.name}. Your teacher's timer for this session is done.`),
    el('p', { style: { color: 'var(--ink-dim)' } }, `The game opens again in about ${minutes} minute${minutes === 1 ? '' : 's'}.`),
    el('div', { class: 'row-btns' }, ticket, back)));
  ticket.addEventListener('click', () => { close(); onTicket(); });
  back.addEventListener('click', () => { close(); onBack(); });
  ticket.focus();
}

// ── Achievements ──────────────────────────────────────────────────
/** Every achievement, what it unlocks, and how to get it. Secrets show only a hint until earned. */
export function achievementsScreen(earned = []) {
  const done = el('button', { class: 'btn btn-primary', type: 'button' }, 'CLOSE');
  const got = ACHIEVEMENTS.filter((a) => earned.includes(a.key)).length;
  const list = el('div', { class: 'ach-list' }, ACHIEVEMENTS.map((a) => {
    const have = earned.includes(a.key);
    const hidden = a.secret && !have;
    const rewards = rewardsOf(a.key).map(({ cat, part }) => `${part.icon ? `${part.icon} ` : ''}${part.name} (${AVATAR_CATEGORIES.find((c) => c.key === cat).label.toLowerCase()})`);
    return el('div', { class: `ach${have ? ' have' : ''}` },
      el('div', { class: 'ach-icon' }, have ? '🏆' : hidden ? '❔' : '🔒'),
      el('div', {},
        el('div', { class: 'ach-name' }, hidden ? 'Secret achievement' : a.name),
        el('div', { class: 'ach-how' }, hidden ? a.hint : a.how),
        el('div', { class: 'ach-reward' }, hidden ? 'Unlocks: ???' : `Unlocks: ${rewards.join(', ')}`)));
  }));
  const close = showScreen(el('section', { class: 'sheet glass' }, el('h2', {}, `ACHIEVEMENTS · ${got} / ${ACHIEVEMENTS.length}`), list, el('div', { class: 'row-btns' }, done)));
  done.addEventListener('click', close);
  done.focus();
}
