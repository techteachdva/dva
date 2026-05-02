## Unreleased

### Morphology Garden — Ground-up rebuild

The viewer was rewritten from scratch around three explicit modes that map 1:1 to the picker UI. The previous implementation (intro cinematic, view transitions, dual cameras, master/sunflower hub, dev 3D mode, click-pinned tooltips, ring-to-isolate tween, lazy tree builds, etc.) is gone.

- **Three-mode UI** — `🌳 Word`, `🔗 Morpheme`, `⚖ Compare` mode buttons, each with its own picker row:
  - **Word** — single tree, centered on the board, full mini-lesson.
  - **Morpheme** — every word in the bank that contains the chosen morpheme, laid out on a tidy grid with magenta links between matching morpheme spheres. Lesson becomes a morpheme primer (origin, meaning, examples, Wiktionary link, click-to-jump word picks).
  - **Compare** — two word trees side-by-side, magenta arcs trace shared morphemes, dual lesson card.
- **Only the selected tree(s) are on screen.** Other words are not just hidden — bridges between non-visible words are also off, so the board stays clean.
- **Single orthographic camera** with auto-fit framing — no manual zoom; the view always shows the visible bounding box at the largest safe size with a thin label-safe margin. Drag to pan; double-click / `F` / `R` to refit; window resize re-fits.
- **Eager tree build, eager bridge graph.** All word groups are constructed once at boot (the bank is small) so picker switches are instant.
- **Clicks** — click a morpheme sphere whose tag appears in 2+ words to jump to **Morpheme** mode for that morpheme. Click an apex / single-occurrence sphere to jump to **Word** mode for that word.
- **Tooltip** — minimal hover tooltip (category · morpheme · gloss · parent word).
- **Keyboard** — `1` / `2` / `3` switch modes; `F` / `R` refit; `[` / `]` lesson text size, `Alt+0` reset.
- **Removed** — intro cinematic, guided tour modal, view-key transitions (`Garden3d/GardenWb/Master3d/MasterWb/...`), perspective camera and rig swap, dev `\\` 3D, sunflower master layout, ring-to-isolate tween, click-pinned tooltips, fly-cam (`WASD`/arrows).
- **Kept** — `morphology-lessons-data.js` lesson rendering, `morphology-morpheme-catalog.js` chart, fullscreen toggle, ❓ help modal, lesson text-size buttons / keys, vocabulary tier display.
- File size: `morphology-garden.js` shrank from ~4500 lines to ~700; `index.njk` toolbar simplified; new SCSS for the three-mode toolbar / pickers / tooltip / morpheme primer. Legacy SCSS rules for the old toolbar are explicitly hidden so they cannot leak through.
