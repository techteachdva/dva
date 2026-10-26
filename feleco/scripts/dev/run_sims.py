"""Run several headless Feleco years in parallel and summarise them.

python scripts/dev/run_sims.py [seeds=6] [days=10] [extra harness args...]
"""
import subprocess, sys, statistics, pathlib, concurrent.futures as cf

GODOT = r"D:\coding-projects\dva\.cache\godot\editor\Godot_v4.6-stable_win64_console.exe"
ROOT = pathlib.Path(__file__).resolve().parents[2]
SPECIES_CSV = ["sheep", "wolves", "humans", "falcons", "robins", "boars", "worms", "rabbits", "fish"]
SPECIES = ["sheep", "wolves", "humans", "falcons", "robins", "boars", "worms", "rabbits", "fish", "deer", "goats", "bears", "lions", "beetles"]

def run(seed, days, extra):
    cmd = [GODOT, "--headless", "--fixed-fps", "30", "--path", str(ROOT), "res://scenes/dev/shots.tscn",
           "--", "--sim", "--scene=sim", f"--seed={seed}", f"--days={days}"] + extra
    out = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=900).stdout
    rows, header, errors = [], None, []
    for line in out.splitlines():
        if line.startswith("CSV,day"):
            header = line.split(",")[1:]
        elif line.startswith("CSV,") and header:
            vals = line.split(",")[1:]
            rows.append({h: (v if h == "season" else float(v)) for h, v in zip(header, vals)})
        elif line.startswith("CONTROL,") and rows:
            vals = line.split(",")[2:]
            rows[-1]["control"] = dict(zip(SPECIES_CSV, map(float, vals)))
        elif "SCRIPT ERROR" in line or "Parse Error" in line:
            errors.append(line.strip())
    return seed, rows, errors

def main():
    seeds = int(sys.argv[1]) if len(sys.argv) > 1 else 6
    days = float(sys.argv[2]) if len(sys.argv) > 2 else 10
    extra = sys.argv[3:]
    with cf.ThreadPoolExecutor(max_workers=6) as ex:
        results = list(ex.map(lambda s: run(s, days, extra), range(1, seeds + 1)))
    cols = SPECIES + ["spores", "huts", "tribes", "trees", "grass"]
    for seed, rows, errors in results:
        print(f"--- seed {seed}" + (f"  ERRORS: {errors[:2]}" if errors else ""))
        print("day  " + " ".join(f"{c[:6]:>6}" for c in cols))
        for r in rows[::2]:
            print(f"{r['day']:>3}{r['season'][:2]:>2} " + " ".join(f"{r.get(c, 0):>6}" for c in cols))
    print("\n=== summary across seeds (mean pop by season, extinct = seeds where it hit 0 and stayed) ===")
    for sp in SPECIES:
        by_season = {}
        extinct, booms = 0, []
        for _, rows, _ in results:
            if not rows:
                continue
            vals = [r[sp] for r in rows]
            for r in rows:
                by_season.setdefault(r["season"], []).append(r[sp])
            if vals[-1] == 0:
                extinct += 1
            mean = statistics.mean(vals) or 1
            booms.append(max(vals) / mean)
        seasons = " ".join(f"{s[:3]}={statistics.mean(v):6.1f}" for s, v in by_season.items())
        print(f"{sp:>8}: {seasons}  extinct={extinct}/{len(results)}  boom={statistics.mean(booms) if booms else 0:4.1f}")

if __name__ == "__main__":
    main()
