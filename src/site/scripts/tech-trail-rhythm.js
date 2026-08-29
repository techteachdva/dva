/**
 * Global Tech Gauntlet — typing rhythm pulse check (DDR-style letter highway).
 * Soft metronome via TechTrailAudio. Gates room exits until the phrase is typed on beat.
 */
(() => {
  "use strict";

  const DIFFICULTY = {
    cadet: { bpm: 68, windowMs: 170, pass: 0.58, approachBeats: 4 },
    operative: { bpm: 84, windowMs: 120, pass: 0.7, approachBeats: 4 },
    analyst: { bpm: 100, windowMs: 90, pass: 0.8, approachBeats: 3.5 },
  };

  const SPARK_PHRASES = [
    {
      id: "spark-s",
      title: "SPARK · Success",
      meaning: "Success in class: stay with the hard part until it works.",
      text: "Success in class: try, then try again.",
      cadetText: "Success in class: try again.",
    },
    {
      id: "spark-p",
      title: "SPARK · Positive Attitude",
      meaning: "Positive attitude: mistakes are data, not doom.",
      text: "Positive attitude: stay curious and keep going.",
      cadetText: "Positive attitude in class.",
    },
    {
      id: "spark-r",
      title: "SPARK · Responsibility",
      meaning: "Responsibility: own what you type, post, and share.",
      text: "Responsibility: own what you type and share.",
      cadetText: "Responsibility in class.",
    },
    {
      id: "spark-k",
      title: "SPARK · Kindness",
      meaning: "Kindness: lift others up in the room and online.",
      text: "Kindness in class: lift others up online too.",
      cadetText: "Kindness in class.",
    },
    {
      id: "spark-all",
      title: "S.P.A.R.K.",
      meaning: "Success. Positive Attitude. Responsibility. Kindness.",
      text: "SPARK: Success, Positive Attitude, Responsibility, Kindness.",
      cadetText: "SPARK: Success, Attitude, Responsibility, Kindness.",
    },
    {
      id: "spark-help",
      title: "Show SPARK",
      meaning: "Help a classmate without copying their work.",
      text: "Show SPARK: help a classmate without copying.",
      cadetText: "Help, don't copy.",
    },
    {
      id: "spark-report",
      title: "Show SPARK",
      meaning: "Report a mean comment instead of piling on.",
      text: "Show SPARK: report a mean comment, don't pile on.",
      cadetText: "Report it. Don't pile on.",
    },
    {
      id: "spark-credit",
      title: "Show SPARK",
      meaning: "Credit the source, then share.",
      text: "Show SPARK: credit the source, then share.",
      cadetText: "Credit the source.",
    },
  ];

  const CITIZEN_BY_THEME = {
    passwords: {
      id: "unique-2fa",
      title: "Guard your login",
      meaning: "You already knew don't-share. The new move is unique passwords + 2FA.",
      text: "Use unique passwords and two factor authentication, or 2FA.",
      cadetText: "Unique passwords and 2FA.",
    },
    post: {
      id: "true-kind-necessary",
      title: "Think before you post",
      meaning: "Pause. True? Kind? Necessary?",
      text: "Before you post ask yourself: Is it True? Is it Kind? Is it Necessary?",
      cadetText: "Is it True? Kind? Necessary?",
    },
    misinfo: {
      id: "no-misinfo",
      title: "Don't reshare rumors",
      meaning: "Be responsible for what you post and what you pass along.",
      text: "Don't reshare misinformation. Be responsible for what you post.",
      cadetText: "Don't reshare misinformation.",
    },
    footprint: {
      id: "footprint",
      title: "Your digital footprint",
      meaning: "The internet remembers. Type like it lasts.",
      text: "Think before you post. The internet remembers.",
      cadetText: "The internet remembers.",
    },
    privacy: {
      id: "privacy",
      title: "Protect data",
      meaning: "Private info isn't yours to pass around.",
      text: "Private data is not a joke to share.",
      cadetText: "Protect private data.",
    },
    media: {
      id: "decode",
      title: "Decode media",
      meaning: "Who made this, and what do they want you to believe?",
      text: "Decode the headline. Check the source before you share.",
      cadetText: "Check the source first.",
    },
    design: {
      id: "design",
      title: "Design for people",
      meaning: "Ask who it's for before you build.",
      text: "Design for people, not just for flash.",
      cadetText: "Design for people first.",
    },
    network: {
      id: "wifi",
      title: "Shared air",
      meaning: "Public Wi-Fi is a hallway. HTTPS is the padlock.",
      text: "Public Wi-Fi is shared. Look for HTTPS.",
      cadetText: "Look for HTTPS.",
    },
    credit: {
      id: "credit",
      title: "Credit and permission",
      meaning: "Be inspired without taking.",
      text: "Credit the creator. Don't copy and claim.",
      cadetText: "Credit the creator.",
    },
    collab: {
      id: "collab",
      title: "Show up",
      meaning: "Tools connect us. People choose whether that helps.",
      text: "Help a teammate without doing their work.",
      cadetText: "Help, don't take over.",
    },
    debug: {
      id: "debug",
      title: "Debug the truth",
      meaning: "Computers do exactly what you wrote, even the silly part.",
      text: "Read the error. Fix one thing at a time.",
      cadetText: "Fix one thing at a time.",
    },
    bias: {
      id: "bias",
      title: "Check the pattern",
      meaning: "A slick chart isn't evidence.",
      text: "A trending chart is not the same as proof.",
      cadetText: "Trending is not proof.",
    },
    default: {
      id: "pause",
      title: "Digital citizenship",
      meaning: "Type like a good neighbor.",
      text: "Be a good digital citizen. Pause before you post.",
      cadetText: "Pause before you post.",
    },
  };

  const THEME_BY_PREFIX = [
    [/password/, "passwords"],
    [/footprint/, "post"],
    [/media/, "misinfo"],
    [/privacy|data_vault|detective/, "privacy"],
    [/sources|johnson/, "media"],
    [/design|define|ai_ethics|lovelace/, "design"],
    [/network|hardware/, "network"],
    [/ip_chamber|ip_win|ip_fail|ip_recovery|open_source/, "credit"],
    [/collab/, "collab"],
    [/debug|hopper|code_bay|code_win|code_fail|code_recovery/, "debug"],
    [/bias|trajectory/, "bias"],
    [/start|prepare|try_|final_trial|reflect/, "default"],
  ];

  const Audio = () => window.TechTrailAudio;

  let active = false;
  let bound = false;
  let raf = 0;
  let session = null;
  let lastBeat = -1;

  function hash32(s) {
    let h = 2166136261;
    const str = String(s || "");
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function themeForNode(nodeId) {
    const id = String(nodeId || "");
    for (const [re, theme] of THEME_BY_PREFIX) {
      if (re.test(id)) return theme;
    }
    return "default";
  }

  function normalizePhrase(entry, short) {
    const text = short && entry.cadetText ? entry.cadetText : entry.text;
    return {
      id: entry.id,
      title: entry.title,
      meaning: entry.meaning,
      text,
    };
  }

  function pickPhrases(nodeId, difficulty) {
    const short = difficulty === "cadet";
    const citizen = CITIZEN_BY_THEME[themeForNode(nodeId)] || CITIZEN_BY_THEME.default;
    const spark = SPARK_PHRASES[hash32(nodeId) % SPARK_PHRASES.length];
    return [normalizePhrase(citizen, short), normalizePhrase(spark, short)];
  }

  function diffCfg(difficulty, reducedMotion) {
    const base = DIFFICULTY[difficulty] || DIFFICULTY.operative;
    if (!reducedMotion) return { ...base };
    return {
      ...base,
      bpm: Math.max(60, Math.round(base.bpm * 0.82)),
      windowMs: Math.max(base.windowMs, 160),
      approachBeats: 3,
    };
  }

  function isNoteChar(ch) {
    return ch && ch !== " ";
  }

  function buildChart(text, bpm, approachBeats) {
    const beat = 60 / bpm;
    const countIn = 4;
    let t = countIn * beat;
    const notes = [];
    for (const ch of String(text || "")) {
      if (!isNoteChar(ch)) {
        t += beat;
        continue;
      }
      notes.push({
        char: ch,
        hitTime: t,
        state: "pending",
        quality: null,
      });
      t += beat;
    }
    return {
      notes,
      beat,
      bpm,
      approach: approachBeats * beat,
      countIn,
      endTime: t + beat * 0.6,
    };
  }

  function charsMatch(expected, typed) {
    const a = String(expected || "");
    const b = String(typed || "");
    if (!a || !b) return false;
    const al = a.toLowerCase();
    const bl = b.toLowerCase();
    if (al === bl) return true;
    if ("'\u2018\u2019".includes(a) && "'\u2018\u2019".includes(b)) return true;
    if ("-\u2013\u2014".includes(a) && "-\u2013\u2014".includes(b)) return true;
    return false;
  }

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function $(id) {
    return document.getElementById(id);
  }

  function setHidden(el, hide) {
    if (!el) return;
    el.classList.toggle("dw-hidden", hide);
    if (el.hasAttribute("aria-hidden")) el.setAttribute("aria-hidden", hide ? "true" : "false");
  }

  function closePack() {
    const inv = $("inventoryOverlay");
    if (inv && !inv.classList.contains("dw-hidden")) {
      inv.classList.add("dw-hidden");
      inv.setAttribute("aria-hidden", "true");
    }
  }

  function bindOnce() {
    if (bound) return;
    bound = true;
    window.addEventListener("keydown", onKey, true);
    $("rhythmRetryBtn")?.addEventListener("click", () => {
      if (!session || session.phase !== "result") return;
      startRound(session, { retry: true });
    });
    $("rhythmContinueBtn")?.addEventListener("click", onContinueClick);
  }

  function onContinueClick() {
    if (!session || session.phase !== "result") return;
    const need = Math.round(session.cfg.pass * 100);
    const last = session.roundScores[session.roundScores.length - 1];
    const passed = (last?.accuracy || 0) >= need;
    if (passed || session.roundIndex === 0) advanceOrFinish();
    else finishSession(false);
  }

  function onKey(e) {
    if (!active || !session) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (session.phase !== "play") return;
    if (e.key === "Escape" || e.key === "Tab") return;
    if (e.key === " " || e.code === "Space") {
      e.preventDefault();
      return;
    }
    if (e.key.length !== 1) return;
    e.preventDefault();
    e.stopPropagation();
    hitNote(e.key);
  }

  function currentNoteIndex(notes) {
    return notes.findIndex((n) => n.state === "pending");
  }

  function hitNote(key) {
    const { chart, cfg, startedAt } = session;
    const now = (performance.now() - startedAt) / 1000;
    const idx = currentNoteIndex(chart.notes);
    if (idx < 0) return;
    const note = chart.notes[idx];
    if (now < chart.countIn * chart.beat - 0.02) return;
    const deltaMs = (now - note.hitTime) * 1000;
    const earlyIgnore = cfg.windowMs * 1.8;
    if (deltaMs < -earlyIgnore) return;
    if (!charsMatch(note.char, key)) {
      missNote(note, "wrong");
      return;
    }
    const abs = Math.abs(deltaMs);
    if (abs > cfg.windowMs) {
      missNote(note, deltaMs > 0 ? "late" : "early");
      return;
    }
    note.state = "hit";
    if (abs <= 42) note.quality = "perfect";
    else if (abs <= cfg.windowMs * 0.55) note.quality = "great";
    else note.quality = "ok";
    session.combo += 1;
    session.maxCombo = Math.max(session.maxCombo, session.combo);
    Audio()?.playRhythmHit?.(note.quality);
    flashJudgement(note.quality);
    pulseRing("hit");
    renderPhraseStrip();
  }

  function missNote(note, why) {
    if (note.state !== "pending") return;
    note.state = "miss";
    note.quality = why || "miss";
    session.combo = 0;
    Audio()?.playRhythmMiss?.();
    flashJudgement("miss");
    pulseRing("miss");
    renderPhraseStrip();
  }

  function autoMissPassed(now) {
    const { chart, cfg } = session;
    for (const note of chart.notes) {
      if (note.state !== "pending") continue;
      if (now > note.hitTime + cfg.windowMs / 1000) missNote(note, "late");
    }
  }

  function flashJudgement(kind) {
    const el = $("rhythmJudge");
    if (!el) return;
    const labels = {
      perfect: "PERFECT",
      great: "GREAT",
      ok: "GOOD",
      miss: "MISS",
    };
    el.textContent = labels[kind] || "";
    el.dataset.kind = kind;
    el.classList.remove("tt-rhythm__judge--pop");
    void el.offsetWidth;
    el.classList.add("tt-rhythm__judge--pop");
  }

  function pulseRing(kind) {
    const ring = $("rhythmRing");
    if (!ring) return;
    ring.classList.remove("tt-rhythm__ring--hit", "tt-rhythm__ring--miss", "tt-rhythm__ring--beat");
    void ring.offsetWidth;
    ring.classList.add(kind === "miss" ? "tt-rhythm__ring--miss" : kind === "hit" ? "tt-rhythm__ring--hit" : "tt-rhythm__ring--beat");
  }

  function accuracyOf(notes) {
    if (!notes.length) return 100;
    const hits = notes.filter((n) => n.state === "hit").length;
    return Math.round((hits / notes.length) * 100);
  }

  function renderPhraseStrip() {
    const el = $("rhythmPhrase");
    if (!el || !session) return;
    const phrase = session.rounds[session.roundIndex];
    const notes = session.chart.notes;
    let noteI = 0;
    const activeIdx = currentNoteIndex(notes);
    const html = [...phrase.text].map((ch) => {
      if (!isNoteChar(ch)) {
        return `<span class="tt-rhythm-ch tt-rhythm-ch--space">${esc(ch)}</span>`;
      }
      const note = notes[noteI];
      const on = noteI === activeIdx;
      const st = note?.state || "pending";
      noteI += 1;
      return `<span class="tt-rhythm-ch tt-rhythm-ch--${st}${on ? " tt-rhythm-ch--now" : ""}">${esc(ch)}</span>`;
    }).join("");
    el.innerHTML = html;
    const combo = $("rhythmCombo");
    const score = $("rhythmScore");
    if (combo) combo.textContent = `Combo ${session.combo}`;
    if (score) score.textContent = `${accuracyOf(notes)}%`;
  }

  function renderLane(now) {
    const lane = $("rhythmLane");
    if (!lane || !session) return;
    const { chart, reducedMotion } = session;
    const approach = chart.approach;
    const parts = [];
    for (let i = 0; i < chart.notes.length; i++) {
      const note = chart.notes[i];
      const until = note.hitTime - now;
      if (until > approach + 0.05) continue;
      if (until < -0.28 && note.state !== "pending") continue;
      const progress = 1 - until / approach;
      const z = reducedMotion ? 0 : (1 - Math.min(Math.max(progress, 0), 1.25)) * -820;
      const scale = reducedMotion
        ? 0.55 + Math.min(Math.max(progress, 0), 1) * 0.55
        : 0.16 + Math.min(Math.max(progress, 0), 1.05) * 0.92;
      const opacity = progress < 0.06
        ? progress / 0.06
        : progress > 1.2
          ? Math.max(0, 1 - (progress - 1.2) / 0.25)
          : 1;
      const hot = Math.abs(until) < session.cfg.windowMs / 1000 + 0.02 && note.state === "pending";
      parts.push(
        `<span class="tt-rhythm-note tt-rhythm-note--${note.state}${hot ? " tt-rhythm-note--hot" : ""}" style="--z:${z.toFixed(1)}px;--s:${scale.toFixed(3)};opacity:${opacity.toFixed(3)}">${esc(note.char)}</span>`
      );
    }
    const restUntil = nextRestOrBeat(now);
    lane.innerHTML = parts.join("") + (restUntil != null && Math.abs(restUntil) < 0.09
      ? `<span class="tt-rhythm-rest" aria-hidden="true">•</span>`
      : "");
  }

  function nextRestOrBeat(now) {
    if (!session) return null;
    const beat = session.chart.beat;
    const nearest = Math.round(now / beat) * beat;
    return nearest - now;
  }

  function tickMetronome(now) {
    const beat = session.chart.beat;
    const idx = Math.floor((now + 0.02) / beat);
    if (idx === lastBeat || idx < 0) return;
    if (now > session.chart.endTime + 0.2) return;
    lastBeat = idx;
    Audio()?.playMetronomeClick?.();
    pulseRing("beat");
    const countEl = $("rhythmCount");
    if (session.phase === "play" && idx < session.chart.countIn && countEl) {
      const labels = ["3", "2", "1", "TYPE"];
      countEl.textContent = labels[idx] || "";
      countEl.classList.remove("dw-hidden");
    } else if (countEl && idx >= session.chart.countIn) {
      countEl.textContent = "";
      countEl.classList.add("dw-hidden");
    }
  }

  function loop() {
    if (!active || !session || session.phase !== "play") return;
    const now = (performance.now() - session.startedAt) / 1000;
    autoMissPassed(now);
    tickMetronome(now);
    renderLane(now);
    renderPhraseStrip();
    const ring = $("rhythmRing");
    const idx = currentNoteIndex(session.chart.notes);
    const note = idx >= 0 ? session.chart.notes[idx] : null;
    const hot = note && Math.abs(now - note.hitTime) <= session.cfg.windowMs / 1000;
    ring?.classList.toggle("tt-rhythm__ring--hot", Boolean(hot));
    const allDone = session.chart.notes.every((n) => n.state !== "pending");
    if (allDone && now >= session.chart.endTime) {
      endRound();
      return;
    }
    raf = requestAnimationFrame(loop);
  }

  function endRound() {
    cancelAnimationFrame(raf);
    raf = 0;
    const acc = accuracyOf(session.chart.notes);
    session.roundScores.push({
      title: session.rounds[session.roundIndex].title,
      accuracy: acc,
    });
    const need = Math.round(session.cfg.pass * 100);
    const passed = acc >= need;
    session.phase = "result";
    const result = $("rhythmResult");
    const text = $("rhythmResultText");
    const retry = $("rhythmRetryBtn");
    const cont = $("rhythmContinueBtn");
    setHidden(result, false);
    const roundLabel = session.roundIndex === 0 ? "Digital citizenship" : "SPARK";
    if (text) {
      text.textContent = passed
        ? `${roundLabel}: ${acc}% — cleared.`
        : `${roundLabel}: ${acc}% — need ${need}% to pass.`;
    }
    setHidden(retry, passed);
    const canBail = !passed && session.attempts >= session.maxAttempts;
    if (cont) {
      cont.textContent = passed
        ? (session.roundIndex === 0 ? "SPARK round ▶" : "Enter next room ▶")
        : session.roundIndex === 0
          ? "SPARK round anyway ▶"
          : "Continue anyway ▶";
      setHidden(cont, !(passed || canBail));
    }
    if (retry) retry.disabled = passed;
    if (passed) Audio()?.playPathUnlock?.();
  }

  function advanceOrFinish() {
    if (!session) return;
    if (session.roundIndex === 0) {
      session.roundIndex = 1;
      startRound(session, { retry: false });
      return;
    }
    finishSession(true);
  }

  function finishSession(passed) {
    cancelAnimationFrame(raf);
    raf = 0;
    const overlay = $("rhythmGate");
    setHidden(overlay, true);
    overlay?.setAttribute("aria-hidden", "true");
    document.body.classList.remove("tt-rhythm-active");
    Audio()?.setMusicDuck?.(1);
    const scores = session?.roundScores || [];
    const avg = scores.length
      ? Math.round(scores.reduce((s, r) => s + r.accuracy, 0) / scores.length)
      : 0;
    const titles = (session?.rounds || []).map((r) => r.title).join(" · ");
    const cb = session?.onComplete;
    active = false;
    session = null;
    lastBeat = -1;
    cb?.({
      passed,
      accuracy: avg,
      title: titles,
      rounds: scores,
    });
  }

  function fillHud(sessionRef) {
    const phrase = sessionRef.rounds[sessionRef.roundIndex];
    const kicker = $("rhythmKicker");
    const title = $("rhythmTitle");
    const meaning = $("rhythmMeaning");
    const bpm = $("rhythmBpm");
    const hint = $("rhythmHint");
    if (kicker) {
      kicker.textContent = sessionRef.roundIndex === 0
        ? "Room pulse check · Digital citizenship"
        : "Room pulse check · SPARK";
    }
    if (title) title.textContent = phrase.title;
    if (meaning) meaning.textContent = phrase.meaning;
    if (bpm) bpm.textContent = `${sessionRef.cfg.bpm} BPM`;
    if (hint) {
      hint.textContent = sessionRef.reducedMotion
        ? "Type the highlighted letter when the ring lights up."
        : "Type the letter when it fills the glowing ring — on the metronome click.";
    }
    $("rhythmCombo").textContent = "Combo 0";
    $("rhythmScore").textContent = "0%";
  }

  function startRound(sessionRef, { retry }) {
    if (retry && sessionRef.roundScores.length) sessionRef.roundScores.pop();
    const phrase = sessionRef.rounds[sessionRef.roundIndex];
    sessionRef.chart = buildChart(phrase.text, sessionRef.cfg.bpm, sessionRef.cfg.approachBeats);
    sessionRef.combo = 0;
    sessionRef.phase = "play";
    sessionRef.startedAt = performance.now();
    lastBeat = -1;
    if (retry) sessionRef.attempts += 1;
    else if (sessionRef.roundIndex === 0) sessionRef.attempts = 1;
    else sessionRef.attempts = 1;
    setHidden($("rhythmResult"), true);
    fillHud(sessionRef);
    renderPhraseStrip();
    const countEl = $("rhythmCount");
    if (countEl) {
      countEl.textContent = "3";
      countEl.classList.remove("dw-hidden");
    }
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
    $("rhythmGate")?.focus?.();
  }

  function start(opts = {}) {
    if (active) return;
    const overlay = $("rhythmGate");
    if (!overlay) {
      opts.onComplete?.({ passed: true, accuracy: 100, title: "", skipped: true });
      return;
    }
    bindOnce();
    closePack();
    if (overlay.parentElement !== document.body) {
      document.body.appendChild(overlay);
    }
    const difficulty = opts.difficulty || "operative";
    const reducedMotion = Boolean(opts.reducedMotion);
    const cfg = diffCfg(difficulty, reducedMotion);
    const maxAttempts = difficulty === "analyst" ? 4 : 3;
    session = {
      nodeId: opts.nodeId,
      difficulty,
      reducedMotion,
      cfg,
      rounds: pickPhrases(opts.nodeId, difficulty),
      roundIndex: 0,
      roundScores: [],
      chart: null,
      combo: 0,
      maxCombo: 0,
      attempts: 0,
      maxAttempts,
      phase: "play",
      startedAt: 0,
      onComplete: opts.onComplete,
    };
    active = true;
    document.body.classList.add("tt-rhythm-active");
    overlay.classList.remove("dw-hidden");
    overlay.setAttribute("aria-hidden", "false");
    overlay.tabIndex = -1;
    Audio()?.init?.();
    Audio()?.setMusicDuck?.(0.38);
    startRound(session, { retry: false });
  }

  function isActive() {
    return active;
  }

  window.TechTrailRhythm = {
    start,
    isActive,
    pickPhrases,
    buildChart,
  };
})();
