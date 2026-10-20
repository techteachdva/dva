/**
 * Class report codes: a session's results packed into one pasteable line.
 *
 * Saves stay in each student's browser. At the end of a session the exit ticket shows a code
 * like CM1.eyJ2Ijox….k3f9a. The student pastes it into the teacher's Google Form; the teacher
 * pastes the form's answers into teacher.html, which decodes every code into a class report
 * by Morpheme Magic lesson. Nothing is sent anywhere by the game itself.
 *
 * Payload (JSON, base64url, then a checksum so a half-copied code is caught):
 *   v  version                 n  student name           s  session start (unix seconds)
 *   m  minutes played          w  words compiled         r  Rotlings debugged
 *   L  { lessonKey: [tries, firstTry, ...ERROR_KINDS counts] }   this session
 *   M  { lessonKey: [avg mastery ×10, fading count, morphemes learned] }   all time
 *
 * No imports, so the teacher page can load it on its own.
 */

/** Error kinds, in code order. Each maps to a different reteach move (see teacher.html). */
export const ERROR_KINDS = ['seam', 'joint', 'order', 'link', 'real', 'family', 'meaning'];
export const ERROR_LABEL = {
  seam: 'cut in the wrong place',
  joint: 'missed a spelling change',
  order: 'accepted parts in the wrong order',
  link: 'missed a linking vowel',
  real: 'called a real word fake',
  family: 'picked the wrong spelling of the right meaning',
  meaning: 'picked a part with the wrong meaning',
};

const PREFIX = 'CM1';

function b64urlEncode(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(s) {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(b64);
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

/** FNV-1a, 32 bit, as 5 base-36 characters. */
function checksum(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(36).padStart(7, '0').slice(-5);
}

export function encodeReport(payload) {
  const body = b64urlEncode(JSON.stringify({ v: 1, ...payload }));
  return `${PREFIX}.${body}.${checksum(body)}`;
}

/** Decode one code. Returns the payload, or { error } if it is damaged. */
export function decodeReport(code) {
  const parts = String(code).trim().split('.');
  if (parts.length !== 3 || parts[0] !== PREFIX) return { error: 'not a CyberMorph code' };
  if (checksum(parts[1]) !== parts[2]) return { error: 'damaged (part of the code is missing)' };
  try { return JSON.parse(b64urlDecode(parts[1])); } catch { return { error: 'unreadable' }; }
}

/** Every code found anywhere in a block of pasted text (a whole Sheets column works). */
export function findCodes(text) {
  return [...String(text).matchAll(/CM1\.[A-Za-z0-9_-]+\.[0-9a-z]{5}/g)].map((m) => m[0]);
}
