/**
 * Peer comparison stats and charts for the writing diagnostic.
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

  function computeMetricComparison(submissions, target, metricId) {
    const student = metricScore(target, metricId);
    const grade = classroomGrade(target.classroom);
    const classPeers = peerPool(submissions, target, "class");
    const gradePeers = peerPool(submissions, target, "grade");

    const classScores = classPeers.map((s) => metricScore(s, metricId));
    const gradeScores = gradePeers.map((s) => metricScore(s, metricId));
    const rangeScores = classGradeScoreList(submissions, target, metricId, true);

    const classAvg = average(classScores);
    const gradeAvg = withFallback(average(gradeScores), gradeNormFallback(grade, metricId));

    let classMin = minValue(rangeScores);
    let classMax = maxValue(rangeScores);
    if (rangeScores.filter((v) => Number.isFinite(v)).length < 2) {
      classMin = null;
      classMax = null;
    }

    return {
      id: metricId,
      student,
      classAvg,
      gradeAvg,
      classMin: withFallback(classMin, classAvg, gradeAvg),
      classMax: withFallback(classMax, classAvg, gradeAvg),
      classPeerCount: classPeers.length,
      gradePeerCount: gradePeers.length,
      minIsFallback: classMin === null,
      maxIsFallback: classMax === null,
      status: peerStatus(student, classAvg, classMin, classMax),
    };
  }

  function peerStatus(student, classAvg, classMin, classMax) {
    if (!Number.isFinite(student)) {
      return { level: "neutral", label: "No score", diff: null };
    }
    if (!Number.isFinite(classAvg)) {
      return { level: "neutral", label: "No class data", diff: null };
    }
    const diff = Math.round(student - classAvg);
    const hasSpread = Number.isFinite(classMin) && Number.isFinite(classMax) && classMax > classMin;
    if (hasSpread && student >= classMax) {
      return { level: "top", label: "Top of class", diff };
    }
    if (hasSpread && student <= classMin) {
      return { level: "bottom", label: "Lowest in class", diff };
    }
    if (diff >= 12) return { level: "high", label: "Well above class", diff };
    if (diff >= 4) return { level: "above", label: "Above class", diff };
    if (diff > -4) return { level: "mid", label: "Near class avg", diff };
    if (diff > -12) return { level: "below", label: "Below class", diff };
    return { level: "low", label: "Well below class", diff };
  }

  function computeComparisons(submissions, target) {
    const grade = classroomGrade(target.classroom);
    const metrics = METRICS.map((m) => computeMetricComparison(submissions, target, m.id));
    let above = 0;
    let below = 0;
    let near = 0;
    for (const m of metrics) {
      const lvl = m.status?.level;
      if (lvl === "high" || lvl === "above" || lvl === "top") above++;
      else if (lvl === "low" || lvl === "below" || lvl === "bottom") below++;
      else if (lvl === "mid") near++;
    }
    return {
      grade,
      classroom: target.classroom || "",
      metrics,
      summary: { above, below, near, total: metrics.length },
    };
  }

  function fmtDiff(diff) {
    if (!Number.isFinite(diff)) return "—";
    if (diff > 0) return `+${diff}`;
    return String(diff);
  }

  function renderSummaryStrip(comparison) {
    const { above, below, near, total } = comparison.summary;
    const gradeNote = comparison.grade ? `Grade ${comparison.grade}` : "Grade n/a";
    return `
      <div class="dw-compare-summary">
        <div class="dw-compare-summary__counts">
          <div class="dw-compare-stat dw-compare-stat--above">
            <span class="dw-compare-stat__n">${above}</span>
            <span class="dw-compare-stat__k">above class</span>
          </div>
          <div class="dw-compare-stat dw-compare-stat--near">
            <span class="dw-compare-stat__n">${near}</span>
            <span class="dw-compare-stat__k">near average</span>
          </div>
          <div class="dw-compare-stat dw-compare-stat--below">
            <span class="dw-compare-stat__n">${below}</span>
            <span class="dw-compare-stat__k">below class</span>
          </div>
        </div>
        <p class="dw-muted dw-tiny dw-compare-summary__meta">
          ${escapeHtml(comparison.classroom || "Class")} · ${escapeHtml(gradeNote)} ·
          comparing this student to ${total} main skills vs class peers
        </p>
      </div>`;
  }

  function renderQuickGrid(comparison) {
    const cards = comparison.metrics.map((m) => {
      const label = METRICS.find((x) => x.id === m.id)?.label || m.id;
      const diff = m.status?.diff;
      const diffClass = !Number.isFinite(diff) ? "" : diff > 3 ? "dw-quick-card__diff--up" : diff < -3 ? "dw-quick-card__diff--down" : "dw-quick-card__diff--flat";
      return `
        <div class="dw-quick-card dw-quick-card--${m.status?.level || "neutral"}">
          <div class="dw-quick-card__label">${escapeHtml(label)}</div>
          <div class="dw-quick-card__score">${m.student ?? "—"}</div>
          <div class="dw-quick-card__diff ${diffClass}">${Number.isFinite(diff) ? `${fmtDiff(diff)} vs class` : "—"}</div>
        </div>`;
    }).join("");

    return `<div class="dw-quick-grid" aria-label="At-a-glance skill comparison">${cards}</div>`;
  }

  function renderMarker(kind, pct, label, value) {
    if (!Number.isFinite(pct)) return "";
    const safe = Math.max(2, Math.min(98, pct));
    return `
      <div class="dw-peer-scale__marker dw-peer-scale__marker--${kind}" style="left:${safe}%">
        <span class="dw-peer-scale__marker-line" aria-hidden="true"></span>
        <span class="dw-peer-scale__marker-label">${escapeHtml(label)}<strong>${value ?? "—"}</strong></span>
      </div>`;
  }

  function renderPeerRows(comparison) {
    const rows = comparison.metrics.map((m) => {
      const label = METRICS.find((x) => x.id === m.id)?.label || m.id;
      const student = m.student ?? 0;
      const classAvg = m.classAvg;
      const gradeAvg = m.gradeAvg;
      const classMin = m.classMin ?? 0;
      const classMax = m.classMax ?? 100;
      const bandLeft = Math.max(0, Math.min(100, classMin));
      const bandWidth = Math.max(2, Math.min(100 - bandLeft, classMax - classMin));

      const classMarker = Number.isFinite(classAvg)
        ? renderMarker("class", classAvg, "Class ", classAvg)
        : "";
      const gradeMarker = Number.isFinite(gradeAvg) && m.gradePeerCount > 0
        ? renderMarker("grade", gradeAvg, "Grade ", gradeAvg)
        : "";
      const studentMarker = renderMarker("student", student, "Student ", student);

      const rangeNote = m.minIsFallback || m.maxIsFallback
        ? '<span class="dw-muted"> (range estimated)</span>'
        : "";

      return `
        <article class="dw-peer-row dw-peer-row--${m.status?.level || "neutral"}">
          <header class="dw-peer-row__head">
            <div class="dw-peer-row__title-wrap">
              <h5 class="dw-peer-row__title">${escapeHtml(label)}</h5>
              <span class="dw-peer-chip dw-peer-chip--${m.status?.level || "neutral"}">${escapeHtml(m.status?.label || "—")}</span>
            </div>
            <div class="dw-peer-row__score">${m.student ?? "—"}</div>
          </header>
          <div class="dw-peer-scale" role="img" aria-label="${escapeHtml(label)}: student ${student}, class average ${classAvg ?? "unknown"}">
            <div class="dw-peer-scale__track">
              <div class="dw-peer-scale__band" style="left:${bandLeft}%; width:${bandWidth}%"></div>
              ${classMarker}
              ${gradeMarker}
              ${studentMarker}
            </div>
            <div class="dw-peer-scale__footer">
              <span>Low <strong>${m.classMin ?? "—"}</strong></span>
              <span>High <strong>${m.classMax ?? "—"}</strong>${rangeNote}</span>
            </div>
          </div>
        </article>`;
    }).join("");

    return `
      <section class="dw-peer-map">
        <header class="dw-peer-map__head">
          <h4 class="dw-h3">Where they fall in class</h4>
          <p class="dw-muted dw-tiny">
            <span class="dw-peer-key dw-peer-key--student">● Student</span>
            <span class="dw-peer-key dw-peer-key--class">| Class avg</span>
            <span class="dw-peer-key dw-peer-key--grade">| Grade avg</span>
            <span class="dw-peer-key dw-peer-key--band">▭ Class range</span>
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
    const studentVals = comparison.metrics.map((m) => m.student ?? 0);
    const classVals = comparison.metrics.map((m) => m.classAvg ?? 0);
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
      const p = polarPoint(cx, cy, maxRadius + 18, i * step);
      return `<text x="${p.x}" y="${p.y}" class="dw-radar-label" text-anchor="middle" dominant-baseline="middle">${escapeHtml(label)}</text>`;
    }).join("");

    return `
      <details class="dw-compare-radar-fold">
        <summary class="dw-h3">Optional: shape overview</summary>
        <div class="dw-compare-radar-fold__body">
          <svg class="dw-radar-svg" viewBox="0 0 ${size} ${size}" role="img" aria-hidden="true">
            ${rings}
            ${axes}
            <polygon points="${polygonPoints(classVals, cx, cy, maxRadius)}" class="dw-radar-poly dw-radar-poly--class"/>
            <polygon points="${polygonPoints(studentVals, cx, cy, maxRadius)}" class="dw-radar-poly dw-radar-poly--student"/>
            ${labelMarkup}
          </svg>
          <p class="dw-muted dw-tiny">Green = student · Blue = class average. Use the rows above for precise numbers.</p>
        </div>
      </details>`;
  }

  function renderComparisonPanel(submissions, target) {
    const comparison = computeComparisons(submissions, target);
    const hasPeers = comparison.metrics.some((m) => m.classPeerCount > 0 || m.gradePeerCount > 0);
    if (!hasPeers) {
      return `<div class="dw-compare-empty dw-muted">No peer submissions yet for comparison — averages will appear as more students complete the diagnostic.</div>`;
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
    renderComparisonPanel,
    renderRadarChart,
    isExcludedFromNorms,
  };
})();
