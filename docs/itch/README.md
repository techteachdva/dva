# Somnia on itch.io — page kit

Two files, two paste targets.

| File | Where it goes | Needs approval? |
| --- | --- | --- |
| `somnia-itch-description.html` | Project → Edit → Description → click `<>` (HTML mode) → paste | No |
| `somnia-itch-theme.css` | Project page → **Edit Theme** → CSS box (bottom-left) | Yes — CSS access is per account |

## 1. Description (works today)

itch.io sanitizes description HTML: `id`, `style=""`, scripts, forms and any class
that does not start with `custom-` are stripped. The description file only uses
`custom-` classes and absolute URLs, so it survives the sanitizer. Without the
theme CSS it renders as clean headings, lists and a table; with the CSS it turns
into the glass-panel layout.

After pasting, **save and view the published page logged out** — the editor
preview does not run the sanitizer.

## 2. Theme editor settings (no approval needed)

Open **Edit Theme** and set:

- Background color: `#0b0a14`
- Background image: the box art (`src/site/somnia/images/somnia-box-art.jpg`), *Repeat: no*, *Position: top center*, *Attachment: fixed* if offered
- Text color: `#e8e4ff` · Link color: `#c9a0ff`
- Button color: `#7b5cff` · Button text: `#ffffff`
- Font: **Cinzel** for headings if offered in the picker, otherwise leave default (the CSS loads the fallback stack)
- Banner: 960×400 wordmark on the midnight background (`images/somnia-logo.png` composited onto `#0b0a14`)
- Embed: **Click to launch in fullscreen**, viewport `1280×720`, "Mobile friendly" ON, "Automatically start on page load" OFF (the game needs a tap to unlock audio anyway)

## 3. Requesting CSS access

Email **support@itch.io from the address on the itch account**. Template:

> Subject: Custom CSS access — SOMNIA (<your-itch-project-url>)
>
> Hello — I'd like custom CSS enabled for my account for the project page above.
> The theme editor covers colours and fonts but not what I need: glass-panel
> cards for the three game phases (a 3-column grid that collapses to one column
> on mobile), a styled fact table, and a soft drop shadow around the HTML5 game
> frame. All rules are scoped inside `#wrapper` and target only my own
> `custom-` classes plus `.game_frame`.
>
> I confirm the page will stay accessible and readable, that I will test it on
> small viewports and logged out, and that I will not alter or hide any itch.io
> built-in UI (header, footer, purchase box, comments).

Turnaround is typically days to a couple of weeks. You'll get a ticket ID; reply
on that thread if it stalls.

## 4. Screenshots and trailer (the part the algorithm sees)

- 5 screenshots minimum, 1280×720 or 1920×1080, in this order: full desktop table
  mid-game, iPad hand rail + drawer, phone portrait board, the opening tile spiral,
  a Dreambeast Encounter dialog.
- Cover image 630×500: box art crop with the wordmark — no UI.
- A 30–45 s trailer: 5 s logo → 20 s of the spiral deal + one Reveal/Explore/Meet
  loop → 5 s "1–6 players · plays offline · desktop / iPad / phone" → 5 s logo.
  Upload to YouTube, unlisted is fine; itch embeds it above screenshots.
