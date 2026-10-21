/**
 * CyberMorph dev console: a hidden text terminal for hand-testing, modeled on Ainmos's.
 *
 * Open or close it by holding 1 and 0 together for half a second (or load with ?dev=1).
 * Nothing on screen hints at it. Type `help` for commands; ↑/↓ walk the history, Esc closes.
 * Commands run through `api`, a handle on the game's internals that game.js passes in.
 */

const CHORD_MS = 400;
const MAX_LOG = 120;

export function initDevConsole(api) {
  const panel = document.createElement('div');
  panel.className = 'dev-console';
  panel.hidden = true;
  panel.innerHTML = `<div class="dev-console-header"><b>CYBERMORPH DEV</b><span class="dev-console-hint">help · ↑↓ history · Esc closes · hold 1+0 to toggle</span></div>
    <div class="dev-console-log" role="log"></div>
    <input class="dev-console-input" type="text" spellcheck="false" autocomplete="off" aria-label="Dev command" placeholder="type a command, e.g. help">`;
  document.body.append(panel);
  const log = panel.querySelector('.dev-console-log');
  const input = panel.querySelector('.dev-console-input');
  const history = [];
  let hIdx = 0;

  const print = (text, kind = 'ok') => {
    String(text).split('\n').forEach((line) => {
      const d = document.createElement('div');
      d.className = `dev-log-line ${kind}`;
      d.textContent = line;
      log.append(d);
    });
    while (log.children.length > MAX_LOG) log.firstChild.remove();
    log.scrollTop = log.scrollHeight;
  };
  const setOpen = (on) => {
    panel.hidden = !on;
    document.body.classList.toggle('dev-open', on);
    if (on) { setTimeout(() => input.focus(), 0); if (!log.children.length) print('CyberMorph dev console. Type help.'); }
    else input.blur();
  };

  async function run(raw) {
    const line = raw.trim().replace(/^[/>]/, '');
    if (!line) return;
    history.push(line);
    hIdx = history.length;
    print(`> ${line}`, 'cmd');
    const [name, ...args] = line.split(/\s+/);
    const cmd = COMMANDS[name.toLowerCase()];
    if (!cmd) { print(`Unknown command "${name}". Type help.`, 'err'); return; }
    try {
      const out = await cmd.run(api, args, print);
      if (out) print(out);
    } catch (err) {
      print(String(err && err.message ? err.message : err), 'err');
      console.error(err);
    }
  }

  input.addEventListener('keydown', (e) => {
    // Keep typing out of the game's own key handlers.
    e.stopPropagation();
    if (e.key === 'Enter') { e.preventDefault(); const v = input.value; input.value = ''; run(v); }
    else if (e.key === 'Escape') { e.preventDefault(); setOpen(false); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); hIdx = Math.max(0, hIdx - 1); input.value = history[hIdx] || ''; }
    else if (e.key === 'ArrowDown') { e.preventDefault(); hIdx = Math.min(history.length, hIdx + 1); input.value = history[hIdx] || ''; }
  });
  input.addEventListener('keyup', (e) => e.stopPropagation());

  // The chord: 1 and 0 both held for CHORD_MS. Typing "10" in a text box never holds both that long.
  const held = new Set();
  let chordTimer = 0;
  window.addEventListener('keydown', (e) => {
    if (e.key !== '1' && e.key !== '0') return;
    held.add(e.key);
    if (held.has('1') && held.has('0') && !chordTimer) {
      chordTimer = setTimeout(() => {
        chordTimer = 0;
        if (held.has('1') && held.has('0')) {
          if (document.activeElement && document.activeElement !== input && /INPUT|TEXTAREA/.test(document.activeElement.tagName)) document.activeElement.blur();
          setOpen(panel.hidden);
        }
      }, CHORD_MS);
    }
  }, true);
  window.addEventListener('keyup', (e) => {
    held.delete(e.key);
    if (chordTimer && !(held.has('1') && held.has('0'))) { clearTimeout(chordTimer); chordTimer = 0; }
  }, true);
  window.addEventListener('blur', () => held.clear());

  if (new URLSearchParams(location.search).get('dev') === '1') setOpen(true);
  return { open: () => setOpen(true), run };
}

