"""
Pedagogical Spectrum Assessment — 24 behavior-anchored prompts (1–5).

Each prompt is rated from 1 to 5. Items are assigned to one of six pedagogical spectrums.
Some items are reverse-scored so that **higher scores always mean more of the right-hand pole**
for that spectrum (100 = strongest alignment with that pole).

The spectrum **Traditional ↔ Process** applies especially to writing/composition instruction,
contrasting the **Current Traditional Paradigm** (product- and rule-focused, single-draft,
teacher-as-corrector) with the **process movement** (writing as recursive discovery; invention,
drafting, revision, response; teacher as coach—after Donald Murray and writing-process pedagogy).

We display results on a 1–100 scale for readability:
1 ↦ 1, 3 ↦ 50.5, 5 ↦ 100 (linear).
"""
from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


class Field(Enum):
    TEACHER_TO_STUDENT = "Teacher-Centered ↔ Student-Centered"
    TRADITIONAL_TO_PROCESS = "Current Traditional Paradigm ↔ Process pedagogy (writing)"
    BEHAVIORISM_TO_CONSTRUCTIVISM = "Behaviorism ↔ Constructivism"
    COGNITIVISM_TO_SOCIAL_CONSTRUCTIVISM = "Cognitivism ↔ Social Constructivism"
    DIRECT_TO_EXPERIENTIAL = "Direct Instruction ↔ Experiential Learning"
    CONSTRUCTIVISM_INDEX = "Constructivism (index)"


@dataclass(frozen=True)
class Question:
    id: int
    stem: str
    spectrum: Field
    reverse_scored: bool = False
    contributes_to_constructivism: bool = False


N_QUESTIONS = 24


def _validate_bank() -> None:
    assert len(QUESTIONS) == N_QUESTIONS
    ids = [q.id for q in QUESTIONS]
    assert sorted(ids) == list(range(1, N_QUESTIONS + 1))
    for q in QUESTIONS:
        assert isinstance(q.stem, str) and q.stem.strip()
        assert isinstance(q.spectrum, Field)


