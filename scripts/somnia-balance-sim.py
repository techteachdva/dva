#!/usr/bin/env python3
"""
Deep Monte Carlo Somnia power-token economy simulation.
Compares Power Surge grant values and play styles across player counts.

Run: py scripts/somnia-balance-sim.py
"""

import json
import random
import re
import statistics
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src" / "site" / "somnia" / "data"

MAX_POOL = 24
PSYCHE_STARTING_HAND = 5
PSYCHE_POWER_COUNT = 6
PSYCHE_DECK_SIZE = 57
STARTING_POWER = 2
DRAWS_AFTER_R1 = 2
MINDSTREAM_DECK_SIZE = 70
MINDSTREAM_POWER_PER_SUIT = 6
MINDSTREAM_POWER_VALUE = 2
RUNS = 5000

GOAL_POINTS = {"daydream": 12, "nap": 18, "deep": 24}
ARCHETYPE_POINTS_AVG = 2.0  # rough mean acquire value


@dataclass
class Config:
    surge_value: int = 1
    players: int = 2
    rounds: int = 8
    length: str = "nap"


@dataclass
class Strategy:
    name: str
    mindstream_draws: int = 0
    quest_power_per_round: int = 0
    dreamer_power_per_round: int = 0
    object_power_chance: float = 0.0  # e.g. Coins
    encounter_reject_chance: float = 0.0


STRATEGIES = [
    Strategy("minimal", 0, 0, 0, 0.0, 0.0),
    Strategy("casual", 1, 1, 0, 0.02, 0.05),
    Strategy("engaged", 3, 2, 1, 0.05, 0.15),
    Strategy("power-hunter", 5, 1, 0, 0.08, 0.25),
]


def load_json(name):
    with open(DATA / f"{name}.json", encoding="utf-8") as f:
        return json.load(f)


def build_psyche_deck(surge_value):
    dist = {1: 5, 2: 4, 3: 3, 4: 2, 5: 1}
    deck = []
    for suit in ("lucidity", "elasticity", "willpower"):
        for value, copies in dist.items():
            deck += [{"type": "psyche", "suit": suit, "value": value}] * copies
    deck += [{"type": "wild"}] * 6
    deck += [{"type": "psyche-power", "powerTokens": surge_value}] * PSYCHE_POWER_COUNT
    random.shuffle(deck)
    return deck


def grant(held, amount):
    total = sum(held)
    g = min(max(0, amount), max(0, MAX_POOL - total))
    return g


def draw_from_deck(state, player_idx, count, surge_value):
    surge_hits = 0
    surge_tokens = 0
    for _ in range(count):
        if not state["deck"]:
            if state["discard"]:
                state["deck"] = state["discard"][:]
                state["discard"] = []
                random.shuffle(state["deck"])
            else:
                break
        card = state["deck"].pop(0)
        if card["type"] == "psyche-power":
            surge_hits += 1
            t = grant(state["held"], card.get("powerTokens", surge_value))
            state["held"][player_idx] += t
            surge_tokens += t
            state["gained_round"] += t
            state["gained_surge"] += t
        else:
            state["hands"][player_idx].append(card)
    return surge_hits, surge_tokens


def deal_starting(state, player_idx, count):
    deferred = []
    hand = []
    guard = len(state["deck"]) + 30
    while len(hand) < count and guard > 0:
        guard -= 1
        if not state["deck"] and deferred:
            state["deck"] = deferred[:]
            deferred = []
            random.shuffle(state["deck"])
        if not state["deck"]:
            break
        card = state["deck"].pop(0)
        if card["type"] == "psyche-power":
            deferred.append(card)
        else:
            hand.append(card)
    if deferred:
        state["deck"] = deferred + state["deck"]
    state["hands"][player_idx] = hand


def mindstream_power_draw(state, strategy, surge_value):
    gained = 0
    p_hit = MINDSTREAM_POWER_PER_SUIT / MINDSTREAM_DECK_SIZE
    for _ in range(strategy.mindstream_draws):
        if random.random() < p_hit:
            pi = random.randrange(len(state["held"]))
            t = grant(state["held"], MINDSTREAM_POWER_VALUE)
            state["held"][pi] += t
            gained += t
            state["gained_round"] += t
            state["gained_mindstream"] += t
        # small chance of power event from mindstream events
        if random.random() < 0.04:
            pi = random.randrange(len(state["held"]))
            t = grant(state["held"], random.choice([1, 2]))
            state["held"][pi] += t
            gained += t
            state["gained_round"] += t
            state["gained_events"] += t
    return gained


def spend_power(state, amount):
    left = amount
    for i in range(len(state["held"])):
        while left > 0 and state["held"][i] > 0:
            state["held"][i] -= 1
            left -= 1
            state["spent_round"] += 1
    return amount - left