// ── Commands ──────────────────────────────────────────────────────
const ROOMS = ['anglo', 'latin', 'greek'];
const room = (s) => {
  const r = { a: 'anglo', anglo: 'anglo', l: 'latin', latin: 'latin', g: 'greek', greek: 'greek', lingo: 'lingo' }[(s || '').toLowerCase()];
  if (!r) throw new Error(`Which room? anglo, latin, greek (or lingo). Got "${s || ''}".`);
  return r;
};

const COMMANDS = {
  help: {
    usage: 'help [command]', desc: 'list commands, or details for one',
    run(api, [name]) {
      if (name && COMMANDS[name]) return `${COMMANDS[name].usage}\n  ${COMMANDS[name].desc}${COMMANDS[name].more ? `\n  ${COMMANDS[name].more}` : ''}`;
      const groups = {
        Where: ['status', 'goto', 'level', 'phase'],
        Progress: ['earn', 'unlock', 'clear', 'reset'],
        Minigames: ['game', 'games', 'families'],
        Story: ['noam', 'lab', 'desk', 'finale', 'overclock'],
        Testing: ['rotling', 'clearlog'],
      };
      const out = ['Commands (a leading / is fine):'];
      Object.entries(groups).forEach(([g, names]) => {
        out.push(`[${g}]`);
        names.forEach((n) => out.push(`  ${COMMANDS[n].usage.padEnd(30)} ${COMMANDS[n].desc}`));
      });
      out.push('Examples: goto latin · level greek 8 · phase build · game rupt 2 · games move · unlock all');
      return out.join('\n');
    },
  },
  status: {
    usage: 'status', desc: 'where you are, your level, morphemes and story flags',
    async run(api) {
      await api.ensure();
      const p = api.profile();
      const lines = [`Morpher: ${p.name} · place: ${api.G.place} · morphemes: ${p.learned.length} · words: ${p.lexicon.length}`];
      ROOMS.forEach((id) => {
        const d = p.districts[id];
        const L = api.levels(id);
        lines.push(`  ${id.padEnd(6)} ${d && d.cleared ? 'CLEARED' : d ? `level ${(d.level || 0) + 1}/${L.length}, ${d.lv ? d.lv.phase : 'not started'}` : 'not visited'}`);
      });
      lines.push(`  hub: ${JSON.stringify(p.hub || {})} · desk open: ${!!p.deskOpen}`);
      return lines.join('\n');
    },
  },
  goto: {
    usage: 'goto <hub|anglo|latin|greek|lingo>', desc: 'jump to a place',
    async run(api, [where]) {
      await api.ensure();
      if (!where || where === 'hub') { await api.enterHub(); return 'In the Hub.'; }
      const r = room(where);
      api.prepRoom(r);
      await api.enterRoom(r);
      return `In ${r}.`;
    },
  },
  level: {
    usage: 'level <room> <n>', desc: 'start level n of a room (earlier levels earned, gates opened)',
    more: 'Rooms have 5 (anglo), 13 (latin) and 11 (greek) levels.',
    async run(api, [where, n]) {
      await api.ensure();
      const r = room(where);
      const L = api.levels(r);
      const i = Math.max(1, Math.min(L.length, parseInt(n, 10) || 1)) - 1;
      api.jumpLevel(r, i);
      await api.enterRoom(r);
      await api.beginLevel(r);
      return `${r} level ${i + 1}/${L.length}: ${L[i].dials.map((x) => x.join('/')).join(' × ')}`;
    },
  },
  phase: {
    usage: 'phase <earn|build|dessert|done>', desc: 'skip the current level to a phase',
    async run(api, [ph]) {
      await api.ensure();
      if (!['earn', 'build', 'dessert', 'done'].includes(ph)) throw new Error('phase earn, build, dessert or done');
      await api.setPhase(ph);
      return `Phase: ${ph}.`;
    },
  },
  earn: {
    usage: 'earn <all|room|ids...>', desc: 'add morphemes to your inventory',
    async run(api, args) {
      await api.ensure();
      const n = api.earn(args);
      return `Earned ${n} morpheme${n === 1 ? '' : 's'}.`;
    },
  },
  unlock: {
    usage: 'unlock <room|all>', desc: 'open a room\'s door (clears the rooms before it); all opens everything',
    async run(api, [what]) {
      await api.ensure();
      api.unlock(what === 'all' ? 'all' : room(what));
      if (api.G.place === 'hub') await api.enterHub();
      return what === 'all' ? 'Every door, the Word Lab and the desk are open.' : `${what} is open.`;
    },
  },
  clear: {
    usage: 'clear <room>', desc: 'mark a room cleared (all its levels, gates and core)',
    async run(api, [what]) {
      await api.ensure();
      api.clearRoom(room(what));
      return `${what} cleared. Go to the hub to see Noam react.`;
    },
  },
  reset: {
    usage: 'reset <room|hub|all>', desc: 'undo progress in a room, Noam\'s scenes, or everything',
    async run(api, [what]) {
      await api.ensure();
      api.reset(what === 'hub' || what === 'all' ? what : room(what));
      if (api.G.place === 'hub') await api.enterHub();
      return `Reset ${what}.`;
    },
  },
  game: {
    usage: 'game <morpheme> [tier 0-2]', desc: 'play one morpheme\'s minigame',
    async run(api, [id, tier], print) {
      if (!id) throw new Error('game <morpheme id>, e.g. game port');
      if (!api.morph(id)) throw new Error(`No morpheme "${id}".`);
      print(`${id}: ${api.familyOf(id)} family`);
      const res = await api.playMinigame(id, Number.isFinite(+tier) && tier !== undefined ? +tier : 1);
      return res.won ? `Won (${res.misses} miss${res.misses === 1 ? '' : 'es'}).` : 'Closed.';
    },
  },
  games: {
    usage: 'games [family|all] [tier]', desc: 'play minigames in order; close one to stop',
    more: 'No family: one game per family and per variant (about 60). all: every morpheme (332). A family name plays each of its morphemes.',
    async run(api, [which, tier], print) {
      const list = api.gameList(which);
      if (!list.length) throw new Error(`No minigames for "${which}". Try: games, games all, or games <family> (see families).`);
      const t = tier !== undefined ? +tier : 1;
      for (let i = 0; i < list.length; i++) {
        print(`${i + 1}/${list.length}: ${list[i]} (${api.familyOf(list[i])})`);
        const res = await api.playMinigame(list[i], t);
        if (!res.won) return `Stopped at ${list[i]} (${i + 1}/${list.length}). Resume with: games ${which || ''} from there, or game ${list[i]}.`;
      }
      return `Played all ${list.length}.`;
    },
  },
  families: {
    usage: 'families', desc: 'list minigame families and their sizes',
    run(api) { return api.familyList(); },
  },
  noam: {
    usage: 'noam <intro|lab|latin|greek|cleared|desk|talk>', desc: 'replay one of Noam\'s Hub scenes',
    async run(api, [scene]) {
      await api.ensure();
      await api.noam(scene || 'talk');
      return 'Done.';
    },
  },
  lab: { usage: 'lab', desc: 'open the Word Lab (free building) right now', async run(api) { await api.ensure(); await api.openLab(); return 'Word Lab closed.'; } },
  desk: { usage: 'desk', desc: 'open the Secret Secretary Desk right now', async run(api) { await api.ensure(); await api.openDesk(); return 'Desk closed.'; } },
  finale: { usage: 'finale', desc: 'jump to the final fight with the Rot', async run(api) { await api.ensure(); await api.startFinale(); return 'Finale.'; } },
  overclock: { usage: 'overclock', desc: 'start Overclock Mode (needs a cleared room)', async run(api) { await api.ensure(); await api.startTimed(); return 'Overclock.'; } },
  rotling: {
    usage: 'rotling [real|misspelled|reversed|nonword]', desc: 'spawn a Rotling of that kind next to you',
    async run(api, [kind]) {
      await api.ensure();
      const what = api.spawnRotling(kind || 'real');
      return `Spawned: ${what}.`;
    },
  },
  clearlog: { usage: 'clearlog', desc: 'empty this console', run() { document.querySelector('.dev-console-log').innerHTML = ''; } },
};
