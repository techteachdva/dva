/**
 * ITEM 2025 standards reference + diagnostic question utilities.
 * Question bank loaded from Tech Escape via item-diagnostic-loader.js (128 questions).
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

  function getQuestions() {
    return window.ITEMDiagnosticBank || [];
  }

  /** Stratified draw: spread across topics, prefer level 2, avoid duplicate standards when possible. */
  function drawQuestions(pool, count) {
    const Core = window.WriteTestCore;
    if (!pool.length) return [];
    const byTopic = { design: [], systems: [], data: [], code: [], general: [] };
    for (const q of pool) {
      const t = q.topic === "citizenship" ? "data" : q.topic;
      (byTopic[t] || byTopic.general).push(q);
    }
    const topics = ["design", "systems", "data", "code"];
    const perTopic = Math.ceil(count / topics.length);
    const picked = [];
    const usedStd = new Set();

    for (const topic of topics) {
      const bucket = Core.shuffle(byTopic[topic] || []);
      let added = 0;
      for (const q of bucket) {
        if (added >= perTopic || picked.length >= count) break;
        if (usedStd.has(q.std) && bucket.length > perTopic) continue;
        picked.push(q);
        usedStd.add(q.std);
        added++;
      }
    }

    if (picked.length < count) {
      const rest = Core.shuffle(pool.filter((q) => !picked.includes(q)));
      picked.push(...rest.slice(0, count - picked.length));
    }

    return Core.shuffle(picked).slice(0, count);
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

  window.ITEMDiagnostic = {
    ITEM_STANDARDS,
    QUIZ_COUNT,
    TYPING_DURATION,
    getQuestions,
    drawQuestions,
    mapResultsToStandards,
    topicSummary,
  };
})();
