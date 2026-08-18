/**
 * Peer comparison stats and radar charts for the writing diagnostic.
 */
(() => {
  "use strict";

  const METRICS = [
    { id: "volume", label: "Volume" },
    { id: "typing", label: "Typing" },
    { id: "mechanics", label: "Mechanics" },
    { id: "syntax", label: "Syntax" },
    { id: "semantics", label: "Word choice" },
    { id: "voice", label: "Voice" },
    { id: "narrative", label: "Story" },
    { id: "creativity", label: "Creativity" },
  ];

  function classroomGrade(classroom) {
    const c = String(classroom || "");
    if (/6th|(?:^|\s|[-:])6(?:\s|[-]|$)/i.test(c)) return 6;
    if (/7th|(?:^|\s|[-:])7(?:\s|[-]|$)/i.test(c)) return 7;
    if (/8th|(?:^|\s|[-:])8(?:\s|[-]|$)/i.test(c)) return 8;
    return null;
  }

  function isExcludedFromNorms(sub) {
    return /^amy$/i.test(String(sub?.name || "").trim());
  }

  function metricScore(sub, metricId) {
    const n = Number(sub?.analysis?.scores?.[metricId]);
    return Number.isFinite(n) ? n : null;
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
        const g = classroomGrade(sub.classroom);
        return grade !== null && g === grade;
      }
      if (scope === "classGrade") {
        if (sub.classroom !== target.classroom) return false;
        if (grade === null) return true;
        return classroomGrade(sub.classroom) === grade;
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
    const classPeers = peerPool(submissions, target, "class");
    const gradePeers = peerPool(submissions, target, "grade");

    const classScores = classPeers.map((s) => metricScore(s, metricId));
    const gradeScores = gradePeers.map((s) => metricScore(s, metricId));
    const rangeScores = classGradeScoreList(submissions, target, metricId, true);

    const classAvg = average(classScores);
    const gradeAvg = average(gradeScores);

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
      classGradePeerCount: rangeScores.filter((v) => Number.isFinite(v)).length,
      minIsFallback: classMin === null,
      maxIsFallback: classMax === null,
    };
  }

  function computeComparisons(submissions, target) {
    const grade = classroomGrade(target.classroom);
    const metrics = METRICS.map((m) => computeMetricComparison(submissions, target, m.id));
    return {
      grade,
      classroom: target.classroom || "",
      metrics,
      metricLabels: METRICS,
    };
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

  function axisLines(cx, cy, maxRadius, count) {
    const step = (Math.PI * 2) / count;
    let lines = "";
    for (let i = 0; i < count; i++) {
      const p = polarPoint(cx, cy, maxRadius, i * step);
      lines += `<line x1="${cx}" y1="${cy}" x2="${p.x.toFixed(1)}" y2="${p.y.toFixed(1)}" class="dw-radar-axis"/>`;
    }
    return lines;
  }

  function gridRings(cx, cy, maxRadius) {
    return [25, 50, 75, 100]
      .map((pct) => {
        const r = (pct / 100) * maxRadius;
        return `<circle cx="${cx}" cy="${cy}" r="${r}" class="dw-radar-ring"/>`;
      })
      .join("");
  }

  function renderRadarChart(comparison, options = {}) {
    const size = options.size || 360;
    const cx = size / 2;
    const cy = size / 2;
    const maxRadius = size * 0.34;
    const labels = comparison.metrics.map((m) => METRICS.find((x) => x.id === m.id)?.label || m.id);

    const studentVals = comparison.metrics.map((m) => m.student ?? 0);
    const classVals = comparison.metrics.map((m) => m.classAvg ?? 0);
    const gradeVals = comparison.metrics.map((m) => m.gradeAvg ?? 0);

    const step = (Math.PI * 2) / labels.length;
    const labelMarkup = labels
      .map((label, i) => {
        const p = polarPoint(cx, cy, maxRadius + 22, i * step);
        return `<text x="${p.x.toFixed(1)}" y="${p.y.toFixed(1)}" class="dw-radar-label" text-anchor="middle" dominant-baseline="middle">${escapeHtml(label)}</text>`;
      })
      .join("");

    const vertexMarkup = comparison.metrics
      .map((m, i) => {
        const student = m.student ?? 0;
        const p = polarPoint(cx, cy, (student / 100) * maxRadius, i * step);
        const minLabel = m.minIsFallback ? "~" : "";
        const maxLabel = m.maxIsFallback ? "~" : "";
        return `<g class="dw-radar-vertex">
          <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="5" class="dw-radar-dot"/>
          <text x="${p.x.toFixed(1)}" y="${(p.y - 10).toFixed(1)}" class="dw-radar-score" text-anchor="middle">${student}</text>
          <text x="${p.x.toFixed(1)}" y="${(p.y + 14).toFixed(1)}" class="dw-radar-range" text-anchor="middle">${minLabel}${m.classMin ?? "—"}–${m.classMax ?? "—"}${maxLabel}</text>
        </g>`;
      })
      .join("");

    const gradeNote = comparison.grade ? `Grade ${comparison.grade}` : "Grade level n/a";
    const classNote = comparison.classroom || "Class";

    return `
      <div class="dw-compare-radar">
        <div class="dw-compare-radar__head">
          <h4 class="dw-h3">Skill comparison chart</h4>
          <p class="dw-muted dw-tiny">${escapeHtml(classNote)} · ${escapeHtml(gradeNote)} · bold = this student · faded shapes = class &amp; grade averages · range = low–high in class</p>
        </div>
        <div class="dw-compare-radar__body">
          <svg class="dw-radar-svg" viewBox="0 0 ${size} ${size}" role="img" aria-label="Radar chart comparing student writing scores to class and grade averages">
            ${gridRings(cx, cy, maxRadius)}
            ${axisLines(cx, cy, maxRadius, labels.length)}
            <polygon points="${polygonPoints(gradeVals, cx, cy, maxRadius)}" class="dw-radar-poly dw-radar-poly--grade"/>
            <polygon points="${polygonPoints(classVals, cx, cy, maxRadius)}" class="dw-radar-poly dw-radar-poly--class"/>
            <polygon points="${polygonPoints(studentVals, cx, cy, maxRadius)}" class="dw-radar-poly dw-radar-poly--student"/>
            ${vertexMarkup}
            ${labelMarkup}
          </svg>
          <ul class="dw-compare-legend">
            <li><span class="dw-compare-swatch dw-compare-swatch--student"></span><strong>Student</strong></li>
            <li><span class="dw-compare-swatch dw-compare-swatch--class"></span>Class average</li>
            <li><span class="dw-compare-swatch dw-compare-swatch--grade"></span>Grade average</li>
            <li><span class="dw-compare-swatch dw-compare-swatch--range"></span>Class low–high <span class="dw-muted">(~ = estimated from average)</span></li>
          </ul>
        </div>
      </div>`;
  }

  function renderMetricBars(comparison) {
    const rows = comparison.metrics
      .map((m) => {
        const label = METRICS.find((x) => x.id === m.id)?.label || m.id;
        const student = m.student ?? 0;
        const classAvg = m.classAvg ?? 0;
        const gradeAvg = m.gradeAvg ?? 0;
        const classMin = m.classMin ?? classAvg;
        const classMax = m.classMax ?? classAvg;
        return `
          <div class="dw-compare-bar" data-metric="${escapeHtml(m.id)}">
            <div class="dw-compare-bar__head">
              <span class="dw-compare-bar__title">${escapeHtml(label)}</span>
              <span class="dw-compare-bar__student">${student}</span>
            </div>
            <div class="dw-compare-bar__track" aria-hidden="true">
              <div class="dw-compare-bar__range" style="left:${classMin}%; width:${Math.max(classMax - classMin, 2)}%"></div>
              <div class="dw-compare-bar__ghost dw-compare-bar__ghost--grade" style="width:${gradeAvg}%"></div>
              <div class="dw-compare-bar__ghost dw-compare-bar__ghost--class" style="width:${classAvg}%"></div>
              <div class="dw-compare-bar__fill" style="width:${student}%"></div>
            </div>
            <div class="dw-compare-bar__labels">
              <span>Low ${m.classMin ?? "—"}${m.minIsFallback ? "*" : ""}</span>
              <span>Class ${m.classAvg ?? "—"}</span>
              <span>Grade ${m.gradeAvg ?? "—"}</span>
              <span>High ${m.classMax ?? "—"}${m.maxIsFallback ? "*" : ""}</span>
            </div>
          </div>`;
      })
      .join("");

    return `
      <div class="dw-compare-bars">
        <h4 class="dw-h3">Category breakdown</h4>
        <p class="dw-muted dw-tiny">Each bar: student (solid) over class average (blue ghost) and grade average (purple ghost). Shaded band = lowest–highest in this class.</p>
        ${rows}
      </div>`;
  }

  function renderComparisonPanel(submissions, target) {
    const comparison = computeComparisons(submissions, target);
    const hasPeers = comparison.metrics.some((m) => m.classPeerCount > 0 || m.gradePeerCount > 0);
    if (!hasPeers) {
      return `<div class="dw-compare-empty dw-muted">No peer submissions yet for comparison — averages will appear as more students complete the diagnostic.</div>`;
    }
    return `${renderRadarChart(comparison)}${renderMetricBars(comparison)}`;
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
    renderMetricBars,
    isExcludedFromNorms,
  };
})();
