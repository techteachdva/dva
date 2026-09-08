#!/usr/bin/env python3
"""
Autonomous Somnia full-game simulator (cooperative engaged bot).

Plays nap/daydream/deep sessions to win or dream-deck loss, using real JSON data
for archetypes, dreams, and deck composition. Power Surge uses current +1 grant.

Run: py scripts/somnia-full-game-sim.py
     py scripts/somnia-full-game-sim.py --seed 42 --verbose
"""

import argparse
import json
import random
import statistics
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src" / "site" / "somnia" / "data"

MAX_POOL = 24
PSYCHE_STARTING_HAND = 5
PSYCHE_POWER_COUNT = 6
PSYCHE_DECK_SIZE = 57
PSYCHE_POWER_GRANT = 1
STARTING_POWER = 1
DRAWS_AFTER_R1 = 2
MINDSTREAM_DECK_SIZE = 70
MINDSTREAM_POWER_PER_SUIT = 6
MINDSTREAM_POWER_VALUE = 2
MINDSTREAM_POWER_EVENT_RATE = 4 / 70  # centering, shining wind, flashing lights, undulating floor
OBJECT_DRAW_RATE = 16 / 70
COINS_RATE = 1 / 16  # one Coins object per suit in object pool

LENGTHS = {
    "daydream": {"points": 12, "dreams": 14},
    "nap": {"points": 18, "dreams": 17},
    "deep": {"points": 24, "dreams": 21},
}

BOSS_IDS = ("cerberus", "double", "leviathan")
BOSS_SLOTS = (2, 5, 8)


@dataclass
class BotConfig:
    """Engaged cooperative table — explores, meets, spends on quests."""
    mindstream_draws: int = 3
    quest_spend_priority: bool = True
    dreamer_power_chance: float = 0.12  # spend 1 power on archetype power when flush
    object_power_chance: float = 0.04  # coins-like object per meet round
    encounter_reject_chance: float = 0.12
    landscapes_revealed_per_round: float = 2.5


@dataclass
class RoundLog:
    round: int
    dream: str | None = None
    points: int = 0
    archetype: str | None = None
    quests: tuple[bool, bool] = (False, False)
    power_held: int = 0
    power_gained: int = 0
    power_spent: int = 0
    surge_hits: int = 0
    archetypes_gained: list[str] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)


def load_json(name):
    with open(DATA / f"{name}.json", encoding="utf-8") as f:
        return json.load(f)


def shuffle(deck):
    copy = deck[:]
    random.shuffle(copy)
    return copy


def build_psyche_deck():
    dist = {1: 5, 2: 4, 3: 3, 4: 2, 5: 1}
    deck = []
    for suit in ("lucidity", "elasticity", "willpower"):
        for value, copies in dist.items():
            deck += [{"type": "psyche", "suit": suit, "value": value}] * copies
    deck += [{"type": "wild"}] * 6
    deck += [{"type": "psyche-power", "powerTokens": PSYCHE_POWER_GRANT}] * PSYCHE_POWER_COUNT
    return shuffle(deck)


def build_dream_deck(dreams, dreambeasts, session_count):
    regular = [d for d in dreams if d.get("type") not in ("final", "boss-dream")]
    picked = shuffle(regular)[: min(session_count, len(regular))]
    finals = [d for d in dreams if d.get("type") == "final" and d["id"] != "you-never-wake"]
    never_wake = next((d for d in dreams if d["id"] == "you-never-wake"), None)
    deck = picked + shuffle(finals)
    if never_wake:
        deck.append(never_wake)

    bosses = []
    for bid in BOSS_IDS:
        beast = next((b for b in dreambeasts if b["id"] == bid), None)
        if beast:
            bosses.append({**beast, "type": "boss-dream", "id": bid, "name": beast["name"]})
    for idx, boss in enumerate(bosses):
        slot = BOSS_SLOTS[idx] if idx < len(BOSS_SLOTS) else len(deck)
        deck.insert(min(slot, len(deck)), boss)
    return deck


