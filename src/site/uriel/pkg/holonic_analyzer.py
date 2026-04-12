# -*- coding: utf-8 -*-
"""
Holonic text analysis: map input words to Tokens using English_Morphemes.csv
and Prompt_Instructions topic/order rules (~1–~6, first-letter fallback).

Reproducibility: for the same input string and the same morpheme/kinds CSV files,
``analyze_text`` is deterministic (SHA-256–based RNG seeds, not Python ``hash()``).
Share those files plus the text to reproduce a “world.” GUI features that are
explicitly dice-like (right-click kind rolls) still vary per use; the in-analysis
procedural names and facet bundles are deterministic from stable seeds.
"""
from __future__ import annotations

import csv
import math
import re
from dataclasses import dataclass, field
from pathlib import Path
from random import Random
from typing import Any, Iterator

from uriel.kinds_registry import DEFAULT_PICK_MODE, KindEntry, KindsChart
from uriel.prompt_taxonomy import (
    classify_nominal,
    detail_rng,
    order_display,
    order_icon,
    pick_entia,
    pick_order_for_topic,
    roll_tracker_year,
)
from uriel.name_generator import (
    generate_entity_name,
    generate_location_name,
    generate_object_name,
)
from uriel.stable_hash import stable_uint32

# --- Topic ids (Prompt_Instructions) ---
TOPIC_NAMES = {
    1: "Entity",
    2: "Location",
    3: "Object",
    4: "Helper",
    5: "Tracker",
    6: "Secret",
}

# First letter → topic when no morpheme match (Prompt_Instructions chart)
_FIRST_LETTER_TOPIC: dict[str, int] = {}
for ch in "eacfge":
    _FIRST_LETTER_TOPIC[ch] = 1
for ch in "lbhz":
    _FIRST_LETTER_TOPIC[ch] = 2
for ch in "omru":
    _FIRST_LETTER_TOPIC[ch] = 3
for ch in "ntvs":
    _FIRST_LETTER_TOPIC[ch] = 4
for ch in "jkwy":
    _FIRST_LETTER_TOPIC[ch] = 5
for ch in "dipqx":
    _FIRST_LETTER_TOPIC[ch] = 6

def _normalize_word(raw: str) -> str:
    return re.sub(r"[^a-z0-9]", "", raw.lower())


def topic_from_first_letter(letter: str) -> int:
    c = letter.lower()
    if not c or c not in _FIRST_LETTER_TOPIC:
        return 4  # Helper default
    return _FIRST_LETTER_TOPIC[c]


def _csv_top_to_topic(top_val: str) -> int:
    t = (top_val or "").strip()
    mapping = {
        "Entity": 1,
        "Location": 2,
        "Object": 3,
        "Helper": 4,
        "Tracker": 5,
        "Secret": 6,
    }
    return mapping.get(t, topic_from_first_letter(t[:1] if t else "h"))


@dataclass
class MorphemeRow:
    morpheme: str
    topic: int
    gloss: str
    frequency_tier: str
    major_group: str
    subgroup: str


