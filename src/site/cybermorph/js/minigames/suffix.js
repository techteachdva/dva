/**
 * Suffix shop (suffix): the job is the answer. Words ride a conveyor belt into the stamp press,
 * each with an order tag naming the job it needs (THING, DESCRIBER, HOW, PERSON, VERB, or for
 * endings MORE THAN ONE / PAST / NOW / MOST). You stamp each word with the suffix that does that
 * job. Most orders want this level's suffix; the other stamps are there so the job decides.
 * Another stamp that also builds a real word from that base is right too: no buzzer, and a
 * lesson order still counts. A word that slips past the press goes to the Rot.
 * Each sub has its own shop (warehouse, paint shop, race track, costume shop, power lab, clock
 * shop), and some suffixes show what they do: -less empties the crate, -ful fills it, -s and
 * -es copy the item, -ed slides it into the past, -ing keeps it running, -est makes it the biggest.
 */

import { BANK } from '../data/bank.js';
import { hasMorph } from '../data/morphemes.js';
import { build } from '../compiler/wordsum.js';

// ── juice (each template keeps its own copy so it stands alone) ──
const font = (px, w = 700) => `${w} ${px}px Lexend, sans-serif`;
const EMOJI = '"Segoe UI Emoji","Noto Color Emoji","Apple Color Emoji",sans-serif';
function text(g, s, x, y, px, color, align = 'center', w = 700) {
  g.font = font(px, w); g.textAlign = align; g.textBaseline = 'middle'; g.fillStyle = color; g.fillText(s, x, y);
}
function emoji(g, e, x, y, px) { g.font = `${px}px ${EMOJI}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.fillText(e, x, y); }
function makeFx(ctx) {
  const parts = [];
  let last = ctx.t;
  return {
    burst(x, y, color, n = 22, speed = 280) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2; const s = speed * (0.3 + Math.random());
        parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 80, life: 0.5 + Math.random() * 0.5, c: color, r: 3 + Math.random() * 5 });
      }
    },
    draw(g) {
      const dt = Math.min(0.05, ctx.t - last); last = ctx.t;
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i]; p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 500 * dt;
        if (p.life <= 0) { parts.splice(i, 1); continue; }
        g.globalAlpha = Math.min(1, p.life * 2); g.fillStyle = p.c; g.fillRect(p.x - p.r / 2, p.y - p.r / 2, p.r, p.r);
      }
      g.globalAlpha = 1;
    },
  };
}
function rot(g, x, y, r, t) {
  g.save(); g.translate(x, y);
  g.fillStyle = 'rgba(125,255,74,0.88)'; g.beginPath();
  for (let i = 0; i <= 14; i++) {
    const a = (i / 14) * Math.PI * 2; const rr = r * (0.8 + 0.2 * Math.sin(t * 7 + i * 2.3));
    if (i) g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); else g.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  g.fill();
  if (Math.sin(t * 13 + x * 0.1) > 0.55) { g.fillStyle = '#d4ff3a'; g.fillRect(-r * 1.1, -r * 0.2 + Math.sin(t * 40) * r * 0.4, r * 2.2, 4); }
  g.fillStyle = '#0b1a05'; g.beginPath(); g.arc(-r * 0.3, -r * 0.15, r * 0.14, 0, 7); g.arc(r * 0.3, -r * 0.15, r * 0.14, 0, 7); g.fill();
  g.restore();
}
function hud(g, ctx, goal, done, need) {
  g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(0, 0, ctx.W, 64);
  const t = ctx.tile;
  if (t.ready) { const h = 44; const w = (t.width / t.height) * h; g.drawImage(t, 16, 10, w, h); }
  // shrink the goal until it fits between the tile and the pips
  const room = ctx.W - 2 * Math.max(130, need * 26 + 30);
  let px = 25; g.font = font(px); while (px > 15 && g.measureText(goal).width > room) { px -= 1; g.font = font(px); }
  text(g, goal, ctx.W / 2, 33, px, '#fff');
  for (let i = 0; i < need; i++) {
    g.beginPath(); g.arc(ctx.W - 26 - (need - 1 - i) * 26, 33, 9, 0, 7);
    g.fillStyle = i < done ? ctx.palette.glow : 'rgba(255,255,255,0.2)'; g.fill();
  }
}
const keyIn = (set, ks) => ks.some((k) => set.has(k));

// ── the shop ──
// [base, result, emoji?] — three real words each suffix makes.
const WORDS = {
  ness: [['kind', 'kindness'], ['dark', 'darkness', '🌑'], ['happy', 'happiness', '😊']],
  ship: [['friend', 'friendship', '🤝'], ['leader', 'leadership'], ['member', 'membership']],
  hood: [['child', 'childhood', '🧒'], ['neighbor', 'neighborhood', '🏘️'], ['brother', 'brotherhood']],
  dom: [['king', 'kingdom', '👑'], ['free', 'freedom', '🕊️'], ['bore', 'boredom', '🥱']],
  ion: [['act', 'action', '🎬'], ['invent', 'invention', '💡'], ['connect', 'connection', '🔗']],
  ation: [['inform', 'information', 'ℹ️'], ['explore', 'exploration', '🧭'], ['imagine', 'imagination', '💭']],
  ment: [['move', 'movement'], ['enjoy', 'enjoyment', '😄'], ['pay', 'payment', '💵']],
  ure: [['press', 'pressure'], ['fail', 'failure'], ['close', 'closure']],
  ity: [['active', 'activity'], ['real', 'reality'], ['equal', 'equality', '⚖️']],
  yn: [['jealous', 'jealousy'], ['honest', 'honesty'], ['discover', 'discovery', '🔭']],
  ence: [['differ', 'difference'], ['exist', 'existence'], ['prefer', 'preference']],
  ance: [['appear', 'appearance'], ['perform', 'performance', '🎭'], ['allow', 'allowance', '💰']],
  ute: [['trib', 'tribute'], ['stat', 'statute', '📜'], ['constit', 'constitute']],
  gy: [['biolog', 'biology', '🧬'], ['geolog', 'geology', '⛰️'], ['ecolog', 'ecology', '🌿']],
  ia: [['insomn', 'insomnia', '😳'], ['phob', 'phobia', '😱'], ['nostalg', 'nostalgia']],
  sis: [['analy', 'analysis', '🔍'], ['diagno', 'diagnosis', '🩺'], ['synthe', 'synthesis']],
  ism: [['hero', 'heroism', '🦸'], ['real', 'realism'], ['tour', 'tourism', '🧳']],
  ics: [['phys', 'physics', '⚛️'], ['athlet', 'athletics', '🏅'], ['graph', 'graphics', '🖼️']],
  ful: [['hope', 'hopeful', '🤞'], ['help', 'helpful', '🤝'], ['color', 'colorful', '🎨']],
  less: [['home', 'homeless', '🏠'], ['fear', 'fearless', '😨'], ['care', 'careless', '🩹']],
  y: [['rain', 'rainy', '🌧️'], ['sun', 'sunny', '☀️'], ['wind', 'windy', '🌬️']],
  ish: [['child', 'childish', '🧒'], ['fool', 'foolish', '🤪'], ['red', 'reddish', '🟥']],
  some: [['awe', 'awesome', '🤩'], ['lone', 'lonesome'], ['trouble', 'troublesome']],
  able: [['read', 'readable', '📖'], ['wash', 'washable', '🧼'], ['enjoy', 'enjoyable', '😄']],
  ible: [['vis', 'visible', '👀'], ['aud', 'audible', '👂'], ['ed', 'edible', '🍎']],
  ble: [['sta', 'stable'], ['solu', 'soluble', '🧂'], ['dura', 'durable']],
  ive: [['act', 'active', '🏃'], ['create', 'creative', '🎨'], ['attract', 'attractive', '🧲']],
  ous: [['danger', 'dangerous', '⚠️'], ['joy', 'joyous', '🥳'], ['fame', 'famous', '🌟']],
  al: [['nature', 'natural', '🌿'], ['music', 'musical', '🎵'], ['season', 'seasonal', '🍂']],
  ial: [['face', 'facial'], ['part', 'partial'], ['race', 'racial']],
  ic: [['hero', 'heroic', '🦸'], ['poet', 'poetic', '📜'], ['metal', 'metallic', '🔩']],
  tic: [['drama', 'dramatic', '🎭'], ['fanta', 'fantastic', '✨'], ['magne', 'magnetic', '🧲']],
  ary: [['imagine', 'imaginary', '🦄'], ['diction', 'dictionary', '📘'], ['element', 'elementary']],
  ory: [['direct', 'directory', '📇'], ['advise', 'advisory'], ['contradict', 'contradictory']],
  ile: [['frag', 'fragile', '🥚'], ['mob', 'mobile', '📱'], ['host', 'hostile']],
  ite: [['favor', 'favorite', '💖'], ['defin', 'definite'], ['oppos', 'opposite']],
  ly: [['quick', 'quickly', '⚡'], ['slow', 'slowly', '🐢'], ['happy', 'happily', '😊']],
  ward: [['home', 'homeward', '🏠'], ['back', 'backward', '🔙'], ['up', 'upward', '⬆️']],
  er: [['teach', 'teacher', '🏫'], ['sing', 'singer', '🎤'], ['run', 'runner', '🏃']],
  or: [['act', 'actor', '🎬'], ['invent', 'inventor', '💡'], ['sail', 'sailor', '⛵']],
  ist: [['art', 'artist', '🎨'], ['piano', 'pianist', '🎹'], ['science', 'scientist', '🔬']],
  ant: [['assist', 'assistant'], ['serve', 'servant'], ['attend', 'attendant']],
  ent: [['stud', 'student', '🎒'], ['reside', 'resident', '🏠'], ['preside', 'president']],
  en: [['dark', 'darken', '🌑'], ['bright', 'brighten', '🔆'], ['soft', 'soften', '🧸']],
  ate: [['active', 'activate', '🔛'], ['motive', 'motivate'], ['captive', 'captivate']],
  ize: [['real', 'realize'], ['memory', 'memorize', '🧠'], ['organ', 'organize', '🗂️']],
  s: [['cat', 'cats', '🐱'], ['book', 'books', '📕'], ['star', 'stars', '⭐']],
  es: [['box', 'boxes', '📦'], ['dish', 'dishes', '🍽️'], ['fox', 'foxes', '🦊']],
  ed: [['jump', 'jumped', '🦘'], ['walk', 'walked', '🚶'], ['play', 'played', '🎮']],
  ing: [['run', 'running', '🏃'], ['sing', 'singing', '🎤'], ['jump', 'jumping', '🦘']],
  est: [['big', 'biggest', '🐘'], ['fast', 'fastest', '🐆'], ['tall', 'tallest', '🦒']],
};
const SUB_OF = {};
const SUBS = {
  thing: ['ness', 'ship', 'hood', 'dom', 'ion', 'ation', 'ment', 'ure', 'ity', 'yn', 'ence', 'ance', 'ute', 'gy', 'ia', 'sis', 'ism', 'ics'],
  describer: ['ful', 'less', 'y', 'ish', 'some', 'able', 'ible', 'ble', 'ive', 'ous', 'al', 'ial', 'ic', 'tic', 'ary', 'ory', 'ile', 'ite'],
  how: ['ly', 'ward'], person: ['er', 'or', 'ist', 'ant', 'ent'], verb: ['en', 'ate', 'ize'], ending: ['s', 'es', 'ed', 'ing', 'est'],
};
Object.entries(SUBS).forEach(([sub, ids]) => ids.forEach((id) => { SUB_OF[id] = sub; }));
const JOB = {
  thing: { icon: '📦', name: 'THING', does: 'turns a word into a THING' },
  describer: { icon: '🎨', name: 'DESCRIBER', does: 'turns a word into a DESCRIBER' },
  how: { icon: '🏁', name: 'HOW', does: 'tells HOW' },
  person: { icon: '🧑', name: 'PERSON', does: 'turns a word into a PERSON' },
  verb: { icon: '⚡', name: 'VERB', does: 'turns a word into a VERB (to make)' },
  s: { icon: '👯', name: 'MORE THAN ONE', does: 'means MORE THAN ONE' }, es: { icon: '👯', name: 'MORE THAN ONE', does: 'means MORE THAN ONE' },
  ed: { icon: '⏪', name: 'PAST', does: 'puts it in the PAST' }, ing: { icon: '▶️', name: 'NOW', does: 'means it is happening NOW' },
  est: { icon: '🏆', name: 'MOST', does: 'means the MOST' },
};
const jobOf = (id) => JOB[id] || JOB[SUB_OF[id]] || JOB.thing;
// base → suffix id → the real word that stamp makes, from the shop list above.
const BY_BASE = new Map();
Object.entries(WORDS).forEach(([suf, list]) => list.forEach(([base, result]) => {
  if (!BY_BASE.has(base)) BY_BASE.set(base, new Map());
  BY_BASE.get(base).set(suf, result);
}));
/** The word this base and stamp really make, or null when the joint is not a real word. */
function realStamp(base, suf) {
  const listed = BY_BASE.get(base);
  if (listed && listed.has(suf)) return listed.get(suf);
  if (!hasMorph(base) || !hasMorph(suf)) return null;
  let word = '';
  try { word = build([base, suf]).word; } catch { return null; }
  const hit = BANK.find((b) => b.word === word && b.ids.length === 2 && b.ids[0] === base && b.ids[1] === suf);
  return hit ? hit.word : null;
}
// Simple, everyday suffixes the decoy stamps come from.
const DECOYS = ['ness', 'ment', 'ion', 'ful', 'less', 'able', 'ous', 'ly', 'er', 'ist', 'or', 'en', 'ize', 's', 'ed', 'ing', 'est'];
const SHOP = {
  thing: { name: 'WAREHOUSE', top: '#2a1a0c', bottom: '#120a04', belt: '#4a3a2a', deco: '📦' },
  describer: { name: 'PAINT SHOP', top: '#2a0f3a', bottom: '#12051c', belt: '#3e2a52', deco: '🎨' },
  how: { name: 'RACE TRACK', top: '#0c2a14', bottom: '#041208', belt: '#2c3e30', deco: '🏁' },
  person: { name: 'COSTUME SHOP', top: '#0a2a2e', bottom: '#041416', belt: '#28464a', deco: '🎩' },
  verb: { name: 'POWER LAB', top: '#0a1440', bottom: '#03061a', belt: '#28305a', deco: '⚡' },
  ending: { name: 'CLOCK SHOP', top: '#2e2008', bottom: '#140d02', belt: '#4e4226', deco: '⏰' },
};
export default {
  seconds: 32,
  howTo(m) { return `-${m.text} ${jobOf(m.id).does}: stamp each word on the belt with the suffix that does the job on its tag.`; },
  verb(m) {
    const special = {
      less: 'You took things away with -less.', ful: 'You filled them up with -ful.', s: 'You copied them: more than one.',
      es: 'You copied them: more than one.', ed: 'You slid them into the past.', ing: 'You kept them happening now.', est: 'You made them the most.',
    };
    return special[m.id] || `You stamped words into ${jobOf(m.id).name.toLowerCase()}s.`;
  },
  start(ctx) {
    const { W, H, rnd, tier, palette, input } = ctx;
    const fx = makeFx(ctx);
    const id = ctx.id in WORDS ? ctx.id : 'ness';
    const sub = SUB_OF[id];
    const shop = SHOP[sub];
    const tj = jobOf(id).name;
    // the stamps: this suffix plus decoys that each do a different job
    const stamps = [id];
    const used = new Set([tj]);
    for (const d of [...DECOYS].sort(() => rnd() - 0.5)) {
      if (stamps.length >= 2 + tier) break;
      if (!used.has(jobOf(d).name)) { used.add(jobOf(d).name); stamps.push(d); }
    }
    stamps.sort(() => rnd() - 0.5);
    const need = [3, 4, 6][tier];
    const speed = [75, 105, 145][tier];
    const PRESS = 560; const BELT_Y = 300; const WIN = 85;
    let done = 0; let miss = 0; let sel = 0; let spawnIn = 0; let made = 0; let slam = 0;
    const crates = [];
    const label = (s) => (s === id ? ctx.m.text : s);

    function spawn() {
      const want = made === 0 || rnd() < 0.7 ? id : stamps.filter((s) => s !== id)[Math.floor(rnd() * (stamps.length - 1))];
      const list = WORDS[want];
      const [base, result, e] = list[Math.floor(rnd() * list.length)];
      crates.push({ x: made === 0 ? 260 : -90, want, base, result, e, state: 'ride', t: 0, wrong: null });
      made += 1;
    }
    function stamp(i) {
      sel = i; slam = 0.18; ctx.sfx.click();
      const c = crates.filter((o) => o.state === 'ride').find((o) => Math.abs(o.x - PRESS) < WIN);
      if (!c) return;
      const s = stamps[i];
      const built = realStamp(c.base, s);
      const jobOk = jobOf(s).name === jobOf(c.want).name;
      if (built || jobOk) {
        c.state = 'done'; c.t = 0; c.used = s;
        if (built) c.result = built;
        ctx.sfx.pickup();
        fx.burst(c.x, BELT_Y - 10, palette.glow, 26); fx.burst(c.x, BELT_Y - 10, '#fff', 10);
        // The lesson suffix counts, and so does any other real word on one of its orders.
        if ((c.want === id && (built || jobOk)) || (s === id && built)) { done += 1; if (done >= need) ctx.win(); }
      } else {
        c.state = 'bad'; c.t = 0; c.wrong = s; miss += 1; ctx.sfx.bad();
        fx.burst(c.x, BELT_Y, '#7dff4a', 14, 180);
        if (miss >= 3) ctx.lose('rot');
      }
    }

    // Test-only: a playtest bot reads state through ctx.debug (the harness never sets it).
    if (ctx.debug) ctx.debug.peek = () => ({ crates, stamps, PRESS, WIN, jobOf });
    return {
      update(dt) {
        slam = Math.max(0, slam - dt);
        spawnIn -= dt;
        if (spawnIn <= 0) { spawn(); spawnIn = 200 / speed + rnd() * 0.4; }
        for (let i = crates.length - 1; i >= 0; i--) {
          const c = crates[i]; c.t += dt;
          if (c.state === 'ride') {
            c.x += speed * dt;
            if (c.x > W - 60) {
              c.state = 'eaten'; c.t = 0; ctx.sfx.rot();
              if (c.want === id) { miss += 1; if (miss >= 3) { ctx.lose('rot'); return; } }
            }
          } else if (c.t > 1) crates.splice(i, 1);
        }
        if (keyIn(input.pressed, ['ArrowLeft', 'a'])) { sel = (sel + stamps.length - 1) % stamps.length; ctx.sfx.tick(); }
        if (keyIn(input.pressed, ['ArrowRight', 'd'])) { sel = (sel + 1) % stamps.length; ctx.sfx.tick(); }
        if (keyIn(input.pressed, [' ', 'ArrowDown', 's'])) stamp(sel);
        for (const t of input.taps) {
          const bw = 170; const x0 = W / 2 - (stamps.length * (bw + 14) - 14) / 2;
          stamps.forEach((_, i) => { const bx = x0 + i * (bw + 14); if (t.x > bx && t.x < bx + bw && t.y > 430 && t.y < 500) stamp(i); });
          if (Math.abs(t.x - PRESS) < 80 && t.y > 110 && t.y < 360) stamp(sel);
        }
      },
      draw(g) {
        const bg = g.createLinearGradient(0, 0, 0, H);
        bg.addColorStop(0, shop.top); bg.addColorStop(1, shop.bottom);
        g.fillStyle = bg; g.fillRect(0, 0, W, H);
        g.globalAlpha = 0.12; for (let i = 0; i < 8; i++) emoji(g, shop.deco, 60 + i * 125, 96 + (i % 2) * 22, 34); g.globalAlpha = 1;
        text(g, shop.name, 20, 130, 14, 'rgba(255,255,255,0.4)', 'left');
        // belt
        g.fillStyle = shop.belt; g.fillRect(0, BELT_Y + 40, W, 26);
        g.fillStyle = 'rgba(0,0,0,0.35)';
        for (let x = -((ctx.t * speed) % 40); x < W; x += 40) g.fillRect(x, BELT_Y + 40, 4, 26);
        for (let x = 20; x < W; x += 80) { g.fillStyle = '#222'; g.beginPath(); g.arc(x, BELT_Y + 76, 9, 0, 7); g.fill(); }
        // the press window
        g.fillStyle = 'rgba(255,225,77,0.1)'; g.fillRect(PRESS - WIN, 150, WIN * 2, 196);
        // crates
        crates.forEach((c) => {
          let x = c.x; let y = BELT_Y; let a = 1; let sc = 1;
          const effect = c.state === 'done' && c.used === id ? id : null;
          if (c.state === 'done') {
            if (effect === 'ed') { x -= c.t * 520; g.filter = 'sepia(1)'; } else if (effect === 'est') sc = 1 + c.t * 0.6;
            else if (effect === 'ing') { x += c.t * 300; y -= Math.abs(Math.sin(c.t * 18)) * 30; } else y -= c.t * 240;
            a = 1 - c.t;
          }
          if (c.state === 'bad') { x += Math.sin(c.t * 50) * 8; a = 1 - c.t; }
          if (c.state === 'eaten') { a = 1 - c.t; sc = 1 - c.t * 0.8; }
          g.globalAlpha = Math.max(0, a);
          g.save(); g.translate(x, y); g.scale(sc, sc);
          // order tag
          const j = jobOf(c.want);
          if (c.state === 'ride') {
            g.fillStyle = 'rgba(0,0,0,0.55)'; g.beginPath(); g.roundRect(-78, -112, 156, 40, 10); g.fill();
            g.strokeStyle = '#ffe14d'; g.lineWidth = 2; g.stroke();
            emoji(g, j.icon, -56, -92, 22); text(g, j.name, 12, -92, j.name.length > 9 ? 13 : 17, '#ffe14d');
            g.fillStyle = 'rgba(0,0,0,0.55)'; g.beginPath(); g.moveTo(-8, -72); g.lineTo(8, -72); g.lineTo(0, -62); g.fill();
          }
          // crate
          g.fillStyle = '#c99a5b'; g.beginPath(); g.roundRect(-80, -50, 160, 90, 12); g.fill();
          g.strokeStyle = '#7a5528'; g.lineWidth = 4; g.stroke();
          if (effect === 'ful') { g.fillStyle = palette.glow; g.fillRect(-76, 36 - Math.min(1, c.t * 3) * 82, 152, Math.min(1, c.t * 3) * 82); }
          const word = c.state === 'done' ? c.result : c.state === 'bad' ? `${c.base}${c.wrong}?` : c.base;
          if (c.e && !(effect === 'less' && c.t > 0.15)) {
            if (effect === 's' || effect === 'es') { emoji(g, c.e, -32, -22, 30); emoji(g, c.e, 0, -22, 30); emoji(g, c.e, 32, -22, 30); } else emoji(g, c.e, 0, -22, 30);
          }
          if (effect === 'less') { g.strokeStyle = 'rgba(255,255,255,0.5)'; g.setLineDash([4, 4]); g.strokeRect(-18, -40, 36, 36); g.setLineDash([]); }
          text(g, word, 0, c.e ? 18 : -4, word.length > 11 ? 18 : 24, c.state === 'bad' ? '#b0003a' : '#2a1606');
          if (effect === 'est') emoji(g, '👑', 0, -66, 30);
          g.restore(); g.filter = 'none'; g.globalAlpha = 1;
          if (c.state === 'eaten') rot(g, c.x, BELT_Y - 10, 34, ctx.t);
        });
        // the press
        const py = 120 + (slam > 0 ? (1 - Math.abs(slam - 0.09) / 0.09) * 90 : 0);
        g.fillStyle = '#555c6a'; g.fillRect(PRESS - 12, 64, 24, py - 64);
        g.fillStyle = '#8a93a6'; g.beginPath(); g.roundRect(PRESS - 66, py, 132, 38, 8); g.fill();
        text(g, `-${label(stamps[sel])}`, PRESS, py + 19, 20, '#111');
        // Rot at the end of the belt
        rot(g, W - 30, BELT_Y + 6, 28, ctx.t);
        // stamp buttons
        const bw = 170; const x0 = W / 2 - (stamps.length * (bw + 14) - 14) / 2;
        stamps.forEach((s, i) => {
          const bx = x0 + i * (bw + 14);
          g.fillStyle = i === sel ? palette.accent : 'rgba(255,255,255,0.1)'; g.beginPath(); g.roundRect(bx, 430, bw, 66, 14); g.fill();
          g.strokeStyle = i === sel ? '#fff' : 'rgba(255,255,255,0.3)'; g.lineWidth = i === sel ? 4 : 2; g.stroke();
          const j = jobOf(s);
          text(g, `-${label(s)}`, bx + bw / 2, 452, 24, '#fff');
          text(g, `${j.icon} ${j.name}`, bx + bw / 2, 480, 12, 'rgba(255,255,255,0.75)', 'center', 400);
        });
        fx.draw(g);
        hud(g, ctx, `Stamp ${need} ${jobOf(id).icon} ${tj} orders with -${ctx.m.text}`, done, need);
        text(g, 'Tap a stamp when the word is in the press · or ◀ ▶ and SPACE', W / 2, H - 36, 14, 'rgba(255,255,255,0.55)', 'center', 400);
        for (let i = 0; i < 3; i++) rot(g, 30 + i * 34, 400, i < miss ? 13 : 5, ctx.t + i);
      },
      destroy() {},
    };
  },
};
