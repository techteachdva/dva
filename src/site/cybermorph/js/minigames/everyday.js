/**
 * Everyday base (everyday): the Anglo-Saxon free bases students already know. A quick catch:
 * the word's picture flies by among pictures of its neighbors, and you grab it. Abstract words
 * (whelm, lone, tire, truth…) carry a short text clue under their picture.
 * Each sub is its own scene with its own motion, so no two levels look alike:
 * nature = sky (drift across), place = map road (ride a winding road), people = playground
 * (bounce), things = toybox (pop up), moves = race lanes (run), doing = workshop wheel (spin),
 * feelings = bubbles (float up), describer = carnival gallery (slide in rows).
 */

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

// ── every base's picture: e = emoji, c = a text clue for words a picture can't say alone ──
const PIC = {
  sun: { e: '☀️' }, rain: { e: '🌧️' }, wind: { e: '🌬️' }, snow: { e: '❄️' }, fire: { e: '🔥' }, water: { e: '💧' },
  light: { e: '💡' }, dark: { e: '🌑' }, shine: { e: '✨' }, star: { e: '⭐' }, night: { e: '🌙' }, day: { e: '📅', c: '24 hours' },
  noon: { e: '🕛', c: 'middle of the day' }, earth: { e: '🌍' }, sea: { e: '🌊' }, shell: { e: '🐚' },
  quake: { e: '🏚️', c: 'the ground shakes' }, bee: { e: '🐝' }, hive: { e: '🍯', c: 'a home for bees' }, afish: { e: '🐟' },
  way: { e: '🛤️', c: 'a path to go' }, side: { e: '👈', c: 'an edge' }, back: { e: '🔙' }, down: { e: '⬇️' }, top: { e: '🔝' },
  end: { e: '🔚' }, after: { e: '⏭️', c: 'later' }, week: { e: '📆', c: 'seven days' }, east: { e: '🌅', c: 'the sun rises here' },
  west: { e: '🌇', c: 'the sun sets here' },
  hand: { e: '✋' }, foot: { e: '🦶' }, tooth: { e: '🦷' }, heart: { e: '❤️' }, lap: { e: '🪑', c: 'top of your legs when you sit' },
  child: { e: '🧒' }, king: { e: '🤴' }, man: { e: '👨' }, friend: { e: '🤝' }, neighbor: { e: '🏘️', c: 'lives next door' },
  home: { e: '🏡', c: 'where you live' }, house: { e: '🏠' }, bed: { e: '🛏️' }, room: { e: '🚪' }, book: { e: '📕' }, key: { e: '🔑' },
  board: { e: '🛹' }, wall: { e: '🧱' }, net: { e: '🥅' }, box: { e: '📦' }, dish: { e: '🍽️' }, butter: { e: '🧈' },
  brush: { e: '🖌️' }, ball: { e: '⚽' }, bow: { e: '🎀' }, load: { e: '🚚', c: 'something carried' },
  craft: { e: '🧶', c: 'made by hand' }, word: { e: '🔤' },
  run: { e: '🏃' }, stop: { e: '🛑' }, stand: { e: '🧍' }, hop: { e: '🐇' }, swim: { e: '🏊' }, fly: { e: '✈️' }, fall: { e: '🍂' },
  kick: { e: '🦵', c: 'hit with your foot' }, jump: { e: '🦘' }, walk: { e: '🚶' }, set: { e: '📍', c: 'put it down' }, hold: { e: '🤲' },
  draw: { e: '✏️' }, whelm: { e: '🌊', c: 'covered right over' },
  help: { e: '🤝' }, play: { e: '🎮' }, sleep: { e: '😴' }, rest: { e: '🛋️' }, read: { e: '📖' }, see: { e: '👀' }, work: { e: '💼' },
  teach: { e: '👩‍🏫' }, learn: { e: '🎓' }, speak: { e: '🗣️' }, talk: { e: '💬' }, think: { e: '🤔' },
  dream: { e: '💭', c: 'pictures while you sleep' }, build: { e: '🏗️' }, make: { e: '🛠️' }, bake: { e: '🧁' }, sing: { e: '🎤' },
  shop: { e: '🛒' }, write: { e: '📝' }, thank: { e: '🙏' }, wish: { e: '🌠' }, tire: { e: '🥱', c: 'so weary' },
  kind: { e: '🤗' }, care: { e: '🩹', c: 'look after' }, hope: { e: '🤞' }, fear: { e: '😨' }, love: { e: '💖' },
  awe: { e: '😮', c: 'wonder and respect' }, wonder: { e: '🤩' }, joy: { e: '🥳' }, happy: { e: '😊' }, sweet: { e: '🍬' },
  mind: { e: '🧠' }, truth: { e: '✅', c: 'what is true' }, free: { e: '🕊️' }, fair: { e: '⚖️' }, lone: { e: '🌵', c: 'by itself' },
  big: { e: '🐘' }, quick: { e: '⚡' }, slow: { e: '🐢' }, bright: { e: '🔆' }, cold: { e: '🥶' }, warm: { e: '☕' }, soft: { e: '🧸' },
  loud: { e: '📢' }, clever: { e: '🦉' }, young: { e: '👶' }, strong: { e: '💪' }, weak: { e: '🥀', c: 'not strong' },
  black: { e: '⬛' }, wild: { e: '🦁' },
};
const MEMBERS = {
  nature: ['sun', 'rain', 'wind', 'snow', 'fire', 'water', 'light', 'dark', 'shine', 'star', 'night', 'day', 'noon', 'earth', 'sea', 'shell', 'quake', 'bee', 'hive', 'afish'],
  place: ['way', 'side', 'back', 'down', 'top', 'end', 'after', 'week', 'east', 'west'],
  people: ['hand', 'foot', 'tooth', 'heart', 'lap', 'child', 'king', 'man', 'friend', 'neighbor'],
  things: ['home', 'house', 'bed', 'room', 'book', 'key', 'board', 'wall', 'net', 'box', 'dish', 'butter', 'brush', 'ball', 'bow', 'load', 'craft', 'word'],
  moves: ['run', 'stop', 'stand', 'hop', 'swim', 'fly', 'fall', 'kick', 'jump', 'walk', 'set', 'hold', 'draw', 'whelm'],
  doing: ['help', 'play', 'sleep', 'rest', 'read', 'see', 'work', 'teach', 'learn', 'speak', 'talk', 'think', 'dream', 'build', 'make', 'bake', 'sing', 'shop', 'write', 'thank', 'wish', 'tire'],
  feelings: ['kind', 'care', 'hope', 'fear', 'love', 'awe', 'wonder', 'joy', 'happy', 'sweet', 'mind', 'truth', 'free', 'fair', 'lone'],
  describer: ['big', 'quick', 'slow', 'bright', 'cold', 'warm', 'soft', 'loud', 'clever', 'young', 'strong', 'weak', 'black', 'wild'],
};
const SCENE = {
  nature: { name: 'the sky', verb: 'flew by' }, place: { name: 'the map road', verb: 'rode by' },
  people: { name: 'the playground', verb: 'bounced by' }, things: { name: 'the toybox', verb: 'popped up' },
  moves: { name: 'the race track', verb: 'ran by' }, doing: { name: 'the workshop wheel', verb: 'spun by' },
  feelings: { name: 'the bubbles', verb: 'floated by' }, describer: { name: 'the carnival', verb: 'slid by' },
};
const subOf = (id, sub) => sub || Object.keys(MEMBERS).find((k) => MEMBERS[k].includes(id)) || 'nature';