QUESTIONS: tuple[Question, ...] = (
    # 1–4 Teacher-Centered ↔ Student-Centered
    Question(
        1,
        "In a typical week, how often do students make meaningful choices about topic, process, or product "
        "(with clear success criteria)?",
        Field.TEACHER_TO_STUDENT,
        reverse_scored=False,
        contributes_to_constructivism=True,
    ),
    Question(
        2,
        "How often do you begin a lesson/unit by telling students exactly what to do step-by-step for most of the time?",
        Field.TEACHER_TO_STUDENT,
        reverse_scored=True,
        contributes_to_constructivism=False,
    ),
    Question(
        3,
        "When a student is stuck, how often do you ask a question that helps them generate the next step "
        "before you give the answer?",
        Field.TEACHER_TO_STUDENT,
        reverse_scored=False,
        contributes_to_constructivism=True,
    ),
    Question(
        4,
        "How often do you adjust pacing, groupings, or scaffolds based on quick evidence of learning (not just a plan)?",
        Field.TEACHER_TO_STUDENT,
        reverse_scored=False,
        contributes_to_constructivism=False,
    ),
    # 5–8 Current Traditional Paradigm ↔ Process pedagogy (composition); higher = process-oriented
    Question(
        5,
        "How often do students move through multiple drafts of a piece of writing, with meaningful revision between drafts?",
        Field.TRADITIONAL_TO_PROCESS,
        reverse_scored=False,
        contributes_to_constructivism=True,
    ),
    Question(
        6,
        "How often do you respond to drafts in progress (conference, comment, workshop) rather than only grading a final product?",
        Field.TRADITIONAL_TO_PROCESS,
        reverse_scored=False,
        contributes_to_constructivism=False,
    ),
    Question(
        7,
        "How often is a writing grade based mainly on a single submitted draft with little or no revision cycle?",
        Field.TRADITIONAL_TO_PROCESS,
        reverse_scored=True,
        contributes_to_constructivism=False,
    ),
    Question(
        8,
        "How often do students spend class time on invention, exploration, or discovery before a fixed form is required?",
        Field.TRADITIONAL_TO_PROCESS,
        reverse_scored=False,
        contributes_to_constructivism=True,
    ),
    # 9–12 Behaviorism ↔ Constructivism
    Question(
        9,
        "How often do students revise work based on feedback and submit a second (or third) version?",
        Field.BEHAVIORISM_TO_CONSTRUCTIVISM,
        reverse_scored=False,
        contributes_to_constructivism=True,
    ),
    Question(
        10,
        "How often do you treat mistakes as data (predict → test → explain → revise), not as something to avoid quickly?",
        Field.BEHAVIORISM_TO_CONSTRUCTIVISM,
        reverse_scored=False,
        contributes_to_constructivism=True,
    ),
    Question(
        11,
        "How often is “being correct on the first try” the main signal students receive that learning happened?",
        Field.BEHAVIORISM_TO_CONSTRUCTIVISM,
        reverse_scored=True,
        contributes_to_constructivism=False,
    ),
    Question(
        12,
        "How often do students build understanding by connecting new ideas to prior experiences or examples they bring in?",
        Field.BEHAVIORISM_TO_CONSTRUCTIVISM,
        reverse_scored=False,
        contributes_to_constructivism=True,
    ),
    # 13–16 Cognitivism ↔ Social Constructivism
    Question(
        13,
        "How often do you structure discussion so students respond to each other with evidence (not just to you)?",
        Field.COGNITIVISM_TO_SOCIAL_CONSTRUCTIVISM,
        reverse_scored=False,
        contributes_to_constructivism=True,
    ),
    Question(
        14,
        "How often do students use shared tools to co-construct meaning (e.g., shared notes, group models, joint solutions)?",
        Field.COGNITIVISM_TO_SOCIAL_CONSTRUCTIVISM,
        reverse_scored=False,
        contributes_to_constructivism=True,
    ),
    Question(
        15,
        "How often is most thinking done silently and individually, with limited peer interaction during learning?",
        Field.COGNITIVISM_TO_SOCIAL_CONSTRUCTIVISM,
        reverse_scored=True,
        contributes_to_constructivism=False,
    ),
    Question(
        16,
        "How often do students take roles that improve the quality of talk (summarizer, challenger, connector, evidence-checker)?",
        Field.COGNITIVISM_TO_SOCIAL_CONSTRUCTIVISM,
        reverse_scored=False,
        contributes_to_constructivism=False,
    ),
    # 17–20 Direct Instruction ↔ Experiential Learning
    Question(
        17,
        "How often do students learn through authentic tasks (real audience, real data, real constraints) rather than only practice sets?",
        Field.DIRECT_TO_EXPERIENTIAL,
        reverse_scored=False,
        contributes_to_constructivism=True,
    ),
    Question(
        18,
        "How often do you run “task first, mini-lesson after” so students notice patterns before you explain them?",
        Field.DIRECT_TO_EXPERIENTIAL,
        reverse_scored=False,
        contributes_to_constructivism=True,
    ),
    Question(
        19,
        "How often is most class time spent on teacher explanation/modeling while students mainly listen or copy notes?",
        Field.DIRECT_TO_EXPERIENTIAL,
        reverse_scored=True,
        contributes_to_constructivism=False,
    ),
    Question(
        20,
        "How often do students create a product or performance that requires applying learning in a new context?",
        Field.DIRECT_TO_EXPERIENTIAL,
        reverse_scored=False,
        contributes_to_constructivism=True,
    ),
    # 21–24 Constructivism index
    Question(
        21,
        "How often do students use a rubric or success criteria they helped clarify (even if you drafted it first)?",
        Field.CONSTRUCTIVISM_INDEX,
        reverse_scored=False,
        contributes_to_constructivism=True,
    ),
    Question(
        22,
        "How often do students generate questions that shape the lesson (what to investigate, what to test, what to read next)?",
        Field.CONSTRUCTIVISM_INDEX,
        reverse_scored=False,
        contributes_to_constructivism=True,
    ),
    Question(
        23,
        "How often do students do short metacognitive routines (plan → monitor → reflect) during or after learning?",
        Field.CONSTRUCTIVISM_INDEX,
        reverse_scored=False,
        contributes_to_constructivism=True,
    ),
    Question(
        24,
        "How often do students critique each other’s work using a protocol, then revise based on that critique?",
        Field.CONSTRUCTIVISM_INDEX,
        reverse_scored=False,
        contributes_to_constructivism=True,
    ),
)

