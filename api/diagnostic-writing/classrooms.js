/** Auto-generated from api/diagnostic-writing/classes.json — run: npm run sync:classrooms */
export const VALID_CLASSROOMS = [
  "Tech: Media Arts",
  "Tech 6-A-2",
  "Tech 7-A-4",
  "Mr. Phil's Advisory",
  "Tech 6-A-5",
  "Tech 7-A-6",
  "Tech: Video Production",
  "Tech 8-B-2",
  "Tech: Game Design",
  "Tech 7-B-5",
  "Tech 6-B-6",
  "Mrs. Eckart 6th Grade ELA",
  "Mrs. McCarthy 7th Grade ELA",
  "Mrs. Severson 8th Grade ELA",
  "Teacher's Lounge",
];

export const CLASSROOM_CODES = {
  "Tech: Media Arts": "storyboard",
  "Tech 6-A-2": "variable",
  "Tech 7-A-4": "function",
  "Mr. Phil's Advisory": "dontbeagort",
  "Tech 6-A-5": "circuit",
  "Tech 7-A-6": "debugging",
  "Tech: Video Production": "lightscamera",
  "Tech 8-B-2": "prototype",
  "Tech: Game Design": "rollforit",
  "Tech 7-B-5": "iteration",
  "Tech 6-B-6": "binary",
  "Mrs. Eckart 6th Grade ELA": "narrative",
  "Mrs. McCarthy 7th Grade ELA": "revision",
  "Mrs. Severson 8th Grade ELA": "thesis",
  "Teacher's Lounge": "alwayslearning",
};

const APOSTROPHE_RE = /[\u2018\u2019\u201B\u2032]/g;

export function normalizeClassroom(value) {
  return String(value || "").trim().replace(APOSTROPHE_RE, "'");
}

/** Returns the canonical classroom name from classes.json, or "" if invalid. */
export function resolveClassroom(value) {
  const norm = normalizeClassroom(value);
  if (!norm) return "";
  for (const classroom of VALID_CLASSROOMS) {
    if (normalizeClassroom(classroom) === norm) return classroom;
  }
  return "";
}

export function normalizeClassCode(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, "");
}

export function verifyClassroomCode(classroom, code) {
  const resolved = resolveClassroom(classroom);
  if (!resolved) return false;
  const expected = CLASSROOM_CODES[resolved];
  if (!expected) return false;
  return normalizeClassCode(code) === normalizeClassCode(expected);
}

export function isValidClassroom(value) {
  return Boolean(resolveClassroom(value));
}
