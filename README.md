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
- **Words + trees + mini-lessons**: `src/site/scripts/morphology-words-data.js`
  - Change tier labels by editing each lemma’s **`tier`** (`tier1` / `tier2` / `tier3`).
  - Edit lesson wording in **`deep`** and the exit ticket in **`note`**.
  - Diagram linkage uses `morphemeKey` tags like `pfx:un-`, `sfx:-ed`, `root:port`.

### Edit the morpheme chart
- **Bottom chart (origin/meaning/outside examples/Wiktionary)**: `src/site/scripts/morphology-morpheme-catalog.js`
  - `key` must match the `morphemeKey` tags used in trees.
  - `wiktionary` is the page title used to build the link (optional).
