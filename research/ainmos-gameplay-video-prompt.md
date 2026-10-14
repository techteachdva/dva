# Ainmos: one-minute "how to play" video

A 60-second screen recording of real play (Ainmos 0.11+), cut to show a new player where to look and what to tap. No narration needed; on-screen captions carry it. Record at 1920×1080 (desktop) in a fresh Daydream with one Dreamer. A seeded run makes it repeatable: enter a seed such as `FIRSTNIGHT` on the menu.

## Prompt (for an editor, or a video tool that cuts from your clips)

> Cut a 60-second tutorial trailer for **Ainmos**, a solo roguelike card-and-board game, from the supplied gameplay clips. Keep the game's own visuals untouched; add only short captions (one line, 4–8 words, soft white serif, bottom center), a gentle zoom/pan to point at what is being clicked, and a soft glow ring on each click. Pace: one idea per shot, 3–6 seconds each, quick cross-fades. Music: the game's own dreamy track, low. End on the title card and "Play free at dva-nu.vercel.app/ainmos".

## Shot list (≈60 s)

| # | Time | What to record | Caption |
|---|------|----------------|---------|
| 1 | 0–4 s | Menu: tap a Dreamer card, then **Begin Dreaming** | "Choose one Dreamer." |
| 2 | 4–9 s | The **Ante screen**: Dream, Mini-Boss, Boss; tap **Enter Ante 1** | "Each Ante: a Dream, a Mini-Boss, a Boss." |
| 3 | 9–13 s | The **Dream screen**; tap **Endure it** | "Every Dream hurts. Endure it." |
| 4 | 13–18 s | **Build the dream** opener: tap a Lucidity card, watch the number, tap **Open Reveal** | "Spend Lucidity to build." |
| 5 | 18–25 s | The **Dreamscape Vault**: point at a **Quest** tag, tap **Dream it**, tap a glowing hex | "Pick a Landscape. Place it beside the dream." |
| 6 | 25–30 s | Explore opener, then tap glowing hexes to walk toward a beast | "Spend Elasticity to walk." |
| 7 | 30–40 s | Meet opener; select 1–3 Psyche on the beast's hex; the dice roll; the beast falls | "Spend Willpower. Fight with 1–3 cards." |
| 8 | 40–44 s | Hover the Night Bar: the Mini-Boss and Boss portraits | "The Night Bar shows what's coming." |
| 9 | 44–50 s | The **Lost & Found**: tap **Take it** on an Object, then **Into the Dream →** | "Shop between rounds. Psyche is coin." |
| 10 | 50–56 s | Beat a Boss → the **Boon** draft; pick one | "Beat a Boss. Choose a Boon." |
| 11 | 56–60 s | Title card | "Climb the Bosses. Wake." |

## Recording tips

- Use the dev page (`play.html?dev=1`) only for setup; hide the Dev button before recording, or crop it out.
- For shot 7, a seeded Daydream with the Hunter usually meets the first Mini-Boss on round 2. Retake until the dice land in your favor; ties go to the Dreamer.
- For shot 10, `/ai start` in the dev console can carry a run to the first Boss quickly; stop it and play the Boss fight by hand for the clip.
- Mobile cut: re-record shots 3–5 at 1280×720 sideways for an itch.io/phone version.
