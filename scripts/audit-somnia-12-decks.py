#!/usr/bin/env python3
"""Compare Somnia 12 PDF card content vs Somnia 14.1 game data."""
import json
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOMNIA = ROOT / "src" / "site" / "somnia"
DATA = SOMNIA / "data"
IMAGES = SOMNIA / "images"
EXTRACT = ROOT / "scripts" / "somnia-12-pdf-extract.txt"
PDF_PATH = Path(r"C:\Users\phili\Downloads\Interdisciplinary Review\Somnia 12.pdf")
OUT_JSON = ROOT / "scripts" / "somnia-12-deck-audit.json"
OUT_TXT = ROOT / "scripts" / "somnia-12-deck-audit.txt"

# Canonical Somnia 12 counts from rulebook / PDF component lists
EXPECTED = {
    "dreambeasts_unique": 36,  # 33 standard + 3 bosses (Leviathan awake/asleep variants count as 1 design)
    "objects_unique": 48,
    "landscapes": 25,
    "dreams": 36,
    "archetypes": 12,
    "dreamers": 6,
    "mindstream_events_per_suit": 35,
    "mindstream_objects_per_suit": 16,
    "mindstream_dreambeasts_per_suit": 10,
    "mindstream_power_per_suit": 6,
    "mindstream_draw_dream_per_suit": 3,
    "psyche_values": list(range(0, 11)),  # 0-10 per suit x3 = 33 designs, many copies
}

# Dreambeasts in Somnia 12 PDF (encounter cards with Accept/Repress/Fail)
PDF_DREAMBEASTS = [
    "Cerberus", "Double", "Leviathan",
    "Werewolf", "Bogey", "Mindless", "Automaton",
    "Merperson", "Trash Gremlin", "Nixie", "Jackalope",
    "Unicorn", "Guardian",
    "Black Dog", "Basilisk", "Baku", "Chimera",
    "Sandman", "Sincubus", "Mandrake", "Goofus Bird",
    "The Watcher", "Gorgon",
    "Oni", "Wendigo", "Minotaur", "Ghost Light",
    "Pooka", "Shadows", "Cheshire Cat", "Masked Figure",
    "Winged Turtle", "Vampyre",
]

# Objects from PDF pages 15-17, 30-33, 45-48 (48 unique)
PDF_OBJECTS = [
    "Row Boat", "Rope", "Hourglass", "Conch Shell",
    "Marble Grid", "Raven Claw", "Mobius Crystal", "Severed Torso",
    "Brass Emerald Bracelet", "Bag of Teeth", "The Bottom Stick", "Severed Legs",
    "Water", "Air", "The Nothing", "The All",
    "Candle", "Mirror", "Rabbit's Foot", "Possibility Polyhedral",
    "Ivory Pawn", "Severed Head", "Flower", "Psychic Owl",
    "Red Apple", "Golden Ruby Necklace", "Egg", "Tear of Moon",
    "The Middle Stick", "Earth", "The All-Seeing Eye",
    "Knife", "Crystal Bell", "Tooth-Saber", "Skeleton Key",
    "Ebony Pawn", "Hammer", "Severed Arms", "Monkey Paw",
    "Beating Heart", "Silver Sapphire Ring", "Coins", "The One",
    "The Top Stick", "Spark of Sun", "Fire",
    "Cotton Candy", "Lost Treasure", "The Right Door",
]

# Landscapes from PDF pages 61-73
PDF_LANDSCAPES = [
    "Lava", "Black Void", "Road", "Sky",
    "Field of Broken Glass", "The Attic", "The Basement", "Desert",
    "Endless Hallway", "The Party", "Awards", "Sea of Teeth",
    "Endless Ocean", "Candy Mountain", "House", "Suburbia",
    "Naked Classroom", "Tranquil Grove", "City", "Day in the Life",
    "Insanity", "Inner Sanctum", "Forest", "Silver Mist", "Bed",
]

# Lucidity mindstream events (pages 34-38, 41-42)
PDF_EVENTS_LUCIDITY = [
    "Fantastic Imagination", "Centering", "The Ascent", "Beyond Comprehension",
    "Just a Dream", "Morning Routine", "Afternoon Nap", "Evening Plans",
    "I'm Still Dreaming", "I Know This Place!", "A Face Appears", "Mist Swirls",
    "Transported", "Harmonic Resonance", "Denial", "Forgot Clothes",
    "Wrong Classroom", "Everyone's Watching", "Pop Quiz", "Sacred Geometry",
    "Revolving", "Serenity", "Clear as Crystal", "A Mouth Rises",
    "Peppermint Peak", "Licorice Bridge", "Cooling Obsidian", "From the Fire",
    "No Thing", "No Time", "No Where", "Choppy Water",
    "Jaw Shark", "Golden Tooth", "Who's There?", "No One",
]