def grant(held, amount):
    total = sum(held)
    return min(max(0, amount), max(0, MAX_POOL - total))


def spend_power(held, amount):
    left = amount
    spent = 0
    for i in range(len(held)):
        while left > 0 and held[i] > 0:
            held[i] -= 1
            left -= 1
            spent += 1
    return spent


def quest_kind(text):
    t = text.lower().strip()
    if "have 10 psyche" in t or "1 dreamer holds 10 psyche" in t:
        return "psyche10"
    if t.startswith("meet ") and any(b in t for b in ("cerberus", "double", "leviathan")):
        return "boss"
    if t.startswith("draw mindstream"):
        return "mindstream"
    if t.startswith("meet a dreambeast"):
        return "meet_beast"
    return "other"


def create_tracker():
    return {
        "meet_boss": {b: False for b in BOSS_IDS},
        "mindstream_landscapes": set(),
        "meet_landscapes": set(),
        "max_dreamer_psyche": PSYCHE_STARTING_HAND,
    }


def quest_ready(tracker, quest_text):
    kind = quest_kind(quest_text)
    t = quest_text.lower()
    if kind == "psyche10":
        return tracker.get("max_dreamer_psyche", 0) >= 10
    if kind == "boss":
        for b in BOSS_IDS:
            if b in t and tracker["meet_boss"][b]:
                return True
        return False
    if kind == "mindstream":
        # engaged play eventually hits a matching landscape
        return len(tracker["mindstream_landscapes"]) >= 1 or random.random() < 0.35
    if kind == "meet_beast":
        return len(tracker["meet_landscapes"]) >= 1 or random.random() < 0.28
    return random.random() < 0.25


def update_tracker_round(tracker, bot, bosses_met):
    tracker["max_dreamer_psyche"] = min(
        10,
        tracker.get("max_dreamer_psyche", PSYCHE_STARTING_HAND) + random.randint(0, 2),
    )
    for _ in range(int(bot.landscapes_revealed_per_round)):
        tracker["mindstream_landscapes"].add(random.choice(["the-attic", "desert", "awards", "sea-of-teeth"]))
    for _ in range(bot.mindstream_draws):
        if random.random() < 0.3:
            tracker["meet_landscapes"].add(random.choice(["awards", "the-party", "endless-ocean"]))
    for b in bosses_met:
        tracker["meet_boss"][b] = True


def mindstream_power(held, draws):
    gained = 0
    p_card = MINDSTREAM_POWER_PER_SUIT / MINDSTREAM_DECK_SIZE
    for _ in range(draws):
        if random.random() < p_card:
            pi = random.randrange(len(held))
            g = grant(held, MINDSTREAM_POWER_VALUE)
            held[pi] += g
            gained += g
        elif random.random() < MINDSTREAM_POWER_EVENT_RATE:
            pi = random.randrange(len(held))
            g = grant(held, random.choice([1, 2]))
            held[pi] += g
            gained += g
        elif random.random() < OBJECT_DRAW_RATE * COINS_RATE:
            for pi in range(len(held)):
                g = grant(held, 1)
                held[pi] += g
                gained += g
    return gained


def draw_psyche(state, player_idx, count):
    surge_hits = 0
    surge_tokens = 0
    for _ in range(count):
        if not state["deck"]:
            if state["discard"]:
                state["deck"] = shuffle(state["discard"])
                state["discard"] = []
            else:
                break
        card = state["deck"].pop(0)
        if card["type"] == "psyche-power":
            surge_hits += 1
            t = grant(state["held"], card.get("powerTokens", PSYCHE_POWER_GRANT))
            state["held"][player_idx] += t
            surge_tokens += t
        else:
            state["discard"].append(card)
    return surge_hits, surge_tokens


def deal_starting(state, player_idx, count):
    hand = []
    deferred = []
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
    return len(hand)


def spend_power_collectively(held, amount):
    left = max(0, amount)
    spent = 0
    order = sorted(range(len(held)), key=lambda i: held[i], reverse=True)
    for i in order:
        while left > 0 and held[i] > 0:
            held[i] -= 1
            left -= 1
            spent += 1
    return spent


