# Ainmos: gameplay video prompts (0.16 "Glimmer")

Two ways to make the one-minute video. **A** feeds a text-to-video generator (Sora, Veo, Runway, Kling). **B** cuts real screen recordings. A generator cannot reproduce the real UI exactly, so A sells the *flow*. For accurate captions on real screens, use B, or mix the two: generated shots for mood, recorded shots for proof.

The flow both versions must make obvious:

**Cycle** = 3 Dreams. Each **Dream** = 3 REM phases: **Reveal → Explore → Meet**. That makes 9 phases per Cycle. **Dream 2** raises a **Mini-Boss** on The Bed, and **Dream 3** ends on the **Boss**. Between Dreams comes the **Lost & Found** shop: unused actions bank gold **Glimmer** that pays there, and an Object can be **let go** for Psyche.

---

## A. Master prompt (paste whole into the generator)

> A 60-second gameplay trailer for a dreamlike solo roguelike card-and-board game, shown as a clean top-down screen capture of the game interface, crisp UI, no people, no hands. Deep indigo-violet night background with drifting nebula haze. In the center, a board of glowing hexagon tiles ("Landscapes"), each painted with a surreal dream scene (a moonlit forest, a drowned city, a staircase into clouds), linked to a central glowing bed tile. Along the bottom, a fanned hand of five tarot-like playing cards in three colors: sky blue (Lucidity), mint green (Elasticity), and ember red (Willpower), each with a big number. A thin bar across the top shows nine small pips in three groups of three, lighting up one by one as phases advance, with a crown icon on the ninth.
>
> Sequence: (1) A full-screen panel slides in titled "Cycle 1", showing three Dream cards side by side: a face-down card, a horned beast portrait marked "Mini-Boss", and a towering serpent portrait marked "Boss". (2) A blue card lifts out of the hand. New hex tiles flip up and click into place beside the bed, with soft light blooms. (3) A green card is played. A small glowing pawn glides across three hexes while shadowy creatures on other tiles slide one hex toward it. (4) A red card is played. Three dice roll in a burst of sparks, two land on 6, and the creature shatters into violet motes. (5) Leftover action icons dissolve into golden sparkles that fly to a counter labeled "✧ Glimmer" and make it pulse. (6) A cozy shop window, "Lost & Found", with three odd trinket cards: a brass skeleton key, a seashell, a stick. A price "3" is struck through and drops to "0" as gold Glimmer pours onto it. (7) A huge serpent Boss rises over the board, the crown pip glows, and dice roll in slow motion. The Boss breaks apart into light, and three glowing reward cards fan out to choose from. (8) A dawn wash of pale gold and the pips reset: "Cycle 2".
>
> Style: painterly dark-fantasy dream art inside a sleek modern game UI, soft bloom, gentle parallax, snappy 0.2-second UI animations, satisfying card flips and pops. Camera: locked top-down with occasional slow push-ins on the action. Mood: mysterious, cozy, tense in the fights. No text other than the short labels described. 16:9, 1080p, 24 fps.

**Negative prompt** (if supported): pixel art, playing-card suits, poker chips, casino, CRT scanlines, Balatro, real hands, people, cluttered text, watermark, blurry UI, distorted numbers.

### Per-shot prompts (for generators capped at 5–10 s per clip)

Use the master prompt's style line at the end of each.