# Elasticity events (pages 19-20, 24-27, 40)
PDF_EVENTS_ELASTICITY = [
    "A Shining Wind", "Roof Dive", "Cotton Candy", "Lost Treasure",
    "Undulating Floor", "The Right Door", "Just out of Reach",
    "Into The Next", "Running Somewhere?", "Portal to Another World",
    "Freezing Night", "Friendship", "Get Up", "Get Down",
    "Revolving", "Blooming", "Break-out", "Serenity",
]

# Willpower events - dedupe from lucidity list + elasticity overlap
PDF_EVENTS_WILLPOWER = [
    "A Thousand Daggers", "Flashing Lights", "Heating Up",
    "Metamorphosis", "Contagion", "I Remember!",
]

# Dreams - 36 cards pages 74-82
PDF_DREAM_COUNT = 36

# Archetypes pages 4-7
PDF_ARCHETYPES = [
    "The Rested", "The Weaver", "The Sage", "The Runner",
    "The Creator", "The Guardian", "The Seeker", "The Rebel",
    "The Lover", "The Judge", "The Fool", "The Mystic",
]


def norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", (s or "").lower())


def slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", (s or "").lower()).strip("-")


def load_json(name: str):
    return json.loads((DATA / f"{name}.json").read_text(encoding="utf-8"))


def image_exists(rel: str | None) -> bool:
    if not rel:
        return False
    return (SOMNIA / rel.replace("/", "\\")).exists()


def compare_names(pdf_names: list[str], game_items: list[dict], label: str) -> dict:
    pdf_norm = {norm(n): n for n in pdf_names}
    game_by_norm = {norm(i.get("name", "")): i for i in game_items}
    game_names = {i.get("name") for i in game_items}

    missing = []
    for pn, orig in sorted(pdf_norm.items()):
        if pn not in game_by_norm:
            missing.append(orig)

    extra = []
    for item in game_items:
        gn = norm(item.get("name", ""))
        if gn not in pdf_norm:
            extra.append(item.get("name") or item.get("id"))

    fuzzy_missing = []
    for pn, orig in pdf_norm.items():
        if pn in game_by_norm:
            continue
        for gn, item in game_by_norm.items():
            if pn in gn or gn in pn:
                fuzzy_missing.append({"pdf": orig, "game": item.get("name")})
                break

    return {
        "label": label,
        "pdfCount": len(pdf_names),
        "gameCount": len(game_items),
        "missingFromGame": missing,
        "extraInGame": extra,
        "fuzzyMatchesForMissing": fuzzy_missing,
    }


def audit_dreambeasts():
    game = load_json("dreambeasts")
    cmp = compare_names(PDF_DREAMBEASTS, game, "Dreambeasts")

    by_suit = defaultdict(list)
    by_kind = defaultdict(list)
    bosses = []
    no_image = []
    for b in game:
        by_suit[b.get("suit", "?")].append(b["name"])
        by_kind[b.get("beastKind", "?")].append(b["name"])
        if b.get("boss"):
            bosses.append(b["name"])
        if not image_exists(b.get("image")):
            no_image.append(b["id"])

    cmp["bosses"] = bosses
    cmp["bySuit"] = {k: len(v) for k, v in by_suit.items()}
    cmp["byKind"] = {k: len(v) for k, v in by_kind.items()}
    cmp["missingImages"] = no_image
    cmp["mindstreamSlotsPerSuit"] = 10
    cmp["note"] = (
        "Each Mindstream suit uses 10 Dreambeast cards (5 fantasy + 5 nightmare copies from suited pool)."
    )
    return cmp


def audit_objects():
    game = load_json("objects")
    cmp = compare_names(PDF_OBJECTS, game, "Objects")

    by_suit = defaultdict(int)
    by_timing = defaultdict(int)
    no_image = []
    for o in game:
        by_suit[o.get("suit", "?")] += 1
        by_timing[o.get("timing", o.get("type", "?"))] += 1
        if not image_exists(o.get("image")):
            no_image.append(o["id"])

    cmp["bySuit"] = dict(by_suit)
    cmp["byTiming"] = dict(by_timing)
    cmp["missingImages"] = no_image
    cmp["mindstreamSlotsPerSuit"] = 16
    return cmp


def audit_landscapes():
    game = load_json("landscapes")
    cmp = compare_names(PDF_LANDSCAPES, game, "Landscapes")
    no_image = [l["id"] for l in game if not image_exists(l.get("image"))]
    cmp["missingImages"] = no_image
    cmp["wastelandCount"] = sum(1 for l in game if l.get("wasteland"))
    return cmp


def audit_dreams():
    game = load_json("dreams")
    pdf_text = EXTRACT.read_text(encoding="utf-8", errors="replace") if EXTRACT.exists() else ""
    dream_pages = re.findall(r"=== PAGE (7[4-9]|8[0-2]) ===", pdf_text)
    missing_img = [d["id"] for d in game if not image_exists(d.get("image"))]
    return {
        "label": "Dreams",
        "pdfCount": PDF_DREAM_COUNT,
        "gameCount": len(game),
        "pdfDreamPagesFound": len(set(dream_pages)),
        "missingImages": missing_img,
        "gameIds": [d["id"] for d in game],
    }


