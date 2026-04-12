# -*- coding: utf-8 -*-
"""
Tabletop-ready prose from holon tokens.

Prep outline follows ideas widely shared in the hobby (e.g. Mike Shea / Sly Flourish’s
“Lazy DM” style: strong start, potential scenes, secrets & clues, fantastic locations,
NPCs, treasure)—implemented here as algorithmic templates, not official book text.

Concatenation: bucket by story role, filter function words for *narrative* output, then
assemble setting → cast → props → (DM) color, pressure, twists.
"""

from __future__ import annotations

import re

from holonic_analyzer import (
    TOPIC_NAMES,
    AnalysisResult,
    HolonToken,
    SentenceHolons,
    topic_from_first_letter,
)

# Words that rarely carry story weight when tokenized alone (reduces “The” as NPC).
NARRATIVE_STOP_WORDS: frozenset[str] = frozenset(
    """
    a an the and or but if as at by for from in into of on onto over under to toward
    with without about after before above below between through during per via
    is are was were be been being am
    do does did done have has had having
    will would could should shall may might must can
    it its this that these those there here
    i you he she we they them their his her our your my me him us ours yours
    who whom which what whose where why how when
    not no nor yes so than then too very just only also
    each every both few more most other some such same
    than then once
    """.split()
)

# Extra glue / participle / junk stems that morpheme tagging often mislabels as places or props.
# Used only for *display* ranking (does not change technical tokenization).
PROSE_WEAK_WORDS: frozenset[str] = frozenset(
    """
    beginning considering whether suddenly nothing once twice very well own
    getting got gotten peeped thought reading sitting made make makes
    worth picking making these those use used using
    could would should might must shall can
    close closely mind minds pleasure pleasures trouble troubles stupid sleepy
    get got getting feel felt feeling
    """.split()
)


def _norm_surface(tok: HolonToken) -> str:
    return re.sub(r"[^a-z0-9]", "", (tok.surface or "").lower())


def is_narrative_token(tok: HolonToken) -> bool:
    """True if this token is worth naming in player/DM story prose (not a function word)."""
    n = _norm_surface(tok)
    if len(n) < 2:
        return False
    if n in NARRATIVE_STOP_WORDS:
        return False
    if n in PROSE_WEAK_WORDS:
        return False
    return True


def narrative_tokens(tokens: list[HolonToken]) -> list[HolonToken]:
    """Filter to content words for summaries (grammar words stay in technical tab)."""
    return [t for t in tokens if is_narrative_token(t)]


def _prose_value(tok: HolonToken) -> float:
    """
    Higher = more worth spotlighting in DM/player prose. Down-ranks mis-tagged glue words
    so prep notes stay skimmable at the table.
    """
    n = _norm_surface(tok)
    if not n:
        return -999.0
    score = 0.0
    if tok.nominal_class == "proper":
        score += 18.0
    score += min(float(len(n)), 14.0) * 0.55
    if tok.repeat_merged_total > 1:
        score += 4.0 + 0.6 * float(tok.repeat_merged_total)
    if n in PROSE_WEAK_WORDS:
        score -= 35.0
    if n in NARRATIVE_STOP_WORDS:
        score -= 40.0
    # Prefer people, places, things over stray helper/tracker noise in outline text
    if tok.topic in (1, 2, 3):
        score += 5.0
    if tok.topic == 6:
        score += 2.5
    return score


def rank_tokens_for_prose(tokens: list[HolonToken], *, limit: int) -> list[HolonToken]:
    """Keep document order but only the top-``limit`` tokens by ``_prose_value``."""
    if limit <= 0 or len(tokens) <= limit:
        return list(tokens)
    ranked = sorted(tokens, key=lambda t: (_prose_value(t), len(t.normalized)), reverse=True)
    keep = {(t.sentence_index, t.word_index) for t in ranked[:limit]}
    return [t for t in tokens if (t.sentence_index, t.word_index) in keep]


# Sentence-initial words that are capitalized but not character names.
_FALSE_PROPER_NAMES: frozenset[str] = frozenset(
    """
    so it but and or as if then there this that these those yes no ok the a an
    """.split()
)


