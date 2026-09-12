#!/usr/bin/env python3
"""List mindstream events still using the fantastic-imagination placeholder."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOMNIA = ROOT / "src" / "site" / "somnia"
MS = json.loads((SOMNIA / "data" / "mindstream.json").read_text(encoding="utf-8"))
REF = SOMNIA / "images/cards/mindstream/lucidity/fantastic-imagination.webp"
REF_HASH = hashlib.md5(REF.read_bytes()).hexdigest()

PROMPTS = json.loads((ROOT / "scripts" / "somnia-art-prompts.json").read_text(encoding="utf-8"))
STYLE = PROMPTS["styleSuffix"]
BASE = PROMPTS.get("mindstream", {})

SUIT_STYLE = {
    "lucidity": "violet and silver lucid dream tones",
    "elasticity": "golden amber elastic dream tones",
    "willpower": "crimson and obsidian willpower dream tones",
}


def prompt_for(event):
    eid = event["id"]
    if eid in BASE:
        scene = BASE[eid]
    else:
        scene = f"Surreal dream scene illustrating '{event['name']}': {event['text'][:120]}"
    return f"{scene}. {SUIT_STYLE[event['suit']]}. {STYLE}"


def main():
    out = []
    for suit, events in MS.items():
        for e in events:
            path = SOMNIA / e["image"]
            if hashlib.md5(path.read_bytes()).hexdigest() != REF_HASH:
                continue
            out.append({
                "suit": suit,
                "id": e["id"],
                "name": e["name"],
                "image": e["image"],
                "assetName": f"mindstream-{suit}-{e['id']}.png",
                "prompt": prompt_for({**e, "suit": suit}),
            })
    path = ROOT / "scripts" / "mindstream-placeholder-batch.json"
    path.write_text(json.dumps(out, indent=2) + "\n", encoding="utf-8")
    print(f"{len(out)} placeholders -> {path}")
    for suit in ("lucidity", "elasticity", "willpower"):
        n = sum(1 for x in out if x["suit"] == suit)
        print(f"  {suit}: {n}")


if __name__ == "__main__":
    main()
