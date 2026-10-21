/**
 * Dialogue portraits: each speaker drawn as an SVG in code, in five moods (see MOODS in dialogue.js).
 * One shared style: a 100 × 100 card, thick ink outlines, flat fills with one shade, a glow colour per speaker.
 *
 * The mouth is two layers (.pm-shut and .pm-open). While a line types, #dlg-portrait gets .talking and
 * portraits.css flips between them. A mood change re-triggers .pop. Both stay still under reduced motion.
 */

import { settings } from '../core/settings.js';

const INK = '#10131f';
const SW = 'stroke="#10131f" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"';
const MOOD_SET = new Set(['neutral', 'pleased', 'worried', 'special', 'rot']);

const mouth = (shut, open) => `<g class="pm"><g class="pm-shut">${shut}</g><g class="pm-open">${open}</g></g>`;
const star = (cx, cy, r, fill, extra = '') => {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 ? r * 0.45 : r;
    pts.push(`${(cx + Math.cos(a) * rr).toFixed(1)},${(cy + Math.sin(a) * rr).toFixed(1)}`);
  }
  return `<polygon points="${pts.join(' ')}" fill="${fill}" ${extra}/>`;
};
const sparkle = (x, y, s, fill) => `<path d="M${x} ${y - s}L${x + s * 0.28} ${y - s * 0.28}L${x + s} ${y}L${x + s * 0.28} ${y + s * 0.28}L${x} ${y + s}L${x - s * 0.28} ${y + s * 0.28}L${x - s} ${y}L${x - s * 0.28} ${y - s * 0.28}Z" fill="${fill}"/>`;

/** The card behind every portrait: a tinted radial glow and a mood-coloured rim light. */
function card(id, bg, glow) {
  return `<defs><radialGradient id="pg-${id}" cx="50%" cy="40%" r="70%"><stop offset="0" stop-color="${glow}" stop-opacity="0.55"/><stop offset="1" stop-color="${bg}" stop-opacity="1"/></radialGradient></defs>
  <rect width="100" height="100" fill="${bg}"/><rect width="100" height="100" fill="url(#pg-${id})"/>`;
}