def _player_kind_flavor(tok: HolonToken) -> str:
    """Vague in-world phrasing—no raw chart jargon on player paper."""
    k = (tok.kind_label or "").strip().lower()
    surf = _norm_surface(tok)
    if "deity" in k or "god" in k or "paladin" in k or "oath" in k or "cult" in k:
        return "tale tied to faith or vows"
    if "cave" in k or "temple" in k or "grassland" in k or "biome" in k or "climate" in k or "taiga" in k:
        return "a spot people argue about"
    if "slum" in k or "urban" in k or "district" in k or "dungeon" in k or "vault" in k:
        return "whispered place"
    if "lockpick" in k or "rare" in k or "legendary" in k or "mundane" in k or "gold price" in k or "copper" in k:
        return "something people claim exists"
    if "heirloom" in k or "recover" in k or "druid" in k:
        return "a figure in gossip"
    if "rabbit" in k or "beast" in k or surf == "rabbit":
        return "creature story"
    if "antidote" in k or "dragon" in k or "scale" in k or "reliquary" in k:
        return "odd prize or relic gossip"
    if tok.nominal_class == "proper":
        return "name people whisper"
    if tok.topic == 1:
        return "folk tale figure"
    if tok.topic == 2:
        return "place rumor"
    if tok.topic == 3:
        return "object gossip"
    return "old rumor"


def _dm_kind_short(kind: str) -> str:
    """Shorten very long chart labels in prose blocks."""
    k = _kind_pretty(kind)
    if len(k) <= 42:
        return k
    return k[:39].rstrip() + "…"


def _kind_pretty(kind_label: str) -> str:
    return (kind_label or "").replace("_", " ").strip() or "unknown motif"


def _word_label(tok: HolonToken) -> str:
    wn = (getattr(tok, "world_name", None) or "").strip()
    if wn and tok.topic in (1, 2, 3):
        return wn
    s = (tok.surface or "").strip()
    if tok.nominal_class == "proper" and s:
        return s
    return s.lower() if s else "this beat"


# --- Single-token lines (gameplay voice) -------------------------------------


def dm_tooltip_line(tok: HolonToken) -> str:
    k = _dm_kind_short(tok.kind_label)
    w = _word_label(tok)
    fp = (getattr(tok, "facet_profile", None) or "").strip()
    facet = f" [{fp}]" if fp and tok.topic in (1, 2, 3) else ""
    if tok.topic == 1:
        return f"{w}: NPC or faction beat—{k}.{facet} Use as ally, rival, or wildcard."
    if tok.topic == 2:
        return f"{w}: a place—{k}.{facet} Set encounters, travel, or discovery here."
    if tok.topic == 3:
        return f"{w}: a thing in the world—{k}.{facet} Loot, clue, or hazard."
    if tok.topic == 4:
        return f"{w}: a moment of talk or action—{k}. Banter, rumor, or small magic."
    if tok.topic == 5:
        yr = f" (era {tok.year_value})" if tok.year_value is not None else ""
        return f"{w}: background pressure—{k}{yr}. Clocks, law, or spreading trouble."
    if tok.topic == 6:
        return f"{w}: DM-only spice—{k}. Hook, twist, or hidden link."
    return f"{w}: {k}."


def dm_complete_token_block(tok: HolonToken) -> str:
    return dm_tooltip_line(tok) + "\n"


def retranslate_sentence_prose(sh: SentenceHolons) -> str:
    return grammatical_scene_summary(sh.tokens, dm=True, compact=True)


def lock_doctrine_paragraph(surface: str) -> str:
    letters = [c for c in surface.upper() if c.isalpha()]
    if not letters:
        return ""
    bits: list[str] = []
    for c in letters:
        t = topic_from_first_letter(c.lower())
        bits.append(f"{c} suggests a {TOPIC_NAMES.get(t, 'beat').lower()} thread")
    return "Wordplay hook: " + "; ".join(bits) + "."


# --- Buckets & clauses --------------------------------------------------------


def _bucket_tokens(tokens: list[HolonToken]) -> tuple[
    list[HolonToken],
    list[HolonToken],
    list[HolonToken],
    list[HolonToken],
    list[HolonToken],
    list[HolonToken],
]:
    locs, ents, objs, helps, trks, secs = [], [], [], [], [], []
    for t in tokens:
        if t.topic == 2:
            locs.append(t)
        elif t.topic == 1:
            ents.append(t)
        elif t.topic == 3:
            objs.append(t)
        elif t.topic == 4:
            helps.append(t)
        elif t.topic == 5:
            trks.append(t)
        elif t.topic == 6:
            secs.append(t)
    return locs, ents, objs, helps, trks, secs


def _capitalize_first(s: str) -> str:
    s = s.strip()
    if not s:
        return s
    for i, ch in enumerate(s):
        if ch.isalpha():
            return s[:i] + ch.upper() + s[i + 1 :]
    return s


