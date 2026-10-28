"""Fun Factor Formula scorer (see references/fun-factor.md).

Input: a JSON list of {"game", "level", "C", "P", "O", "V", "note"?}.
Prints FF, FF*, FF/FF*, the normalized parts and Exp, ranked by Exp.

    python fff.py data.json [--threshold 80]
"""
import json
import math
import sys

P_CAP = 24.0
V_CAP = 48.0


def score(C: float, P: float, O: float, V: float) -> dict:
    P = max(P, 1.0)
    O = max(O, 1.0)
    V = max(V, 1.0)
    ff = C * P / O * V
    o_star = 1.0 + math.sqrt(P)
    ff_star = C * P / o_star * V
    bal = max(0.0, 1.0 - abs(math.log(O / o_star)) / math.log(4.0))
    sp = min(1.0, math.log(1 + P) / math.log(1 + P_CAP))
    sv = min(1.0, math.log(1 + V) / math.log(1 + V_CAP))
    exp = 1.0 + 99.0 * (C * sp * bal * sv) ** 0.25
    parts = {"C": C, "Sp": sp, "B": bal, "Sv": sv}
    weakest = min(parts, key=parts.get)
    return {"FF": ff, "FF*": ff_star, "FF/FF*": ff / ff_star if ff_star else 0.0,
            "O*": o_star, "C": C, "Sp": sp, "B": bal, "Sv": sv, "Exp": exp, "weakest": weakest}


def main() -> None:
    args = sys.argv[1:]
    threshold = 80.0
    if "--threshold" in args:
        threshold = float(args[args.index("--threshold") + 1])
    rows = json.load(open(args[0], encoding="utf-8"))
    out = []
    for r in rows:
        s = score(r["C"], r["P"], r["O"], r["V"])
        s.update({"game": r["game"], "level": r.get("level", "")})
        out.append(s)
    out.sort(key=lambda s: -s["Exp"])
    print("%-16s %-18s %6s %6s %6s %5s %5s %5s %5s %6s  %s" % ("game", "level", "FF", "FF*", "FF/FF*", "C", "Sp", "B", "Sv", "Exp", "verdict"))
    for s in out:
        verdict = "keep" if s["Exp"] >= threshold else ("polish" if s["Exp"] >= 75 else "REDESIGN (%s)" % s["weakest"])
        print("%-16s %-18s %6.1f %6.1f %6.2f %5.2f %5.2f %5.2f %5.2f %6.1f  %s" % (
            s["game"], s["level"], s["FF"], s["FF*"], s["FF/FF*"], s["C"], s["Sp"], s["B"], s["Sv"], s["Exp"], verdict))


if __name__ == "__main__":
    main()
