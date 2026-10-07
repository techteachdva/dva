/**
 * Reads a teacher CSV or JSON question bank in the browser.
 * The built-in Tech Escape bank stays in the page. An uploaded bank is saved
 * only in this browser.
 */
(() => {
  "use strict";

  const MAX_QUESTIONS = 500;
  const FIELD_ALIASES = [
    ["id", ["id", "question id", "qid"]],
    ["code", ["standard code", "item code", "item standard", "std code", "code", "item"]],
    ["standard", ["standard title", "standard name", "std label", "standard"]],
    ["strand", ["strand"]],
    ["level", ["level", "difficulty"]],
    ["question", ["question", "prompt", "q"]],
    ["A", ["option a", "choice a", "answer a", "a"]],
    ["B", ["option b", "choice b", "answer b", "b"]],
    ["C", ["option c", "choice c", "answer c", "c"]],
    ["D", ["option d", "choice d", "answer d", "d"]],
    ["E", ["option e", "choice e", "answer e", "e"]],
    ["correct", ["correct letters", "correct", "answer key", "answers"]],
    ["correctText", ["correct answer", "correct answers"]],
    ["why", ["why this is right", "explanation", "rationale", "why"]],
    ["pool", ["in diagnostic pool", "diagnostic pool", "include in quiz", "include"]],
    ["topic", ["topic"]],
    ["terminal", ["terminal"]],
  ];

  const CODE_TOPIC = {
    "8.1.2.3": "data", "8.1.3.1": "data", "8.1.3.2": "data", "8.1.3.3": "data", "8.1.3.4": "data",
    "8.1.4.2": "data", "8.1.4.3": "data", "8.1.5.1": "data", "8.1.5.2": "data",
    "8.2.1.1": "citizenship", "8.2.1.2": "citizenship", "8.2.1.3": "citizenship",
    "8.2.2.1": "citizenship", "8.2.2.2": "citizenship", "8.2.2.3": "citizenship", "8.2.2.4": "citizenship",
    "8.3.1.1": "systems", "8.3.1.2": "systems", "8.3.1.3": "systems", "8.3.2.1": "systems",
    "8.3.3.1": "design", "8.3.3.2": "code", "8.3.3.3": "code", "8.3.4.2": "design",
  };

  function clip(value, max) {
    return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
  }

  function normalizeHeader(value) {
    return String(value ?? "")
      .replace(/^\uFEFF/, "")
      .toLowerCase()
      .replace(/[_/]+/g, " ")
      .replace(/[^a-z0-9. ]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function fieldForHeader(value) {
    const norm = normalizeHeader(value);
    if (!norm) return "";
    let best = "";
    let bestLen = 0;
    for (const [field, aliases] of FIELD_ALIASES) {
      for (const alias of aliases) {
        if (norm === alias && alias.length > bestLen) {
          best = field;
          bestLen = alias.length;
        }
      }
    }
    return best;
  }

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let cell = "";
    let quoted = false;
    const src = String(text || "").replace(/^\uFEFF/, "");
    for (let i = 0; i < src.length; i += 1) {
      const ch = src[i];
      if (quoted) {
        if (ch === '"') {
          if (src[i + 1] === '"') {
            cell += '"';
            i += 1;
          } else {
            quoted = false;
          }
        } else {
          cell += ch;
        }
        continue;
      }
      if (ch === '"') {
        quoted = true;
        continue;
      }
      if (ch === ",") {
        row.push(cell);
        cell = "";
        continue;
      }
      if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && src[i + 1] === "\n") i += 1;
        row.push(cell);
        rows.push(row);
        row = [];
        cell = "";
        continue;
      }
      cell += ch;
    }
    if (cell.length || row.length) {
      row.push(cell);
      rows.push(row);
    }
    return rows;
  }

  function cleanCode(value) {
    const raw = clip(value, 80);
    if (!raw) return "";
    const item = raw.match(/^ITEM\s+([\d.]+)/i) || raw.match(/^(\d+(?:\.\d+)+)$/);
    if (item) return item[1];
    return raw.replace(/^ITEM\s+/i, "").trim();
  }

  function parseLevel(value) {
    const s = String(value ?? "").toLowerCase();
    if (s.startsWith("1") || s.includes("approach")) return 1;
    if (s.startsWith("3") || s.includes("challeng")) return 3;
    return 2;
  }

  function includeInPool(value) {
    if (value == null || String(value).trim() === "") return true;
    const s = String(value).trim().toLowerCase();
    return !["no", "n", "false", "0", "exclude", "excluded"].includes(s);
  }

  function knownTopic(value) {
    const s = String(value ?? "").trim().toLowerCase();
    if (["design", "systems", "data", "code", "citizenship"].includes(s)) return s;
    return "";
  }

  function topicFromTerminal(value) {
    const s = String(value ?? "").toLowerCase();
    if (s.includes("design")) return "design";
    if (s.includes("network") || s.includes("system")) return "systems";
    if (s.includes("data") || s.includes("citizen")) return "data";
    if (s.includes("code") || s.includes("algorithm") || s.includes("program")) return "code";
    return "";
  }

  function topicFromId(id) {
    const value = String(id || "");
    if (value.startsWith("DES-")) return "design";
    if (value.startsWith("SYS-")) return "systems";
    if (value.startsWith("DAT-")) return "data";
    if (value.startsWith("COD-")) return "code";
    return "";
  }

  function lettersToIndices(value, optionCount) {
    const found = String(value ?? "").toUpperCase().match(/[A-E]/g) || [];
    const indices = [];
    for (const letter of found) {
      const index = letter.charCodeAt(0) - 65;
      if (index < optionCount && !indices.includes(index)) indices.push(index);
    }
    return indices;
  }

  function indicesFromCorrectText(value, options) {
    const chunks = String(value ?? "").split(/\n|·|\|/).map((part) => part.trim()).filter(Boolean);
    const indices = [];
    for (const chunk of chunks) {
      const letter = chunk.match(/^([A-E])(?:[\).:\s-]|$)/i);
      if (letter) {
        const index = letter[1].toUpperCase().charCodeAt(0) - 65;
        if (index < options.length && !indices.includes(index)) indices.push(index);
        continue;
      }
      const text = chunk.replace(/^[A-E][\).:\s-]+/i, "").trim();
      const index = options.findIndex((option) => option === text);
      if (index >= 0 && !indices.includes(index)) indices.push(index);
    }
    return indices;
  }

  function questionFromRecord(record, rowNumber, seenIds) {
    if (!includeInPool(record.pool)) return { excluded: true };
    const options = [record.A, record.B, record.C, record.D, record.E]
      .map((value) => clip(value, 400));
    while (options.length && !options[options.length - 1]) options.pop();
    const question = clip(record.question || record.q, 600);
    const code = cleanCode(record.code || record.std);
    if (!question && !code && options.every((option) => !option)) return { skip: true };
    if (normalizeHeader(question) === "question") return { skip: true };
    if (!question) return { error: `Row ${rowNumber}: missing a question.` };
    if (!code) return { error: `Row ${rowNumber}: missing a standard code.` };
    if (options.length < 2) return { error: `Row ${rowNumber}: needs at least two answer choices.` };
    if (options.some((option) => !option)) return { error: `Row ${rowNumber}: an answer choice is blank in the middle of the row.` };

    let correct = Array.isArray(record.correct)
      ? record.correct.map(Number).filter((index) => Number.isInteger(index) && index >= 0 && index < options.length)
      : [];
    if (!correct.length) correct = lettersToIndices(record.correct, options.length);
    if (!correct.length) correct = indicesFromCorrectText(record.correctText, options);
    if (!correct.length) correct = indicesFromCorrectText(record.correct, options);
    if (!correct.length) return { error: `Row ${rowNumber}: no correct answer marked.` };

    const warnings = [];
    let id = clip(record.id, 64).replace(/\s+/g, "-");
    if (!id) {
      id = `Q-${String(seenIds.size + 1).padStart(3, "0")}`;
      warnings.push(`Row ${rowNumber}: no ID, so it was named ${id}.`);
    }
    if (seenIds.has(id)) {
      let next = 2;
      let renamed = `${id}-${next}`;
      while (seenIds.has(renamed)) {
        next += 1;
        renamed = `${id}-${next}`;
      }
      warnings.push(`Row ${rowNumber}: duplicate ID ${id}, saved as ${renamed}.`);
      id = renamed;
    }
    seenIds.add(id);

    const stdLabel = clip(record.standard || record.stdLabel, 160).replace(/^ITEM\s+[\d.]+\s*-\s*/i, "").trim();
    return {
      question: {
        id,
        std: code,
        stdLabel: stdLabel && stdLabel !== code ? stdLabel : "",
        topic: knownTopic(record.topic) || topicFromTerminal(record.terminal) || topicFromId(id) || CODE_TOPIC[code] || "general",
        q: question,
        a: options,
        correct,
        why: clip(record.why, 800),
        level: parseLevel(record.level),
        strand: clip(record.strand, 160),
      },
      warnings,
    };
  }

  function collect(records) {
    const questions = [];
    const errors = [];
    const warnings = [];
    let excluded = 0;
    const seenIds = new Set();
    for (const record of records) {
      const result = questionFromRecord(record, record.__row || questions.length + 1, seenIds);
      if (result.skip) continue;
      if (result.excluded) {
        excluded += 1;
        continue;
      }
      if (result.error) {
        errors.push(result.error);
        continue;
      }
      warnings.push(...(result.warnings || []));
      questions.push(result.question);
      if (questions.length >= MAX_QUESTIONS) break;
    }
    return { questions, errors, warnings, excluded };
  }

  function parseTable(rows) {
    let headerIndex = -1;
    let columns = new Map();
    let bestScore = 0;
    const scan = Math.min(rows.length, 25);
    for (let i = 0; i < scan; i += 1) {
      const mapped = new Map();
      (rows[i] || []).forEach((cell, index) => {
        const field = fieldForHeader(cell);
        if (field && !mapped.has(field)) mapped.set(field, index);
      });
      const score = mapped.has("question") && (mapped.has("A") || mapped.has("correct")) && (mapped.has("code") || mapped.has("id"))
        ? mapped.size
        : 0;
      if (score > bestScore) {
        bestScore = score;
        headerIndex = i;
        columns = mapped;
      }
    }
    if (headerIndex < 0) {
      return {
        questions: [],
        errors: ["No question table found. Include columns for Question, Standard code, A–D, and Correct."],
        warnings: [],
        excluded: 0,
      };
    }
    const records = [];
    for (let i = headerIndex + 1; i < rows.length; i += 1) {
      const row = rows[i] || [];
      if (row.every((cell) => String(cell ?? "").trim() === "")) continue;
      const record = { __row: i + 1 };
      for (const [field, index] of columns.entries()) record[field] = row[index] ?? "";
      records.push(record);
    }
    return collect(records);
  }

  function parseJson(text) {
    let data;
    try {
      data = JSON.parse(String(text).replace(/^\uFEFF/, ""));
    } catch {
      return { questions: [], errors: ["This JSON file could not be read."], warnings: [], excluded: 0 };
    }
    const list = Array.isArray(data) ? data : Array.isArray(data?.questions) ? data.questions : null;
    if (!list) {
      return { questions: [], errors: ["JSON should be a list of questions."], warnings: [], excluded: 0 };
    }
    return collect(list.map((item, index) => ({ ...(item || {}), __row: index + 1 })));
  }

  function parseBankText(text, filename) {
    const name = String(filename || "").toLowerCase();
    const raw = String(text || "");
    if (!raw.trim()) {
      return { questions: [], errors: ["The file is empty."], warnings: [], excluded: 0 };
    }
    if (name.endsWith(".xlsx") || name.endsWith(".xls") || raw.startsWith("PK")) {
      return {
        questions: [],
        errors: ["Upload a CSV. In Google Sheets use File → Download → Comma-separated values."],
        warnings: [],
        excluded: 0,
      };
    }
    if (name.endsWith(".json") || raw.trim().startsWith("[") || raw.trim().startsWith("{")) return parseJson(raw);
    return parseTable(parseCsv(raw));
  }

  window.ITEMDiagnosticBankFormat = { parseBankText };
})();