// ── Old Wynn: a chunky amber CRT robot, warm and a bit grumpy, reading glasses on her screen ─
function wynn(mood) {
  const rot = mood === 'rot';
  const A = '#ffb000';
  const E = '#ffc861';
  const SCR = '#2a1808';
  const PUP = '#3a1e08';
  // A big round eye. lid (0..1) is how far the soft eyelid comes down; tilt turns its edge.
  const eye = (cx, side, { lid = 0, tilt = 0, pupil = 3.2, look = 0 } = {}) => {
    const cy = 47;
    const r = 8.5;
    const id = `wy-${side}-${mood}`;
    const lidY = cy - r + lid * 2 * r;
    const lidMarkup = lid > 0
      ? `<g clip-path="url(#${id})"><g transform="rotate(${tilt} ${cx} ${lidY})"><rect x="${cx - 12}" y="${cy - 16}" width="24" height="${lidY - cy + 16}" fill="#6b4013"/><path d="M${cx - 12} ${lidY}H${cx + 12}" stroke="${A}" stroke-width="1.8"/></g></g>`
      : '';
    return `<clipPath id="${id}"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="${E}"/>
      <circle cx="${cx + look}" cy="${cy + 1}" r="${pupil}" fill="${PUP}"/><circle cx="${cx + look + 1.3}" cy="${cy - 0.8}" r="1.2" fill="#fff"/>${lidMarkup}`;
  };
  const happyEye = (cx) => `<path d="M${cx - 7} ${50}Q${cx} ${41} ${cx + 7} ${50}" stroke="${E}" stroke-width="3.6" fill="none" stroke-linecap="round"/>`;
  let eyes = eye(38, 'l', { lid: 0.28 }) + eye(62, 'r', { lid: 0.28 });
  let brows = 'M31 38Q38 35 45 37M55 37Q62 35 69 38';
  let shut = `<path d="M43 63Q50 66.5 57 62" stroke="${A}" stroke-width="2.8" fill="none" stroke-linecap="round"/><path d="M57 62L58.5 60.5" stroke="${A}" stroke-width="2" stroke-linecap="round"/>`;
  let open = `<path d="M43 62Q50 71 57 61Q50 64 43 62Z" fill="${A}"/>`;
  let cheeks = 0.45;
  let extra = '';
  if (mood === 'pleased') {
    eyes = happyEye(38) + happyEye(62);
    brows = 'M31 36Q38 32 45 35M55 35Q62 32 69 36';
    shut = `<path d="M41 61Q50 70 59 59" stroke="${A}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
    open = `<path d="M41 60.5Q50 74 59 58.5Q50 64 41 60.5Z" fill="${A}"/><path d="M46 66Q50 69 54 65.5" stroke="#ff7a59" stroke-width="2" fill="none" stroke-linecap="round"/>`;
    cheeks = 0.75;
    extra = `<path d="M88 30C88 27 84 26 83 29C82 26 78 27 78 30C78 33 83 36 83 36C83 36 88 33 88 30Z" fill="#ff7a8a" ${SW} stroke-width="1.6"/>`;
  } else if (mood === 'worried') {
    eyes = eye(38, 'l', { pupil: 2.4 }) + eye(62, 'r', { pupil: 2.4 });
    brows = 'M31 39Q38 37 45 33M55 33Q62 37 69 39';
    shut = `<path d="M44 65Q47 62 50 65T56 64" stroke="${A}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
    open = `<ellipse cx="50" cy="64.5" rx="4.5" ry="3.8" fill="${A}"/>`;
    extra = `<path d="M84 40Q87 45 84 48Q81 45 84 40Z" fill="#8fd3ff" ${SW} stroke-width="1.4"/>`;
  } else if (mood === 'special') {
    // Grumpy, the comic kind: eyes half shut and rolled aside, one brow down, mouth flat. Hmph.
    eyes = eye(38, 'l', { lid: 0.52, tilt: 6, look: 2.5 }) + eye(62, 'r', { lid: 0.45, tilt: -3, look: 2.5 });
    brows = 'M31 35L45 40M55 35Q62 33 69 35';
    shut = `<path d="M43 64L57 62.5" stroke="${A}" stroke-width="2.8" stroke-linecap="round"/>`;
    open = `<path d="M43 63L57 61.5V64.5L43 66Z" fill="${A}" stroke="${A}" stroke-width="1.4" stroke-linejoin="round"/>`;
    cheeks = 0.3;
    extra = `<g class="pt-steam" fill="#f2ede2" ${SW} stroke-width="2"><circle cx="88" cy="24" r="5"/><circle cx="93" cy="16" r="3.5"/></g>`;
  } else if (rot) {
    // The Rot is in the room: wide-eyed alarm, a green glint on her glasses. No static on her screen.
    eyes = eye(38, 'l', { pupil: 1.9 }) + eye(62, 'r', { pupil: 1.9 });
    brows = 'M31 37Q38 33 45 32M55 32Q62 33 69 37';
    shut = `<ellipse cx="50" cy="64" rx="3" ry="3.4" fill="none" stroke="${A}" stroke-width="2.4"/>`;
    open = `<ellipse cx="50" cy="64" rx="4.4" ry="5" fill="${A}"/>`;
    cheeks = 0.2;
    extra = `<path d="M84 40Q87 45 84 48Q81 45 84 40Z" fill="#8fd3ff" ${SW} stroke-width="1.4"/>`;
  }
  const lens = rot ? '#7dff3a' : '#fff3d6';
  const droop = mood === 'worried' || rot;
  // The dented antenna, with a red bow tied at the kink.
  const antenna = droop
    ? `<path d="M63 21L65 14L73 12L79 16" ${SW} fill="none"/><circle cx="80" cy="18" r="4.2" fill="${A}" ${SW}/>`
    : `<path d="M63 21L65 14L71 12L73 8" ${SW} fill="none"/><circle cx="73" cy="7.5" r="4.2" fill="${A}" ${SW}/>`;
  const bow = `<g fill="#ff6b81" stroke="#7a2232" stroke-width="1.2" stroke-linejoin="round"><path d="M65 15L58 11.5V18.5Z"/><path d="M65 15L72 11.5V18.5Z"/><circle cx="65" cy="15" r="2.2"/></g>`;
  return `${card('wynn-' + mood, '#1d1206', rot ? '#3dff6a' : '#ffb000')}
  <defs><radialGradient id="wscr-${mood}" cx="50%" cy="45%" r="70%"><stop offset="0" stop-color="#4a2a0c"/><stop offset="1" stop-color="${SCR}"/></radialGradient></defs>
  <path d="M8 100V90Q8 84 16 84H84Q92 84 92 90V100Z" fill="#6b4515" ${SW}/>
  <rect x="44" y="78" width="12" height="9" fill="#3d270e" ${SW}/>
  ${antenna}${bow}
  <rect x="12" y="20" width="76" height="62" rx="11" fill="#7a5019" ${SW}/>
  <rect x="12" y="66" width="76" height="16" fill="#5c3c12"/><rect x="12" y="20" width="76" height="62" rx="11" fill="none" ${SW}/>
  <path d="M19 26L27 24" stroke="#a5743a" stroke-width="2.5" stroke-linecap="round"/>
  <rect x="20" y="28" width="60" height="45" rx="11" fill="url(#wscr-${mood})" ${SW}/>
  <ellipse cx="27" cy="61" rx="5" ry="3" fill="#ff7a59" opacity="${cheeks}"/><ellipse cx="73" cy="61" rx="5" ry="3" fill="#ff7a59" opacity="${cheeks}"/>
  ${eyes}
  <path d="${brows}" stroke="${A}" stroke-width="2.8" fill="none" stroke-linecap="round"/>
  <g stroke="#d9a441" stroke-width="2" fill="${lens}" fill-opacity="${rot ? 0.3 : 0.14}">
    <path d="M30 50.5H46Q46 58.5 38 58.5Q30 58.5 30 50.5Z"/><path d="M54 50.5H70Q70 58.5 62 58.5Q54 58.5 54 50.5Z"/>
    <path d="M46 51.5Q50 48.5 54 51.5M30 51.5L22 49M70 51.5L78 49" fill="none"/></g>
  ${mouth(shut, open)}
  <path d="M25 33Q28 30 34 30" stroke="#fff" stroke-width="2" opacity="0.3" fill="none" stroke-linecap="round"/>
  <circle cx="17" cy="77" r="2" fill="${INK}"/><circle cx="83" cy="77" r="2" fill="${INK}"/>
  <rect x="62" y="75" width="8" height="4" rx="1" fill="${A}" ${SW} stroke-width="1.5"/>
  ${extra}`;
}

