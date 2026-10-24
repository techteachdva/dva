"""
Narrative interpretation for Pedagogy Profile scores (aligned with goals.txt:
student-centered, constructivist, social, experiential, process-oriented writing pedagogy).
"""
from __future__ import annotations

from questions_data import FIELD_DESCRIPTIONS, N_QUESTIONS, SHORT_FIELD_LABELS, SPECTRUM_POLES, Field
from scoring import rank_fields


def _band(score: float) -> str:
    if score >= 88:
        return "Distinguished alignment"
    if score >= 75:
        return "Strong alignment"
    if score >= 62:
        return "Solid alignment"
    if score >= 48:
        return "Developing alignment"
    if score >= 35:
        return "Emerging alignment"
    return "Entry / high-growth zone"


def _lean_or_build(score: float) -> str:
    return "Lean into this asset" if score >= 62 else "Build this next"


def _actionable_insight(field: Field, score: float) -> str:
    """
    One concrete, directionally-anchored insight per spectrum.
    Higher scores always mean more of the right-hand pole (or more constructivist for the index).
    """
    low, high = SPECTRUM_POLES[field]
    intent = _lean_or_build(score)

    moves: dict[Field, tuple[str, ...]] = {
        Field.TEACHER_TO_STUDENT: (
            "Shift one decision to students: choice of topic, product, or method (keep success criteria constant).",
            "Use a 3-minute co-criteria routine: ‘What makes a strong answer/work sample?’ then post the class rubric.",
        ),
        Field.TRADITIONAL_TO_PROCESS: (
            "Add a minimum two-draft cycle: quick first draft → focused feedback → revision before a grade counts.",
            "Hold one in-class workshop: peers respond as readers to drafts-in-progress using a short protocol.",
        ),
        Field.BEHAVIORISM_TO_CONSTRUCTIVISM: (
            "Run a safe error/revision cycle: predict → test → explain → revise (collect 2 revisions, not 1 final).",
            "Use ‘My first idea / My revised idea’ exit tickets to normalize changing your mind with evidence.",
        ),
        Field.COGNITIVISM_TO_SOCIAL_CONSTRUCTIVISM: (
            "Structure talk so ideas change: assign roles (summarizer, challenger, connector) and require evidence-based replies.",
            "Use one discourse move daily: ‘I used to think…, now I think… because…’ (post stems).",
        ),
        Field.DIRECT_TO_EXPERIENTIAL: (
            "Convert one explanation into an experience: a short task first, then mini-lesson after students notice patterns.",
            "Add an ‘authentic constraint’: a real audience, real data, or real tool (even for 15 minutes).",
        ),
        Field.CONSTRUCTIVISM_INDEX: (
            "Build reflection into the lesson: 2 prompts—‘What did I try?’ and ‘What will I do differently next time?’",
            "Add peer critique with a protocol (glow/grow + one specific revision) and require a revision submission.",
        ),
    }

    direction = f"Toward **{high}**"
    primary = moves[field][0]
    secondary = moves[field][1] if len(moves[field]) > 1 else ""

    if score <= 48:
        pos = f"Currently leaning toward **{low}**."
    elif score < 62:
        pos = "Currently a **blend** of both poles."
    else:
        pos = f"Currently leaning toward **{high}**."

    out = f"{direction} — {intent}. {pos} Try next: {primary}"
    if secondary:
        out += f" Also try: {secondary}"
    return out


def _field_interpretation(field: Field, score: float) -> str:
    """Action-oriented interpretation for a pedagogical spectrum score (1–100)."""
    band = _band(score)
    low, high = SPECTRUM_POLES[field]

    if score <= 35:
        pos = f"Leans toward **{low}**."
    elif score <= 48:
        pos = f"Slight lean toward **{low}**."
    elif score < 62:
        pos = "Sits near the **middle** (mix of both)."
    elif score < 75:
        pos = f"Slight lean toward **{high}**."
    else:
        pos = f"Leans toward **{high}**."

    return f"{pos} Band: {band}. {_actionable_insight(field, score)}"


