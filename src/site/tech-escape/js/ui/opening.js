/**
 * Phosphor oscilloscope that plays on top of the lab.
 *
 * The 3D game keeps the vendored WebGL renderer. This file only draws a 2D
 * canvas during boot: a scope trace, then the same light gathered into the
 * words TECH ESCAPE 3, then dust that settles on the terminal prompt.
 * BootSequence types the lines. The lobby is the same monitor after that.
 */

const PHASES = ['scope', 'scopeHold', 'form', 'hold', 'rest', 'collapse', 'settle'];

const SHAPE_SIDES = [1, 2, 3, 4, 5, 6, 8, 10];

function shapeLoop(sides, count, radius) {
  const out = new Array(count);
  if (sides <= 1) {
    for (let i = 0; i < count; i++) out[i] = { x: 0, y: 0 };
    return out;
  }
  if (sides === 2) {
    for (let i = 0; i < count; i++) {
      const u = i / (count - 1);
      out[i] = { x: (u * 2 - 1) * radius, y: 0 };
    }
    return out;
  }
  const verts = [];
  for (let i = 0; i < sides; i++) {
    const a = -Math.PI / 2 + (i / sides) * Math.PI * 2;
    verts.push({ x: Math.cos(a) * radius, y: Math.sin(a) * radius });
  }
  for (let i = 0; i < count; i++) {
    const t = (i / count) * sides;
    const ia = Math.floor(t) % sides;
    const ib = (ia + 1) % sides;
    const f = t - Math.floor(t);
    out[i] = {
      x: verts[ia].x + (verts[ib].x - verts[ia].x) * f,
      y: verts[ia].y + (verts[ib].y - verts[ia].y) * f,
    };
  }
  return out;
}

function phaseAt(elapsed, dur) {
  let cursor = 0;
  for (let i = 0; i < PHASES.length; i++) {
    const name = PHASES[i];
    const len = dur[name] || 0;
    if (elapsed < cursor + len) {
      return { phase: name, local: len > 0 ? (elapsed - cursor) / len : 1 };
    }
    cursor += len;
  }
  return { phase: 'settle', local: 1 };
}
const FONT = 'ui-monospace, Cascadia Mono, Consolas, monospace';
const SLOT_COUNT = 42;

function beam(time, channel, phase) {
  const t = time * 1.05 + phase;
  const wobble = 0.86 + 0.14 * Math.sin(time * 0.28 + channel);
  const w1 = channel === 1 ? 3 : 2;
  const w2 = channel === 1 ? 2 : 3;
  const phaseY = channel === 1 ? 1.15 : 0;
  return {
    x: Math.sin(w1 * t + 0.35) * wobble,
    y: Math.sin(w2 * t + phaseY) * (0.78 + 0.22 * Math.sin(time * 0.4 + 0.8 + channel)),
  };
}

function spring(p, tx, ty, dt, k, d) {
  const ax = (tx - p.x) * k - p.vx * d;
  const ay = (ty - p.y) * k - p.vy * d;
  p.vx += ax * dt;
  p.vy += ay * dt;
  p.x += p.vx * dt;
  p.y += p.vy * dt;
}

class ScopeTone {
  constructor(muted, reduceFlashing) {
    this.muted = !!muted;
    this.reduceFlashing = !!reduceFlashing;
    this.ctx = null;
    this.master = null;
    this.osc = null;
    this.osc2 = null;
  }

