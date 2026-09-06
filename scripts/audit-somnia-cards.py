#!/usr/bin/env python3
"""Audit Somnia card data against Somnia 12.pdf extract and verify Psyche deck."""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOMNIA = ROOT / "src" / "site" / "somnia"
DATA = SOMNIA / "data"
PDF_PATH = Path(r"C:\Users\phili\Downloads\Interdisciplinary Review\Somnia 12.pdf")
EXTRACT = ROOT / "scripts" / "somnia-12-pdf-extract.txt"

PSYCHE_DIST = {1: 5, 2: 4, 3: 3, 4: 2, 5: 1}
PSYCHE_SUITS = 3
PSYCHE_WILD = 6


def load_json(name):
    with open(DATA / f"{name}.json", encoding="utf-8") as f:
        return json.load(f)


def psyche_deck_count(config):
    dist = config.get("distribution", PSYCHE_DIST)
    suited = sum(int(copies) for copies in dist.values()) * len(config.get("suits", ["lucidity", "elasticity", "willpower"]))
    wild = config.get("wildCount", PSYCHE_WILD)
    return suited + wild, suited, wild


def mindstream_built_count(ms_data, dreambeasts, objects):
    """Mirror data.js MINDSTREAM_COMPOSITION: 70 per suit."""
    per_suit = 10 + 16 + 35 + 6 + 3  # dreambeasts, objects, events, power, draw-dream
    return per_suit * 3, per_suit


def expand_dreams(dreams):
    pool = []
    for d in dreams:
        if d.get("type") != "dream":
            continue
        for _ in range(d.get("copies", 1)):
            pool.append(d)
    return pool


def normalize_name(s):
    return re.sub(r"[^a-z0-9]+", "", s.lower())


def names_in_pdf(text, candidates):
    text_norm = normalize_name(text)
    found = []
    missing = []
    for item in candidates:
        name = item["name"]
        norm = normalize_name(name)
        if norm and norm in text_norm:
            found.append(item["id"])
        else:
            missing.append(item["id"])
    return found, missing


def main():
    report = []
    report.append("=== Somnia Card Audit ===")
    report.append(f"PDF: {PDF_PATH}")
    report.append(f"PDF exists: {PDF_PATH.exists()}")
    report.append(f"Extract: {EXTRACT}")

    psyche = load_json("psyche")
    total, suited, wild = psyche_deck_count(psyche)
    report.append("")
    report.append("--- Psyche Deck ---")
    report.append(f"  Suited cards: {suited} (expected 45)")
    report.append(f"  Wild cards:   {wild} (expected 6)")
    report.append(f"  Total:        {total} (expected 51)")
    psyche_ok = total == 51 and suited == 45 and wild == 6

    dreams = load_json("dreams")
    dreambeasts = load_json("dreambeasts")
    objects = load_json("objects")
    landscapes = load_json("landscapes")
    archetypes = load_json("archetypes")
    dreamers = load_json("dreamers")
    mindstream = load_json("mindstream")

    regular_dreams = expand_dreams(dreams)
    finals = [d for d in dreams if d.get("type") == "final"]
    bosses = [b for b in dreambeasts if b.get("boss")]
    non_boss_beasts = [b for b in dreambeasts if not b.get("boss")]
    visible_landscapes = [l for l in landscapes if not l.get("hidden")]

    ms_total, ms_per = mindstream_built_count(mindstream, dreambeasts, objects)
    ms_events = sum(len(mindstream[s]) for s in ["lucidity", "elasticity", "willpower"])

    report.append("")
    report.append("--- Deck counts (JSON / built) ---")
    report.append(f"  Dreams (regular pool):     {len(regular_dreams)} unique entries, {len(regular_dreams)} expanded")
    report.append(f"  Dreams (final recurrence): {len(finals)}")
    report.append(f"  Dreambeasts (all):         {len(dreambeasts)} ({len(bosses)} bosses)")
    report.append(f"  Dreambeast encounter deck: {len(non_boss_beasts)}")
    report.append(f"  Objects:                   {len(objects)}")
    report.append(f"  Landscapes (visible):      {len(visible_landscapes)}")
    report.append(f"  Archetypes:                {len(archetypes)}")
    report.append(f"  Dreamers:                  {len(dreamers)}")
    report.append(f"  Mindstream events (JSON):  {ms_events} ({ms_events // 3} per suit avg)")
    report.append(f"  Mindstream built decks:    3 × {ms_per} = {ms_total}")

    if EXTRACT.exists():
        text = EXTRACT.read_text(encoding="utf-8", errors="replace")
    elif PDF_PATH.exists():
        report.append("  (Re-run with pypdf extract to populate somnia-12-pdf-extract.txt)")
        text = ""
    else:
        text = ""

    if text:
        report.append("")
        report.append("--- PDF vs JSON name match ---")
        for label, items in [
            ("Dreambeasts", dreambeasts),
            ("Objects", objects),
            ("Landscapes", visible_landscapes),
            ("Dreams", [d for d in dreams if d.get("type") == "dream"]),
            ("Archetypes", archetypes),
        ]:
            found, missing = names_in_pdf(text, items)
            report.append(f"  {label}: {len(found)}/{len(items)} found in PDF")
            if missing:
                report.append(f"    Missing from PDF text: {', '.join(missing[:12])}")
                if len(missing) > 12:
                    report.append(f"    ... and {len(missing) - 12} more")

        ms_flat = []
        for suit in ["lucidity", "elasticity", "willpower"]:
            ms_flat.extend(mindstream.get(suit, []))
        found, missing = names_in_pdf(text, ms_flat)
        report.append(f"  Mindstream events: {len(found)}/{len(ms_flat)} found in PDF")
        if missing:
            report.append(f"    Missing: {', '.join(missing[:8])}")

    report.append("")
    report.append("--- Legacy checks ---")
    bad = []
    for p in (SOMNIA / "js").glob("*.js"):
        content = p.read_text(encoding="utf-8", errors="replace")
        if "maxValue: 6" in content or "copiesPerValue: 3" in content:
            bad.append(p.name)
    report.append(f"  maxValue:6 / copiesPerValue:3 in JS: {bad or 'none'}")

    psyche_json = (DATA / "psyche.json").read_text(encoding="utf-8")
    report.append(f"  psyche.json maxValue 6: {'maxValue' in psyche_json and '6' in psyche_json}")

    report.append("")
    report.append(f"RESULT: Psyche deck {'PASS' if psyche_ok else 'FAIL'}")
    out = "\n".join(report)
    print(out)
    out_path = ROOT / "scripts" / "somnia-card-audit-report.txt"
    out_path.write_text(out, encoding="utf-8")
    print(f"\nReport written to {out_path}")
    return 0 if psyche_ok else 1


if __name__ == "__main__":
    sys.exit(main())