def _display_phrase(t: HolonToken, sentence_tokens: list[HolonToken]) -> str:
    """
    Label for quotes in prep lines: procedural world name when present;
    otherwise merge adjacent Title-case proper nouns (e.g. White + Rabbit).
    """
    wn = (getattr(t, "world_name", None) or "").strip()
    if wn and t.topic in (1, 2, 3):
        return wn
    idx = next((i for i, x in enumerate(sentence_tokens) if x is t), -1)
    if idx < 0:
        return _word_label(t)
    if idx > 0:
        tp = sentence_tokens[idx - 1]
        if (
            tp.nominal_class == "proper"
            and t.nominal_class == "proper"
            and tp.word_index + 1 == t.word_index
        ):
            a, b = tp.surface.strip(), t.surface.strip()
            if a[:1].isupper() and b[:1].isupper():
                return f"{a} {b}"
    if idx + 1 < len(sentence_tokens):
        t1 = sentence_tokens[idx + 1]
        if (
            t.nominal_class == "proper"
            and t1.nominal_class == "proper"
            and t.word_index + 1 == t1.word_index
            and len((t.surface or "").strip()) > 0
            and len((t1.surface or "").strip()) > 0
        ):
            a, b = t.surface.strip(), t1.surface.strip()
            if a[:1].isupper() and b[:1].isupper():
                return f"{a} {b}"
    return _word_label(t)


def _skip_proper_second_half(t: HolonToken, sentence_tokens: list[HolonToken]) -> bool:
    """True if this token is the second half of an adjacent proper pair (skip duplicate line)."""
    idx = next((i for i, x in enumerate(sentence_tokens) if x is t), -1)
    if idx <= 0:
        return False
    tp = sentence_tokens[idx - 1]
    return (
        tp.nominal_class == "proper"
        and t.nominal_class == "proper"
        and tp.word_index + 1 == t.word_index
        and (tp.surface or "")[:1].isupper()
        and (t.surface or "")[:1].isupper()
    )


def _take_in_reading_order(
    sentence_tokens: list[HolonToken],
    bucket: list[HolonToken],
    max_n: int,
) -> list[HolonToken]:
    """First ``max_n`` bucket members in spoken order (story flow, not score order)."""
    if max_n <= 0:
        return []
    want = {(x.sentence_index, x.word_index) for x in bucket}
    out: list[HolonToken] = []
    for t in sentence_tokens:
        if (t.sentence_index, t.word_index) not in want:
            continue
        if _skip_proper_second_half(t, sentence_tokens):
            continue
        out.append(t)
        if len(out) >= max_n:
            break
    return out


def _facet_compact(tok: HolonToken) -> str:
    """Human-readable facet bundle for one line (topics 1–3)."""
    fp = (getattr(tok, "facet_profile", None) or "").strip()
    if not fp:
        return ""
    parts = [x.strip() for x in fp.split("  ") if x.strip()]
    bits: list[str] = []
    for p in parts:
        if ":" in p:
            a, b = p.split(":", 1)
            bits.append(f"{a.strip()}: {_kind_pretty(b)}")
    return "; ".join(bits)


def _line_location(
    t: HolonToken, soft: bool, sentence_tokens: list[HolonToken]
) -> str:
    k = _dm_kind_short(t.kind_label)
    w = _display_phrase(t, sentence_tokens)
    fc = _facet_compact(t)
    if soft:
        if fc:
            return f'Travelers’ tales name “{w}” ({fc}); rumor paints it as {k}.'
        return f'Travelers mention “{w}” ({k}).'
    if fc:
        return f'The site “{w}” reads in your chart as {k}. ({fc})'
    return f'The site “{w}” reads in your chart as {k}.'


def _line_entity(
    t: HolonToken, soft: bool, sentence_tokens: list[HolonToken]
) -> str:
    k = _dm_kind_short(t.kind_label)
    w = _display_phrase(t, sentence_tokens)
    fc = _facet_compact(t)
    if soft:
        if fc:
            return f'Gossip tags “{w}” ({fc}); people guess {k}.'
        return f'Stories name “{w}” ({k}).'
    if fc:
        return f'Treat “{w}” as {k}. ({fc})'
    return f'Treat “{w}” as {k}: NPC, faction, or patron—bring them in when it fits.'


def _line_object(
    t: HolonToken, soft: bool, sentence_tokens: list[HolonToken]
) -> str:
    k = _dm_kind_short(t.kind_label)
    w = _display_phrase(t, sentence_tokens)
    fc = _facet_compact(t)
    if soft:
        if fc:
            return f'People swap rumors about “{w}” ({fc}); whispers call it {k}.'
        return f'Rumors attach to “{w}” ({k}).'
    if fc:
        return f'“{w}” can show up as {k}: prop, MacGuffin, or complication. ({fc})'
    return f'“{w}” can show up as {k}: prop, MacGuffin, or complication you prefer.'


def _line_helper(t: HolonToken, sentence_tokens: list[HolonToken]) -> str:
    k = _dm_kind_short(t.kind_label)
    w = _display_phrase(t, sentence_tokens)
    return f'Optional beat: “{w}” ({k}).'