/**
 * "help" gets its own scene, because help is something you do for someone: a kitten is stuck
 * up a tree, and you stack a ladder for it, piece by piece. Tap or SPACE drops the sliding piece;
 * it has to land on the one below. Three pieces dropped wide and the Rot wins.
 */
function helpCat(ctx) {
  const { W, rnd, tier, palette } = ctx;
  const fx = makeFx(ctx);
  const need = [3, 4, 5][tier];
  const tol = [42, 30, 20][tier];
  const speed = [260, 340, 430][tier];
  const SEG = 62;
  const baseX = 560;
  const ground = 480;
  const stack = [];
  let miss = 0;
  let slide = { x: 120, dir: 1 };
  let falling = null;
  let rescue = -1;
  const catY = ground - need * SEG - 22;
  const meowAt = [1.5];
  const drop = () => {
    if (falling || rescue >= 0) return;
    const prevX = stack.length ? stack[stack.length - 1] : baseX;
    if (Math.abs(slide.x - prevX) <= tol) {
      stack.push(prevX + (slide.x - prevX) * 0.3);
      ctx.sfx.tick();
      fx.burst(slide.x, ground - stack.length * SEG + SEG / 2, palette.glow, 12, 160);
      if (stack.length >= need) { rescue = 0; ctx.sfx.pickup(); }
    } else {
      falling = { x: slide.x, y: ground - (stack.length + 1) * SEG, vy: 0 };
      miss += 1;
      ctx.sfx.bad();
      if (miss >= 3) ctx.lose('rot');
    }
    slide = { x: rnd() < 0.5 ? 120 : W - 120, dir: rnd() < 0.5 ? 1 : -1 };
  };
  const ladder = (g, x, y) => {
    g.strokeStyle = '#c98a3e'; g.lineWidth = 7; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x - 28, y); g.lineTo(x - 28, y + SEG); g.moveTo(x + 28, y); g.lineTo(x + 28, y + SEG); g.stroke();
    g.lineWidth = 5;
    g.beginPath(); for (let k = 1; k <= 3; k++) { g.moveTo(x - 28, y + (k * SEG) / 4); g.lineTo(x + 28, y + (k * SEG) / 4); } g.stroke();
  };
  return {
    update(dt) {
      const inp = ctx.input;
      if (inp.taps.length || inp.pressed.has(' ') || inp.pressed.has('ArrowDown')) drop();
      if (rescue >= 0) {
        rescue += dt;
        if (rescue > 1.6) { fx.burst(baseX, ground - 30, '#fff', 30); ctx.win(); }
        return;
      }
      slide.x += slide.dir * speed * dt;
      if (slide.x > W - 90 || slide.x < 90) slide.dir *= -1;
      if (falling) { falling.vy += 1400 * dt; falling.y += falling.vy * dt; if (falling.y > ctx.H) falling = null; }
      if (ctx.t > meowAt[0]) { meowAt[0] = ctx.t + 2.5 + rnd() * 2; }
    },
    draw(g) {
      // Sky, grass, and the tree with its long branch.
      const sky = g.createLinearGradient(0, 0, 0, ground);
      sky.addColorStop(0, '#2b4c8c'); sky.addColorStop(1, '#7fb2e5');
      g.fillStyle = sky; g.fillRect(0, 0, W, ground);
      g.fillStyle = '#3f8f3a'; g.fillRect(0, ground, W, ctx.H - ground);
      g.fillStyle = '#6b4423'; g.fillRect(720, 120, 70, ground - 120);
      g.fillRect(560, catY + 26, 200, 18);
      g.fillStyle = '#2f7a35';
      [[755, 110, 110], [670, 150, 80], [830, 170, 80], [700, 70, 70], [800, 60, 70]].forEach(([x, y, r]) => { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); });
      // The ladder so far.
      stack.forEach((x, i) => ladder(g, x, ground - (i + 1) * SEG));
      if (falling) ladder(g, falling.x, falling.y);
      // The kitten: on the branch, or climbing down the finished ladder.
      let cy = catY;
      let cx = baseX;
      if (rescue >= 0) { const k = Math.min(1, rescue / 1.4); cy = catY + (ground - 40 - catY) * k; cx = (stack[Math.min(stack.length - 1, Math.floor((1 - k) * stack.length))] || baseX); }
      emoji(g, '🐱', cx, cy, 52);
      if (rescue < 0 && ctx.t < meowAt[0] - 1.6) text(g, 'meow?', cx + 60, cy - 30, 20, '#fff');
      if (rescue >= 0 && rescue > 1.2) emoji(g, '💛', cx + 40, cy - 40, 34);
      // The sliding ladder piece and a guide line where it must land.
      if (rescue < 0) {
        const top = ground - (stack.length + 1) * SEG;
        const prevX = stack.length ? stack[stack.length - 1] : baseX;
        g.setLineDash([8, 8]); g.strokeStyle = 'rgba(255,255,255,0.45)'; g.lineWidth = 2;
        g.strokeRect(prevX - 34, top, 68, SEG); g.setLineDash([]);
        ladder(g, slide.x, top - 4);
        rot(g, slide.x + (slide.dir > 0 ? -70 : 70), top + 20, 16, ctx.t);
      }
      hud(g, ctx, rescue >= 0 ? 'The kitten is climbing down!' : 'Stack the ladder: tap or SPACE when the piece is over the last one', stack.length, need);
      // Three tries: a dot goes dark for each piece dropped wide.
      for (let i = 0; i < 3; i++) {
        g.beginPath(); g.arc(30 + i * 30, 520, 10, 0, 7);
        g.fillStyle = i < miss ? '#7dff4a' : '#c98a3e'; g.fill();
      }
      fx.draw(g);
    },
  };
}

