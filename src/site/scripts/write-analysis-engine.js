/**
 * Shared writing analysis engine (extracted from SWAT diagnostic-writing.js).
 * Used by WriteFlow Studio and ITEM Diagnostic typing sections.
 */
(() => {
  "use strict";

  const STOP_WORDS = new Set([
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of",
    "is", "was", "it", "i", "we", "they", "he", "she", "my", "our", "that",
    "this", "with", "as", "be", "had", "have", "has", "were", "are", "am",
  ]);

  const COMMON_MISSPELLINGS = {
    teh: "the", recieve: "receive", becuase: "because", wierd: "weird",
    freind: "friend", definately: "definitely", alot: "a lot", seperate: "separate",
    occured: "occurred", thier: "their", untill: "until", realy: "really",
    happend: "happened", writting: "writing", dont: "don't", wont: "won't",
    cant: "can't", didnt: "didn't", im: "I'm", youre: "you're",
  };

  const SENSORY_PATTERN =
    /\b(saw|see|heard|hear|felt|feel|smelled|taste|touched|bright|dark|loud|quiet|cold|warm|hot|scary|exciting|beautiful|amazing|funny|nervous|happy|sad|angry|surprised)\b/gi;
  const SUBORDINATOR_PATTERN =
    /\b(because|although|though|while|when|if|since|unless|until|before|after|where|whereas|even though|so that|in order to)\b/gi;
  const TRANSITION_PATTERN =
    /\b(then|next|finally|suddenly|meanwhile|later|afterward|eventually|first|second|lastly|soon|at first|in the end)\b/gi;
  const CONCRETE_PATTERN =
    /\b(house|school|friend|mom|dad|brother|sister|dog|cat|bike|car|park|food|morning|night|computer|phone|internet|data|password)\b/gi;
  const VOICE_PATTERN = /\b(i|me|my|mine|we|us|our|myself)\b/gi;

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function getCalibration() {
    return window.DWCalibration || {};
  }

  function calBreakpoints(key, fallback) {
    return getCalibration()[key] || fallback;
  }

  function scoreFromRange(value, breakpoints) {
    for (let i = 0; i < breakpoints.length - 1; i++) {
      const [v0, s0] = breakpoints[i];
      const [v1, s1] = breakpoints[i + 1];
      if (value <= v1) {
        const t = (value - v0) / (v1 - v0 || 1);
        return Math.round(s0 + t * (s1 - s0));
      }
    }
    return breakpoints[breakpoints.length - 1][1];
  }

  function getSentences(text) {
    return text.split(/[.!?]+/).map((s) => s.trim()).filter((s) => s.length > 0);
  }

  function normalizeWord(w) {
    return w.toLowerCase().replace(/[^\w']/g, "");
  }

  function analyzeSpelling(text, words) {
    const issues = [];
    const lowerWords = words.map(normalizeWord);
    let misspellCount = 0;
    for (let i = 0; i < lowerWords.length; i++) {
      const w = lowerWords[i];
      if (COMMON_MISSPELLINGS[w]) {
        misspellCount++;
        if (issues.length < 5) issues.push(`"${words[i]}" → try "${COMMON_MISSPELLINGS[w]}"`);
      }
    }
    const rate = words.length > 0 ? misspellCount / words.length : 0;
    const score = clamp(Math.round(100 - rate * 220), 0, 100);
    return { score, misspellCount, issues };
  }

  function analyzeGrammar(text, sentences, words) {
    const issues = [];
    let errorCount = 0;
    for (const sent of sentences) {
      if (/^[a-z]/.test(sent.trim())) {
        errorCount++;
        if (issues.length < 4) issues.push("Some sentences don't start with a capital letter.");
      }
    }
    if (text.trim() && !/[.!?]["']?\s*$/.test(text.trim())) {
      errorCount++;
      issues.push("Add ending punctuation to your final sentence.");
    }
    const rate = words.length > 0 ? errorCount / Math.max(sentences.length, 1) : 0;
    return { score: clamp(Math.round(100 - rate * 18), 0, 100), issues: [...new Set(issues)].slice(0, 5) };
  }

  function analyzeSyntax(sentences, words, text) {
    const sentLengths = sentences.map((s) => s.split(/\s+/).filter(Boolean).length);
    const avgLen = sentLengths.reduce((a, b) => a + b, 0) / Math.max(sentLengths.length, 1);
    const variance = sentLengths.reduce((s, l) => s + (l - avgLen) ** 2, 0) / Math.max(sentLengths.length, 1);
    const variety = Math.sqrt(variance);
    const complexMarkers = (text.match(SUBORDINATOR_PATTERN) || []).length;
    const score = clamp(Math.round(
      scoreFromRange(variety, calBreakpoints("SYNTAX_VARIETY_BREAKPOINTS", [[0, 25], [2, 45], [5, 68], [8, 82], [12, 94]])) * 0.3 +
      scoreFromRange(avgLen, calBreakpoints("SYNTAX_LENGTH_BREAKPOINTS", [[0, 25], [6, 48], [10, 68], [14, 82], [20, 94]])) * 0.3 +
      scoreFromRange(complexMarkers, calBreakpoints("SYNTAX_COMPLEX_BREAKPOINTS", [[0, 35], [2, 55], [5, 72], [8, 86], [12, 100]])) * 0.4
    ), 0, 100);
    return { score, avgSentenceLength: Math.round(avgLen * 10) / 10, sentenceVariety: Math.round(variety * 10) / 10, issues: [] };
  }

  function analyzeSemantics(words, text) {
    const lowerWords = words.map(normalizeWord);
    const contentWords = lowerWords.filter((w) => w.length > 1 && !STOP_WORDS.has(w));
    const uniqueContent = new Set(contentWords);
    const lexicalDiversity = contentWords.length > 0 ? uniqueContent.size / contentWords.length : 0;
    const concreteCount = (text.match(CONCRETE_PATTERN) || []).length;
    const properNouns = (text.match(/\b[A-Z][a-z]+/g) || []).length;
    const specificity = concreteCount + properNouns;
    const score = clamp(Math.round(
      scoreFromRange(lexicalDiversity, calBreakpoints("SEMANTICS_LEX_BREAKPOINTS", [[0, 30], [0.35, 58], [0.55, 80], [0.72, 100]])) * 0.5 +
      scoreFromRange(specificity, calBreakpoints("SEMANTICS_SPEC_BREAKPOINTS", [[0, 30], [3, 62], [8, 84], [16, 100]])) * 0.5
    ), 0, 100);
    return { score, lexicalDiversity: Math.round(lexicalDiversity * 100) / 100, specificity, issues: [] };
  }

  function classifyTyping(wordCount, wpm) {
    const tiers = getCalibration().TYPING_TIERS || {
      intervention: { maxWords: 35, maxWpm: 7 },
      developing: { maxWords: 65, maxWpm: 11 },
      proficient: { maxWords: 105, maxWpm: 18 },
    };
    if (wordCount < tiers.intervention.maxWords || wpm < tiers.intervention.maxWpm) return "intervention";
    if (wordCount < tiers.developing.maxWords || wpm < tiers.developing.maxWpm) return "developing";
    if (wordCount < tiers.proficient.maxWords || wpm < tiers.proficient.maxWpm) return "proficient";
    return "advanced";
  }

  function analyzeText(text, durationSec, options = {}) {
    const vocabWords = options.vocabWords || [];
    const words = text.trim() ? text.trim().split(/\s+/) : [];
    const wordCount = words.length;
    const minutes = durationSec / 60;
    const wpm = minutes > 0 ? wordCount / minutes : 0;
    const sentences = getSentences(text);

    const spelling = analyzeSpelling(text, words);
    const grammar = analyzeGrammar(text, sentences, words);
    const syntax = analyzeSyntax(sentences, words, text);
    const semantics = analyzeSemantics(words, text);
    const vocabulary = analyzeVocabulary(text, vocabWords);

    const sensoryCount = (text.match(SENSORY_PATTERN) || []).length;
    const transitionCount = (text.match(TRANSITION_PATTERN) || []).length;
    const voiceCount = (text.match(VOICE_PATTERN) || []).length;

    const volumeScore = scoreFromRange(wordCount, calBreakpoints("VOLUME_BREAKPOINTS", [
      [0, 0], [40, 32], [70, 55], [100, 72], [150, 88], [250, 100],
    ]));
    const wpmScore = scoreFromRange(wpm, calBreakpoints("WPM_BREAKPOINTS", [
      [0, 0], [10, 40], [17, 58], [24, 72], [32, 85], [45, 100],
    ]));
    const typingScore = clamp(Math.round(wpmScore * 0.55 + volumeScore * 0.45), 0, 100);
    const mechanicsScore = clamp(Math.round(spelling.score * 0.45 + grammar.score * 0.35 + syntax.score * 0.2), 0, 100);

    const storySubs = {
      voice: scoreFromRange(voiceCount, [[0, 40], [5, 68], [12, 88], [20, 100]]),
      detail: scoreFromRange(sensoryCount, [[0, 35], [2, 62], [4, 82], [8, 100]]),
      structure: scoreFromRange(transitionCount, [[0, 40], [2, 70], [4, 92], [6, 100]]),
      wordChoice: semantics.score,
    };
    const storyScore = clamp(Math.round(
      storySubs.voice * 0.2 + storySubs.detail * 0.25 + storySubs.structure * 0.25 + storySubs.wordChoice * 0.3
    ), 0, 100);

    const overallScore = computeOverallScore(
      { typing: typingScore, mechanics: mechanicsScore, story: storyScore },
      { assignmentMode: options.assignmentMode, rubrics: options.rubrics }
    );
    const typingLevel = classifyTyping(wordCount, wpm);
    const metricScores = {
      spelling: spelling.score, grammar: grammar.score, syntax: syntax.score,
      semantics: semantics.score, typing: typingScore, mechanics: mechanicsScore, story: storyScore,
      vocabulary: vocabulary.score,
      voice: storySubs.voice,
      detail: storySubs.detail,
      structure: storySubs.structure,
      wordChoice: storySubs.wordChoice,
    };
    const standards = window.DWStandards ? window.DWStandards.mapToStandards(metricScores) : { all: [], excelling: [], developing: [], needsSupport: [] };
    const teachingStandards = window.WriteFlowItemStandards?.analyzeAttachedStandards?.(
      text,
      options.teachingStandards || [],
      metricScores,
      { wordCount, wpm, durationSec, assignmentPrompt: options.assignmentPrompt || "" }
    ) || { attached: [], all: [], demonstrated: [], developing: [], notEvident: [], summary: null };

    return {
      wordCount,
      wpm: Math.round(wpm * 10) / 10,
      sentenceCount: sentences.length,
      typingLevel,
      spelling, grammar, syntax, semantics, storySubs, vocabulary,
      scores: { typing: typingScore, mechanics: mechanicsScore, story: storyScore, overall: overallScore, vocabulary: vocabulary.score },
      metricScores,
      standards,
      teachingStandards,
      feedback: buildFeedback(wordCount, wpm, typingLevel, spelling, grammar, storyScore, voiceCount, sensoryCount, vocabulary, {
        assignmentMode: options.assignmentMode,
        rubrics: options.rubrics,
      }),
    };
  }

  function escapeRegex(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function analyzeVocabulary(text, vocabWords = []) {
    const words = (vocabWords || []).map((w) => String(w).trim()).filter(Boolean);
    if (!words.length) {
      return { words: [], found: [], missing: [], hits: {}, score: 100, usedCount: 0, requiredCount: 0 };
    }
    const lower = text.toLowerCase();
    const found = [];
    const missing = [];
    const hits = {};
    for (const word of words) {
      const pattern = new RegExp(`\\b${escapeRegex(word.toLowerCase())}\\b`, "i");
      if (pattern.test(lower)) {
        found.push(word);
        hits[word] = (lower.match(new RegExp(`\\b${escapeRegex(word.toLowerCase())}\\b`, "gi")) || []).length;
      } else {
        missing.push(word);
      }
    }
    const score = Math.round((found.length / words.length) * 100);
    return {
      words,
      found,
      missing,
      hits,
      score,
      usedCount: found.length,
      requiredCount: words.length,
    };
  }

  const MODE_OVERALL_WEIGHTS = {
    composition: { typing: 0, mechanics: 0.35, story: 0.65 },
    fluency: { typing: 1, mechanics: 0, story: 0 },
    typing_practice: { typing: 1, mechanics: 0, story: 0 },
    reflection: { typing: 0, mechanics: 0.25, story: 0.75 },
  };

  function computeOverallScore(scores, options = {}) {
    const mode = options.assignmentMode || "composition";
    const rubrics = options.rubrics || Object.keys(MODE_OVERALL_WEIGHTS[mode] || {}).filter((k) => (MODE_OVERALL_WEIGHTS[mode]?.[k] ?? 0) > 0);
    const weights = MODE_OVERALL_WEIGHTS[mode] || { typing: 0.33, mechanics: 0.34, story: 0.33 };
    let sum = 0;
    let weightSum = 0;
    for (const key of rubrics) {
      const w = weights[key] ?? 0;
      const score = scores[key];
      if (w > 0 && Number.isFinite(score)) {
        sum += score * w;
        weightSum += w;
      }
    }
    if (weightSum > 0) return Math.round(sum / weightSum);
    return Math.round((scores.typing + scores.mechanics + scores.story) / 3);
  }

  function buildFeedback(wordCount, wpm, typingLevel, spelling, grammar, storyScore, voiceCount, sensoryCount, vocab, options = {}) {
    const mode = options.assignmentMode || "composition";
    const rubrics = options.rubrics || ["typing", "mechanics", "story"];
    const sections = [];

    if (rubrics.includes("typing") && (mode === "fluency" || mode === "typing_practice")) {
      sections.push({
        title: "Typing & stamina",
        items: [`You wrote ${wordCount} words (${Math.round(wpm)} WPM).`, typingLevel === "intervention" ? "Daily typing practice will help ideas flow faster." : null].filter(Boolean),
      });
    }

    if (rubrics.includes("mechanics")) {
      sections.push({
        title: "Mechanics",
        items: [spelling.score >= 75 ? "Spelling looks solid for a first draft." : "Watch spelling in revision.", grammar.score >= 75 ? "Conventions are mostly in place." : "Check capitals and ending punctuation."],
      });
    }

    if (rubrics.includes("story")) {
      const contentItems = [storyScore >= 65 ? "Your writing comes through clearly." : "Add specific details and your own voice."];
      if (mode === "reflection") {
        contentItems.push("Honest reflection is what matters — keep building on your ideas.");
      } else {
        contentItems.push(voiceCount >= 4 ? "Personal voice is present." : "Use I/my to keep it in your voice.");
        contentItems.push(sensoryCount >= 2 ? "Good sensory details." : "Add what you saw, heard, or felt.");
      }
      sections.push({ title: mode === "reflection" ? "Reflection" : "Content", items: contentItems });
    }

    if (vocab?.requiredCount) {
      sections.push({
        title: "Vocabulary",
        items: [
          `You used ${vocab.usedCount} of ${vocab.requiredCount} expected words.`,
          vocab.missing.length ? `Still try to include: ${vocab.missing.join(", ")}.` : "Great job using the expected vocabulary.",
        ],
      });
    }
    return sections;
  }

  window.WriteAnalysis = { analyzeText, classifyTyping, analyzeVocabulary, getSentences };
})();