def _line_tracker(t: HolonToken, sentence_tokens: list[HolonToken]) -> str:
    k = _dm_kind_short(t.kind_label)
    w = _display_phrase(t, sentence_tokens)
    yr = f"; era {t.year_value}" if t.year_value is not None else ""
    return f'Background pressure: “{w}” ({k}{yr}).'


def _line_secret(t: HolonToken, sentence_tokens: list[HolonToken]) -> str:
    k = _dm_kind_short(t.kind_label)
    w = _display_phrase(t, sentence_tokens)
    extra = ""
    if t.topic == 6 and t.order == "Q" and (
        t.quest_entity_ref or t.quest_location_ref or t.quest_goal_ref
    ):
        extra = " When you run it, tie a want, a place, and a figure."
    return f'Hidden hook: “{w}” ({k}).{extra}'


def build_scene_prep_lines(
    tokens: list[HolonToken],
    *,
    dm: bool,
    compact: bool = False,
    narrative_only: bool = True,
    prose_token_limit: int | None = None,
    max_color: int = 4,
    max_pressure: int = 3,
    max_twists: int = 5,
    max_where: int = 3,
    max_who: int = 4,
    max_what: int = 4,
) -> list[str]:
    """
    One fact per line; markdown-style section headers. Easier to scan than merged paragraphs.

    DM: **Where** / **Who** / **What** / **Color** / **Pressure** / **Twists (DM)**
    Player: softer labels, no twists/pressure (unless you later opt in).
    """
    work = narrative_tokens(tokens) if narrative_only else list(tokens)
    if not work:
        if tokens:
            return [
                "Most words here are glue—open with the spoken line, then lean on "
                "content words from the Technical tab."
            ]
        return ["Nothing to summarize in this sentence."]

    if prose_token_limit is None:
        if compact and dm:
            plim = 12
        elif dm:
            plim = 20
        else:
            plim = 11
    else:
        plim = prose_token_limit
    work = rank_tokens_for_prose(work, limit=max(plim, 8))

    locs, ents, objs, helps, trks, secs = _bucket_tokens(work)
    soft = not dm
    sentence_tokens = tokens

    locs_u = _take_in_reading_order(sentence_tokens, locs, max_where)
    ents_u = _take_in_reading_order(sentence_tokens, ents, max_who)
    objs_u = _take_in_reading_order(sentence_tokens, objs, max_what)

    lines: list[str] = []
    if locs_u:
        lines.append("**Where**" if dm else "**Places (hearsay)**")
        for t in locs_u:
            lines.append(f"• {_line_location(t, soft, sentence_tokens)}")
        lines.append("")

    if ents_u:
        lines.append("**Who**" if dm else "**People & figures**")
        for t in ents_u:
            lines.append(f"• {_line_entity(t, soft, sentence_tokens)}")
        lines.append("")

    if objs_u:
        lines.append("**What**" if dm else "**Things & oddments**")
        for t in objs_u:
            lines.append(f"• {_line_object(t, soft, sentence_tokens)}")
        lines.append("")

    if dm:
        helps_pool = [t for t in helps if is_narrative_token(t)]
        helps_u = _take_in_reading_order(sentence_tokens, helps_pool, max_color)
        if helps_u:
            lines.append("**Color**")
            for t in helps_u:
                lines.append(f"• {_line_helper(t, sentence_tokens)}")
            lines.append("")

        trks_pool = [t for t in trks if is_narrative_token(t)]
        trks_u = _take_in_reading_order(sentence_tokens, trks_pool, max_pressure)
        if trks_u:
            lines.append("**Pressure**")
            for t in trks_u:
                lines.append(f"• {_line_tracker(t, sentence_tokens)}")
            lines.append("")

        secs_pool = list(secs)
        secs_u = _take_in_reading_order(sentence_tokens, secs_pool, max_twists)
        if secs_u:
            lines.append("**Twists (DM)**")
            for t in secs_u:
                lines.append(f"• {_line_secret(t, sentence_tokens)}")
            lines.append("")

    if not lines and work:
        lines.append(
            "Background texture—pick one vivid word from the source line and give it teeth."
        )

    while lines and lines[-1] == "":
        lines.pop()
    return lines