def audit_archetypes():
    game = load_json("archetypes")
    cmp = compare_names(PDF_ARCHETYPES, game, "Archetypes")
    missing_img = [a["id"] for a in game if not image_exists(a.get("image"))]
    cmp["missingImages"] = missing_img
    return cmp


def audit_dreamers():
    game = load_json("dreamers")
    return {
        "label": "Dreamers",
        "gameCount": len(game),
        "names": [d["name"] for d in game],
    }


def audit_mindstream_events():
    ms = load_json("mindstream")
    handlers = set(re.findall(r'"([a-z0-9-]+)":\s*\(', (SOMNIA / "js/mindstream.js").read_text(encoding="utf-8")))

    suits = {}
    for suit in ("lucidity", "elasticity", "willpower"):
        events = ms.get(suit, [])
        pdf_list = {
            "lucidity": PDF_EVENTS_LUCIDITY,
            "elasticity": PDF_EVENTS_ELASTICITY,
            "willpower": PDF_EVENTS_WILLPOWER,
        }[suit]
        cmp = compare_names(pdf_list, events, f"Mindstream events ({suit})")
        missing_handlers = [e["id"] for e in events if e["id"] not in handlers]
        missing_img = [e["id"] for e in events if not image_exists(e.get("image"))]
        suits[suit] = {
            **cmp,
            "expectedDeckSlots": 35,
            "uniqueInJson": len(events),
            "shortfallUnique": max(0, 35 - len(events)),
            "missingHandlers": missing_handlers,
            "missingImages": missing_img,
        }

    return suits


def audit_psyche():
    psyche = load_json("psyche")
    return {
        "label": "Psyche",
        "gameCount": len(psyche) if isinstance(psyche, list) else "unknown",
        "note": "Standard 0-10 values x3 suits in physical deck; game uses generated deck.",
    }


def verify_pdf_names_present():
    text = EXTRACT.read_text(encoding="utf-8", errors="replace") if EXTRACT.exists() else ""
    results = {}
    for name in PDF_DREAMBEASTS:
        results[name] = bool(re.search(re.escape(name), text, re.I))
    return results


def format_report(report: dict) -> str:
    lines = ["=== Somnia 12 vs 14.1 Deck Audit ===", f"PDF source: {PDF_PATH}", f"Game data: {DATA}", ""]

    def section(title, data):
        lines.append(f"--- {title} ---")
        if isinstance(data, dict):
            for k, v in data.items():
                if k in ("gameIds",):
                    continue
                if isinstance(v, list) and len(v) > 12:
                    lines.append(f"  {k} ({len(v)}): {', '.join(str(x) for x in v[:8])} … +{len(v)-8} more")
                elif isinstance(v, dict):
                    lines.append(f"  {k}: {v}")
                else:
                    lines.append(f"  {k}: {v}")
        lines.append("")

    section("Dreambeasts", report["dreambeasts"])
    section("Objects", report["objects"])
    section("Landscapes", report["landscapes"])
    section("Dreams", report["dreams"])
    section("Archetypes", report["archetypes"])
    section("Dreamers", report["dreamers"])
    section("Psyche", report["psyche"])

    lines.append("--- Mindstream Events ---")
    for suit, data in report["mindstream"].items():
        lines.append(f"  [{suit}] unique={data['uniqueInJson']} expectedSlots={data['expectedDeckSlots']} shortfall={data['shortfallUnique']}")
        if data["missingFromGame"]:
            lines.append(f"    missing: {', '.join(data['missingFromGame'])}")
        if data["missingHandlers"]:
            lines.append(f"    no handler: {', '.join(data['missingHandlers'])}")
    lines.append("")

    lines.append("--- PDF name presence check (dreambeasts) ---")
    absent = [n for n, ok in report["pdfDreambeastTextCheck"].items() if not ok]
    lines.append(f"  not found in extract: {absent or 'none'}")
    return "\n".join(lines)


def main():
    report = {
        "dreambeasts": audit_dreambeasts(),
        "objects": audit_objects(),
        "landscapes": audit_landscapes(),
        "dreams": audit_dreams(),
        "archetypes": audit_archetypes(),
        "dreamers": audit_dreamers(),
        "mindstream": audit_mindstream_events(),
        "psyche": audit_psyche(),
        "pdfDreambeastTextCheck": verify_pdf_names_present(),
    }

    OUT_JSON.write_text(json.dumps(report, indent=2), encoding="utf-8")
    OUT_TXT.write_text(format_report(report), encoding="utf-8")
    print(format_report(report))
    print(f"\nWrote {OUT_JSON}")
    print(f"Wrote {OUT_TXT}")


if __name__ == "__main__":
    main()