@dataclass
class HolonToken:
    """A discrete holon (part-whole token) for one word occurrence."""

    surface: str
    normalized: str
    sentence_index: int
    word_index: int
    topic: int
    order: str
    kind_code: str
    kind_label: str
    kind_branch: str
    entia: str
    entia_name: str
    nominal: str
    nominal_class: str  # "proper" | "common" (Prompt: N reserved for proper names)
    order_name: str
    year_value: int | None  # Tracker Y only
    matched_morpheme: str | None
    morpheme_gloss: str
    topic_source: str  # "morpheme_csv" | "first_letter"
    # ~6:Q — Somebody / Wanted(goal) / Location (Prompt SWBS skeleton)
    quest_entity_ref: str = ""
    quest_location_ref: str = ""
    quest_goal_ref: str = ""
    # Same word repeated in one sentence → folded into one holon; extra detail roll.
    repeat_merged_total: int = 1
    merged_from_word_indices: tuple[int, ...] = ()
    # Deterministic procedural layer (same text + CSVs ⇒ same names/facets)
    world_name: str = ""
    facet_profile: str = ""  # Ability/Class/… or Biome/Hub/… or Material/Rarity/Utility

    def encoded_form(self) -> str:
        """~T:O;K,E.N — K Kind (DNDTT), E Entia, N Nominal (Prompt_Instructions)."""
        nom = self.nominal
        if self.year_value is not None:
            nom = f"{nom}|Y{self.year_value}"
        base = f"~{self.topic}:{self.order};{self.kind_code},{self.entia}.{nom}"
        if self.repeat_merged_total > 1:
            base = f"{base}|×{self.repeat_merged_total}"
        if self.world_name:
            safe = self.world_name.replace("|", "/").replace("\n", " ").strip()
            if len(safe) > 72:
                safe = safe[:69] + "..."
            base = f"{base}|W:{safe}"
        return base

    def label_line(self) -> str:
        name = TOPIC_NAMES.get(self.topic, "?")
        mm = self.matched_morpheme or "(no stem match)"
        br = f"  branch:{self.kind_branch}" if self.kind_branch else ""
        yr = f"  year:{self.year_value}" if self.year_value is not None else ""
        ent = f"  entia:{self.entia_name}" if self.entia_name else ""
        merge = ""
        if self.repeat_merged_total > 1:
            idx = self.merged_from_word_indices or ("?",)
            merge = f"  merged×{self.repeat_merged_total}@{idx}"
        warn = ""
        if self.topic == 4 and self.order == "N" and self.nominal_class == "common":
            warn = "  [warn: Name-order on common word]"
        qtri = ""
        if self.topic == 6 and self.order == "Q" and (
            self.quest_entity_ref or self.quest_location_ref or self.quest_goal_ref
        ):
            qtri = (
                f"  quest[E:{self.quest_entity_ref or '-'} "
                f"L:{self.quest_location_ref or '-'} "
                f"G:{self.quest_goal_ref or '-'}]"
            )
        ic = order_icon(self.topic, self.order)
        wn = f"  world:{self.world_name}" if self.world_name else ""
        fp = f"  facets:{self.facet_profile}" if self.facet_profile else ""
        return (
            f"{ic} {self.surface} -> {self.encoded_form()}  [{name}]  "
            f"{self.order_name}{ent}{yr}{merge}  kind:{self.kind_label}{br}{warn}{qtri}{wn}{fp}  root:{mm}"
        )


@dataclass
class SentenceHolons:
    sentence_index: int
    text: str
    tokens: list[HolonToken] = field(default_factory=list)


@dataclass
class AnalysisResult:
    sentences: list[SentenceHolons]
    tokens: list[HolonToken]
    morpheme_dictionary_size: int
    kinds_chart_size: int


class MorphemeDictionary:
    """Longest-prefix match against loaded morpheme strings."""

    def __init__(self, rows: list[MorphemeRow]):
        self._by_m: dict[str, MorphemeRow] = {}
        for r in rows:
            key = _normalize_word(r.morpheme)
            if not key or key in self._by_m:
                continue
            self._by_m[key] = r

    @classmethod
    def load_csv(cls, path: Path) -> MorphemeDictionary:
        rows: list[MorphemeRow] = []
        with path.open(encoding="utf-8", newline="") as f:
            reader = csv.DictReader(f)
            for raw in reader:
                morph_col = raw.get("morpheme") or raw.get("Morpheme") or ""
                morph = (morph_col or "").strip()
                if not morph or morph.startswith("(see column"):
                    continue
                tier = (raw.get("frequency_tier") or "").strip()
                if tier == "meta":
                    continue
                top = raw.get("top") or raw.get("category") or raw.get("Category") or ""
                topic = _csv_top_to_topic(top)
                rows.append(
                    MorphemeRow(
                        morpheme=morph,
                        topic=topic,
                        gloss=(raw.get("gloss_or_meaning") or "").strip(),
                        frequency_tier=tier,
                        major_group=(raw.get("major_group") or "").strip(),
                        subgroup=(raw.get("subgroup") or "").strip(),
                    )
                )
        return cls(rows)

    def longest_prefix_match(self, word_norm: str) -> tuple[str | None, MorphemeRow | None]:
        if not word_norm:
            return None, None
        for length in range(len(word_norm), 0, -1):
            prefix = word_norm[:length]
            if prefix in self._by_m:
                return prefix, self._by_m[prefix]
        return None, None

    def __len__(self) -> int:
        return len(self._by_m)


