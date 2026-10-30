"""Cook times and diet breadth for Feleco 4.8.

Life-seconds match Kitchen in scripts/game/kitchen.gd.
At the standard 2x pace, one life-second is 2.5 real seconds
(Clock.LIFE_PACE 0.2, speed 2). A day is 24 life-seconds.
"""
COOK = {
    "greens": (0.4, 0.65), "riverweed": (0.55, 0.9), "berry": (0.45, 0.85),
    "apple": (0.95, 1.25), "pineapple": (1.6, 1.7), "pinecone": (0.75, 1.15),
    "mushroom": (0.7, 1.05), "worm": (0.35, 0.7), "beetle": (0.3, 0.75),
    "mouse": (0.35, 0.8), "rabbit": (0.8, 1.05), "robin": (0.55, 1.0),
    "falcon": (1.1, 1.2), "fish": (1.05, 1.15), "sheep": (2.4, 1.2),
    "goat": (2.1, 1.15), "deer": (3.2, 1.45), "boar": (3.4, 1.4),
    "wolf": (2.6, 1.25), "lion": (3.0, 1.35), "bear": (6.2, 1.85),
}
FORBIDDEN = ["human", "corpse", "mycelium", "moss"]
BEAR = ["fish", "berry", "apple", "pinecone", "riverweed", "mushroom", "corpse", "grass", "rabbit", "mouse"]
WOLF = ["sheep", "rabbit", "deer", "goat", "boar", "fish", "mouse", "robin", "corpse"]
LION = ["mouse", "rabbit", "deer", "goat", "sheep", "robin"]

def cook_time(m, q):
    return max(1.6, 1.55 * m * q)

def nutrition(m, q):
    return min(58.0, max(12.0, 12.0 + 9.0 * m * q))

print(f"{'food':<14} {'wait s':>8} {'real s':>8} {'meal':>8}")
for name, (m, q) in COOK.items():
    life = cook_time(m, q)
    print(f"{name:<14} {life:8.1f} {life/0.4:8.1f} {nutrition(m,q):8.1f}")

print()
print("breadth  human", len(COOK), " bear", len(BEAR), " wolf", len(WOLF), " lion", len(LION))
print("forbidden", ", ".join(FORBIDDEN))
print("bear is missing", sorted(set(COOK) - set(BEAR)))
mouse = cook_time(*COOK["mouse"])
bear = cook_time(*COOK["bear"])
print(f"bear wait / mouse wait = {bear/mouse:.1f}x")
