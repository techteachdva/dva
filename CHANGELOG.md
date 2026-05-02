## Unreleased

### Morphology Garden
- **Linked Trees (Master)** lays out the visible lemma set on a **golden-angle sunflower** disk whose radius scales with √n, so large morpheme-linked sets no longer stack into one unreadable band (fixed ortho refit after packing).
- Fixed word-tree visibility after adding morpheme picks: **Garden** isolate now resolves morpheme selections to a lemma for visibility; **Master** link sets ignore empty `Set`s; **Compare** falls back to showing lemmas when a pair is not on stage yet so the board never renders blank.
- Unified the morphology word bank into `src/site/scripts/morphology-words-data.js` (single set; tiers are per-lemma).
- Added a clickable morpheme chart under the “Five ideas” section, driven by `src/site/scripts/morphology-morpheme-catalog.js`.
- Improved fullscreen mini-lesson behavior (font-size scaling without resizing panels; exit ticket stays reachable; dock scroll behavior).
- Improved whiteboard zoom readability by scaling node labels with orthographic zoom.
- Added click-pinned node tooltips with shared-morpheme navigation (click a related lemma to jump).