def _detail_rng_for_word(
    normalized: str,
    sentence_index: int,
    word_index: int,
    repeat_stack: int,
) -> Random:
    """Stronger / distinct detail layer when the same lemma is stacked in one sentence."""
    norm = normalized or ""
    if repeat_stack <= 1:
        return detail_rng(norm, sentence_index, word_index)
    h = stable_uint32(norm, sentence_index, word_index, repeat_stack, "repeat_stack")
    return Random(h)


def analyze_word(
    surface: str,
    sentence_index: int,
    word_index: int,
    dictionary: MorphemeDictionary,
    kinds: KindsChart | None,
    kind_pick_mode: str = DEFAULT_PICK_MODE,
    *,
    repeat_stack: int = 1,
) -> HolonToken:
    norm = _normalize_word(surface)
    rng_detail = _detail_rng_for_word(norm or "", sentence_index, word_index, repeat_stack)
    matched, row = dictionary.longest_prefix_match(norm)
    if row is not None:
        topic = row.topic
        topic_source = "morpheme_csv"
        gloss = row.gloss
    else:
        topic = topic_from_first_letter((norm or surface)[:1])
        topic_source = "first_letter"
        gloss = ""
    order = pick_order_for_topic(topic, rng_detail)
    oname = order_display(topic, order)
    if kinds is not None:
        k: KindEntry = kinds.pick(
            topic,
            order,
            rng_detail,
            mode=kind_pick_mode,
            normalized_word=norm,
        )
        kind_code = k.kind_code
        kind_label = k.kind_label
        kind_branch = k.branch
    else:
        kind_code = "0"
        kind_label = "Uncharted"
        kind_branch = ""
    entia, entia_name = pick_entia(rng_detail)
    nominal, nominal_class = classify_nominal(surface.strip() or norm or "?")
    year_value: int | None = None
    if topic == 5 and order == "Y":
        year_value = roll_tracker_year(rng_detail)
    return HolonToken(
        surface=surface,
        normalized=norm,
        sentence_index=sentence_index,
        word_index=word_index,
        topic=topic,
        order=order,
        kind_code=kind_code,
        kind_label=kind_label,
        kind_branch=kind_branch,
        entia=entia,
        entia_name=entia_name,
        nominal=nominal,
        nominal_class=nominal_class,
        order_name=oname,
        year_value=year_value,
        matched_morpheme=matched,
        morpheme_gloss=gloss,
        topic_source=topic_source,
        repeat_merged_total=repeat_stack,
        merged_from_word_indices=(word_index,) if repeat_stack <= 1 else (),
    )


def split_sentences(text: str) -> list[str]:
    text = text.strip()
    if not text:
        return []
    parts = re.split(r"(?<=[.!?])\s+|\n+", text)
    return [p.strip() for p in parts if p.strip()]


def tokenize_sentence(sentence: str) -> list[str]:
    return re.findall(r"[A-Za-z0-9]+(?:'[A-Za-z]+)?", sentence)