  start() {
    if (this.muted || this.ctx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    try {
      const ctx = new Ctx();
      const master = ctx.createGain();
      master.gain.value = 0;
      master.connect(ctx.destination);
      const osc = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      osc.type = 'sine';
      osc2.type = 'triangle';
      osc.frequency.value = 196;
      osc2.frequency.value = 392;
      const g2 = ctx.createGain();
      g2.gain.value = 0.12;
      osc.connect(master);
      osc2.connect(g2);
      g2.connect(master);
      osc.start();
      osc2.start();
      master.gain.linearRampToValueAtTime(0.045, ctx.currentTime + 0.35);
      this.ctx = ctx;
      this.master = master;
      this.osc = osc;
      this.osc2 = osc2;
      const kick = () => {
        if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      };
      window.addEventListener('pointerdown', kick, { once: true });
      window.addEventListener('keydown', kick, { once: true });
      kick();
    } catch {
      this.ctx = null;
    }
  }

  follow(yNorm) {
    if (!this.osc) return;
    const f = 118 + Math.max(0, Math.min(1, yNorm)) * 250;
    const t = this.ctx.currentTime;
    this.osc.frequency.setTargetAtTime(f, t, 0.04);
    this.osc2.frequency.setTargetAtTime(f * 2, t, 0.05);
  }

  chord() {
    if (!this.osc) return;
    const t = this.ctx.currentTime;
    this.osc.frequency.setTargetAtTime(220, t, 0.12);
    this.osc2.frequency.setTargetAtTime(330, t, 0.12);
  }

  fall() {
    if (!this.osc) return;
    const t = this.ctx.currentTime;
    this.osc.frequency.setTargetAtTime(86, t, 0.18);
    this.osc2.frequency.setTargetAtTime(172, t, 0.18);
    this.master.gain.setTargetAtTime(0.012, t, 0.15);
  }

  hush() {
    if (!this.master) return;
    this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.06);
  }

  blip() {
    if (!this.ctx || this.muted || this.reduceFlashing) return;
    if (this.ctx.state === 'suspended') return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'square';
    o.frequency.value = 1680;
    g.gain.value = 0.018;
    o.connect(g);
    g.connect(this.ctx.destination);
    const t = this.ctx.currentTime;
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.028);
    o.start(t);
    o.stop(t + 0.03);
  }

  stop() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    try {
      this.master.gain.setTargetAtTime(0, ctx.currentTime, 0.04);
    } catch { /* already closed */ }
    this.ctx = null;
    this.osc = null;
    this.master = null;
    window.setTimeout(() => ctx.close().catch(() => {}), 180);
  }
}

export class ScopeOpening {
  constructor(opts) {
    this.canvas = opts.canvas || null;
    this.ctx = this.canvas ? this.canvas.getContext('2d', { alpha: false }) : null;
    this.reduceMotion = !!opts.reduceMotion;
    this.reduceFlashing = !!opts.reduceFlashing;
    this.fast = !!opts.fast;
    this.low = !!opts.low || /CrOS/i.test(navigator.userAgent || '');
    this.skipped = false;
    this.stopped = false;
    this.pts = [];
    this.lines = [];
    this.slots = [];
    this.w = 0;
    this.h = 0;
    this._primed = false;
    this._sampled = false;
    this._slotsReady = false;
    this._beamed = false;
    this._lastElapsed = null;
    this._glitch = 0;
    this._tear = 0;
    this._raf = 0;
    this._hasA = false;
    this._hasB = false;
    this._ax = 0;
    this._ay = 0;
    this._bx = 0;
    this._by = 0;
    this._tone = new ScopeTone(opts.muted, this.reduceFlashing);
    this._onResize = () => this._resize();
  }

  skip() {
    if (this.skipped) return;
    this.skipped = true;
    this._tone.hush();
  }

  blip() {
    if (this.skipped) return;
    this._tone.blip();
  }

  _durations() {
    if (this.fast) {
      return {
        scope: 1800, scopeHold: 700, form: 1600, hold: 1500,
        rest: 500, collapse: 1600, settle: 600,
      };
    }
    return {
      scope: 12400, scopeHold: 1100, form: 2600, hold: 2000,
      rest: 700, collapse: 2400, settle: 800,
    };
  }

  async play() {
    if (!this.ctx) return;
    await new Promise((resolve) => requestAnimationFrame(resolve));
    if (this.skipped) return;
    this._resize();
    window.addEventListener('resize', this._onResize);
    if (!this.reduceMotion) this._tone.start();
    if (this.reduceMotion) {
      this._paintStatic();
      await this._wait(this.fast ? 200 : 480);
      return;
    }
    const dur = this._durations();
    let total = 0;
    for (let i = 0; i < PHASES.length; i++) total += dur[PHASES[i]] || 0;
    const t0 = performance.now();
    await new Promise((resolve) => {
      const frame = (now) => {
        if (this.skipped || this.stopped) {
          resolve();
          return;
        }
        const elapsed = now - t0;
        try {
          this._tick(elapsed, dur);
        } catch (err) {
          console.error('[Tech Escape] opening failed', err);
          resolve();
          return;
        }
        if (elapsed >= total) {
          resolve();
          return;
        }
        this._raf = requestAnimationFrame(frame);
      };
      this._raf = requestAnimationFrame(frame);
    });
  }

