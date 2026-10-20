/**
 * CyberMorph playtest driver. Never loaded by the game. From the browser console:
 *
 *   const A = await import('/cybermorph/dev/autoplay.js');
 *   await A.clearDistrict('anglo');      // plays a whole district through the real buttons
 *
 * It advances frames itself (a hidden tab gets no animation frames), clicks the same DOM
 * buttons a student would, and reads answers from the read-only window.__cmPanel hooks.
 */

const G = () => window.__cybermorph;
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

export async function run(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) { G().step(3); await new Promise((r) => setTimeout(r, 30)); }
}

export function state() {
  const g = G();
  return {
    place: g.place, room: g.roomIndex, p: g.player && [g.player.c, g.player.r], busy: g.busy,
    objective: $('#objective-text').textContent,
    dialogue: !$('#dialogue').hidden && $('#dlg-text').textContent,
    panel: $('#panel-layer').children.length ? ($('#panel-layer').lastElementChild.className) : null,
    rotlings: g.rotlings.length, learned: g.profile && g.profile.learned.length,
  };
}

const button = (re) => $$('#panel-layer button, #screen-layer button').find((b) => re.test(b.textContent) && !b.disabled && b.offsetParent !== null);

export function clickCell(c, r) {
  const g = G();
  const s = g.toScreen(g.room.toWorld(c, r));
  g.R.renderer.domElement.dispatchEvent(new PointerEvent('pointerdown', { clientX: s.x, clientY: s.y, bubbles: true }));
}

async function solveCompile() {
  const P = window.__cmPanel;
  for (let guard = 0; guard < 20 && $('.compile-panel'); guard++) {
    const d = P.drum;
    for (let i = 0; i < d.rings.length; i++) {
      const ring = d.rings[i];
      const want = P.cols[i].answer;
      if (ring.fixed || want === undefined) continue;
      for (let k = 0; k < 40 && ring.sel !== want; k++) { ring.up.click(); await run(40); }
    }
    const c = button(/^COMPILE$/);
    if (c) { c.click(); await run(2600); }
    const n = button(/NEXT|DONE/);
    if (n) { n.click(); await run(500); } else return false;
  }
  return true;
}

async function solveDebug() {
  const P = window.__cmPanel;
  P.expected.forEach((c) => P.seamEls[c].click());
  button(/SPLIT/).click();
  await run(500);
  const v = button(P.item.fake ? /ROT FAKE/ : /REAL WORD/);
  if (v) { v.click(); await run(2600); }
  const done = button(/COLLECT|CONTINUE/);
  if (done) { done.click(); await run(400); }
}

async function solveLink() {
  const P = window.__cmPanel;
  for (const c of P.cards) {
    c.el.click();
    (c.branch === -1 ? P.bin : P.branchEls[c.branch].node).click();
    await run(60);
  }
  const b = button(/ALL LINKED/);
  if (b) { b.click(); await run(400); }
}

async function solveNewWord() {
  const P = window.__cmPanel;
  const target = $$('.sentence .w').find((b) => b.textContent.replace(/[^A-Za-z'-]/g, '').toLowerCase() === P.item.w.toLowerCase());
  target.click();
  await run(300);
  const seams = $$('.detective .seam');
  P.expected.forEach((c) => seams[c - 1].click());
  button(/SPLIT/).click();
  await run(1500);
  const opt = $$('.options .btn').find((b) => b.textContent === P.item.opts[P.item.a]);
  opt.click();
  await run(300);
  button(/CONTINUE/).click();
  await run(400);
}

async function solveDesk() {
  const g = G();
  const { KEY_POOL } = await import('../js/data/world.js');
  const { MORPHEMES } = await import('../js/data/morphemes.js');
  const key = KEY_POOL[g.profile.keyIndex];
  const locks = $$('.lock');
  key.p.forEach((id, slot) => {
    [...MORPHEMES[id].text].forEach((ch, wi) => {
      const letter = locks[slot].querySelectorAll('.letter')[wi];
      letter.dispatchEvent(new KeyboardEvent('keydown', { key: ch, bubbles: true }));
    });
  });
  await run(4000);
  const enter = button(/ENTER THE DRAWER/);
  if (enter) { enter.click(); await run(3000); }
}

/** Resolve whatever is open right now. Returns false when nothing was open. */
export async function step() {
  if (!$('#dialogue').hidden) { $('#dlg-next').click(); await run(80); $('#dlg-next').click(); await run(120); return true; }
  if ($('.lesson')) { (button(/GOT IT/) || button(/INSTALL PATCH/) || button(/CLOSE/)).click(); await run(300); return true; }
  if ($('.desk')) { await solveDesk(); return true; }
  const P = window.__cmPanel;
  if (P && $('#panel-layer').children.length) {
    if (P.kind === 'compile' && $('.compile-panel')) { await solveCompile(); return true; }
    if (P.kind === 'debug' && $('.debug-panel')) { await solveDebug(); return true; }
    if (P.kind === 'link') { await solveLink(); return true; }
    if (P.kind === 'newword') { await solveNewWord(); return true; }
  }
  return false;
}

export async function settle(max = 60) {
  await run(300);
  for (let i = 0; i < max; i++) {
    if (!(await step())) { await run(400); if (!(await step())) return; }
  }
}

export async function use(ch) {
  const o = G().room.objects.find((x) => x.ch === ch);
  if (!o) throw new Error(`no object ${ch} here`);
  for (let attempt = 0; attempt < 3; attempt++) {
    await run(400);
    if (o.walkable && !o.use) return; // already done (an opened firewall)
    G().R.rig.zoomIdx = 3;
    G().walkToUse({ obj: o });
    await run(3000);
    if (!(await step())) continue;
    await settle();
    return;
  }
}

export async function debugAll(max = 8) {
  for (let i = 0; i < max && G().rotlings.length; i++) {
    const r = G().rotlings[0];
    G().rot = 0; // keep the Rot meter from crashing the room mid-script
    G().walkToUse({ rotling: r });
    await run(3000);
    await settle();
  }
}

export async function collectPickups() {
  const g = G();
  for (const p of [...g.pickups]) { clickCell(p.c, p.r); await run(2500); }
}

export async function port(ch) {
  const where = `${G().place}:${G().roomIndex}`;
  for (let attempt = 0; attempt < 3 && `${G().place}:${G().roomIndex}` === where; attempt++) {
    await run(600);
    const o = G().room.objects.find((x) => x.ch === ch);
    G().walkTo({ c: o.c, r: o.r });
    await run(4500);
  }
  await settle();
}

/** Play a whole room from wherever the player stands (one big room, zones split by firewalls). */
export async function finishRoom() {
  const g = G();
  const d = g.profile.districts[g.place];
  const lingo = g.place === 'lingo';
  const last = lingo ? 1 : 2;
  if (!d.done.mentor) await use('M');
  if (!d.done.gate0) await use('G');
  await debugAll(8);
  await collectPickups();
  if (!lingo && !d.done.terminal1) await use('T');
  if (!lingo && !d.done.gate1) await use('F');
  if (!d.done[`link${last}`]) await use('N');
  if (!d.done[`newword${last}`]) await use('W');
  if (!d.done[`core${last}`]) await use('C');
  await settle();
  return state();
}

export async function enter(id) {
  const g = G();
  if (g.place !== 'hub') return;
  await port({ anglo: '1', latin: '2', greek: '3' }[id]);
  await settle();
}
