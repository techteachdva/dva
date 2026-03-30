import { FIELD_LABELS, FIELD_ORDER, QUESTIONS, SHORT_FIELD_LABELS } from "./_bank.js";

function headers() {
  return {
    "Cache-Control": "no-store",
  };
}

function reverseIfNeeded(v, reverse) {
  return reverse ? 6 - v : v;
}

function likertMeanTo100(mean1to5) {
  return 1.0 + (mean1to5 - 1.0) * (99.0 / 4.0);
}

function computeRawMeans(responses) {
  const sums = {};
  const counts = {};

  for (const q of QUESTIONS) {
    const v0 = responses?.[String(q.id)];
    if (v0 == null) continue;
    const v = Number(v0);
    if (!Number.isFinite(v) || v < 1 || v > 5) continue;

    const adj = reverseIfNeeded(v, Boolean(q.reverse_scored));

    sums[q.spectrum] = (sums[q.spectrum] ?? 0) + adj;
    counts[q.spectrum] = (counts[q.spectrum] ?? 0) + 1;

    if (q.contributes_to_constructivism) {
      sums.CONSTRUCTIVISM_INDEX = (sums.CONSTRUCTIVISM_INDEX ?? 0) + adj;
      counts.CONSTRUCTIVISM_INDEX = (counts.CONSTRUCTIVISM_INDEX ?? 0) + 1;
    }
  }

  const out = {};
  for (const f of FIELD_ORDER) {
    const c = counts[f] ?? 0;
    out[f] = c > 0 ? sums[f] / c : 3.0;
  }
  return out;
}

function rankFields(scores100) {
  const items = Object.entries(scores100).sort((a, b) => b[1] - a[1]);
  const rankedHigh = items.map(([field, score]) => ({ field, score }));
  const rankedLow = [...rankedHigh].slice().reverse();
  return { rankedHigh, rankedLow };
}

function band(score) {
  if (score >= 88) return "Distinguished alignment";
  if (score >= 75) return "Strong alignment";
  if (score >= 62) return "Solid alignment";
  if (score >= 48) return "Developing alignment";
  if (score >= 35) return "Emerging alignment";
  return "Entry / high-growth zone";
}

function fieldPoles(field) {
  switch (field) {
    case "TEACHER_TO_STUDENT":
      return { low: "Teacher-centered", high: "Student-centered" };
    case "BEHAVIORISM_TO_COGNITIVISM":
      return { low: "Behaviorism", high: "Cognitivism" };
    case "BEHAVIORISM_TO_CONSTRUCTIVISM":
      return { low: "Behaviorism", high: "Constructivism" };
    case "COGNITIVISM_TO_SOCIAL_CONSTRUCTIVISM":
      return { low: "Cognitivism", high: "Social constructivism" };
    case "DIRECT_TO_EXPERIENTIAL":
      return { low: "Direct instruction", high: "Experiential learning" };
    case "CONSTRUCTIVISM_INDEX":
      return { low: "Less constructivist", high: "More constructivist" };
    default:
      return { low: field, high: field };
  }
}

function fieldDescription(field) {
  switch (field) {
    case "TEACHER_TO_STUDENT":
      return (
        "Where you tend to locate agency: 1 leans toward teacher-directed planning and delivery; " +
        "100 leans toward student inquiry, differentiation, and shared sense-making."
      );
    case "BEHAVIORISM_TO_COGNITIVISM":
      return (
        "What you emphasize for learning/behavior: 1 leans toward reinforcement and contingencies; " +
        "100 leans toward teaching thinking, processing, and mental models."
      );
    case "BEHAVIORISM_TO_CONSTRUCTIVISM":
      return (
        "How learning changes: 1 leans toward correct responses shaped by feedback/reinforcement; " +
        "100 leans toward learners building understanding through experience, error, and reflection."
      );
    case "COGNITIVISM_TO_SOCIAL_CONSTRUCTIVISM":
      return (
        "Where thinking develops: 1 leans toward individual cognition; 100 leans toward learning through " +
        "peer interaction, discourse, and co-construction."
      );
    case "DIRECT_TO_EXPERIENTIAL":
      return (
        "How time is used: 1 leans toward efficient explanations/modeling; 100 leans toward hands-on tasks, " +
        "projects, and authentic application."
      );
    case "CONSTRUCTIVISM_INDEX":
      return (
        "A small sub-index based on items explicitly keyed to constructivist beliefs/practices in this bank " +
        "(higher = more constructivist)."
      );
    default:
      return "";
  }
}