| # | Length | Prompt | Caption (add in edit) |
|---|---|---|---|
| 1 | 6 s | A full-screen dark violet panel slides in titled "Cycle 1". Three cards fan out: face-down Dream, horned Mini-Boss portrait, giant serpent Boss portrait. A nine-pip tracker glows above them in three groups of three. | "A Cycle: 3 Dreams. 9 phases." |
| 2 | 5 s | A storm-grey Dream card flips face up with a shiver of static. Two cards from the hand below crumble into ash. | "Every Dream hurts. Endure it." |
| 3 | 8 s | Reveal: a blue card rises from the fanned hand. Painted hex tiles flip up one by one and click into place around a glowing bed tile. The first pip lights. | "Reveal: build the dream." |
| 4 | 8 s | Explore: a green card is played. A glowing pawn glides across hexes while shadowy beasts on nearby tiles lurch one hex toward it. The second pip lights. | "Explore: they chase you." |
| 5 | 9 s | Meet: a red card is played. Dice roll in a burst of sparks, sixes glow, and the beast shatters into violet light. The third pip lights. | "Meet: fight with your hand." |
| 6 | 6 s | Unused action icons dissolve into gold sparkles that stream into a "✧ Glimmer" counter, which pulses brighter. | "Leftover actions become Glimmer." |
| 7 | 8 s | A cozy shop window, "Lost & Found", with three trinket cards on a shelf. Gold Glimmer pours onto a price tag, which drops from 3 to 0. One trinket card slides into the hand while an old one dissolves into three new playing cards. | "Glimmer pays. Let go for cards." |
| 8 | 6 s | A horned Mini-Boss bursts up from the bed tile in red smoke and growls at the pawn. | "Dream 2: a Mini-Boss wakes." |
| 9 | 10 s | The ninth pip, a crown, ignites. A colossal serpent Boss coils over the board. Slow-motion dice tumble, land, and the Boss breaks into streams of light. Three glowing reward cards fan out. | "Dream 3: the Boss. Beat it, choose a Boon." |
| 10 | 4 s | A pale gold dawn washes over the board. The pips reset and a title card reads "AINMOS". | "Climb the Cycles. Wake." |

Total ≈ 70 s. Trim shots 2 and 8 to land at 60.

---

## B. Screen-recording cut (accurate UI)

Record at 1920×1080 on `play.html` in a fresh **Daydream** with one Dreamer (a seed such as `FIRSTNIGHT` makes it repeatable). Use the dev page only for setup, and crop out the Dev button.

| # | Time | Record | Caption |
|---|---|---|---|
| 1 | 0–5 s | The **Cycle screen**: the 9-phase map, Mini-Boss, Boss, the Boss ladder. Tap **Begin Cycle 1 →** | "3 Dreams. 9 phases. A Boss at the end." |
| 2 | 5–9 s | The Dream screen. Tap **Endure it** | "Every Dream hurts." |
| 3 | 9–16 s | The Reveal opener fan. Tap a Lucidity card, then **Open Reveal**. The Vault screen: **Dream it**, then a glowing hex | "Reveal: build the dream." |
| 4 | 16–22 s | Explore starts: the beasts step toward you. Open Explore and walk | "Explore: they chase you." |
| 5 | 22–32 s | Meet: pick 1–3 Psyche on the beast's hex; the dice roll; it falls | "Meet: fight with your hand." |
| 6 | 32–36 s | Tap **Next Phase** with actions left. The **Glimmer** pill pulses | "Unused actions bank Glimmer ✧." |
| 7 | 36–44 s | The **Lost & Found**: the struck-through price, **Take it**, then the **Let go · draw N Psyche** choice | "Glimmer pays. Let go for Psyche." |
| 8 | 44–48 s | Dream 2: the Mini-Boss rises on The Bed | "Dream 2: the Mini-Boss." |
| 9 | 48–56 s | Phase 9: beat the Boss → the Boon draft → pick one | "Dream 3: the Boss. Choose a Boon." |
| 10 | 56–60 s | The next Cycle screen with Boss 2 lit on the ladder | "Climb. Wake." |

Editor prompt: *Cut these clips into a 60-second trailer. Keep the game visuals untouched. Add one-line captions (4–8 words, soft white serif, bottom center), a slow push-in on whatever is tapped, a soft glow ring on each tap, quick cross-fades, the game's dreamy track low under it, and end on the title and "Play free at dva-nu.vercel.app/ainmos".*
