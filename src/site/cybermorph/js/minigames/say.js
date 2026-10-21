/**
 * Say & write (dict, dic, log, logue, phone, phon, aud, onym, script, scrib, scribe, graph, gram).
 *   ear  (dict … aud)            played by ear: the bot says a pattern of notes on the pads,
 *                                and you echo it back. For aud the pads barely light: listen.
 *   hand (script … gram)         played by hand: trace the dotted line from the start dot to the end
 *                                without slipping off. Write-words trace strokes, graph-words drawings.
 *   onym                         trace a drawing, then pick its name.
 */

import { settings } from '../core/settings.js';

// ── Shared bits (each minigame file stands alone) ──────────────────
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const font = (px, w = 700) => `${w} ${px}px Lexend, sans-serif`;
const has = (k, ...names) => names.some((n) => k.has(n));
const axis = (k) => ({ x: has(k, 'ArrowRight', 'd') - has(k, 'ArrowLeft', 'a'), y: has(k, 'ArrowDown', 's') - has(k, 'ArrowUp', 'w') });
function sparks() {
  const ps = [];
  let last = null;
  return {
    burst(x, y, c, n = 18, sp = 260) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * TAU; const v = sp * (0.3 + Math.random() * 0.7);
        ps.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - sp * 0.25, life: 0.45 + Math.random() * 0.4, c, r: 2 + Math.random() * 3.5 });
      }
    },
    draw(g, t) {
      const dt = last == null ? 0 : clamp(t - last, 0, 0.05);
      last = t;
      for (let i = ps.length - 1; i >= 0; i--) {
        const p = ps[i];
        p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 420 * dt;
        if (p.life <= 0) { ps.splice(i, 1); continue; }
        g.globalAlpha = clamp(p.life * 2, 0, 1);
        g.fillStyle = p.c;
        g.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
      }
      g.globalAlpha = 1;
    },
  };
}
/** The Rot: a green, glitchy blob with eyes. */
function rot(g, x, y, r, t, seed = 0) {
  g.save();
  g.translate(x, y);
  const jx = Math.sin(t * 17 + seed * 5) > 0.9 ? Math.sin(t * 91) * r * 0.25 : 0;
  g.fillStyle = 'rgba(90,255,120,0.18)';
  g.beginPath(); g.arc(0, 0, r * 1.35, 0, TAU); g.fill();
  g.beginPath();
  for (let i = 0; i <= 16; i++) {
    const a = (i / 16) * TAU;
    const rr = r * (1 + 0.13 * Math.sin(a * 3 + t * 4 + seed) + 0.07 * Math.sin(a * 5 - t * 7));
    g.lineTo(Math.cos(a) * rr + jx, Math.sin(a) * rr * 0.9);
  }
  g.closePath();
  g.fillStyle = '#39d353';
  g.fill();
  g.fillStyle = 'rgba(8,70,24,0.5)';
  g.fillRect(-r + jx * 2, Math.sin(t * 9 + seed) * r * 0.4, r * 2, r * 0.16);
  for (const s of [-1, 1]) {
    g.fillStyle = '#eafff0';
    g.beginPath(); g.arc(s * r * 0.32, -r * 0.15, r * 0.2, 0, TAU); g.fill();
    g.fillStyle = '#0b2a12';
    g.beginPath(); g.arc(s * r * 0.32 + Math.sin(t * 2 + seed) * r * 0.06, -r * 0.12, r * 0.09, 0, TAU); g.fill();
  }
  g.restore();
}
function tileAt(g, ctx, x, y, h) {
  if (!ctx.tile.ready) return;
  const w = (ctx.tile.width / ctx.tile.height) * h;
  g.drawImage(ctx.tile, x - w / 2, y - h / 2, w, h);
}
function hint(g, text, y = 36, c = '#ffffff') {
  g.font = font(22);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 5;
  g.strokeStyle = 'rgba(0,0,0,0.6)';
  g.strokeText(text, 480, y);
  g.fillStyle = c;
  g.fillText(text, 480, y);
}
function rrect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

