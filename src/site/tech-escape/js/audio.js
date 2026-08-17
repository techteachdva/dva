/**
 * Procedural audio. Every sound is synthesised with the Web Audio API so the
 * game ships with zero audio files - nothing to download, nothing a school
 * network can block, and no load time.
 */

import { clamp } from './util.js';

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.ready = false;
    this._noiseBuf = null;
    this._drone = null;
    this._heart = { next: 0, rate: 0 };
    this._tension = 0;
    this._lastStep = 0;
    this._titleLayer = null;
    this._musicMode = null;
    this._musicStep = 0;
    this._musicNext = 0;
  }

  /**
   * Must be called from a user gesture (click / keypress). Audio is a nice to
   * have: if the device or policy refuses to give us a context, the game plays
   * on in silence rather than failing to start.
   */
  init() {
    if (this.failed) return;
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) {
      this.failed = true;
      return;
    }

    try {
      this._build(Ctx);
    } catch (err) {
      console.warn('[Tech Escape] audio unavailable:', err);
      this.failed = true;
      this.ready = false;
    }
  }

  _build(Ctx) {
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.9;

    // Everything runs through a lowpass so hiding under a desk can muffle the
    // whole mix, which sells "my head is down and my ears are covered".
    this.muffle = this.ctx.createBiquadFilter();
    this.muffle.type = 'lowpass';
    this.muffle.frequency.value = 20000;
    this.muffle.Q.value = 0.7;

    this.master.connect(this.muffle);
    this.muffle.connect(this.ctx.destination);

    // One second of white noise, reused by every noise-based effect
    const len = this.ctx.sampleRate;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this._noiseBuf = buf;

    this.ready = true;
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.05);
    }
  }

  get t() { return this.ctx ? this.ctx.currentTime : 0; }

  // ---------------------------------------------------------------- primitives

  _tone({
    freq = 440, freqEnd = null, dur = 0.2, type = 'sine', vol = 0.3,
    attack = 0.005, delay = 0, detune = 0, curve = 'exp',
  }) {
    if (!this.ready || this.muted) return;
    const t0 = this.t + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (freqEnd !== null) {
      if (curve === 'exp' && freqEnd > 0 && freq > 0) {
        osc.frequency.exponentialRampToValueAtTime(freqEnd, t0 + dur);
      } else {
        osc.frequency.linearRampToValueAtTime(freqEnd, t0 + dur);
      }
    }
    if (detune) osc.detune.value = detune;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  _noise({
    dur = 0.2, vol = 0.3, filter = 1200, filterEnd = null, q = 1,
    type = 'lowpass', delay = 0, attack = 0.004,
  }) {
    if (!this.ready || this.muted) return;
    const t0 = this.t + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuf;
    src.loop = true;
    const bq = this.ctx.createBiquadFilter();
    bq.type = type;
    bq.frequency.setValueAtTime(filter, t0);
    if (filterEnd !== null) bq.frequency.exponentialRampToValueAtTime(Math.max(40, filterEnd), t0 + dur);
    bq.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(bq).connect(g).connect(this.master);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  // ------------------------------------------------------------------ ambience

  startAmbience() {
    if (!this.ready || this._drone) return;
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.gain.value = 0.0001;
    out.connect(this.master);

    // Two detuned saws through a low filter: the sound of a room full of
    // machines that should be asleep.
    const oscA = ctx.createOscillator();
    const oscB = ctx.createOscillator();
    oscA.type = 'sawtooth';
    oscB.type = 'sawtooth';
    oscA.frequency.value = 47;
    oscB.frequency.value = 47.6;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 220;
    lp.Q.value = 3;

    // Slow filter sweep keeps the drone from sounding static
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.07;
    lfoGain.gain.value = 90;
    lfo.connect(lfoGain).connect(lp.frequency);

    // Faint electrical hiss layer
    const hiss = ctx.createBufferSource();
    hiss.buffer = this._noiseBuf;
    hiss.loop = true;
    const hissHp = ctx.createBiquadFilter();
    hissHp.type = 'bandpass';
    hissHp.frequency.value = 3200;
    hissHp.Q.value = 0.7;
    const hissGain = ctx.createGain();
    hissGain.gain.value = 0.012;

    oscA.connect(lp);
    oscB.connect(lp);
    lp.connect(out);
    hiss.connect(hissHp).connect(hissGain).connect(out);

    oscA.start(); oscB.start(); lfo.start(); hiss.start();
    out.gain.linearRampToValueAtTime(0.16, this.t + 2.5);

    this._drone = { out, lp, oscA, oscB, lfo, hiss, hissGain };
    this._musicMode = 'game';
    this._musicNext = 5 + Math.random() * 4;
  }

  stopAmbience() {
    if (!this._drone) return;
    const d = this._drone;
    const t = this.t;
    d.out.gain.cancelScheduledValues(t);
    d.out.gain.setTargetAtTime(0.0001, t, 0.3);
    setTimeout(() => {
      try {
        d.oscA.stop(); d.oscB.stop(); d.lfo.stop(); d.hiss.stop();
        d.out.disconnect();
      } catch (e) { /* already torn down */ }
    }, 900);
    this._drone = null;
    if (this._musicMode === 'game') this._musicMode = null;
  }

  /** Soft lobby pad + sparse arpeggio on the title screen. */
  startTitleMusic() {
    if (!this.ready || this._titleLayer) return;
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.gain.value = 0.0001;
    out.connect(this.master);

    const o1 = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    o1.type = 'sine';
    o2.type = 'sine';
    o1.frequency.value = 82.4;
    o2.frequency.value = 123.5;
    o1.connect(out);
    o2.connect(out);
    o1.start();
    o2.start();
    out.gain.linearRampToValueAtTime(0.09, this.t + 1.4);

    this._titleLayer = { out, o1, o2 };
    this._musicMode = 'title';
    this._musicStep = 0;
    this._musicNext = 0.6;
  }

  stopTitleMusic() {
    if (!this._titleLayer) return;
    const l = this._titleLayer;
    l.out.gain.setTargetAtTime(0.0001, this.t, 0.28);
    setTimeout(() => {
      try {
        l.o1.stop();
        l.o2.stop();
        l.out.disconnect();
      } catch { /* ignore */ }
    }, 650);
    this._titleLayer = null;
    if (this._musicMode === 'title') this._musicMode = null;
  }

  /** Sparse melodic punctuation for title lobby and in-run ambience. */
  updateMusic(dt) {
    if (!this.ready || this.muted || !this._musicMode) return;
    this._musicNext -= dt;
    if (this._musicNext > 0) return;

    if (this._musicMode === 'title') {
      const notes = [329.6, 392, 493.9, 659.2, 587.3, 440];
      const n = notes[this._musicStep % notes.length];
      this._tone({ freq: n, freqEnd: n * 0.97, dur: 0.62, type: 'triangle', vol: 0.07 });
      this._musicStep++;
      this._musicNext = 1.85 + (this._musicStep % 4) * 0.22;
      return;
    }

    if (this._musicMode === 'game') {
      const notes = [196, 220, 261.6, 293.7, 329.6];
      const n = notes[Math.floor(Math.random() * notes.length)];
      this._tone({ freq: n, dur: 0.45, type: 'sine', vol: 0.035 });
      this._tone({ freq: n * 1.5, dur: 0.38, type: 'triangle', vol: 0.02, delay: 0.05 });
      this._musicNext = 8 + Math.random() * 7;
    }
  }

  /**
   * 0 = calm, 1 = something is right behind you. Raises the drone pitch and
   * volume, and drives the heartbeat.
   */
  setTension(v) {
    this._tension = clamp(v, 0, 1);
    if (!this._drone) return;
    const t = this.t;
    this._drone.lp.frequency.setTargetAtTime(220 + this._tension * 620, t, 0.4);
    this._drone.out.gain.setTargetAtTime(0.16 + this._tension * 0.16, t, 0.5);
    this._drone.hissGain.gain.setTargetAtTime(0.012 + this._tension * 0.03, t, 0.5);
  }

  /** Called every frame; schedules heartbeats when health is low or tension high. */
  updateHeartbeat(dt, urgency) {
    if (!this.ready || this.muted || urgency <= 0) return;
    this._heart.next -= dt;
    if (this._heart.next > 0) return;
    const period = 1.05 - urgency * 0.5;
    this._heart.next = period;
    const vol = 0.1 + urgency * 0.2;
    this._tone({ freq: 62, freqEnd: 40, dur: 0.15, type: 'sine', vol });
    this._tone({ freq: 55, freqEnd: 36, dur: 0.13, type: 'sine', vol: vol * 0.7, delay: period * 0.28 });
  }

  // -------------------------------------------------------------------- events

  step(sprinting, crouching) {
    if (!this.ready) return;
    const now = this.t;
    if (now - this._lastStep < 0.12) return;
    this._lastStep = now;
    const v = crouching ? 0.045 : sprinting ? 0.15 : 0.09;
    this._noise({ dur: 0.1, vol: v, filter: sprinting ? 900 : 520, filterEnd: 180, q: 1.2 });
  }

  hurt() {
    this._noise({ dur: 0.34, vol: 0.34, filter: 900, filterEnd: 90, q: 1.5 });
    this._tone({ freq: 180, freqEnd: 52, dur: 0.42, type: 'sawtooth', vol: 0.24 });
  }

  /** The dramatic sting when an enemy first notices you. */
  spotted() {
    this._tone({ freq: 1400, freqEnd: 180, dur: 0.5, type: 'sawtooth', vol: 0.2 });
    this._tone({ freq: 1407, freqEnd: 185, dur: 0.5, type: 'square', vol: 0.1, detune: 12 });
    this._noise({ dur: 0.6, vol: 0.16, filter: 5000, filterEnd: 300, q: 0.8 });
  }

  jumpscare() {
    this._tone({ freq: 90, freqEnd: 40, dur: 1.1, type: 'sawtooth', vol: 0.3 });
    this._noise({ dur: 0.7, vol: 0.3, filter: 7000, filterEnd: 200, q: 0.6 });
    this._tone({ freq: 1800, freqEnd: 1810, dur: 0.28, type: 'square', vol: 0.11 });
  }

  skitter(volScale = 1) {
    if (!this.ready) return;
    for (let i = 0; i < 4; i++) {
      this._noise({
        dur: 0.045, vol: 0.075 * volScale, filter: 2600, filterEnd: 1400,
        q: 2.2, delay: i * 0.055 + Math.random() * 0.02,
      });
    }
  }

  virusWhine(volScale = 1) {
    this._tone({ freq: 620, freqEnd: 880, dur: 0.7, type: 'sine', vol: 0.05 * volScale });
    this._tone({ freq: 933, freqEnd: 700, dur: 0.7, type: 'triangle', vol: 0.035 * volScale });
  }

  pickupCheeto() {
    this._noise({ dur: 0.16, vol: 0.2, filter: 3400, filterEnd: 900, q: 1.6 });
    this._tone({ freq: 420, freqEnd: 700, dur: 0.16, type: 'triangle', vol: 0.16 });
  }

  pickupBattery() {
    this._tone({ freq: 300, freqEnd: 900, dur: 0.24, type: 'square', vol: 0.12 });
    this._tone({ freq: 900, freqEnd: 1400, dur: 0.16, type: 'sine', vol: 0.1, delay: 0.14 });
  }

  lightToggle(on) {
    this._noise({ dur: 0.05, vol: 0.14, filter: on ? 4200 : 2200, q: 3 });
    this._tone({ freq: on ? 1100 : 500, freqEnd: on ? 1500 : 300, dur: 0.07, type: 'square', vol: 0.06 });
  }

  lowBattery() {
    this._tone({ freq: 1500, freqEnd: 1200, dur: 0.09, type: 'square', vol: 0.07 });
    this._tone({ freq: 1200, freqEnd: 900, dur: 0.09, type: 'square', vol: 0.06, delay: 0.13 });
  }

  correct() {
    this._tone({ freq: 523, dur: 0.13, type: 'triangle', vol: 0.16 });
    this._tone({ freq: 659, dur: 0.13, type: 'triangle', vol: 0.16, delay: 0.1 });
    this._tone({ freq: 880, dur: 0.28, type: 'triangle', vol: 0.15, delay: 0.2 });
  }

  wrong() {
    this._tone({ freq: 220, freqEnd: 150, dur: 0.2, type: 'square', vol: 0.13 });
    this._tone({ freq: 160, freqEnd: 96, dur: 0.34, type: 'sawtooth', vol: 0.13, delay: 0.13 });
  }

  uiClick() {
    this._tone({ freq: 800, freqEnd: 1200, dur: 0.05, type: 'square', vol: 0.05 });
  }

  cardFlip() {
    this._noise({ dur: 0.07, vol: 0.1, filter: 2400, filterEnd: 1000, q: 2 });
    this._tone({ freq: 700, freqEnd: 1000, dur: 0.06, type: 'sine', vol: 0.06 });
  }

  cardMatch() {
    this._tone({ freq: 700, freqEnd: 1050, dur: 0.14, type: 'triangle', vol: 0.13 });
    this._tone({ freq: 1050, freqEnd: 1400, dur: 0.16, type: 'sine', vol: 0.1, delay: 0.1 });
  }

  cardMiss() {
    this._tone({ freq: 300, freqEnd: 190, dur: 0.15, type: 'square', vol: 0.09 });
  }

  codePiece() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => {
      this._tone({ freq: f, dur: 0.34, type: 'triangle', vol: 0.15, delay: i * 0.11 });
    });
    this._noise({ dur: 0.5, vol: 0.1, filter: 400, filterEnd: 4000, q: 1, delay: 0.1 });
  }

  printerStart() {
    this._tone({ freq: 120, freqEnd: 300, dur: 0.6, type: 'sawtooth', vol: 0.12 });
  }

  printerStep() {
    this._tone({
      freq: 300 + Math.random() * 500, dur: 0.06,
      type: 'square', vol: 0.045,
    });
    this._noise({ dur: 0.05, vol: 0.03, filter: 1800, q: 2 });
  }

  keyReady() {
    [784, 988, 1319].forEach((f, i) => {
      this._tone({ freq: f, dur: 0.5, type: 'triangle', vol: 0.16, delay: i * 0.13 });
    });
  }

  doorOpen() {
    this._noise({ dur: 1.3, vol: 0.2, filter: 300, filterEnd: 2600, q: 1 });
    this._tone({ freq: 70, freqEnd: 160, dur: 1.1, type: 'sawtooth', vol: 0.12 });
  }

  victory() {
    [523, 659, 784, 1047, 1319].forEach((f, i) => {
      this._tone({ freq: f, dur: 0.7, type: 'triangle', vol: 0.16, delay: i * 0.15 });
    });
  }

  defeat() {
    [400, 330, 260, 180].forEach((f, i) => {
      this._tone({ freq: f, freqEnd: f * 0.72, dur: 0.7, type: 'sawtooth', vol: 0.16, delay: i * 0.22 });
    });
  }

  hide() {
    this._noise({ dur: 0.3, vol: 0.09, filter: 700, filterEnd: 200, q: 1 });
  }

  /** Muffles the entire mix while the player is tucked under a desk. */
  setMuffled(on) {
    if (!this.ready || !this.muffle) return;
    this.muffle.frequency.setTargetAtTime(on ? 850 : 20000, this.t, 0.18);
  }

  crouch(down) {
    this._noise({
      dur: 0.22, vol: 0.1,
      filter: down ? 900 : 1400, filterEnd: down ? 260 : 700, q: 1.1,
    });
  }

  /** Knee-and-palm scuff while crawling. */
  crawl() {
    this._noise({ dur: 0.19, vol: 0.06, filter: 480, filterEnd: 170, q: 1.4 });
  }

  /** Tight, held breath. Louder when actually hidden and waiting. */
  breath(scale = 1) {
    this._noise({
      dur: 0.5, vol: 0.05 * scale, filter: 700, filterEnd: 1500,
      q: 0.8, type: 'bandpass', attack: 0.16,
    });
    this._noise({
      dur: 0.42, vol: 0.035 * scale, filter: 1300, filterEnd: 600,
      q: 0.9, type: 'bandpass', attack: 0.1, delay: 0.56,
    });
  }

  /**
   * Rising whine while the flashlight burns a virus. `charge` is 0..1 so the
   * pitch climb tells the player the glitch is about to happen.
   */
  virusBurn(charge) {
    const base = 700 + charge * 1500;
    this._tone({ freq: base, freqEnd: base * 1.25, dur: 0.16, type: 'sawtooth', vol: 0.05 });
    this._tone({ freq: base * 1.5, dur: 0.14, type: 'square', vol: 0.02 });
  }

  /** Distorted digital screech as a virus glitches out and teleports away. */
  virusGlitch() {
    // Downward sawtooth screech with a detuned twin for the "broken data" edge
    this._tone({ freq: 2200, freqEnd: 180, dur: 0.5, type: 'sawtooth', vol: 0.2 });
    this._tone({ freq: 2260, freqEnd: 165, dur: 0.5, type: 'square', vol: 0.11, detune: 40 });
    // Stuttered noise bursts read as packet loss
    for (let i = 0; i < 7; i++) {
      this._noise({
        dur: 0.035, vol: 0.16, filter: 900 + Math.random() * 5200,
        q: 6, delay: i * 0.045,
      });
    }
    this._tone({ freq: 90, freqEnd: 45, dur: 0.6, type: 'sawtooth', vol: 0.13, delay: 0.1 });
  }

  deny() {
    this._tone({ freq: 200, freqEnd: 150, dur: 0.12, type: 'square', vol: 0.08 });
  }

  /* ------------------------------------------------------------ inventory */

  pickupSoda() {
    // Aluminium ting, then the slosh of a can that is still full
    this._tone({ freq: 1500, freqEnd: 1900, dur: 0.1, type: 'triangle', vol: 0.1 });
    this._noise({ dur: 0.2, vol: 0.1, filter: 700, filterEnd: 260, q: 1.4, delay: 0.05 });
  }

  pickupDisc() {
    // Rare item, so it gets the only genuinely pretty sound in the building
    this._tone({ freq: 700, dur: 0.16, type: 'sine', vol: 0.13 });
    this._tone({ freq: 1050, dur: 0.16, type: 'sine', vol: 0.12, delay: 0.09 });
    this._tone({ freq: 1400, dur: 0.4, type: 'sine', vol: 0.11, delay: 0.18 });
    this._noise({ dur: 0.5, vol: 0.05, filter: 6000, filterEnd: 9000, q: 0.7 });
  }

  eatCheetos() {
    // Bag tears, then three crunches
    this._noise({ dur: 0.22, vol: 0.16, filter: 5200, filterEnd: 2600, q: 1.1 });
    for (let i = 0; i < 3; i++) {
      this._noise({
        dur: 0.09, vol: 0.15, filter: 2200 + Math.random() * 1400,
        filterEnd: 800, q: 2.6, delay: 0.2 + i * 0.15,
      });
    }
    this._tone({ freq: 300, freqEnd: 520, dur: 0.3, type: 'triangle', vol: 0.1, delay: 0.5 });
  }

  drinkSoda() {
    // Tab crack, fizz, three gulps, and the exhale that sells the refreshment
    this._tone({ freq: 2200, freqEnd: 900, dur: 0.06, type: 'square', vol: 0.12 });
    this._noise({ dur: 0.9, vol: 0.1, filter: 7000, filterEnd: 3000, q: 0.6, delay: 0.05 });
    for (let i = 0; i < 3; i++) {
      this._tone({
        freq: 260 - i * 30, freqEnd: 180 - i * 20, dur: 0.12,
        type: 'sine', vol: 0.13, delay: 0.25 + i * 0.17,
      });
    }
    this._noise({ dur: 0.35, vol: 0.07, filter: 1200, filterEnd: 400, q: 1, delay: 0.8 });
  }

  bagThrow() {
    this._noise({ dur: 0.18, vol: 0.11, filter: 1800, filterEnd: 3800, q: 1.2 });
  }

  bagLand() {
    // Crinkling foil hitting lino
    this._noise({ dur: 0.14, vol: 0.14, filter: 4200, filterEnd: 1800, q: 1.8 });
    this._tone({ freq: 160, freqEnd: 90, dur: 0.1, type: 'triangle', vol: 0.08 });
  }

  munch(volScale = 1) {
    if (volScale <= 0.02) return;
    this._noise({
      dur: 0.07, vol: 0.11 * volScale, filter: 1800 + Math.random() * 1200,
      filterEnd: 700, q: 3, delay: Math.random() * 0.03,
    });
  }

  /**
   * The bag going off. Deliberately a comic pop-and-fizz rather than an
   * explosion: this is a snack detonating, and the game should let the player
   * enjoy that.
   */
  bagPop(popped = 0) {
    this._tone({ freq: 520, freqEnd: 70, dur: 0.36, type: 'square', vol: 0.2 });
    this._noise({ dur: 0.45, vol: 0.26, filter: 5200, filterEnd: 320, q: 0.7 });
    this._tone({ freq: 120, freqEnd: 48, dur: 0.5, type: 'sawtooth', vol: 0.16, delay: 0.02 });
    // A rising cartoon squeak per casualty, capped so a swarm kill does not clip
    for (let i = 0; i < Math.min(popped, 4); i++) {
      this._tone({
        freq: 900 + i * 140, freqEnd: 2100 + i * 160, dur: 0.13,
        type: 'square', vol: 0.09, delay: 0.06 + i * 0.07,
      });
    }
  }

  discThrow() {
    // Whirring frisbee: two close tones beating against each other
    this._tone({ freq: 900, freqEnd: 1500, dur: 0.3, type: 'sine', vol: 0.1 });
    this._tone({ freq: 912, freqEnd: 1520, dur: 0.3, type: 'sine', vol: 0.08, detune: 18 });
    this._noise({ dur: 0.3, vol: 0.07, filter: 3200, filterEnd: 6200, q: 2 });
  }

  discClatter() {
    // Missed. Plastic on hard floor, bouncing twice: it is still out there.
    for (let i = 0; i < 3; i++) {
      this._tone({
        freq: 1700 - i * 200, freqEnd: 1200 - i * 200, dur: 0.05,
        type: 'triangle', vol: 0.1 - i * 0.025, delay: i * 0.11,
      });
    }
    this._noise({ dur: 0.2, vol: 0.07, filter: 5200, filterEnd: 2000, q: 2.4, delay: 0.22 });
  }

  /** A virus deleted for good. Reversed-sounding sweep up into silence. */
  virusDeleted() {
    this._tone({ freq: 200, freqEnd: 2600, dur: 0.42, type: 'sawtooth', vol: 0.16 });
    this._tone({ freq: 206, freqEnd: 2650, dur: 0.42, type: 'square', vol: 0.09, detune: 25 });
    this._noise({ dur: 0.5, vol: 0.18, filter: 400, filterEnd: 9000, q: 0.8 });
    // Clean confirmation chord on the tail: the system says thank you
    this._tone({ freq: 1046, dur: 0.3, type: 'sine', vol: 0.12, delay: 0.4 });
    this._tone({ freq: 1568, dur: 0.34, type: 'sine', vol: 0.1, delay: 0.46 });
  }

  /** Hands are full / nothing selected. Quiet, never punishing. */
  cantUse() {
    this._tone({ freq: 240, freqEnd: 200, dur: 0.09, type: 'triangle', vol: 0.07 });
  }

  invSwitch() {
    this._tone({ freq: 1300, dur: 0.04, type: 'square', vol: 0.05 });
  }

  terminalOpen() {
    this._tone({ freq: 880, dur: 0.08, type: 'square', vol: 0.09 });
    this._tone({ freq: 1320, dur: 0.1, type: 'triangle', vol: 0.08, delay: 0.07 });
    this._noise({ dur: 0.12, vol: 0.06, filter: 4200, filterEnd: 2800, q: 2 });
  }

  sprintBurst() {
    this._noise({ dur: 0.14, vol: 0.08, filter: 600, filterEnd: 2200, q: 0.9 });
    this._tone({ freq: 180, freqEnd: 420, dur: 0.18, type: 'sawtooth', vol: 0.06 });
  }

  objectivePing() {
    this._tone({ freq: 784, dur: 0.12, type: 'triangle', vol: 0.1 });
    this._tone({ freq: 1046, dur: 0.16, type: 'sine', vol: 0.08, delay: 0.09 });
  }

  nearMiss() {
    this._tone({ freq: 420, freqEnd: 280, dur: 0.22, type: 'sawtooth', vol: 0.12 });
    this._noise({ dur: 0.2, vol: 0.1, filter: 1800, filterEnd: 400, q: 1.2 });
  }

  menuWhoosh() {
    this._noise({ dur: 0.16, vol: 0.07, filter: 900, filterEnd: 3400, q: 0.8 });
    this._tone({ freq: 600, freqEnd: 900, dur: 0.12, type: 'triangle', vol: 0.05 });
  }

  stashSparkle() {
    this._tone({ freq: 1200, freqEnd: 1800, dur: 0.14, type: 'sine', vol: 0.08 });
    this._tone({ freq: 1600, freqEnd: 2200, dur: 0.12, type: 'triangle', vol: 0.06, delay: 0.06 });
  }
}

export const audio = new AudioEngine();
