/**
 * Global Tech Gauntlet — Pedagogy layer
 * Fluency, proficiency, stamina, composition, and digital communication literacy.
 * Accuracy before speed; typing disappears into communication.
 */
(() => {
  "use strict";

  const ERROR_TYPES = {
    substitution: "Letter substitution",
    adjacent_key: "Adjacent-key slip",
    missing_capital: "Missing capitalization",
    missing_punctuation: "Missing punctuation",
    transposition: "Transposed letters",
    repeated_key: "Repeated key",
    space_error: "Space error",
    extra_char: "Extra character",
    omission: "Missing character",
    correction_heavy: "Many corrections",
  };

  const QWERTY_ADJACENT = {
    a: "qwsz", b: "vghn", c: "xdfv", d: "serfcx", e: "wsdr", f: "drtgvc", g: "ftyhbv",
    h: "gyujnb", i: "ujko", j: "huiknm", k: "jiolm", l: "kop", m: "njk", n: "bhjm",
    o: "iklp", p: "ol", q: "wa", r: "edft", s: "awedxz", t: "rfgy", u: "yhji",
    v: "cfgb", w: "qase", x: "zsdc", y: "tghu", z: "asx",
  };

  /** Online register glossary — meaning + context, not memorization drills */
  const CHAT_TERMS = {
    gtg: { term: "GTG", meaning: "Got to go", lesson: "A polite way to end a conversation without disappearing." },
    afk: { term: "AFK", meaning: "Away from keyboard", lesson: "Tell people when you step away so they are not left wondering." },
    brb: { term: "BRB", meaning: "Be right back", lesson: "Signals a short break — you plan to return soon." },
    btw: { term: "BTW", meaning: "By the way", lesson: "Introduces a side thought without changing the main topic." },
    fyi: { term: "FYI", meaning: "For your information", lesson: "Shares info without demanding a reply." },
    idk: { term: "IDK", meaning: "I don't know", lesson: "Informal honesty — fine with friends, not for formal school email." },
    imo: { term: "IMO", meaning: "In my opinion", lesson: "Marks your view as one perspective, not a fact." },
    tbh: { term: "TBH", meaning: "To be honest", lesson: "Conversational — tone depends on what follows." },
    ty: { term: "TY", meaning: "Thank you", lesson: "Quick gratitude in chat; spell it out for teachers." },
    np: { term: "NP", meaning: "No problem", lesson: "Friendly reply when someone thanks you." },
    dm: { term: "DM", meaning: "Direct message", lesson: "Private chat — different rules than a public thread." },
    irl: { term: "IRL", meaning: "In real life", lesson: "Separates offline life from online interaction." },
    gg: { term: "GG", meaning: "Good game", lesson: "Sportsmanship after a match — respectful closure." },
    lfg: { term: "LFG", meaning: "Looking for group / Let's go (context-dependent)", lesson: "Same letters can mean different things — read the room." },
  };

  /**
   * Chat etiquette missions — register, tone, privacy woven into gameplay.
   * Each mission: read context, type an appropriate response, learn a term.
   */
  const CHAT_MISSIONS = {
    leaving_chat: {
      id: "leaving_chat",
      title: "Leaving a conversation",
      skill: "Digital literacy · etiquette",
      termId: "gtg",
      context: "group",
      thread: [
        { from: "npc", name: "Maya", text: "Hey, are you still there? We need one more for the squad." },
        { from: "npc", name: "System", text: "You need to leave in one minute." },
      ],
      prompt: "Type a message that lets Maya know you are leaving without just disappearing.",
      acceptablePatterns: [
        /gtg/i, /got to go/i, /gotta go/i, /leave/i, /later/i, /talk.*later/i, /see you/i, /bye/i,
      ],
      registerExamples: {
        friends: "gtg, cya!",
        teammate: "GTG — I'll be back in about 10 minutes.",
        teacher: "I need to leave now. I'll finish this tomorrow.",
      },
      toneNote: "Disappearing without a word can confuse people. A short sign-off shows respect.",
      minChars: 8,
    },
    going_afk: {
      id: "going_afk",
      title: "Going AFK",
      skill: "Digital literacy · etiquette",
      termId: "afk",
      context: "game",
      thread: [
        { from: "npc", name: "Teammate", text: "We're waiting on you to start the puzzle." },
        { from: "npc", name: "You", text: "One sec — my dog just knocked something over." },
      ],
      prompt: "Type a message that tells your team you are stepping away and will be back.",
      acceptablePatterns: [
        /afk/i, /away from keyboard/i, /brb/i, /be right back/i, /back in/i, /step(ping)? away/i, /minute/i,
      ],
      registerExamples: {
        friends: "brb 2 min",
        teammate: "AFK — back in 5 minutes.",
        teacher: "I need to step away briefly. I'll return shortly.",
      },
      toneNote: "AFK = Away From Keyboard. Teams work better when people communicate absence.",
      minChars: 6,
    },
    misunderstood_tone: {
      id: "misunderstood_tone",
      title: "Misunderstood message",
      skill: "Composition · tone",
      termId: "tbh",
      context: "group",
      thread: [
        { from: "npc", name: "Jordan", text: "I think we should redo the whole slide." },
        { from: "npc", name: "Sam", text: "Whatever." },
        { from: "npc", name: "Jordan", text: "…are you mad at me?" },
      ],
      prompt: "Rewrite Sam's reply so it sounds respectful but still honest. Type your improved message.",
      acceptablePatterns: [
        /see what you mean/i, /not sure i agree/i, /different idea/i, /help me understand/i,
        /fair point/i, /can we/i, /maybe/i, /though/i, /honest/i, /respect/i,
      ],
      badPatterns: [/whatever/i, /^k\.?$/i, /idc/i, /shut up/i],
      registerExamples: {
        blunt: "Whatever.",
        better: "I see what you mean. I'm not sure I agree, though — can we compare both versions?",
      },
      toneNote: "Short replies like \"K.\" or \"Whatever.\" are easy to misread. Add context and warmth.",
      minChars: 20,
    },
    privacy_dm: {
      id: "privacy_dm",
      title: "Privacy in chat",
      skill: "Digital literacy · safety",
      termId: "dm",
      context: "private",
      thread: [
        { from: "npc", name: "Stranger", text: "Hey! What school do you go to? Send me your address so we can meet IRL." },
      ],
      prompt: "Type a response that protects your privacy. Do not share personal information.",
      acceptablePatterns: [
        /don't share/i, /won't share/i, /not comfortable/i, /private/i, /don't know you/i,
        /adult/i, /report/i, /block/i, /no thanks/i, /personal information/i, /stranger/i,
      ],
      badPatterns: [
        /\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/, /my address/i, /i live at/i, /@\w+\.(com|org)/i,
      ],
      registerExamples: {
        unsafe: "Sure, I live at 123 Main St.",
        safe: "I don't share personal info with people I don't know. Please stop asking.",
      },
      toneNote: "Never share passwords, addresses, phone numbers, or account info in chat.",
      minChars: 15,
    },
    punctuation_tone: {
      id: "punctuation_tone",
      title: "Punctuation changes meaning",
      skill: "Proficiency · conventions",
      termId: "imo",
      context: "group",
      thread: [
        { from: "npc", name: "Prompt", text: "Compare: \"Lets go\" vs \"Let's go!\" vs \"Let's go.\"" },
      ],
      prompt: "Type a sentence using \"Let's go\" with punctuation that sounds encouraging (not angry).",
      acceptablePatterns: [/let'?s go[!.,]?/i],
      requirePunctuation: true,
      registerExamples: {
        flat: "lets go",
        encouraging: "Let's go — we can do this!",
      },
      toneNote: "Capitalization and punctuation carry tone. \"Lets go\" can look rushed; \"Let's go!\" sounds energetic.",
      minChars: 12,
    },
  };

  function isAdjacent(a, b) {
    if (!a || !b) return false;
    const la = a.toLowerCase();
    const lb = b.toLowerCase();
    return (QWERTY_ADJACENT[la] || "").includes(lb);
  }

  function isCapital(char) {
    return char >= "A" && char <= "Z";
  }

  function isPunctuation(char) {
    return /[.,!?;:'"—–-]/.test(char);
  }

  /**
   * Classify transcription errors from compareToTarget result.
   */
  function classifyErrors(target, input, cmp, keystrokeStats) {
    const counts = {
      substitution: 0,
      adjacent_key: 0,
      missing_capital: 0,
      missing_punctuation: 0,
      transposition: 0,
      repeated_key: 0,
      space_error: 0,
      extra_char: 0,
      omission: 0,
      correction_heavy: 0,
    };

    const raw = String(input || "");
    const t = String(target || "");

    if (cmp?.chars) {
      for (const c of cmp.chars) {
        if (c.state === "extra") counts.extra_char++;
        if (c.state === "wrong" && c.expected) {
          if (isAdjacent(c.char, c.expected)) counts.adjacent_key++;
          else counts.substitution++;
        }
      }
    }

    const rawLen = raw.length;
    const targetLen = t.length;
    if (targetLen > rawLen) counts.omission += targetLen - rawLen;

    for (let i = 0; i < Math.min(rawLen, targetLen); i++) {
      const exp = t[i];
      const got = raw[i];
      if (exp === got) continue;
      if (exp === " " && got !== " ") counts.space_error++;
      if (isCapital(exp) && got === exp.toLowerCase()) counts.missing_capital++;
      if (isPunctuation(exp) && got !== exp) counts.missing_punctuation++;
      if (i + 1 < targetLen && got === t[i + 1] && exp === t[i]) counts.transposition++;
      if (got === raw[i - 1] && i > 0 && got === raw[i - 1]) counts.repeated_key++;
    }

    const backspaces = keystrokeStats?.backspaceCount || 0;
    if (rawLen > 0 && backspaces > rawLen * 0.2) counts.correction_heavy++;

    const totalErrors = Object.values(counts).reduce((s, n) => s + n, 0);
    const typed = Math.max(1, rawLen);
    const correct = cmp?.correctCount ?? 0;
    const accuracy = cmp?.targetLength
      ? correct / Math.max(cmp.targetLength, typed)
      : totalErrors === 0 ? 1 : Math.max(0, 1 - totalErrors / typed);

    return {
      counts,
      totalErrors,
      accuracy: Math.min(1, Math.max(0, accuracy)),
      accuracyPct: Math.round(Math.min(1, Math.max(0, accuracy)) * 100),
    };
  }

  /**
   * Performance = accuracy × useful output × consistency (not raw WPM).
   */
  function computePerformanceScore(cfg) {
    const accuracy = Math.max(0, Math.min(1, cfg.accuracy ?? 0));
    const output = Math.max(0, Math.min(1, cfg.usefulOutput ?? cfg.wordSoft ?? 0));
    const consistency = Math.max(0, Math.min(1, cfg.consistency ?? 1));
    const speedFactor = Math.max(0, Math.min(1, cfg.speedFactor ?? 0.5));
    const score = accuracy * output * (0.55 * consistency + 0.45 * speedFactor);
    return {
      score: Math.round(score * 100),
      accuracy,
      output,
      consistency,
      speedFactor,
      formula: "accuracy × useful output × (consistency + speed)",
    };
  }

  function dominantError(counts) {
    let best = null;
    let bestN = 0;
    Object.entries(counts || {}).forEach(([k, n]) => {
      if (n > bestN) {
        bestN = n;
        best = k;
      }
    });
    return best && bestN > 0 ? best : null;
  }

  function buildAdaptiveTip(errorAnalysis, keystrokeStats) {
    const tips = [];
    const c = errorAnalysis?.counts || {};

    if (c.missing_capital >= 2) {
      tips.push("Your accuracy is solid, but capitalization slips in — try the Shift key at sentence starts.");
    }
    if (c.missing_punctuation >= 2) {
      tips.push("Watch punctuation — periods and commas help readers understand your tone.");
    }
    if (c.adjacent_key >= 3) {
      tips.push("Nearby-key slips — slow down slightly on letter pairs your fingers share.");
    }
    if (c.space_error >= 2) {
      tips.push("Space-bar timing — press space once between words, not twice.");
    }
    if (c.correction_heavy >= 1 || (keystrokeStats?.backspaceCount > 20)) {
      tips.push("Lots of corrections — read ahead one word before you type.");
    }
    if (c.substitution >= 3 && c.adjacent_key < 2) {
      tips.push("Letter substitutions — check finger placement on home row.");
    }

    const dom = dominantError(c);
    if (!tips.length && dom) {
      tips.push(`Focus next: ${ERROR_TYPES[dom] || dom}.`);
    }
    if (!tips.length) {
      tips.push("Strong accuracy — keep communicating ideas clearly.");
    }
    return tips[0];
  }

  function buildCompositionTip(accuracy, words, minWords) {
    if (words < minWords * 0.5) {
      return "Composition challenge — focus on what you want to say, then let your fingers catch up.";
    }
    if (accuracy < 0.6) {
      return "Write in real sentences. Random letters slow you down without helping communication.";
    }
    if (words >= minWords && accuracy >= 0.75) {
      return "Good ideas + clear typing — you are communicating, not just copying.";
    }
    return "Think first, type second. Your message matters more than your speed.";
  }

  function consistencyFromKeystrokes(stats) {
    if (!stats) return 0.85;
    const back = stats.backspaceCount || 0;
    const typed = stats.typedChars || stats.charCount || 1;
    const ratio = back / Math.max(1, typed);
    return Math.max(0.4, Math.min(1, 1 - ratio * 0.8));
  }

  function evaluateCompositionUnlock(cfg) {
    const words = Math.max(0, cfg.words || 0);
    const minWords = Math.max(1, cfg.minWords || 20);
    const accuracy = Math.max(0, Math.min(1, cfg.accuracy ?? 0));
    const accuracyMin = cfg.accuracyMin ?? 0.68;
    const minWordsFloor = cfg.minWordsFloor ?? 4;
    const wordSoft = Math.min(1, words / minWords);
    const consistency = cfg.consistency ?? 0.85;
    const speedRatio = cfg.targetCpm > 0 ? (cfg.liveCpm || 0) / cfg.targetCpm : 1;
    const speedFactor = Math.min(1, Math.max(0.35, speedRatio * 0.7));

    const perf = computePerformanceScore({
      accuracy,
      usefulOutput: wordSoft,
      consistency,
      speedFactor,
    });

    const accuracyOk = accuracy >= accuracyMin;
    const enoughFloor = words >= minWordsFloor;
    const unlocked = enoughFloor && accuracyOk && (perf.score >= 52 || (accuracy >= 0.82 && wordSoft >= 0.45));

    return {
      unlocked,
      score: perf.score / 100,
      performanceScore: perf.score,
      speedOk: speedRatio >= (cfg.speedGate ?? 0.85),
      accuracyOk,
      speedRatio,
      wordSoft,
      perf,
    };
  }

  function evaluateTranscriptionUnlock(cmp, cfg) {
    const errorAnalysis = classifyErrors(cfg.target, cfg.input, cmp);
    const accuracy = errorAnalysis.accuracy;
    const complete = Boolean(cmp?.complete);
    const typoOk = !cmp || (cmp.typoCount || 0) <= (cfg.typoBudget ?? 0);
    const consistency = cfg.consistency ?? 0.9;
    const speedRatio = cfg.targetCpm > 0 ? (cfg.liveCpm || 0) / cfg.targetCpm : 1;
    const speedFactor = Math.min(1, Math.max(0.4, speedRatio * 0.6));
    const tier = cfg.tier || "operative";

    const perf = computePerformanceScore({
      accuracy,
      usefulOutput: complete ? 1 : (cmp?.progress || 0) / 100,
      consistency,
      speedFactor,
    });

    let unlocked = false;
    if (tier === "cadet") {
      unlocked = complete && typoOk && accuracy >= 0.75;
    } else if (tier === "analyst") {
      unlocked = complete && typoOk && accuracy >= 0.92 && speedRatio >= (cfg.speedGate ?? 1);
    } else {
      unlocked = complete && typoOk && accuracy >= 0.88 && perf.score >= 45;
    }

    return {
      unlocked,
      score: perf.score / 100,
      performanceScore: perf.score,
      accuracyOk: accuracy >= 0.85,
      speedOk: speedRatio >= (cfg.speedGate ?? 0.85),
      speedRatio,
      wordSoft: complete ? 1 : 0,
      errorAnalysis,
      perf,
    };
  }

  function scoreChatResponse(mission, text) {
    const raw = String(text || "").trim();
    if (raw.length < (mission.minChars || 8)) {
      return { passed: false, reason: "Type a complete message — a few words at least." };
    }
    if (mission.badPatterns) {
      for (const pat of mission.badPatterns) {
        if (pat.test(raw)) {
          return { passed: false, reason: "That reply could harm trust or safety — try again." };
        }
      }
    }
    if (mission.requirePunctuation && !/[.!?,]/.test(raw)) {
      return { passed: false, reason: "Add punctuation so your tone is clear." };
    }
    const patterns = mission.acceptablePatterns || [];
    const matched = patterns.some((p) => p.test(raw));
    if (!matched && patterns.length) {
      return { passed: false, reason: "Good try — address the situation directly (leaving, AFK, privacy, or tone)." };
    }
    return { passed: true, reason: "Appropriate register for the situation." };
  }

  function blankPedagogyProfile() {
    return {
      sessions: 0,
      bestAccuracyPct: 0,
      bestPerformanceScore: 0,
      accuracyStreak: 0,
      termsLearned: [],
      errorTotals: {},
      lastTip: "",
      chatMissionsCompleted: [],
      warmupsCompleted: 0,
      guildQuestStep: 0,
      compositionUnlocks: 0,
      transcriptionUnlocks: 0,
    };
  }

  function mergePedagogyProfile(raw) {
    const base = blankPedagogyProfile();
    if (!raw || typeof raw !== "object") return base;
    return {
      ...base,
      ...raw,
      termsLearned: Array.isArray(raw.termsLearned) ? raw.termsLearned : [],
      chatMissionsCompleted: Array.isArray(raw.chatMissionsCompleted) ? raw.chatMissionsCompleted : [],
      errorTotals: raw.errorTotals && typeof raw.errorTotals === "object" ? raw.errorTotals : {},
    };
  }

  function recordSession(profile, data) {
    const ped = mergePedagogyProfile(profile.pedagogy);
    ped.sessions += 1;
    if (data.accuracyPct > ped.bestAccuracyPct) ped.bestAccuracyPct = data.accuracyPct;
    if (data.performanceScore > ped.bestPerformanceScore) ped.bestPerformanceScore = data.performanceScore;
    if (data.accuracyPct >= 90) ped.accuracyStreak += 1;
    else ped.accuracyStreak = 0;

    Object.entries(data.errorCounts || {}).forEach(([k, n]) => {
      ped.errorTotals[k] = (ped.errorTotals[k] || 0) + n;
    });

    if (data.tip) ped.lastTip = data.tip;
    if (data.termId && !ped.termsLearned.includes(data.termId)) {
      ped.termsLearned.push(data.termId);
    }
    if (data.chatMissionId && !ped.chatMissionsCompleted.includes(data.chatMissionId)) {
      ped.chatMissionsCompleted.push(data.chatMissionId);
    }
    if (data.warmupCompleted) ped.warmupsCompleted = (ped.warmupsCompleted || 0) + 1;
    if (data.guildQuestStep != null) ped.guildQuestStep = data.guildQuestStep;
    if (data.compositionUnlock) ped.compositionUnlocks = (ped.compositionUnlocks || 0) + 1;
    if (data.transcriptionUnlock) ped.transcriptionUnlocks = (ped.transcriptionUnlocks || 0) + 1;

    if (!Array.isArray(ped.eventLog)) ped.eventLog = [];
    ped.eventLog.push({
      at: Date.now(),
      type: data.eventType || "session",
      studentName: data.studentName || null,
      classroom: data.classroom || null,
      runId: data.runId || null,
      node: data.node || null,
      accuracyPct: data.accuracyPct ?? null,
      performanceScore: data.performanceScore ?? null,
      detail: data.detail || null,
    });
    if (ped.eventLog.length > 250) ped.eventLog = ped.eventLog.slice(-250);

    profile.pedagogy = ped;
    return ped;
  }

  /** Stamina tiers — gradually longer composition expectations across runs */
  const STAMINA_TIERS = [
    { label: "Cadet writer", minSessions: 0, wordMult: 1, minutes: 5 },
    { label: "Steady typist", minSessions: 4, wordMult: 1.1, minutes: 7 },
    { label: "Focused composer", minSessions: 8, wordMult: 1.2, minutes: 10 },
    { label: "Sustained writer", minSessions: 14, wordMult: 1.35, minutes: 12 },
    { label: "Mission author", minSessions: 20, wordMult: 1.5, minutes: 15 },
    { label: "Guild communicator", minSessions: 28, wordMult: 1.65, minutes: 20 },
  ];

  function staminaTier(pedagogy) {
    const sessions = pedagogy?.sessions || 0;
    let tier = STAMINA_TIERS[0];
    for (const t of STAMINA_TIERS) {
      if (sessions >= t.minSessions) tier = t;
    }
    return tier;
  }

  function staminaMinWords(baseMinWords, pedagogy) {
    const tier = staminaTier(pedagogy);
    return Math.max(3, Math.round(baseMinWords * tier.wordMult));
  }

  /** Targeted warm-up drills by dominant error pattern */
  const WARMUP_DRILLS = {
    missing_capital: [
      "Always capitalize the first word.",
      "Mr. Phil says: Think before you post.",
      "Design for people, not just for flash.",
    ],
    missing_punctuation: [
      "Is it true? Is it kind? Is it necessary?",
      "Check the source, then share.",
      "Be a good digital citizen.",
    ],
    adjacent_key: [
      "The quick brown fox jumped.",
      "Private data is not a joke.",
      "Success in class: try again.",
    ],
    substitution: [
      "Guard your login with unique passwords.",
      "Decode the headline before you share.",
      "Help a teammate without copying.",
    ],
    default: [
      "Always think carefully before you share online.",
      "Good designers build technology for real people.",
      "The internet remembers what you post.",
    ],
  };

  function pickWarmupDrills(pedagogy, count = 3) {
    const dom = dominantError(pedagogy?.errorTotals || {});
    const pool = WARMUP_DRILLS[dom] || WARMUP_DRILLS.default;
    const out = [];
    const used = new Set();
    while (out.length < count && used.size < pool.length) {
      const i = Math.floor(Math.random() * pool.length);
      if (!used.has(i)) {
        used.add(i);
        out.push(pool[i]);
      }
    }
    return out;
  }

  /** Tone meter scenarios — how might this be read? */
  const TONE_SCENARIOS = {
    short_k: {
      message: "K.",
      context: "A teammate asks if you finished the group project slide.",
      interpretations: [
        { id: "dismissive", label: "Dismissive / annoyed", correct: false },
        { id: "neutral", label: "Neutral / busy", correct: false },
        { id: "friendly", label: "Could sound cold without context", correct: true },
      ],
      lesson: "Very short replies are easy to misread. Add a few words: \"Okay, almost done!\"",
      revisionPrompt: "Type a warmer version of \"K.\" for a teammate waiting on you.",
      revisionPatterns: [/okay/i, /almost/i, /done/i, /working/i, /minute/i, /thanks/i, /!/],
    },
    whatever: {
      message: "Whatever.",
      context: "Someone suggests redoing a slide after feedback.",
      interpretations: [
        { id: "angry", label: "Angry / shut down", correct: true },
        { id: "casual", label: "Casual / fine", correct: false },
        { id: "agree", label: "Agreeing", correct: false },
      ],
      lesson: "\"Whatever\" often reads as disrespect even when you don't mean it that way.",
      revisionPrompt: "Rewrite so you disagree respectfully.",
      revisionPatterns: [/see what you mean/i, /not sure/i, /different/i, /though/i, /help/i],
    },
  };

  /** Chat Quest guild — sequential mission loop */
  const GUILD_QUEST_STEPS = [
    { missionId: "leaving_chat", intro: "Guild Hall — A cadet pings you. Practice signing off politely." },
    { missionId: "going_afk", intro: "Raid night — Tell your squad you are stepping away." },
    { missionId: "misunderstood_tone", intro: "Guild chat drama — Fix a message that sounded mean." },
    { missionId: "privacy_dm", intro: "A stranger DMs you — Protect your privacy." },
    { missionId: "punctuation_tone", intro: "Final briefing — Punctuation sets your tone." },
  ];

  function guildQuestStep(pedagogy) {
    const done = pedagogy?.chatMissionsCompleted || [];
    for (let i = 0; i < GUILD_QUEST_STEPS.length; i++) {
      if (!done.includes(GUILD_QUEST_STEPS[i].missionId)) return { index: i, ...GUILD_QUEST_STEPS[i] };
    }
    return null;
  }

  function snapshotForSubmit(pedagogy, typingProfile, runState = {}) {
    const ped = mergePedagogyProfile(pedagogy);
    const dom = dominantError(ped.errorTotals);
    const tier = staminaTier(ped);
    return {
      sessions: ped.sessions,
      bestAccuracyPct: ped.bestAccuracyPct,
      bestPerformanceScore: ped.bestPerformanceScore,
      accuracyStreak: ped.accuracyStreak,
      termsLearned: [...ped.termsLearned],
      chatMissionsCompleted: [...ped.chatMissionsCompleted],
      errorTotals: { ...ped.errorTotals },
      dominantError: dom,
      dominantErrorLabel: dom ? ERROR_TYPES[dom] : null,
      warmupsCompleted: ped.warmupsCompleted || 0,
      guildQuestStep: ped.guildQuestStep || 0,
      staminaTier: tier.label,
      staminaWordMult: tier.wordMult,
      testCpm: typingProfile?.testCpm ?? null,
      targetCpm: typingProfile?.targetCpm ?? null,
      diagnosed: Boolean(typingProfile?.diagnosed),
      integrity: runState.integrity ?? null,
      reputation: runState.reputation ?? null,
      compositionUnlocks: ped.compositionUnlocks || 0,
      transcriptionUnlocks: ped.transcriptionUnlocks || 0,
      studentName: runState.studentName ?? null,
      classroom: runState.classroom ?? null,
      runId: runState.runId ?? null,
      eventLog: Array.isArray(ped.eventLog) ? ped.eventLog.slice(-120) : [],
    };
  }

  function aggregateClassPedagogy(submissions) {
    const agg = {
      count: 0,
      avgBestAccuracy: 0,
      avgBestScore: 0,
      avgSessions: 0,
      diagnosedCount: 0,
      errorTotals: {},
      missionCounts: {},
      termCounts: {},
    };
    const withPed = submissions.filter((s) => s.pedagogy);
    if (!withPed.length) return agg;
    agg.count = withPed.length;
    let accSum = 0;
    let scoreSum = 0;
    let sessSum = 0;
    withPed.forEach((s) => {
      const p = s.pedagogy;
      accSum += p.bestAccuracyPct || 0;
      scoreSum += p.bestPerformanceScore || 0;
      sessSum += p.sessions || 0;
      if (p.diagnosed) agg.diagnosedCount++;
      Object.entries(p.errorTotals || {}).forEach(([k, n]) => {
        agg.errorTotals[k] = (agg.errorTotals[k] || 0) + n;
      });
      (p.chatMissionsCompleted || []).forEach((m) => {
        agg.missionCounts[m] = (agg.missionCounts[m] || 0) + 1;
      });
      (p.termsLearned || []).forEach((t) => {
        agg.termCounts[t] = (agg.termCounts[t] || 0) + 1;
      });
    });
    agg.avgBestAccuracy = Math.round(accSum / withPed.length);
    agg.avgBestScore = Math.round(scoreSum / withPed.length);
    agg.avgSessions = Math.round(sessSum / withPed.length);
    agg.dominantError = dominantError(agg.errorTotals);
    agg.dominantErrorLabel = agg.dominantError ? ERROR_TYPES[agg.dominantError] : null;
    return agg;
  }

  window.TechTrailPedagogy = {
    ERROR_TYPES,
    CHAT_TERMS,
    CHAT_MISSIONS,
    WARMUP_DRILLS,
    TONE_SCENARIOS,
    GUILD_QUEST_STEPS,
    STAMINA_TIERS,
    classifyErrors,
    computePerformanceScore,
    buildAdaptiveTip,
    buildCompositionTip,
    consistencyFromKeystrokes,
    evaluateCompositionUnlock,
    evaluateTranscriptionUnlock,
    scoreChatResponse,
    blankPedagogyProfile,
    mergePedagogyProfile,
    recordSession,
    dominantError,
    staminaTier,
    staminaMinWords,
    pickWarmupDrills,
    guildQuestStep,
    snapshotForSubmit,
    aggregateClassPedagogy,
  };
})();
