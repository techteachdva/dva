/**
 * Tech Trail Audio — lightweight Web Audio engine with procedural SFX and zone ambience.
 */
(() => {
  "use strict";

  const PREFIX = "techtrail";
  let engine = null;
  let _noiseBuf = null;
  let _ambienceNodes = [];
  let _muted = false;

  function loadMuted() {
    try {
      _muted = localStorage.getItem(`${PREFIX}:muted`) === "1";
    } catch {}
  }

  function saveMuted() {
    try { localStorage.setItem(`${PREFIX}:muted`, _muted ? "1" : "0"); } catch {}
  }

  function init() {
    if (engine) {
      if (engine.ctx.state === "suspended") engine.ctx.resume().catch(() => {});
      return engine;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    try {
      const ctx = new Ctx();
      const master = ctx.createGain();
      const sfxBus = ctx.createGain();
      const ambienceBus = ctx.createGain();
      sfxBus.connect(master);
      ambienceBus.connect(master);
      master.connect(ctx.destination);
      master.gain.value = _muted ? 0 : 0.55;
      sfxBus.gain.value = 0.9;
      ambienceBus.gain.value = 0.35;
      engine = { ctx, master, sfxBus, ambienceBus };
      _buildNoiseBuf(ctx);
      return engine;
    } catch (e) {
      console.warn("[GTG] Audio init failed:", e);
      return null;
    }
  }

  function _buildNoiseBuf(ctx) {
    if (_noiseBuf) return;
    const len = ctx.sampleRate;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    _noiseBuf = buf;
  }

  function _now() {
    return engine?.ctx?.currentTime || 0;
  }

  function _tone({ freq = 440, freqEnd = null, dur = 0.2, type = "sine", vol = 0.25, attack = 0.005, pan = 0 }) {
    if (!engine) return;
    const t = _now();
    const osc = engine.ctx.createOscillator();
    const gain = engine.ctx.createGain();
    const panner = engine.ctx.createStereoPanner?.() || null;
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (freqEnd && freqEnd !== freq) {
      osc.frequency.linearRampToValueAtTime(freqEnd, t + dur);
    }
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(vol, t + attack);
    gain.gain.setValueAtTime(vol, t + dur - 0.02);
    gain.gain.linearRampToValueAtTime(0.0001, t + dur);
    if (panner) {
      panner.pan.value = pan;
      osc.connect(gain).connect(panner).connect(engine.sfxBus);
    } else {
      osc.connect(gain).connect(engine.sfxBus);
    }
    osc.start(t);
    osc.stop(t + dur + 0.02);
    setTimeout(() => { try { osc.disconnect(); gain.disconnect(); panner?.disconnect(); } catch {} }, (dur + 0.1) * 1000);
  }

  function _noise({ dur = 0.2, vol = 0.2, filter = 1200, filterEnd = null, attack = 0.004, pan = 0 }) {
    if (!engine || !_noiseBuf) return;
    const t = _now();
    const src = engine.ctx.createBufferSource();
    const gain = engine.ctx.createGain();
    const filt = engine.ctx.createBiquadFilter();
    const panner = engine.ctx.createStereoPanner?.() || null;
    src.buffer = _noiseBuf;
    src.loop = true;
    filt.type = "lowpass";
    filt.frequency.setValueAtTime(filter, t);
    if (filterEnd && filterEnd !== filter) {
      filt.frequency.linearRampToValueAtTime(filterEnd, t + dur);
    }
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(vol, t + attack);
    gain.gain.setValueAtTime(vol, t + dur - 0.02);
    gain.gain.linearRampToValueAtTime(0.0001, t + dur);
    if (panner) {
      panner.pan.value = pan;
      src.connect(filt).connect(gain).connect(panner).connect(engine.sfxBus);
    } else {
      src.connect(filt).connect(gain).connect(engine.sfxBus);
    }
    src.start(t);
    src.stop(t + dur + 0.02);
    setTimeout(() => { try { src.disconnect(); gain.disconnect(); filt.disconnect(); panner?.disconnect(); } catch {} }, (dur + 0.1) * 1000);
  }

  function playBadgeChime() {
    _tone({ freq: 880, freqEnd: 1760, dur: 0.25, type: "sine", vol: 0.18, attack: 0.01 });
    setTimeout(() => _tone({ freq: 1760, freqEnd: 2217, dur: 0.3, type: "sine", vol: 0.14, attack: 0.01 }), 120);
  }

  function playGoldenFanfare() {
    const notes = [
      { freq: 523, delay: 0 },
      { freq: 659, delay: 0.12 },
      { freq: 784, delay: 0.24 },
      { freq: 1047, delay: 0.38 },
    ];
    notes.forEach((n) => {
      setTimeout(() => _tone({ freq: n.freq, dur: 0.45, type: "triangle", vol: 0.18, attack: 0.02 }), n.delay * 1000);
    });
  }

  function playChoiceClick() {
    _tone({ freq: 440, dur: 0.05, type: "sine", vol: 0.08, attack: 0.002 });
  }

  function playTypeTick() {
    _noise({ dur: 0.015, vol: 0.04, filter: 3000, attack: 0.001 });
  }

  function playCharCorrect() {
    _tone({ freq: 520, freqEnd: 680, dur: 0.04, type: "sine", vol: 0.06, attack: 0.001 });
  }

  function playPathUnlock() {
    _tone({ freq: 440, dur: 0.08, type: "triangle", vol: 0.14, attack: 0.005 });
    setTimeout(() => _tone({ freq: 660, dur: 0.12, type: "triangle", vol: 0.16, attack: 0.005 }), 60);
    setTimeout(() => _tone({ freq: 880, freqEnd: 1100, dur: 0.2, type: "sine", vol: 0.12, attack: 0.01 }), 140);
  }

  function playDiagnosticPop() {
    _tone({ freq: 330, dur: 0.06, type: "square", vol: 0.08, attack: 0.002 });
    setTimeout(() => _tone({ freq: 440, dur: 0.08, type: "square", vol: 0.1, attack: 0.002 }), 50);
    setTimeout(() => _tone({ freq: 554, freqEnd: 880, dur: 0.25, type: "triangle", vol: 0.14, attack: 0.01 }), 120);
  }

  function playSpeedFail() {
    _tone({ freq: 220, freqEnd: 180, dur: 0.15, type: "sawtooth", vol: 0.06, attack: 0.01 });
  }

  function playZoneTransition() {
    _noise({ dur: 0.35, vol: 0.12, filter: 2000, filterEnd: 200, attack: 0.02 });
  }

  const ZONE_DRONES = {
    briefing: { freq: 110, noiseFilter: 400 },
    warm: { freq: 130, noiseFilter: 500 },
    cool: { freq: 165, noiseFilter: 350 },
    epic: { freq: 98, noiseFilter: 300 },
    tense: { freq: 85, noiseFilter: 250 },
    tech: { freq: 140, noiseFilter: 600 },
    scholar: { freq: 120, noiseFilter: 450 },
    dramatic: { freq: 105, noiseFilter: 400 },
    reflect: { freq: 90, noiseFilter: 320 },
    code: { freq: 150, noiseFilter: 550 },
    precision: { freq: 175, noiseFilter: 380 },
    legal: { freq: 95, noiseFilter: 280 },
    mirror: { freq: 100, noiseFilter: 350 },
    media: { freq: 115, noiseFilter: 420 },
  };

  function startZoneAmbience(mood) {
    stopZoneAmbience();
    if (!engine) return;
    const cfg = ZONE_DRONES[mood] || ZONE_DRONES.tech;
    const t = _now();
    const osc = engine.ctx.createOscillator();
    const oscGain = engine.ctx.createGain();
    const noiseSrc = engine.ctx.createBufferSource();
    const noiseFilt = engine.ctx.createBiquadFilter();
    const noiseGain = engine.ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(cfg.freq, t);
    oscGain.gain.setValueAtTime(0.0001, t);
    oscGain.gain.linearRampToValueAtTime(0.08, t + 1.2);
    osc.connect(oscGain).connect(engine.ambienceBus);
    osc.start(t);

    noiseSrc.buffer = _noiseBuf;
    noiseSrc.loop = true;
    noiseFilt.type = "lowpass";
    noiseFilt.frequency.setValueAtTime(cfg.noiseFilter, t);
    noiseGain.gain.setValueAtTime(0.0001, t);
    noiseGain.gain.linearRampToValueAtTime(0.04, t + 1.2);
    noiseSrc.connect(noiseFilt).connect(noiseGain).connect(engine.ambienceBus);
    noiseSrc.start(t);

    _ambienceNodes = [
      { node: osc, gain: oscGain },
      { node: noiseSrc, gain: noiseGain, filt: noiseFilt },
    ];
  }

  function stopZoneAmbience() {
    if (!engine || !_ambienceNodes.length) return;
    const t = _now();
    for (const item of _ambienceNodes) {
      try {
        item.gain.gain.cancelScheduledValues(t);
        item.gain.gain.setTargetAtTime(0.0001, t, 0.4);
        item.node.stop(t + 0.6);
      } catch {}
    }
    _ambienceNodes = [];
  }

  function setMuted(m) {
    _muted = Boolean(m);
    saveMuted();
    if (engine) {
      const t = engine.ctx.currentTime;
      engine.master.gain.setTargetAtTime(_muted ? 0 : 0.55, t, 0.06);
    }
  }

  function toggleMuted() {
    setMuted(!_muted);
    return _muted;
  }

  function isMuted() {
    return _muted;
  }

  loadMuted();

  window.TechTrailAudio = {
    init,
    playBadgeChime,
    playGoldenFanfare,
    playChoiceClick,
    playTypeTick,
    playCharCorrect,
    playPathUnlock,
    playDiagnosticPop,
    playSpeedFail,
    playZoneTransition,
    startZoneAmbience,
    stopZoneAmbience,
    setMuted,
    toggleMuted,
    isMuted,
  };
})();
