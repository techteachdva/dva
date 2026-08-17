/**
 * Plain-language score bands and metric explanations for the writing diagnostic.
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
      studentParagraph: `You wrote ${analysis.wordCount} words in five minutes (${analysis.wpm} WPM). ${typingNote} Scores below are rubric bands — not letter grades — so you know what to celebrate and what to work on next.`,
      teacherParagraph: `${analysis.wordCount} words · ${analysis.wpm} WPM · typing: ${typing}. Overall band: ${b.label}. Use bands for grouping and next-step instruction, not as final grades.`,
    };
  }

  const METRICS = {
    volume: {
      title: "How much you wrote",
      teacherTitle: "Volume & stamina",
      studentWhat(score, a) {
        if (score >= 80) return "You wrote a lot in five minutes — great stamina for a first draft.";
        if (score >= 65) return "You produced a solid amount of writing under time pressure.";
        if (score >= 50) return "You got some ideas down; try to keep typing until the timer ends.";
        return "Very little was written in five minutes — focus on typing fluency and brainstorming starters.";
      },
      teacherWhat(score, a) {
        return `${a.wordCount} words in 5 min. ${score >= 65 ? "Adequate volume for analysis." : "Low volume — check typing skills vs. planning/engagement."}`;
      },
      evidence(a) {
        return `${a.wordCount} words · ${a.wpm} WPM`;
      },
    },
    typing: {
      title: "Typing speed",
      teacherTitle: "Typing fluency",
      studentWhat(score, a) {
        const lvl = a.typingLevel;
        if (lvl === "advanced") return "You type quickly enough that ideas can keep flowing.";
        if (lvl === "proficient") return "Your typing speed is workable — keep practicing to write more.";
        if (lvl === "developing") return "Typing slows you down sometimes — drills and keyboard practice will help.";
        return "Typing is hard right now — that's okay; practice will make writing feel easier.";
      },
      teacherWhat(score, a) {
        return `${Math.round(a.wpm)} WPM · ${a.wordCount} words. ${typingLabel(a.typingLevel)}.`;
      },
      evidence(a) {
        return `${a.wpm} WPM · ${typingLabel(a.typingLevel)}`;
      },
    },
    mechanics: {
      title: "Mechanics",
      teacherTitle: "Mechanics (spelling + conventions)",
      studentWhat(score, a) {
        if (score >= 80) return "Capital letters, punctuation, and spelling look strong for a rushed first draft.";
        if (score >= 65) return "Most sentences follow conventions; fix a few spelling or punctuation patterns in revision.";
        if (score >= 50) return "Some capitalization, punctuation, or spelling patterns need attention.";
        return "Conventions make writing hard to read — slow down on capitals, periods, and common spellings.";
      },
      teacherWhat(score, a) {
        const issues = (a.spelling?.misspellCount || 0) + (a.grammar?.errorCount || 0);
        return `Combined spelling/grammar index. ~${issues} flagged patterns. ${score >= 80 ? "Low editing load." : "Teach 1–2 convention targets, not everything at once."}`;
      },
      evidence(a) {
        return `Spelling ${a.scores?.spelling ?? "—"} · Grammar ${a.scores?.grammar ?? "—"}`;
      },
    },
    syntax: {
      title: "Sentence building",
      teacherTitle: "Syntax",
      studentWhat(score, a) {
        if (score >= 80) return "You mix short and long sentences and connect ideas with words like because, when, and but.";
        if (score >= 65) return "Your sentences mostly work; try varying length and using more connectors.";
        if (score >= 50) return "Sentences are similar in length or sometimes choppy — combine or split ideas on purpose.";
        return "Sentences need work — aim for complete thoughts, capitals, and a mix of short and long.";
      },
      teacherWhat(score, a) {
        return `Avg ${a.avgSentenceLength} words/sentence · variety ${a.sentenceVariety}. ${a.syntax?.complexMarkers ?? 0} complex markers (because, when, although…).`;
      },
      evidence(a) {
        return `Avg ${a.avgSentenceLength} w/sent · ${a.syntax?.complexMarkers ?? 0} connectors`;
      },
    },
    semantics: {
      title: "Word choice",
      teacherTitle: "Semantics / vocabulary",
      studentWhat(score, a) {
        if (score >= 80) return "You use specific, varied words — readers can picture your story.";
        if (score >= 65) return "Word choice is mostly clear; swap general words (good, nice, stuff) for precise ones.";
        if (score >= 50) return "Some words repeat or stay vague — name people, places, and actions.";
        return "Words are often general or repeated — add names, places, and vivid verbs.";
      },
      teacherWhat(score, a) {
        return `Lexical diversity ${a.lexicalDiversity} · ${a.semantics?.specificity ?? 0} concrete cues. Vocabulary mini-lessons if below 65.`;
      },
      evidence(a) {
        return `Diversity ${a.lexicalDiversity} · ${a.semantics?.specificity ?? 0} specific details`;
      },
    },
    voice: {
      title: "Your voice",
      teacherTitle: "Voice",
      studentWhat(score, a) {
        if (score >= 80) return "This sounds like YOU — personal words (I, my, we) and your perspective come through.";
        if (score >= 65) return "Your personality shows up; keep writing in first person about your own experience.";
        if (score >= 50) return "The story feels a bit distant — use I/my and tell how YOU felt.";
        return "Hard to hear your voice — write as yourself, not like a report.";
      },
      teacherWhat(score, a) {
        return `${a.voiceCount} first-person cues. ${score >= 65 ? "Authentic personal narrative tone." : "Encourage first-person reflection on feelings."}`;
      },
      evidence(a) {
        return `${a.voiceCount} I/my/we cues`;
      },
    },
    narrative: {
      title: "Storytelling",
      teacherTitle: "Narrative craft",
      studentWhat(score, a) {
        if (score >= 80) return "Your story has a clear sequence, details, and a sense of what happened.";
        if (score >= 65) return "Events connect reasonably well — add time words (then, finally) and how you felt.";
        if (score >= 50) return "The story is hard to follow — say what happened first, next, and last.";
        return "Focus on one summer moment: who, where, what happened, and how you felt.";
      },
      teacherWhat(score, a) {
        return `${a.sensoryCount} sensory · ${a.transitionCount} time words · ${a.dialogueLines} dialogue · ${a.conflictWords} tension words. Structure mini-lesson if transitions low.`;
      },
      evidence(a) {
        return `${a.sensoryCount} sensory · ${a.transitionCount} time words · ${a.dialogueLines} dialogue`;
      },
    },
    creativity: {
      title: "Creative detail",
      teacherTitle: "Creativity",
      studentWhat(score, a) {
        if (score >= 80) return "Vivid, creative choices — senses, dialogue, or tension make your story memorable.";
        if (score >= 65) return "Some creative flair; add more sights, sounds, feelings, or a line someone said.";
        if (score >= 50) return "The story is factual but flat — imagine the scene and describe it.";
        return "Try one sensory detail (what you saw/heard/felt) and one moment that surprised you.";
      },
      teacherWhat(score, a) {
        return `Craft index from sensory + transitions + dialogue + tension. ${score < 65 ? "Model show-don't-tell with mentor text." : "Good risk-taking for timed writing."}`;
      },
      evidence(a) {
        return `${a.sensoryCount} sensory · ${a.transitionCount} transitions · ${a.conflictWords} tension words`;
      },
    },
  };

  function typingLabel(level) {
    return {
      intervention: "Needs intervention",
      developing: "Developing",
      proficient: "Proficient",
      advanced: "Advanced",
    }[level] || level;
  }

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

  function studentScoreCards(analysis) {
    const s = analysis.scores || {};
    return [
      metricCard("volume", s.volume, analysis),
      metricCard("typing", s.typing, analysis),
      metricCard("mechanics", s.mechanics, analysis),
      metricCard("syntax", s.syntax, analysis),
      metricCard("semantics", s.semantics, analysis),
      metricCard("voice", s.voice, analysis),
      metricCard("narrative", s.narrative, analysis),
      metricCard("creativity", s.creativity, analysis),
    ].filter(Boolean);
  }

  function teacherMetricCards(analysis) {
    return studentScoreCards(analysis);
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
    studentScoreCards,
    teacherMetricCards,
    bandClass,
    scoreCardClass,
    typingLabel,
    METRICS,
  };
})();
