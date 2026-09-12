#!/usr/bin/env python3
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "src" / "site" / "somnia" / "data"
JS = ROOT / "src" / "site" / "somnia" / "js"

beasts = json.loads((DATA / "dreambeasts.json").read_text(encoding="utf-8"))
ms = json.loads((DATA / "mindstream.json").read_text(encoding="utf-8"))
handlers = (JS / "mindstream.js").read_text(encoding="utf-8") + (JS / "mindstream-extra.js").read_text(encoding="utf-8")

print("=== Dreambeast suits ===")
for suit in ("lucidity", "elasticity", "willpower"):
    suited = [b for b in beasts if not b.get("boss") and b["suit"] == suit]
    fantasy = sum(1 for b in suited if b["beastKind"] == "fantasy")
    nightmare = sum(1 for b in suited if b["beastKind"] == "nightmare")
    print(f"  {suit}: {len(suited)} (fantasy={fantasy}, nightmare={nightmare})")

print("\n=== Mindstream events ===")
for suit in ("lucidity", "elasticity", "willpower"):
    print(f"  {suit}: {len(ms[suit])} events")

print("\n=== Missing handlers ===")
missing = []
for suit, events in ms.items():
    for e in events:
        eid = e["id"]
        if not re.search(rf'["\']?{re.escape(eid)}["\']?\s*:', handlers):
            missing.append(f"{suit}/{eid}")
print("  " + (", ".join(missing) if missing else "none"))