const EAR = ['dict', 'dic', 'log', 'logue', 'phone', 'phon', 'aud'];
const modeOf = (id) => (EAR.includes(id) ? 'ear' : id === 'onym' ? 'onym' : 'hand');
const HOW = {
  ear: 'Listen and watch the pads, then tap them back in the same order (or use the arrow keys).',
  aud: 'Listen closely to the notes, then tap the pads back in the same order (or use the arrow keys).',
  hand: 'Press and drag along the dotted line from the start dot to the end without slipping off (or steer with the arrows).',
  onym: 'Trace the dotted shape from the start dot, then tap its name.',
};
const VERB = {
  dict: 'You said it back, beat for beat.', dic: 'You said it back, beat for beat.',
  log: 'You echoed the talk, word for word.', logue: 'You echoed the talk, word for word.',
  phone: 'You echoed every sound.', phon: 'You echoed every sound.', aud: 'You heard it and played it back.',
  script: 'You wrote it out by hand.', scrib: 'You wrote it out by hand.', scribe: 'You wrote it out by hand.',
  graph: 'You drew it, line by line.', gram: 'You drew it, line by line.', onym: 'You traced it and gave it its name.',
};

// A tiny synth for the pads: say-words need real notes, and the shared sfx has none.
let ac = null;
function note(f, dur = 0.28) {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!ac) ac = new AC();
    if (ac.state === 'suspended') ac.resume();
    const t = ac.currentTime;
    const o = ac.createOscillator(); const v = ac.createGain();
    o.type = 'triangle'; o.frequency.setValueAtTime(f, t);
    v.gain.setValueAtTime(0.0001, t);
    v.gain.exponentialRampToValueAtTime(0.25 * (settings.sfx ?? 0.7) + 0.0001, t + 0.01);
    v.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(v).connect(ac.destination);
    o.start(t); o.stop(t + dur + 0.05);
  } catch { /* no audio: the pads still light */ }
}

// ear: echo the pattern.
const PADS = [
  { key: ['ArrowLeft', 'a'], x: 290, y: 310, f: 392, c: '#ff7a59', sym: '▲' },
  { key: ['ArrowUp', 'w'], x: 480, y: 170, f: 523, c: '#ffd36b', sym: '●' },
  { key: ['ArrowRight', 'd'], x: 670, y: 310, f: 659, c: '#5ad1ff', sym: '■' },
  { key: ['ArrowDown', 's'], x: 480, y: 430, f: 784, c: '#b98cff', sym: '◆' },
];
function ear(ctx, fx) {
  const { tier, rnd, input, id } = ctx;
  const pads = PADS.slice(0, [3, 4, 4][tier]);
  const lens = [[2, 3, 3], [3, 4, 5], [4, 5, 6]][tier];
  const gap = [0.62, 0.52, 0.42][tier];
  const dim = id === 'aud' && tier > 0 ? 0.3 : 1;
  const seq = Array.from({ length: 8 }, () => Math.floor(rnd() * pads.length));
  let round = 0; let state = 'wait'; let st = 0; let step = 0; let played = 0; let lit = -1; let litT = 0; let litDim = 1; let bad = -1; let mouth = 0;
  const want = () => seq.slice(0, lens[round]);
  const light = (i, d = 1) => { lit = i; litT = 0.24; litDim = d; note(pads[i].f); };
  const press = (i) => {
    if (state !== 'echo') return;
    light(i);
    if (i === want()[step]) {
      step += 1;
      if (step >= want().length) {
        fx.burst(480, 300, pads[i].c, 22, 280);
        round += 1;
        if (round >= lens.length) { ctx.sfx.good(); ctx.win(); return; }
        state = 'wait'; st = -0.4;
      }
    } else { bad = i; state = 'wait'; st = -0.6; ctx.sfx.bad(); fx.burst(pads[i].x, pads[i].y, '#39d353', 14, 200); }
  };
  return {
    peek: () => ({ state, want: want(), step, pads: pads.map((p) => ({ x: p.x, y: p.y })) }),
    update(dt) {
      st += dt; litT -= dt; mouth = Math.max(0, mouth - dt * 4);
      if (state === 'wait' && st > 0.6) { state = 'play'; st = 0; played = 0; bad = -1; }
      if (state === 'play') {
        if (played < want().length && st >= played * gap) { light(want()[played], dim); mouth = 1; played += 1; }
        if (st > want().length * gap + 0.2) { state = 'echo'; step = 0; st = 0; }
      }
      if (state === 'echo') {
        pads.forEach((p, i) => { if (p.key.some((k) => input.pressed.has(k))) press(i); });
        for (const t of input.taps) {
          const i = pads.findIndex((p) => Math.hypot(t.x - p.x, t.y - p.y) < 74);
          if (i >= 0) press(i);
        }
      }
    },
    draw(g) {
      const t = ctx.t;
      pads.forEach((p, i) => {
        const on = i === lit && litT > 0;
        g.globalAlpha = on ? 0.35 + 0.65 * litDim : 0.35;
        g.fillStyle = p.c;
        g.beginPath(); g.arc(p.x, p.y, on ? 70 : 64, 0, TAU); g.fill();
        g.globalAlpha = 1;
        g.font = font(34); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#0b1020';
        g.fillText(p.sym, p.x, p.y + 2);
        if (i === bad) rot(g, p.x + 40, p.y - 40, 20, t, i);
      });
      // the talking bot in the middle
      g.fillStyle = '#20263a'; rrect(g, 430, 262, 100, 86, 22); g.fill();
      g.strokeStyle = ctx.palette.accent; g.lineWidth = 3; g.stroke();
      tileAt(g, ctx, 480, 286, 24);
      g.fillStyle = '#0b1020'; g.beginPath(); g.ellipse(480, 324, 22, 4 + mouth * 12, 0, 0, TAU); g.fill();
      for (let i = 0; i < lens.length; i++) { g.fillStyle = i < round ? ctx.palette.accent : 'rgba(255,255,255,0.2)'; g.fillRect(860, 120 + i * 30, 50, 18); }
      const msg = state === 'echo' ? `Your turn! Echo it back · ${step} / ${want().length}` : bad >= 0 ? 'Oops! Listen again…' : 'Listen…';
      hint(g, msg);
    },
  };
}