def collapse_sentence_tokens(
    words: list[str],
    sentence_index: int,
    dictionary: MorphemeDictionary,
    kinds: KindsChart | None,
    kind_pick_mode: str,
    min_merge_len: int = 4,
) -> list[HolonToken]:
    """
    Fold repeated content words (same normalized form) in one sentence into a single holon.

    Short words (length < ``min_merge_len``) stay separate so articles/prepositions do not merge.
    Stacked lemmas get a fresh detail RNG (see ``_detail_rng_for_word``) so kinds read richer.
    """
    n_words = len(words)
    if n_words == 0:
        return []
    consumed = [False] * n_words
    out: list[HolonToken] = []
    wi = 0
    while wi < n_words:
        if consumed[wi]:
            wi += 1
            continue
        norm = _normalize_word(words[wi])
        if len(norm) < min_merge_len:
            out.append(
                analyze_word(
                    words[wi],
                    sentence_index,
                    wi,
                    dictionary,
                    kinds,
                    kind_pick_mode=kind_pick_mode,
                )
            )
            consumed[wi] = True
            wi += 1
            continue
        same = [
            j
            for j in range(n_words)
            if not consumed[j] and _normalize_word(words[j]) == norm
        ]
        if len(same) > 1:
            first = same[0]
            tok = analyze_word(
                words[first],
                sentence_index,
                first,
                dictionary,
                kinds,
                kind_pick_mode=kind_pick_mode,
                repeat_stack=len(same),
            )
            tok.merged_from_word_indices = tuple(same)
            out.append(tok)
            for j in same:
                consumed[j] = True
        else:
            out.append(
                analyze_word(
                    words[wi],
                    sentence_index,
                    wi,
                    dictionary,
                    kinds,
                    kind_pick_mode=kind_pick_mode,
                )
            )
            consumed[wi] = True
        wi += 1
    return out


def analyze_text(
    text: str,
    dictionary: MorphemeDictionary,
    kinds: KindsChart | None = None,
    kind_pick_mode: str = DEFAULT_PICK_MODE,
) -> AnalysisResult:
    """
    Tokenize and analyze ``text``. Identical ``text`` + dictionaries ⇒ identical tokens
    (stable RNG seeds); changing ``English_Morphemes.csv`` or ``kinds_chart.csv`` changes results.
    """
    sentences: list[SentenceHolons] = []
    flat: list[HolonToken] = []
    for si, sent in enumerate(split_sentences(text)):
        words = tokenize_sentence(sent)
        sh = SentenceHolons(sentence_index=si, text=sent)
        sh.tokens = collapse_sentence_tokens(
            words, si, dictionary, kinds, kind_pick_mode=kind_pick_mode
        )
        flat.extend(sh.tokens)
        sentences.append(sh)
    result = AnalysisResult(
        sentences=sentences,
        tokens=flat,
        morpheme_dictionary_size=len(dictionary),
        kinds_chart_size=len(kinds) if kinds is not None else 0,
    )
    enrich_quest_swbs(result)
    enrich_world_names_and_facets(result, kinds, kind_pick_mode=kind_pick_mode)
    return result


def enrich_world_names_and_facets(
    result: AnalysisResult,
    kinds: KindsChart | None,
    *,
    kind_pick_mode: str = DEFAULT_PICK_MODE,
) -> None:
    """
    Attach procedural names and multi-order facet picks for Entity / Location / Object.

    Names use uriel.name_generator with RNG seeded from stable_uint32 (not wall-clock time).
    Facets pull ~1:A/C/F/G, ~2:B/H/Z, ~3:M/R/U from the kinds chart independently of the
    token's primary order roll.
    """
    ver = "uriel_v2_world_layer"
    for tok in result.tokens:
        norm = tok.normalized or ""
        si, wi = tok.sentence_index, tok.word_index
        if tok.topic == 1:
            name_rng = Random(stable_uint32(norm, si, wi, "world_name", ver))
            if kinds is not None:
                e_ent = kinds.pick(
                    1,
                    "E",
                    Random(stable_uint32(norm, si, wi, "pick_E_name", ver)),
                    mode=kind_pick_mode,
                    normalized_word=norm,
                )
                e_label = e_ent.kind_label
            else:
                e_label = "Human-Basic"
            tok.world_name = generate_entity_name(name_rng, e_label)
            if kinds is not None:
                parts: list[str] = []
                for order, tag in (
                    ("A", "Ability"),
                    ("C", "Class"),
                    ("F", "Flaw"),
                    ("G", "Goal"),
                ):
                    r = Random(stable_uint32(norm, si, wi, "facet", order, ver))
                    ent = kinds.pick(
                        1, order, r, mode=kind_pick_mode, normalized_word=norm
                    )
                    parts.append(f"{tag}:{ent.kind_label}")
                tok.facet_profile = "  ".join(parts)
        elif tok.topic == 2:
            name_rng = Random(stable_uint32(norm, si, wi, "world_name", ver))
            loc_name, _tag = generate_location_name(
                name_rng, material_plane_bias=0.88
            )
            tok.world_name = loc_name
            if kinds is not None:
                parts = []
                for order, tag in (
                    ("B", "Biome"),
                    ("H", "Hub"),
                    ("Z", "Zone"),
                ):
                    r = Random(stable_uint32(norm, si, wi, "facet", order, ver))
                    ent = kinds.pick(
                        2, order, r, mode=kind_pick_mode, normalized_word=norm
                    )
                    parts.append(f"{tag}:{ent.kind_label}")
                tok.facet_profile = "  ".join(parts)
        elif tok.topic == 3:
            name_rng = Random(stable_uint32(norm, si, wi, "world_name", ver))
            tok.world_name = generate_object_name(name_rng)
            if kinds is not None:
                parts = []
                for order, tag in (
                    ("M", "Material"),
                    ("R", "Rarity"),
                    ("U", "Utility"),
                ):
                    r = Random(stable_uint32(norm, si, wi, "facet", order, ver))
                    ent = kinds.pick(
                        3, order, r, mode=kind_pick_mode, normalized_word=norm
                    )
                    parts.append(f"{tag}:{ent.kind_label}")
                tok.facet_profile = "  ".join(parts)


