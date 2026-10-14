import {
  musicCreditHtml,
  menuThemeCreditHtml,
  artCreditHtml,
  boxArtCreditHtml,
} from "../audio/audio-settings.js";
import { hideUtilityModal } from "../ui/ui.js";

export const SOMNIA_VERSION = "0.4";

/** Ainmos: a roguelike dream forked from Somnia 42.0 (newest first). */
export const CHANGELOG = [
  {
    version: "0.4",
    title: "Dream Forms",
    notes: [
      "A spread can make a Dream Form: Echo (two of one value), Ladder (three in a row), Chord (three of one suit), Trinity (one of each suit), Trifecta (three of a kind), or Unity (three 1s). The best Form adds its dice: +1 to start, +1 per level. The Dream Forms panel shows every level.",
      "Six Objects are now Form Objects: Mirror (Echo), Rope (Ladder), Conch Shell (Chord), Spark of Sun (Trinity), Monkey Paw (Trifecta), and Egg (Unity). Play one, Repress 1 Psyche of its suit, and its Form rises a level. The Object is Repressed too.",
      "Psyche cards can carry one upgrade: Chaotic (a d6 value, rolled when drawn), Vivid (a second suit), Lucid (any suit, same value), or Recurring (returns to hand after a spread). A new upgrade replaces the old one; the same upgrade twice changes nothing and is not spent.",
    ],
  },
  {
    version: "0.3",
    title: "The Dream Re-forms",
    notes: [
      "When the Dreamscape Vault and the tile deck are both empty, the next round begins with a Dreamscape Reset: every Landscape but The Bed shuffles back into the tile deck, Dreambeasts on them are Repressed, Bosses drift back to The Bed, and every Dreamer wakes on The Bed.",
      "Dawn between Antes: the round after a Boss arrives, the Waking Mind reshuffles and every Dreamer draws 3 Psyche.",
      "The Bed no longer draws 3. It Dreams Onward: flip the top tile of the deck, then place it free or put it back.",
    ],
  },
  {
    version: "0.2",
    title: "Ten Nightmares",
    notes: [
      "A night is a run of Antes: two Dreams, then a Boss. Daydream climbs 4 Antes, Nap 7, Deep Sleep 10.",
      "The Boss ladder runs from rung 10 to rung 1: Winged Turtle, Shadows, Jackalope, Baku, Mindless, Devourer, Bogey, Cerberus, Double, Leviathan. These ten no longer wander the Mindstream.",
      "Wake by defeating the night's final Boss with the Archetype goal met. If the last round ends first, you never wake. There is no Final Recurrence.",
      "The Night Bar across the top shows every Dream of the night, face down, with each Ante's Boss face up so you can plan for it.",
      "Sage, Magician, and Warrior now ask you to defeat a Lucidity, Elasticity, or Willpower Boss.",
    ],
  },
  {
    version: "0.1",
    title: "The Mirror Dream",
    notes: [
      "Ainmos begins as a parallel dream of Somnia. Every night is built on a Freeform Board: only The Bed is on the table, and the Dreamscape Vault offers three Landscapes to place.",
      "A new Dreambeast fixes an old, poor design choice.",
    ],
  },
];

function changelogHtml() {
  return CHANGELOG.map((entry) => {
    const items = entry.notes.map((n) => `<li>${n}</li>`).join("");
    return `
      <article class="changelog-entry">
        <h3><span class="changelog-version">v ${entry.version}</span> ${entry.title}</h3>
        <ul>${items}</ul>
      </article>`;
  }).join("");
}

function landscapeCreditRow(id, meta) {
  const artistLink = meta.artistUrl
    ? `<a href="${meta.artistUrl}" rel="noopener noreferrer">${meta.artist}</a>`
    : meta.artist;
  const sourceLink = meta.sourceUrl
    ? `<a href="${meta.sourceUrl}" rel="noopener noreferrer">${meta.title}</a>`
    : meta.title;
  const label = meta.label || id.replace(/-/g, " ");
  return `<li><strong>${label}</strong> — ${sourceLink} by ${artistLink}</li>`;
}

async function landscapeCreditsHtml() {
  try {
    const res = await fetch("data/landscape-sfx.json");
    if (!res.ok) throw new Error(String(res.status));
    const map = await res.json();
    const rows = Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([id, meta]) => landscapeCreditRow(id, meta))
      .join("");
    return `
      <section class="changelog-credits-section">
        <h3>Landscape sound effects</h3>
        <p class="changelog-credits-lead">Ambient stings from <a href="https://pixabay.com/sound-effects/" rel="noopener noreferrer">Pixabay</a> (Pixabay Content License).</p>
        <ul class="changelog-landscape-credits">${rows}</ul>
      </section>`;
  } catch {
    return `<p class="changelog-credits-lead">Landscape sound attributions are listed in <code>data/landscape-sfx.json</code>.</p>`;
  }
}

export async function showSomniaChangelogModal() {
  const modal = document.getElementById("utility-modal");
  const body = document.getElementById("utility-modal-body");
  if (!modal || !body) return;

  body.innerHTML = `
    <div class="somnia-changelog-modal">
      <h2>Ainmos Changelog</h2>
      <p class="changelog-lead">Major versions and revisions for <strong>Ainmos v ${SOMNIA_VERSION}</strong>.</p>
      <div class="changelog-scroll">${changelogHtml()}</div>
      <section class="changelog-credits-section">
        <h3>Credits &amp; attributions</h3>
        ${menuThemeCreditHtml()}
        ${musicCreditHtml()}
        ${boxArtCreditHtml()}
        ${artCreditHtml()}
      </section>
      <div id="changelog-landscape-credits"><p class="changelog-credits-lead">Loading landscape credits…</p></div>
    </div>`;

  modal.querySelector(".utility-content")?.classList.add("somnia-changelog-modal-wrap");
  modal.classList.remove("hidden");
  document.body.classList.add("utility-modal-open");

  const landscapeEl = document.getElementById("changelog-landscape-credits");
  if (landscapeEl) {
    landscapeEl.innerHTML = await landscapeCreditsHtml();
  }

  const closeBtn = modal.querySelector(".utility-close");
  const backdrop = modal.querySelector(".utility-backdrop");
  const onClose = () => {
    hideUtilityModal(true);
    modal.querySelector(".utility-content")?.classList.remove("somnia-changelog-modal-wrap");
    closeBtn?.removeEventListener("click", onClose);
    backdrop?.removeEventListener("click", onClose);
  };
  closeBtn?.addEventListener("click", onClose);
  backdrop?.addEventListener("click", onClose);
}
