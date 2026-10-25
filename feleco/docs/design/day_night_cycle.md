# Feature Spec: Day & Night, and the Length of a Run

Status: v0.2 (implemented) · 2026-10-25 · Owner: Philip
Related: `betting_table.md` (bets are priced in days), `docs/DESIGN.md` §7

## 1. Why
- **Runs are too quick and too jumpy.** Today one sim second is one game day, so a 12-month run is 360 days, or 6 minutes at 1×. At 5× the seasons blur past and births and deaths fire faster than anyone can follow.
- **There is no day and night,** which is a big missed chance for mood, rhythm and strategy.

### Goals
- Every run is **15 minutes or less** at 1×.
- **A calm rhythm the player can feel:** sun, then moon, then sun again, never a flicker.
- **Day and night change behaviour:** night belongs to some species and day to others, and the player can buy and use powers that lean on that.
- **Fewer, longer-lived characters,** so the story and the bets have time to breathe.

## 2. The clock (all in `scripts/game/clock.gd`)
| Constant | Value | Meaning |
|---|---|---|
| `SECONDS_PER_DAY` | **120** (sim seconds) | One full day: **1 minute at the standard 2×** (30 s sun, 30 s moon); 2 minutes at 1× |
| `DAYLIGHT` | 0.5 | Share of the day that is lit |
| `TWILIGHT` | 10 s sim | Dawn and dusk blend over 5 s each at 2×, so the light glides between day and night |
| `LIFE_PACE` | **0.2** | Everything ecological runs at 20% of real time: hunger, breeding, ageing, **eating, fighting, hunting, abilities**, grass, rot, corpses, trees, power timers. Only *movement* is real-time |
| `BIO_PER_DAY` | 24 | = `SECONDS_PER_DAY × LIFE_PACE`: how much "life" passes in one day |

**These are the two knobs for run length and pace:**
- `SECONDS_PER_DAY` sets how long a day feels.
- `LIFE_PACE` sets how many births and deaths happen per day.
- Raising either one slows the story down without touching any species' tuning.

### Run lengths
A run is **one compressed year**. Every run, whatever its length, has all four seasons, a quarter of the run each, so Spring floods and Autumn mushrooms happen in every run.

| Run | Days | 1× (slow, gritty) | **2× (standard, runs start here)** | 4× (fast) |
|---|---|---|---|---|
| Short | **5** | 10 min | **5 min** | 2.5 min |
| Standard | **10** | 20 min | **10 min** | 5 min |
| Long | **15** | 30 min | **15 min** | 7.5 min |

- **Speed buttons are 1×, 2× and 4×**, and every run starts at 2×.
- At 4×, a day lasts 30 s: 15 s of sun and 15 s of moon.
- Campaign and Challenge use **Standard (10 days)**.
- Time Dilation becomes **+1 day**.

### Lifespans (redone, in days)
Lifespans are now set in days, in one table (`Clock.LIFESPAN_DAYS`). Each species' `_lifespan` = days × `BIO_PER_DAY`.

| Species | Days | Bio units |
|---|---|---|
| human | **5** | 120 (builder ×0.92, wizard ×1.17) |
| falcon | **3.75** | 90 |
| boar | **3.5** | 84 |
| sheep | **3.5** | 84 |
| wolf | **3.25** | 78 |
| robin | **3** | 72 |
| mushroom | **2.5** | 60 |
| worm | **2** | 48 |
| rabbit | **1.75** | 42 |
| fish | **1.75** | 42 |

These are close to the lifespans the ecosystem was originally balanced on. An earlier draft with longer lives (humans 7 days, wolves 5) made the predators boom in the sims.

- The existing ageing rules are unchanged: no old-age death before 75% of lifespan, eating can extend life by up to 50%, and death is certain at 2.5×.
- **Result:** in a Standard run, humans, falcons and wolves (your guess) can live the whole run, while rabbits and fish turn over two or three generations.

## 3. Day and night rules
`daylight` runs from 0 to 1: 1 at noon, 0 at midnight, with a smooth blend at dawn and dusk. `night` = 1 − daylight. Each species has multipliers that blend with `night`.

| Species | Kind | By day | By night |
|---|---|---|---|
| Sheep | diurnal | Graze | **Huddle and doze:** speed ×0.45, hunger ×0.7 |
| Rabbit | crepuscular | Normal | **Dawn and dusk:** speed ×1.2, breeding ×1.4. Deep night: hidden, speed ×0.5 |
| Human | diurnal | Work, build, hunt | **Home by the fire:** speed ×0.5, no building, hunger ×0.8 |
| Falcon | diurnal | Soar and hunt | **Roost:** speed ×0.25, hunger ×0.6 |
| Robin | diurnal | Hop, forage | **Roost:** speed ×0.3. **Dawn chorus:** breeding ×1.5 at dawn |
| Wolf | **nocturnal** | Rest, speed ×0.8 | **Hunt:** speed ×1.3, hunger ×1.1 |
| Boar | **nocturnal** | Wallow, speed ×0.8 | **Root:** speed ×1.2, breeding ×1.2 |
| Worm | **nocturnal** | Deep, speed ×0.7 | **Surface:** speed ×1.3, breeding ×1.4 |
| Fish | crepuscular | Normal | Rise at dawn and dusk: breeding ×1.3 |
| Mushroom | **nocturnal** | Still | **Fruit and glow:** spread ×1.6 |