def enrich_quest_swbs(result: AnalysisResult) -> None:
    """
    For Secret ~6:Q tokens, bind SWBS-style hooks to Entity (~1), Location (~2),
    and Goal (~1:G) tokens when present (sentence first, then whole text).
    """

    def tid(t: HolonToken) -> str:
        return f"T{t.sentence_index}_{t.word_index}"

    for tok in result.tokens:
        if tok.topic != 6 or tok.order != "Q":
            continue
        sh = result.sentences[tok.sentence_index]
        entity: HolonToken | None = None
        location: HolonToken | None = None
        goal: HolonToken | None = None
        for t in sh.tokens:
            if t is tok:
                continue
            if entity is None and t.topic == 1:
                entity = t
            if location is None and t.topic == 2:
                location = t
            if goal is None and t.topic == 1 and t.order == "G":
                goal = t
        if entity is None:
            for t in result.tokens:
                if t.topic == 1:
                    entity = t
                    break
        if location is None:
            for t in result.tokens:
                if t.topic == 2:
                    location = t
                    break
        if goal is None:
            for t in result.tokens:
                if t.topic == 1 and t.order == "G":
                    goal = t
                    break
        tok.quest_entity_ref = tid(entity) if entity else ""
        tok.quest_location_ref = tid(location) if location else ""
        tok.quest_goal_ref = tid(goal) if goal else ""


def iter_quest_edges(result: AnalysisResult) -> Iterator[tuple[str, str, str]]:
    """Light edges from Quest tokens to resolved SWBS node ids (if any)."""
    for tok in result.tokens:
        if tok.topic != 6 or tok.order != "Q":
            continue
        qid = f"T{tok.sentence_index}_{tok.word_index}"
        if tok.quest_entity_ref:
            yield qid, tok.quest_entity_ref, "quest_entity"
        if tok.quest_location_ref:
            yield qid, tok.quest_location_ref, "quest_location"
        if tok.quest_goal_ref:
            yield qid, tok.quest_goal_ref, "quest_goal"


def iter_graph_edges(result: AnalysisResult) -> Iterator[tuple[str, str, str]]:
    """
    Yields (source_id, target_id, edge_kind).
    Sentence hubs connect to each token; tokens chain in word order.
    """
    for sh in result.sentences:
        sid = f"S{sh.sentence_index}"
        prev: str | None = None
        for tok in sh.tokens:
            tid = f"T{tok.sentence_index}_{tok.word_index}"
            yield sid, tid, "in_sentence"
            if prev is not None:
                yield prev, tid, "sequence"
            prev = tid


def iter_discourse_edges(result: AnalysisResult) -> Iterator[tuple[str, str, str]]:
    """Link consecutive sentence hubs (narrative flow across the text)."""
    n = len(result.sentences)
    for i in range(n - 1):
        yield f"S{i}", f"S{i + 1}", "discourse"


