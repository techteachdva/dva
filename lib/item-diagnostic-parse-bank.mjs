/**
 * Turns a teacher spreadsheet (or the runtime JSON shape) into ITEM Diagnostic questions.
 * The built-in Tech Escape bank stays the fallback when no upload is published.
 *
 * Accepted tables need a header row — on row 1, or under a title block — with:
 *   Question, Standard code, A–D, Correct
 * Optional: ID, Standard, Level, Why this is right, In diagnostic pool, Terminal, Topic
 */
import XLSX from "xlsx";

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
  ["secondary", ["also aligns to", "secondary standard", "also aligns"]],
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
  if (s.startsWith("2") || s.includes("core")) return 2;
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
  if (!s) return "";
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

function resolveTopic(record, id, code) {
  return knownTopic(record.topic)
    || topicFromTerminal(record.terminal)
    || topicFromId(id)
    || CODE_TOPIC[code]
    || "general";
}

function optionList(record) {
  const fromArray = Array.isArray(record.a) ? record.a : Array.isArray(record.options) ? record.options : null;
  const source = fromArray || [record.A, record.B, record.C, record.D, record.E];
  const options = source.map((value) => clip(value, 400));
  while (options.length && !options[options.length - 1]) options.pop();
  return options.slice(0, 5);
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

function numericCorrect(value, optionCount) {
  if (!Array.isArray(value)) return [];
  const indices = [];
  for (const entry of value) {
    const index = Number(entry);
    if (Number.isInteger(index) && index >= 0 && index < optionCount && !indices.includes(index)) {
      indices.push(index);
    }
  }
  return indices;
}

function sheetRank(name) {
  const n = String(name || "").toLowerCase();
  if (n.includes("by standard") || n === "questions" || n === "question bank") return 3;
  if (n.includes("question") || n.includes("bank")) return 2;
  if (n.includes("terminal")) return 1;
  if (n.includes("summary") || n.includes("start")) return -1;
  return 0;
}

function mapHeader(row) {
  const columns = new Map();
  row.forEach((cell, index) => {
    const field = fieldForHeader(cell);
    if (field && !columns.has(field)) columns.set(field, index);
  });
  return columns;
}

function headerScore(columns) {
  if (!columns.has("question")) return 0;
  if (!columns.has("A") && !columns.has("correct") && !columns.has("correctText")) return 0;
  if (!columns.has("code") && !columns.has("id")) return 0;
  return columns.size;
}

function recordFromRow(row, columns) {
  const record = {};
  for (const [field, index] of columns.entries()) {
    record[field] = row[index] ?? "";
  }
  return record;
}

function questionFromRecord(record, rowNumber, seenIds) {
  if (!includeInPool(record.pool)) {
    return { excluded: true };
  }

  const options = optionList(record);
  const question = clip(record.question || record.q, 600);
  const code = cleanCode(record.code || record.std);
  const label = record.rowLabel || "Row";

  if (!question && !code && options.every((option) => !option)) return { skip: true };
  if (normalizeHeader(question) === "question") return { skip: true };

  if (!question) return { error: `${label} ${rowNumber}: missing a question.` };
  if (!code) return { error: `${label} ${rowNumber}: missing a standard code.` };
  if (options.length < 2) return { error: `${label} ${rowNumber}: needs at least two answer choices.` };
  if (options.some((option) => !option)) {
    return { error: `${label} ${rowNumber}: an answer choice is blank in the middle of the row.` };
  }

  let correct = numericCorrect(record.correct, options.length);
  if (!correct.length) correct = lettersToIndices(record.correct, options.length);
  if (!correct.length) correct = indicesFromCorrectText(record.correctText, options);
  if (!correct.length) correct = indicesFromCorrectText(record.correct, options);
  if (!correct.length) return { error: `${label} ${rowNumber}: no correct answer marked.` };
  if (correct.some((index) => !options[index])) {
    return { error: `${label} ${rowNumber}: a correct answer points at an empty choice.` };
  }

  const warnings = [];
  let id = clip(record.id, 64).replace(/\s+/g, "-");
  if (!id) {
    id = `Q-${String(seenIds.size + 1).padStart(3, "0")}`;
    warnings.push(`${label} ${rowNumber}: no ID, so it was named ${id}.`);
  }
  if (seenIds.has(id)) {
    let next = 2;
    let renamed = `${id}-${next}`;
    while (seenIds.has(renamed)) {
      next += 1;
      renamed = `${id}-${next}`;
    }
    warnings.push(`${label} ${rowNumber}: duplicate ID ${id}, saved as ${renamed}.`);
    id = renamed;
  }
  seenIds.add(id);

  const why = clip(record.why, 800);
  if (!why) warnings.push(`${label} ${rowNumber} (${id}): no explanation.`);

  const stdLabel = clip(record.standard || record.stdLabel, 160).replace(/^ITEM\s+[\d.]+\s*-\s*/i, "").trim();

  return {
    question: {
      id,
      std: code,
      stdLabel: stdLabel && stdLabel !== code ? stdLabel : "",
      topic: resolveTopic(record, id, code),
      q: question,
      a: options,
      correct,
      why,
      level: parseLevel(record.level),
      strand: clip(record.strand, 160),
    },
    warnings,
  };
}

function collectQuestions(records) {
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
    if (questions.length >= MAX_QUESTIONS) {
      warnings.push(`Only the first ${MAX_QUESTIONS} questions were kept.`);
      break;
    }
  }

  return { questions, errors, warnings, excluded };
}