export default {
  seconds: 20,
  howTo(m, sub) {
    if (m.id === 'help') return 'Help the kitten down! Tap or press SPACE to drop each ladder piece right on top of the last one.';
    return `Grab the picture of “${m.text}” when it comes by in ${SCENE[subOf(m.id, sub)].name}. Skip the others!`;
  },
  verb(m, sub) {
    if (m.id === 'help') return 'You helped the kitten down the tree.';
    return `You caught “${m.text}” as it ${SCENE[subOf(m.id, sub)].verb}.`;
  },
  start(ctx) {
    if (ctx.id === 'help') return helpCat(ctx);
    const { W, H, rnd, tier, palette, input } = ctx;
    const fx = makeFx(ctx);
    const sub = subOf(ctx.id, ctx.sub);
    const pool = MEMBERS[sub].filter((id) => id !== ctx.id && PIC[id]);
    const need = [2, 3, 4][tier];
    const sp = [0.75, 1, 1.35][tier];
    const every = [1.0, 0.78, 0.58][tier];
    const R = 44;
    let done = 0; let miss = 0; let spawnIn = 0.2; let sinceTarget = 0; let kbd = false;
    const net = { x: W / 2, y: 300 };
    const items = [];
    const rotty = { x: W / 2, y: 140, vx: 90, vy: 60 };
    let nSpawn = 0;

    function spawn() {
      const isT = sinceTarget >= 2 || rnd() < 0.34;
      sinceTarget = isT ? 0 : sinceTarget + 1;
      const id = isT ? ctx.id : pool[Math.floor(rnd() * pool.length)];
      const it = { id, pic: PIC[id] || { e: '❓', c: id }, t: 0, alive: true, target: isT, x: 0, y: 0, vx: 0, vy: 0, k: nSpawn++ };
      const dir = it.k % 2 ? 1 : -1;
      if (sub === 'nature') { it.x = W + 60; it.y = 130 + rnd() * 300; it.vx = -(170 + rnd() * 60) * sp; it.ph = rnd() * 6; }
      if (sub === 'place') { it.x = -60; it.ph = rnd() < 0.5 ? 0 : Math.PI; it.vx = (150 + rnd() * 40) * sp; }
      if (sub === 'people') { it.x = -50; it.y = 440; it.vx = (190 + rnd() * 60) * sp; it.vy = -(380 + rnd() * 160); }
      if (sub === 'things') { it.box = Math.floor(rnd() * 4); it.x = 180 + it.box * 200; it.y = 470; it.vy = -(560 + rnd() * 140) * Math.sqrt(sp); }
      if (sub === 'moves') { it.lane = it.k % 3; it.y = 190 + it.lane * 110; it.vx = (it.lane % 2 ? -1 : 1) * (230 + rnd() * 80) * sp; it.x = it.vx > 0 ? -60 : W + 60; }
      if (sub === 'doing') { it.a = -Math.PI / 2 + dir * 0.2; it.life = 3.4 / sp; }
      if (sub === 'feelings') { it.x = 90 + rnd() * (W - 180); it.y = H + 50; it.vy = -(110 + rnd() * 50) * sp; it.ph = rnd() * 6; }
      if (sub === 'describer') { it.row = it.k % 2; it.y = it.row ? 380 : 220; it.vx = (it.row ? -1 : 1) * 200 * sp; it.x = it.vx > 0 ? -60 : W + 60; }
      items.push(it);
    }
    function move(it, dt) {
      it.t += dt;
      if (sub === 'nature') { it.x += it.vx * dt; it.y += Math.sin(ctx.t * 2 + it.ph) * 30 * dt; }
      if (sub === 'place') { it.x += it.vx * dt; it.y = road(it.x, it.ph); }
      if (sub === 'people') { it.x += it.vx * dt; it.vy += 900 * dt; it.y += it.vy * dt; if (it.y > 440) { it.y = 440; it.vy = -(420 + (it.k % 3) * 60); } }
      if (sub === 'things') { it.vy += 700 * sp * dt; it.y += it.vy * dt; if (it.vy > 0 && it.y > 480) it.alive = false; }
      if (sub === 'moves' || sub === 'describer') it.x += it.vx * dt;
      if (sub === 'doing') { it.a += 1.1 * sp * dt; it.x = W / 2 + Math.cos(it.a) * 200; it.y = 300 + Math.sin(it.a) * 165; if (it.t > it.life) it.alive = false; }
      if (sub === 'feelings') { it.y += it.vy * dt; it.x += Math.sin(ctx.t * 2 + it.ph) * 40 * dt; }
      if (it.x < -100 || it.x > W + 100 || it.y < -80) it.alive = false;
    }
    const road = (x, ph) => 300 + Math.sin(x / 140 + ph) * 110;
    function grab(x, y) {
      let best = null; let bd = R + 16;
      items.forEach((it) => { if (!it.alive || it.got) return; const d = Math.hypot(it.x - x, it.y - y); if (d < bd) { bd = d; best = it; } });
      if (!best) return;
      if (best.target) {
        best.got = true; best.alive = false; done += 1; ctx.sfx.pickup();
        fx.burst(best.x, best.y, palette.glow, 30); fx.burst(best.x, best.y, '#fff', 12);
        if (done >= need) ctx.win();
      } else {
        best.shake = 1; miss += 1; ctx.sfx.bad(); fx.burst(best.x, best.y, '#7dff4a', 10, 150);
        best.alive = false;
        if (miss >= 3) ctx.lose('rot');
      }
    }

    function drawScene(g) {
      if (sub === 'nature') {
        const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#4fb3ff'); bg.addColorStop(1, '#bfe6ff');
        g.fillStyle = bg; g.fillRect(0, 0, W, H);
        for (let i = 0; i < 5; i++) { const x = ((i * 230 - ctx.t * 20) % (W + 200) + W + 200) % (W + 200) - 100; g.fillStyle = 'rgba(255,255,255,0.8)'; g.beginPath(); g.ellipse(x, 110 + (i % 3) * 120, 70, 24, 0, 0, 7); g.ellipse(x + 40, 100 + (i % 3) * 120, 40, 22, 0, 0, 7); g.fill(); }
        g.fillStyle = '#5bbf5b'; g.fillRect(0, H - 40, W, 40);
      } else if (sub === 'place') {
        g.fillStyle = '#7cc46b'; g.fillRect(0, 0, W, H);
        g.fillStyle = 'rgba(0,0,0,0.06)'; for (let i = 0; i < 30; i++) g.fillRect((i * 137) % W, 70 + (i * 83) % (H - 70), 30, 30);
        [0, Math.PI].forEach((ph) => { g.strokeStyle = '#6b6b6b'; g.lineWidth = 64; g.beginPath(); for (let x = -20; x <= W + 20; x += 10) { const y = road(x, ph); if (x === -20) g.moveTo(x, y); else g.lineTo(x, y); } g.stroke(); g.strokeStyle = '#ffe14d'; g.lineWidth = 3; g.setLineDash([16, 14]); g.stroke(); g.setLineDash([]); });
        emoji(g, '🧭', W - 60, 110, 40);
      } else if (sub === 'people') {
        const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#ffd59a'); bg.addColorStop(1, '#ffeacc'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
        g.fillStyle = '#4caf50'; g.fillRect(0, 470, W, H - 470);
        g.globalAlpha = 0.5; emoji(g, '🎠', 120, 420, 90); emoji(g, '🌳', 840, 400, 120); g.globalAlpha = 1;
      } else if (sub === 'things') {
        g.fillStyle = '#ffe6f2'; g.fillRect(0, 0, W, H);
        g.fillStyle = 'rgba(255,120,180,0.12)'; for (let x = 0; x < W; x += 60) g.fillRect(x, 0, 30, H);
      } else if (sub === 'moves') {
        g.fillStyle = '#c0442c'; g.fillRect(0, 0, W, H);
        for (let i = 0; i < 4; i++) { g.fillStyle = '#fff'; g.fillRect(0, 135 + i * 110, W, 4); }
        g.fillStyle = 'rgba(255,255,255,0.12)'; for (let x = 0; x < W; x += 80) g.fillRect(x, 64, 40, 60);
      } else if (sub === 'doing') {
        g.fillStyle = '#26303c'; g.fillRect(0, 0, W, H);
        g.save(); g.translate(W / 2, 300); g.rotate(ctx.t * 0.5);
        g.strokeStyle = '#5a6a7c'; g.lineWidth = 14; g.beginPath(); g.ellipse(0, 0, 200, 165, 0, 0, 7); g.stroke();
        for (let i = 0; i < 8; i++) { g.rotate(Math.PI / 4); g.fillStyle = '#5a6a7c'; g.fillRect(-4, 0, 8, 150); }
        g.restore(); emoji(g, '⚙️', W / 2, 300, 60);
      } else if (sub === 'feelings') {
        const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#ffb3d9'); bg.addColorStop(1, '#b39dff'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
      } else {
        g.fillStyle = '#2b1640'; g.fillRect(0, 0, W, H);
        for (let x = 0; x < W; x += 80) { g.fillStyle = (x / 80) % 2 ? '#e53950' : '#fff'; g.beginPath(); g.moveTo(x, 64); g.lineTo(x + 80, 64); g.lineTo(x + 40, 110); g.fill(); }
        [220, 380].forEach((y) => { g.fillStyle = '#7a4a1c'; g.fillRect(0, y + 44, W, 12); });
      }
    }
    function drawItem(g, it) {
      const sx = it.shake ? Math.sin(ctx.t * 50) * 5 : 0;
      const qx = it.id === 'quake' ? Math.sin(ctx.t * 60) * 3 : 0;
      g.fillStyle = sub === 'feelings' ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.85)';
      g.beginPath(); g.arc(it.x + sx, it.y, R, 0, 7); g.fill();
      if (sub === 'feelings') { g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 3; g.stroke(); }
      emoji(g, it.pic.e, it.x + sx + qx, it.y + (it.pic.c ? -6 : 2), it.pic.c ? 40 : 50);
      if (it.pic.c) {
        g.font = font(13); const w = g.measureText(it.pic.c).width + 14;
        g.fillStyle = '#1b1b2a'; g.beginPath(); g.roundRect(it.x - w / 2, it.y + 22, w, 22, 8); g.fill();
        text(g, it.pic.c, it.x, it.y + 33, 13, '#fff');
      }
    }

    // Test-only: a playtest bot reads state through ctx.debug (the harness never sets it).
    if (ctx.debug) ctx.debug.peek = () => ({ items });
    return {
      update(dt) {
        spawnIn -= dt;
        if (spawnIn <= 0) { spawn(); spawnIn = every * (0.8 + rnd() * 0.4); }
        items.forEach((it) => move(it, dt));
        for (let i = items.length - 1; i >= 0; i--) if (!items[i].alive) items.splice(i, 1);
        // the Rot drifts about and gobbles the right picture if it reaches it first
        if (tier > 0) {
          rotty.x += rotty.vx * dt * tier; rotty.y += rotty.vy * dt * tier;
          if (rotty.x < 60 || rotty.x > W - 60) rotty.vx *= -1;
          if (rotty.y < 110 || rotty.y > H - 60) rotty.vy *= -1;
          items.forEach((it) => { if (it.target && Math.hypot(it.x - rotty.x, it.y - rotty.y) < R + 20) { it.alive = false; ctx.sfx.rot(); fx.burst(it.x, it.y, '#7dff4a', 12, 150); } });
        }
        // net: arrows move it, SPACE grabs; taps grab where you tap
        const dx = (keyIn(input.keys, ['ArrowRight', 'd']) ? 1 : 0) - (keyIn(input.keys, ['ArrowLeft', 'a']) ? 1 : 0);
        const dy = (keyIn(input.keys, ['ArrowDown', 's']) ? 1 : 0) - (keyIn(input.keys, ['ArrowUp', 'w']) ? 1 : 0);
        if (dx || dy) { kbd = true; net.x = Math.max(40, Math.min(W - 40, net.x + dx * 560 * dt)); net.y = Math.max(100, Math.min(H - 40, net.y + dy * 560 * dt)); }
        if (input.pressed.has(' ')) { kbd = true; grab(net.x, net.y); }
        for (const t of input.taps) { kbd = false; grab(t.x, t.y); }
      },
      draw(g) {
        drawScene(g);
        items.forEach((it) => drawItem(g, it)); // toyboxes go on top so pictures pop out of them
        if (sub === 'things') {
          for (let b = 0; b < 4; b++) {
            const x = 180 + b * 200;
            g.fillStyle = ['#ff6b6b', '#4dabf7', '#ffd43b', '#69db7c'][b]; g.fillRect(x - 70, 460, 140, 80);
            g.fillStyle = 'rgba(0,0,0,0.15)'; g.fillRect(x - 70, 460, 140, 12);
            emoji(g, '⭐', x, 505, 24);
          }
        }
        if (tier > 0) rot(g, rotty.x, rotty.y, 24, ctx.t);
        if (kbd) {
          g.strokeStyle = '#ffe14d'; g.lineWidth = 4; g.beginPath(); g.arc(net.x, net.y, R + 10, 0, 7); g.stroke();
          g.beginPath(); g.moveTo(net.x - 10, net.y); g.lineTo(net.x + 10, net.y); g.moveTo(net.x, net.y - 10); g.lineTo(net.x, net.y + 10); g.stroke();
        }
        fx.draw(g);
        hud(g, ctx, `Catch “${ctx.m.text}”!`, done, need);
        g.fillStyle = 'rgba(0,0,0,0.45)'; g.beginPath(); g.roundRect(W / 2 - 220, H - 50, 440, 30, 10); g.fill();
        text(g, 'Tap its picture · or arrows and SPACE', W / 2, H - 35, 15, '#fff', 'center', 400);
        for (let i = 0; i < 3; i++) rot(g, 30 + i * 34, H - 36, i < miss ? 13 : 5, ctx.t + i);
      },
      destroy() {},
    };
  },
};