def grammatical_scene_summary(
    tokens: list[HolonToken],
    *,
    dm: bool,
    compact: bool = False,
    narrative_only: bool = True,
    prose_token_limit: int | None = None,
    max_color: int = 4,
    max_pressure: int = 3,
    max_twists: int = 5,
    max_where: int = 3,
    max_who: int = 4,
    max_what: int = 4,
) -> str:
    """
    Scene prep as line-oriented markdown (one bullet per hook). If ``narrative_only``,
    glue words are dropped. See ``build_scene_prep_lines`` for structure.
    """
    lines = build_scene_prep_lines(
        tokens,
        dm=dm,
        compact=compact,
        narrative_only=narrative_only,
        prose_token_limit=prose_token_limit,
        max_color=max_color,
        max_pressure=max_pressure,
        max_twists=max_twists,
        max_where=max_where,
        max_who=max_who,
        max_what=max_what,
    )
    if not lines:
        return "Background texture—steal a word from the source line and give it teeth."
    return "\n".join(lines).strip()


# --- Lazy-DM-style blocks (strong start, scenes, secrets, locations, NPCs, loot) --


def _scene_title(sh: SentenceHolons) -> str:
    """Short label: prefer capitalized words (names), then first content words."""
    raw = (sh.text or "").strip()
    words = re.findall(r"[A-Za-z]+", raw)
    _title_skip = frozenset(
        {"so", "the", "it", "but", "and", "or", "as", "if", "then", "there", "this", "that"}
    )
    proper_like = [
        w
        for w in words
        if len(w) > 1
        and w[:1].isupper()
        and w[1:].islower()
        and w.lower() not in _title_skip
    ]
    if proper_like:
        seen_w: set[str] = set()
        deduped: list[str] = []
        for w in proper_like:
            wl = w.lower()
            if wl in seen_w:
                continue
            seen_w.add(wl)
            deduped.append(w)
        t = " ".join(deduped[:4])
        return t[0].upper() + t[1:] if len(t) > 1 else t.upper()
    grab = [w for w in words if w.lower() not in NARRATIVE_STOP_WORDS][:5]
    if grab:
        t = " ".join(grab)
        return t[0].upper() + t[1:] if len(t) > 1 else t.upper()
    return raw[:48] + ("…" if len(raw) > 48 else "")


def _strong_start_priority(t: HolonToken) -> float:
    """Prefer named characters, places, and props over stray chart noise."""
    p = _prose_value(t)
    if t.nominal_class == "proper":
        # Objects at sentence start are often common nouns capitalized—“Rabbit” should not beat “Alice”.
        if t.topic == 3:
            p += 38.0
        else:
            p += 72.0
    if t.topic == 1:
        p += 28.0
    elif t.topic == 2:
        p += 24.0
    elif t.topic == 3:
        p += 20.0
    elif t.topic == 6:
        p += 14.0
    return p


def _strong_start(result: AnalysisResult) -> str:
    """Legacy single string (tooltips). Prefer ``_strong_start_lines`` for prep output."""
    return "\n".join(_strong_start_lines(result))


def _strong_start_lines(result: AnalysisResult) -> list[str]:
    """One or two short lines—easy to read at the table."""
    if not result.sentences:
        return [
            "Open in medias res: threat, arrival, deadline, or discovery—then ask what the PCs do."
        ]
    pool: list[HolonToken] = []
    for sh in result.sentences:
        pool.extend(narrative_tokens(sh.tokens))
    txt = (result.sentences[0].text or "").strip()
    if pool:
        s0 = narrative_tokens(result.sentences[0].tokens)
        focus = s0 if s0 else pool
        pick = max(focus, key=_strong_start_priority)
        ctx = result.sentences[pick.sentence_index].tokens
        w, k = _display_phrase(pick, ctx), _dm_kind_short(pick.kind_label)
        if pick.topic == 2:
            return [
                f"Open on action or tension at “{w}” ({k}).",
                "Think interruption, demand, or omen—not a recap.",
            ]
        if pick.topic == 1:
            return [
                f"Open on “{w}” ({k}) doing something that demands a response.",
                "Offer, insult, plea, or accusation all work.",
            ]
        if pick.topic == 3:
            return [
                f"Open on “{w}” ({k}) changing hands or meaning.",
                "Theft, gift, or reveal—pick what fits.",
            ]
        if pick.topic == 6:
            return [
                f"Open on a beat tied to “{w}” ({k}).",
                "Drop the hook, then cut to what PCs actually see.",
            ]
        return [
            f"Open mid-beat around “{w}” ({k}).",
            "Something changes before anyone summarizes.",
        ]
    if txt:
        clip = txt[:140] + ("…" if len(txt) > 140 else "")
        return [
            f"Turn the first line into an event, not exposition: “{clip}”",
            "What happens in the first six seconds?",
        ]
    return ["Open with something happening—tables engage faster than a summary."]


