/**
 * Rubric calibration for the 5-minute summer narrative diagnostic.
 *
 * Calibrated from 157 live submissions (Aug 2026) plus published K–12 benchmarks.
 * Teacher's Lounge adult samples (Cecelia Everette anchor) define the top of the scale.
 * Grade-level norms exclude mixed-grade tech classes (Media Arts, Game Design, Video Production).
 *
 * Research anchors (composition, not copy-typing):
 * - Common Core W.6.6: ~3 typed pages in one sitting; MN family guides cite ~33 WPM typing targets for grade 6.
 * - Published keyboarding targets vary widely (often 25–40 WPM by grade 8); real timed *stories* run lower than copy tests.
 * - Empirical cohort medians: G6 ~17 WPM / 86 words, G7 ~20 / 98, G8 ~25 / 125 (5-minute first drafts).
 * - Teacher's Lounge exemplar (Cecelia Everette): 320 words, 64 WPM — used as 100 typing / ~100 story ceiling.
 * - Advanced student p90 after calibration targets ~83–88 overall (not 100 — that remains rare, earned work).
 */
(() => {
  "use strict";

  /** Classes with mixed grades — excluded from grade-level norm calculations. */
  const MIXED_GRADE_CLASSES = new Set([
    "Tech: Media Arts",
    "Tech: Game Design",
    "Tech: Video Production",
  ]);

  /** Adult exemplar used to cap the top of the scale (Teacher's Lounge). */
  const EXEMPLAR = {
    name: "Cecelia Everette",
    classroom: "Teacher's Lounge",
    targets: { typing: 100, mechanics: 100, story: 100, overall: 100 },
    observed: { wordCount: 320, wpm: 64 },
  };

  /** Words produced in 5 minutes → typing volume sub-score. */
  const VOLUME_BREAKPOINTS = [
    [0, 0], [20, 15], [40, 32], [55, 45], [70, 55], [85, 64], [100, 72],
    [115, 78], [130, 83], [150, 88], [175, 92], [200, 95], [250, 98], [320, 100],
  ];

  /** Composition WPM (words ÷ minutes) → typing speed sub-score. */
  const WPM_BREAKPOINTS = [
    [0, 0], [6, 25], [10, 40], [14, 52], [17, 58], [20, 65], [24, 72],
    [28, 79], [32, 85], [38, 91], [45, 96], [55, 100],
  ];

  const TYPING_WEIGHTS = { wpm: 0.55, volume: 0.45 };

  const MECHANICS_WEIGHTS = { spelling: 0.45, grammar: 0.35, syntax: 0.2 };

  /** Personal voice markers (I/my/we) — generous for narrative voice. */
  const STORY_VOICE_BREAKPOINTS = [
    [0, 40], [2, 55], [5, 68], [8, 78], [12, 88], [16, 94], [20, 100],
  ];

  /** Sensory + dialogue craft (narrow word list — volume bonus added separately). */
  const STORY_DETAIL_BREAKPOINTS = [
    [0, 35], [1, 50], [2, 62], [3, 72], [4, 82], [6, 90], [8, 95], [11, 100],
  ];

  /** Sequence / tension words — timed summer stories often use few explicit transitions. */
  const STORY_STRUCTURE_BREAKPOINTS = [
    [0, 40], [1, 58], [2, 70], [3, 78], [4, 86], [5, 92], [6, 96], [8, 100],
  ];

  /** Bonus for sustained detail when students write longer personal narratives. */
  const STORY_DETAIL_VOLUME_BONUS = [
    [0, 0], [60, 4], [90, 10], [130, 16], [180, 22], [250, 28],
  ];

  const STORY_WEIGHTS = { voice: 0.2, detail: 0.25, structure: 0.25, wordChoice: 0.3 };

  /** Lexical diversity ratio (unique content words / all content words). */
  const SEMANTICS_LEX_BREAKPOINTS = [
    [0, 30], [0.25, 45], [0.35, 58], [0.45, 70], [0.55, 80], [0.65, 88], [0.72, 94], [0.78, 100],
  ];

  /** Concrete nouns, proper names, numbers. */
  const SEMANTICS_SPEC_BREAKPOINTS = [
    [0, 30], [1, 48], [3, 62], [5, 74], [8, 84], [12, 92], [16, 100],
  ];

  const SEMANTICS_WEIGHTS = { lex: 0.5, spec: 0.35, repetitionPenalty: 35 };

  const SYNTAX_VARIETY_BREAKPOINTS = [[0, 25], [2, 45], [5, 68], [8, 82], [12, 94]];
  const SYNTAX_LENGTH_BREAKPOINTS = [[0, 25], [6, 48], [10, 68], [14, 82], [20, 94]];
  const SYNTAX_COMPLEX_BREAKPOINTS = [[0, 35], [2, 55], [5, 72], [8, 86], [12, 96], [16, 100]];
  const SYNTAX_WEIGHTS = { variety: 0.2, avgLen: 0.2, complex: 0.6 };

  /** Spelling / grammar tuned for first-draft timed writing (less punitive). */
  const SPELLING_MISSPELL_RATE = 220;
  const SPELLING_I_PENALTY = 1.5;
  const GRAMMAR_ERROR_RATE = 18;

  /**
   * Typing intervention tiers (for filters & flags), aligned to empirical + research bands.
   * G6 median ~17 WPM; intervention below ~7 WPM or very low volume.
   */
  const TYPING_TIERS = {
    intervention: { maxWords: 35, maxWpm: 7 },
    developing: { maxWords: 65, maxWpm: 11 },
    proficient: { maxWords: 105, maxWpm: 18 },
  };

  /** Fairness floors — real narratives should not score below these when basic criteria met. */
  const STORY_FLOORS = [
    { minWords: 45, minVoice: 1, minSentences: 2, floor: 45 },
    { minWords: 70, minVoice: 3, floor: 55 },
    { minWords: 100, minVoice: 5, minSensory: 1, floor: 65 },
    { minWords: 180, minVoice: 10, minSensory: 2, floor: 88 },
    { minWords: 280, minVoice: 16, minSensory: 3, floor: 100 },
  ];

  const MECHANICS_EXEMPLAR_FLOOR = { minWords: 240, minSpelling: 98, minGrammar: 94, floor: 99 };

  /**
   * Empirical grade norms (n≈131 student submissions, Aug 2026).
   * Used as comparison fallbacks when grade peer pools are thin.
   */
  const GRADE_NORMS = {
    6: { typing: 54, mechanics: 85, story: 69, overall: 70, wordCount: 87, wpm: 17 },
    7: { typing: 58, mechanics: 87, story: 69, overall: 71, wordCount: 98, wpm: 20 },
    8: { typing: 67, mechanics: 90, story: 76, overall: 79, wordCount: 125, wpm: 25 },
  };

  /** ~top 18% of each grade (advanced tier or overall ≥ 75 in original rubric). */
  const GRADE_ADVANCED_P90 = {
    6: { typing: 82, mechanics: 91, story: 82, overall: 83, wordCount: 143, wpm: 29 },
    7: { typing: 86, mechanics: 94, story: 85, overall: 87, wordCount: 162, wpm: 32 },
    8: { typing: 86, mechanics: 93, story: 81, overall: 86, wordCount: 166, wpm: 33 },
  };

  /** Teacher's Lounge aggregate (adult calibration samples, n=5). */
  const LOUNGE_NORMS = {
    typing: 97, mechanics: 93, story: 83, overall: 91, wordCount: 258, wpm: 52,
  };

  window.DWCalibration = {
    MIXED_GRADE_CLASSES,
    EXEMPLAR,
    VOLUME_BREAKPOINTS,
    WPM_BREAKPOINTS,
    TYPING_WEIGHTS,
    MECHANICS_WEIGHTS,
    STORY_VOICE_BREAKPOINTS,
    STORY_DETAIL_BREAKPOINTS,
    STORY_STRUCTURE_BREAKPOINTS,
    STORY_DETAIL_VOLUME_BONUS,
    STORY_WEIGHTS,
    SEMANTICS_LEX_BREAKPOINTS,
    SEMANTICS_SPEC_BREAKPOINTS,
    SEMANTICS_WEIGHTS,
    SYNTAX_VARIETY_BREAKPOINTS,
    SYNTAX_LENGTH_BREAKPOINTS,
    SYNTAX_COMPLEX_BREAKPOINTS,
    SYNTAX_WEIGHTS,
    SPELLING_MISSPELL_RATE,
    SPELLING_I_PENALTY,
    GRAMMAR_ERROR_RATE,
    TYPING_TIERS,
    STORY_FLOORS,
    MECHANICS_EXEMPLAR_FLOOR,
    GRADE_NORMS,
    GRADE_ADVANCED_P90,
    LOUNGE_NORMS,
  };
})();