def apply_timeline_hunger(state, board_beasts, goal_points, log):
    if board_beasts <= 0:
        return
    paid = spend_power_collectively(state["held"], board_beasts)
    unpaid = board_beasts - paid
    if paid:
        log.notes.append(f"Timeline hunger: {paid} power spent")
    if unpaid <= 0:
        return
    discarded = 0
    for _ in range(unpaid):
        if not state["dream_deck"]:
            break
        state["dream_deck"].pop(0)
        discarded += 1
    if discarded:
        log.notes.append(f"Timeline frays: {discarded} dream(s) discarded")
    if not state["dream_deck"] and state["points"] < goal_points:
        state["status"] = "lost"


def spawn_beasts_from_dream(dream, players):
    n = 0
    dream_id = dream.get("id", "")
    if dream.get("type") == "boss-dream" or dream.get("boss"):
        n += 1
    elif dream_id in ("chase", "powerlessness", "rivalry"):
        n += players
    return n


def resolve_beasts_on_board(board_beasts, bot):
    """Engaged tables Meet most spawns; casual leaves more roaming."""
    meet_rate = 0.15 + bot.mindstream_draws * 0.22
    resolved = 0
    while board_beasts > 0 and random.random() < meet_rate:
        board_beasts -= 1
        resolved += 1
    return board_beasts, resolved


def try_complete_quests(state, tracker, bot, log):
    arch = state["active_archetype"]
    if not arch:
        return
    spent = 0
    for qi, done in enumerate(arch["quest_progress"]):
        if done:
            continue
        if not quest_ready(tracker, arch["quests"][qi]):
            continue
        # spend 1 power from richest player
        pi = max(range(len(state["held"])), key=lambda i: state["held"][i])
        if state["held"][pi] < 1:
            continue
        spend_power(state["held"], 1)
        spent += 1
        arch["quest_progress"][qi] = True
        log.notes.append(f"Quest {qi + 1}: {arch['quests'][qi]}")
    if arch["quest_progress"][0] and arch["quest_progress"][1]:
        state["points"] += arch["points"]
        log.archetypes_gained.append(arch["name"])
        state["acquired"].append(arch["name"])
        state["active_archetype"] = state["archetype_deck"].pop(0) if state["archetype_deck"] else None
        if state["active_archetype"]:
            state["active_archetype"]["quest_progress"] = [False, False]