def _adventure_possibilities(result: AnalysisResult) -> list[str]:
    """
    Cross-text hooks (high-signal tokens). Surfaces emergent threads from the holon layer
    without requiring the DM to decode the technical tab first.
    """
    flat: list[HolonToken] = []
    for sh in result.sentences:
        for t in narrative_tokens(sh.tokens):
            if _skip_proper_second_half(t, sh.tokens):
                continue
            flat.append(t)
    if not flat:
        return [
            "• No sharp hooks yet—pick one noun from the source and give it a face or a cost."
        ]
    flat.sort(key=_prose_value, reverse=True)
    seen: set[tuple[int, int]] = set()
    lines: list[str] = []
    for t in flat:
        key = (t.sentence_index, t.word_index)
        if key in seen:
            continue
        seen.add(key)
        sh = result.sentences[t.sentence_index]
        phrase = _display_phrase(t, sh.tokens)
        k = _dm_kind_short(t.kind_label)
        if t.topic == 2:
            lines.append(
                f"• Setting: “{phrase}” ({k})—stage travel, weather, politics, or a chase."
            )
        elif t.topic == 1:
            lines.append(
                f"• Face: “{phrase}” ({k})—ally, rival, patron, or complication."
            )
        elif t.topic == 3:
            lines.append(
                f"• Prop: “{phrase}” ({k})—prize, hazard, MacGuffin, or clue."
            )
        elif t.topic == 6:
            lines.append(
                f"• Secret / twist: “{phrase}” ({k})—reveal when the table earns it."
            )
        elif t.topic == 4:
            lines.append(
                f"• Scene flavor: “{phrase}” ({k})—banter, skill beat, or small wonder."
            )
        elif t.topic == 5:
            yr = f", year {t.year_value}" if t.year_value is not None else ""
            lines.append(
                f"• Clock / pressure: “{phrase}” ({k}{yr})—show consequences in the background."
            )
        else:
            lines.append(f"• Beat: “{phrase}” ({k}).")
        if len(lines) >= 8:
            break
    return lines


def _secrets_and_clues_lines(result: AnalysisResult, limit: int = 10) -> list[str]:
    """
    Step 4 style: short, abstract facts—no fixed discovery method (table decides later).
    Pulls from Secret, Info, Quest, Power, Tracker, Helper—ranked so prep stays skimmable.
    Uses ``_display_phrase`` so adjacent proper names (e.g. White Rabbit) read as one hook.
    """
    candidates: list[HolonToken] = []
    for t in result.tokens:
        if t.topic not in (4, 5, 6):
            continue
        if not is_narrative_token(t):
            continue
        if _prose_value(t) < -18.0:
            continue
        ctx = result.sentences[t.sentence_index].tokens
        if _skip_proper_second_half(t, ctx):
            continue
        candidates.append(t)
    candidates.sort(
        key=lambda t: (t.topic == 6, t.topic == 5, t.topic == 4, _prose_value(t)),
        reverse=True,
    )

    lines: list[str] = []
    seen_keys: set[tuple[str, str, str]] = set()
    for t in candidates:
        ctx = result.sentences[t.sentence_index].tokens
        w, k = _display_phrase(t, ctx), _dm_kind_short(t.kind_label)
        dedupe_k = (w, k, t.order)
        if dedupe_k in seen_keys:
            continue
        seen_keys.add(dedupe_k)
        if t.topic == 4:
            lines.append(f"Rumor ties “{w}” to {k}—surface it in banter or a check.")
        elif t.topic == 5:
            yr = f", era {t.year_value}" if t.year_value is not None else ""
            lines.append(f"Background pressure: “{w}” ({k}{yr}). Show consequences, not exposition.")
        elif t.topic == 6:
            if t.order == "Q":
                lines.append(
                    f"Quest beat in “{w}” ({k})—later, frame somebody / wanted / but / so."
                )
            elif t.order in ("I", "X"):
                lines.append(f"Revealable truth: “{w}” ({k})—clue, confession, or carving.")
            elif t.order == "P":
                lines.append(f"Power angle: “{w}” ({k})—who gains if this surfaces?")
            else:
                lines.append(f"DM spice: “{w}” ({k})—earn the reveal.")
        if len(lines) >= limit:
            break
    return lines


def _fantastic_location_line(t: HolonToken) -> str:
    w, k = _word_label(t), _dm_kind_short(t.kind_label)
    fc = _facet_compact(t)
    tail = f" ({fc})" if fc else ""
    return f"“{w}” — {k}.{tail} Add one sensory detail when you spotlight it."


def _npc_line(t: HolonToken) -> str:
    w, k = _word_label(t), _dm_kind_short(t.kind_label)
    fc = _facet_compact(t)
    tail = f" {fc}." if fc else ""
    return f"“{w}” — {k}.{tail} Give them a want, a block, or a test."


def _treasure_line(t: HolonToken) -> str:
    w, k = _word_label(t), _dm_kind_short(t.kind_label)
    fc = _facet_compact(t)
    tail = f" ({fc})" if fc else ""
    return f"“{w}” — {k}.{tail} Loot, bribe, curse, or key—match table tier."