What this produces on screen:
- Wolves and boars come alive at night while sheep and villagers hold still.
- Falcons vanish into roosts, so robins and rabbits are safer by night but wolves catch more.
- At dawn there is a burst of songbirds and rabbits.

### Look
- **Sun:** the sun's light sweeps across the sky over the 30 s day, from warm at dawn to white at noon to amber at dusk.
- **Night:** a cool blue moonlight at 15% energy, with ambient light going from the season's colour to deep blue.
- **Creatures:** sprites are tinted by night (cool blue, 45% darker). Glowing things (the wizard's orb, glowworms, golden koi, mushroom caps) stay bright, so night shows off the special kinds.
- **HUD:** the clock shows a sun or moon icon, and the day count reads "Day 4 · night".

### Homes and sleep (humans)
- **Beds:** every villager is given a bed in a hut of their tribe, 4 to a hut. Huts are cottage-sized (72% of the old long-house) and carry a small badge showing occupancy, such as `3/4`.
- **Night:** at night villagers walk home and go indoors. Indoors they are hidden and can't be attacked, and they burn energy at 35% of the usual rate.
- **Children:** a couple sharing a hut has a 35% chance of a child each night. A tribe with no huts at all still pairs off outdoors, so it can get started.
- **No bed:** a villager without a bed sleeps rough, burning energy at 1.5× the usual rate, and wakes **Cranky!** (−6 energy).
- **Building:** builders add a hut whenever anyone in their tribe has no bed.
- **Placement:** nothing is placed in the river or on its flood plain (huts, trees, starting spawns).

### Ecology updates (same pass)
- **Who eats fish:** humans, wolves and falcons. Robins and boars don't. Fish in the current now escape 35% of the time (was 50%).
- **Fish numbers:** 8 at the start (was 12); the river holds 32 (was 50). Stranded fish still die when floods recede.
- **Corpses:** a corpse always feeds both the grass and the mycelium. Mycelium feeds the grass and fruits mushrooms where it is thick.
- **Trees:** felling a mature tree leaves a stump that regrows into a sapling. Apples fall 1.6–3.2 m from the trunk and settle on the ground, and fallen apples can seed new trees. The valley holds up to 48 trees.

## 4. Powers (reworked) and their EP costs
Durations are in **days**. Power timers run on life time (`LIFE_PACE`), so their effect on the ecosystem doesn't change if the clock is retuned.

| Power | Cost (EP) | Effect |
|---|---|---|
| Rain | 12 | Grass ×2.2 for 1 day; mushrooms and worms surge |
| Flood | 18 | The river rises for ½ day, then recedes (adds to the Flood Toll) |
| Famine | 20 | Grass ×¼ for 1 day |
| Heal | 10 | Your champion's kin: +25 health and energy |
| Call Kin | 25 | 2 of your champion's kind arrive |
| Meteor | 35 | 20% of whoever holds the valley is culled |
| **Eclipse** (new) | 30 | Night falls at once for ½ day |
| **Midnight Sun** (new) | 30 | The next night never comes: the sun holds for a full day |
| **Full Moon** (new) | 15 | Tonight nocturnal species get ×1.5 on their night bonuses |
| **Lantern Night** (new) | 15 | Tonight villagers and sheep near huts are safe from hunters |

## 5. Shop perks (permanent)
| Perk | Cost (EP) | Effect |
|---|---|---|
| Long Days | 150 | Day 40 s, night 20 s |
| Long Nights | 150 | Day 20 s, night 40 s |
| Night Owl | 120 | Your champion ignores its night penalty (or, for nocturnal species, its day penalty) |
| Moonlit Harvest | 100 | Mushrooms and worms +25% at night |
| Dawn Chorus | 80 | Dawn and dusk last twice as long |
| Time Dilation (changed) | 300 | +1 day to every run |

## 6. Effects on the betting table
- Bets are now priced in days. `BetBook.LIFESPAN` reads `Clock.LIFESPAN_DAYS`.
- "Dies early" means the first half of the run, in days.
- The Flood Toll's natural floods use the new Spring, which is a quarter of the run.

## 7. Open questions
1. Should night also hide creatures from the player (fog of war), or stay fully readable?
2. Should the champion get a free Lantern Night or Full Moon to match its kind?
3. Should Long runs be 15 days, or 12 for a tidier "one day per month"?