def play_full_game(
    seed=None,
    length_key="nap",
    players=2,
    bot=None,
    verbose=False,
):
    if seed is not None:
        random.seed(seed)
    bot = bot or BotConfig()
    length = LENGTHS[length_key]
    dreams = load_json("dreams")
    dreambeasts = load_json("dreambeasts")
    archetypes = shuffle(load_json("archetypes"))

    dream_deck = build_dream_deck(dreams, dreambeasts, length["dreams"])
    archetype_deck = [{**a, "quest_progress": [False, False]} for a in archetypes[1:]]
    active = {**archetypes[0], "quest_progress": [False, False]}

    held = [0] * players
    for p in range(players):
        g = grant(held, STARTING_POWER)
        held[p] += g

    state = {
        "held": held,
        "deck": build_psyche_deck(),
        "discard": [],
        "points": 0,
        "dream_deck": dream_deck,
        "dreams_drawn": 0,
        "archetype_deck": archetype_deck,
        "active_archetype": active,
        "acquired": [],
        "status": "playing",
        "board_beasts": 0,
    }

    tracker = create_tracker()
    round_logs = []
    round_num = 0
    max_rounds = len(dream_deck) + 5

    while state["status"] == "playing" and round_num < max_rounds:
        round_num += 1
        log = RoundLog(
            round=round_num,
            points=state["points"],
            archetype=state["active_archetype"]["name"] if state["active_archetype"] else None,
            quests=tuple(state["active_archetype"]["quest_progress"]) if state["active_archetype"] else (False, False),
            power_held=sum(state["held"]),
        )

        bosses_met = []
        if state["dream_deck"]:
            dream = state["dream_deck"].pop(0)
            state["dreams_drawn"] += 1
            log.dream = dream.get("name", dream.get("id", "?"))
            if dream.get("type") == "boss-dream" or dream.get("boss"):
                bosses_met.append(dream["id"])
            spawned = spawn_beasts_from_dream(dream, players)
            if spawned:
                state["board_beasts"] += spawned
                if spawned == 1 and (dream.get("type") == "boss-dream" or dream.get("boss")):
                    log.notes.append(f"Boss dream: {log.dream}")
                elif spawned > 1:
                    log.notes.append(f"Dream spawns {spawned} encounter(s)")
            elif dream.get("id") == "powerlessness":
                log.notes.append("Powerlessness (encounters)")
        else:
            if state["points"] < length["points"]:
                state["status"] = "lost"
                log.notes.append("Dream deck exhausted")
            break

        gained = 0
        spent = 0
        surge_hits = 0

        if round_num >= 2:
            for p in range(players):
                h, t = draw_psyche(state, p, DRAWS_AFTER_R1)
                surge_hits += h
                gained += t

        update_tracker_round(tracker, bot, bosses_met)
        gained += mindstream_power(state["held"], bot.mindstream_draws)

        for _ in range(bot.mindstream_draws):
            if random.random() < 0.22:
                state["board_beasts"] += 1

        state["board_beasts"], _resolved = resolve_beasts_on_board(state["board_beasts"], bot)

        if bot.encounter_reject_chance and random.random() < bot.encounter_reject_chance:
            pi = random.randrange(players)
            g = grant(state["held"], 1)
            state["held"][pi] += g
            gained += g

        if bot.dreamer_power_chance and sum(state["held"]) >= 8 and random.random() < bot.dreamer_power_chance:
            spent += spend_power(state["held"], 1)

        try_complete_quests(state, tracker, bot, log)

        apply_timeline_hunger(state, state["board_beasts"], length["points"], log)
        if state["status"] == "lost":
            round_logs.append(log)
            break

        log.power_held = sum(state["held"])
        log.power_gained = gained
        log.power_spent = spent
        log.surge_hits = surge_hits
        log.points = state["points"]
        if state["active_archetype"]:
            log.archetype = state["active_archetype"]["name"]
            log.quests = tuple(state["active_archetype"]["quest_progress"])
        round_logs.append(log)

        if verbose:
            arch_q = ""
            if log.archetype:
                arch_q = f" | {log.archetype} [{int(log.quests[0])}{int(log.quests[1])}]"
            extra = f" — {', '.join(log.notes)}" if log.notes else ""
            print(
                f"R{log.round:2d} dream={log.dream or '-':18s} "
                f"pts={log.points:2d}/{length['points']} power={log.power_held:2d} "
                f"(+{log.power_gained}/-{log.power_spent} surge×{log.surge_hits})"
                f"{arch_q}{extra}"
            )
            if log.archetypes_gained:
                print(f"     >> Acquired: {', '.join(log.archetypes_gained)}")

        if state["points"] >= length["points"]:
            state["status"] = "won"
            break

        if not state["dream_deck"] and state["points"] < length["points"]:
            state["status"] = "lost"

    return {
        "seed": seed,
        "length": length_key,
        "players": players,
        "status": state["status"],
        "rounds": round_num,
        "points": state["points"],
        "goal": length["points"],
        "archetypes": state["acquired"],
        "archetype_count": len(state["acquired"]),
        "final_power": sum(state["held"]),
        "dreams_drawn": state["dreams_drawn"],
        "dreams_left": len(state["dream_deck"]),
        "round_logs": round_logs,
    }