// hand: trace a path, sampled every 5 px.
const SHAPES = {
  zigzag: { name: 'zigzag', pts: [[0, 0.1], [0.25, 0.9], [0.5, 0.3], [0.75, 0.9], [1, 0.1]] },
  scurve: { name: 'S', pts: [
    ...Array.from({ length: 25 }, (_, i) => { const a = -0.15 - (i / 24) * (Math.PI * 1.5 - 0.15); return [0.5 + 0.4 * Math.cos(a), 0.25 + 0.25 * Math.sin(a)]; }),
    ...Array.from({ length: 25 }, (_, i) => { const a = -Math.PI / 2 + (i / 24) * (Math.PI * 1.5 + 0.15); return [0.5 + 0.4 * Math.cos(a), 0.75 + 0.25 * Math.sin(a)]; }),
  ] },
  loops: { name: 'loops', pts: Array.from({ length: 61 }, (_, i) => { const a = (i / 60) * Math.PI * 6; return [i / 60 * 0.8 + 0.1 + Math.sin(a) * 0.08, 0.55 - Math.cos(a) * 0.3 + 0.15]; }) },
  star: { name: 'star', pts: Array.from({ length: 11 }, (_, i) => { const a = -Math.PI / 2 + (i * 4 * Math.PI) / 5; return [0.5 + Math.cos(a) * 0.5, 0.52 + Math.sin(a) * 0.5]; }) },
  house: { name: 'house', pts: [[0.1, 1], [0.1, 0.45], [0.5, 0], [0.9, 0.45], [0.9, 1], [0.1, 1]] },
  wave: { name: 'wave', pts: Array.from({ length: 41 }, (_, i) => [i / 40, 0.5 - Math.sin((i / 40) * Math.PI * 4) * 0.4]) },
  mountain: { name: 'mountains', pts: [[0, 1], [0.25, 0.2], [0.45, 0.65], [0.7, 0.05], [1, 1]] },
  spiral: { name: 'spiral', pts: Array.from({ length: 61 }, (_, i) => { const a = (i / 60) * Math.PI * 5; const r = 0.05 + (i / 60) * 0.45; return [0.5 + Math.cos(a) * r, 0.5 + Math.sin(a) * r]; }) },
  heart: { name: 'heart', pts: Array.from({ length: 49 }, (_, i) => { const a = (i / 48) * Math.PI * 2; return [0.5 + 0.03 * 16 * Math.sin(a) ** 3, 0.45 - 0.03 * (13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a))]; }) },
};
const WRITE = ['zigzag', 'scurve', 'loops'];
const DRAW = ['star', 'house', 'wave', 'mountain', 'spiral', 'heart'];
const BOX = { x: 280, y: 110, w: 400, h: 320 };