def format_technical_token_log(result: AnalysisResult) -> str:
    lines: list[str] = []
    for sh in result.sentences:
        lines.append(f"--- Sentence {sh.sentence_index + 1} ---")
        lines.append(sh.text)
        lines.append("")
        for t in sh.tokens:
            lines.append(t.label_line())
            lines.append(f"    {t.encoded_form()}")
            if getattr(t, "world_name", ""):
                lines.append(f"    procedural_name: {t.world_name}")
            if getattr(t, "facet_profile", ""):
                lines.append(f"    facet_bundle: {t.facet_profile}")
            lines.append(
                f"    order:{t.order_name}  entia:{t.entia_name}  nominal_class:{t.nominal_class}"
            )
            if t.morpheme_gloss:
                lines.append(f"    gloss: {t.morpheme_gloss[:120]}")
            if t.topic == 6 and t.order == "Q" and (
                t.quest_entity_ref or t.quest_location_ref or t.quest_goal_ref
            ):
                lines.append(
                    f"    quest SWBS -> E:{t.quest_entity_ref or '-'} "
                    f"L:{t.quest_location_ref or '-'} G:{t.quest_goal_ref or '-'}"
                )
        lines.append("")
    return "\n".join(lines).rstrip()


def format_dm_campaign_notes(result: AnalysisResult) -> str:
    """
    DM prep: one hook per line, markdown section labels inside each scene block.
    Order: strong start → adventure threads → scenes → secrets → at-a-glance lists → detail pass.
    """
    lines: list[str] = []
    lines.append("DM prep (table-ready)")
    lines.append("─" * 52)
    lines.append("")
    lines.append(
        "Skim top to bottom. Each bullet is one idea. Skip anything that does not help tonight."
    )
    lines.append(
        "Secrets below are facts you *can* reveal—decide in play how the PCs learn them."
    )
    lines.append("")

    lines.append("1 · Strong start")
    lines.append("─" * 40)
    for s in _strong_start_lines(result):
        lines.append(f"• {s}")
    lines.append("")

    lines.append("2 · Adventure possibilities (cross-text)")
    lines.append("─" * 40)
    lines.extend(_adventure_possibilities(result))
    lines.append("")

    lines.append("3 · Scenes (one block per sentence)")
    lines.append("─" * 40)
    if not result.sentences:
        lines.append("• (Add source text to generate scenes.)")
        lines.append("")
    for sh in result.sentences:
        if not sh.tokens:
            continue
        title = _scene_title(sh)
        nt = narrative_tokens(sh.tokens)
        block = build_scene_prep_lines(
            sh.tokens,
            dm=True,
            compact=True,
            narrative_only=bool(nt),
            prose_token_limit=11 if not nt else 10,
            max_color=3 if nt else 2,
            max_pressure=2,
            max_twists=4 if nt else 3,
            max_where=2 if nt else 2,
            max_who=3 if nt else 2,
            max_what=3 if nt else 2,
        )
        lines.append(f"• Scene {sh.sentence_index + 1} — {title}")
        lines.append("")
        lines.extend(block)
        lines.append("")
    lines.append("")

    clue_lines = _secrets_and_clues_lines(result, limit=12)
    lines.append("4 · Secrets & clues")
    lines.append("─" * 40)
    if clue_lines:
        for cl in clue_lines:
            lines.append(f"• {cl}")
    else:
        lines.append("• Invent two or three facts the PCs might care about—one line each.")
    lines.append("")

    locs = [t for t in result.tokens if t.topic == 2 and is_narrative_token(t)]
    if not locs:
        locs = [t for t in result.tokens if t.topic == 2]
    locs = sorted(locs, key=_prose_value, reverse=True)
    lines.append("5 · Locations (at a glance)")
    lines.append("─" * 40)
    if locs:
        for t in locs[:18]:
            lines.append(f"• {_fantastic_location_line(t)}")
    else:
        lines.append("• Name one vivid place when you need a backdrop.")
    lines.append("")

    ents = [t for t in result.tokens if t.topic == 1 and is_narrative_token(t)]
    if not ents:
        ents = [t for t in result.tokens if t.topic == 1]
    ents = sorted(ents, key=_prose_value, reverse=True)
    lines.append("6 · People & forces")
    lines.append("─" * 40)
    if ents:
        for t in ents[:18]:
            lines.append(f"• {_npc_line(t)}")
    else:
        lines.append("• Drop in a named face when the fiction needs one.")
    lines.append("")

    objs = [t for t in result.tokens if t.topic == 3 and is_narrative_token(t)]
    if not objs:
        objs = [t for t in result.tokens if t.topic == 3]
    objs = sorted(objs, key=_prose_value, reverse=True)
    lines.append("7 · Props & rewards")
    lines.append("─" * 40)
    if objs:
        for t in objs[:18]:
            lines.append(f"• {_treasure_line(t)}")
    else:
        lines.append("• Add one tangible reward or complication when pacing sags.")
    lines.append("")

    lines.append("8 · Sentence-by-sentence (full detail)")
    lines.append("─" * 40)
    for sh in result.sentences:
        lines.append("")
        lines.append(f"Source line: {sh.text}")
        lines.append("")
        detail = build_scene_prep_lines(
            sh.tokens,
            dm=True,
            compact=False,
            narrative_only=True,
            prose_token_limit=22,
            max_color=4,
            max_pressure=3,
            max_twists=5,
            max_where=3,
            max_who=4,
            max_what=4,
        )
        lines.extend(detail)
        lines.append("")
    lines.append("— End of prep —")
    return "\n".join(lines).rstrip()


