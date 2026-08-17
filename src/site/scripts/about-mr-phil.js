/**
 * Live stats for About Mr. Phil — age (to the second), DaVinci tenure, school-day tally.
 * Birth: Jan 11, 1988, 11:00 PM Eastern (Freehold, NJ).
 * DaVinci: joined 2023–24; 2026–27 is year 3. First day of school 2026–27: Aug 18, 2026.
 */

const TZ = 'America/New_York';

/** @type {{ start: string; label: string; number: number }[]} */
const DAVINCI_SCHOOL_YEARS = [
  { start: '2024-08-19', label: '2024–25', number: 1 },
  { start: '2025-08-18', label: '2025–26', number: 2 },
  { start: '2026-08-18', label: '2026–27', number: 3 },
];

const FIRST_DAY_2026_27 = '2026-08-18';

const BIRTH = { year: 1988, month: 1, day: 11, hour: 23, minute: 0, second: 0 };

function etParts(date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  }).formatToParts(date);
  const pick = (type) => Number(parts.find((p) => p.type === type).value);
  let hour = pick('hour');
  if (hour === 24) hour = 0;
  return {
    year: pick('year'),
    month: pick('month'),
    day: pick('day'),
    hour,
    minute: pick('minute'),
    second: pick('second'),
  };
}

/** Calendar diff between two Eastern-local clock readings. */
function diffClock(from, to) {
  let years = to.year - from.year;
  let months = to.month - from.month;
  let days = to.day - from.day;
  let hours = to.hour - from.hour;
  let minutes = to.minute - from.minute;
  let seconds = to.second - from.second;

  if (seconds < 0) {
    seconds += 60;
    minutes -= 1;
  }
  if (minutes < 0) {
    minutes += 60;
    hours -= 1;
  }
  if (hours < 0) {
    hours += 24;
    days -= 1;
  }
  if (days < 0) {
    const borrow = new Date(to.year, to.month - 1, 0).getDate();
    days += borrow;
    months -= 1;
  }
  if (months < 0) {
    months += 12;
    years -= 1;
  }

  return { years, months, days, hours, minutes, seconds };
}

function parseLocalDay(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function getDaVinciYear(now) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let current = null;
  for (const entry of DAVINCI_SCHOOL_YEARS) {
    const start = parseLocalDay(entry.start);
    if (today >= start) current = entry;
  }
  if (current) return current;
  return { number: 0, label: '2023–24', joining: true };
}

function countSchoolDays(startIso, now) {
  const start = parseLocalDay(startIso);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (today < start) {
    const msPerDay = 86400000;
    const until = Math.ceil((start - today) / msPerDay);
    return { days: 0, until, before: true };
  }

  let days = 0;
  const cursor = new Date(start);
  while (cursor <= today) {
    const dow = cursor.getDay();
    if (dow !== 0 && dow !== 6) days += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return { days, before: false };
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function render() {
  const now = new Date();
  const age = diffClock(BIRTH, etParts(now));
  const davinci = getDaVinciYear(now);
  const school = countSchoolDays(FIRST_DAY_2026_27, now);

  const ageEl = document.getElementById('stat-age');
  const davinciEl = document.getElementById('stat-davinci');
  const schoolEl = document.getElementById('stat-school');

  if (ageEl) {
    ageEl.textContent =
      `${age.years}y ${age.months}mo ${age.days}d ` +
      `${pad2(age.hours)}:${pad2(age.minutes)}:${pad2(age.seconds)}`;
  }

  if (davinciEl) {
    if (davinci.joining) {
      davinciEl.textContent = 'Joined 2023–24 · Year 1 starts soon';
    } else {
      davinciEl.textContent =
        `Year ${davinci.number} at DaVinci · ${davinci.label} school year`;
    }
  }

  if (schoolEl) {
    if (school.before) {
      schoolEl.textContent =
        `School starts Aug 18, 2026 · ${school.until} day${school.until === 1 ? '' : 's'} to go`;
    } else {
      schoolEl.textContent =
        `Day ${school.days} of school · since Aug 18, 2026 (weekdays)`;
    }
  }
}

function init() {
  render();
  window.setInterval(render, 1000);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
