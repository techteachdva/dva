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
];

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

export function isValidClassroom(value) {
  return Boolean(resolveClassroom(value));
}