  beginLog() {
    document.getElementById('screen-load')?.classList.add('is-logging');
    this._tone.hush();
    if (this.reduceMotion || this.skipped || !this.ctx) return;
    const ctx = this.ctx;
    const t0 = performance.now();
    const fade = (now) => {
      if (this.stopped) return;
      const u = Math.min(1, (now - t0) / 700);
      ctx.fillStyle = `rgba(2, 8, 4, ${0.18 + u * 0.35})`;
      ctx.fillRect(0, 0, this.w, this.h);
      if (u < 1) requestAnimationFrame(fade);
    };
    requestAnimationFrame(fade);
  }

  stop() {
    this.stopped = true;
    cancelAnimationFrame(this._raf);
    window.removeEventListener('resize', this._onResize);
    this._tone.stop();
  }

  _wait(ms) {
    return new Promise((resolve) => {
      const t = window.setTimeout(resolve, ms);
      const poll = window.setInterval(() => {
        if (this.skipped || this.stopped) {
          window.clearTimeout(t);
          window.clearInterval(poll);
          resolve();
        }
      }, 40);
      window.setTimeout(() => window.clearInterval(poll), ms + 60);
    });
  }

  _resize() {
    if (!this.canvas || !this.ctx) return;
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height);
    const dprCap = this.low ? 1 : 1.5;
    const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
    const bw = Math.floor(w * dpr);
    const bh = Math.floor(h * dpr);
    if (this.canvas.width !== bw || this.canvas.height !== bh) {
      this.canvas.width = bw;
      this.canvas.height = bh;
      this._primed = false;
      this._hasA = false;
      this._hasB = false;
    }
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const prevW = this.w || w;
    const prevH = this.h || h;
    this.w = w;
    this.h = h;
    if (!this._sampled) this._sample();
    else if (prevW !== w || prevH !== h) {
      const sx = w / prevW;
      const sy = h / prevH;
      for (let i = 0; i < this.pts.length; i++) {
        const p = this.pts[i];
        p.x *= sx;
        p.y *= sy;
        p.tx *= sx;
        p.ty *= sy;
      }
      for (let i = 0; i < this.slots.length; i++) {
        this.slots[i].x *= sx;
        this.slots[i].y *= sy;
      }
    }
  }

  _sample() {
    const w = this.w;
    const h = this.h;
    const sw = Math.round(Math.min(w * 0.9, 1100));
    const sh = Math.round(Math.min(Math.max(140, h * 0.34), 320));
    const sample = document.createElement('canvas');
    sample.width = sw;
    sample.height = sh;
    const g = sample.getContext('2d', { willReadFrequently: true });
    g.clearRect(0, 0, sw, sh);
    g.fillStyle = '#fff';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const size = Math.round(Math.min(sw / 12.2, sh * 0.62));
    g.font = `700 ${size}px ${FONT}`;
    if ('letterSpacing' in g) g.letterSpacing = '0.14em';
    g.fillText('TECH ESCAPE 3', sw / 2, sh / 2);
    const data = g.getImageData(0, 0, sw, sh).data;
    const step = this.low ? 3 : 2;
    const runs = [];
    for (let y = 0; y < sh; y += step) {
      let run = [];
      const commit = () => {
        if (run.length >= 2) runs.push(run);
        run = [];
      };
      for (let x = 0; x < sw; x += step) {
        if (data[(y * sw + x) * 4 + 3] > 48) run.push(x, y);
        else if (run.length) commit();
      }
      if (run.length) commit();
    }
    const scale = Math.min((w * 0.84) / sw, (h * 0.46) / sh);
    const ox = (w - sw * scale) / 2;
    const oy = (h - sh * scale) / 2 - h * 0.03;
    const stride = this.low ? 2 : 1;
    this.pts = [];
    this.lines = [];
    for (let r = 0; r < runs.length; r++) {
      const run = runs[r];
      const line = [];
      for (let i = 0; i < run.length; i += 2 * stride) {
        const pt = {
          x: 0,
          y: 0,
          vx: 0,
          vy: 0,
          tx: ox + run[i] * scale,
          ty: oy + run[i + 1] * scale,
          phase: this.pts.length * 0.47,
          delay: 0,
          u: 0,
          slot: 0,
          spin: 36,
          amp: 2,
          kind: 0,
          held: true,
          i: this.pts.length,
        };
        this.pts.push(pt);
        line.push(pt);
      }
      if (line.length >= 2) this.lines.push(line);
    }
    if (!this.pts.length) {
      const pt = {
        x: w / 2, y: h / 2, vx: 0, vy: 0, tx: w / 2, ty: h / 2,
        phase: 0, delay: 0, u: 0, slot: 0, spin: 40, amp: 0, kind: 0, held: true, i: 0,
      };
      this.pts.push(pt);
      this.lines.push([pt]);
    }
    let minX = Infinity;
    let maxX = -Infinity;
    for (let i = 0; i < this.pts.length; i++) {
      minX = Math.min(minX, this.pts[i].tx);
      maxX = Math.max(maxX, this.pts[i].tx);
    }
    const span = Math.max(1, maxX - minX);
    const n = this.pts.length;
    for (let i = 0; i < n; i++) {
      const p = this.pts[i];
      p.delay = ((p.tx - minX) / span) * 0.62;
      p.u = i / n;
      p.slot = i % SLOT_COUNT;
      p.spin = 28 + (i % 19) * 5;
      p.kind = i % 7 === 0 ? 1 : 0;
    }
    this._sampled = true;
  }

  _buildSlots() {
    const log = document.getElementById('boot-log');
    const cr = this.canvas.getBoundingClientRect();
    let x0 = this.w * 0.5 - 110;
    let y0 = this.h * 0.42;
    if (log) {
      const lr = log.getBoundingClientRect();
      const span = Math.min(260, Math.max(150, lr.width * 0.36));
      const gap = span / Math.max(1, SLOT_COUNT - 1);
      const mid = (lr.left + lr.width / 2) - cr.left;
      x0 = mid - span / 2;
      y0 = lr.top - cr.top + 12;
      this.slots = new Array(SLOT_COUNT);
      for (let i = 0; i < SLOT_COUNT; i++) this.slots[i] = { x: x0 + i * gap, y: y0 };
      this._slotsReady = true;
      return;
    }
    const gap = 220 / Math.max(1, SLOT_COUNT - 1);
    this.slots = new Array(SLOT_COUNT);
    for (let i = 0; i < SLOT_COUNT; i++) this.slots[i] = { x: x0 + i * gap, y: y0 };
    this._slotsReady = true;
  }

  _paintStatic() {
    const ctx = this.ctx;
    ctx.fillStyle = '#020604';
    ctx.fillRect(0, 0, this.w, this.h);
    this._graticule(0.35);
    ctx.fillStyle = '#c8ffd4';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const size = Math.max(28, Math.min(72, this.w / 14));
    ctx.font = `700 ${size}px ${FONT}`;
    ctx.fillText('TECH ESCAPE 3', this.w / 2, this.h / 2);
  }

  _tick(elapsed, dur) {
    const prev = this._lastElapsed;
    this._lastElapsed = elapsed;
    const dt = prev == null
      ? 0.016
      : Math.min(0.033, Math.max(0.001, (elapsed - prev) / 1000));
    const time = elapsed / 1000;
    const beat = phaseAt(elapsed, dur);
    const phase = beat.phase;
    const local = beat.local;
    if (phase === 'collapse' && !this._slotsReady) this._buildSlots();
    this._simulate(phase, local, dt, time);
    this._draw(phase, local, time);
    this._sound(phase, local);
  }

  _simulate(phase, local, dt, time) {
    if (phase === 'scope' || phase === 'scopeHold') return;
    if (!this._beamed) {
      this._placeOnBeam(time);
      this._beamed = true;
    }
    const cx = this.w * 0.5;
    const cy = this.h * 0.5;
    const rx = this.w * 0.26;
    const ry = this.h * 0.2;
    const pts = this.pts;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      if (phase === 'form' && local < p.delay) {
        const b = beam(time, p.kind, p.u * Math.PI * 2);
        p.x = cx + b.x * rx;
        p.y = cy + b.y * ry;
        p.vx = 0;
        p.vy = 0;
        p.held = true;
        p.amp = 4;
        continue;
      }
      if (phase === 'form') {
        if (p.held) {
          p.held = false;
          p.vx = (p.tx - p.x) * 0.12;
          p.vy = (p.ty - p.y) * 0.12;
        }
        spring(p, p.tx, p.ty, dt, 14, 6.4);
        p.amp = 5.5 * (1 - local) + 2.4;
      } else if (phase === 'hold' || phase === 'rest') {
        spring(p, p.tx, p.ty, dt, 18, 8);
        p.amp = phase === 'rest' ? 1.15 : 2.5;
      } else if (phase === 'collapse' && local < 0.36) {
        const k = local / 0.36;
        spring(p, p.tx + (cx - p.tx) * k, p.ty + (cy - p.ty) * k, dt, 16, 7);
        p.amp = 2.2 * (1 - k);
      } else if (phase === 'collapse') {
        const k = (local - 0.36) / 0.64;
        const slot = this.slots[p.slot] || this.slots[0];
        if (!slot) continue;
        const ang = p.phase + time * 2.4;
        const rad = (1 - k) * (1 - k) * p.spin;
        const dx = slot.x - cx;
        const dy = slot.y - cy;
        const len = Math.hypot(dx, dy) || 1;
        const j = (p.i % 5) - 2;
        spring(
          p,
          slot.x + (-dy / len) * Math.sin(ang) * rad + j * 0.6,
          slot.y + (dx / len) * Math.cos(ang * 0.8) * rad,
          dt, 22, 8,
        );
        p.amp = 0;
      } else {
        const slot = this.slots[p.slot] || this.slots[0];
        if (!slot) continue;
        const j = (p.i % 5) - 2;
        spring(p, slot.x + j * 0.5, slot.y, dt, 28, 12);
        p.amp = 0;
      }
      if (!Number.isFinite(p.x)) p.x = p.tx;
      if (!Number.isFinite(p.y)) p.y = p.ty;
    }
  }

  _placeOnBeam(time) {
    const cx = this.w * 0.5;
    const cy = this.h * 0.5;
    const rx = this.w * 0.26;
    const ry = this.h * 0.2;
    const pts = this.pts;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const b = beam(time, p.kind, p.u * Math.PI * 2);
      p.x = cx + b.x * rx;
      p.y = cy + b.y * ry;
    }
  }

  _sound(phase, local) {
    if (phase === 'scope' || phase === 'scopeHold' || (phase === 'form' && local < 0.45)) return;
    if (phase === 'form' || phase === 'hold' || phase === 'rest') this._tone.chord();
    else if (phase === 'collapse') this._tone.fall();
    else this._tone.hush();
  }

  _draw(phase, local, time) {
    const ctx = this.ctx;
    if (!this._primed) {
      ctx.fillStyle = '#020604';
      ctx.fillRect(0, 0, this.w, this.h);
      this._primed = true;
    } else {
      const veil = phase === 'scope' ? 0.06
        : phase === 'scopeHold' ? 0.04
          : phase === 'form' ? 0.18
            : phase === 'hold' ? 0.1
              : phase === 'rest' ? 0.07
                : phase === 'settle' ? 0.14
                  : 0.2;
      ctx.fillStyle = `rgba(2, 8, 4, ${veil})`;
      ctx.fillRect(0, 0, this.w, this.h);
    }

    const grid = (phase === 'scope' || phase === 'scopeHold') ? 0.85
      : phase === 'form' ? 0.4 * (1 - local * 0.5)
        : (phase === 'hold' || phase === 'rest') ? 0.22
          : 0.1 * (1 - local);
    this._graticule(grid);

    if (!this.reduceFlashing && phase === 'hold' && local > 0.78) {
      if (this._glitch <= 0) this._tear = 6;
      this._glitch = Math.max(this._glitch, 0.7);
    }
    if (this._glitch > 0) this._glitch = Math.max(0, this._glitch - 0.08);

    ctx.save();
    if (this._glitch > 0) ctx.translate(this._tear * this._glitch, 0);

    const tracing = phase === 'form' && local < 0.42;
    if (phase === 'scope' || phase === 'scopeHold') this._drawShapes(time);
    else if (tracing) {
      const alpha = phase === 'form' ? 1 - local / 0.42 : 1;
      const sing = phase !== 'form' || local < 0.22;
      this._trace(time, 0, alpha, sing);
      if (!this.low) this._trace(time, 1, alpha * 0.45, false);
    }

    const mode = (phase === 'hold' || phase === 'rest') ? 'lines'
      : phase === 'form' ? (local < 0.2 ? 'dots' : 'lines')
        : phase === 'collapse' ? (local < 0.24 ? 'lines' : 'dots')
          : phase === 'settle' ? 'dots'
            : 'none';
    if (mode === 'lines') this._drawLines(time);
    else if (mode === 'dots') this._drawDots(phase === 'collapse' ? 1.5 : 2.3);

    if ((phase === 'collapse' && local > 0.88 || phase === 'settle') && this.slots.length) {
      const a = (local - 0.84) / 0.16;
      const s0 = this.slots[0];
      const s1 = this.slots[this.slots.length - 1];
      ctx.globalAlpha = a * 0.85;
      ctx.strokeStyle = '#b6ffc8';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(s0.x, s0.y + 7);
      ctx.lineTo(s1.x, s1.y + 7);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    if (!this.reduceFlashing && phase === 'hold' && local > 0.86 && local < 0.9) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.fillRect(0, 0, this.w, this.h);
    }

    if (phase === 'scope' || phase === 'scopeHold' || phase === 'form') {
      const a = phase === 'form' ? (1 - local) * 0.7 : phase === 'scopeHold' ? 0.4 : 0.7;
      ctx.globalAlpha = Math.max(0, a);
      ctx.font = `12px ${FONT}`;
      ctx.fillStyle = '#9dffb8';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText('CH1   0.5 V/DIV', 28, this.h - 26);
      ctx.fillText('TIME  5 ms/DIV', 196, this.h - 26);
      ctx.globalAlpha = 1;
    }
  }

  _graticule(alpha) {
    if (alpha <= 0.02) return;
    const ctx = this.ctx;
    const cx = this.w * 0.5;
    const cy = this.h * 0.5;
    const gw = this.w * 0.72;
    const gh = this.h * 0.58;
    const x0 = cx - gw / 2;
    const y0 = cy - gh / 2;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = 'rgba(90, 190, 120, 0.28)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= 10; i++) {
      const x = x0 + (gw * i) / 10;
      ctx.moveTo(x, y0);
      ctx.lineTo(x, y0 + gh);
    }
    for (let i = 0; i <= 8; i++) {
      const y = y0 + (gh * i) / 8;
      ctx.moveTo(x0, y);
      ctx.lineTo(x0 + gw, y);
    }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(180, 255, 200, 0.45)';
    ctx.beginPath();
    ctx.moveTo(cx - 10, cy);
    ctx.lineTo(cx + 10, cy);
    ctx.moveTo(cx, cy - 10);
    ctx.lineTo(cx, cy + 10);
    ctx.stroke();
    ctx.restore();
  }

  _drawShapes(time) {
    const shape = this._shapeAt(time * 1000);
    const ctx = this.ctx;
    const cx = this.w * 0.5;
    const cy = this.h * 0.46;
    const radius = Math.min(this.w, this.h) * 0.24;
    const count = 180;
    const u = shape.u * shape.u * (3 - 2 * shape.u);
    if (shape.from === 1 && shape.to === 1) {
      ctx.fillStyle = '#f6fff8';
      ctx.beginPath();
      ctx.arc(cx, cy, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(80, 255, 150, 0.4)';
      ctx.lineWidth = 14;
      ctx.stroke();
      this._tone.follow(0.12);
      return;
    }
    const a = shapeLoop(shape.from, count, radius);
    const b = shapeLoop(shape.to, count, radius);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < count; i++) {
      const x = cx + a[i].x + (b[i].x - a[i].x) * u;
      const y = cy + a[i].y + (b[i].y - a[i].y) * u;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    if (shape.from > 2 && shape.to > 2) ctx.closePath();
    ctx.strokeStyle = 'rgba(70, 255, 140, 0.3)';
    ctx.lineWidth = 8;
    ctx.stroke();
    ctx.strokeStyle = '#f4fff8';
    ctx.lineWidth = 1.8;
    ctx.stroke();
    this._tone.follow(0.16 + (shape.index / 8) * 0.7);
  }

  _shapeAt(timeMs) {
    const hold = this.fast ? 420 : 880;
    const morph = this.fast ? 280 : 620;
    const beat = hold + morph;
    const last = SHAPE_SIDES.length - 1;
    if (timeMs >= last * beat) {
      return { from: SHAPE_SIDES[last], to: SHAPE_SIDES[last], u: 1, index: last };
    }
    const i = Math.min(last, Math.floor(timeMs / beat));
    const local = timeMs - i * beat;
    if (local <= hold || i === last) {
      return { from: SHAPE_SIDES[i], to: SHAPE_SIDES[i], u: 1, index: i };
    }
    return {
      from: SHAPE_SIDES[i],
      to: SHAPE_SIDES[i + 1],
      u: (local - hold) / morph,
      index: i,
    };
  }

  _trace(time, channel, alpha, sing) {
    const ctx = this.ctx;
    const cx = this.w * 0.5;
    const cy = this.h * 0.48;
    const rx = this.w * 0.27;
    const ry = this.h * 0.2;
    const steps = 5;
    let headY = 0;
    for (let s = 1; s <= steps; s++) {
      const b = beam(time - (steps - s) * 0.008, channel, 0);
      const x = cx + b.x * rx;
      const y = cy + b.y * ry;
      headY = b.y;
      const has = channel === 0 ? this._hasA : this._hasB;
      const px = channel === 0 ? this._ax : this._bx;
      const py = channel === 0 ? this._ay : this._by;
      if (has) {
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(x, y);
        if (!this.low && channel === 0) {
          ctx.strokeStyle = `rgba(70, 255, 140, ${0.28 * alpha})`;
          ctx.lineWidth = 4.2;
          ctx.stroke();
        }
        ctx.strokeStyle = channel === 0
          ? `rgba(214, 255, 226, ${0.95 * alpha})`
          : `rgba(150, 255, 214, ${0.8 * alpha})`;
        ctx.lineWidth = channel === 0 ? 1.7 : 1.15;
        ctx.stroke();
      }
      if (channel === 0) {
        this._ax = x;
        this._ay = y;
        this._hasA = true;
      } else {
        this._bx = x;
        this._by = y;
        this._hasB = true;
      }
    }
    if (channel === 0 && sing) {
      ctx.fillStyle = `rgba(244, 255, 248, ${alpha})`;
      ctx.fillRect(this._ax - 1.3, this._ay - 1.3, 2.6, 2.6);
      this._tone.follow((headY + 1) * 0.5);
    } else if (channel === 0) {
      ctx.fillStyle = `rgba(244, 255, 248, ${alpha})`;
      ctx.fillRect(this._ax - 1.3, this._ay - 1.3, 2.6, 2.6);
    }
  }

  _drawLines(time) {
    const ctx = this.ctx;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const lines = this.lines;
    const drawPass = (width, style) => {
      ctx.lineWidth = width;
      ctx.strokeStyle = style;
      for (let li = 0; li < lines.length; li++) {
        const line = lines[li];
        ctx.beginPath();
        for (let i = 0; i < line.length; i++) {
          const p = line[i];
          const y = p.y + Math.sin(time * 6 + p.phase) * p.amp;
          if (i === 0) ctx.moveTo(p.x, y);
          else ctx.lineTo(p.x, y);
        }
        ctx.stroke();
      }
    };
    if (!this.low) drawPass(3.4, 'rgba(70, 255, 140, 0.28)');
    drawPass(1.35, 'rgba(226, 255, 236, 0.95)');
  }

  _drawDots(size) {
    const ctx = this.ctx;
    const pts = this.pts;
    ctx.fillStyle = '#b6ffc9';
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      if (p.kind !== 0) continue;
      ctx.fillRect(p.x, p.y, size, size);
    }
    ctx.fillStyle = '#86ffe6';
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      if (p.kind !== 1) continue;
      ctx.fillRect(p.x, p.y, size, size);
    }
  }
}

/**
 * The lobby prints itself, one row after another.
 * Buttons stay clickable while the letters are still arriving.
 */
export function revealTerminal(screen) {
  if (!screen) return;
  screen.classList.add('term-live');
  screen.classList.remove('term-print');
}