def iter_semantic_edges(result: AnalysisResult) -> Iterator[tuple[str, str, str]]:
    """
    Prompt_Instructions role edges (skeleton):
    - Info ~6:I bridges toward the next sentence hub.
    - Power ~6:P links to the sentence hub (reinforces intra-sentence tree).
    - Quest ~6:Q points at the first token of the next sentence (quest hook).
    - Secret ~6:X spans to the first token two sentences ahead (long jump).
    """
    n_sent = len(result.sentences)
    for tok in result.tokens:
        tid = f"T{tok.sentence_index}_{tok.word_index}"
        if tok.topic == 6 and tok.order == "I":
            nxt = tok.sentence_index + 1
            if nxt < n_sent:
                yield tid, f"S{nxt}", "info_bridge"
        elif tok.topic == 6 and tok.order == "P":
            yield tid, f"S{tok.sentence_index}", "power_link"
        elif tok.topic == 6 and tok.order == "Q":
            nxt = tok.sentence_index + 1
            if nxt < n_sent and result.sentences[nxt].tokens:
                t0 = result.sentences[nxt].tokens[0]
                yield tid, f"T{t0.sentence_index}_{t0.word_index}", "quest_hint"
        elif tok.topic == 6 and tok.order == "X":
            tgt = tok.sentence_index + 2
            if tgt < n_sent and result.sentences[tgt].tokens:
                t0 = result.sentences[tgt].tokens[0]
                yield tid, f"T{t0.sentence_index}_{t0.word_index}", "secret_span"


def iter_repeat_edges(
    result: AnalysisResult,
    min_normalized_len: int = 4,
) -> Iterator[tuple[str, str, str]]:
    """
    Chain consecutive occurrences of the same word shape (normalized) so
    repeated content words link across sentences without exploding on 'the'.
    """
    buckets: dict[str, list[HolonToken]] = {}
    for tok in result.tokens:
        n = tok.normalized
        if len(n) < min_normalized_len:
            continue
        buckets.setdefault(n, []).append(tok)
    for toks in buckets.values():
        if len(toks) < 2:
            continue
        toks.sort(key=lambda t: (t.sentence_index, t.word_index))
        for i in range(len(toks) - 1):
            a = f"T{toks[i].sentence_index}_{toks[i].word_index}"
            b = f"T{toks[i + 1].sentence_index}_{toks[i + 1].word_index}"
            yield a, b, "repeat"


def iter_lexeme_rich_edges(
    result: AnalysisResult,
    min_normalized_len: int = 4,
) -> Iterator[tuple[str, str, str]]:
    """
    Alternate routes along the same surface lemma (skip-one chords + long arc), so the map
    gains loops and branching paths beyond the sequential ``repeat`` chain.
    """
    buckets: dict[str, list[HolonToken]] = {}
    for tok in result.tokens:
        n = tok.normalized
        if len(n) < min_normalized_len:
            continue
        buckets.setdefault(n, []).append(tok)
    for toks in buckets.values():
        toks.sort(key=lambda t: (t.sentence_index, t.word_index))
        n = len(toks)
        if n < 3:
            continue
        for i in range(n - 2):
            yield (
                f"T{toks[i].sentence_index}_{toks[i].word_index}",
                f"T{toks[i + 2].sentence_index}_{toks[i + 2].word_index}",
                "lexeme_skip",
            )
        if n >= 4:
            yield (
                f"T{toks[0].sentence_index}_{toks[0].word_index}",
                f"T{toks[-1].sentence_index}_{toks[-1].word_index}",
                "lexeme_arc",
            )


def _min_token_ring_radius(ntok: int, min_chord: float) -> float:
    """
    Minimum hub–token distance so adjacent word nodes (tall labels) do not overlap:
    chord = 2 r sin(π / n) >= min_chord  =>  r >= min_chord / (2 sin(π/n)).

    ``min_chord`` must reflect real GUI size: multi-line HTML labels are often 160–220px wide
    and 180–260px tall; use a conservative center-to-center gap.
    """
    if ntok <= 1:
        return 240.0
    return max(200.0, min_chord / (2.0 * math.sin(math.pi / float(ntok))))


