#!/usr/bin/env python3
"""Detailed Somnia 12 vs 14.1 comparison with stat checks."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "src" / "site" / "somnia" / "data"
EXTRACT = ROOT / "scripts" / "somnia-12-pdf-extract.txt"

# Mindstream event names parsed from Somnia 12 PDF sheet layout (pages 19-27, 35-43, 53-58)
PDF_EVENTS = {
    "elasticity": [
        "A Shining Wind", "A Million Reflections", "This Will Have to Do", "Is That Music?",
        "Roof Dive", "Cotton Candy", "Insulation", "Shimmering Slivers",
        "Diamonds", "Desert Oasis", "Need Water!",
        "Into The Next", "Broken Toys", "Flooded", "Running Somewhere?",
        "Portal to Another World", "Giant Animated Pile", "Dust Bunnies",
        "Lost Treasure", "Wrong Door", "Hidden in the Walls", "Deeper Darker",
        "Undulating Floor", "The Right Door", "Just out of Reach", "Splinters",
        "Freezing Night", "Searing Day", "A Mirage?", "Sandstorm!",
        "Friendship", "Get Up", "Get Down",
        "Revolving", "Blooming", "Break-out",
    ],
    "lucidity": [
        "The Council of The Years", "Centering", "Fantastic Imagination", "The Ascent",
        "Beyond Comprehension", "Sublimation", "Just a Dream",
        "Morning Routine", "Afternoon Nap", "Evening Plans", "I Know This Place!",
        "I'm Still Dreaming", "A Way Out Forms", "Voice in the Distance", "Something's Over There",
        "A Face Appears", "Mist Swirls", "Transported", "Lightness",
        "Revolving", "Serenity", "Harmonic Resonance", "Blooming",
        "Denial", "Keep it Together", "Metamorphosis", "Contagion",
        "Forgot Clothes", "Wrong Classroom", "Everyone's Laughing", "Pop Quiz",
        "Sacred Geometry",
    ],
    "willpower": [
        "A Thousand Daggers", "Heating Up", "Cooling Obsidian", "From the Fire", "A Sacrifice!",
        "No Thing", "No Time", "No Where",
        "Choppy Water", "Big Wave", "Fog",
        "Clear as Crystal", "A Mouth Rises", "Whirlpool", "Syrup Lake",
        "Peppermint Peak", "Licorice Bridge", "Chocolate Mines", "Marshmallow Clouds",
        "Flashing Lights", "Jaw Shark", "Golden Tooth", "Who's There?", "No One",
        "I Remember!",
    ],
}

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


def norm(s):
    return re.sub(r"[^a-z0-9]+", "", (s or "").lower())


def load(name):
    return json.loads((DATA / f"{name}.json").read_text(encoding="utf-8"))


def compare_events():
    ms = load("mindstream")
    lines = []
    for suit, pdf_names in PDF_EVENTS.items():
        game = {norm(e["name"]): e for e in ms.get(suit, [])}
        missing = []
        matched = []
        for name in pdf_names:
            n = norm(name)
            hit = None
            for gn, e in game.items():
                if n == gn or n in gn or gn in n:
                    hit = e["name"]
                    break
            if hit:
                matched.append((name, hit))
            else:
                missing.append(name)
        lines.append(f"\n{suit.upper()} events: PDF {len(pdf_names)} unique names, game JSON {len(ms.get(suit,[]))} unique")
        lines.append(f"  Missing from game ({len(missing)}): {', '.join(missing) if missing else 'none'}")
        extras = []
        for e in ms.get(suit, []):
            en = norm(e["name"])
            if not any(norm(p) == en or norm(p) in en or en in norm(p) for p in pdf_names):
                extras.append(e["name"])
        if extras:
            lines.append(f"  In game, not in PDF list ({len(extras)}): {', '.join(extras)}")
    return "\n".join(lines)


def parse_pdf_dreambeast_stats(text):
    """Extract Accept/Repress numbers near dreambeast names."""
    stats = {}
    for name in PDF_DREAMBEASTS:
        if name in ("Leviathan",):
            # boss uses Slay/Slumber
            m = re.search(
                rf"{re.escape(name)}.*?(?:Slay|Accept):\s*(\d+).*?(?:Slumber|Repress):\s*(\d+)",
                text,
                re.I | re.S,
            )
        else:
            m = re.search(
                rf"{re.escape(name)}.*?Accept:\s*(\d+).*?Repress:\s*(\d+)",
                text,
                re.I | re.S,
            )
        if m:
            stats[name] = {"accept": int(m.group(1)), "repress": int(m.group(2))}
    return stats


def compare_dreambeast_stats():
    text = EXTRACT.read_text(encoding="utf-8", errors="replace")
    pdf_stats = parse_pdf_dreambeast_stats(text)
    game = {b["name"]: b for b in load("dreambeasts")}
    lines = ["\nDreambeast stat mismatches (Accept/Repress vs PDF):"]
    mismatches = []
    for name, ps in sorted(pdf_stats.items()):
        g = game.get(name)
        if not g:
            mismatches.append(f"  {name}: in PDF stats but NOT in game data")
            continue
        ga, gr = g.get("accept"), g.get("reject") or g.get("repress")
        if ga != ps["accept"] or gr != ps["repress"]:
            mismatches.append(
                f"  {name}: PDF Accept {ps['accept']}/Repress {ps['repress']} "
                f"vs game Accept {ga}/Reject {gr}"
            )
    lines.extend(mismatches if mismatches else ["  none (all parsed stats match)"])
    missing_names = [n for n in PDF_DREAMBEASTS if n not in game]
    if missing_names:
        lines.append(f"  Missing names: {', '.join(missing_names)}")
    else:
        lines.append(f"  All {len(PDF_DREAMBEASTS)} PDF dreambeast names present in game data.")
    return "\n".join(lines)


def summary_counts():
    beasts = load("dreambeasts")
    objects = load("objects")
    landscapes = load("landscapes")
    dreams = load("dreams")
    archetypes = load("archetypes")
    ms = load("mindstream")
    return (
        f"Game counts: dreambeasts={len(beasts)} (bosses={sum(1 for b in beasts if b.get('boss'))}), "
        f"objects={len(objects)}, landscapes={len(landscapes)}, dreams={len(dreams)}, "
        f"archetypes={len(archetypes)}, mindstream unique events={sum(len(ms[s]) for s in ms)}"
    )


def main():
    out = ["=== Somnia 12 vs 14.1 Detailed Deck Comparison ===", summary_counts(), compare_dreambeast_stats(), compare_events()]
    report = "\n".join(out)
    path = ROOT / "scripts" / "somnia-12-deck-audit-detail.txt"
    path.write_text(report, encoding="utf-8")
    print(report)
    print(f"\nWrote {path}")


if __name__ == "__main__":
    main()
