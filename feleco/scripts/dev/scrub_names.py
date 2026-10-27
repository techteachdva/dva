"""Strips franchise names (scripts/dev/franchise_names.txt) from names.txt.

python scripts/dev/scrub_names.py   then   python scripts/dev/build_names.py
"""
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
banned = {l.strip().lower() for l in (ROOT / "scripts/dev/franchise_names.txt").read_text(encoding="utf-8").splitlines()
          if l.strip() and not l.startswith("#")}
path = ROOT / "scripts/names/names.txt"
out, removed = [], []
for line in path.read_text(encoding="utf-8").splitlines():
    if line.startswith("#") or line.startswith("##") or not line.strip():
        out.append(line)
        continue
    keep = []
    for name in line.split(","):
        n = name.strip()
        if n and n.lower() in banned:
            removed.append(n)
        elif n:
            keep.append(n)
    if keep:
        out.append(", ".join(keep) + ("," if line.rstrip().endswith(",") else ""))
path.write_text("\n".join(out) + "\n", encoding="utf-8")
print("removed:", ", ".join(removed))
