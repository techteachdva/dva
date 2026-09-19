import {
  musicCreditHtml,
  artCreditHtml,
  boxArtCreditHtml,
} from "./audio-settings.js";
import { hideUtilityModal } from "./ui.js";

export const SOMNIA_VERSION = "20.1";

/** Major releases and notable revisions (newest first). */
export const CHANGELOG = [
  {
    version: "20.1",
    title: "Device chrome & installable PWA",
    notes: [
      "Phone, iPad, and desktop share one 20.1 build — the table picks a stack, split, or triad menu and a play layout that leaves the hex map room.",
      "Phone and iPad play fold Overview, Tips, and Subconscious into ⋯; decks and the archetype table become edge drawers.",
      "Add to Home Screen installs Somnia from the live site. A Reload toast appears when a new dreamscape is waiting.",
      "Launch config and device autosave survive iOS tab eviction, so a Home Screen cold start can Continue Dream offline.",
      "The itch.io zip is the same 20.1 table. Install-to-Home-Screen is first-class on the hosted site.",
    ],
  },
  {
    version: "20.0",
    title: "Touch table & device-aware camera",
    notes: [
      "One-finger drag pans the table; pinch zooms; on-screen + / − / Fit buttons sit on the board.",
      "Long-press a Landscape or card to inspect — the same action as right-click.",
      "Double-tap a Dreamer chip or board token to zoom in on them.",
      "The table detects phone, tablet, and desktop, including large iPads, and swaps hover-only chrome for touch copy.",
      "Audio unlocks on the first tap, not only click or key.",
    ],
  },
  {
    version: "19.1",
    title: "Board clicks, radials & landscape stings",
    notes: [
      "Click a Dreamer on the board for a full 360° radial of phase-contextual actions — no competing camera zoom.",
      "Right-click a Landscape for the occupant and action overview; click a Dreamer or Dreambeast there to open the same radial.",
      "Double-click a Dreamer on the board or in the dock to max-zoom and center the camera on that card.",
      "The radial stays locked to the live Dreamer token after pan or zoom.",
      "New Pixabay ambient stings for every Landscape.",
    ],
  },
  {
    version: "19.0",
    title: "Fullscreen Dream Guide",
    notes: [
      "The top Guide strip is gone so the map can breathe.",
      "Landscape hexes show only their name, colored by suit.",
      "The ? button opens one full-screen Dream Guide: live feed plus a concise rules digest, with PLAY to return.",
    ],
  },
  {
    version: "18.6",
    title: "First-session tutorial & Guide",
    notes: [
      "Tutorial Mode is two guided rounds: Reveal, Explore, Meet, then earn The Innocent.",
      "On-rails clicks: the table keeps your Reveal/Explore/Meet choices; Continue no longer swaps Landscapes.",
      "Shorter 11-step script with a visible step progress bar.",
      "Candy Mountain's wasteland side is named and glowing so the Reveal click is obvious.",
      "Selecting Psyche shows a live suit total beside the cursor; Accept/Reject need at least one matching color plus that Dreamer's stat.",
      "Tutorial starts each Dreamer with 1 Power Token, leaves Visionary Psyche after Mandrake, and draws Power Surge in Round 2.",
      "Steps auto-advance; Skip leaves a practice table. First visit leads with Tutorial.",
      "Contextual Guide strip is visible in real games; first Daydream pins Innocent and Quiet.",
    ],
  },
  {
    version: "18.5.1",
    title: "Brief landscape stings & credits cleanup",
    notes: [
      "Landscape stings trimmed to ~2.6s with smooth fade in/out on every play.",
      "Main-menu footer and splash attributions removed; credits live in the logo panel only.",
    ],
  },
  {
    version: "18.5",
    title: "Changelog & landscape soundscape",
    notes: [
      "Click the Somnia logo on the main menu to open the running changelog and full credits.",
      "All 26 landscapes use Pixabay ambient stings with per-landscape attribution.",
    ],
  },
  {
    version: "18.4",
    title: "Tutorial & stacked encounters",
    notes: [
      "Tutorial snapshots and copy aligned with stacked Dreambeasts and radial board menus.",
      "Effect-wire audit handles quoted beast ids; seven wiring gaps closed.",
    ],
  },
  {
    version: "18.3",
    title: "Choice modal guard & Bargaining fix",
    notes: [
      "Required card choices minimize instead of dismissing; dock bar to resume.",
      "Bargaining dream now grants a matching Active Archetype when you pay 6 Psyche.",
    ],
  },
  {
    version: "18.2",
    title: "Card choice UX",
    notes: [
      "Left-click to select, right-click to preview, Confirm to commit across pickers.",
      "Larger portrait cards for encounters, psyche spends, and subconscious returns.",
    ],
  },
  {
    version: "18.1",
    title: "Radial menu positioning",
    notes: [
      "Dreamer radial menus anchor to live board tokens after camera focus moves.",
    ],
  },
  {
    version: "18.0",
    title: "Audio & atmosphere mega-update",
    notes: [
      "Four BGM tracks with menu attribution; landscape SFX system and camera focus stings.",
      "Psyche holographic energy, golden power sparkle, HD landscapes, parallax mist.",
      "Boss stingers, moment FX, menu motion, suit table washes, victory layer.",
    ],
  },
  {
    version: "17.7",
    title: "Stacked encounters & moment narration",
    notes: [
      "Dreambeasts stack on landscapes; moment toasts and history panel.",
      "Bot sim stability and multi-encounter migration across game systems.",
    ],
  },
  {
    version: "17.6",
    title: "Dream card detail modal",
    notes: ["Draw and discard views show art, name, kind, flavor, and effect text."],
  },
  {
    version: "17.5",
    title: "Meet phase skip gate",
    notes: ["End Meet with unused actions after confirmation, mirroring Explore."],
  },
  {
    version: "17.4",
    title: "Board feel & radial menus",
    notes: [
      "Click ripple/sparkle FX, phase-aware cursors, Dreamer/Dreambeast radial menus.",
      "Meet pooling banner and object click-to-view.",
    ],
  },
  {
    version: "17.3",
    title: "Board interactivity",
    notes: [
      "Fit-table hotkey (F), larger default board zoom, single-click Explore moves.",
      "Clickable Dreamer and Dreambeast tokens; cleaner move animation.",
    ],
  },
  {
    version: "17.2",
    title: "Landscape occupants as cards",
    notes: ["Detail modal shows occupant cards instead of text-only lists."],
  },
  {
    version: "17.1",
    title: "Object draw vs play",
    notes: [
      "Objects go to hand on draw; instants resolve on play. Set completion fixes.",
    ],
  },
  {
    version: "17.0",
    title: "Fullscreen landscape detail",
    notes: ["Right-click landscape view expands to near-fullscreen hero art layout."],
  },
  {
    version: "16.x",
    title: "Co-op polish & saves",
    notes: [
      "Continue Dream, autosave, tutorial mode, and expanded rules reference.",
      "Dreamer powers, subconscious deck, and encounter balance passes.",
    ],
  },
  {
    version: "15.x",
    title: "Dreamscape core loop",
    notes: [
      "Hex board, Reveal/Explore/Meet phases, Dreambeasts, quests, and mindstream.",
      "Dreamer archetypes, landscape actions, and cooperative win conditions.",
    ],
  },
  {
    version: "14.x",
    title: "Play shell & layout",
    notes: [
      "Dedicated play window, resizable panels, top phase bar, and device view modes.",
      "Foundation for standalone packaging and itch.io distribution.",
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
      <h2>Somnia Changelog</h2>
      <p class="changelog-lead">Major versions and revisions for <strong>Somnia v ${SOMNIA_VERSION}</strong>.</p>
      <div class="changelog-scroll">${changelogHtml()}</div>
      <section class="changelog-credits-section">
        <h3>Credits &amp; attributions</h3>
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
