/**
 * Global Tech Gauntlet — class roster helpers (shared by API routes).
 */
import rosterData from "./class-roster.json" with { type: "json" };
import { VALID_CLASSROOMS, resolveClassroom, verifyClassroomCode } from "../diagnostic-writing/classrooms.js";

/** Roster sheet username → GTG display name (e.g. "Aaron R." → "Aaron R") */
export function normalizeGtgName(raw) {
  const s = String(raw || "").trim().replace(/\s+/g, " ");
  if (!s) return "";
  const parts = s.replace(/\.$/, "").split(/\s+/);
  if (parts.length < 2) return s.replace(/\.$/, "");
  const last = parts[parts.length - 1].replace(/\./g, "").toUpperCase().slice(0, 1);
  const first = parts.slice(0, -1).join(" ");
  return `${first} ${last}`;
}

export function rosterKey(name) {
  return normalizeGtgName(name).toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function parseStudentName(firstRaw, lastRaw) {
  const first = String(firstRaw ?? "").trim();
  const last = String(lastRaw ?? "").trim();
  if (!first) return { ok: false, message: "Type your first name." };
  if (!/[\p{L}][\p{L}'-]{0,15}$/u.test(first)) {
    return { ok: false, message: "First name: letters only, up to 16 characters." };
  }
  if (!last || !/^[\p{L}.]{1,3}$/u.test(last)) {
    return { ok: false, message: "Last initial must be one or two letters." };
  }
  const lastNorm = last.replace(/\./g, "").toUpperCase().slice(0, 2);
  return { ok: true, name: `${first} ${lastNorm}` };
}

export function rosterNamesForClassroom(classroom) {
  const room = resolveClassroom(classroom);
  if (!room) return [];
  const names = rosterData.classrooms?.[room];
  if (!Array.isArray(names)) return [];
  return names.map(normalizeGtgName).filter(Boolean).sort((a, b) => a.localeCompare(b));
}

export function matchRosterName(name, classroom) {
  const room = resolveClassroom(classroom);
  if (!room) return { ok: false, message: "Invalid classroom." };
  const target = rosterKey(name);
  if (!target) return { ok: false, message: "Enter your name." };
  const pool = rosterNamesForClassroom(room);
  if (!pool.length) {
    return { ok: false, message: "No roster loaded for this class yet. Ask your teacher to add names to the Class Rosters sheet." };
  }
  const hit = pool.find((entry) => rosterKey(entry) === target);
  if (!hit) {
    return { ok: false, message: "That name is not on your class roster. Pick the exact spelling from the list." };
  }
  return { ok: true, name: hit, classroom: room };
}

export function verifyClassAccess(classroomRaw, classCode) {
  const classroom = resolveClassroom(classroomRaw);
  if (!classroom) return { ok: false, message: "Invalid classroom." };
  if (!verifyClassroomCode(classroom, classCode)) {
    return { ok: false, message: "Incorrect class passcode." };
  }
  return { ok: true, classroom };
}

export function listClassrooms() {
  return [...VALID_CLASSROOMS];
}

export { rosterData };