function parseMatrix(rows, sheetName) {
  let headerIndex = -1;
  let columns = new Map();
  let bestScore = 0;
  const scan = Math.min(rows.length, 25);
  for (let i = 0; i < scan; i += 1) {
    const mapped = mapHeader(rows[i] || []);
    const score = headerScore(mapped);
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
      sheetName,
    };
  }

  const records = [];
  for (let i = headerIndex + 1; i < rows.length; i += 1) {
    const row = rows[i] || [];
    if (row.every((cell) => String(cell ?? "").trim() === "")) continue;
    records.push({ ...recordFromRow(row, columns), __row: i + 1 });
  }
  return { ...collectQuestions(records), sheetName };
}

function parseSpreadsheet(buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false });
  let best = null;
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" });
    const parsed = parseMatrix(rows, sheetName);
    const score = headerScore(mapHeader(rows.find((row) => headerScore(mapHeader(row)) > 0) || []));
    const rank = parsed.questions.length * 10 + sheetRank(sheetName) + score;
    if (!best || rank > best.rank) best = { ...parsed, rank };
  }
  if (!best) {
    return {
      questions: [],
      errors: ["This spreadsheet has no sheets."],
      warnings: [],
      excluded: 0,
      sheetName: "",
    };
  }
  return {
    questions: best.questions,
    errors: best.errors,
    warnings: best.warnings,
    excluded: best.excluded,
    sheetName: best.sheetName,
  };
}

function parseJsonBank(text) {
  let data;
  try {
    data = JSON.parse(String(text).replace(/^\uFEFF/, ""));
  } catch {
    return {
      questions: [],
      errors: ["This JSON file could not be read."],
      warnings: [],
      excluded: 0,
      sheetName: "JSON",
    };
  }
  const list = Array.isArray(data) ? data : Array.isArray(data?.questions) ? data.questions : null;
  if (!list) {
    return {
      questions: [],
      errors: ["JSON should be a list of questions, or an object with a questions list."],
      warnings: [],
      excluded: 0,
      sheetName: "JSON",
    };
  }
  const records = list.map((item, index) => ({
    ...(item || {}),
    __row: index + 1,
    rowLabel: "Item",
  }));
  return { ...collectQuestions(records), sheetName: "JSON" };
}

export function parseBankFile(buffer, filename = "") {
  const name = String(filename || "").toLowerCase();
  const bytes = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || []);
  if (!bytes.length) {
    return {
      questions: [],
      errors: ["The file is empty."],
      warnings: [],
      excluded: 0,
      sheetName: "",
    };
  }
  const start = bytes.subarray(0, 1).toString("utf8");
  if (name.endsWith(".json") || start === "[" || start === "{") {
    return parseJsonBank(bytes.toString("utf8"));
  }
  try {
    return parseSpreadsheet(bytes);
  } catch {
    return {
      questions: [],
      errors: ["This file is not a spreadsheet the diagnostic can read. Upload .xlsx, .csv, or .json."],
      warnings: [],
      excluded: 0,
      sheetName: "",
    };
  }
}

/** Re-check a list already parsed in the browser before it is published. */
export function normalizeQuestionList(items) {
  const records = (Array.isArray(items) ? items : []).map((item, index) => ({
    ...(item || {}),
    __row: index + 1,
    rowLabel: "Item",
  }));
  return collectQuestions(records);
}