def format_player_handout(result: AnalysisResult) -> str:
    """
    Player-facing: rumor voice, one hook per line. No DM twists or pressure.
    """
    lines: list[str] = []
    lines.append("Player handout — rumors & impressions")
    lines.append("─" * 52)
    lines.append("")
    lines.append("Incomplete gossip, spiced for mood. Your DM decides what is true.")
    lines.append("")

    lines.append("Whispers (one block per sentence)")
    lines.append("─" * 40)
    for sh in result.sentences:
        bucket = [t for t in sh.tokens if t.topic in (1, 2, 3)]
        if not bucket:
            continue
        nt_ok = narrative_tokens(bucket)
        title = _scene_title(sh)
        block = build_scene_prep_lines(
            bucket,
            dm=False,
            compact=True,
            narrative_only=bool(nt_ok),
            prose_token_limit=9,
            max_where=2,
            max_who=3,
            max_what=3,
            max_color=0,
            max_pressure=0,
            max_twists=0,
        )
        lines.append(f"• Scene — {title}")
        src = (sh.text or "").strip().replace("\n", " ")
        if len(src) > 200:
            src = src[:197] + "…"
        lines.append(f"Heard near: “{src}”")
        lines.append("")
        lines.extend(block)
        lines.append("")

    lines.append("Names you might overhear")
    lines.append("─" * 40)
    proper_named: list[HolonToken] = []
    seen_face: set[str] = set()
    for t in sorted(result.tokens, key=_prose_value, reverse=True):
        if t.nominal_class != "proper":
            continue
        n = _norm_surface(t)
        if len(n) < 2 or n in seen_face or n in _FALSE_PROPER_NAMES:
            continue
        seen_face.add(n)
        proper_named.append(t)
        if len(proper_named) >= 14:
            break
    ents = [t for t in result.tokens if t.topic == 1 and is_narrative_token(t)]
    if not ents:
        ents = [t for t in result.tokens if t.topic == 1]
    merged_faces: list[HolonToken] = []
    seen_m: set[str] = set()
    for t in proper_named + sorted(ents, key=_prose_value, reverse=True):
        n = _norm_surface(t)
        if n in seen_m:
            continue
        seen_m.add(n)
        merged_faces.append(t)
        if len(merged_faces) >= 14:
            break
    if merged_faces:
        for t in merged_faces:
            lines.append(f"• {_word_label(t)} — {_player_kind_flavor(t)}.")
    else:
        lines.append("• No names jumped out—let the table invent gossip.")
    lines.append("")

    lines.append("Places people mention")
    lines.append("─" * 40)
    locs = [t for t in result.tokens if t.topic == 2 and is_narrative_token(t)]
    if not locs:
        locs = [t for t in result.tokens if t.topic == 2]
    locs = sorted(locs, key=_prose_value, reverse=True)
    if locs:
        for t in locs[:12]:
            lines.append(f"• {_word_label(t)} — {_player_kind_flavor(t)}.")
    else:
        lines.append("• No place-rumor this pass—paint the map together.")
    lines.append("")

    lines.append("Oddments & prizes (gossip)")
    lines.append("─" * 40)
    objs = [t for t in result.tokens if t.topic == 3 and is_narrative_token(t)]
    if not objs:
        objs = [t for t in result.tokens if t.topic == 3]
    objs = sorted(objs, key=_prose_value, reverse=True)
    if objs:
        for t in objs[:12]:
            lines.append(f"• {_word_label(t)} — {_player_kind_flavor(t)}.")
    else:
        lines.append("• Nothing concrete—keep wonder in the air.")
    lines.append("")
    lines.append("— Handout ends —")
    return "\n".join(lines).rstrip()
