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
    sucess: "success", resposibility: "responsibility", responsability: "responsibility",
    aditude: "attitude", postive: "positive", kindnessss: "kindness", kindnesss: "kindness",
    grammer: "grammar", sentance: "sentence", peice: "piece", belive: "believe",
    diffrent: "different", allways: "always", basicly: "basically", gaurd: "guard",
  };

  const PROMPT_TERM_STOP = new Set([
    "what", "does", "mean", "your", "write", "about", "explain", "describe",
    "tell", "think", "that", "this", "with", "from", "they", "them", "when",
    "where", "which", "would", "could", "should", "their", "there", "have",
    "been", "being", "into", "some", "many", "much", "very", "just", "like",
  ]);

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

  const REFLECTION_SIGNALS = [
    { re: /\bmeans?\s+to\s+me\b/i, pts: 18, label: "personal meaning" },
    { re: /\bbecause\b/i, pts: 12, label: "reasoning" },
    { re: /\bi\s+think\b|\bi\s+believe\b|\bin\s+my\s+opinion\b/i, pts: 10, label: "personal stance" },
    { re: /\bfor\s+example\b|\bfor\s+instance\b/i, pts: 10, label: "example" },
    { re: /\bin\s+(tech|class|school|my\s+life)\b/i, pts: 8, label: "context" },
  ];

  function extractPromptTerms(prompt = "") {
    const words = String(prompt).toLowerCase().replace(/[^a-z0-9\s'-]/g, " ").split(/\s+/);
    const terms = [];
    for (const w of words) {
      const clean = w.replace(/'/g, "");
      if (clean.length >= 4 && !PROMPT_TERM_STOP.has(clean) && !STOP_WORDS.has(clean)) terms.push(clean);
    }
    return [...new Set(terms)].slice(0, 12);
  }

  function getContentWords(text) {
    return String(text).toLowerCase().replace(/[^a-z0-9\s'-]/g, " ").split(/\s+/)
      .map((w) => w.replace(/'/g, ""))
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
  }

  function jaccardSimilarity(wordsA, wordsB) {
    const setA = new Set(wordsA);
    const setB = new Set(wordsB);
    if (!setA.size || !setB.size) return 0;
    let inter = 0;
    for (const w of setA) if (setB.has(w)) inter++;
    return inter / (setA.size + setB.size - inter);
  }

  function stemMatch(word, stem) {
    const minLen = Math.min(4, word.length, stem.length);
    return word.startsWith(stem) || stem.startsWith(word.slice(0, minLen));
  }

  function analyzePromptSemantics(text, prompt = "") {
    if (!prompt.trim()) return { score: null, tier: null, conceptHits: [], jaccard: 0, stemHits: 0, termRate: 0 };
    const cal = getCalibration();
    const sem = cal.PROMPT_SEMANTICS || {};
    const tiers = sem.tierScores || {};
    const promptWords = getContentWords(prompt);
    const textWords = getContentWords(text);
    const jaccard = jaccardSimilarity(promptWords, textWords);
    const lower = text.toLowerCase();
    const terms = extractPromptTerms(prompt);
    const termHits = terms.filter((t) => lower.includes(t));
    const termRate = terms.length ? termHits.length / terms.length : 0;

    const conceptHits = [];
    let conceptScore = 0;
    const promptLower = prompt.toLowerCase();
    for (const cluster of cal.PROMPT_CONCEPT_CLUSTERS || []) {
      const relevant = (cluster.triggers || []).some((t) => promptLower.includes(t) || lower.includes(t));
      if (!relevant) continue;
      const matchedTerms = (cluster.terms || []).filter((t) => lower.includes(t));
      const contrastHits = (cluster.contrastTerms || []).filter((t) => lower.includes(t));
      if (matchedTerms.length) {
        conceptHits.push({ id: cluster.id, terms: matchedTerms.slice(0, 4), contrast: contrastHits.length });
        conceptScore += Math.min(28, matchedTerms.length * 8 + contrastHits.length * 6);
      }
    }
    conceptScore = Math.min(conceptScore, 55);

    let stemHits = 0;
    for (const group of cal.PROMPT_STEM_GROUPS || []) {
      const promptHas = group.some((stem) => promptWords.some((w) => stemMatch(w, stem)));
      if (!promptHas) continue;
      if (group.some((stem) => textWords.some((w) => stemMatch(w, stem)))) stemHits++;
    }
    const stemScore = Math.min(24, stemHits * 8);

    const hasSummaryPhrase = sem.summaryPhrases?.test(text);
    const hasDefinitionPhrase = sem.definitionPhrases?.test(text);
    let tier = "weak";
    if (termRate >= 0.75 || jaccard >= (sem.jaccardNearExact || 0.4)) tier = "exact";
    else if (termRate >= 0.5 || jaccard >= (sem.jaccardParaphrase || 0.24) || (stemHits >= 2 && conceptScore >= 20)) tier = "near";
    else if (hasDefinitionPhrase && (termRate >= 0.35 || conceptScore >= 16)) tier = "paraphrase";
    else if (hasSummaryPhrase && (termRate >= 0.25 || jaccard >= (sem.jaccardSummary || 0.14))) tier = "summary";
    else if (termRate >= 0.3 || conceptScore >= 12 || stemHits >= 1) tier = "partial";

    let score = tiers[tier] || 28;
    score = clamp(Math.round(score + conceptScore * 0.35 + stemScore * 0.4 + jaccard * 30), 0, 100);
    return {
      score,
      tier,
      conceptHits,
      jaccard: Math.round(jaccard * 100) / 100,
      stemHits,
      termRate: Math.round(termRate * 100) / 100,
      conceptScore,
    };
  }

  function analyzeCopyMatch(text, target) {
    if (!target) return null;
    const norm = (s) => String(s || "")
      .toLowerCase()
      .replace(/[\u2018\u2019']/g, "'")
      .replace(/\s+/g, " ")
      .trim();
    const t = norm(target);
    const raw = String(text || "");
    if (!t.length) return null;
    let correct = 0;
    let wrong = 0;
    let extra = 0;
    for (let i = 0; i < Math.max(raw.length, t.length); i++) {
      const expected = t[i];
      const typed = raw[i];
      if (expected === undefined) {
        if (typed !== undefined) extra++;
        continue;
      }
      if (typed === undefined) {
        wrong++;
        continue;
      }
      if (typed.toLowerCase() === expected) correct++;
      else wrong++;
    }
    const charAccuracy = correct / t.length;
    const complete = norm(raw) === t;
    const score = clamp(Math.round(charAccuracy * 100 - wrong * 2.5 - extra * 3 + (complete ? 10 : 0)), 0, 100);
    return { score, charAccuracy, correct, wrong, extra, complete, typoCount: wrong + extra };
  }

  function analyzeKeystrokeAccuracy(keystrokeStats, spellingScore, grammarScore) {
    const cal = getCalibration().KEYSTROKE_CALIBRATION || {};
    if (!keystrokeStats || keystrokeStats.totalKeys < (cal.minKeysForScoring || 15)) {
      if (cal.estimateFromMechanics !== false) {
        const estimated = clamp(Math.round(spellingScore * 0.5 + grammarScore * 0.5), 0, 100);
        return { score: estimated, source: "estimated", accuracyRate: null, correctionRate: null };
      }
      return { score: 70, source: "default", accuracyRate: null, correctionRate: null };
    }
    const corrections = (keystrokeStats.backspaces || 0) + (keystrokeStats.deletes || 0);
    const correctionRate = corrections / Math.max(keystrokeStats.totalKeys, 1);
    const productiveRate = Math.min(1, (keystrokeStats.insertChars || 0) / Math.max(keystrokeStats.totalKeys, 1));
    const pastePenalty = (keystrokeStats.pastedChars || 0) > 0 ? Math.min(15, keystrokeStats.pastedChars * 0.5) : 0;
    let score = 100 - correctionRate * (cal.correctionPenalty || 135) - pastePenalty;
    score = clamp(Math.round(score * 0.7 + productiveRate * 100 * 0.3), 0, 100);
    return {
      score,
      source: "live",
      accuracyRate: Math.round((1 - correctionRate) * 100),
      correctionRate: Math.round(correctionRate * 100),
    };
  }

  function analyzePromptResponse(text, prompt = "") {
    if (!prompt.trim()) return { score: null, termHits: [], termsChecked: 0, signals: [], exampleCount: 0, responseType: "normal" };
    const cal = getCalibration();
    const terms = extractPromptTerms(prompt);
    const lower = text.toLowerCase();
    const termHits = terms.filter((t) => lower.includes(t));
    const termRate = terms.length ? termHits.length / terms.length : 0;
    const signals = [];
    let signalScore = 0;
    for (const s of REFLECTION_SIGNALS) {
      if (s.re.test(text)) {
        signalScore += s.pts;
        signals.push(s.label);
      }
    }
    signalScore = Math.min(signalScore, 42);
    const termScore = Math.round(termRate * 58);
    let score = clamp(termScore + signalScore, 0, 100);
    const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
    const elaboration = scoreFromRange(wordCount, [[0, 20], [25, 42], [45, 55], [70, 68], [100, 78], [140, 88]]);
    score = clamp(Math.round(score * 0.72 + elaboration * 0.28), 0, 100);
    if (wordCount < 25 && termRate < 0.25 && signalScore < 12) score = Math.min(score, 38);
    if (wordCount >= 35 && termRate >= 0.5 && signalScore >= 10) score = Math.max(score, 58);

    const examplePattern = cal.EXAMPLE_NOUN_PATTERN;
    const exampleCount = examplePattern ? (text.match(examplePattern) || []).length : 0;
    const hasTechContrast = cal.TECH_CONTRAST_PATTERN?.test(text);
    const hasBecause = /\bbecause\b/i.test(text);
    const tc = cal.TEACHER_CALIBRATION?.reasoningBonus;
    if (tc) {
      if (hasBecause) score = Math.min(100, score + (tc.because || 0));
      if (hasTechContrast) score = Math.min(100, score + (tc.techContrast || 0));
    }
    const exBonus = cal.TEACHER_CALIBRATION?.exampleBonus;
    if (exBonus && exampleCount >= (exBonus.minExamples || 3)) {
      score = Math.min(100, score + Math.min((exampleCount - 2) * (exBonus.perExample || 4), exBonus.maxBonus || 16));
    }

    const semantic = analyzePromptSemantics(text, prompt);
    const semCfg = cal.PROMPT_SEMANTICS || {};
    if (semantic.score != null) {
      const hw = semCfg.heuristicWeight ?? 0.45;
      const sw = semCfg.semanticWeight ?? 0.55;
      score = clamp(Math.round(score * hw + semantic.score * sw), 0, 100);
    }

    let responseType = "normal";
    if (cal.DICTATION_PATTERN?.test(text)) responseType = "dictation";
    else if (cal.OFF_TOPIC_NARRATIVE_PATTERN?.test(text) && !hasTechContrast && exampleCount < 2) responseType = "off_topic";

    return {
      score, termHits, termsChecked: terms.length, signals, exampleCount, hasTechContrast, hasBecause, responseType,
      semantic, answerTier: semantic.tier,
    };
  }

  function detectResponseType(text, promptResponse) {
    if (promptResponse?.responseType && promptResponse.responseType !== "normal") return promptResponse.responseType;
    const cal = getCalibration();
    if (cal.DICTATION_PATTERN?.test(text)) return "dictation";
    const exampleCount = promptResponse?.exampleCount || 0;
    const hasTechContrast = promptResponse?.hasTechContrast;
    if (cal.OFF_TOPIC_NARRATIVE_PATTERN?.test(text) && !hasTechContrast && exampleCount < 2) return "off_topic";
    return "normal";
  }

  function applyTeacherCalibration(overallScore, scores, text, promptResponse, options = {}) {
    const cal = getCalibration();
    const tc = cal.TEACHER_CALIBRATION;
    if (!tc) return overallScore;

    const responseType = detectResponseType(text, promptResponse);
    if (responseType === "off_topic") return Math.min(overallScore, tc.offTopicCap || 15);
    if (responseType === "dictation") {
      const typing = scores.typing || 0;
      const mechanics = scores.mechanics || 0;
      const raw = typing * (tc.dictationTypingWeight || 0.5) + mechanics * (tc.dictationMechanicsWeight || 0.1);
      return clamp(Math.round(Math.min(raw, tc.dictationMaxScore || 12)), 0, 100);
    }

    const mode = options.assignmentMode || "composition";
    if (mode !== "reflection" && !options.assignmentPrompt) return overallScore;

    const exampleCount = promptResponse?.exampleCount || 0;
    const floorRule = tc.exampleAttemptFloor;
    if (floorRule && exampleCount >= (floorRule.minExamples || 2) && responseType === "normal") {
      const promptScore = promptResponse?.score || 0;
      const qualifies = promptScore >= 40
        || promptResponse?.hasTechContrast
        || promptResponse?.hasBecause
        || (promptScore >= 25 && exampleCount >= 4);
      if (qualifies) {
        const floor = (floorRule.base || 78) + Math.min(exampleCount, 5) * (floorRule.perExample || 4);
        overallScore = Math.max(overallScore, Math.min(100, floor));
      }
    }
    const strongBonus = tc.strongAttemptBonus;
    if (strongBonus && (scores.mechanics || 0) >= (strongBonus.minMechanics || 80) && exampleCount >= (strongBonus.minExamples || 2)) {
      if (promptResponse?.hasTechContrast || promptResponse?.hasBecause || (promptResponse?.score || 0) >= 35) {
        overallScore = Math.min(100, overallScore + (strongBonus.bonus || 10));
      }
    }
    return overallScore;
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
    const doubledLetter = /\b(\w{3,})\1{2,}\b/gi;
    misspellCount += (text.match(doubledLetter) || []).length;
    const apostropheErrors = (text.match(/\bi\b/g) || []).length;
    const rate = words.length > 0 ? misspellCount / words.length : 0;
    const penaltyRate = getCalibration().SPELLING_MISSPELL_RATE || 220;
    const iPenalty = getCalibration().SPELLING_I_PENALTY || 1.5;
    const adjustedRate = words.length < 30 ? misspellCount / Math.max(words.length, 12) : rate;
    let score = clamp(Math.round(100 - adjustedRate * penaltyRate - apostropheErrors * iPenalty), 0, 100);
    const rewards = getCalibration().CONVENTIONS_REWARDS || {};
    if (words.length >= (rewards.minWords || 18) && misspellCount === 0 && apostropheErrors === 0) {
      score = Math.min(100, score + (rewards.cleanSpelling || 12));
    }
    return { score, misspellCount, apostropheErrors, issues };
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
    const endsWithPunct = /[.!?]["']?\s*$/.test(text.trim());
    if (text.trim() && !endsWithPunct) {
      errorCount++;
      if (issues.length < 5) issues.push("Add ending punctuation to your final sentence.");
    }
    const lowerICount = (text.match(/\bi\b/g) || []).length;
    if (lowerICount > 0) {
      errorCount += Math.min(lowerICount, 4);
      if (issues.length < 5) issues.push('Capitalize the pronoun "I".');
    }
    if (sentences.length <= 1 && words.length > 42 && !/[,;:—-]/.test(text)) {
      errorCount++;
      if (issues.length < 5) issues.push("Try breaking long ideas into two or more sentences.");
    }
    const interiorPunct = (text.match(/[,;:—-]/g) || []).length;
    if (sentences.length >= 2 && interiorPunct === 0 && words.length > 35) {
      errorCount++;
      if (issues.length < 5) issues.push("Use commas or periods between ideas.");
    }
    const doubleSpaces = (text.match(/  +/g) || []).length;
    errorCount += doubleSpaces;
    const repeatedAdjacent = words.filter((w, i) => i > 0 && normalizeWord(w) === normalizeWord(words[i - 1]) && normalizeWord(w).length > 2).length;
    errorCount += repeatedAdjacent;
    const commaSplices = (text.match(/,\s*(and|but|so)\s+\w+/gi) || []).length;
    errorCount += Math.floor(commaSplices * 0.3);

    const perSentence = errorCount / Math.max(sentences.length, 1);
    const grammarRate = getCalibration().GRAMMAR_ERROR_RATE || 18;
    let score = clamp(Math.round(100 - errorCount * 9 - perSentence * 7 - commaSplices * 2), 0, 100);
    if (score < 42) score = clamp(Math.round(100 - perSentence * grammarRate), 0, 100);

    const rewards = getCalibration().CONVENTIONS_REWARDS || {};
    let bonus = 0;
    const minWords = rewards.minWords || 18;
    if (words.length >= minWords) {
      if (doubleSpaces === 0) bonus += rewards.perfectSpacing || 8;
      const capitalizedSentences = sentences.filter((s) => /^[A-Z]/.test(s.trim())).length;
      if (capitalizedSentences === sentences.length && sentences.length >= 2 && endsWithPunct) {
        bonus += rewards.perfectPunctuation || 10;
      }
      if (interiorPunct >= Math.max(1, sentences.length - 1)) bonus += rewards.interiorPunctuation || 5;
      const sentenceEndings = (text.match(/[.!?]+/g) || []).length;
      if (sentenceEndings >= sentences.length && sentences.length >= 2) bonus += rewards.sentencePunctuation || 6;
    }
    score = clamp(score + bonus, 0, 100);
    return { score, issues: [...new Set(issues)].slice(0, 5), doubleSpaces, repeatedAdjacent };
  }

  function analyzeSyntax(sentences, words, text) {
    const sentLengths = sentences.map((s) => s.split(/\s+/).filter(Boolean).length);
    const avgLen = sentLengths.reduce((a, b) => a + b, 0) / Math.max(sentLengths.length, 1);
    let variance = sentLengths.reduce((s, l) => s + (l - avgLen) ** 2, 0) / Math.max(sentLengths.length, 1);
    let variety = Math.sqrt(variance);
    if (sentences.length === 1 && words.length >= 10) {
      variety = Math.max(variety, Math.min(10, Math.sqrt(words.length) * 0.85));
    }
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
    let lexScore = scoreFromRange(lexicalDiversity, calBreakpoints("SEMANTICS_LEX_BREAKPOINTS", [[0, 30], [0.35, 58], [0.55, 80], [0.72, 100]]));
    if (contentWords.length < 12) {
      lexScore = Math.round(lexScore * 0.65 + scoreFromRange(contentWords.length, [[0, 25], [6, 48], [10, 62], [18, 78], [28, 90]]) * 0.35);
    }
    const score = clamp(Math.round(
      lexScore * 0.5 +
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

  function parseClassroomGrade(classroom) {
    const c = String(classroom || "").trim();
    const mixed = getCalibration().MIXED_GRADE_CLASSES;
    if (mixed && typeof mixed.has === "function" && mixed.has(c)) return null;
    const tech = c.match(/Tech\s+(\d)-/i);
    if (tech) return Number(tech[1]);
    const ela = c.match(/(\d)th\s+Grade/i);
    if (ela) return Number(ela[1]);
    return null;
  }

  function computeGradeRelativeTyping(wordCount, wpm, grammarScore, syntaxScore, classroom) {
    const grade = parseClassroomGrade(classroom);
    const cal = getCalibration();
    const bounds = cal.GRADE_TYPING_BOUNDS?.[grade];
    const adv = cal.GRADE_ADVANCED_P90?.[grade];
    const tiers = cal.TYPING_TIERS;
    if (!grade || !adv || !tiers) return null;
    const conventions = (grammarScore + syntaxScore) / 2;
    const composite = wpm * 0.55 + conventions * 0.45;
    let floorComposite;
    let ceilComposite;
    if (bounds) {
      floorComposite = bounds.floorWpm * 0.55 + (bounds.floorConventions || 45) * 0.45;
      ceilComposite = bounds.ceilWpm * 0.55 + (bounds.ceilConventions || 95) * 0.45;
    } else {
      const floorWpm = tiers.intervention?.maxWpm || 7;
      floorComposite = floorWpm * 0.55 + 45 * 0.45;
      ceilComposite = adv.wpm * 0.55 + 95 * 0.45;
    }
    const t = (composite - floorComposite) / Math.max(ceilComposite - floorComposite, 1);
    return clamp(Math.round(10 + t * 90), 10, 100);
  }

  function applyStoryFloors(storyScore, wordCount, voiceCount, sensoryCount, sentenceCount) {
    const floors = getCalibration().STORY_FLOORS || [];
    let score = storyScore;
    for (const rule of floors) {
      if (wordCount < (rule.minWords || 0)) continue;
      if ((rule.minVoice || 0) > voiceCount) continue;
      if (rule.minSensory != null && sensoryCount < rule.minSensory) continue;
      if (rule.minSentences != null && sentenceCount < rule.minSentences) continue;
      score = Math.max(score, rule.floor || 0);
    }
    return score;
  }

  function applyMechanicsExemplarFloor(mechanicsScore, wordCount, spellingScore, grammarScore) {
    const rule = getCalibration().MECHANICS_EXEMPLAR_FLOOR;
    if (!rule) return mechanicsScore;
    if (wordCount >= (rule.minWords || 0) && spellingScore >= (rule.minSpelling || 0) && grammarScore >= (rule.minGrammar || 0)) {
      return Math.max(mechanicsScore, rule.floor || mechanicsScore);
    }
    return mechanicsScore;
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
    const enumerateCount = (text.match(/\b(first|second|third|also|another|next|finally|one\s+thing|the\s+\w\s+in)\b/gi) || []).length;
    const structureSignals = transitionCount + enumerateCount * 0.65;
    const voiceCount = (text.match(VOICE_PATTERN) || []).length;

    const volumeScore = scoreFromRange(wordCount, calBreakpoints("VOLUME_BREAKPOINTS", [
      [0, 0], [40, 32], [70, 55], [100, 72], [150, 88], [250, 100],
    ]));
    const wpmScore = scoreFromRange(wpm, calBreakpoints("WPM_BREAKPOINTS", [
      [0, 0], [10, 40], [17, 58], [24, 72], [32, 85], [45, 100],
    ]));
    const keystrokeAccuracy = analyzeKeystrokeAccuracy(options.keystrokeStats, spelling.score, grammar.score);
    const kc = getCalibration().KEYSTROKE_CALIBRATION?.typingBlend || { wpm: 0.4, volume: 0.28, accuracy: 0.32 };
    let typingScore = clamp(Math.round(
      wpmScore * (kc.wpm || 0.4) + volumeScore * (kc.volume || 0.28) + keystrokeAccuracy.score * (kc.accuracy || 0.32)
    ), 0, 100);
    const kcal = getCalibration().KEYSTROKE_CALIBRATION || {};
    if (keystrokeAccuracy.score >= (kcal.speedBonusMinAccuracy || 72) && wpm >= (kcal.speedBonusMinWpm || 14)) {
      const speedExtra = scoreFromRange(wpm, calBreakpoints("WPM_BREAKPOINTS", [
        [0, 0], [10, 40], [17, 58], [24, 72], [32, 85], [45, 100],
      ])) * 0.12;
      typingScore = Math.min(100, typingScore + Math.min(kcal.speedBonusMax || 14, Math.round(speedExtra)));
    }
    const gradeTyping = computeGradeRelativeTyping(wordCount, wpm, grammar.score, syntax.score, options.classroom);
    if (gradeTyping != null) {
      typingScore = clamp(Math.round(typingScore * 0.35 + gradeTyping * 0.65), 10, 100);
    }
    const copyMatch = options.copyTarget ? analyzeCopyMatch(text, options.copyTarget) : null;
    if (copyMatch) {
      typingScore = clamp(Math.round(typingScore * 0.22 + copyMatch.score * 0.78), 0, 100);
      if (copyMatch.complete && keystrokeAccuracy.score >= 70) {
        typingScore = Math.min(100, typingScore + 6);
      }
    }
    let mechanicsScore = clamp(Math.round(
      spelling.score * (getCalibration().MECHANICS_WEIGHTS?.spelling || 0.45) +
      grammar.score * (getCalibration().MECHANICS_WEIGHTS?.grammar || 0.35) +
      syntax.score * (getCalibration().MECHANICS_WEIGHTS?.syntax || 0.2)
    ), 0, 100);
    mechanicsScore = applyMechanicsExemplarFloor(mechanicsScore, wordCount, spelling.score, grammar.score);
    if (copyMatch?.complete) {
      mechanicsScore = Math.min(100, Math.max(mechanicsScore, copyMatch.score >= 85 ? 92 : 80));
    }

    const detailBase = scoreFromRange(sensoryCount, calBreakpoints("STORY_DETAIL_BREAKPOINTS", [[0, 35], [2, 62], [4, 82], [8, 100]]));
    const detailBonus = scoreFromRange(wordCount, calBreakpoints("STORY_DETAIL_VOLUME_BONUS", [[0, 0]]));
    const promptResponse = analyzePromptResponse(text, options.assignmentPrompt || "");
    const storySubs = {
      voice: scoreFromRange(voiceCount, calBreakpoints("STORY_VOICE_BREAKPOINTS", [[0, 40], [5, 68], [12, 88], [20, 100]])),
      detail: clamp(detailBase + detailBonus, 0, 100),
      structure: scoreFromRange(structureSignals, calBreakpoints("STORY_STRUCTURE_BREAKPOINTS", [[0, 40], [2, 70], [4, 92], [6, 100]])),
      wordChoice: semantics.score,
      promptFocus: promptResponse.score,
    };
    let storyScore;
    if (promptResponse.score != null) {
      storyScore = clamp(Math.round(
        storySubs.voice * 0.14 + storySubs.detail * 0.14 + storySubs.structure * 0.14 +
        storySubs.wordChoice * 0.18 + promptResponse.score * 0.4
      ), 0, 100);
    } else {
      storyScore = clamp(Math.round(
        storySubs.voice * 0.2 + storySubs.detail * 0.25 + storySubs.structure * 0.25 + storySubs.wordChoice * 0.3
      ), 0, 100);
    }
    storyScore = applyStoryFloors(storyScore, wordCount, voiceCount, sensoryCount, sentences.length);

    const overallScore = applyTeacherCalibration(
      computeOverallScore(
        { typing: typingScore, mechanics: mechanicsScore, story: storyScore },
        { assignmentMode: options.assignmentMode, rubrics: options.rubrics }
      ),
      { typing: typingScore, mechanics: mechanicsScore, story: storyScore },
      text,
      promptResponse,
      options
    );
    const typingLevel = classifyTyping(wordCount, wpm);
    const metricScores = {
      spelling: spelling.score, grammar: grammar.score, syntax: syntax.score,
      semantics: semantics.score, typing: typingScore, mechanics: mechanicsScore, story: storyScore,
      vocabulary: vocabulary.score,
      keystrokeAccuracy: keystrokeAccuracy.score,
      voice: storySubs.voice,
      detail: storySubs.detail,
      structure: storySubs.structure,
      wordChoice: storySubs.wordChoice,
      promptFocus: storySubs.promptFocus,
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
      spelling, grammar, syntax, semantics, storySubs, vocabulary, promptResponse, keystrokeAccuracy, copyMatch,
      scores: { typing: typingScore, mechanics: mechanicsScore, story: storyScore, overall: overallScore, vocabulary: vocabulary.score },
      metricScores,
      standards,
      teachingStandards,
      feedback: buildFeedback(wordCount, wpm, typingLevel, spelling, grammar, storyScore, voiceCount, sensoryCount, vocabulary, promptResponse, {
        assignmentMode: options.assignmentMode,
        rubrics: options.rubrics,
        mechanicsScore,
        overallScore,
        keystrokeAccuracy,
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
    composition: { typing: 0.15, mechanics: 0.35, story: 0.50 },
    fluency: { typing: 1, mechanics: 0, story: 0 },
    typing_practice: { typing: 1, mechanics: 0, story: 0 },
    reflection: { typing: 0.12, mechanics: 0.33, story: 0.55 },
  };

  function computeOverallScore(scores, options = {}) {
    const mode = options.assignmentMode || "composition";
    const cal = getCalibration();
    const tc = cal.TEACHER_CALIBRATION || {};
    const rubrics = options.rubrics || Object.keys(MODE_OVERALL_WEIGHTS[mode] || {}).filter((k) => (MODE_OVERALL_WEIGHTS[mode]?.[k] ?? 0) > 0);
    let weights = MODE_OVERALL_WEIGHTS[mode] || { typing: 0.33, mechanics: 0.34, story: 0.33 };
    if (mode === "reflection" && tc.reflectionOverall) {
      weights = {
        typing: tc.reflectionOverall.typing || 0,
        mechanics: tc.reflectionOverall.mechanics,
        story: tc.reflectionOverall.story,
      };
    } else if (mode === "composition" && tc.compositionOverall) {
      weights = {
        typing: tc.compositionOverall.typing || 0,
        mechanics: tc.compositionOverall.mechanics,
        story: tc.compositionOverall.story,
      };
    }
    const scoreKeys = Object.keys(weights).filter((k) => (weights[k] ?? 0) > 0);
    let sum = 0;
    let weightSum = 0;
    for (const key of scoreKeys) {
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

  function buildFeedback(wordCount, wpm, typingLevel, spelling, grammar, storyScore, voiceCount, sensoryCount, vocab, promptResponse, options = {}) {
    const mode = options.assignmentMode || "composition";
    const rubrics = options.rubrics || ["typing", "mechanics", "story"];
    const mechanicsScore = options.mechanicsScore;
    const overallScore = options.overallScore;
    const responseType = promptResponse?.responseType || "normal";
    const sections = [];
    const strengths = [];
    const improvements = [];

    if (responseType === "off_topic") {
      return [{
        title: "What to improve",
        items: ["Your writing doesn't address the assignment question. Re-read the prompt and answer it directly."],
      }, {
        title: "What you did well",
        items: wordCount >= 20 ? ["You wrote a personal story — now connect it to the prompt."] : ["Keep practicing — try again with the prompt in mind."],
      }];
    }

    if (responseType === "dictation") {
      const items = [`You typed ${wordCount} words (${Math.round(wpm)} WPM).`];
      if (spelling.score >= 85) strengths.push("Good spelling accuracy while copying.");
      else improvements.push("Focus on spelling each word correctly as you type.");
      if (grammar.score >= 85) strengths.push("Capitalization and punctuation look good.");
      else improvements.push("Match capitals and punctuation to what you hear.");
      sections.push({ title: "Typing accuracy", items });
      if (strengths.length) sections.push({ title: "What you did well", items: strengths });
      if (improvements.length) sections.push({ title: "What to improve", items: improvements });
      return sections;
    }

    if (rubrics.includes("typing") && (mode === "fluency" || mode === "typing_practice")) {
      sections.push({
        title: "Typing & stamina",
        items: [`You wrote ${wordCount} words (${Math.round(wpm)} WPM).`, typingLevel === "intervention" ? "Daily typing practice will help ideas flow faster." : null].filter(Boolean),
      });
    }

    if (rubrics.includes("mechanics")) {
      if (spelling.score >= 75) strengths.push("Spelling looks solid for a first draft.");
      else if (spelling.misspellCount > 0) improvements.push(`Watch spelling — ${spelling.misspellCount} possible misspelling${spelling.misspellCount === 1 ? "" : "s"} flagged.`);
      else improvements.push("Watch spelling in revision.");
      if (grammar.score >= 75) strengths.push("Conventions are mostly in place — good punctuation and spacing.");
      else {
        if (grammar.doubleSpaces > 0) improvements.push("Remove extra spaces between words.");
        improvements.push("Check capitals, the pronoun I, and ending punctuation on every sentence.");
      }
    }

    if (rubrics.includes("typing") && mode !== "fluency" && mode !== "typing_practice") {
      const acc = options.keystrokeAccuracy;
      if (acc?.score >= 80) strengths.push("Clean typing — few corrections needed.");
      else if (acc?.source === "live" && acc.correctionRate > 25) improvements.push("Try to type more accurately — fewer backspaces means faster writing.");
      if (options.wpm >= 20) strengths.push(`Good writing speed (${Math.round(options.wpm)} WPM).`);
    }

    if (rubrics.includes("story")) {
      if (promptResponse?.score != null) {
        if (promptResponse.score >= 65) strengths.push("Your response connects to the prompt.");
        else if (promptResponse.score >= 40) improvements.push("Address more of the prompt question in your own words.");
        else improvements.push("Re-read the prompt and explain what it means to you with a specific example.");
        if (promptResponse.answerTier === "exact" || promptResponse.answerTier === "near") {
          strengths.push("You answered the question clearly — your ideas match the prompt.");
        } else if (promptResponse.answerTier === "paraphrase" || promptResponse.answerTier === "summary") {
          strengths.push("You explained the idea in your own words — good paraphrase.");
        } else if (promptResponse.answerTier === "partial") {
          improvements.push("Try to answer the full question — name the concept and explain what it means to you.");
        }
        if (promptResponse.hasBecause) strengths.push("Good use of reasoning — you explained why.");
        else if (promptResponse.exampleCount >= 2) improvements.push("Add a sentence explaining why your examples fit the prompt.");
        if (promptResponse.exampleCount >= 3) strengths.push(`Strong examples — you listed ${promptResponse.exampleCount} relevant items.`);
        if (promptResponse.hasTechContrast) strengths.push("You showed understanding of what counts as technology.");
      } else if (storyScore >= 65) {
        strengths.push("Your writing comes through clearly.");
      } else {
        improvements.push("Add specific details and your own voice.");
      }
      if (mode === "reflection") {
        if (overallScore >= 75) strengths.push("Thoughtful reflection — keep building on your ideas.");
        else improvements.push("Expand on your ideas with one more specific example.");
      } else {
        if (voiceCount >= 4) strengths.push("Personal voice is present.");
        else improvements.push("Use I/my to keep it in your voice.");
        if (sensoryCount >= 2) strengths.push("Good sensory details.");
        else improvements.push("Add what you saw, heard, or felt.");
      }
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

    if (strengths.length) sections.push({ title: "What you did well", items: strengths });
    if (improvements.length) sections.push({ title: "What to improve", items: improvements });
    if (!sections.length) {
      sections.push({ title: "Mechanics", items: ["Keep writing — every draft builds skill."] });
    }
    return sections;
  }

  window.WriteAnalysis = { analyzeText, classifyTyping, analyzeVocabulary, getSentences, analyzeCopyMatch };
})();