def _scale_positions_about_center(
    pos: dict[str, tuple[float, float]], scale: float
) -> dict[str, tuple[float, float]]:
    """Uniform scale about the layout centroid (spreads clusters without changing topology)."""
    if not pos or scale <= 0:
        return pos
    xs = [p[0] for p in pos.values()]
    ys = [p[1] for p in pos.values()]
    cx = 0.5 * (min(xs) + max(xs))
    cy = 0.5 * (min(ys) + max(ys))
    out: dict[str, tuple[float, float]] = {}
    for k, (x, y) in pos.items():
        out[k] = (cx + (x - cx) * scale, cy + (y - cy) * scale)
    return out


def layout_cluster_positions(result: AnalysisResult) -> dict[str, tuple[float, float]]:
    """
    Organic layout (Obsidian-graph style): sentence hubs follow a phyllotaxis spiral
    (sunflower / dendritic arms); word tokens sit on a full ring around their hub
    with slight deterministic wobble so clusters feel tendril-like, not gridded.

    Ring radii enforce minimum chord length between neighbors so multi-line nodes
    rarely overlap at the default zoom; spiral scale keeps sentence clusters apart.
    """
    pos: dict[str, tuple[float, float]] = {}
    n_sent = len(result.sentences)
    if n_sent == 0:
        return pos

    # Vogel / golden-angle phyllotaxis — cluster centers spiral outward smoothly.
    golden_angle = math.pi * (3.0 - math.sqrt(5.0))
    # Sentence hubs must sit far apart so outer token rings do not collide with neighbors.
    cluster_scale = 295.0

    # Minimum center-to-center gap between adjacent tokens on the same ring (scene px).
    # Token groups use tall QGraphicsTextItem labels; match ~2× typical half-extent.
    min_token_chord = 268.0

    for sh in result.sentences:
        si = sh.sentence_index
        r_hub = cluster_scale * math.sqrt(float(si))
        theta_hub = si * golden_angle
        cx = r_hub * math.cos(theta_hub)
        cy = r_hub * math.sin(theta_hub)

        sid = f"S{si}"
        pos[sid] = (cx, cy)

        toks = sh.tokens
        ntok = len(toks)
        if ntok == 0:
            continue

        # Base ring radius from word count, then enforce geometry so tokens do not stack.
        r_tok = 255.0 + 42.0 * math.sqrt(ntok) + min(240.0, 13.0 * ntok)
        r_tok = max(r_tok, _min_token_ring_radius(ntok, min_token_chord))
        # Margin past hub center so the hub ellipse does not sit under token labels.
        r_tok += 110.0

        # Rotate each sentence's ring so neighboring sentences don't line up visually.
        base_phase = (si * 0.847 + ntok * 0.31 + theta_hub * 0.42) % (2.0 * math.pi)

        # Keep wobble small — large angular jitter pulls neighbors together on the ring.
        wobble_scale = max(0.18, 1.0 - 0.055 * float(ntok))
        # Irrational offsets make rings read as branching circular trees (not regular polygons).
        golden_frac = 0.618033988749895

        for j, tok in enumerate(toks):
            band = j % 3
            branch_turn = (j * golden_frac) % 1.0
            frac = (j + branch_turn) / max(ntok, 1)
            ang = base_phase + 2.0 * math.pi * frac
            ang += wobble_scale * (
                0.07 * math.sin(si * 1.97 + j * 2.31)
                + 0.05 * math.cos(j * 1.73 - si * 0.71)
                + 0.04 * math.sin(2.0 * math.pi * band / 3.0 + j * 0.91)
            )
            ang += 0.11 * math.sin(math.pi * frac * 3.0 + si * 0.37)
            r_scale = 1.0 + 0.085 * float(band) + 0.038 * math.sin(j * 2.399) + 0.018 * float(j % 5)
            r_j = r_tok * r_scale * (1.0 + 0.038 * wobble_scale * math.sin(si * 2.3 + j * 1.17))
            px = cx + r_j * math.cos(ang)
            py = cy + r_j * math.sin(ang)
            tid = f"T{tok.sentence_index}_{tok.word_index}"
            pos[tid] = (px, py)

    # Spread entire graph uniformly (reduces cluster-cluster crowding after phyllotaxis).
    pos = _scale_positions_about_center(pos, 1.42)

    # Normalize into the positive quadrant with margin (stable scene rect for the view).
    pad = 380.0
    xs = [p[0] for p in pos.values()]
    ys = [p[1] for p in pos.values()]
    ox = pad - min(xs)
    oy = pad - min(ys)
    return {k: (v[0] + ox, v[1] + oy) for k, v in pos.items()}


