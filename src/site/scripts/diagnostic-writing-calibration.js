/**
 * Rubric calibration for the 5-minute summer narrative diagnostic.
 *
 * See also: /diagnostic-writing/algorithms/ (human doc) and scripts/analyze-diagnostic-calibration.py (data export).
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
   * Per-grade typing floor/ceiling composites (Aug 2026 SPARK cohorts, n=218).
   * Best in-grade typist (fast WPM + strong conventions) → ~100; weakest → ~10.
   */
  const GRADE_TYPING_BOUNDS = {
    6: { floorWpm: 2, floorConventions: 57, ceilWpm: 28, ceilConventions: 82 },
    7: { floorWpm: 5, floorConventions: 55, ceilWpm: 27, ceilConventions: 89 },
    8: { floorWpm: 6, floorConventions: 50, ceilWpm: 33, ceilConventions: 90 },
  };

  /**
   * Empirical grade norms (n≈131 narrative diagnostic + n≈218 SPARK reflection, Aug 2026).
   * Used as comparison fallbacks when grade peer pools are thin.
   */
  const GRADE_NORMS = {
    6: { typing: 54, mechanics: 85, story: 69, overall: 70, wordCount: 87, wpm: 17 },
    7: { typing: 58, mechanics: 87, story: 69, overall: 71, wordCount: 98, wpm: 20 },
    8: { typing: 67, mechanics: 90, story: 76, overall: 79, wordCount: 125, wpm: 25 },
  };

  /** Best-in-grade typist per cohort — ceiling for grade-relative typing scale. */
  const GRADE_ADVANCED_P90 = {
    6: { typing: 82, mechanics: 93, story: 63, overall: 71, wordCount: 141, wpm: 28 },
    7: { typing: 81, mechanics: 94, story: 61, overall: 73, wordCount: 138, wpm: 27 },
    8: { typing: 86, mechanics: 93, story: 81, overall: 86, wordCount: 166, wpm: 33 },
  };

  /** Teacher's Lounge aggregate (adult calibration samples, n=5). */
  const LOUNGE_NORMS = {
    typing: 97, mechanics: 93, story: 83, overall: 91, wordCount: 258, wpm: 52,
  };

  /**
   * Teacher grading calibration (Feb 2026, n=87 teacher-graded WriteFlow submissions).
   * Aligns auto scores with Mr. Phil's rubric for reflection/bell-ringer assignments.
   * Aug 2026: added keystroke accuracy, conventions rewards, semantic prompt matching.
   */
  const TEACHER_CALIBRATION = {
    /** Reflection mode overall weights — mechanics + accuracy matter; speed rewarded modestly. */
    reflectionOverall: { typing: 0.12, mechanics: 0.33, story: 0.55 },
    /** Composition mode — speed + accuracy alongside conventions and prompt response. */
    compositionOverall: { typing: 0.15, mechanics: 0.35, story: 0.50 },
    /** Bonus points when students explain reasoning or contrast with technology. */
    reasoningBonus: { because: 12, techContrast: 8 },
    /** Bonus per valid example noun beyond the first two (classification prompts). */
    exampleBonus: { perExample: 4, maxBonus: 16, minExamples: 3 },
    /** Floor for genuine on-topic attempts with multiple examples. */
    exampleAttemptFloor: { minExamples: 2, base: 78, perExample: 4, maxBonus: 20 },
    /** Bonus when mechanics are strong and student listed valid examples. */
    strongAttemptBonus: { minMechanics: 80, minExamples: 2, bonus: 10 },
    /** Cap when response is clearly off-topic narrative. */
    offTopicCap: 15,
    /** Dictation/copy exercises — score mostly on typing accuracy. */
    dictationTypingWeight: 0.55,
    dictationMechanicsWeight: 0.15,
    dictationMaxScore: 12,
  };

  /** Keystroke accuracy — rewards clean typing and penalizes excessive corrections. */
  const KEYSTROKE_CALIBRATION = {
    correctionPenalty: 135,
    minKeysForScoring: 15,
    /** Typing sub-score blend: wpm + volume + accuracy */
    typingBlend: { wpm: 0.40, volume: 0.28, accuracy: 0.32 },
    /** Speed bonus when accuracy is already solid */
    speedBonusMinAccuracy: 72,
    speedBonusMinWpm: 14,
    speedBonusMax: 14,
    /** When re-analyzing without live stats, estimate accuracy from text quality */
    estimateFromMechanics: true,
  };

  /** Positive rewards for conventions Mr. Phil values (punctuation, spacing, spelling). */
  const CONVENTIONS_REWARDS = {
    minWords: 18,
    perfectPunctuation: 10,
    perfectSpacing: 8,
    cleanSpelling: 12,
    sentencePunctuation: 6,
    interiorPunctuation: 5,
  };

  /**
   * Semantic prompt matching — detects exact, near, paraphrase, and summary answers.
   * Concept clusters expand beyond literal prompt keywords.
   */
  const PROMPT_SEMANTICS = {
    heuristicWeight: 0.45,
    semanticWeight: 0.55,
    jaccardNearExact: 0.40,
    jaccardParaphrase: 0.24,
    jaccardSummary: 0.14,
    tierScores: { exact: 100, near: 88, paraphrase: 76, summary: 68, partial: 52, weak: 28 },
    summaryPhrases: /\b(in other words|basically|what i mean|same (thing|idea)|to put it simply|another way|that means|which means)\b/i,
    definitionPhrases: /\b(means to me|is when|is that|refers to|is about|is like|can be|is something|is anything)\b/i,
  };

  /** Concept clusters for logical answer matching beyond literal keywords. */
  const PROMPT_CONCEPT_CLUSTERS = [
    {
      id: "technology",
      triggers: ["technology", "tech", "isn't", "isnt", "device", "digital"],
      terms: ["technology", "tech", "device", "devices", "computer", "phone", "digital", "electronic", "machine", "internet", "screen", "app", "software", "tool", "tools", "gadget", "gadgets", "electric", "battery", "wifi", "online"],
      contrastTerms: ["natural", "nature", "man-made", "human-made", "not technology", "non-tech", "isnt technology", "isn't technology", "organic", "living"],
    },
    {
      id: "meaning",
      triggers: ["mean", "means", "meaning", "definition"],
      terms: ["mean", "means", "meaning", "represents", "symbolize", "definition", "important", "matters", "significant", "represents", "stands for", "about", "represents"],
    },
    {
      id: "spark",
      triggers: ["spark"],
      terms: ["spark", "curiosity", "wonder", "interest", "ignite", "motivation", "inspire", "excited", "learn", "discovery", "question", "explore", "curious"],
    },
    {
      id: "example",
      triggers: ["example", "list", "name", "identify"],
      terms: ["example", "for instance", "such as", "like", "including", "one is", "another", "also"],
    },
  ];

  /** Common word-family stems for near-match detection. */
  const PROMPT_STEM_GROUPS = [
    ["technolog", "tech", "digital", "electron", "computer", "device", "machine"],
    ["mean", "defin", "represent", "symbol", "signif"],
    ["spark", "curios", "wonder", "inspir", "motivat", "learn", "discover"],
    ["write", "writ", "compos", "story", "narrat"],
  ];

  /** Off-topic personal narratives unrelated to assignment prompt. */
  const OFF_TOPIC_NARRATIVE_PATTERN =
    /\b(went to|valley fair|my mom|boyfriend|girlfriend|last summer|one day i went|do not now wut to rit|by{4,})\b/i;

  /** Teacher read-aloud dictation exercises (not content-graded). */
  const DICTATION_PATTERN =
    /\b(this is a little|write out exactly|what i am saying|what i'm saying|try to wright|try to write out exactly|want to see if you can focus|want to see if you can typ|random words)\b/i;

  /** Technology contrast language — shows student understands the concept. */
  const TECH_CONTRAST_PATTERN =
    /\b(not technology|isn't technology|isnt technology|not tech|non.?tech|man.?made|natural(?:ly)?|electronic|digital|human.?made)\b/i;

  /** Valid example nouns for classification prompts (what is/isn't technology). */
  const EXAMPLE_NOUN_PATTERN =
    /\b(trees?|grass|rocks?|water|animals?|birds?|dogs?|cats?|food|humans?|people|brick|paper|pencils?|chairs?|tables?|sun|moon|air|wind|plants?|flowers?|bugs?|insects?|fish|shoes?|books?|clothes|houses?|buildings?|leaves?|dirt|sand|sky|clouds?|rivers?|lakes?|mountains?|snow|ice|wood|metal|glass|plastic|fabric|cotton|wool|meat|fruit|vegetables?)\b/gi;

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
    GRADE_TYPING_BOUNDS,
    GRADE_NORMS,
    GRADE_ADVANCED_P90,
    LOUNGE_NORMS,
    TEACHER_CALIBRATION,
    KEYSTROKE_CALIBRATION,
    CONVENTIONS_REWARDS,
    PROMPT_SEMANTICS,
    PROMPT_CONCEPT_CLUSTERS,
    PROMPT_STEM_GROUPS,
    OFF_TOPIC_NARRATIVE_PATTERN,
    DICTATION_PATTERN,
    TECH_CONTRAST_PATTERN,
    EXAMPLE_NOUN_PATTERN,
  };
})();