def run_batch(n, **kwargs):
    results = [play_full_game(seed=1000 + i, **kwargs) for i in range(n)]
    wins = [r for r in results if r["status"] == "won"]
    losses = [r for r in results if r["status"] == "lost"]
    rounds = [r["rounds"] for r in results]
    power = [r["final_power"] for r in results]
    arch_n = [r["archetype_count"] for r in results]

    return {
        "runs": n,
        "wins": len(wins),
        "losses": len(losses),
        "win_rate": len(wins) / n,
        "rounds_avg": statistics.mean(rounds),
        "rounds_p50": sorted(rounds)[n // 2],
        "power_avg": statistics.mean(power),
        "archetypes_avg": statistics.mean(arch_n),
        "loss_avg_points": statistics.mean([r["points"] for r in losses]) if losses else 0,
        "results": results,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--seed", type=int, default=4242)
    parser.add_argument("--verbose", action="store_true")
    parser.add_argument("--batch", type=int, default=2000)
    parser.add_argument("--length", default="nap", choices=LENGTHS)
    parser.add_argument("--players", type=int, default=2)
    args = parser.parse_args()

    print("Somnia Full-Game Simulator")
    print(f"  Power Surge: +{PSYCHE_POWER_GRANT} · Pool cap {MAX_POOL}")
    print(f"  Session: {args.length} ({LENGTHS[args.length]['points']} pts, {LENGTHS[args.length]['dreams']} dreams)")
    print(f"  Bot: engaged coop ({BotConfig().mindstream_draws} mindstream/round)\n")

    print(f"=== Sample playthrough (seed {args.seed}) ===")
    game = play_full_game(
        seed=args.seed,
        length_key=args.length,
        players=args.players,
        verbose=True,
    )
    print()
    print(f"Result: {game['status'].upper()} in {game['rounds']} rounds")
    print(f"  Points: {game['points']}/{game['goal']}")
    print(f"  Archetypes ({game['archetype_count']}): {', '.join(game['archetypes']) or 'none'}")
    print(f"  Final power held: {game['final_power']}")
    print(f"  Dreams drawn: {game['dreams_drawn']} · left: {game['dreams_left']}")

    # Power timeline from sample
    if game["round_logs"]:
        print("\n  Power timeline:")
        for rl in game["round_logs"]:
            bar = "+" * rl.power_gained + "-" * rl.power_spent
            print(f"    R{rl.round:2d}: {rl.power_held:2d} tokens  {bar or '·'}")

    print(f"\n=== Batch ({args.batch} games, 2p nap) ===")
    batch = run_batch(args.batch, length_key=args.length, players=args.players)
    print(f"  Win rate: {batch['win_rate']:.1%} ({batch['wins']}/{batch['runs']})")
    print(f"  Rounds to finish: avg {batch['rounds_avg']:.1f}, median {batch['rounds_p50']}")
    print(f"  Archetypes acquired: avg {batch['archetypes_avg']:.1f}")
    print(f"  Final power (unspent): avg {batch['power_avg']:.1f}")
    if batch["losses"]:
        print(f"  Losses avg points: {batch['loss_avg_points']:.1f}/{LENGTHS[args.length]['points']}")

    # Archetype frequency in wins
    win_arch = Counter()
    for r in batch["results"]:
        if r["status"] == "won":
            win_arch.update(r["archetypes"])
    if win_arch:
        top = win_arch.most_common(6)
        print(f"  Common acquisitions: {', '.join(f'{n}({c})' for n, c in top)}")

    print("\n== Analysis ==")
    if batch["win_rate"] >= 0.7:
        print("  Nap length is achievable at a healthy rate for engaged coop.")
    elif batch["win_rate"] >= 0.4:
        print("  Win rate is moderate — dream deck pressure is meaningful.")
    else:
        print("  Win rate is low — table may be running out of dreams before 18 pts.")
    if batch["power_avg"] > 6:
        print(f"  Power surplus remains high (avg {batch['power_avg']:.1f}) — quest sinks may still lag faucets.")
    elif batch["power_avg"] < 2:
        print(f"  Power is tight at game end (avg {batch['power_avg']:.1f}) — economy feels constrained.")
    else:
        print(f"  End-game power (avg {batch['power_avg']:.1f}) looks reasonable for +{PSYCHE_POWER_GRANT} Surge.")


if __name__ == "__main__":
    main()