function fieldInterpretation(field, score) {
  const { low, high } = fieldPoles(field);
  const b = band(score);

  let pos = "Sits near the **middle** (mix of both).";
  if (score <= 35) pos = `Leans toward **${low}**.`;
  else if (score <= 48) pos = `Slight lean toward **${low}**.`;
  else if (score < 62) pos = "Sits near the **middle** (mix of both).";
  else if (score < 75) pos = `Slight lean toward **${high}**.`;
  else pos = `Leans toward **${high}**.`;

  const prompts = {
    TEACHER_TO_STUDENT:
      "Reflection prompt: Where do students make consequential choices (task, method, criteria, pacing)? Pick one upcoming lesson and shift **one** decision from you to them.",
    BEHAVIORISM_TO_COGNITIVISM:
      "Reflection prompt: Identify one routine currently driven by rewards/consequences and redesign it around visibility of thinking (strategy modeling, self-monitoring, metacognitive checklists).",
    BEHAVIORISM_TO_CONSTRUCTIVISM:
      "Reflection prompt: Where can students safely test ideas, be wrong, and revise? Add one low-stakes cycle: predict → test → explain → revise.",
    COGNITIVISM_TO_SOCIAL_CONSTRUCTIVISM:
      "Reflection prompt: When do students learn from peers in ways that change their thinking (not just share answers)? Add one structured discourse move (roles, sentence starters, evidence requirement).",
    DIRECT_TO_EXPERIENTIAL:
      "Reflection prompt: Take one explanation you usually deliver and convert it into an activity that still preserves clarity (worked example + practice, lab with explicit success criteria, or a small authentic task).",
    CONSTRUCTIVISM_INDEX:
      "Reflection prompt: Choose one upcoming unit moment to normalize error and revision (drafting, peer critique, reflection, or retest with explanation).",
  };

  return `${pos} Band: ${b}. ${prompts[field] ?? ""}`.trim();
}

function buildAnalysisReport(scores100, rawMeans5) {
  const { rankedHigh, rankedLow } = rankFields(scores100);

  const lines = [];
  lines.push("FRAMEWORK");
  lines.push("—".repeat(44));
  lines.push(
    "This version has 20 Likert statements (1=Strongly Disagree … 5=Strongly Agree) grouped into six " +
      "pedagogical spectrums. Some statements are reverse-scored so that higher always means more of the right-hand " +
      "pole. The radar uses a 1–100 display scale derived from your mean Likert ratings (1 ↦ 1, 5 ↦ 100)."
  );
  lines.push("");

  lines.push("RAW (mean Likert per spectrum, 1–5)");
  lines.push("—".repeat(44));
  for (const item of rankedHigh) {
    const f = item.field;
    const v = Number(rawMeans5?.[f] ?? 3.0);
    const label = SHORT_FIELD_LABELS[f] ?? f;
    lines.push(`${label}: ${v.toFixed(2)}/5`);
  }
  lines.push("");

  lines.push("SNAPSHOT");
  lines.push("—".repeat(44));
  const top = rankedHigh
    .slice(0, 3)
    .map((x) => `${SHORT_FIELD_LABELS[x.field] ?? x.field} (${Math.round(x.score)})`)
    .join(", ");
  const bottom = rankedLow
    .slice(0, 3)
    .map((x) => `${SHORT_FIELD_LABELS[x.field] ?? x.field} (${Math.round(x.score)})`)
    .join(", ");
  lines.push(`Relative strengths (top signals): ${top}.`);
  lines.push(`Relative growth edges (lowest signals): ${bottom}.`);
  lines.push(
    "Use ‘relative’ deliberately: all six fields interact; a low score often reflects tradeoffs in moments, not absence of care."
  );
  lines.push("");

  lines.push("FIELD-BY-FIELD ANALYSIS");
  lines.push("—".repeat(44));
  for (const item of rankedHigh) {
    const f = item.field;
    const s = item.score;
    const label = FIELD_LABELS?.[f] ?? f;
    lines.push(`${label} — ${s.toFixed(1)}/100 — ${band(s)}`);
    lines.push(fieldDescription(f));
    lines.push(fieldInterpretation(f, s));
    lines.push("");
  }

  lines.push("SYNTHESIS");
  lines.push("—".repeat(44));
  const vals = Object.values(scores100);
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const spread = Math.max(...vals) - Math.min(...vals);
  lines.push(
    `Mean profile level (rough center of gravity): ${mean.toFixed(1)}/100. Spread across fields: ${spread.toFixed(
      1
    )} points. ` +
      "A wide spread suggests contextual strengths—lean into the highest fields while building one deliberate routine " +
      "in your lowest field. A tight profile suggests balanced scenario choices; refine with observation data and student co-analysis next."
  );
  lines.push(
    "Next step: pick one ‘growth edge’ field and one concrete practice (e.g., structured student questions, public revision, restorative follow-up), run it for two weeks, and compare this profile again—not to chase 100, but to document movement."
  );

  return lines.join("\n");
}

export async function POST(request) {
  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const responses = body?.responses && typeof body.responses === "object" ? body.responses : {};

  const rawMeans5 = computeRawMeans(responses);
  const scores100 = {};
  for (const f of FIELD_ORDER) scores100[f] = likertMeanTo100(rawMeans5[f]);

  const { rankedHigh, rankedLow } = rankFields(scores100);
  const report = buildAnalysisReport(scores100, rawMeans5);

  return Response.json(
    {
      scores_100: scores100,
      raw_means_5: rawMeans5,
      ranked_high: rankedHigh,
      ranked_low: rankedLow,
      report,
    },
    { headers: headers() }
  );
}