def simulate_once(cfg: Config, strategy: Strategy):
    n = cfg.players
    state = {
        "held": [0] * n,
        "deck": build_psyche_deck(cfg.surge_value),
        "discard": [],
        "hands": [[] for _ in range(n)],
        "gained_round": 0,
        "gained_surge": 0,
        "gained_mindstream": 0,
        "gained_events": 0,
        "spent_round": 0,
        "surge_hits": 0,
        "points": 0,
        "archetypes": 0,
    }

    for p in range(n):
        deal_starting(state, p, PSYCHE_STARTING_HAND)
        t = grant(state["held"], STARTING_POWER)
        state["held"][p] += t

    # resolve any power in opening hands (rare after deferral)
    for p in range(n):
        for card in state["hands"][p]:
            if card["type"] == "psyche-power":
                t = grant(state["held"], card.get("powerTokens", cfg.surge_value))
                state["held"][p] += t
                state["gained_surge"] += t

    timeline = [sum(state["held"])]
    round_stats = []

    for rnd in range(1, cfg.rounds + 1):
        state["gained_round"] = 0
        state["gained_surge"] = 0
        state["gained_mindstream"] = 0
        state["gained_events"] = 0
        state["spent_round"] = 0
        surge_hits = 0

        if rnd >= 2:
            for p in range(n):
                h, _t = draw_from_deck(state, p, DRAWS_AFTER_R1, cfg.surge_value)
                surge_hits += h

        mindstream_power_draw(state, strategy, cfg.surge_value)

        if strategy.object_power_chance and random.random() < strategy.object_power_chance:
            for p in range(n):
                t = grant(state["held"], 1)
                state["held"][p] += t
                state["gained_round"] += t
                state["gained_events"] += t

        if strategy.encounter_reject_chance and random.random() < strategy.encounter_reject_chance:
            pi = random.randrange(n)
            t = grant(state["held"], 1)
            state["held"][pi] += t
            state["gained_round"] += t
            state["gained_events"] += t

        spend = strategy.quest_power_per_round + strategy.dreamer_power_per_round
        spend_power(state, spend)

        # archetype progress: spend 2 quest power every ~3 rounds in engaged play
        if strategy.quest_power_per_round >= 2 and rnd % 3 == 0:
            state["archetypes"] += 1
            state["points"] += ARCHETYPE_POINTS_AVG

        total = sum(state["held"])
        timeline.append(total)
        round_stats.append({
            "round": rnd,
            "total": total,
            "gained": state["gained_round"],
            "spent": state["spent_round"],
            "surge_hits": surge_hits,
            "surge_gain": state["gained_surge"],
            "ms_gain": state["gained_mindstream"],
            "event_gain": state["gained_events"],
        })

    goal = GOAL_POINTS[cfg.length]
    archetypes_needed = max(1, int(goal / ARCHETYPE_POINTS_AVG))
    quest_sink_needed = archetypes_needed * 2
    final = sum(state["held"])
    surplus = final  # unspent at end

    return {
        "timeline": timeline,
        "final": final,
        "surplus": surplus,
        "points": state["points"],
        "archetypes": state["archetypes"],
        "quest_sink_needed": quest_sink_needed,
        "total_surge_hits": sum(r["surge_hits"] for r in round_stats),
        "round2": timeline[1] if len(timeline) > 1 else timeline[0],
        "round4": timeline[3] if len(timeline) > 3 else timeline[-1],
        "round_stats": round_stats,
    }


def summarize(vals):
    if not vals:
        return {}
    s = sorted(vals)
    n = len(s)

    def pct(q):
        return s[min(n - 1, int(q * (n - 1)))]

    return {
        "min": s[0],
        "max": s[-1],
        "avg": round(statistics.mean(s), 2),
        "p50": pct(0.5),
        "p90": pct(0.9),
        "p95": pct(0.95),
    }


def run_batch(cfg, strategy):
    finals = []
    r2 = []
    r4 = []
    surplus = []
    surge_hits = []
    for _ in range(RUNS):
        r = simulate_once(cfg, strategy)
        finals.append(r["final"])
        r2.append(r["timeline"][2] if len(r["timeline"]) > 2 else r["timeline"][-1])
        r4.append(r["timeline"][4] if len(r["timeline"]) > 4 else r["timeline"][-1])
        surplus.append(r["surplus"])
        surge_hits.append(r["total_surge_hits"])
    return {
        "final": summarize(finals),
        "r2": summarize(r2),
        "r4": summarize(r4),
        "surplus": summarize(surplus),
        "surge_hits_avg": round(statistics.mean(surge_hits), 2),
        "p_final_ge_16": sum(1 for v in finals if v >= 16) / RUNS,
        "p_r2_ge_10": sum(1 for v in r2 if v >= 10) / RUNS,
        "p_r2_ge_12": sum(1 for v in r2 if v >= 12) / RUNS,
        "p_surplus_ge_8": sum(1 for v in surplus if v >= 8) / RUNS,
    }


