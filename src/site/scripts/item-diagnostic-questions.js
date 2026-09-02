/**
 * ITEM 2025 standards reference + diagnostic question utilities.
 * Question bank loaded from Tech Escape via item-diagnostic-loader.js.
 */
(() => {
  "use strict";

  const ITEM_STANDARDS = [
    { code: "8.1.2.3", strand: "Information Literacy", title: "Multiple perspectives", topic: "data" },
    { code: "8.1.3.1", strand: "Information Literacy", title: "Source relevance", topic: "data" },
    { code: "8.1.3.2", strand: "Information Literacy", title: "Credibility and authority", topic: "data" },
    { code: "8.1.3.3", strand: "Information Literacy", title: "Reliability and accuracy", topic: "data" },
    { code: "8.1.3.4", strand: "Information Literacy", title: "Bias and perspective", topic: "data" },
    { code: "8.1.4.2", strand: "Information Literacy", title: "Recording sources", topic: "data" },
    { code: "8.1.4.3", strand: "Information Literacy", title: "Organizing information", topic: "data" },
    { code: "8.1.5.1", strand: "Information Literacy", title: "Sharing findings", topic: "data" },
    { code: "8.1.5.2", strand: "Information Literacy", title: "Reflecting on work", topic: "data" },
    { code: "8.2.1.1", strand: "Digital Citizenship", title: "Digital footprint", topic: "citizenship" },
    { code: "8.2.1.2", strand: "Digital Citizenship", title: "Impact of technology", topic: "citizenship" },
    { code: "8.2.1.3", strand: "Digital Citizenship", title: "Exchanging ideas online", topic: "citizenship" },
    { code: "8.2.2.1", strand: "Digital Citizenship", title: "Intellectual property", topic: "citizenship" },
    { code: "8.2.2.2", strand: "Digital Citizenship", title: "Crediting sources", topic: "citizenship" },
    { code: "8.2.2.3", strand: "Digital Citizenship", title: "Privacy and security", topic: "citizenship" },
    { code: "8.2.2.4", strand: "Digital Citizenship", title: "Decoding media", topic: "citizenship" },
    { code: "8.3.1.1", strand: "Computing Systems", title: "Programs and devices", topic: "systems" },
    { code: "8.3.1.2", strand: "Computing Systems", title: "Describing tech problems", topic: "systems" },
    { code: "8.3.1.3", strand: "Computing Systems", title: "Troubleshooting", topic: "systems" },
    { code: "8.3.2.1", strand: "Networks", title: "Protocols and tools", topic: "systems" },
    { code: "8.3.3.1", strand: "Design Process", title: "Design process", topic: "design" },
    { code: "8.3.3.2", strand: "Computational Thinking", title: "Debugging", topic: "code" },
    { code: "8.3.3.3", strand: "Programming", title: "Algorithms and control flow", topic: "code" },
    { code: "8.3.4.2", strand: "Collaboration", title: "Collaborating with peers", topic: "design" },
  ];

  const QUIZ_COUNT = 20;
  const TYPING_DURATION = 120;
  const GLYPHS = ["A", "B", "C", "D", "E"];

  function getQuestions() {
    return window.ITEMDiagnosticBank || [];
  }

  function findQuestionById(id) {
    if (!id) return null;
    return getQuestions().find((q) => q.id === id) || null;
  }

  function standardMeta(code) {
    return ITEM_STANDARDS.find((s) => s.code === code) || null;
  }

  function groupByStandard(pool) {
    const byStd = new Map();
    for (const q of pool) {
      if (!q?.std) continue;
      if (!byStd.has(q.std)) byStd.set(q.std, []);
      byStd.get(q.std).push(q);
    }
    return byStd;
  }

  function pickRandomQuestion(bucket) {
    if (!bucket?.length) return null;
    const Core = window.WriteTestCore;
    const level2 = bucket.filter((q) => (q.level ?? 2) === 2);
    const level3 = bucket.filter((q) => (q.level ?? 2) === 3);
    const weighted = [];
    for (const q of level2) weighted.push(q, q);
    for (const q of level3) weighted.push(q);
    for (const q of bucket) weighted.push(q);
    const pool = Core ? Core.shuffle(weighted) : weighted;
    return pool[0] || bucket[Math.floor(Math.random() * bucket.length)];
  }

  /**
   * Draw `count` questions: one random question per standard when possible,
   * then fill from the pool. Final list is shuffled (answer order is shuffled later).
   */
  function drawQuestions(pool, count = QUIZ_COUNT) {
    const Core = window.WriteTestCore;
    if (!pool.length || count <= 0) return [];

    const byStd = groupByStandard(pool);
    const canonicalCodes = ITEM_STANDARDS.map((s) => s.code).filter((code) => byStd.has(code));
    for (const code of byStd.keys()) {
      if (!canonicalCodes.includes(code)) canonicalCodes.push(code);
    }

    const stdOrder = Core.shuffle([...canonicalCodes]);
    const picked = [];
    const usedIds = new Set();

    for (const code of stdOrder) {
      if (picked.length >= count) break;
      const choice = pickRandomQuestion(byStd.get(code) || []);
      if (choice && !usedIds.has(choice.id)) {
        picked.push(choice);
        usedIds.add(choice.id);
      }
    }

    if (picked.length < count) {
      const rest = Core.shuffle(pool.filter((q) => !usedIds.has(q.id)));
      for (const q of rest) {
        if (picked.length >= count) break;
        picked.push(q);
        usedIds.add(q.id);
      }
    }

    return Core.shuffle(picked).slice(0, count);
  }

  function labelsForIndices(options, indices) {
    return (indices || [])
      .map((i) => options?.[i])
      .filter((text) => text != null)
      .map((text) => String(text));
  }

  function formatChoiceLabels(options, indices) {
    return labelsForIndices(options, indices)
      .map((text, i) => `${GLYPHS[i] || String.fromCharCode(65 + i)}. ${text}`)
      .join(" · ");
  }

  /** Merge saved answer with bank lookup for older submissions. */
  function enrichAnswer(answer) {
    if (!answer || typeof answer !== "object") return null;
    const bank = findQuestionById(answer.id);
    const options = Array.isArray(answer.options) ? answer.options : bank?.a || [];
    const question = answer.question || bank?.q || "";
    const why = answer.why || bank?.why || "";
    const std = answer.std || bank?.std || "";
    const meta = standardMeta(std);
    const selected = Array.isArray(answer.selected) ? answer.selected : [];
    const correctIdx = Array.isArray(answer.correctIdx)
      ? answer.correctIdx
      : Array.isArray(bank?.correct)
        ? bank.correct
        : [];
    const selectedText = Array.isArray(answer.selectedText)
      ? answer.selectedText
      : labelsForIndices(options, selected);
    const correctText = Array.isArray(answer.correctText)
      ? answer.correctText
      : labelsForIndices(options, correctIdx);

    return {
      ...answer,
      question,
      options,
      why,
      std,
      stdLabel: answer.stdLabel || bank?.stdLabel || meta?.title || "",
      topic: answer.topic || bank?.topic || meta?.topic || "",
      selected,
      correctIdx,
      selectedText,
      correctText,
      correct: Boolean(answer.correct),
    };
  }

  function getWrongAnswers(answers) {
    return (Array.isArray(answers) ? answers : [])
      .filter((a) => a && !a.correct)
      .map((a) => enrichAnswer(a))
      .filter(Boolean);
  }

  function mapResultsToStandards(answers) {
    const byStd = {};
    for (const a of answers) {
      if (!byStd[a.std]) byStd[a.std] = { correct: 0, total: 0, title: "", strand: "" };
      byStd[a.std].total++;
      if (a.correct) byStd[a.std].correct++;
      const ref = ITEM_STANDARDS.find((s) => s.code === a.std);
      if (ref) {
        byStd[a.std].title = ref.title;
        byStd[a.std].strand = ref.strand;
      } else if (a.stdLabel) {
        byStd[a.std].title = a.stdLabel;
      }
    }
    return Object.entries(byStd).map(([code, data]) => {
      const pct = data.total ? Math.round((data.correct / data.total) * 100) : 0;
      let level = "gap";
      if (pct >= 80) level = "strong";
      else if (pct >= 50) level = "developing";
      return { code, ...data, pct, level };
    }).sort((a, b) => a.pct - b.pct);
  }

  function topicSummary(answers) {
    const topics = { design: [0, 0], systems: [0, 0], data: [0, 0], code: [0, 0] };
    for (const a of answers) {
      const t = a.topic === "citizenship" ? "data" : a.topic;
      if (!topics[t]) continue;
      topics[t][1]++;
      if (a.correct) topics[t][0]++;
    }
    return topics;
  }

  function bankCoverage(pool = getQuestions()) {
    const byStd = groupByStandard(pool);
    return ITEM_STANDARDS.map((s) => ({
      code: s.code,
      title: s.title,
      count: byStd.get(s.code)?.length || 0,
    }));
  }

  window.ITEMDiagnostic = {
    ITEM_STANDARDS,
    QUIZ_COUNT,
    TYPING_DURATION,
    GLYPHS,
    getQuestions,
    findQuestionById,
    drawQuestions,
    enrichAnswer,
    getWrongAnswers,
    formatChoiceLabels,
    mapResultsToStandards,
    topicSummary,
    bankCoverage,
  };
})();