function samples(shape) {
  const pts = shape.pts.map(([x, y]) => ({ x: BOX.x + x * BOX.w, y: BOX.y + y * BOX.h }));
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]; const b = pts[i]; const n = Math.max(1, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / 5));
    for (let k = 1; k <= n; k++) out.push({ x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n });
  }
  return out;
}

function hand(ctx, fx, naming) {
  const { tier, rnd, input, id } = ctx;
  const pool = [...(['script', 'scrib', 'scribe'].includes(id) ? WRITE : DRAW)].sort(() => rnd() - 0.5);
  const count = naming ? [1, 2, 2][tier] : [1, 2, 3][tier];
  const order = pool.slice(0, count);
  const tol = [42, 30, 22][tier];
  const blobs = Array.from({ length: [0, 1, 2][tier] }, (_, i) => ({ x: 150 + i * 660, y: 120 + rnd() * 300, vx: (i ? -1 : 1) * [0, 70, 100][tier], vy: [0, 55, 80][tier] }));
  let shapeI = 0; let path = samples(SHAPES[order[0]]); let p = 0; let pen = null; let slip = 0; let done = 0; let naming_ = null; let sel = 0;
  const ink = [];
  const finishShape = () => {
    fx.burst(path[path.length - 1].x, path[path.length - 1].y, ctx.palette.accent, 26, 300);
    if (naming) {
      const names = [SHAPES[order[shapeI]].name, ...DRAW.filter((k) => k !== order[shapeI]).sort(() => rnd() - 0.5).slice(0, 2).map((k) => SHAPES[k].name)].sort(() => rnd() - 0.5);
      naming_ = { names, right: names.indexOf(SHAPES[order[shapeI]].name), wrong: -1 };
      ctx.sfx.pickup();
    } else nextShape();
  };
  const nextShape = () => {
    shapeI += 1;
    if (shapeI >= order.length) { ctx.sfx.good(); ctx.win(); return; }
    ctx.sfx.pickup();
    path = samples(SHAPES[order[shapeI]]); p = 0; pen = null; done = 0.5; naming_ = null; ink.length = 0;
  };
  const tagX = (i) => 300 + i * 180;
  return {
    peek: () => ({ path, p, pen, tol, naming: naming_ && { right: naming_.right, x: tagX(naming_.right) }, blobs: blobs.map((b) => ({ x: b.x, y: b.y })) }),
    update(dt) {
      slip -= dt; done -= dt;
      for (const b of blobs) {
        b.x += b.vx * dt; b.y += b.vy * dt;
        if (b.x < 120 || b.x > 840) b.vx *= -1;
        if (b.y < 100 || b.y > 470) b.vy *= -1;
      }
      if (naming_) {
        const k = input.pressed;
        if (k.has('ArrowLeft') || k.has('a')) sel = Math.max(0, sel - 1);
        if (k.has('ArrowRight') || k.has('d')) sel = Math.min(2, sel + 1);
        let choice = k.has(' ') ? sel : -1;
        for (const t of input.taps) { const i = [0, 1, 2].find((j) => Math.abs(t.x - tagX(j)) < 80 && Math.abs(t.y - 480) < 34); if (i != null) { sel = i; choice = i; } }
        if (choice >= 0) {
          if (choice === naming_.right) nextShape();
          else { naming_.wrong = choice; ctx.sfx.bad(); }
        }
        return;
      }
      const a = axis(input.keys);
      let down = false;
      if (a.x || a.y) {
        if (!pen) pen = { ...path[p] };
        pen.x = clamp(pen.x + a.x * 230 * dt, 0, 960); pen.y = clamp(pen.y + a.y * 230 * dt, 0, 540); down = true;
      } else if (input.down) { pen = { x: input.x, y: input.y }; down = true; }
      if (!down || !pen) return;
      for (const b of blobs) {
        if (slip <= 0 && Math.hypot(pen.x - b.x, pen.y - b.y) < 34) { slip = 0.8; p = Math.max(0, p - 24); ink.length = Math.min(ink.length, p); fx.burst(pen.x, pen.y, '#39d353', 12, 180); ctx.sfx.bad(); }
      }
      // progress follows the pen: the nearest sample just ahead, if the pen is on the line
      let best = -1; let bd = tol;
      for (let i = p; i < Math.min(path.length, p + 12); i++) { const d = Math.hypot(pen.x - path[i].x, pen.y - path[i].y); if (d < bd) { bd = d; best = i; } }
      if (best >= p) { p = best; ink.length = p + 1; }
      else if (p > 0 && slip <= 0 && Math.hypot(pen.x - path[p].x, pen.y - path[p].y) > tol * 2.2) {
        slip = 0.6; p = Math.max(0, p - 12); ink.length = p + 1; ctx.sfx.bad();
        if (a.x || a.y) pen = { ...path[p] };
      }
      if (p >= path.length - 3) finishShape();
    },
    draw(g) {
      const t = ctx.t;
      g.fillStyle = '#f4f2ea'; g.globalAlpha = 0.06; rrect(g, BOX.x - 40, BOX.y - 30, BOX.w + 80, BOX.h + 60, 20); g.fill(); g.globalAlpha = 1;
      g.lineCap = 'round'; g.lineJoin = 'round';
      g.setLineDash([4, 14]); g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 10;
      g.beginPath(); path.forEach((q, i) => (i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y))); g.stroke();
      g.setLineDash([]);
      g.strokeStyle = 'rgba(255,255,255,0.08)'; g.lineWidth = tol * 2;
      g.beginPath(); path.forEach((q, i) => (i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y))); g.stroke();
      if (p > 0) {
        g.strokeStyle = ctx.palette.accent; g.lineWidth = 12;
        g.beginPath(); for (let i = 0; i <= p; i++) (i ? g.lineTo(path[i].x, path[i].y) : g.moveTo(path[i].x, path[i].y)); g.stroke();
      }
      g.lineCap = 'butt';
      const s = path[0]; const e = path[path.length - 1];
      g.fillStyle = '#7dffa0'; g.beginPath(); g.arc(s.x, s.y, 16 + Math.sin(t * 6) * 3, 0, TAU); g.fill();
      g.font = font(16); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#0b1020'; g.fillText('GO', s.x, s.y + 1);
      g.strokeStyle = '#ffffff'; g.lineWidth = 3; g.beginPath(); g.arc(e.x, e.y, 14, 0, TAU); g.stroke();
      for (const b of blobs) rot(g, b.x, b.y, 22, t, b.x);
      if (pen) { g.fillStyle = slip > 0 ? '#ff5b6b' : '#ffffff'; g.beginPath(); g.arc(pen.x, pen.y, 9, 0, TAU); g.fill(); }
      if (naming_) {
        naming_.names.forEach((nm, i) => {
          g.fillStyle = i === naming_.wrong ? '#5a2030' : i === sel ? ctx.palette.accent : '#2a2f45';
          rrect(g, tagX(i) - 78, 450, 156, 60, 14); g.fill();
          g.font = font(22); g.fillStyle = i === sel && i !== naming_.wrong ? '#0b1020' : '#fff'; g.fillText(nm, tagX(i), 481);
        });
      }
      tileAt(g, ctx, 90, 470, 34);
      g.font = font(18); g.textAlign = 'right'; g.fillStyle = '#fff'; g.fillText(`${shapeI + (naming_ ? 1 : 0)} / ${order.length}`, 920, 470);
      hint(g, naming_ ? 'What is it called? Tap its NAME' : slip > 0 ? 'Slipped! Get back on the line' : naming ? 'TRACE the shape from GO' : ['script', 'scrib', 'scribe'].includes(id) ? 'WRITE it: trace from GO to the end' : 'DRAW it: trace from GO to the end');
    },
  };
}

export default {
  seconds: 30,
  howTo: (m) => (m.id === 'aud' ? HOW.aud : HOW[modeOf(m.id)]),
  verb: (m) => VERB[m.id] || 'You echoed it.',
  start(ctx) {
    const fx = sparks();
    const mode = modeOf(ctx.id);
    const game = mode === 'ear' ? ear(ctx, fx) : hand(ctx, fx, mode === 'onym');
    return {
      peek: game.peek,
      update: (dt) => game.update(Math.min(dt, 0.05)),
      draw(g) { game.draw(g); fx.draw(g, ctx.t); },
      destroy() {},
    };
  },
};
