import { createRequire } from "module";

const require = createRequire(import.meta.url);

/** Single source of truth: api/diagnostic-writing/classes.json */
export const VALID_CLASSROOMS = require("./classes.json");

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
