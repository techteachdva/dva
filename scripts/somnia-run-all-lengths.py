#!/usr/bin/env python3
"""Batch full-game sim across all three lengths."""
import importlib.util
import statistics
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location(
    "sim", ROOT / "scripts" / "somnia-full-game-sim.py"
)
sim = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sim)

RUNS = 2000
bot = sim.BotConfig()

for length in ("daydream", "nap", "deep"):
    results = [
        sim.play_full_game(seed=9000 + i, length_key=length, bot=bot)
        for i in range(RUNS)
    ]
    wins = [r for r in results if r["status"] == "won"]
    losses = [r for r in results if r["status"] == "lost"]
    other = RUNS - len(wins) - len(losses)
    rounds = [r["rounds"] for r in results]
    cfg = sim.LENGTHS[length]
    print(f"=== {length.upper()} ({cfg['points']} pts, {cfg['dreams']} dreams) — {RUNS} engaged runs ===")
    print(f"  Win:  {len(wins) / RUNS:.1%} ({len(wins)})")
    print(f"  Loss: {len(losses) / RUNS:.1%} ({len(losses)})")
    if other:
        print(f"  Other/timeout: {other}")
    print(f"  Rounds: avg {statistics.mean(rounds):.1f}, median {sorted(rounds)[RUNS // 2]}")
    if wins:
        power = [r["final_power"] for r in wins]
        print(f"  Final power (wins): avg {statistics.mean(power):.1f}")
    if losses:
        pts_loss = [r["points"] for r in losses]
        print(f"  Loss avg points: {statistics.mean(pts_loss):.1f}/{cfg['points']}")
        for r in sorted(losses, key=lambda x: x["points"], reverse=True)[:3]:
            print(
                f"    loss seed {r['seed']}: {r['points']} pts in {r['rounds']}r, "
                f"dreams left {r['dreams_left']}"
            )
    print()