_validate_bank()


SHORT_FIELD_LABELS: dict[Field, str] = {
    Field.TEACHER_TO_STUDENT: "Teacher → Student",
    Field.TRADITIONAL_TO_PROCESS: "Traditional → Process",
    Field.BEHAVIORISM_TO_CONSTRUCTIVISM: "Behaviorism → Constructivism",
    Field.COGNITIVISM_TO_SOCIAL_CONSTRUCTIVISM: "Cognitivism → Social",
    Field.DIRECT_TO_EXPERIENTIAL: "Direct → Experiential",
    Field.CONSTRUCTIVISM_INDEX: "Constructivism",
}

SPECTRUM_POLES: dict[Field, tuple[str, str]] = {
    Field.TEACHER_TO_STUDENT: ("Teacher-centered", "Student-centered"),
    Field.TRADITIONAL_TO_PROCESS: (
        "Current Traditional Paradigm",
        "Process pedagogy",
    ),
    Field.BEHAVIORISM_TO_CONSTRUCTIVISM: ("Behaviorism", "Constructivism"),
    Field.COGNITIVISM_TO_SOCIAL_CONSTRUCTIVISM: ("Cognitivism", "Social constructivism"),
    Field.DIRECT_TO_EXPERIENTIAL: ("Direct instruction", "Experiential learning"),
    Field.CONSTRUCTIVISM_INDEX: ("Less constructivist", "More constructivist"),
}


FIELD_DESCRIPTIONS: dict[Field, str] = {
        Field.TEACHER_TO_STUDENT: (
            "Where you tend to locate agency: 1 leans toward teacher-directed planning and delivery; "
            "100 leans toward student inquiry, differentiation, and shared sense-making."
        ),
        Field.TRADITIONAL_TO_PROCESS: (
            "Writing/composition stance: 1 leans toward the **Current Traditional Paradigm**—emphasis on finished "
            "product, single-draft assessment, prescribed forms, and error-focused response to student texts. "
            "100 leans toward **process pedagogy** (the composition ‘process movement’): recursive invention, drafting, "
            "and revision; response to works-in-progress; time for discovery; teacher as coach/responder rather than "
            "sole authority on a final draft (cf. Donald Murray, ‘Teach Writing as a Process, Not a Product’)."
        ),
        Field.BEHAVIORISM_TO_CONSTRUCTIVISM: (
            "How learning changes: 1 leans toward correct responses shaped by feedback/reinforcement; "
            "100 leans toward learners building understanding through experience, error, and reflection."
        ),
        Field.COGNITIVISM_TO_SOCIAL_CONSTRUCTIVISM: (
            "Where thinking develops: 1 leans toward individual cognition; 100 leans toward learning through "
            "peer interaction, discourse, and co-construction."
        ),
        Field.DIRECT_TO_EXPERIENTIAL: (
            "How time is used: 1 leans toward efficient explanations/modeling; 100 leans toward hands-on tasks, "
            "projects, and authentic application."
        ),
        Field.CONSTRUCTIVISM_INDEX: (
            "A sub-index from items keyed to constructivist practices in this bank (higher = more constructivist)."
        ),
}


INSTRUMENT_FRAMEWORK = (
    "Rate each prompt from **1** to **5** (higher = more frequent / more true for you in a typical week). "
    "Six spectrums are measured; **higher scores** align with student-centered, constructivist, social, experiential, "
    "and **process-oriented writing** pedagogy. The **Traditional ↔ Process** spectrum contrasts the **Current "
    "Traditional Paradigm** in composition (product-focused, single-draft) with **process pedagogy** (drafting, "
    "revision, invention, response to drafts). Results use a **1–100** display scale."
)
