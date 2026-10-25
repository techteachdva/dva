"""Batch-run Feleco years under each power scenario and write calibration data.

python scripts/dev/calibrate.py [seeds=10] [days=120] [caps.json]
Writes scripts/dev/calibration.json: per scenario, per species
win rate, extinction rate, final/mean/peak populations and per-season means.
"""
import json, sys, statistics, pathlib, concurrent.futures as cf
from run_sims import run, SPECIES

ROOT = pathlib.Path(__file__).resolve().parents[2]
SCENARIOS = {
    "none": [],
    "rain": ["--power=20:rain,50:rain"],
    "famine": ["--power=20:famine"],
    "flood": ["--power=40:flood"],
    "meteor": ["--power=60:meteor"],
}
CAPS = {"sheep": 6.0, "wolves": 12.7, "humans": 17.0, "falcons": 14.0, "robins": 7.4,
        "boars": 8.3, "rabbits": 34.0, "worms": 24.0, "fish": 26.0}

def winner(row, caps):
    ctrl = row.get("control")
    if ctrl and max(ctrl.values()) > 0:
        return max(ctrl, key=ctrl.get)
    best, who = 0.0, ""
    for sp in SPECIES:
        n = row[sp] + (3 * row.get("huts", 0) if sp == "humans" else 0)
        h = n / caps[sp]
        if h > best:
            best, who = h, sp
    return who

def main():
    seeds = int(sys.argv[1]) if len(sys.argv) > 1 else 10
    days = int(sys.argv[2]) if len(sys.argv) > 2 else 120
    caps = json.load(open(sys.argv[3])) if len(sys.argv) > 3 else CAPS
    jobs = [(name, s) for name in SCENARIOS for s in range(1, seeds + 1)]
    with cf.ThreadPoolExecutor(max_workers=6) as ex:
        futs = {ex.submit(run, s, days, SCENARIOS[name]): name for name, s in jobs}
        results = {}
        for f in cf.as_completed(futs):
            seed, rows, errors = f.result()
            if errors:
                print(futs[f], seed, "ERRORS", errors[:2])
            if rows:
                results.setdefault(futs[f], []).append(rows)
    out = {"caps": caps, "days": days, "seeds": seeds, "scenarios": {}}
    for name, runs in results.items():
        stats = {}
        wins = [winner(r[-1], caps) for r in runs]
        for sp in SPECIES:
            finals = [r[-1][sp] for r in runs]
            means = [statistics.mean(x[sp] for x in r) for r in runs]
            seasons = {}
            for r in runs:
                for x in r:
                    seasons.setdefault(x["season"], []).append(x[sp])
            if sp == "humans":
                stats["huts_final"] = statistics.mean(r[-1].get("huts", 0) for r in runs)
            stats[sp] = {
                "win": wins.count(sp) / len(runs),
                "ruled": statistics.mean(r[-1].get("control", {}).get(sp, 0) / max(1e-6, sum(r[-1].get("control", {}).values() or [0])) for r in runs),
                "extinct": sum(1 for v in finals if v == 0) / len(runs),
                "final_mean": statistics.mean(finals),
                "final_sd": statistics.pstdev(finals),
                "mean": statistics.mean(means),
                "peak": statistics.mean(max(x[sp] for x in r) for r in runs),
                "season": {k: statistics.mean(v) for k, v in seasons.items()},
            }
        out["scenarios"][name] = {"runs": len(runs), "species": stats}
        print(f"\n== {name} ({len(runs)} runs)")
        for sp in SPECIES:
            s = stats[sp]
            print(f"{sp:>8} win={s['win']:.2f} ruled={s['ruled']:.2f} ext={s['extinct']:.2f} final={s['final_mean']:6.1f}±{s['final_sd']:5.1f} mean={s['mean']:6.1f}")
    path = pathlib.Path(__file__).with_name("calibration.json")
    path.write_text(json.dumps(out, indent=1))
    print("wrote", path)

if __name__ == "__main__":
    main()