def default_csv_path() -> Path:
    return Path(__file__).resolve().parent / "English_Morphemes.csv"


# --- Graph export (desktop + browser / JSON) ---------------------------------

GRAPH_EDGE_PRIORITY: dict[str, int] = {
    "in_sentence": 100,
    "sequence": 95,
    "discourse": 85,
    "repeat": 70,
    "power_link": 65,
    "quest_hint": 60,
    "quest_entity": 58,
    "quest_location": 58,
    "quest_goal": 58,
    "info_bridge": 55,
    "secret_span": 50,
    "lexeme_skip": 35,
    "lexeme_arc": 32,
}


def dedupe_graph_edges(
    edges: list[tuple[str, str, str]],
) -> list[tuple[str, str, str]]:
    """Keep one edge per undirected pair; prefer stronger link kinds (same rule as the GUI)."""
    best: dict[tuple[str, str], tuple[str, str, str]] = {}
    for u, v, k in edges:
        a, b = (u, v) if u < v else (v, u)
        key = (a, b)
        pk = GRAPH_EDGE_PRIORITY.get(k, 20)
        old_k = best[key][2] if key in best else ""
        if key not in best or pk > GRAPH_EDGE_PRIORITY.get(old_k, -1):
            best[key] = (a, b, k)
    return list(best.values())


def collect_all_graph_edges(result: AnalysisResult) -> list[tuple[str, str, str]]:
    """All edge iterators used by the holon graph view (dedupe before drawing)."""
    raw: list[tuple[str, str, str]] = []
    raw.extend(iter_graph_edges(result))
    raw.extend(iter_discourse_edges(result))
    raw.extend(iter_repeat_edges(result))
    raw.extend(iter_lexeme_rich_edges(result))
    raw.extend(iter_semantic_edges(result))
    raw.extend(iter_quest_edges(result))
    return raw


def analysis_to_graph_payload(result: AnalysisResult) -> dict[str, Any]:
    """
    JSON-serializable graph for web clients (positions + deduped edges).
    """
    pos = layout_cluster_positions(result)
    edges = dedupe_graph_edges(collect_all_graph_edges(result))
    nodes: list[dict[str, Any]] = []
    for sh in result.sentences:
        sid = f"S{sh.sentence_index}"
        x, y = pos.get(sid, (0.0, 0.0))
        nodes.append(
            {
                "id": sid,
                "kind": "sentence",
                "label": f"S{sh.sentence_index + 1}",
                "n_tokens": len(sh.tokens),
                "x": round(x, 2),
                "y": round(y, 2),
            }
        )
    for tok in result.tokens:
        tid = f"T{tok.sentence_index}_{tok.word_index}"
        x, y = pos.get(tid, (0.0, 0.0))
        wn = (getattr(tok, "world_name", None) or "").strip()
        sub = wn or (tok.surface or "")[:48]
        nodes.append(
            {
                "id": tid,
                "kind": "token",
                "topic": tok.topic,
                "topic_name": TOPIC_NAMES.get(tok.topic, "?"),
                "surface": tok.surface,
                "label": sub,
                "order": tok.order,
                "kind_label": tok.kind_label,
                "x": round(x, 2),
                "y": round(y, 2),
            }
        )
    edge_objs = [
        {"source": u, "target": v, "kind": k} for u, v, k in edges if u in pos and v in pos
    ]
    xs = [p[0] for p in pos.values()] or [0.0]
    ys = [p[1] for p in pos.values()] or [0.0]
    return {
        "nodes": nodes,
        "edges": edge_objs,
        "bounds": {
            "minX": min(xs),
            "maxX": max(xs),
            "minY": min(ys),
            "maxY": max(ys),
        },
    }
