/**
 * Plain-language score bands for Typing · Mechanics · Story (+ Overall).
 */
(() => {
  "use strict";

  function band(score) {
    const n = Number(score);
    if (!Number.isFinite(n)) return { level: "unknown", label: "—", short: "—" };
    if (n >= 80) {
      return {
        level: "strong",
        label: "Strong",
        short: "Strong for a timed first draft",
        studentHeadline: "You're doing well here.",
        teacherHeadline: "Ready to stretch further or mentor peers.",
      };
    }
    if (n >= 65) {
      return {
        level: "on_track",
        label: "On track",
        short: "Solid — keep building",
        studentHeadline: "You're on the right path.",
        teacherHeadline: "Grade-level expectations for a first draft.",
      };
    }
    if (n >= 50) {
      return {
        level: "developing",
        label: "Developing",
        short: "Growing — needs practice",
        studentHeadline: "You're growing — a little more practice will help.",
        teacherHeadline: "Watch this area in mini-lessons and conferences.",
      };
    }
    return {
      level: "needs_support",
      label: "Needs support",
      short: "Extra help recommended",
      studentHeadline: "This is a good focus area — ask for help and keep trying.",
      teacherHeadline: "Plan scaffolds, small groups, or typing/writing interventions.",
    };
  }

  function overallSummary(analysis) {
    const b = band(analysis.scores?.overall);
    const typing = analysis.typingLevel || "developing";
    const typingNote = {
      intervention: "Typing fluency is the biggest barrier right now — short daily drills will help ideas flow.",
      developing: "Typing is coming along; more timed practice will help you write more in five minutes.",
      proficient: "You typed at a steady pace for five minutes.",
      advanced: "Strong typing stamina — you got a lot of ideas on the page quickly.",
    }[typing] || "";

    return {
      band: b,
      headline: `${b.label} overall (${analysis.scores?.overall ?? "—"}/100)`,
      studentParagraph: `You wrote ${analysis.wordCount} words in five minutes (${analysis.wpm} WPM). ${typingNote} Overall is the average of Typing, Mechanics, and Story — use the three scores below to see what to celebrate and what to work on next.`,
      teacherParagraph: `${analysis.wordCount} words · ${analysis.wpm} WPM · typing tier: ${typing}. Overall (${analysis.scores?.overall ?? "—"}) = average of Typing, Mechanics, and Story. Use bands for grouping, not final grades.`,
    };
  }

  function typingLabel(level) {
    return {
      intervention: "Needs intervention",
      developing: "Developing",
      proficient: "Proficient",
      advanced: "Advanced",
    }[level] || level;
  }

  const METRICS = {
    typing: {
      title: "Typing",
      teacherTitle: "Typing (speed + stamina)",
      studentWhat(score, a) {
        const lvl = a.typingLevel;
        if (lvl === "advanced") return "You type quickly and wrote a solid amount in five minutes.";
        if (lvl === "proficient") return "Your typing speed is workable — keep practicing to write more.";
        if (lvl === "developing") return "Typing slows you down sometimes — drills and keyboard practice will help.";
        return "Typing is hard right now — practice will make writing feel easier.";
      },
      teacherWhat(score, a) {
        return `${Math.round(a.wpm)} WPM · ${a.wordCount} words · ${typingLabel(a.typingLevel)}. Combines speed (${a.scores?.wpm ?? "—"}) and volume (${a.scores?.volume ?? "—"}).`;
      },
      evidence(a) {
        return `${a.wpm} WPM · ${a.wordCount} words · ${typingLabel(a.typingLevel)}`;
      },
    },
    mechanics: {
      title: "Mechanics",
      teacherTitle: "Mechanics (spelling, conventions, sentences)",
      studentWhat(score, a) {
        if (score >= 80) return "Capital letters, punctuation, spelling, and sentences look strong for a rushed first draft.";
        if (score >= 65) return "Most conventions are in place; fix a few spelling or sentence patterns in revision.";
        if (score >= 50) return "Some capitalization, punctuation, spelling, or sentence patterns need attention.";
        return "Conventions make writing hard to read — slow down on capitals, periods, and common spellings.";
      },
      teacherWhat(score, a) {
        const issues = (a.spelling?.misspellCount || 0) + (a.grammar?.errorCount || 0);
        return `Spelling ${a.scores?.spelling ?? "—"} · Grammar ${a.scores?.grammar ?? "—"} · Syntax ${a.scores?.syntax ?? "—"}. ~${issues} flagged patterns.`;
      },
      evidence(a) {
        return `Spell ${a.scores?.spelling ?? "—"} · Grammar ${a.scores?.grammar ?? "—"} · Syntax ${a.scores?.syntax ?? "—"}`;
      },
    },
    story: {
      title: "Story",
      teacherTitle: "Story (voice, craft & word choice)",
      studentWhat(score, a) {
        if (score >= 80) return "Your summer story has voice, specific details, and a clear sense of what happened.";
        if (score >= 65) return "Your story comes through — keep adding sensory details and time words.";
        if (score >= 50) return "You told a real story; strengthen it with I/my voice, specifics, and sequence words.";
        return "Focus on one summer moment: who, where, what happened, and how you felt.";
      },
      teacherWhat(score, a) {
        const subs = a.storySubs || {};
        return `Voice ${subs.voice ?? "—"} · Detail ${subs.detail ?? "—"} · Structure ${subs.structure ?? "—"} · Words ${subs.wordChoice ?? "—"}. One combined story score (not separate voice/narrative/creativity).`;
      },
      evidence(a) {
        const subs = a.storySubs || {};
        return `${a.sensoryCount ?? 0} sensory · ${a.transitionCount ?? 0} time words · ${a.voiceCount ?? 0} I/my/we · voice ${subs.voice ?? "—"} detail ${subs.detail ?? "—"}`;
      },
    },
    overall: {
      title: "Overall",
      teacherTitle: "Overall (average of three)",
      studentWhat(score, a) {
        return `Average of Typing (${a.scores?.typing ?? "—"}), Mechanics (${a.scores?.mechanics ?? "—"}), and Story (${a.scores?.story ?? "—"}).`;
      },
      teacherWhat(score, a) {
        return `Mean of Typing + Mechanics + Story. Not a weighted blend of old sub-scores.`;
      },
      evidence(a) {
        return `Typ ${a.scores?.typing ?? "—"} · Mech ${a.scores?.mechanics ?? "—"} · Story ${a.scores?.story ?? "—"}`;
      },
    },
  };

  function metricCard(id, score, analysis) {
    const m = METRICS[id];
    if (!m) return null;
    const b = band(score);
    return {
      id,
      title: m.title,
      teacherTitle: m.teacherTitle,
      score,
      band: b,
      studentWhat: m.studentWhat(score, analysis),
      teacherWhat: m.teacherWhat(score, analysis),
      evidence: m.evidence(analysis),
    };
  }

  function resolveStoryScore(analysis) {
    const s = analysis?.scores;
    if (!s) return null;
    if (Number.isFinite(s.story)) return s.story;
    const legacy = [s.narrative, s.voice, s.creativity].filter((v) => Number.isFinite(v));
    if (legacy.length) return Math.round(legacy.reduce((a, b) => a + b, 0) / legacy.length);
    return null;
  }

  function filterScoreCards(cards, rubrics) {
    const active = rubrics || ["typing", "mechanics", "story"];
    return (cards || []).filter((c) => c.id === "overall" || active.includes(c.id));
  }

  function studentScoreCards(analysis, rubrics) {
    const s = analysis.scores || {};
    const story = resolveStoryScore(analysis);
    return filterScoreCards([
      metricCard("typing", s.typing, analysis),
      metricCard("mechanics", s.mechanics, analysis),
      metricCard("story", story, analysis),
      metricCard("overall", s.overall, analysis),
    ].filter(Boolean), rubrics);
  }

  function teacherMetricCards(analysis, rubrics) {
    const s = analysis.scores || {};
    const story = resolveStoryScore(analysis);
    return filterScoreCards([
      metricCard("typing", s.typing, analysis),
      metricCard("mechanics", s.mechanics, analysis),
      metricCard("story", story, analysis),
    ].filter(Boolean), rubrics);
  }

  function bandClass(level) {
    return `dw-band dw-band--${level}`;
  }

  function scoreCardClass(level) {
    return `dw-score-card dw-score-card--${level}`;
  }

  window.DWRubrics = {
    band,
    overallSummary,
    metricCard,
    filterScoreCards,
    studentScoreCards,
    teacherMetricCards,
    bandClass,
    scoreCardClass,
    typingLabel,
    resolveStoryScore,
    METRICS,
  };
})();
