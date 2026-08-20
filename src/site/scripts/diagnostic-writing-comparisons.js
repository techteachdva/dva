/**
 * Peer comparison stats and charts for the writing diagnostic.
 * Displays class/grade standing as percentile ranks (0–100).
 */
(() => {
  "use strict";

  const METRICS = [
    { id: "typing", label: "Typing" },
    { id: "mechanics", label: "Mechanics" },
    { id: "story", label: "Story" },
  ];

  function resolveStoryScore(analysis) {
    const s = analysis?.scores;
    if (!s) return null;
    if (Number.isFinite(s.story)) return s.story;
    const legacy = [s.narrative, s.voice, s.creativity].filter((v) => Number.isFinite(v));
    if (legacy.length) return Math.round(legacy.reduce((a, b) => a + b, 0) / legacy.length);
    return null;
  }

  function metricScore(sub, metricId) {
    if (metricId === "story") {
      const n = resolveStoryScore(sub?.analysis);
      return Number.isFinite(n) ? n : null;
    }
    const n = Number(sub?.analysis?.scores?.[metricId]);
    return Number.isFinite(n) ? n : null;
  }

  function classroomGrade(classroom) {
    const c = String(classroom || "");
    if (/6th|(?:^|\s|[-:])6(?:\s|[-]|$)/i.test(c)) return 6;
    if (/7th|(?:^|\s|[-:])7(?:\s|[-]|$)/i.test(c)) return 7;
    if (/8th|(?:^|\s|[-:])8(?:\s|[-]|$)/i.test(c)) return 8;
    return null;
  }

  function isMixedGradeClass(classroom) {
    const mixed = window.DWCalibration?.MIXED_GRADE_CLASSES;
    if (!mixed) return false;
    return mixed.has(String(classroom || "").trim());
  }

  function gradeNormFallback(grade, metricId) {
    const norms = window.DWCalibration?.GRADE_NORMS?.[grade];
    if (!norms) return null;
    return Number.isFinite(norms[metricId]) ? norms[metricId] : null;
  }

  function isExcludedFromNorms(sub) {
    const name = String(sub?.name || "").trim();
    const classroom = String(sub?.classroom || "").trim();
    if (/^teacher'?s lounge$/i.test(classroom)) return true;
    return /^amy$/i.test(name);
  }

  function average(values) {
    const nums = values.filter((v) => Number.isFinite(v));
    if (!nums.length) return null;
    return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
  }

  function minValue(values) {
    const nums = values.filter((v) => Number.isFinite(v));
    if (!nums.length) return null;
    return Math.min(...nums);
  }

  function maxValue(values) {
    const nums = values.filter((v) => Number.isFinite(v));
    if (!nums.length) return null;
    return Math.max(...nums);
  }

  function sortedNumeric(values) {
    return values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  }

  /** Mid-rank percentile: share of the pool at or below this score (0–100). */
  function percentileRank(value, values) {
    const pool = sortedNumeric(values);
    if (!Number.isFinite(value) || pool.length === 0) return null;
    if (pool.length === 1) return 50;
    const below = pool.filter((v) => v < value).length;
    const equal = pool.filter((v) => v === value).length;
    return Math.round(((below + (equal - 1) / 2) / (pool.length - 1)) * 100);
  }

  function quartile(sorted, q) {
    if (!sorted.length) return null;
    if (sorted.length === 1) return sorted[0];
    const pos = (sorted.length - 1) * q;
    const lo = Math.floor(pos);
    const hi = Math.ceil(pos);
    if (lo === hi) return sorted[lo];
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
  }

  function ordinalPercentile(n) {
    if (!Number.isFinite(n)) return "—";
    const mod100 = n % 100;
    const mod10 = n % 10;
    let suffix = "th";
    if (mod100 < 11 || mod100 > 13) {
      if (mod10 === 1) suffix = "st";
      else if (mod10 === 2) suffix = "nd";
      else if (mod10 === 3) suffix = "rd";
    }
    return `${n}${suffix}`;
  }

  function peerPool(submissions, target, scope) {
    const grade = classroomGrade(target.classroom);
    return submissions.filter((sub) => {
      if (!sub || sub.id === target.id) return false;
      if (isExcludedFromNorms(sub)) return false;
      if (scope === "class") return sub.classroom === target.classroom;
      if (scope === "grade") {
        if (isMixedGradeClass(sub.classroom)) return false;
        const g = classroomGrade(sub.classroom);
        return grade !== null && g === grade;
      }
      return false;
    });
  }

  function withFallback(value, ...fallbacks) {
    if (Number.isFinite(value)) return value;
    for (const fb of fallbacks) {
      if (Number.isFinite(fb)) return fb;
    }
    return null;
  }

  function classGradeScoreList(submissions, target, metricId, includeTarget = false) {
    const grade = classroomGrade(target.classroom);
    return submissions
      .filter((sub) => {
        if (!sub || isExcludedFromNorms(sub)) return false;
        if (!includeTarget && sub.id === target.id) return false;
        if (sub.classroom !== target.classroom) return false;
        if (grade === null) return true;
        return classroomGrade(sub.classroom) === grade;
      })
      .map((sub) => metricScore(sub, metricId));
  }

  function peerStatusFromPercentile(classPct, gradePct, student, classAvg) {
    if (!Number.isFinite(classPct)) {
      if (!Number.isFinite(student)) {
        return { level: "neutral", label: "No score", diff: null, percentile: null, gradePercentile: gradePct };
      }
      if (!Number.isFinite(classAvg)) {
        return { level: "neutral", label: "Small class sample", diff: null, percentile: null, gradePercentile: gradePct };
      }
      const diff = Math.round(student - classAvg);
      return { level: "mid", label: "Score only", diff, percentile: null, gradePercentile: gradePct };
    }

    const diff = classPct - 50;
    let level = "mid";
    let label = `${ordinalPercentile(classPct)} percentile`;

    if (classPct >= 90) {
      level = "top";
      label = `${ordinalPercentile(classPct)} percentile · top of class`;
    } else if (classPct >= 75) {
      level = "high";
      label = `${ordinalPercentile(classPct)} percentile · above most`;
    } else if (classPct >= 60) {
      level = "above";
      label = `${ordinalPercentile(classPct)} percentile · above median`;
    } else if (classPct >= 40) {
      level = "mid";
      label = `${ordinalPercentile(classPct)} percentile · near median`;
    } else if (classPct >= 25) {
      level = "below";
      label = `${ordinalPercentile(classPct)} percentile · below median`;
    } else {
      level = "low";
      label = `${ordinalPercentile(classPct)} percentile · lower range`;
    }

    return { level, label, diff, percentile: classPct, gradePercentile: gradePct };
  }

  function computeMetricComparison(submissions, target, metricId) {
    const student = metricScore(target, metricId);
    const grade = classroomGrade(target.classroom);
    const classPeers = peerPool(submissions, target, "class");
    const gradePeers = peerPool(submissions, target, "grade");

    const classScores = classPeers.map((s) => metricScore(s, metricId));
    const gradeScores = gradePeers.map((s) => metricScore(s, metricId));
    const classPoolScores = sortedNumeric(classGradeScoreList(submissions, target, metricId, true));
    const gradePoolScores = sortedNumeric([
      ...gradeScores,
      ...(Number.isFinite(student) ? [student] : []),
    ]);

    const classAvg = average(classScores);
    const gradeAvg = withFallback(average(gradeScores), gradeNormFallback(grade, metricId));

    const classPercentile = percentileRank(student, classPoolScores);
    const gradePercentile = gradePeers.length > 0 ? percentileRank(student, gradePoolScores) : null;

    const classMin = classPoolScores.length ? classPoolScores[0] : null;
    const classMax = classPoolScores.length ? classPoolScores[classPoolScores.length - 1] : null;
    const classP25 = quartile(classPoolScores, 0.25);
    const classP75 = quartile(classPoolScores, 0.75);
    const classMedian = quartile(classPoolScores, 0.5);
    const smallSample = classPoolScores.length < 3;

    return {
      id: metricId,
      student,
      classAvg,
      gradeAvg,
      classMin: withFallback(classMin, classAvg, gradeAvg),
      classMax: withFallback(classMax, classAvg, gradeAvg),
      classP25,
      classP75,
      classMedian,
      classPercentile,
      gradePercentile,
      classPeerCount: classPeers.length,
      gradePeerCount: gradePeers.length,
      classPoolSize: classPoolScores.length,
      smallSample,
      status: peerStatusFromPercentile(classPercentile, gradePercentile, student, classAvg),
    };
  }

  function computeComparisons(submissions, target) {
    const grade = classroomGrade(target.classroom);
    const metrics = METRICS.map((m) => computeMetricComparison(submissions, target, m.id));
    let above = 0;
    let below = 0;
    let near = 0;
    for (const m of metrics) {
      const pct = m.classPercentile;
      if (!Number.isFinite(pct)) {
        near++;
        continue;
      }
      if (pct >= 60) above++;
      else if (pct < 40) below++;
      else near++;
    }
    return {
      grade,
      classroom: target.classroom || "",
      metrics,
      summary: { above, below, near, total: metrics.length },
    };
  }

  function renderSummaryStrip(comparison) {
    const { above, below, near, total } = comparison.summary;
    const gradeNote = comparison.grade ? `Grade ${comparison.grade}` : "Grade n/a";
    return `
      <div class="dw-compare-summary">
        <div class="dw-compare-summary__counts">
          <div class="dw-compare-stat dw-compare-stat--above">
            <span class="dw-compare-stat__n">${above}</span>
            <span class="dw-compare-stat__k">≥ 60th %ile</span>
          </div>
          <div class="dw-compare-stat dw-compare-stat--near">
            <span class="dw-compare-stat__n">${near}</span>
            <span class="dw-compare-stat__k">40th–59th %ile</span>
          </div>
          <div class="dw-compare-stat dw-compare-stat--below">
            <span class="dw-compare-stat__n">${below}</span>
            <span class="dw-compare-stat__k">&lt; 40th %ile</span>
          </div>
        </div>
        <p class="dw-muted dw-tiny dw-compare-summary__meta">
          ${escapeHtml(comparison.classroom || "Class")} · ${escapeHtml(gradeNote)} ·
          percentile rank vs classmates (higher = stronger relative standing)
        </p>
      </div>`;
  }

  function renderQuickGrid(comparison) {
    const cards = comparison.metrics.map((m) => {
      const label = METRICS.find((x) => x.id === m.id)?.label || m.id;
      const classPct = m.classPercentile;
      const gradePct = m.gradePercentile;
      const pctClass = Number.isFinite(classPct) ? "dw-quick-card__diff--up" : "dw-quick-card__diff--flat";
      const pctNote = Number.isFinite(classPct)
        ? `<span class="dw-quick-card__pct">${ordinalPercentile(classPct)} in class</span>`
        : `<span class="dw-quick-card__pct dw-muted">Small sample</span>`;
      const gradeNote = Number.isFinite(gradePct)
        ? `<span class="dw-quick-card__pct-sub">${ordinalPercentile(gradePct)} in grade</span>`
        : "";
      return `
        <div class="dw-quick-card dw-quick-card--${m.status?.level || "neutral"}">
          <div class="dw-quick-card__label">${escapeHtml(label)}</div>
          <div class="dw-quick-card__score">${m.student ?? "—"}</div>
          <div class="dw-quick-card__diff ${pctClass}">${pctNote}${gradeNote}</div>
        </div>`;
    }).join("");

    return `<div class="dw-quick-grid" aria-label="At-a-glance percentile comparison">${cards}</div>`;
  }

  function renderMarker(kind, pct, label, value) {
    if (!Number.isFinite(pct)) return "";
    const safe = Math.max(2, Math.min(98, pct));
    return `
      <div class="dw-peer-scale__marker dw-peer-scale__marker--${kind}" style="left:${safe}%">
        <span class="dw-peer-scale__marker-line" aria-hidden="true"></span>
        <span class="dw-peer-scale__marker-label">${escapeHtml(label)}<strong>${escapeHtml(String(value))}</strong></span>
      </div>`;
  }

  function renderPeerRows(comparison) {
    const rows = comparison.metrics.map((m) => {
      const label = METRICS.find((x) => x.id === m.id)?.label || m.id;
      const classPct = m.classPercentile;
      const gradePct = m.gradePercentile;
      const student = m.student ?? "—";

      const studentMarker = Number.isFinite(classPct)
        ? renderMarker("student", classPct, "Student ", `${ordinalPercentile(classPct)} · ${student}`)
        : renderMarker("student", 50, "Student ", String(student));

      const medianMarker = renderMarker("median", 50, "Median ", "50th");
      const gradeMarker = Number.isFinite(gradePct) && m.gradePeerCount > 0
        ? renderMarker("grade", gradePct, "Grade ", `${ordinalPercentile(gradePct)}`)
        : "";

      const sampleNote = m.smallSample
        ? '<span class="dw-muted"> (few classmates — interpret cautiously)</span>'
        : "";

      const p25Score = m.classP25 != null ? Math.round(m.classP25) : "—";
      const p75Score = m.classP75 != null ? Math.round(m.classP75) : "—";

      return `
        <article class="dw-peer-row dw-peer-row--${m.status?.level || "neutral"}">
          <header class="dw-peer-row__head">
            <div class="dw-peer-row__title-wrap">
              <h5 class="dw-peer-row__title">${escapeHtml(label)}</h5>
              <span class="dw-peer-chip dw-peer-chip--${m.status?.level || "neutral"}">${escapeHtml(m.status?.label || "—")}</span>
            </div>
            <div class="dw-peer-row__score">${student}</div>
          </header>
          <div class="dw-peer-scale" role="img" aria-label="${escapeHtml(label)}: ${Number.isFinite(classPct) ? `${ordinalPercentile(classPct)} percentile in class` : "score " + student}">
            <div class="dw-peer-scale__track dw-peer-scale__track--percentile">
              <div class="dw-peer-scale__band dw-peer-scale__band--iqr" style="left:25%; width:50%"></div>
              ${medianMarker}
              ${gradeMarker}
              ${studentMarker}
            </div>
            <div class="dw-peer-scale__footer">
              <span>25th %ile <strong>${p25Score}</strong></span>
              <span>75th %ile <strong>${p75Score}</strong>${sampleNote}</span>
            </div>
          </div>
        </article>`;
    }).join("");

    return `
      <section class="dw-peer-map">
        <header class="dw-peer-map__head">
          <h4 class="dw-h3">Percentile rank in class</h4>
          <p class="dw-muted dw-tiny">
            <span class="dw-peer-key dw-peer-key--student">● Student</span>
            <span class="dw-peer-key dw-peer-key--median">| Class median (50th)</span>
            <span class="dw-peer-key dw-peer-key--grade">| Grade standing</span>
            <span class="dw-peer-key dw-peer-key--band">▭ Middle 50% of class</span>
          </p>
        </header>
        <div class="dw-peer-map__rows">${rows}</div>
      </section>`;
  }

  function polarPoint(cx, cy, radius, angleRad) {
    return {
      x: cx + radius * Math.sin(angleRad),
      y: cy - radius * Math.cos(angleRad),
    };
  }

  function polygonPoints(values, cx, cy, maxRadius) {
    const step = (Math.PI * 2) / values.length;
    return values
      .map((value, i) => {
        const r = (Math.max(0, Math.min(100, value || 0)) / 100) * maxRadius;
        const p = polarPoint(cx, cy, r, i * step);
        return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
      })
      .join(" ");
  }

  function renderRadarChart(comparison) {
    const size = 320;
    const cx = size / 2;
    const cy = size / 2;
    const maxRadius = size * 0.32;
    const labels = comparison.metrics.map((m) => METRICS.find((x) => x.id === m.id)?.label || m.id);
    const studentVals = comparison.metrics.map((m) => m.classPercentile ?? 50);
    const medianVals = comparison.metrics.map(() => 50);
    const step = (Math.PI * 2) / labels.length;

    const rings = [25, 50, 75, 100].map((pct) => {
      const r = (pct / 100) * maxRadius;
      return `<circle cx="${cx}" cy="${cy}" r="${r}" class="dw-radar-ring"/>`;
    }).join("");

    const axes = labels.map((_, i) => {
      const p = polarPoint(cx, cy, maxRadius, i * step);
      return `<line x1="${cx}" y1="${cy}" x2="${p.x}" y2="${p.y}" class="dw-radar-axis"/>`;
    }).join("");

    const labelMarkup = labels.map((label, i) => {
      const m = comparison.metrics[i];
      const pct = m?.classPercentile;
      const sub = Number.isFinite(pct) ? `${ordinalPercentile(pct)}` : "—";
      const p = polarPoint(cx, cy, maxRadius + 22, i * step);
      return `<text x="${p.x}" y="${p.y}" class="dw-radar-label" text-anchor="middle" dominant-baseline="middle">${escapeHtml(label)} (${sub})</text>`;
    }).join("");

    return `
      <details class="dw-compare-radar-fold">
        <summary class="dw-h3">Optional: percentile shape overview</summary>
        <div class="dw-compare-radar-fold__body">
          <svg class="dw-radar-svg" viewBox="0 0 ${size} ${size}" role="img" aria-hidden="true">
            ${rings}
            ${axes}
            <polygon points="${polygonPoints(medianVals, cx, cy, maxRadius)}" class="dw-radar-poly dw-radar-poly--class"/>
            <polygon points="${polygonPoints(studentVals, cx, cy, maxRadius)}" class="dw-radar-poly dw-radar-poly--student"/>
            ${labelMarkup}
          </svg>
          <p class="dw-muted dw-tiny">Green = student percentile in class · Blue = 50th percentile (class median). Each axis is 0–100th percentile, not raw score.</p>
        </div>
      </details>`;
  }

  function renderComparisonPanel(submissions, target) {
    const comparison = computeComparisons(submissions, target);
    const hasPeers = comparison.metrics.some((m) => m.classPeerCount > 0 || m.classPoolSize > 1);
    if (!hasPeers) {
      return `<div class="dw-compare-empty dw-muted">No peer submissions yet for comparison — percentiles will appear as more students complete the diagnostic.</div>`;
    }
    return `
      ${renderSummaryStrip(comparison)}
      ${renderQuickGrid(comparison)}
      ${renderPeerRows(comparison)}
      ${renderRadarChart(comparison)}`;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  window.DWComparisons = {
    METRICS,
    classroomGrade,
    computeComparisons,
    percentileRank,
    ordinalPercentile,
    renderComparisonPanel,
    renderRadarChart,
    isExcludedFromNorms,
  };
})();
