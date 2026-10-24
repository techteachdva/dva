# Digital Obsidian Garden
This is the template to be used together with the [Digital Garden Obsidian Plugin](https://github.com/oleeskild/Obsidian-Digital-Garden). 
See the README in the plugin repo for information on how to set it up.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/oleeskild/digitalgarden)

---
## Docs
Docs are available at [dg-docs.ole.dev](https://dg-docs.ole.dev/)

---
## Morphology Garden (project notes)

### Edit the word bank
- **Words + trees + mini-lessons**, one file per Beck tier: `src/site/scripts/data/morphology/words/tier1.json`, `tier2.json`, `tier3.json`
  - Change tier labels by editing each lemma’s **`tier`** (`tier1` / `tier2` / `tier3`) and moving the object into that file.
  - Edit lesson wording in **`deep`** and the exit ticket in **`note`**.
  - Diagram linkage uses `morphemeKey` tags like `pfx:un-`, `sfx:-ed`, `root:port`.
  - The page dynamic-imports a tier only when a selected word or morpheme needs it (`src/site/scripts/morphology-bank.js`).

### Edit the morpheme chart
- **Bottom chart (origin/meaning/outside examples/Wiktionary)**: `src/site/scripts/data/morphology/catalog/tier1.json`, `tier2.json`, `tier3.json`
  - `key` must match the `morphemeKey` tags used in trees.
  - `wiktionary` is the page title used to build the link (optional).
  - `npm run build:morphology` rebuilds these chunks from `scripts/morphology-authoring/` and overwrites JSON edits.
