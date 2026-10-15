/**
 * Object sets: collect every piece and the set Acquires an Archetype from the deck.
 * No imports on purpose, so the UI and the effects can both read it without an import cycle.
 */

/** The collectible sets and how many pieces each needs. Dream Form Objects are not a set. */
export const OBJECT_SETS = Object.freeze({ body: 5, element: 4, jewelry: 3, stick: 3, chess: 3 });

/** How many pieces of a set this Dreamer holds (in hand or in play), counting The One. */
export function setProgress(player, tag) {
  if (!OBJECT_SETS[tag]) return null;
  const held = [...(player?.persistent || []), ...(player?.objects || [])]
    .filter((o) => o.tags?.some((t) => t.startsWith(tag))).length;
  const wild = (player?.setWildcards || []).filter((t) => t === tag).length;
  return { held: held + wild, need: OBJECT_SETS[tag] };
}
