/**
 * ITEM 2025 standards reference + diagnostic question utilities.
 * Official benchmark text from writeflow-item-standards.js.
 * Question bank loaded from Tech Escape via item-diagnostic-loader.js.
 */
(() => {
  "use strict";

  const DIAGNOSTIC_CODES = [
    "8.1.2.3", "8.1.3.1", "8.1.3.2", "8.1.3.3", "8.1.3.4",
    "8.1.4.2", "8.1.4.3", "8.1.5.1", "8.1.5.2",
    "8.2.1.1", "8.2.1.2", "8.2.1.3", "8.2.2.1", "8.2.2.2", "8.2.2.3", "8.2.2.4",
    "8.3.1.1", "8.3.1.2", "8.3.1.3", "8.3.2.1", "8.3.3.1", "8.3.3.2", "8.3.3.3", "8.3.4.2",
  ];

  const CODE_TOPIC = {
    "8.1.2.3": "data", "8.1.3.1": "data", "8.1.3.2": "data", "8.1.3.3": "data", "8.1.3.4": "data",
    "8.1.4.2": "data", "8.1.4.3": "data", "8.1.5.1": "data", "8.1.5.2": "data",
    "8.2.1.1": "citizenship", "8.2.1.2": "citizenship", "8.2.1.3": "citizenship",
    "8.2.2.1": "citizenship", "8.2.2.2": "citizenship", "8.2.2.3": "citizenship", "8.2.2.4": "citizenship",
    "8.3.1.1": "systems", "8.3.1.2": "systems", "8.3.1.3": "systems", "8.3.2.1": "systems",
    "8.3.3.1": "design", "8.3.3.2": "code", "8.3.3.3": "code", "8.3.4.2": "design",
  };

  const FALLBACK_STANDARDS = [
    { code: "8.1.2.3", strand: "Information Literacy and Research", title: "Sources with multiple perspectives", benchmark: "Identify sources that include multiple perspectives on the research topic (e.g. pro and con for an issue).", topic: "data" },
    { code: "8.1.3.1", strand: "Information Literacy and Research", title: "Source relevance", benchmark: "Determine if the source is relevant for the personal or academic purpose, using a variety of strategies.", topic: "data" },
    { code: "8.1.3.2", strand: "Information Literacy and Research", title: "Credibility and authority", benchmark: "Determine the credibility and authority of a source, and select the best sources for the personal or academic purpose.", topic: "data" },
    { code: "8.1.3.3", strand: "Information Literacy and Research", title: "Reliability and accuracy", benchmark: "Determine if a source is reliable, accurate and current, using a variety of strategies.", topic: "data" },
    { code: "8.1.3.4", strand: "Information Literacy and Research", title: "Diverse perspectives in sources", benchmark: "Select information and sources that represent diverse perspectives using a variety of strategies.", topic: "data" },
    { code: "8.1.4.2", strand: "Information Literacy and Research", title: "Record and cite sources", benchmark: "Record information from sources with key identifiers (title, author, year, format/link); quote, paraphrase, summarize; avoid plagiarism.", topic: "data" },
    { code: "8.1.4.3", strand: "Information Literacy and Research", title: "Organize information", benchmark: "Organize information gathered from sources to make sense of it and prepare to share findings.", topic: "data" },
    { code: "8.1.5.1", strand: "Information Literacy and Research", title: "Synthesize and share findings", benchmark: "Synthesize information to new conclusions or understandings and share findings with a wide audience.", topic: "data" },
    { code: "8.1.5.2", strand: "Information Literacy and Research", title: "Reflect on research process", benchmark: "Reflect on the effectiveness of completed research (self-evaluate, peer evaluation, rubric, identify improvements, ask additional questions).", topic: "data" },
    { code: "8.2.1.1", strand: "Digital Citizenship", title: "Digital footprint", benchmark: "Describe how online actions create a digital footprint and affect future opportunities.", topic: "citizenship" },
    { code: "8.2.1.2", strand: "Digital Citizenship", title: "Impact of technology", benchmark: "Describe positive and negative impacts of technology on society, culture, and the environment.", topic: "citizenship" },
    { code: "8.2.1.3", strand: "Digital Citizenship", title: "Exchanging ideas online", benchmark: "Use technology to exchange ideas and information responsibly and respectfully.", topic: "citizenship" },
    { code: "8.2.2.1", strand: "Digital Citizenship", title: "Intellectual property", benchmark: "Describe intellectual property rights and how they apply to digital content.", topic: "citizenship" },
    { code: "8.2.2.2", strand: "Digital Citizenship", title: "Crediting sources", benchmark: "Credit sources appropriately when using others' work.", topic: "citizenship" },
    { code: "8.2.2.3", strand: "Digital Citizenship", title: "Privacy and security", benchmark: "Describe strategies to protect privacy and security online.", topic: "citizenship" },
    { code: "8.2.2.4", strand: "Digital Citizenship", title: "Decoding media messages", benchmark: "Analyze how media messages are constructed and how they influence audiences.", topic: "citizenship" },
    { code: "8.3.1.1", strand: "Technology and Innovation", title: "Purpose of digital tools", benchmark: "Describe the purpose of common academic programs/devices (including AI) and how they support personal or academic goals.", topic: "systems" },
    { code: "8.3.1.2", strand: "Technology and Innovation", title: "Describe tech problems", benchmark: "Describe technology problems in detail using accurate technology terminology.", topic: "systems" },
    { code: "8.3.1.3", strand: "Technology and Innovation", title: "Troubleshooting strategies", benchmark: "Use strategies to solve technology problems (retry, restart, connectivity/hardware/software checks, cache, settings, guides).", topic: "systems" },
    { code: "8.3.2.1", strand: "Technology and Innovation", title: "Select appropriate tools", benchmark: "Select appropriate technology for the task and purpose (communication, collaboration, creativity tools and features).", topic: "systems" },
    { code: "8.3.3.1", strand: "Technology and Innovation", title: "Design process", benchmark: "Create artifacts or solve open-ended problems using a design process (identify, generate, prototype, test, improve).", topic: "design" },
    { code: "8.3.3.2", strand: "Technology and Innovation", title: "Computational thinking", benchmark: "Use computational thinking strategies (decomposition, pattern recognition, abstraction, algorithms) to solve problems.", topic: "code" },
    { code: "8.3.3.3", strand: "Technology and Innovation", title: "Algorithms and programming", benchmark: "Create programs using sequences, loops, events, conditionals, and variables to solve problems.", topic: "code" },
    { code: "8.3.4.2", strand: "Technology and Innovation", title: "Collaborate with peers", benchmark: "Collaborate with peers using technology to create products and solve problems.", topic: "design" },
  ];

  function buildStandards() {
    const catalog = window.WriteFlowItemStandards;
    if (!catalog?.getByCode) return FALLBACK_STANDARDS;

    return DIAGNOSTIC_CODES.map((code) => {
      const row = catalog.getByCode(code);
      const fallback = FALLBACK_STANDARDS.find((s) => s.code === code);
      if (!row && !fallback) return null;
      return {
        code,
        strand: row?.strand || fallback?.strand || "",
        title: row?.shortTitle || fallback?.title || code,
        benchmark: row?.benchmark || fallback?.benchmark || "",
        topic: CODE_TOPIC[code] || "general",
      };
    }).filter(Boolean);
  }

  const ITEM_STANDARDS = buildStandards();
  const DIAGNOSTIC_CODE_SET = new Set(DIAGNOSTIC_CODES);

  const QUIZ_COUNT = 20;
  const TYPING_DURATION = 120;
  const GLYPHS = ["A", "B", "C", "D", "E"];

  function getQuestions() {
    const pool = window.ITEMDiagnosticBank || [];
    return pool.filter((q) => q?.std && DIAGNOSTIC_CODE_SET.has(q.std));
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
      stdBenchmark: answer.stdBenchmark || meta?.benchmark || "",
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
      if (!byStd[a.std]) byStd[a.std] = { correct: 0, total: 0, title: "", strand: "", benchmark: "" };
      byStd[a.std].total++;
      if (a.correct) byStd[a.std].correct++;
      const ref = ITEM_STANDARDS.find((s) => s.code === a.std);
      if (ref) {
        byStd[a.std].title = ref.title;
        byStd[a.std].strand = ref.strand;
        byStd[a.std].benchmark = ref.benchmark;
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
      benchmark: s.benchmark,
      count: byStd.get(s.code)?.length || 0,
    }));
  }

  window.ITEMDiagnostic = {
    DIAGNOSTIC_CODES,
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
