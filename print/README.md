# Somnia physical prototype prints

These PDFs are for table playtests. They live in this folder after you generate them, and they are **gitignored** so Vercel / the public site never ships them.

## Generate (local only)

From the repo root:

```
npm run print:somnia
```

That writes:

- `print/Somnia-23.1-Rules-and-Setup.pdf` — rules bible, setup, component counts, hex map diagram
- `print/Somnia-23.1-Cutouts-Identity-Psyche-Dreams.pdf` — Dreamers, Archetypes, Psyche, Dreams
- `print/Somnia-23.1-Cutouts-Beasts-Objects.pdf` — Dreambeasts and Objects
- `print/Somnia-23.1-Cutouts-Mindstream.pdf` — Mindstream Events, Power Token grant cards, Draw Dream
- `print/Somnia-23.1-Cutouts-Landscapes.pdf` — hex faces and Wasteland backs

Scratch HTML used by Playwright is written to `print/_html/` (also gitignored). The generator uses your installed Chrome or Edge.

## How to print

- **Cardstock**, US Letter, actual size (do not “fit to page”).
- Cards are poker-ish rectangles (`2.48" × 3.47"`) with a dashed cut line.
- Landscapes are pointy-top hexes (~`3"` flat-to-flat). Print the Wasteland backs and glue or sleeve them to outer tiles. **The Bed** never flips; skip a back for it.
- **Power Tokens are US quarters** (about `0.955"`). Do not cut tokens from this PDF. Start with 1 quarter per Dreamer; keep a pool of up to 24.

## Regenerating after card changes

The generator reads live JSON and artwork under `src/site/somnia/`. Re-run `npm run print:somnia` whenever Landscapes, Psyche, Mindstream, or rules copy change.
