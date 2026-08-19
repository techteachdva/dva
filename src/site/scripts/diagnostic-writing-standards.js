/**
 * Minnesota 2020 ELA Writing Standards alignment (grades 6–8 band).
 * Maps diagnostic metrics to benchmarks for teacher reporting.
 */
(() => {
  "use strict";

  const MN_WRITING_STANDARDS = [
    {
      id: "6.2.1.1",
      anchor: "W1",
      title: "Foundations of Writing",
      benchmark: "Use correct punctuation, spelling, capitalization and grammar authentically in writing.",
      metrics: ["spelling", "grammar", "mechanics"],
      weight: { spelling: 0.4, grammar: 0.35, mechanics: 0.25 },
    },
    {
      id: "6.2.1.3",
      anchor: "W1",
      title: "Grammar & Syntax",
      benchmark: "Use nouns, verbs, adjectives, adverbs and pronouns in sentences correctly.",
      metrics: ["syntax", "grammar"],
      weight: { syntax: 0.55, grammar: 0.45 },
    },
    {
      id: "8.2.1.3",
      anchor: "W1",
      title: "Clauses & Phrases",
      benchmark: "Place clauses and phrases within sentences correctly to build clear, varied syntax.",
      metrics: ["syntax", "complexity"],
      weight: { syntax: 0.5, complexity: 0.5 },
    },
    {
      id: "6.2.2.1",
      anchor: "W2",
      title: "Writing Fluency",
      benchmark: "Write routinely for a range of tasks, purposes and audiences.",
      metrics: ["fluency", "volume"],
      weight: { fluency: 0.55, volume: 0.45 },
    },
    {
      id: "6.2.2.2",
      anchor: "W2",
      title: "Personal Voice",
      benchmark: "Write to reflect personal perspective, identity and voice.",
      metrics: ["story", "semantics"],
      weight: { story: 0.6, semantics: 0.4 },
    },
    {
      id: "6.2.3.2",
      anchor: "W3",
      title: "Word Choice & Semantics",
      benchmark: "Vary word choice, showing understanding of denotation and connotation.",
      metrics: ["semantics", "story"],
      weight: { semantics: 0.5, story: 0.5 },
    },
    {
      id: "6.2.6.1",
      anchor: "W6",
      title: "Narrative Craft",
      benchmark: "Write to create, portraying complexity in characters or self-expression in narrative.",
      metrics: ["story"],
      weight: { story: 1 },
    },
    {
      id: "6.2.6.2",
      anchor: "W6",
      title: "Dialogue & Sensory Detail",
      benchmark: "Use dialogue and sensory detail to support literary elements and structure.",
      metrics: ["story"],
      weight: { story: 1 },
    },
  ];

  function levelFromScore(score) {
    if (score >= 75) return "excelling";
    if (score >= 50) return "developing";
    return "needs_support";
  }

  function levelLabel(level) {
    return {
      excelling: "Excelling",
      developing: "Developing",
      needs_support: "Needs support",
    }[level] || level;
  }

  function mapToStandards(metricScores) {
    const results = MN_WRITING_STANDARDS.map((std) => {
      let total = 0;
      let weightSum = 0;
      for (const [metric, weight] of Object.entries(std.weight)) {
        const val = metricScores[metric];
        if (val != null) {
          total += val * weight;
          weightSum += weight;
        }
      }
      const score = weightSum > 0 ? Math.round(total / weightSum) : 0;
      const level = levelFromScore(score);
      return {
        id: std.id,
        anchor: std.anchor,
        title: std.title,
        benchmark: std.benchmark,
        score,
        level,
        levelLabel: levelLabel(level),
        recommendation: buildRecommendation(std, level, score, metricScores),
      };
    });

    return {
      all: results,
      excelling: results.filter((r) => r.level === "excelling"),
      developing: results.filter((r) => r.level === "developing"),
      needsSupport: results.filter((r) => r.level === "needs_support"),
    };
  }

  function buildRecommendation(std, level, score, metrics) {
    if (level === "excelling") {
      return `Student demonstrates strong alignment with ${std.id}. Continue stretching craft through revision workshops and mentor-text study.`;
    }
    if (level === "developing") {
      return `Approaching ${std.id}. Use mini-lessons on ${std.metrics.join(" and ")} with short, low-stakes practice before the next draft.`;
    }
    const tips = [];
    if (std.metrics.includes("spelling") && (metrics.spelling ?? 100) < 50) {
      tips.push("word-sort spelling routines and editing checklists");
    }
    if (std.metrics.includes("grammar") && (metrics.grammar ?? 100) < 50) {
      tips.push("sentence-combining and punctuation inquiry");
    }
    if (std.metrics.includes("syntax") && (metrics.syntax ?? 100) < 50) {
      tips.push("clause-and-phrase modeling with mentor sentences");
    }
    if (std.metrics.includes("fluency") && (metrics.fluency ?? 100) < 50) {
      tips.push("daily typing fluency practice (5-minute writes)");
    }
    if (std.metrics.includes("semantics") && (metrics.semantics ?? 100) < 50) {
      tips.push("word-choice revision circles and synonym webs");
    }
    if (std.metrics.includes("story") && (metrics.story ?? 100) < 50) {
      tips.push("show-don't-tell sensory detail prompts, dialogue practice, and first-person reflection");
    }
    const intervention = tips.length
      ? `Priority intervention for ${std.id}: ${tips.join("; ")}.`
      : `Priority intervention for ${std.id}: reteach benchmark with modeled examples and guided practice.`;
    return intervention;
  }

  window.DWStandards = {
    MN_WRITING_STANDARDS,
    mapToStandards,
    levelFromScore,
    levelLabel,
  };
})();