def print_comparison(title, old, new):
    print(f"\n== {title} ==")
    for key, label in [
        ("r2", "End round 2"),
        ("r4", "End round 4"),
        ("final", f"End round (full)"),
        ("surplus", "Unspent surplus at end"),
    ]:
        o, n = old[key], new[key]
        delta = round(n["avg"] - o["avg"], 2)
        print(f"  {label:22} avg {o['avg']:>5} -> {n['avg']:>5} ({delta:+.2f})   p90 {o['p90']} -> {n['p90']}")
    print(f"  P(>=10 by R2)          {old['p_r2_ge_10']:.1%} -> {new['p_r2_ge_10']:.1%}")
    print(f"  P(>=12 by R2)          {old['p_r2_ge_12']:.1%} -> {new['p_r2_ge_12']:.1%}")
    print(f"  P(>=16 final)          {old['p_final_ge_16']:.1%} -> {new['p_final_ge_16']:.1%}")
    print(f"  P(surplus>=8)          {old['p_surplus_ge_8']:.1%} -> {new['p_surplus_ge_8']:.1%}")
    print(f"  Surge hits/game        {old['surge_hits_avg']:.2f} -> {new['surge_hits_avg']:.2f}")


def main():
    random.seed(2026)
    print("Somnia Deep Power Token Simulation")
    print(f"  {RUNS} runs per cell · Power Surge A/B: +2 (old) vs +1 (new)")
    print(f"  Mindstream power cards unchanged at +{MINDSTREAM_POWER_VALUE}")
    print(f"  Pool cap: {MAX_POOL} team-wide\n")

    # Theoretical
    draws_r2plus = 2 * 2 * 2  # 2 players, 2 draws, from round 2 for one round
    p = PSYCHE_POWER_COUNT / PSYCHE_DECK_SIZE
    for sv in (2, 1):
        print(f"  Expected surge tokens/round (2p, 4 draws, +{sv}): {draws_r2plus * p * sv:.2f}")

    for players in (2, 3, 4):
        for strat in STRATEGIES:
            cfg_old = Config(surge_value=2, players=players, rounds=8, length="nap")
            cfg_new = Config(surge_value=1, players=players, rounds=8, length="nap")
            old = run_batch(cfg_old, strat)
            new = run_batch(cfg_new, strat)
            print_comparison(f"{players} dreamers · {strat.name}", old, new)

    # Round-by-round trajectory for engaged 2p
    print("\n== Round-by-round trajectory (2p engaged, +1 surge) ==")
    buckets = {i: [] for i in range(9)}
    cfg = Config(surge_value=1, players=2, rounds=8)
    strat = next(s for s in STRATEGIES if s.name == "engaged")
    for _ in range(RUNS):
        r = simulate_once(cfg, strat)
        for i, v in enumerate(r["timeline"]):
            buckets[i].append(v)
    for i in sorted(buckets):
        if buckets[i]:
            print(f"  Round {i + 1 if i else 'start':>5}: avg {statistics.mean(buckets[i]):.2f}  p90 {sorted(buckets[i])[int(0.9 * len(buckets[i]))]}")

    # Sink vs faucet for engaged 2p over 8 rounds
    print("\n== Faucet breakdown (2p engaged, +1 surge, single run averages) ==")
    surge_g = []
    ms_g = []
    ev_g = []
    spent = []
    for _ in range(RUNS):
        r = simulate_once(cfg, strat)
        surge_g.append(sum(x["surge_gain"] for x in r["round_stats"]))
        ms_g.append(sum(x["ms_gain"] for x in r["round_stats"]))
        ev_g.append(sum(x["event_gain"] for x in r["round_stats"]))
        spent.append(sum(x["spent"] for x in r["round_stats"]))
    start = 2 * 2
    print(f"  Starting grant:        {start}")
    print(f"  Avg from Power Surge:  {statistics.mean(surge_g):.2f}")
    print(f"  Avg from mindstream:   {statistics.mean(ms_g):.2f}")
    print(f"  Avg from events/obj:   {statistics.mean(ev_g):.2f}")
    print(f"  Avg spent (sinks):     {statistics.mean(spent):.2f}")
    print(f"  Avg net held at end:   {statistics.mean([simulate_once(cfg, strat)['final'] for _ in range(200)]):.2f}")

    print("\n== Takeaways ==")
    print("  +1 Power Surge cuts the psyche-deck faucet roughly in half.")
    print("  Inflation at round 2 drops sharply; engaged play should feel tighter.")
    print("  Mindstream (+2) and encounter rewards remain the main surplus sources.")


if __name__ == "__main__":
    main()
