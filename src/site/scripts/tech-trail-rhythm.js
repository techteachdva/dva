/**
 * Global Tech Gauntlet — room phrase check.
 * One huge next letter. Type the full sentence as fast as you can.
 */
(() => {
  "use strict";

  const DIFFICULTY = {
    cadet: { pass: 0.5 },
    operative: { pass: 0.65 },
    analyst: { pass: 0.75 },
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

  const ROOM_PHRASES = {
    start: {
      citizen: {
        id: "briefing",
        title: "Mission briefing",
        meaning: "Pick a door. Think on your feet.",
        text: "Pick a room. Recover all five Golden Rules of digital citizenship.",
        cadetText: "Recover the five Golden Rules.",
      },
      sparkId: "spark-all",
    },
    design_lab: {
      citizen: {
        id: "design-lab",
        title: "Design for people",
        meaning: "Interview users before you ship.",
        text: "Design for people, not just for flash.",
        cadetText: "Design for people first.",
      },
      sparkId: "spark-s",
    },
    data_vault: {
      citizen: {
        id: "vault-privacy",
        title: "Protect private data",
        meaning: "Don't pass leaks along.",
        text: "Private data is not a joke to share.",
        cadetText: "Protect private data.",
      },
      sparkId: "spark-r",
    },
    password_temple: {
      citizen: {
        id: "unique-2fa",
        title: "Guard your login",
        meaning: "Unique passwords plus 2FA.",
        text: "Use unique passwords and two factor authentication, or 2FA.",
        cadetText: "Unique passwords and 2FA.",
      },
      sparkId: "spark-r",
    },
    footprint_scene: {
      citizen: {
        id: "footprint",
        title: "Your digital footprint",
        meaning: "The internet remembers.",
        text: "Think before you post. The internet remembers.",
        cadetText: "The internet remembers.",
      },
      sparkId: "spark-k",
    },
    media_chamber: {
      citizen: {
        id: "decode",
        title: "Decode media",
        meaning: "Check the source before you share.",
        text: "Decode the headline. Check the source before you share.",
        cadetText: "Check the source first.",
      },
      sparkId: "spark-report",
    },
    prepare_phase: {
      citizen: {
        id: "prepare",
        title: "Name the problem",
        meaning: "Plain language beats buzzwords.",
        text: "Design for people, not just for flash.",
        cadetText: "Design for people first.",
      },
      sparkId: "spark-s",
    },
    try_phase: {
      citizen: {
        id: "try-test",
        title: "Test honestly",
        meaning: "Watch real users, don't hide bugs.",
        text: "Read the error. Fix one thing at a time.",
        cadetText: "Fix one thing at a time.",
      },
      sparkId: "spark-p",
    },
    debug_scene: {
      citizen: {
        id: "debug",
        title: "Debug the truth",
        meaning: "Trace logic line by line.",
        text: "Read the error. Fix one thing at a time.",
        cadetText: "Fix one thing at a time.",
      },
      sparkId: "spark-s",
    },
    reflect_phase: {
      citizen: {
        id: "reflect",
        title: "Honest reflection",
        meaning: "Say what version two should fix.",
        text: "Be a good digital citizen. Pause before you post.",
        cadetText: "Pause before you post.",
      },
      sparkId: "spark-p",
    },
    code_bay: {
      citizen: {
        id: "code-steps",
        title: "Clear instructions",
        meaning: "Robots need steps, not vibes.",
        text: "Read the error. Fix one thing at a time.",
        cadetText: "Fix one thing at a time.",
      },
      sparkId: "spark-s",
    },
    network_closet: {
      citizen: {
        id: "wifi",
        title: "Shared air",
        meaning: "Public Wi-Fi needs HTTPS.",
        text: "Public Wi-Fi is shared. Look for HTTPS.",
        cadetText: "Look for HTTPS.",
      },
      sparkId: "spark-r",
    },
    sources_library: {
      citizen: {
        id: "sources",
        title: "Check the source",
        meaning: "Find the original before you react.",
        text: "Decode the headline. Check the source before you share.",
        cadetText: "Check the source first.",
      },
      sparkId: "spark-credit",
    },
    ip_chamber: {
      citizen: {
        id: "credit",
        title: "Credit and permission",
        meaning: "Get permission for music and art.",
        text: "Credit the creator. Don't copy and claim.",
        cadetText: "Credit the creator.",
      },
      sparkId: "spark-credit",
    },
    collaboration_bridge: {
      citizen: {
        id: "collab",
        title: "Show up",
        meaning: "Back someone up when chat turns mean.",
        text: "Help a teammate without doing their work.",
        cadetText: "Help, don't take over.",
      },
      sparkId: "spark-help",
    },
    trajectory_scene: {
      citizen: {
        id: "verify-quote",
        title: "Verify first",
        meaning: "Famous faces need citations.",
        text: "A trending chart is not the same as proof.",
        cadetText: "Trending is not proof.",
      },
      sparkId: "spark-report",
    },
    ai_ethics: {
      citizen: {
        id: "ai-fair",
        title: "Test for everyone",
        meaning: "Don't ship biased tools.",
        text: "Design for people, not just for flash.",
        cadetText: "Design for people first.",
      },
      sparkId: "spark-k",
    },
    hardware_graveyard: {
      citizen: {
        id: "wipe-devices",
        title: "Wipe before discard",
        meaning: "Old phones still hold secrets.",
        text: "Private data is not a joke to share.",
        cadetText: "Protect private data.",
      },
      sparkId: "spark-r",
    },
    open_source: {
      citizen: {
        id: "oss-credit",
        title: "Restore credit",
        meaning: "Open source still needs names.",
        text: "Credit the creator. Don't copy and claim.",
        cadetText: "Credit the creator.",
      },
      sparkId: "spark-credit",
    },
    bias_unit: {
      citizen: {
        id: "bias",
        title: "Check the pattern",
        meaning: "Demand a fairness audit.",
        text: "A trending chart is not the same as proof.",
        cadetText: "Trending is not proof.",
      },
      sparkId: "spark-report",
    },
    data_detective: {
      citizen: {
        id: "detective",
        title: "Follow the data trail",
        meaning: "Tiny clues build a profile.",
        text: "Private data is not a joke to share.",
        cadetText: "Protect private data.",
      },
      sparkId: "spark-r",
    },
    final_trial: {
      citizen: {
        id: "oath",
        title: "Digital Citizenship Oath",
        meaning: "Promise what you'll actually do.",
        text: "Be a good digital citizen. Pause before you post.",
        cadetText: "Pause before you post.",
      },
      sparkId: "spark-all",
    },
  };

  const THEME_BY_PREFIX = [
    [/password/, "passwords"],
    [/footprint/, "post"],
    [/media|noble/, "misinfo"],
    [/privacy|data_vault|detective|sweeney/, "privacy"],
    [/sources|johnson/, "media"],
    [/design|define|ai_ethics|lovelace|buolamwini/, "design"],
    [/network|hardware|lamarr|perlman|west/, "network"],
    [/ip_chamber|ip_win|ip_fail|ip_recovery|open_source/, "credit"],
    [/collab/, "collab"],
    [/debug|hopper|code_bay|code_win|code_fail|code_recovery|hamilton/, "debug"],
    [/bias|trajectory/, "bias"],
    [/start|prepare|try_|final_trial|reflect/, "default"],
  ];

  const Audio = () => window.TechTrailAudio;

  let active = false;
  let bound = false;
  let countTimer = 0;
  let session = null;

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
    const bridge = window.TechTrailWorld;
    const roomId = bridge?.mapIdFor?.(nodeId) || "start";
    const roomPack = ROOM_PHRASES[roomId];
    let citizen;
    if (roomPack?.citizen) {
      citizen = roomPack.citizen;
    } else {
      citizen = CITIZEN_BY_THEME[themeForNode(nodeId)] || CITIZEN_BY_THEME.default;
    }
    let spark;
    if (roomPack?.sparkId) {
      spark = SPARK_PHRASES.find((p) => p.id === roomPack.sparkId) || SPARK_PHRASES[0];
    } else {
      spark = SPARK_PHRASES[hash32(nodeId) % SPARK_PHRASES.length];
    }
    return [normalizePhrase(citizen, short), normalizePhrase(spark, short)];
  }

  function isSpaceChar(ch) {
    return ch === " ";
  }

  function buildChart(text) {
    const notes = [];
    for (const ch of String(text || "")) {
      notes.push({
        char: ch,
        state: "pending",
        quality: null,
      });
    }
    return { notes, text: String(text || "") };
  }

  function charsMatch(expected, typed) {
    const a = String(expected || "");
    const b = String(typed || "");
    if (isSpaceChar(a) && isSpaceChar(b)) return true;
    if (!a || !b) return false;
    if (a.toLowerCase() === b.toLowerCase()) return true;
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
    advanceOrFinish();
  }

  function onKey(e) {
    if (!active || !session) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (session.phase !== "play") return;
    if (e.key === "Escape" || e.key === "Tab") return;
    if (e.key === " " || e.code === "Space") {
      e.preventDefault();
      e.stopPropagation();
      hitNote(" ");
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

  function liveKeysPerMin() {
    if (!session?.startedAt) return 0;
    const elapsed = (performance.now() - session.startedAt) / 60000;
    if (elapsed <= 0) return 0;
    const typed = session.chart.notes.filter((n) => n.state === "hit").length;
    return Math.round(typed / elapsed);
  }

  function hitNote(key) {
    const { chart } = session;
    const idx = currentNoteIndex(chart.notes);
    if (idx < 0) return;
    const note = chart.notes[idx];
    if (!charsMatch(note.char, key)) {
      session.misses += 1;
      session.combo = 0;
      note.quality = "miss";
      Audio()?.playRhythmMiss?.();
      flashJudgement("miss");
      pulseRing("miss");
      renderPhraseStrip();
      return;
    }
    note.state = "hit";
    note.quality = session.combo >= 4 ? "perfect" : "great";
    session.combo += 1;
    session.maxCombo = Math.max(session.maxCombo, session.combo);
    Audio()?.playRhythmHit?.(note.quality);
    flashJudgement(note.quality);
    pulseRing("hit");
    renderPhraseStrip();
    renderNextLetter(true);
    if (chart.notes.every((n) => n.state !== "pending")) {
      endRound();
    }
  }

  function flashJudgement(kind) {
    const el = $("rhythmJudge");
    if (!el) return;
    const waitingSpace = session?.chart?.notes?.[currentNoteIndex(session.chart.notes)]?.char === " ";
    const labels = {
      perfect: "NICE",
      great: "YES",
      ok: "GOOD",
      miss: waitingSpace ? "HIT SPACE" : "TRY THAT KEY",
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

  function accuracyOf(notes, misses) {
    if (!notes.length) return 100;
    const hits = notes.filter((n) => n.state === "hit").length;
    const total = hits + (misses || 0);
    if (!total) return 100;
    return Math.round((hits / total) * 100);
  }

  function renderPhraseStrip() {
    const el = $("rhythmPhrase");
    if (!el || !session) return;
    const phrase = session.rounds[session.roundIndex];
    const notes = session.chart.notes;
    let noteI = 0;
    const activeIdx = currentNoteIndex(notes);
    const html = [...phrase.text].map((ch) => {
      const note = notes[noteI];
      const on = noteI === activeIdx;
      const st = note?.state || "pending";
      noteI += 1;
      if (isSpaceChar(ch)) {
        return `<span class="tt-rhythm-ch tt-rhythm-ch--space tt-rhythm-ch--${st}${on ? " tt-rhythm-ch--now" : ""}" title="space">␣</span>`;
      }
      return `<span class="tt-rhythm-ch tt-rhythm-ch--${st}${on ? " tt-rhythm-ch--now" : ""}">${esc(ch)}</span>`;
    }).join("");
    el.innerHTML = html;
    const done = notes.filter((n) => n.state === "hit").length;
    const combo = $("rhythmCombo");
    const score = $("rhythmScore");
    const bpm = $("rhythmBpm");
    if (combo) combo.textContent = `${done} / ${notes.length}`;
    if (score) score.textContent = `${accuracyOf(notes, session.misses)}%`;
    if (bpm) bpm.textContent = `${liveKeysPerMin()} keys/min`;
  }

  function displayChar(ch) {
    if (isSpaceChar(ch)) return "SPACE";
    return ch;
  }

  function renderNextLetter(animate) {
    const lane = $("rhythmLane");
    const ring = $("rhythmRing");
    if (!lane || !session) return;
    const idx = currentNoteIndex(session.chart.notes);
    const note = idx >= 0 ? session.chart.notes[idx] : null;
    if (!note) {
      lane.innerHTML = "";
      if (ring) ring.textContent = "";
      return;
    }
    const letter = displayChar(note.char);
    const spaceCls = isSpaceChar(note.char) ? " tt-rhythm-note--space" : "";
    lane.innerHTML = `<span class="tt-rhythm-note tt-rhythm-note--solo${spaceCls}${animate ? " tt-rhythm-note--grow" : ""}">${esc(letter)}</span>`;
    if (ring) {
      ring.textContent = "";
      ring.classList.add("tt-rhythm__ring--hot");
    }
  }

  function endRound() {
    window.clearTimeout(countTimer);
    const acc = accuracyOf(session.chart.notes, session.misses);
    session.roundScores.push({
      title: session.rounds[session.roundIndex].title,
      accuracy: acc,
    });
    const passed = session.chart.notes.every((n) => n.state === "hit");
    session.phase = "result";
    const result = $("rhythmResult");
    const text = $("rhythmResultText");
    const retry = $("rhythmRetryBtn");
    const cont = $("rhythmContinueBtn");
    setHidden(result, false);
    const roundLabel = session.roundIndex === 0 ? "Digital citizenship" : "SPARK";
    if (text) {
      text.textContent = `${roundLabel}: ${acc}% first-try · ${liveKeysPerMin()} keys/min — sentence complete.`;
    }
    setHidden(retry, false);
    if (cont) {
      cont.textContent = session.roundIndex === 0 ? "SPARK phrase ▶" : "Enter next room ▶";
      setHidden(cont, false);
    }
    if (retry) retry.disabled = false;
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
    window.clearTimeout(countTimer);
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
    const hint = $("rhythmHint");
    if (kicker) {
      kicker.textContent = sessionRef.roundIndex === 0
        ? "Room phrase check · Digital citizenship"
        : "Room phrase check · SPARK";
    }
    if (title) title.textContent = phrase.title;
    if (meaning) meaning.textContent = phrase.meaning;
    if (hint) {
      hint.textContent = "Type the big letter. When it says SPACE, press the space bar to separate the words.";
    }
    const combo = $("rhythmCombo");
    const score = $("rhythmScore");
    const bpm = $("rhythmBpm");
    if (combo) combo.textContent = `0 / ${sessionRef.chart.notes.length}`;
    if (score) score.textContent = "100%";
    if (bpm) bpm.textContent = "0 keys/min";
  }

  function runCountIn(sessionRef) {
    const labels = ["3", "2", "1", "TYPE"];
    const countEl = $("rhythmCount");
    let i = 0;
    const tick = () => {
      if (!session || session !== sessionRef) return;
      if (i >= labels.length) {
        if (countEl) {
          countEl.textContent = "";
          countEl.classList.add("dw-hidden");
        }
        sessionRef.phase = "play";
        sessionRef.startedAt = performance.now();
        renderNextLetter(true);
        $("rhythmGate")?.focus?.();
        return;
      }
      if (countEl) {
        countEl.textContent = labels[i];
        countEl.classList.remove("dw-hidden");
      }
      try { Audio()?.playMetronomeClick?.(); } catch (_) { /* audio context not ready */ }
      i += 1;
      countTimer = window.setTimeout(tick, 520);
    };
    tick();
  }

  function startRound(sessionRef, { retry }) {
    if (retry && sessionRef.roundScores.length) sessionRef.roundScores.pop();
    const phrase = sessionRef.rounds[sessionRef.roundIndex];
    sessionRef.chart = buildChart(phrase.text);
    sessionRef.combo = 0;
    sessionRef.misses = 0;
    sessionRef.phase = "countdown";
    sessionRef.startedAt = 0;
    if (retry) sessionRef.attempts += 1;
    else sessionRef.attempts = 1;
    setHidden($("rhythmResult"), true);
    fillHud(sessionRef);
    renderPhraseStrip();
    const lane = $("rhythmLane");
    if (lane) lane.innerHTML = "";
    const ring = $("rhythmRing");
    if (ring) ring.textContent = "";
    window.clearTimeout(countTimer);
    runCountIn(sessionRef);
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
    const cfg = DIFFICULTY[difficulty] || DIFFICULTY.operative;
    const maxAttempts = difficulty === "analyst" ? 4 : 3;
    session = {
      nodeId: opts.nodeId,
      difficulty,
      reducedMotion: Boolean(opts.reducedMotion),
      cfg,
      rounds: pickPhrases(opts.nodeId, difficulty),
      roundIndex: 0,
      roundScores: [],
      chart: null,
      combo: 0,
      maxCombo: 0,
      misses: 0,
      attempts: 0,
      maxAttempts,
      phase: "countdown",
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