def _improvement_toward_100(field: Field, score: float) -> list[str]:
    """
    Varied, detailed suggestions keyed to each spectrum—oriented toward moving closer to 100
    (right-hand pole / constructivist index), without implying a single 'correct' personality.
    """
    low, high = SPECTRUM_POLES[field]
    # Stronger packs when further from 100
    tier = "strong" if score < 48 else "moderate" if score < 75 else "refine"

    packs: dict[Field, dict[str, list[str]]] = {
        Field.TEACHER_TO_STUDENT: {
            "strong": [
                f"Offer one bounded student choice per week (topic, method, or product) with a shared rubric—move agency toward **{high}**.",
                "Replace one ‘tell’ segment with a guided question sequence so students generate the next step.",
                "Use an exit ticket: ‘What decision did you make today about your learning?’",
            ],
            "moderate": [
                "Co-create success criteria for one upcoming task before students start.",
                "Try think–pair–share before you summarize so students own partial sense-making first.",
            ],
            "refine": [
                "Document one moment students led the agenda; note what you’d replicate next unit.",
                "Pair high student agency with tight feedback loops so clarity doesn’t drop.",
            ],
        },
        Field.TRADITIONAL_TO_PROCESS: {
            "strong": [
                "Adopt a **two-draft minimum** before summative grading on one writing task; separate ‘draft response’ from ‘final evaluation.’",
                "Spend one class period on **invention** (listing, freewriting, questioning) before locking a thesis or outline.",
                "Use **peer response** to drafts with a one-page protocol (what works / what confuses / one question)—not line edits on polish.",
                "Respond to drafts as a **reader** first (‘I’m confused here… I’m interested here…’) before judging correctness.",
            ],
            "moderate": [
                "Add one **writing conference** or audio comment pass on a draft before the final.",
                "Weight **process** (planning notes, revision log) for a small portion of the grade to signal revision matters.",
            ],
            "refine": [
                "Tighten revision goals: students pick one global revision focus per draft (structure, evidence, voice).",
                "Meta-prompt: ‘What did you discover while drafting that you couldn’t have planned?’",
            ],
        },
        Field.BEHAVIORISM_TO_CONSTRUCTIVISM: {
            "strong": [
                "Make one **low-stakes revision cycle** the norm: feedback → revise → resubmit with a brief reflection.",
                "Replace one ‘correct answer’ checkpoint with ‘best current explanation + what would change it.’",
            ],
            "moderate": [
                "Use error as data: display an anonymous sample and improve it as a class.",
            ],
            "refine": [
                "Ask students to tag **what changed** between versions; celebrate revision as learning.",
            ],
        },
        Field.COGNITIVISM_TO_SOCIAL_CONSTRUCTIVISM: {
            "strong": [
                "Assign **discussion roles** and require replies that cite peers’ ideas or text evidence.",
                "Use a **structured academic controversy** with sentence stems.",
            ],
            "moderate": [
                "Two-minute **turn-and-talk** before whole-class so every voice warms up.",
            ],
            "refine": [
                "Have groups produce **one shared artifact** (not four parallel essays).",
            ],
        },
        Field.DIRECT_TO_EXPERIENTIAL: {
            "strong": [
                "Flip one lesson: **short task** → debrief patterns → then mini-lesson.",
                "Embed one **real audience** (letter, podcast, exhibit) per unit.",
            ],
            "moderate": [
                "Use a **simulation or case** before defining terms.",
            ],
            "refine": [
                "Tighten **success criteria** for experiential tasks so discovery stays on standard.",
            ],
        },
        Field.CONSTRUCTIVISM_INDEX: {
            "strong": [
                "Co-construct a rubric row with students; try it on one assignment.",
                "Add **plan–monitor–reflect** in 3 minutes after a complex task.",
            ],
            "moderate": [
                "Use **peer critique protocol** + required revision.",
            ],
            "refine": [
                "Have students track **one strategy** they tried and its effect.",
            ],
        },
    }

    base = packs.get(field, {}).get(tier, [])
    if not base:
        base = packs.get(field, {}).get("moderate", [])
    # Always include a reminder when low
    if score < 62:
        base = [
            f"Priority: move from **{low}** toward **{high}** in small, repeatable steps (one routine per two weeks).",
            *base,
        ]
    return base[:4]