// ── Aurelia Cache: a marble bust with glowing eyes and a laurel ──────
function aurelia(mood) {
  const rot = mood === 'rot';
  const glitch = mood === 'special';
  const eye = rot ? '#7dff3a' : '#9fc6ff';
  const leaf = rot ? '#5e7a3a' : '#9dff7a';
  // The laurel: two sprays of leaves running up the band from the temples to the brow.
  // Glitching knocks gaps into it; the Rot strips every third leaf.
  const leaves = [];
  for (let i = 0; i < 7; i++) {
    [-1, 1].forEach((s) => {
      if ((glitch && ((s === 1 && (i === 2 || i === 5)) || (s === -1 && i === 4))) || (rot && i % 3 === 1)) return;
      const a = Math.PI * (0.06 + i * 0.062);
      const x = 50 - s * 25 * Math.cos(a);
      const y = 44 - 20 * Math.sin(a);
      const deg = (Math.atan2(-20 * Math.cos(a), s * 25 * Math.sin(a)) * 180) / Math.PI;
      const off = i % 2 ? 2.4 : -2.4; // alternate leaves sit either side of the band
      const nx = x + off * Math.cos(((deg + 90) * Math.PI) / 180);
      const ny = y + off * Math.sin(((deg + 90) * Math.PI) / 180);
      leaves.push(`<ellipse cx="${nx.toFixed(1)}" cy="${ny.toFixed(1)}" rx="5.6" ry="2.6" transform="rotate(${(deg + (i % 2 ? -18 : 18) * s).toFixed(0)} ${nx.toFixed(1)} ${ny.toFixed(1)})"/>`);
    });
  }
  leaves.unshift(`<path d="M25 39Q30 23 50 24Q70 23 75 39" fill="none" stroke="${rot ? '#3e5a26' : '#4fbf3a'}" stroke-width="2"/>`);
  let eyes = `<ellipse cx="41" cy="50" rx="4.2" ry="3" fill="${eye}" filter="url(#ag)"/><ellipse cx="59" cy="50" rx="4.2" ry="3" fill="${eye}" filter="url(#ag)"/>`;
  let brows = `<path d="M35 44Q41 41 46 43M54 43Q59 41 65 44" stroke="#8e939e" stroke-width="2" fill="none" stroke-linecap="round"/>`;
  let shut = `<path d="M45 66Q50 68 55 66" stroke="#7d828d" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
  let open = `<ellipse cx="50" cy="66.5" rx="4.5" ry="3" fill="#5b5f69" ${SW} stroke-width="1.6"/>`;
  let extra = '';
  if (mood === 'pleased') {
    eyes = `<path d="M37 51Q41 46 45 51M55 51Q59 46 63 51" stroke="${eye}" stroke-width="3" fill="none" stroke-linecap="round" filter="url(#ag)"/>`;
    shut = `<path d="M43 65Q50 71 57 65" stroke="#7d828d" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
    open = `<path d="M43 64Q50 73 57 64Z" fill="#5b5f69" ${SW} stroke-width="1.6"/>`;
  } else if (mood === 'worried') {
    brows = `<path d="M35 43Q40 44 46 40M54 40Q60 44 65 43" stroke="#8e939e" stroke-width="2" fill="none" stroke-linecap="round"/>`;
    eyes = `<ellipse cx="41" cy="50" rx="3.4" ry="3.6" fill="${eye}" filter="url(#ag)"/><ellipse cx="59" cy="50" rx="3.4" ry="3.6" fill="${eye}" filter="url(#ag)"/>`;
    shut = `<path d="M45 67Q50 64 55 67" stroke="#7d828d" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
    extra = `<path d="M62 31L58 38L62 41L59 47" stroke="#6a6f7a" stroke-width="1.4" fill="none"/>`;
  } else if (glitch) {
    // Her memory skips: one eye out of sync, a chunk of face missing where a root used to be.
    eyes = `<rect x="36" y="48" width="10" height="4" fill="${eye}" filter="url(#ag)"/><ellipse cx="60" cy="49" rx="4.2" ry="3" fill="#ff5cc8" opacity="0.8"/><ellipse cx="58" cy="51" rx="4.2" ry="3" fill="${eye}" filter="url(#ag)"/>`;
    extra = `<g class="pt-glitch"><rect x="22" y="56" width="22" height="6" fill="#0e1424"/><rect x="60" y="34" width="16" height="4" fill="#0e1424"/>
      <text x="25" y="61.5" font-family="monospace" font-size="6" fill="${eye}">___port</text>
      <rect x="54" y="58" width="28" height="3" fill="#9fc6ff" opacity="0.5"/><rect x="18" y="40" width="20" height="2" fill="#ff5cc8" opacity="0.6"/></g>`;
  } else if (rot) {
    eyes = `<ellipse cx="41" cy="50" rx="4.6" ry="4" fill="${eye}" filter="url(#ag)"/><ellipse cx="59" cy="50" rx="3.4" ry="2.4" fill="${eye}" filter="url(#ag)"/>`;
    brows = `<path d="M35 42L46 45M54 45L65 42" stroke="#8e939e" stroke-width="2" fill="none" stroke-linecap="round"/>`;
    shut = `<path d="M44 67L47 65L50 67L53 65L56 67" stroke="#5f6570" stroke-width="2" fill="none"/>`;
    extra = `<path d="M30 38L36 46L33 52L38 58M66 60L70 66L67 72" stroke="#7dff3a" stroke-width="1.8" fill="none" filter="url(#ag)"/>`;
  }
  return `${card('aurelia-' + mood, '#14182a', rot ? '#3dff6a' : glitch ? '#ff5cc8' : '#9fc6ff')}
  <defs><filter id="ag" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <linearGradient id="am" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f1f2f5"/><stop offset="1" stop-color="#b9bdc6"/></linearGradient></defs>
  <path d="M10 100Q12 82 30 79L50 84L70 79Q88 82 90 100Z" fill="url(#am)" ${SW}/>
  <path d="M30 80Q40 92 34 100M70 80Q62 90 68 100M44 86Q50 94 56 86" stroke="#9aa0ab" stroke-width="2" fill="none"/>
  <path d="M42 70V82Q50 86 58 82V70Z" fill="#c9ccd3" ${SW}/>
  <path d="M28 46Q28 22 50 22Q72 22 72 46Q72 66 50 75Q28 66 28 46Z" fill="url(#am)" ${SW}/>
  <g fill="#d9dce2" ${SW} stroke-width="2"><circle cx="34" cy="31" r="5"/><circle cx="42" cy="25" r="5.4"/><circle cx="50" cy="23" r="5.4"/><circle cx="58" cy="25" r="5.4"/><circle cx="66" cy="31" r="5"/></g>
  <path d="M50 48L47 59Q50 61 53 59" stroke="#8e939e" stroke-width="2" fill="none" stroke-linecap="round"/>
  ${brows}${eyes}${mouth(shut, open)}${extra}
  <g class="pt-laurel" fill="${leaf}" ${SW} stroke-width="1.6" ${rot ? '' : 'filter="url(#ag)"'}>${leaves.join('')}</g>`;
}

// ── Theo Parsec: a navy round-helmet operator with a dish antenna ────
function theo(mood) {
  const rot = mood === 'rot';
  const skin = '#b5794f';
  let eyes = `<ellipse cx="41" cy="54" rx="4" ry="5" fill="${INK}"/><ellipse cx="59" cy="54" rx="4" ry="5" fill="${INK}"/><circle cx="42.4" cy="52.4" r="1.4" fill="#fff"/><circle cx="60.4" cy="52.4" r="1.4" fill="#fff"/>`;
  let brows = `<path d="M35 45Q41 42 46 45M54 45Q59 42 65 45" stroke="#2a1608" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
  let shut = `<path d="M44 66Q50 70 56 66" stroke="${INK}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
  let open = `<path d="M43 65Q50 74 57 65Z" fill="#5a1d1d" ${SW} stroke-width="2"/>`;
  let extra = '';
  let visor = `${star(70, 36, 3, '#fff', 'opacity="0.8"')}${sparkle(30, 66, 2.5, '#cfe6ff')}<circle cx="64" cy="70" r="1" fill="#fff" opacity="0.7"/>`;
  if (mood === 'pleased') {
    eyes = `<path d="M37 55Q41 49 45 55M55 55Q59 49 63 55" stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
    shut = `<path d="M41 64Q50 74 59 64Z" fill="#fff" ${SW} stroke-width="2"/>`;
    open = `<path d="M41 63Q50 78 59 63Z" fill="#5a1d1d" ${SW} stroke-width="2"/><path d="M43 64H57" stroke="#fff" stroke-width="2.4"/>`;
  } else if (mood === 'worried') {
    brows = `<path d="M35 46Q41 44 46 41M54 41Q59 44 65 46" stroke="#2a1608" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
    eyes = `<ellipse cx="41" cy="54" rx="4.6" ry="5.6" fill="#fff" ${SW} stroke-width="1.8"/><ellipse cx="59" cy="54" rx="4.6" ry="5.6" fill="#fff" ${SW} stroke-width="1.8"/><circle cx="41" cy="55" r="2" fill="${INK}"/><circle cx="59" cy="55" r="2" fill="${INK}"/>`;
    shut = `<path d="M43 68Q46 65 50 68T57 67" stroke="${INK}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
    open = `<ellipse cx="50" cy="67" rx="4.5" ry="4" fill="#5a1d1d" ${SW} stroke-width="2"/>`;
    extra = `<path d="M68 46Q71 51 68 54Q65 51 68 46Z" fill="#8fd3ff" ${SW} stroke-width="1.4"/>
      <g transform="translate(22 31)"><circle r="6" fill="#ffd23f" ${SW} stroke-width="1.6"/><circle cx="3" r="5.6" fill="#0b1a3a"/></g>`;
  } else if (mood === 'special') {
    // Starstruck: star eyes, a huge open grin, and the visor full of stars.
    eyes = `${star(41, 54, 7, '#ffd23f', `${SW} stroke-width="1.6"`)}${star(59, 54, 7, '#ffd23f', `${SW} stroke-width="1.6"`)}`;
    shut = `<path d="M41 64Q50 76 59 64Z" fill="#5a1d1d" ${SW} stroke-width="2"/><path d="M44 66Q50 71 56 66" stroke="#e86a6a" stroke-width="2.4" fill="none"/>`;
    open = `<path d="M40 63Q50 80 60 63Z" fill="#5a1d1d" ${SW} stroke-width="2"/><path d="M44 69Q50 74 56 69" stroke="#e86a6a" stroke-width="2.6" fill="none"/>`;
    visor = `${star(70, 34, 4, '#fff')}${star(28, 40, 2.6, '#ffd23f')}${sparkle(72, 64, 3.5, '#fff')}${sparkle(29, 66, 3, '#cfe6ff')}${star(36, 30, 2, '#fff')}<circle cx="64" cy="73" r="1.2" fill="#fff"/>`;
  } else if (rot) {
    eyes = `<ellipse cx="41" cy="54" rx="4.6" ry="5.6" fill="#7dff3a"/><ellipse cx="59" cy="54" rx="4.6" ry="5.6" fill="#7dff3a"/><circle cx="41" cy="55" r="1.8" fill="${INK}"/><circle cx="59" cy="55" r="1.8" fill="${INK}"/>`;
    brows = `<path d="M35 44L46 47M54 47L65 44" stroke="#2a1608" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
    shut = `<path d="M42 67H58" stroke="${INK}" stroke-width="2.4"/><path d="M45 64V70M50 64V70M55 64V70" stroke="${INK}" stroke-width="1.4"/><rect x="42" y="64" width="16" height="6" rx="2" fill="none" ${SW} stroke-width="2"/>`;
    open = `<rect x="42" y="63" width="16" height="9" rx="2" fill="#fff" ${SW} stroke-width="2"/><path d="M42 67.5H58M46 63V72M50 63V72M54 63V72" stroke="${INK}" stroke-width="1.2"/>`;
    visor = `<path d="M68 30L62 42L70 47L64 58" stroke="#7dff3a" stroke-width="2" fill="none"/><path d="M62 42L54 40" stroke="#7dff3a" stroke-width="1.4"/>`;
  }
  return `${card('theo-' + mood, '#0a1230', rot ? '#3dff6a' : '#38b6ff')}
  <defs><radialGradient id="tv-${mood}" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="#5aa6ff" stop-opacity="0.35"/><stop offset="1" stop-color="#0b1a3a" stop-opacity="0.18"/></radialGradient></defs>
  <path d="M10 100Q12 84 30 82H70Q88 84 90 100Z" fill="#22407e" ${SW}/>
  <path d="M40 82L50 92L60 82" fill="#ffd23f" ${SW} stroke-width="2"/>
  <rect x="24" y="86" width="10" height="7" rx="2" fill="#38b6ff" ${SW} stroke-width="1.8"/>
  <g class="pt-dish"><path d="M76 24L86 12" ${SW}/><path d="M74 4Q96 4 96 20Q86 22 74 4Z" fill="#dfe8ff" ${SW}/><circle cx="85" cy="12" r="2" fill="#38b6ff" ${SW} stroke-width="1.4"/></g>
  <circle cx="50" cy="52" r="35" fill="#22407e" ${SW}/>
  <path d="M22 66Q20 50 26 40" stroke="#3b5ea8" stroke-width="3" fill="none" stroke-linecap="round"/>
  <rect x="11" y="46" width="8" height="16" rx="3" fill="#14244e" ${SW} stroke-width="2"/><rect x="81" y="46" width="8" height="16" rx="3" fill="#14244e" ${SW} stroke-width="2"/>
  <ellipse cx="50" cy="55" rx="27" ry="25" fill="${skin}" ${SW}/>
  <path d="M25 46Q30 30 50 30Q70 30 75 46Q66 38 56 40Q60 34 52 36Q44 32 38 40Q30 38 25 46Z" fill="#2a1608"/>
  ${brows}${eyes}${mouth(shut, open)}
  <ellipse cx="50" cy="55" rx="27" ry="25" fill="url(#tv-${mood})"/>
  <path d="M30 40Q36 32 46 31" stroke="#fff" stroke-width="3" opacity="0.55" fill="none" stroke-linecap="round"/>
  <g class="pt-stars">${visor}</g>${extra}
  <ellipse cx="50" cy="55" rx="27" ry="25" fill="none" stroke="#8fb4ff" stroke-width="2"/>`;
}

// ── Mr. Phil: a real teacher. Curly hair, full beard, dark green glasses ─
function phil(mood) {
  const rot = mood === 'rot';
  const skin = '#e2b48f';
  const hair = '#a47a4f';
  const hairD = '#7d5a37';
  const frames = '#1f5a2e';
  const lens = rot ? '#7dff3a' : '#cfe8ff';
  let eyes = `<circle cx="40" cy="47" r="2.6" fill="${INK}"/><circle cx="60" cy="47" r="2.6" fill="${INK}"/>`;
  let brows = `<path d="M33 38Q40 35 46 38M54 38Q60 35 67 38" stroke="${hairD}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
  let shut = `<path d="M43 63Q50 68 57 63" stroke="#5a2a20" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
  let open = `<path d="M43 62Q50 72 57 62Z" fill="#5a2a20" ${SW} stroke-width="1.8"/>`;
  let extra = '';
  if (mood === 'pleased') {
    eyes = `<path d="M36 48Q40 43 44 48M56 48Q60 43 64 48" stroke="${INK}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
    shut = `<path d="M41 61Q50 71 59 61Z" fill="#fff" ${SW} stroke-width="1.8"/>`;
    open = `<path d="M41 60Q50 75 59 60Z" fill="#5a2a20" ${SW} stroke-width="1.8"/><path d="M43 61H57" stroke="#fff" stroke-width="2.4"/>`;
  } else if (mood === 'worried') {
    brows = `<path d="M33 39Q40 38 46 34M54 34Q60 38 67 39" stroke="${hairD}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
    eyes = `<circle cx="40" cy="47" r="3" fill="${INK}"/><circle cx="60" cy="47" r="3" fill="${INK}"/>`;
    shut = `<path d="M43 65Q46 62 50 65T57 64" stroke="#5a2a20" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
    open = `<ellipse cx="50" cy="64" rx="4.5" ry="3.6" fill="#5a2a20" ${SW} stroke-width="1.8"/>`;
    extra = `<path d="M74 40Q77 45 74 48Q71 45 74 40Z" fill="#8fd3ff" ${SW} stroke-width="1.4"/>`;
  } else if (mood === 'special') {
    // The d20 grin: a wink, a big toothy grin, and a natural 20 held up.
    eyes = `<circle cx="40" cy="47" r="2.8" fill="${INK}"/><path d="M56 48Q60 44 64 48" stroke="${INK}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
    brows = `<path d="M33 37Q40 33 46 37M54 39Q60 37 67 38" stroke="${hairD}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
    shut = `<path d="M40 60Q50 73 60 60Z" fill="#fff" ${SW} stroke-width="1.8"/><path d="M45 61V65M50 61V67M55 61V65" stroke="#c9c2b8" stroke-width="1"/>`;
    open = `<path d="M40 59Q50 77 60 59Z" fill="#5a2a20" ${SW} stroke-width="1.8"/><path d="M42 60H58" stroke="#fff" stroke-width="3"/>`;
    extra = `<g class="pt-d20" transform="translate(81 74) rotate(-12)">
      <path d="M0 -15L13 -7.5V7.5L0 15L-13 7.5V-7.5Z" fill="#18a83a" ${SW} stroke-width="2"/>
      <path d="M0 -15L-8 4H8Z M-13 -7.5L-8 4M13 -7.5L8 4M-8 4L0 15L8 4M-13 7.5L-8 4M13 7.5L8 4" stroke="#e8ffe8" stroke-width="1.1" fill="none"/>
      <text x="0" y="2.4" text-anchor="middle" font-family="Lexend,sans-serif" font-weight="800" font-size="7" fill="#fff">20</text></g>
      <path d="M71 86Q74 80 79 82" stroke="${INK}" stroke-width="2" fill="none"/>
      ${sparkle(92, 56, 4, '#ffd23f')}${sparkle(68, 58, 2.6, '#fff')}`;
  } else if (rot) {
    brows = `<path d="M33 36L46 40M54 40L67 36" stroke="${hairD}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
    eyes = `<circle cx="40" cy="47" r="2" fill="${INK}"/><circle cx="60" cy="47" r="2" fill="${INK}"/>`;
    shut = `<rect x="42" y="61" width="16" height="6" rx="2" fill="#fff" ${SW} stroke-width="1.8"/><path d="M42 64H58M46 61V67M50 61V67M54 61V67" stroke="#aaa" stroke-width="0.9"/>`;
    open = `<rect x="42" y="60" width="16" height="9" rx="2" fill="#5a2a20" ${SW} stroke-width="1.8"/><path d="M42 61.5H58M42 67.5H58" stroke="#fff" stroke-width="2"/>`;
    extra = `<path d="M80 22l3 6-4 2 4 5" stroke="#7dff3a" stroke-width="2" fill="none"/>`;
  }
  // The curly hair: a cloud of circles around the top of the head.
  const curls = [[24, 40, 8], [26, 30, 9], [33, 21, 9], [43, 16, 9], [54, 15, 9], [64, 18, 9], [72, 26, 9], [76, 36, 8], [38, 13, 6], [60, 10, 6], [50, 9, 5]];
  return `${card('phil-' + mood, '#0f1d33', rot ? '#3dff6a' : '#6f9fd8')}
  <path d="M8 100Q10 84 30 81H70Q90 84 92 100Z" fill="#6f9fd8" ${SW}/>
  <path d="M50 84V100" stroke="#5a86bd" stroke-width="3"/><circle cx="50" cy="92" r="1.4" fill="#fff"/>
  <path d="M36 80L46 90L50 82L54 90L64 80" fill="#6f9fd8" ${SW} stroke-width="2"/>
  <g fill="${hair}" ${SW} stroke-width="2">${curls.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('')}</g>
  <ellipse cx="25" cy="49" rx="5" ry="7" fill="${skin}" ${SW} stroke-width="2"/><ellipse cx="75" cy="49" rx="5" ry="7" fill="${skin}" ${SW} stroke-width="2"/>
  <path d="M27 44Q27 22 50 22Q73 22 73 44V54Q73 70 50 74Q27 70 27 54Z" fill="${skin}" ${SW}/>
  <g fill="${hair}"><circle cx="33" cy="27" r="7"/><circle cx="44" cy="23" r="7"/><circle cx="56" cy="23" r="7"/><circle cx="67" cy="27" r="7"/></g>
  <path d="M27 52Q26 82 50 84Q74 82 73 52Q70 60 64 58Q56 54 50 56Q44 54 36 58Q30 60 27 52Z" fill="${hair}" ${SW}/>
  <path d="M33 66Q36 72 40 70M60 70Q64 72 67 66M44 76Q50 79 56 76" stroke="${hairD}" stroke-width="1.6" fill="none" stroke-linecap="round"/>
  <path d="M41 58Q50 53 59 58Q55 61 50 59Q45 61 41 58Z" fill="${hairD}" ${SW} stroke-width="1.6"/>
  ${mouth(shut, open)}
  <path d="M50 46Q47 54 50 56" stroke="#b8865f" stroke-width="2" fill="none" stroke-linecap="round"/>
  ${brows}
  <g ${SW} stroke="${frames}" stroke-width="3"><rect x="31" y="40" width="17" height="14" rx="5" fill="${lens}" fill-opacity="0.35"/><rect x="52" y="40" width="17" height="14" rx="5" fill="${lens}" fill-opacity="0.35"/><path d="M48 46H52M31 45L27 44M69 45L73 44" fill="none"/></g>
  ${eyes}
  <path d="M34 43L38 42" stroke="#fff" stroke-width="1.6" opacity="0.8" stroke-linecap="round"/><path d="M55 43L59 42" stroke="#fff" stroke-width="1.6" opacity="0.8" stroke-linecap="round"/>
  ${extra}`;
}

// ── LEXINET: the network's cyan diamond eye ──────────────────────────
function system(mood) {
  const rot = mood === 'rot';
  const alert = mood === 'special';
  const C = rot ? '#7dff3a' : alert ? '#ffb000' : '#00e5ff';
  let eye = `<path d="M30 46Q50 30 70 46Q50 62 30 46Z" fill="#031a22" ${SW} stroke="${C}" stroke-width="2.6"/><circle cx="50" cy="46" r="8" fill="${C}"/><circle cx="50" cy="46" r="3.6" fill="${INK}"/><circle cx="53" cy="43" r="1.6" fill="#fff"/>`;
  let extra = '';
  if (mood === 'pleased') {
    eye = `<path d="M32 50Q50 32 68 50" stroke="${C}" stroke-width="4" fill="none" stroke-linecap="round"/>${sparkle(66, 34, 4, '#fff')}`;
  } else if (mood === 'worried') {
    eye = `<path d="M30 46Q50 26 70 46Q50 66 30 46Z" fill="#031a22" ${SW} stroke="${C}" stroke-width="2.6"/><circle cx="50" cy="46" r="3" fill="${C}"/>`;
    extra = `<path d="M34 30L44 34M66 30L56 34" stroke="${C}" stroke-width="2.6" stroke-linecap="round"/>`;
  } else if (alert) {
    eye = `<path d="M30 46Q50 30 70 46Q50 62 30 46Z" fill="#221303" ${SW} stroke="${C}" stroke-width="2.6"/><ellipse cx="50" cy="46" rx="3" ry="9" fill="${C}"/>`;
    extra = `<g class="pt-pulse" fill="none" stroke="${C}" stroke-width="2"><path d="M50 4L96 50L50 96L4 50Z" opacity="0.45"/></g>
      <text x="14" y="22" font-family="Lexend,sans-serif" font-weight="800" font-size="16" fill="${C}">!</text><text x="80" y="22" font-family="Lexend,sans-serif" font-weight="800" font-size="16" fill="${C}">!</text>`;
  } else if (rot) {
    eye = `<path d="M30 46Q50 30 70 46Q50 62 30 46Z" fill="#071a05" ${SW} stroke="${C}" stroke-width="2.6"/><rect x="44" y="40" width="12" height="12" fill="${C}"/><rect x="47" y="43" width="6" height="6" fill="${INK}"/>
      <rect x="22" y="36" width="20" height="3" fill="${C}" opacity="0.6"/><rect x="60" y="52" width="24" height="3" fill="${C}" opacity="0.6"/>`;
  }
  // No mouth: LEXINET speaks through a waveform bar under the eye.
  const shut = `<path d="M38 70H62" stroke="${C}" stroke-width="2.4" stroke-linecap="round"/>`;
  const open = `<path d="M36 70L40 70L42 64L45 76L48 62L51 78L54 64L57 74L60 70H64" stroke="${C}" stroke-width="2.4" fill="none" stroke-linejoin="round" stroke-linecap="round"/>`;
  return `${card('system-' + mood, '#03121a', C)}
  <defs><filter id="sg" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
  <g stroke="${C}" stroke-width="1.4" opacity="0.5" fill="none"><path d="M4 50H14M86 50H96M50 4V12M50 88V96M14 20L24 30M86 20L76 30M14 80L24 70M86 80L76 70"/></g>
  <g fill="${C}" opacity="0.7"><circle cx="4" cy="50" r="1.6"/><circle cx="96" cy="50" r="1.6"/><circle cx="14" cy="20" r="1.6"/><circle cx="86" cy="20" r="1.6"/><circle cx="14" cy="80" r="1.6"/><circle cx="86" cy="80" r="1.6"/></g>
  <path d="M50 12L88 50L50 88L12 50Z" fill="#06222c" ${SW} stroke-width="3.4"/>
  <path d="M50 12L88 50L50 88L12 50Z" fill="none" stroke="${C}" stroke-width="2.4" filter="url(#sg)"/>
  <path d="M50 20L80 50L50 80L20 50Z" fill="none" stroke="${C}" stroke-width="1" opacity="0.5"/>
  <g filter="url(#sg)">${eye}${mouth(shut, open)}</g>${extra}`;
}

// ── THE ROT: a dripping green glitch face ────────────────────────────
function rot(mood) {
  const G = '#7dff3a';
  const P = '#2b0f3d';
  let eyes = `<path d="M30 44L44 48L30 52Z" fill="${G}"/><ellipse cx="63" cy="47" rx="7" ry="5" fill="${G}"/><circle cx="64" cy="47" r="2" fill="${INK}"/>`;
  let shut = `<path d="M32 64Q50 72 70 60" stroke="${G}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
  let open = `<path d="M32 62Q50 82 70 58Q52 66 32 62Z" fill="#0b0312" stroke="${G}" stroke-width="2.4"/><path d="M40 66l2 4 2-3M52 67l2 4 2-4M61 64l2 3" stroke="${G}" stroke-width="1.6" fill="none"/>`;
  let extra = '';
  if (mood === 'pleased') {
    eyes = `<path d="M28 48Q36 42 44 48M56 48Q64 42 72 48" stroke="${G}" stroke-width="4" fill="none" stroke-linecap="round"/>`;
    shut = `<path d="M28 58Q50 80 72 58Q50 66 28 58Z" fill="#0b0312" stroke="${G}" stroke-width="2.4"/><path d="M34 61l3 5 3-4 3 5 3-4 3 5 3-4 3 5 3-4 3 5 3-5" stroke="${G}" stroke-width="1.6" fill="none"/>`;
    open = `<path d="M28 56Q50 86 72 56Q50 64 28 56Z" fill="#0b0312" stroke="${G}" stroke-width="2.4"/><path d="M34 59l3 6 3-5 3 6 3-5 3 6 3-5 3 6 3-5 3 6 3-6" stroke="${G}" stroke-width="1.6" fill="none"/>`;
  } else if (mood === 'worried') {
    eyes = `<circle cx="37" cy="47" r="7" fill="${G}"/><circle cx="37" cy="48" r="2" fill="${INK}"/><circle cx="63" cy="47" r="7" fill="${G}"/><circle cx="63" cy="48" r="2" fill="${INK}"/>`;
    shut = `<path d="M36 66Q40 62 44 66T52 66T60 66T66 64" stroke="${G}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
    open = `<ellipse cx="50" cy="66" rx="7" ry="5" fill="#0b0312" stroke="${G}" stroke-width="2.4"/>`;
    extra = `<path d="M26 36L42 40M74 36L58 40" stroke="${G}" stroke-width="2.4" stroke-linecap="round"/>`;
  } else if (mood === 'special') {
    // Sneering: one brow cocked, a lopsided snarl with a fang.
    eyes = `<path d="M28 48H44" stroke="${G}" stroke-width="4" stroke-linecap="round"/><ellipse cx="63" cy="46" rx="7" ry="6" fill="${G}"/><circle cx="64" cy="46" r="2.2" fill="${INK}"/>`;
    extra = `<path d="M26 44L44 42M56 34L72 38" stroke="${G}" stroke-width="3" stroke-linecap="round"/>`;
    shut = `<path d="M34 66Q48 66 68 56" stroke="${G}" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M58 61L60 67L63 59" fill="#e8ffe0" stroke="${G}" stroke-width="1.2"/>`;
    open = `<path d="M34 64Q50 74 68 54Q50 62 34 64Z" fill="#0b0312" stroke="${G}" stroke-width="2.4"/><path d="M58 60L60 67L63 58" fill="#e8ffe0" stroke="${G}" stroke-width="1.2"/>`;
  } else if (mood === 'rot') {
    extra = `<g class="pt-glitch"><rect x="14" y="40" width="72" height="5" fill="${P}"/><rect x="20" y="41" width="26" height="3" fill="${G}" opacity="0.7"/><rect x="18" y="58" width="64" height="3" fill="#ff2a6d" opacity="0.5"/><rect x="56" y="28" width="22" height="3" fill="${G}" opacity="0.6"/></g>`;
  }
  const drips = mood === 'rot' || mood === 'worried'
    ? 'M22 70Q20 84 24 92Q28 84 26 74M44 78Q42 92 46 98Q50 92 48 80M66 76Q64 86 68 92Q72 86 70 74M78 66Q78 76 81 80Q84 76 82 64'
    : 'M24 72Q22 82 26 88Q30 82 28 76M48 80Q46 90 50 94Q54 90 52 80M70 74Q68 82 72 86Q76 82 74 72';
  return `${card('rot-' + mood, '#0b0312', '#4a1a6a')}
  <defs><filter id="rg" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
  <path d="${drips}" fill="${P}" stroke="${G}" stroke-width="2.2"/>
  <path d="M50 12Q78 12 84 38Q90 60 76 74Q64 84 50 80Q34 86 22 74Q10 60 16 38Q22 12 50 12Z" fill="${P}" ${SW} stroke-width="3.4"/>
  <path d="M50 12Q78 12 84 38Q90 60 76 74Q64 84 50 80Q34 86 22 74Q10 60 16 38Q22 12 50 12Z" fill="none" stroke="${G}" stroke-width="2.2" filter="url(#rg)"/>
  <path d="M30 26Q40 18 52 20" stroke="#6a2f8f" stroke-width="3" fill="none" stroke-linecap="round"/>
  <g fill="${G}" opacity="0.8"><rect x="74" y="24" width="6" height="6"/><rect x="18" y="30" width="4" height="4"/><rect x="80" y="44" width="4" height="4"/></g>
  <g filter="url(#rg)">${eyes}${mouth(shut, open)}${extra}</g>`;
}

