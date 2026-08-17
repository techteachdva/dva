/**
 * Live stats for About Mr. Phil — age, DaVinci tenure, school-day tally, summer countdown.
 *
 * School calendar: Board-Approved Public DVA 26-27 School Calendar (Feb 2026)
 * https://davincicharterschool.hubbli.com/wp-content/uploads/sites/636/2026/02/Board-Approved-Public-DVA-26-27-School-Calendar.pdf
 *
 * Grades 1–8: first day Aug 18, 2026 · last day Jun 10, 2027 · 170 student days.
 */

const TZ = 'America/New_York';
const CALENDAR_URL =
  'https://davincicharterschool.hubbli.com/wp-content/uploads/sites/636/2026/02/Board-Approved-Public-DVA-26-27-School-Calendar.pdf';

/** @type {{ start: string; label: string; number: number }[]} */
const DAVINCI_SCHOOL_YEARS = [
  { start: '2024-08-19', label: '2024–25', number: 1 },
  { start: '2025-08-19', label: '2025–26', number: 2 },
  { start: '2026-08-18', label: '2026–27', number: 3 },
];

const SCHOOL_YEAR = {
  label: '2026–27',
  firstDay: '2026-08-18',
  lastDay: '2027-06-10',
  totalStudentDays: 170,
  /** Approx. end of last school day (9:00 AM start + 6.25 hr day per calendar). */
  lastDayEndHour: 15,
  lastDayEndMinute: 15,
};

/** Student no-school dates, grades 1–8, from the official 2026–27 calendar. */
const NO_SCHOOL_2627 = new Set([
  '2026-09-07',
  '2026-09-08',
  '2026-10-12',
  '2026-10-13',
  '2026-10-14',
  '2026-10-15',
  '2026-10-16',
  '2026-10-19',
  '2026-11-23',
  '2026-11-24',
  '2026-11-25',
  '2026-11-26',
  '2026-11-27',
  '2026-11-30',
  '2026-12-21',
  '2026-12-22',
  '2026-12-23',
  '2026-12-24',
  '2026-12-25',
  '2026-12-26',
  '2026-12-27',
  '2026-12-28',
  '2026-12-29',
  '2026-12-30',
  '2026-12-31',
  '2027-01-01',
  '2027-01-04',
  '2027-01-18',
  '2027-01-19',
  '2027-02-12',
  '2027-02-15',
  '2027-02-16',
  '2027-03-10',
  '2027-03-11',
  '2027-03-12',
  '2027-03-29',
  '2027-03-30',
  '2027-03-31',
  '2027-04-01',
  '2027-04-02',
  '2027-04-05',
  '2027-05-06',
  '2027-05-07',
  '2027-05-28',
  '2027-05-31',
]);

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

function toIsoLocal(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function startOfLocalDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isStudentSchoolDay(date) {
  const dow = date.getDay();
  if (dow === 0 || dow === 6) return false;
  return !NO_SCHOOL_2627.has(toIsoLocal(date));
}

function getDaVinciYear(now) {
  const today = startOfLocalDay(now);
  let current = null;
  for (const entry of DAVINCI_SCHOOL_YEARS) {
    const start = parseLocalDay(entry.start);
    if (today >= start) current = entry;
  }
  if (current) return current;
  return { number: 0, label: '2023–24', joining: true };
}

function walkSchoolDays(first, last, fn) {
  const cursor = new Date(first);
  while (cursor <= last) {
    if (isStudentSchoolDay(cursor)) fn(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
}

function getSchoolYearStats(now) {
  const today = startOfLocalDay(now);
  const first = parseLocalDay(SCHOOL_YEAR.firstDay);
  const last = parseLocalDay(SCHOOL_YEAR.lastDay);
  const lastMoment = new Date(
    last.getFullYear(),
    last.getMonth(),
    last.getDate(),
    SCHOOL_YEAR.lastDayEndHour,
    SCHOOL_YEAR.lastDayEndMinute,
    0,
  );

  if (today < first) {
    const calendarDaysToFirst = Math.ceil((first - today) / 86400000);
    return {
      phase: 'before',
      calendarDaysToFirst,
      msToLast: lastMoment - now,
      total: SCHOOL_YEAR.totalStudentDays,
    };
  }

  if (today > last) {
    return { phase: 'after', total: SCHOOL_YEAR.totalStudentDays };
  }

  let completed = 0;
  let remainingFromToday = 0;
  walkSchoolDays(first, last, (d) => {
    if (d < today) completed += 1;
    else remainingFromToday += 1;
  });

  const onBreakToday = !isStudentSchoolDay(today);
  const dayNumber = onBreakToday ? completed : completed + 1;
  const schoolDaysLeft = onBreakToday ? remainingFromToday : remainingFromToday - 1;

  return {
    phase: 'active',
    dayNumber,
    onBreakToday,
    schoolDaysLeft,
    msToLast: lastMoment - now,
    total: SCHOOL_YEAR.totalStudentDays,
  };
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function formatCountdown(ms) {
  if (ms <= 0) return '0d 00:00:00';
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  return `${days}d ${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;
}

function render() {
  const now = new Date();
  const age = diffClock(BIRTH, etParts(now));
  const davinci = getDaVinciYear(now);
  const school = getSchoolYearStats(now);

  const ageEl = document.getElementById('stat-age');
  const davinciEl = document.getElementById('stat-davinci');
  const schoolDaysEl = document.getElementById('stat-school-days');
  const schoolCountdownEl = document.getElementById('stat-school-countdown');

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

  if (schoolDaysEl && schoolCountdownEl) {
    if (school.phase === 'before') {
      schoolDaysEl.textContent =
        `School starts Aug 18 · ${school.calendarDaysToFirst} day${school.calendarDaysToFirst === 1 ? '' : 's'} away`;
      schoolCountdownEl.textContent =
        `Last day Jun 10, 2027 · countdown ${formatCountdown(school.msToLast)}`;
    } else if (school.phase === 'after') {
      schoolDaysEl.textContent = `All ${school.total} school days done · summer!`;
      schoolCountdownEl.textContent = 'See you next year';
    } else if (school.onBreakToday) {
      schoolDaysEl.textContent = `No school today · Day ${school.dayNumber} of ${school.total} so far`;
      schoolCountdownEl.textContent =
        `${school.schoolDaysLeft} school day${school.schoolDaysLeft === 1 ? '' : 's'} left · ${formatCountdown(school.msToLast)}`;
    } else {
      schoolDaysEl.textContent = `Day ${school.dayNumber} of ${school.total} · official calendar`;
      schoolCountdownEl.textContent =
        `${school.schoolDaysLeft} school day${school.schoolDaysLeft === 1 ? '' : 's'} until last day · ${formatCountdown(school.msToLast)}`;
    }
  }

  const calLink = document.getElementById('stat-calendar-link');
  if (calLink && !calLink.href) calLink.href = CALENDAR_URL;
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
