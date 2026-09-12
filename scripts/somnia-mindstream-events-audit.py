#!/usr/bin/env python3
"""Audit Mindstream Event cards: data, images, handlers, PDF text."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOMNIA = ROOT / "src" / "site" / "somnia"
DATA = SOMNIA / "data"
IMAGES = SOMNIA / "images"
EXTRACT = ROOT / "scripts" / "somnia-12-pdf-extract.txt"
MINDSTREAM_JS = SOMNIA / "js" / "mindstream.js"
REPORT = ROOT / "scripts" / "somnia-mindstream-events-audit.json"
REPORT_TXT = ROOT / "scripts" / "somnia-mindstream-events-audit.txt"

EVENTS_PER_SUIT = 35


def norm(s):
    return re.sub(r"[^a-z0-9]+", "", (s or "").lower())


def load_events():
    ms = json.loads((DATA / "mindstream.json").read_text(encoding="utf-8"))
    events = []
    for suit in ("lucidity", "elasticity", "willpower"):
        for card in ms.get(suit, []):
            events.append({**card, "deckSuit": suit})
    return events


def load_handlers():
    text = MINDSTREAM_JS.read_text(encoding="utf-8")
    ids = set(re.findall(r'"([a-z0-9-]+)":\s*\(', text))
    return ids


def image_status(rel_path):
    if not rel_path:
        return {"exists": False, "bytes": 0, "note": "no image field"}
    full = SOMNIA / rel_path.replace("/", "\\") if "\\" not in rel_path else SOMNIA / rel_path
    if not full.exists():
        return {"exists": False, "bytes": 0, "note": "file missing"}
    size = full.stat().st_size
    note = "ok"
    if size < 10_000:
        note = "suspiciously small"
    return {"exists": True, "bytes": size, "note": note}


def pdf_text():
    if EXTRACT.exists():
        return EXTRACT.read_text(encoding="utf-8", errors="replace")
    return ""


def find_name_in_pdf(text, name):
    """Return snippet around normalized name match."""
    n = norm(name)
    if not n:
        return None
    # Try direct name
    pattern = re.compile(re.escape(name), re.IGNORECASE)
    m = pattern.search(text)
    if not m:
        # Fuzzy: collapse whitespace in PDF lines
        collapsed = re.sub(r"\s+", " ", text)
        pattern2 = re.compile(re.escape(re.sub(r"\s+", " ", name.strip())), re.IGNORECASE)
        m = pattern2.search(collapsed)
    if not m:
        return None
    start = max(0, m.start() - 20)
    end = min(len(text), m.end() + 280)
    return re.sub(r"\s+", " ", text[start:end]).strip()


def token_overlap(a, b):
    ta = set(re.findall(r"[a-z0-9]+", norm(a)))
    tb = set(re.findall(r"[a-z0-9]+", norm(b)))
    if not ta or not tb:
        return 0.0
    return len(ta & tb) / len(ta | tb)


def main():
    events = load_events()
    handlers = load_handlers()
    pdf = pdf_text()
    manifest = json.loads((DATA / "card-manifest.json").read_text(encoding="utf-8"))

    by_suit = {s: [] for s in ("lucidity", "elasticity", "willpower")}
    issues = []
    rows = []

    for ev in events:
        suit = ev["deckSuit"]
        by_suit[suit].append(ev)
        img = image_status(ev.get("image", ""))
        has_handler = ev["id"] in handlers
        pdf_snip = find_name_in_pdf(pdf, ev["name"]) if pdf else None
        pdf_match = pdf_snip is not None
        overlap = token_overlap(ev.get("text", ""), pdf_snip or "") if pdf_snip else 0.0

        row = {
            "id": ev["id"],
            "name": ev["name"],
            "suit": ev.get("suit"),
            "deckSuit": suit,
            "type": ev.get("type"),
            "text": ev.get("text"),
            "image": ev.get("image"),
            "imageOk": img["exists"] and img["note"] == "ok",
            "imageBytes": img["bytes"],
            "handler": has_handler,
            "pdfNameFound": pdf_match,
            "pdfSnippet": pdf_snip,
            "textOverlapWithPdf": round(overlap, 2),
        }
        rows.append(row)

        if ev.get("type") != "event":
            issues.append(f"{ev['id']}: type is {ev.get('type')}, expected event")
        if not ev.get("name"):
            issues.append(f"{ev['id']}: missing name")
        if ev.get("suit") != suit:
            issues.append(f"{ev['id']}: suit {ev.get('suit')} != deck suit {suit}")
        if not ev.get("text"):
            issues.append(f"{ev['id']}: missing effect text")
        if not img["exists"]:
            issues.append(f"{ev['id']}: image missing ({ev.get('image')})")
        elif img["note"] != "ok":
            issues.append(f"{ev['id']}: image {img['note']} ({img['bytes']} bytes)")
        if not has_handler:
            issues.append(f"{ev['id']}: no MINDSTREAM_EFFECTS handler")
        if pdf and not pdf_match:
            issues.append(f"{ev['id']}: name not found in PDF extract")
        elif pdf and overlap < 0.25:
            issues.append(f"{ev['id']}: effect text may differ from PDF (overlap {overlap:.0%})")

    missing_images = [r for r in rows if not r["imageOk"]]
    missing_handlers = [r for r in rows if not r["handler"]]
    low_pdf_overlap = [r for r in rows if r["pdfNameFound"] and r["textOverlapWithPdf"] < 0.35]

    # Events referenced in manifest?
    manifest_has_events = "events" in manifest or "mindstreamEvents" in manifest

    report = {
        "summary": {
            "uniqueEventsInJson": len(events),
            "perSuit": {s: len(by_suit[s]) for s in by_suit},
            "expectedUniquePerSuitForFullDeck": EVENTS_PER_SUIT,
            "builtDeckEventSlotsPerSuit": EVENTS_PER_SUIT,
            "note": "Deck builder cycles JSON events via pickPool to fill 35 slots per suit",
            "handlersInMindstreamJs": len(handlers),
            "imagesOk": sum(1 for r in rows if r["imageOk"]),
            "imagesMissingOrSmall": len(missing_images),
            "handlersMissing": len(missing_handlers),
            "pdfEffectLowOverlap": len(low_pdf_overlap),
            "cardManifestListsEvents": manifest_has_events,
            "dreamImageFolder": "images/dreams/ (36 files)",
            "eventImageFolder": "images/cards/mindstream/{suit}/ (not in card-manifest.json)",
        },
        "issues": issues,
        "lowPdfOverlap": [
            {"id": r["id"], "name": r["name"], "jsonText": r["text"], "pdfSnippet": r["pdfSnippet"], "overlap": r["textOverlapWithPdf"]}
            for r in sorted(low_pdf_overlap, key=lambda x: x["textOverlapWithPdf"])
        ],
        "events": rows,
    }

    REPORT.write_text(json.dumps(report, indent=2), encoding="utf-8")

    lines = []
    lines.append("=== Somnia Mindstream Event Card Audit ===")
    lines.append(f"Source: {DATA / 'mindstream.json'}")
    lines.append(f"PDF extract: {EXTRACT} ({'found' if pdf else 'missing'})")
    lines.append("")
    lines.append("--- Summary ---")
    for k, v in report["summary"].items():
        lines.append(f"  {k}: {v}")
    lines.append("")
    lines.append(f"--- Per-event ({len(rows)} unique) ---")
    lines.append(f"{'Suit':<12} {'Name':<28} {'Img':<5} {'Hdl':<4} {'PDF':<4} {'Ovlp':<5} Id")
    lines.append("-" * 95)
    for r in rows:
        lines.append(
            f"{r['deckSuit']:<12} {r['name'][:27]:<28} "
            f"{'Y' if r['imageOk'] else 'N':<5} "
            f"{'Y' if r['handler'] else 'N':<4} "
            f"{'Y' if r['pdfNameFound'] else 'N':<4} "
            f"{r['textOverlapWithPdf']:<5} {r['id']}"
        )
    lines.append("")
    if low_pdf_overlap:
        lines.append("--- Effect text may differ from PDF (low token overlap) ---")
        for r in report["lowPdfOverlap"]:
            lines.append(f"\n  {r['name']} ({r['id']}) — overlap {r['overlap']}")
            lines.append(f"    JSON: {r['jsonText']}")
            lines.append(f"    PDF:  {r['pdfSnippet'][:220]}...")
    lines.append("")
    lines.append(f"--- All issues ({len(issues)}) ---")
    for i in issues[:60]:
        lines.append(f"  - {i}")
    if len(issues) > 60:
        lines.append(f"  ... and {len(issues) - 60} more")

    REPORT_TXT.write_text("\n".join(lines), encoding="utf-8")
    print("\n".join(lines[:80]))
    print(f"\n... full report: {REPORT_TXT}")
    print(f"... JSON: {REPORT}")


if __name__ == "__main__":
    main()