// ── Noam Chomsky, the Hub mentor: a professor-gnome in a red pointed hat ─────────────
function noam(mood) {
  const rot = mood === 'rot';
  const skin = '#efc6a2';
  const grey = '#d3d6dc';
  const greyD = '#9aa0aa';
  const hat = '#c8262f';
  let eyes = `<circle cx="40" cy="52" r="2.6" fill="${INK}"/><circle cx="60" cy="52" r="2.6" fill="${INK}"/>`;
  let brows = `<path d="M33 43Q40 40 46 43M54 43Q60 40 67 43" stroke="${greyD}" stroke-width="3.4" fill="none" stroke-linecap="round"/>`;
  let shut = `<path d="M43 71Q50 75 57 71" stroke="#6a3324" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
  let open = `<path d="M43 70Q50 79 57 70Z" fill="#6a3324" ${SW} stroke-width="1.6"/>`;
  let extra = '';
  let tip = `<path d="M58 6Q80 4 86 18Q78 14 70 16Z" fill="${hat}" ${SW} stroke-width="2"/>`;
  if (mood === 'pleased') {
    eyes = `<path d="M36 53Q40 48 44 53M56 53Q60 48 64 53" stroke="${INK}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
    shut = `<path d="M41 69Q50 79 59 69Z" fill="#fff" ${SW} stroke-width="1.6"/>`;
    open = `<path d="M41 68Q50 82 59 68Z" fill="#6a3324" ${SW} stroke-width="1.6"/><path d="M43 69H57" stroke="#fff" stroke-width="2.2"/>`;
    extra = `<circle cx="31" cy="64" r="4" fill="#ff8a7a" opacity="0.45"/><circle cx="69" cy="64" r="4" fill="#ff8a7a" opacity="0.45"/>`;
  } else if (mood === 'worried') {
    brows = `<path d="M33 45Q40 44 46 39M54 39Q60 44 67 45" stroke="${greyD}" stroke-width="3.4" fill="none" stroke-linecap="round"/>`;
    eyes = `<circle cx="40" cy="52" r="3.2" fill="${INK}"/><circle cx="60" cy="52" r="3.2" fill="${INK}"/>`;
    shut = `<path d="M43 73Q46 70 50 73T57 72" stroke="#6a3324" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
    open = `<ellipse cx="50" cy="72" rx="4.5" ry="3.6" fill="#6a3324" ${SW} stroke-width="1.6"/>`;
    extra = `<path d="M76 46Q79 51 76 54Q73 51 76 46Z" fill="#8fd3ff" ${SW} stroke-width="1.4"/>`;
    tip = `<path d="M58 6Q72 10 74 26Q68 18 62 16Z" fill="${hat}" ${SW} stroke-width="2"/>`;
  } else if (mood === 'special') {
    // Making a point: one brow up, a finger raised.
    brows = `<path d="M33 41Q40 36 46 40M54 43Q60 42 67 43" stroke="${greyD}" stroke-width="3.4" fill="none" stroke-linecap="round"/>`;
    shut = `<path d="M44 71Q50 73 57 70" stroke="#6a3324" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
    extra = `<path d="M84 98V74Q84 70 87 70Q90 70 90 74V98Z" fill="${skin}" ${SW} stroke-width="1.8"/>${sparkle(92, 62, 4, '#ffd23f')}`;
  } else if (rot) {
    brows = `<path d="M33 41L46 45M54 45L67 41" stroke="${greyD}" stroke-width="3.4" fill="none" stroke-linecap="round"/>`;
    eyes = `<circle cx="40" cy="52" r="2" fill="${INK}"/><circle cx="60" cy="52" r="2" fill="${INK}"/>`;
    extra = `<path d="M80 30l3 6-4 2 4 5" stroke="#7dff3a" stroke-width="2" fill="none"/>`;
  }
  return `${card('noam-' + mood, '#1d1020', rot ? '#3dff6a' : '#d0606a')}
  <path d="M10 100Q12 86 30 84H70Q88 86 90 100Z" fill="#7b2d3a" ${SW}/>
  <path d="M42 84L50 100L58 84Z" fill="#f4f1ea" ${SW} stroke-width="1.6"/><path d="M48 86H52L53 100H47Z" fill="#1f3a6e" ${SW} stroke-width="1.4"/>
  <circle cx="60" cy="93" r="1.6" fill="#d9a441"/>
  <ellipse cx="24" cy="56" rx="5" ry="7" fill="${skin}" ${SW} stroke-width="2"/><ellipse cx="76" cy="56" rx="5" ry="7" fill="${skin}" ${SW} stroke-width="2"/>
  <path d="M26 50Q26 30 50 30Q74 30 74 50V60Q74 80 50 82Q26 80 26 60Z" fill="${skin}" ${SW}/>
  <g fill="${grey}" ${SW} stroke-width="1.8"><circle cx="25" cy="44" r="7"/><circle cx="23" cy="53" r="6"/><circle cx="75" cy="44" r="7"/><circle cx="77" cy="53" r="6"/></g>
  <path d="M18 36Q50 28 82 36L80 42Q50 35 20 42Z" fill="#a81e26" ${SW}/>
  <path d="M22 37Q34 6 58 6Q70 16 78 36Z" fill="${hat}" ${SW}/>${tip}
  ${extra}
  <ellipse cx="50" cy="62" rx="6.5" ry="6" fill="#e0a084" ${SW} stroke-width="1.8"/>
  ${mouth(shut, open)}
  ${brows}
  <g ${SW} stroke="#2a2a2a" stroke-width="2.6"><circle cx="40" cy="52" r="8" fill="#cfe8ff" fill-opacity="0.3"/><circle cx="60" cy="52" r="8" fill="#cfe8ff" fill-opacity="0.3"/><path d="M48 52H52M32 51L26 49M68 51L74 49" fill="none"/></g>
  ${eyes}
  <path d="M35 48L38 47" stroke="#fff" stroke-width="1.6" opacity="0.8" stroke-linecap="round"/><path d="M55 48L58 47" stroke="#fff" stroke-width="1.6" opacity="0.8" stroke-linecap="round"/>`;
}

const DRAW = { wynn, aurelia, theo, phil, system, rot, noam };

/** The SVG for one speaker in one mood, as markup. Unknown speakers draw as LEXINET, unknown moods as neutral. */
export function portraitSVG(speaker, mood = 'neutral') {
  const draw = DRAW[speaker] || DRAW.system;
  const m = MOOD_SET.has(mood) ? mood : 'neutral';
  return `<svg class="portrait pt-${speaker in DRAW ? speaker : 'system'} pm-${m}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">${draw(m)}</svg>`;
}

/** Draw a speaker into the portrait element. Redraws only on a change, and pops when it does. */
export function setPortrait(el, speaker, mood = 'neutral') {
  const key = `${speaker}:${MOOD_SET.has(mood) ? mood : 'neutral'}`;
  if (el.dataset.portrait === key) return;
  el.dataset.portrait = key;
  el.innerHTML = portraitSVG(speaker, mood);
  el.classList.remove('pop');
  if (settings.reducedMotion) return;
  void el.offsetWidth; // restart the pop animation
  el.classList.add('pop');
}

/** Lip-flap on or off. */
export function setTalking(el, on) {
  el.classList.toggle('talking', !!on && !settings.reducedMotion);
}
