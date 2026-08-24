# Curt's Birthday Movie Kahoot

50-question blockbuster movie trivia pack for **12–13 players**. Horror-heavy (Curt-approved), accessible but nerdy, spanning **1990s → 2026**.

## What's in this folder

| File | Purpose |
|------|---------|
| `questions.json` | Source of truth — edit questions here, then rebuild |
| `curt-birthday-movies-kahoot.pdf` | **Upload this to Kahoot AI** (PDF question extractor) |
| `curt-birthday-movies-kahoot.xlsx` | Alternative: spreadsheet import |
| `curt-birthday-movies-kahoot.tsv` | Tab-separated backup (paste into Excel if needed) |
| `host-guide.html` | Printable answer key with **local** poster images — open from this folder |
| `posters/` | Bundled movie poster JPGs (used by host guide) |
| `build.mjs` | Regenerates xlsx + host guide from JSON |

## Quick start (Kahoot PDF import — recommended)

1. Go to [Kahoot](https://kahoot.com) → **Create** → **AI Question Generator** (Kahoot+ may be required).
2. Choose **Upload PDF** and select **`curt-birthday-movies-kahoot.pdf`**.
3. Turn **ON** “Extract questions from the PDF”.
4. Choose **Quiz** format → **Generate** → review questions → **Add to kahoot**.
5. Add poster images in Kahoot if you want (optional — use `host-guide.html` for reference).

## Alternative: spreadsheet import

1. **Create** → **Quiz** → **Blank canvas** → **Import spreadsheet**.
2. Upload **`curt-birthday-movies-kahoot.xlsx`**.

## Rebuild after edits

Run `python build.py` in this folder (regenerates PDF, xlsx, and host guide).

## Question mix (50 total)

- **Classic horror** — 17 (Scream, Get Out, Alien, Conjuring, etc.)
- **Modern horror (2020s)** — 6 (Smile, Nope, Terrifier 3, Beetlejuice Beetlejuice, etc.)
- **90s blockbusters** — 7 (Titanic, Matrix, Jurassic Park, LOTR…)
- **00s blockbusters** — 5 (Iron Man, Dark Knight, Avatar…)
- **2010s blockbusters** — 7 (Endgame, Frozen, Parasite…)
- **2020s blockbusters** — 8 (Barbie, Oppenheimer, Dune, Spider-Verse, Wicked…)

## Party tips

- **~45–60 min** for 50 questions at 20–30 sec each + lobby banter.
- For 12–13 people, play **Team mode** (2 teams of 6–7) or classic individual — teams reduce phone juggling.
- Bump time to **30s** on horror deep cuts if the room isn't full of film nerds.
- Suggested title in Kahoot: **"Curt's Birthday Movie Bash"**
- Pin: `curt-birthday-movies-kahoot.xlsx` image column uses Wikipedia poster URLs — swap any broken links in Kahoot's image search if needed.

## Editing questions

1. Edit `questions.json`
2. `npm run build`
3. Re-import xlsx into Kahoot (or replace questions in an existing kahoot)

Character limits (Kahoot rules): questions ≤ 95 chars, answers ≤ 60 chars.