def build_analysis_report(scores: dict[Field, float], raw_totals: dict[Field, float] | None = None) -> str:
    ranked_high, ranked_low = rank_fields(scores)
    lines: list[str] = []

    lines.append("FRAMEWORK")
    lines.append("—" * 44)
    lines.append(
        f"This version has {N_QUESTIONS} prompts (1–5). Six spectrums; higher scores align with the **right-hand pole** "
        f"on each spectrum (and **process pedagogy** on the composition spectrum). **100** reflects strongest alignment "
        f"with that pole—not a mandate to be identical in every context. The radar uses 1–100 derived from mean ratings "
        f"(1 ↦ 1, 5 ↦ 100)."
    )
    lines.append("")
    lines.append(
        "COMPOSITION NOTE: **Current Traditional Paradigm** often emphasizes finished product, single-draft submission, "
        "and prescriptive forms; **process pedagogy** (in the tradition of Donald Murray and writing-process instruction) "
        "emphasizes invention, drafting, revision, and response to works-in-progress—writing as discovery and recursive work."
    )
    lines.append("")

    if raw_totals is not None:
        lines.append("RAW (mean Likert per spectrum, 1–5)")
        lines.append("—" * 44)
        for f, _ in ranked_high:
            v = raw_totals.get(f, 3.0)  # type: ignore[union-attr]
            try:
                lines.append(f"{SHORT_FIELD_LABELS[f]}: {float(v):.2f}/5")
            except Exception:
                lines.append(f"{SHORT_FIELD_LABELS[f]}: —")
        lines.append("")

    lines.append("ACTIONABLE INSIGHTS (one per spectrum)")
    lines.append("—" * 44)
    for f in (
        Field.TEACHER_TO_STUDENT,
        Field.TRADITIONAL_TO_PROCESS,
        Field.BEHAVIORISM_TO_CONSTRUCTIVISM,
        Field.COGNITIVISM_TO_SOCIAL_CONSTRUCTIVISM,
        Field.DIRECT_TO_EXPERIENTIAL,
        Field.CONSTRUCTIVISM_INDEX,
    ):
        s = scores.get(f, 50.5)
        lines.append(f"{f.value} ({s:.0f}/100): {_actionable_insight(f, float(s))}")
    lines.append("")

    lines.append("IMPROVEMENT MOVES (toward 100 on each spectrum)")
    lines.append("—" * 44)
    lines.append(
        "Use these as a menu—pick one or two practices per month. Each line aims toward the **right-hand pole** "
        "(or stronger constructivist practice on the index)."
    )
    lines.append("")
    for f in (
        Field.TEACHER_TO_STUDENT,
        Field.TRADITIONAL_TO_PROCESS,
        Field.BEHAVIORISM_TO_CONSTRUCTIVISM,
        Field.COGNITIVISM_TO_SOCIAL_CONSTRUCTIVISM,
        Field.DIRECT_TO_EXPERIENTIAL,
        Field.CONSTRUCTIVISM_INDEX,
    ):
        s = float(scores.get(f, 50.5))
        lines.append(f"{SHORT_FIELD_LABELS[f]} — {s:.0f}/100")
        for bullet in _improvement_toward_100(f, s):
            lines.append(f"  • {bullet}")
        lines.append("")

    lines.append("SNAPSHOT")
    lines.append("—" * 44)
    top = ", ".join(f"{SHORT_FIELD_LABELS[f]} ({s:.0f})" for f, s in ranked_high[:3])
    bottom = ", ".join(f"{SHORT_FIELD_LABELS[f]} ({s:.0f})" for f, s in ranked_low[:3])
    lines.append(f"Relative strengths (top signals): {top}.")
    lines.append(f"Relative growth edges (lowest signals): {bottom}.")
    lines.append(
        "Use ‘relative’ deliberately: all six fields interact; a low score often reflects tradeoffs in moments, not absence "
        "of care."
    )
    lines.append("")

    lines.append("FIELD-BY-FIELD ANALYSIS")
    lines.append("—" * 44)
    for f, s in ranked_high:
        lines.append(f"{f.value} — {s:.1f}/100 — {_band(s)}")
        lines.append(FIELD_DESCRIPTIONS[f])
        lines.append(_field_interpretation(f, s))
        lines.append("")

    lines.append("SYNTHESIS")
    lines.append("—" * 44)
    mean_score = sum(scores.values()) / len(scores)
    spread = max(scores.values()) - min(scores.values())
    lines.append(
        f"Mean profile level (rough center of gravity): {mean_score:.1f}/100. Spread across fields: {spread:.1f} points. "
        f"A wide spread suggests contextual strengths—lean into the highest fields while building one deliberate routine "
        f"in your lowest field. A tight profile suggests balanced scenario choices; refine with observation data and "
        f"student co-analysis next."
    )
    lines.append(
        "Next step: pick one growth-edge spectrum and one concrete practice from IMPROVEMENT MOVES; run it for two weeks, "
        "then retake the profile to document movement—not to chase 100 in every category at once."
    )

    return "\n".join(lines)
