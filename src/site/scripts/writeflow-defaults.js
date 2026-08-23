/**
 * Default WriteFlow assignment configuration schema.
 */
(() => {
  "use strict";

  const APP_VERSION = "2.7.1";

  const ASSIGNMENT_MODES = ["composition", "fluency", "typing_practice", "reflection"];

  const MODE_DEFAULTS = {
    composition: {
      assignmentMode: "composition",
      rubrics: ["mechanics", "story"],
      showLiveStats: true,
      showLiveWpm: false,
      timerStyle: "soft",
      allowEndEarly: true,
      lockAfterTime: false,
    },
    fluency: {
      assignmentMode: "fluency",
      rubrics: ["typing"],
      showLiveStats: true,
      showLiveWpm: true,
      timerStyle: "hard",
      allowEndEarly: true,
      lockAfterTime: true,
    },
    typing_practice: {
      assignmentMode: "typing_practice",
      rubrics: ["typing"],
      showLiveStats: true,
      showLiveWpm: true,
      timerStyle: "hard",
      allowEndEarly: false,
      lockAfterTime: true,
    },
    reflection: {
      assignmentMode: "reflection",
      rubrics: ["mechanics", "story"],
      showLiveStats: true,
      showLiveWpm: false,
      timerStyle: "soft",
      allowEndEarly: true,
      lockAfterTime: false,
      allowPaste: true,
    },
  };

  const DIFFERENTIATION_PRESETS = [
    {
      id: "emerging-typist",
      icon: "🌱",
      label: "Emerging typist",
      description: "Extra time, soft timer, larger text — fluency not scored.",
      settings: {
        assignmentMode: "composition",
        timerStyle: "soft",
        durationSec: 600,
        showLiveWpm: false,
        allowEndEarly: true,
        lockAfterTime: false,
        rubrics: ["mechanics", "story"],
        accessibility: { largeText: true, dyslexiaFont: true, highContrast: false, spellcheck: true, reducedMotion: false },
      },
    },
    {
      id: "standard",
      icon: "✏️",
      label: "Standard",
      description: "Balanced composition defaults — ideas and craft, not speed.",
      settings: {
        assignmentMode: "composition",
        timerStyle: "soft",
        durationSec: 300,
        showLiveWpm: false,
        allowEndEarly: true,
        lockAfterTime: false,
        rubrics: ["mechanics", "story"],
        accessibility: { largeText: false, dyslexiaFont: false, highContrast: false, spellcheck: true, reducedMotion: false },
      },
    },
    {
      id: "fluency-challenge",
      icon: "⌨️",
      label: "Fluency challenge",
      description: "Timed stamina drill — WPM visible, typing scored.",
      settings: {
        assignmentMode: "fluency",
        timerStyle: "hard",
        durationSec: 600,
        showLiveWpm: true,
        minWordCount: 100,
        requireMinWordsToComplete: true,
        allowEndEarly: true,
        lockAfterTime: true,
        rubrics: ["typing"],
        accessibility: { largeText: true, dyslexiaFont: false, highContrast: false, spellcheck: true, reducedMotion: false },
      },
    },
    {
      id: "reflection-preset",
      icon: "💭",
      label: "Reflection",
      description: "Low-stakes reflection — soft timer, paste allowed.",
      settings: {
        assignmentMode: "reflection",
        timerStyle: "soft",
        durationSec: 480,
        showLiveWpm: false,
        allowEndEarly: true,
        lockAfterTime: false,
        allowPaste: true,
        rubrics: ["mechanics", "story"],
        accessibility: { largeText: false, dyslexiaFont: false, highContrast: false, spellcheck: true, reducedMotion: false },
      },
    },
  ];

  const CHANGELOG = [
    {
      version: "2.7.1",
      date: "2026-08-23",
      summary: "Fix teacher email verification signup button.",
      items: [
        "Create account no longer blocks on a hidden required password field before the code step.",
        "Verification code and password fields unlock only after the email code is sent.",
      ],
    },
    {
      version: "2.7.0",
      date: "2026-08-23",
      summary: "Student accounts, verified teacher signup, and admin tools.",
      items: [
        "Students sign in with roster username (first name + last initial); default password SPARK, then choose their own.",
        "Student portal at /writeflow/student/ shows all past submissions across assignments.",
        "Teachers register with @davincicharterschool.org email verification; only approved emails can sign up.",
        "Admin portal at /writeflow/admin/ — stats, dedupe submissions, impersonation, account lists.",
        "Submissions link to studentUsername when signed in for reliable history matching.",
      ],
    },
    {
      version: "2.6.3",
      date: "2026-08-23",
      summary: "Hotfix: standards catalog loads again in the builder.",
      items: [
        "Fixed a script initialization order bug that prevented WriteFlowItemStandards from loading (empty catalog, grade filter stuck).",
        "Standards builder keeps catalog, grade, and search filters when you attach standards.",
        "Catalog list shows a count and clearer empty-state message when filters match nothing.",
      ],
    },
    {
      version: "2.6.2",
      date: "2026-08-23",
      summary: "Guided tutorial and quick-start aligned with v2.6 standards diagnostics.",
      items: [
        "Studio, builder, and student tutorials cover standards attachment, heuristic Results alignment, and conference prompts.",
        "Landing quick-start and Studio quick tips updated for card detail panel, edit-in-new-tab, hero crop, and top-bar save.",
        "Tutorial walks through intro splash, A–Z boot loader, and MN ELA + ITEM 2025 catalogs.",
      ],
    },
    {
      version: "2.6.1",
      date: "2026-08-23",
      summary: "Sharper standards alignment diagnostics without AI.",
      items: [
        "Benchmark terms and writing-structure patterns (claims, evidence, inquiry, etc.) improve text matching.",
        "Demonstrated now requires textual signals — not just strong mechanics scores.",
        "Results show confidence, score breakdown, benchmark look-fors, and conference prompts.",
        "Submission preview highlights standard-related terms alongside vocabulary.",
      ],
    },
    {
      version: "2.6.0",
      date: "2026-08-23",
      summary: "MN ELA standards catalog (grades 5–8) alongside ITEM 2025.",
      items: [
        "Standards builder now offers two catalogs: ITEM 2025 (technology) and MN ELA (grades 5–8).",
        "Filter by grade and strand; 166 MN ELA benchmarks with full benchmark text from state standards.",
        "Catalog-aware attachment prevents collisions between ITEM and ELA codes that share the same number.",
        "Student chips and Results alignment show which framework each standard comes from.",
      ],
    },
    {
      version: "2.5.0",
      date: "2026-08-23",
      summary: "Teaching Standards — attach ITEM 2025 benchmarks to assignments.",
      items: [
        "New Standards section in the builder — browse, search, and attach ITEM 2025 grade 8 benchmarks (6–8 band).",
        "Add custom standards by typing a code and benchmark description.",
        "Standards appear at the top of the student assignment welcome and writing views.",
        "Submissions analyze writing for textual evidence aligned to attached standards in Results.",
      ],
    },
    {
      version: "2.4.0",
      date: "2026-08-23",
      summary: "Performance polish, lighter Studio theme, and intro logo card fix.",
      items: [
        "Studio init runs during the intro splash so cloud sync finishes sooner.",
        "Assignment cloud metadata loads in parallel; duplicate shared-library fetch removed.",
        "Lighter Studio background; intro finale card fits the WFS logo snugly.",
        "Boot loader completes faster after init; landing stats animate during intro.",
      ],
    },
    {
      version: "2.3.19",
      date: "2026-08-23",
      summary: "Fix alphabet boot loader stalling at W before completing A–Z.",
      items: [
        "Progress now maps evenly across all 26 letters like a true progress bar.",
        "Loader advances smoothly during init milestones, then fills to Z before dismiss.",
      ],
    },
    {
      version: "2.3.18",
      date: "2026-08-23",
      summary: "Fix Studio boot hang caused by a JavaScript syntax error.",
      items: [
        "Removed duplicate code fragment in writeflow-app.js that blocked the intro animation from finishing.",
      ],
    },
    {
      version: "2.3.17",
      date: "2026-08-23",
      summary: "Studio dashboard cards open edit in new tab with detail panel and preview tooltips.",
      items: [
        "Edit opens the builder in a new browser tab; clicking a card shows details in the right panel.",
        "Your assignments and shared libraries scroll independently (~5 cards visible each).",
        "Preview hover shows a ghost welcome preview; shared cards add Results, Copy, and Preview.",
      ],
    },
    {
      version: "2.3.16",
      date: "2026-08-23",
      summary: "Clearer assignment cards with Edit and Delete buttons.",
      items: [
        "Assignment cards stack title, summary, badges, and link ID without overlap.",
        "Added Edit button alongside Results, Link, and Preview.",
        "Delete is now a labeled button matching the other actions.",
      ],
    },
    {
      version: "2.3.15",
      date: "2026-08-22",
      summary: "Wider Studio home layout with denser assignment list.",
      items: [
        "Studio panels use more screen width with larger, easier-to-read text.",
        "Removed duplicate Tutorial button from the assignments panel.",
        "Assignments sort alphabetically and use compact rows so more fit on screen.",
      ],
    },
    {
      version: "2.3.14",
      date: "2026-08-22",
      summary: "Restore visible Save assignment controls in the builder.",
      items: [
        "Save & publish moved to the top of the right panel and stays sticky while you scroll.",
        "Save assignment button also appears in the top bar while editing.",
        "On narrower screens, the save panel appears above settings instead of below them.",
      ],
    },
    {
      version: "2.3.13",
      date: "2026-08-22",
      summary: "Configurable hero image with crop and shape options.",
      items: [
        "Upload or paste a hero image, then crop and position it in a built-in editor.",
        "Choose wide banner, square, or circle display on the student welcome screen.",
        "URL images save focus position; uploads bake the crop for reliable sharing.",
      ],
    },
    {
      version: "2.3.12",
      date: "2026-08-22",
      summary: "Fix Results Enter button blocked by tutorial and dashboard navigation.",
      items: [
        "Teacher login handlers bind on every Studio load — Results from a file tile now wires up Enter.",
        "Tutorial no longer covers the View results password screen; it dismisses when you open Results.",
        "Shared assignments get a Results button; Enter key submits the assignment password.",
      ],
    },
    {
      version: "2.3.11",
      date: "2026-08-22",
      summary: "Fix assignment file tiles — layout and action buttons.",
      items: [
        "Assignment cards show title, duration, mode, ID, and account badges without clipping.",
        "Results, Link, and Preview buttons work from the dashboard; Link copies the student URL with a tooltip.",
        "Cloud-synced assignments load display metadata when no local copy exists on this device.",
      ],
    },
    {
      version: "2.3.10",
      date: "2026-08-22",
      summary: "Fix Results password verification for co-teachers and published assignments.",
      items: [
        "Results login always sends the assignment password alongside a signed-in session.",
        "Assignment IDs and passwords match case-insensitively with trimmed whitespace on the server.",
        "Unpublished local assignments can still open Results with the builder password on that device.",
        "Clearer Results screen copy — teacher password is not your account login or class code.",
      ],
    },
    {
      version: "2.3.9",
      date: "2026-08-22",
      summary: "Darker name modal and assignment-password results for co-teachers.",
      items: [
        "Name your assignment dialog uses a heavier backdrop and solid panel so Studio text behind it no longer competes.",
        "Signed-in co-teachers can open Results with the assignment teacher password — session login no longer blocks password auth.",
      ],
    },
    {
      version: "2.3.8",
      date: "2026-08-22",
      summary: "Landing page layout — full scrollable changelog and larger text.",
      items: [
        "Left panel now shows the complete release history in a scrollable column.",
        "Typography scaled up across hero, stats, quick start, and changelog entries.",
        "Wider three-column layout with more padding so the splash page fills the screen.",
      ],
    },
    {
      version: "2.3.7",
      date: "2026-08-22",
      summary: "Fix alphabet boot loader stopping at W.",
      items: [
        "Boot progress now completes A through Z — the 0.9 cap was lighting only 23 of 26 letters.",
        "Letter track uses a 26-column grid so X, Y, and Z stay visible on one row.",
        "Full alphabet lights for 320ms before the loader dismisses.",
      ],
    },
    {
      version: "2.3.6",
      date: "2026-08-22",
      summary: "Fix Studio tutorial spotlight blocking the Next button.",
      items: [
        "Tutorial overlay now stacks above highlighted UI so Next and Back stay clickable.",
        "Large spotlight targets use a soft dim instead of a viewport-sized cutout.",
        "Step 2 no longer highlights the full dashboard grid — instructions stay readable alongside the UI.",
      ],
    },
    {
      version: "2.3.5",
      date: "2026-08-22",
      summary: "Tutorial and splash updates for the new Studio dashboard layout.",
      items: [
        "Studio and builder tutorials rewritten for the three-panel dashboard, name-first flow, template defaults, and file-tile assignments hub.",
        "Splash page adds a Studio at a glance section and a focused Get started guide aligned with the new workflow.",
        "Layout polish: clearer panel hierarchy, readable quick-start text, and improved spacing on landing and Studio home.",
      ],
    },
    {
      version: "2.3.4",
      date: "2026-08-22",
      summary: "Studio dashboard, template clarity, assignment naming, and layout polish.",
      items: [
        "New assignments start with a name prompt — the slug becomes the student link ID.",
        "Template cards and wizards show default student experience (timer, scoring, paste, WPM).",
        "Assignments hub uses a graphical file-tile folder view; Studio home matches the splash three-panel layout.",
        "Builder spreads across the full screen with scrollable Settings, center editor, and File information panels.",
        "Splash and Studio text sizes increased for readability; alphabet loader stays on one row.",
        "Removed Back to site links from WriteFlow pages.",
      ],
    },
    {
      version: "2.3.3",
      date: "2026-08-22",
      summary: "Dense full-width landing layout; admin setup redacted from public pages.",
      items: [
        "Splash page redesigned as a three-column dashboard — changelog left, hero/stats/overview center, quick start right — optimized to fit one screen without scrolling.",
        "Removed Replay intro button from the landing page.",
        "Public setup guide is teacher-only; Google Sheets / Vercel admin steps moved to a private desktop folder for site owners.",
        "Troubleshooting no longer exposes backend environment variable names or API secrets.",
      ],
    },
    {
      version: "2.3.2",
      date: "2026-08-22",
      summary: "Comprehensive tutorial, alphabet boot loader, and navigation/password fixes.",
      items: [
        "New Studio tutorial walks through every feature — account login, assignments hub, builder tabs, passwords, sharing, and student links.",
        "Alphabet loading bar animates A–Z while Studio boots after the intro splash.",
        "Assignments button now switches views instantly without reloading the page or replaying the intro.",
        "Results access hardened: signed-in owners skip the assignment password; owned assignments cannot be overwritten by other teachers.",
        "Teacher password required before publish; clearer Results login explains the three password types.",
      ],
    },
    {
      version: "2.3.1",
      date: "2026-08-22",
      summary: "Docs and tutorial updates for teacher accounts and the shared library.",
      items: [
        "Landing page changelog and version label updated for the teacher-accounts release.",
        "Tutorial now covers signing in, saving assignments to your account, and sharing with colleagues.",
        "Setup guide documents Teachers and Sessions sheet tabs for admins deploying the backend.",
      ],
    },
    {
      version: "2.3.0",
      date: "2026-08-22",
      summary: "Teacher accounts, shared assignment library, and assignment ownership.",
      items: [
        "Teachers can create an account, sign in, and save assignments linked to their username.",
        "Shared library — enable “Share with other teachers” when saving to let colleagues copy your assignment.",
        "Copy any shared assignment into your account with one click, then edit and publish your own version.",
        "Signed-in owners can open Results without re-entering the per-assignment teacher password.",
        "New Google Sheet tabs: Teachers (accounts) and Sessions (login tokens). Assignments tab adds owner and shared columns.",
        "Studio Sign in button opens the account panel; home dashboard merges cloud and local assignments.",
        "Shared by other teachers section lists colleague templates you can copy into your account.",
      ],
    },
    {
      version: "2.2.0",
      date: "2026-08-22",
      summary: "Teacher assignments hub, GIF hero images, and smoother Studio workflow.",
      items: [
        "Studio home is now an assignments dashboard — Edit, Results, Copy link, and Preview on every saved assignment.",
        "Fixed saved assignments not opening in the builder; switching assignments reloads config and jumps to Content.",
        "Hero images and animated GIFs display at the top of the student welcome screen (URL or upload, up to 2.5 MB for GIFs).",
        "Class code validation only runs when the assignment requires it; codes are captured at Start and kept through submit.",
        "Landing intro finale fixed — logo and wordmark no longer overlap at the end of the animation.",
        "Results view adds Edit assignment and All assignments shortcuts.",
      ],
    },
    {
      version: "2.1.4",
      date: "2026-08-21",
      summary: "Rewrite Google Sheets setup guide for teachers and admins.",
      items: [
        "Setup page split into a teacher quick-start (no backend required) and a step-by-step admin guide.",
        "Improved readability: dark theme, numbered steps, troubleshooting table, and GitHub link to copy the Apps Script.",
        "Fixed outdated student link format in setup docs.",
      ],
    },
    {
      version: "2.1.3",
      date: "2026-08-21",
      summary: "Fix missing header icon and polish the WFS mark.",
      items: [
        "Inline SVG logo mark in header, CTA, studio, and intro — no broken external image files.",
        "Fixed intro CSS that was hiding the header icon; animation styles scoped to intro only.",
        "Repaired corrupted SVG math symbols and improved mark proportions.",
      ],
    },
    {
      version: "2.1.2",
      date: "2026-08-21",
      summary: "Replace AI-generated PNG logo with a clean SVG mark and a true intro morph.",
      items: [
        "New lightweight SVG logo (transparent, brackets + math ops + WFS + bars) replaces 850 KB PNG assets.",
        "Intro animation uses the same bar elements throughout — they rise first, then brackets, ops, and letters assemble around them.",
        "Favicon, header, CTA, and studio branding updated to the SVG mark.",
      ],
    },
    {
      version: "2.1.1",
      date: "2026-08-21",
      summary: "WFS logo branding across WriteFlow Studio with animated intro finale.",
      items: [
        "New WFS logo asset (brackets, math ops, bar chart) used for favicon, header, hero CTA, and studio top bar.",
        "Landing intro animation morphs rising bars into the real logo image at the final step.",
        "Favicon added to landing, studio, and student assignment pages.",
      ],
    },
    {
      version: "2.1.0",
      date: "2026-08-21",
      summary: "Pedagogy-informed modes, soft timers, and differentiation presets.",
      items: [
        "Assignment modes (composition, fluency, typing practice, reflection) set sensible defaults for scoring and live stats.",
        "WPM is hidden by default in composition — show words only unless you enable live WPM or use a fluency mode.",
        "Soft, goal, and no-timer styles let students finish on their own instead of auto-submitting at zero.",
        "Rubrics filter score cards, CSV columns, and overall scoring by mode.",
        "One-click differentiation presets and optional sentence starters for scaffolds.",
        "Growth-oriented student results copy de-emphasizes speed in composition mode.",
      ],
    },
    {
      version: "2.0.1",
      date: "2026-08-21",
      summary: "Landing intro animation, tutorial spotlight, and class-code submission fixes.",
      items: [
        "Landing intro animation now plays all three phases (typewriter, score cards, WFS logo) with proper layering.",
        "Tutorial uses a spotlight cutout so highlighted settings stay visible behind the guide panel.",
        "Student name, class, and class code are saved at Start and reused when submitting after the timer.",
        "Google Sheets backend classroom codes synced with the site so server validation matches the client.",
        "Impact stats on the landing page use real counts from your submissions sheet.",
      ],
    },
    {
      version: "2.0",
      date: "2026-03-21",
      summary: "Separate student assignments from WriteFlow Studio, vocabulary tracking, and a new landing page.",
      items: [
        "Student assignment links are now locked-down writing views with no teacher navigation.",
        "WriteFlow Studio (builder, results, templates) lives at /writeflow/studio/.",
        "New landing page at /writeflow/ with intro animation, changelog, and documentation.",
        "Teachers can set expected vocabulary words; submissions highlight matches in Results.",
        "Removed WriteFlow from the games cartridge shelf — it is a classroom writing tool.",
      ],
    },
    {
      version: "1.2",
      date: "2026-03-21",
      summary: "Templates, delete assignments, flexible timers, accessibility options.",
      items: [
        "Delete saved assignments with confirmation.",
        "Template wizard builds assignments from short questions.",
        "End early, minimum word count, and require-minimum-to-finish rules.",
        "Accessibility: large text, high contrast, dyslexia font, reduced motion.",
      ],
    },
    {
      version: "1.0",
      date: "2026-03-20",
      summary: "Initial WriteFlow Studio release.",
      items: [
        "Assignment builder with cloud publish and share links.",
        "Timed student writing with typing, mechanics, and content scoring.",
        "Teacher results dashboard and CSV export.",
      ],
    },
  ];

  const DEFAULT_ASSIGNMENT = {
    id: "sample-persuasive",
    version: 2,
    assignmentMode: "composition",
    title: "Persuasive Essay Draft",
    subtitle: "Timed writing assignment",
    prompt: "Write a persuasive paragraph about a school rule you would change. State your claim, give two reasons with evidence, and end with a call to action.",
    promptBanner: "State your claim clearly. Support with reasons. End with a call to action.",
    welcomeTitle: "Ready to write?",
    welcomeLead: "You will have a timed window to type your first draft. Focus on getting ideas down — revision comes later.",
    checklist: [
      "Hit Start when you're ready — the timer runs automatically.",
      "Keep writing until you're done — tap \"I'm done\" or wait for the timer.",
      "Pasting is disabled — this measures your own typing.",
      "Don't worry about perfection; ideas and craft both count.",
    ],
    durationSec: 300,
    timerStyle: "soft",
    allowPaste: false,
    spellcheck: true,
    lockAfterTime: false,
    showLiveStats: true,
    showLiveWpm: false,
    allowEndEarly: true,
    minWordCount: 0,
    requireMinWordsToComplete: false,
    requireName: true,
    requireClass: true,
    requireClassCode: true,
    rubrics: ["mechanics", "story"],
    sentenceStarters: "",
    theme: { preset: "dark", fontFamily: "", fontPreset: "libreBaskerville" },
    heroImage: "",
    heroImageData: "",
    heroImageShape: "banner",
    heroImageFocus: { x: 50, y: 50 },
    teacherPassword: "changeme",
    vocabWords: [],
    highlightVocab: true,
    accessibility: {
      largeText: false,
      highContrast: false,
      spellcheck: true,
      reducedMotion: false,
      dyslexiaFont: false,
    },
    measureCategories: [
      { id: "typing", icon: "⌨️", title: "Typing", desc: "Speed and stamina — how much you write in the time limit." },
      { id: "mechanics", icon: "✏️", title: "Mechanics", desc: "Spelling, capitalization, punctuation, and sentence structure." },
      { id: "story", icon: "📖", title: "Content", desc: "Voice, details, word choice, and organization." },
    ],
    teachingStandards: [],
  };

  const BUILDER_SECTIONS = [
    { id: "templates", label: "Templates", icon: "📋", hint: "Start from a guided template — modes set scoring and timer defaults" },
    { id: "content", label: "Content", icon: "📝", hint: "Prompt, sentence starters, and welcome message — clarity lowers anxiety" },
    { id: "standards", label: "Standards", icon: "🎯", hint: "ITEM 2025 or MN ELA — heuristic text + craft alignment in Results" },
    { id: "timer", label: "Timer & rules", icon: "⏱️", hint: "Soft timers support composition; hard timers suit fluency drills" },
    { id: "appearance", label: "Appearance", icon: "🎨", hint: "Colors, fonts, and optional header image" },
    { id: "accessibility", label: "Accessibility", icon: "♿", hint: "Presets and options — match timer and word goals to each learner" },
    { id: "classes", label: "Classes", icon: "🏫", hint: "Class names and secret codes for students" },
    { id: "preview", label: "Preview", icon: "👁️", hint: "See what students will see before sharing" },
  ];

  function resolveTimerStyle(config = {}) {
    if (config.timerStyle) return config.timerStyle;
    const mode = config.assignmentMode || "composition";
    return MODE_DEFAULTS[mode]?.timerStyle || "soft";
  }

  function resolveShowLiveWpm(config = {}) {
    if (config.showLiveWpm) return true;
    const mode = config.assignmentMode || "composition";
    return mode === "fluency" || mode === "typing_practice";
  }

  function resolveRubrics(config = {}) {
    if (Array.isArray(config.rubrics) && config.rubrics.length) return config.rubrics;
    const mode = config.assignmentMode || "composition";
    return MODE_DEFAULTS[mode]?.rubrics || ["typing", "mechanics", "story"];
  }

  function applyModeDefaults(mode, base = {}) {
    const defaults = MODE_DEFAULTS[mode] || MODE_DEFAULTS.composition;
    return { ...base, ...defaults, assignmentMode: mode };
  }

  function slugify(text) {
    return String(text || "assignment")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "assignment";
  }

  function uniqueSlug(base, existingIds = []) {
    const set = new Set(existingIds);
    let id = slugify(base) || "assignment";
    if (!set.has(id)) return id;
    let n = 2;
    while (set.has(`${id}-${n}`)) n += 1;
    return `${id}-${n}`;
  }

  function formatModeLabel(mode) {
    return String(mode || "composition").replace(/_/g, " ");
  }

  const ASSIGNMENT_TEMPLATES = [
    {
      id: "quick-write",
      icon: "⚡",
      title: "Quick Write",
      description: "Short timed response — warm-ups, exit tickets, or bell work.",
      defaultsPreview: [
        "Composition mode · soft timer",
        "Scores mechanics + story (not speed)",
        "Paste blocked · optional word minimum",
        "Students: prompt, timer, word count — no WPM",
      ],
      questions: [
        { id: "topic", label: "What should students write about?", type: "textarea", placeholder: "e.g. What surprised you in today's lesson?", required: true },
        { id: "minutes", label: "How many minutes?", type: "number", default: 5, min: 1, max: 60 },
        { id: "minWords", label: "Minimum word count (0 = none)", type: "number", default: 0, min: 0, max: 500 },
        { id: "allowEarly", label: "Let students finish early when ready?", type: "checkbox", default: true },
      ],
      build(answers) {
        const mins = Math.max(1, Number(answers.minutes) || 5);
        const minWords = Math.max(0, Number(answers.minWords) || 0);
        const topic = String(answers.topic || "").trim();
        const title = topic.length > 48 ? `${topic.slice(0, 45)}…` : topic || "Quick Write";
        const checklist = [
          "Read the prompt, enter your info, then press Start.",
          `You have ${mins} minute${mins === 1 ? "" : "s"} to write.`,
        ];
        if (answers.allowEarly) checklist.push("Tap \"I'm done\" when you finish — you don't have to wait for the timer.");
        if (minWords > 0) checklist.push(`Write at least ${minWords} words before submitting.`);
        checklist.push("Focus on ideas first — spelling and polish come later.");
        return applyModeDefaults("composition", {
          id: `quick-${slugify(title)}-${Date.now()}`,
          title: `Quick Write: ${title}`,
          subtitle: `${mins}-minute response`,
          welcomeTitle: "Quick write time",
          welcomeLead: `You have ${mins} minute${mins === 1 ? "" : "s"} to respond in your own words. Type continuously and don't worry about perfection.`,
          prompt: topic,
          promptBanner: topic,
          durationSec: mins * 60,
          allowEndEarly: !!answers.allowEarly,
          minWordCount: minWords,
          requireMinWordsToComplete: minWords > 0,
          allowPaste: false,
          checklist,
        });
      },
    },
    {
      id: "typing-stamina",
      icon: "⌨️",
      title: "Typing Stamina",
      description: "Build fluency — students type on a topic for a set time with a word goal.",
      defaultsPreview: [
        "Fluency mode · hard timer (auto-submit)",
        "Scores typing stamina only",
        "Paste blocked · live WPM + word count",
        "Larger text · must hit word goal to finish",
      ],
      questions: [
        { id: "topic", label: "Typing topic or sentence starter", type: "text", placeholder: "e.g. Describe your favorite hobby in detail.", required: true },
        { id: "minutes", label: "How many minutes?", type: "number", default: 10, min: 3, max: 45 },
        { id: "minWords", label: "Target word count", type: "number", default: 100, min: 20, max: 800 },
        { id: "allowEarly", label: "Allow \"I'm done\" before time runs out?", type: "checkbox", default: true },
      ],
      build(answers) {
        const mins = Math.max(3, Number(answers.minutes) || 10);
        const minWords = Math.max(20, Number(answers.minWords) || 100);
        const topic = String(answers.topic || "").trim() || "Write as much as you can on the topic below.";
        return applyModeDefaults("fluency", {
          id: `typing-${Date.now()}`,
          title: "Typing Stamina Practice",
          subtitle: `${mins} minutes · ${minWords}+ words`,
          welcomeTitle: "Typing stamina challenge",
          welcomeLead: `Type continuously for ${mins} minutes. Aim for at least ${minWords} words. Keep your fingers moving — it's okay if it's messy.`,
          prompt: topic,
          promptBanner: `Goal: ${minWords}+ words · ${mins} min`,
          durationSec: mins * 60,
          allowEndEarly: !!answers.allowEarly,
          minWordCount: minWords,
          requireMinWordsToComplete: true,
          allowPaste: false,
          showLiveStats: true,
          showLiveWpm: true,
          checklist: [
            "Press Start when ready — the timer begins immediately.",
            `Aim for at least ${minWords} words.`,
            answers.allowEarly ? "You can submit early once you hit the word goal." : "Keep typing until the timer ends.",
            "Pasting is off — this measures your own typing.",
          ],
          theme: { preset: "dark", fontPreset: "readable" },
          accessibility: { largeText: true, dyslexiaFont: false, highContrast: false, spellcheck: true, reducedMotion: false },
        });
      },
    },
    {
      id: "reflection",
      icon: "💭",
      title: "Reflection",
      description: "Students reflect on learning, behavior, or a reading.",
      defaultsPreview: [
        "Reflection mode · soft timer",
        "Scores mechanics + story",
        "Paste allowed · finish early anytime",
        "Students: calm prompt, no speed pressure",
      ],
      questions: [
        { id: "focus", label: "What are students reflecting on?", type: "textarea", placeholder: "e.g. How did you use teamwork in today's lab?", required: true },
        { id: "minutes", label: "How many minutes?", type: "number", default: 8, min: 3, max: 30 },
        { id: "minWords", label: "Minimum words (0 = none)", type: "number", default: 50, min: 0, max: 300 },
      ],
      build(answers) {
        const mins = Math.max(3, Number(answers.minutes) || 8);
        const minWords = Math.max(0, Number(answers.minWords) || 50);
        const focus = String(answers.focus || "").trim();
        return applyModeDefaults("reflection", {
          id: `reflect-${Date.now()}`,
          title: "Reflection",
          subtitle: "Think and write",
          welcomeTitle: "Take a moment to reflect",
          welcomeLead: "There are no wrong answers. Write honestly about your experience.",
          prompt: focus,
          promptBanner: focus,
          durationSec: mins * 60,
          allowEndEarly: true,
          minWordCount: minWords,
          requireMinWordsToComplete: false,
          allowPaste: true,
          checklist: [
            "Read the reflection question carefully.",
            `You have ${mins} minutes — use the time you need.`,
            minWords > 0 ? `Write at least ${minWords} words.` : "Write in complete sentences.",
            "Tap \"I'm done\" when you finish.",
          ],
        });
      },
    },
    {
      id: "paragraph-response",
      icon: "📄",
      title: "Paragraph Response",
      description: "Structured answer with claim and evidence — great for content classes.",
      defaultsPreview: [
        "Composition mode · soft timer",
        "Scores mechanics + story",
        "Paste blocked · paragraph word minimum",
        "Banner reminds: claim, evidence, conclusion",
      ],
      questions: [
        { id: "question", label: "Question or prompt", type: "textarea", placeholder: "e.g. How does photosynthesis help plants survive?", required: true },
        { id: "minutes", label: "How many minutes?", type: "number", default: 15, min: 5, max: 45 },
        { id: "minWords", label: "Minimum words", type: "number", default: 80, min: 30, max: 400 },
        { id: "banner", label: "Reminder shown while typing (optional)", type: "text", placeholder: "e.g. Claim + 2 reasons + evidence" },
      ],
      build(answers) {
        const mins = Math.max(5, Number(answers.minutes) || 15);
        const minWords = Math.max(30, Number(answers.minWords) || 80);
        const question = String(answers.question || "").trim();
        const banner = String(answers.banner || "").trim() || "State your claim. Support with evidence. Wrap up clearly.";
        return applyModeDefaults("composition", {
          id: `paragraph-${Date.now()}`,
          title: "Paragraph Response",
          subtitle: `${mins}-minute written response`,
          welcomeTitle: "Paragraph response",
          welcomeLead: `Answer the question below in a full paragraph (${minWords}+ words). Organize your ideas before you start typing.`,
          prompt: question,
          promptBanner: banner,
          durationSec: mins * 60,
          allowEndEarly: true,
          minWordCount: minWords,
          requireMinWordsToComplete: false,
          allowPaste: false,
          checklist: [
            "Plan briefly, then press Start.",
            `Write at least ${minWords} words in paragraph form.`,
            banner,
            "Submit when you're done or when time runs out.",
          ],
        });
      },
    },
    {
      id: "free-write",
      icon: "✨",
      title: "Free Write",
      description: "Open-ended creative writing with flexible time and optional word floor.",
      defaultsPreview: [
        "Composition mode · soft timer",
        "Scores mechanics + story",
        "Paste optional (off by default)",
        "Optional story starter · finish early allowed",
      ],
      questions: [
        { id: "starter", label: "Optional story starter or theme", type: "text", placeholder: "e.g. The door creaked open…" },
        { id: "minutes", label: "How many minutes?", type: "number", default: 20, min: 5, max: 60 },
        { id: "minWords", label: "Minimum words (0 = none)", type: "number", default: 0, min: 0, max: 500 },
        { id: "allowPaste", label: "Allow paste?", type: "checkbox", default: false },
      ],
      build(answers) {
        const mins = Math.max(5, Number(answers.minutes) || 20);
        const minWords = Math.max(0, Number(answers.minWords) || 0);
        const starter = String(answers.starter || "").trim();
        const prompt = starter
          ? `Free write starting from: "${starter}" — continue the story or idea in your own direction.`
          : "Free write — create any story, description, or ideas you want. Let your imagination lead.";
        return applyModeDefaults("composition", {
          id: `freewrite-${Date.now()}`,
          title: "Free Write",
          subtitle: `${mins} minutes of creative writing`,
          welcomeTitle: "Free write",
          welcomeLead: "There is no single right answer. Keep typing and see where your writing goes.",
          prompt,
          promptBanner: starter ? `Starter: ${starter}` : "Write freely — ideas and creativity count.",
          sentenceStarters: starter || "",
          durationSec: mins * 60,
          allowEndEarly: true,
          minWordCount: minWords,
          requireMinWordsToComplete: minWords > 0,
          allowPaste: !!answers.allowPaste,
          checklist: [
            `You have ${mins} minutes.`,
            minWords > 0 ? `Write at least ${minWords} words.` : "Write as much as you can.",
            "Don't stop to edit — keep the ideas flowing.",
            "Tap \"I'm done\" when finished, or wait for the timer.",
          ],
        });
      },
    },
    {
      id: "sentence-practice",
      icon: "🔤",
      title: "Sentence Practice",
      description: "Short bursts for vocabulary, grammar, or spelling in context.",
      defaultsPreview: [
        "Composition mode · soft timer",
        "Scores mechanics + story",
        "Paste blocked · required word minimum",
        "Large text + dyslexia-friendly font · spellcheck on",
      ],
      questions: [
        { id: "task", label: "What should students do?", type: "textarea", placeholder: "e.g. Write 5 sentences using this week's vocabulary words.", required: true },
        { id: "minutes", label: "How many minutes?", type: "number", default: 7, min: 3, max: 20 },
        { id: "minWords", label: "Minimum words", type: "number", default: 40, min: 10, max: 200 },
      ],
      build(answers) {
        const mins = Math.max(3, Number(answers.minutes) || 7);
        const minWords = Math.max(10, Number(answers.minWords) || 40);
        const task = String(answers.task || "").trim();
        return applyModeDefaults("composition", {
          id: `sentences-${Date.now()}`,
          title: "Sentence Practice",
          subtitle: "Focused writing drill",
          welcomeTitle: "Sentence practice",
          welcomeLead: "Follow the directions carefully. Use complete sentences.",
          prompt: task,
          promptBanner: task,
          durationSec: mins * 60,
          allowEndEarly: true,
          minWordCount: minWords,
          requireMinWordsToComplete: true,
          allowPaste: false,
          theme: { preset: "light", fontPreset: "readable" },
          accessibility: { largeText: true, spellcheck: true, highContrast: false, dyslexiaFont: true, reducedMotion: false },
          checklist: [
            "Read the task before you start.",
            `Write at least ${minWords} words in complete sentences.`,
            "Check capitalization and ending punctuation.",
            "Submit when you meet the goal or time runs out.",
          ],
        });
      },
    },
  ];

  const LANDING_QUICKSTART = [
    {
      title: "Open Studio",
      body: "From the landing page or /writeflow/studio/. The WFS intro plays on first load; Studio syncs during the splash, then shows an A–Z boot bar while your files load.",
    },
    {
      title: "Name your assignment",
      body: "Every new assignment starts with a name. That becomes the title and the slug in your student link (/writeflow/a/?id=…).",
    },
    {
      title: "Pick a template",
      body: "Templates show default student experience—timer style, scoring focus, paste rules, and live WPM. Run the short wizard, then fine-tune in the builder.",
    },
    {
      title: "Attach standards (optional)",
      body: "In the builder Standards section, attach ITEM 2025 or MN ELA benchmarks (grades 5–8). Students see chips at the top; Results use heuristic alignment—not AI grading.",
    },
    {
      title: "Manage your files",
      body: "Saved assignments appear as cards in the center. Click a card for details on the right. Edit opens the builder in a new tab; use Link, Preview, Results, or Delete on each card.",
    },
    {
      title: "Build in three panels",
      body: "Settings on the left, forms in the center, File information on the right—save from the sticky panel or the top-bar Save assignment button.",
    },
    {
      title: "Review Results",
      body: "Open Results with your assignment teacher password (or sign in as owner). See scores, vocabulary hits, and standards alignment with evidence, confidence, and conference prompts.",
    },
    {
      title: "Share student links only",
      body: "After saving, copy /writeflow/a/?id=your-name from File information—never share the Studio builder URL with students.",
    },
  ];

  const TUTORIAL_STEPS = {
    studio: [
      {
        title: "Welcome to WriteFlow Studio",
        body: "Studio v2.6 is your teacher dashboard: templates on the left, assignment files in the center, and quick tips plus assignment details on the right. Everything fits on one screen.",
      },
      {
        title: "Intro & loading",
        body: "First visit plays the WFS logo intro while cloud sync runs in the background. After that, an A–Z boot loader fills while assignments load. Add ?skipIntro=1 to the Studio URL to skip the animation.",
      },
      {
        title: "The three-panel layout",
        body: "Left — start from a template or blank assignment. Center — your saved assignments as scrollable cards. Right — quick tips and the detail panel when you select a card.",
        highlight: "#wfStudioHomeGrid",
      },
      {
        title: "Name your assignment first",
        body: "Click Blank assignment or any template. WriteFlow asks for a name before you build — that name becomes the student link ID (slugified). You can still edit the title later in Content.",
        highlight: "#openBuilderBtn",
      },
      {
        title: "Templates and defaults",
        body: "Each template card lists what students will experience: timer style, scoring focus, paste rules, and live stats. Pick one, name it, answer a few questions, then edit anything.",
        highlight: "#wfTemplatesHeading",
      },
      {
        title: "Assignment cards",
        body: "Click a card title to select it and open the detail panel on the right. Edit opens the builder in a new tab so this dashboard stays open. Every card also has Results, Link, Preview, and Delete. Hover Preview for a ghost welcome thumbnail.",
        highlight: "#wfAssignmentsDashboard",
      },
      {
        title: "Detail panel",
        body: "The right column shows metadata and quick actions for the selected assignment — mode, timer, link ID, and buttons to edit, copy the link, or open Results.",
        highlight: "#wfStudioQuickTips",
      },
      {
        title: "Teaching standards",
        body: "In the builder Standards section, attach ITEM 2025 (technology) or MN ELA benchmarks (grades 5–8). Students see standard chips on welcome and writing screens. Results use heuristic matching — benchmark terms, structure patterns, and craft scores — with evidence quotes, confidence labels, look-fors, and conference prompts. Not AI grading.",
      },
      {
        title: "Three kinds of passwords",
        body: "① Account login (Sign in) — syncs assignments to your profile. ② Assignment teacher password (Content tab) — unlocks Results. ③ Class codes (Classes tab) — students verify their class. Student links need no password.",
      },
      {
        title: "Sign in to your account",
        body: "Optional but recommended: attach assignments to your username, sync across devices, share with colleagues, and open Results without re-entering the assignment password when you are the owner.",
        highlight: "#wfAccountBtn",
      },
      {
        title: "Shared by other teachers",
        body: "When a colleague enables Share with other teachers, their assignment appears below your files. Copy it, name your version, and publish with your own link and password.",
        highlight: "#wfSharedLibrary",
      },
      {
        title: "Assignments button",
        body: "Return to this dashboard anytime from the top bar — no page reload and no replaying the intro. Switch between editing and managing files instantly.",
        highlight: "#builderLinkBtn",
      },
      {
        title: "Results & standards alignment",
        body: "View student submissions and export CSV. When standards are attached, each submission shows a Standards alignment panel — demonstrated / developing / not evident, confidence, score breakdown, and highlighted terms in the preview. Signed-in owners skip the assignment password.",
        highlight: "#teacherBtn",
      },
      {
        title: "Open the builder guide",
        body: "When you edit an assignment, use Tutorial again for a walkthrough of every Settings section — including Standards, hero images, and save controls.",
        highlight: "#tutorialBtn",
      },
    ],
    home: [],
    builder: [
      {
        title: "Builder layout",
        body: "Three scrollable panels: Settings (left) picks the section to edit, the center holds forms and the template wizard, and File information (right) shows metadata, save, and the student link.",
      },
      {
        title: "Settings menu",
        body: "Jump between Templates, Content, Standards, Timer, Appearance, Accessibility, Classes, and Preview. Standards is where you attach ITEM 2025 or MN ELA benchmarks. The active section is highlighted.",
        highlight: "#builderNav",
      },
      {
        title: "File information panel",
        body: "See title, link ID, mode, timer, and scoring at a glance. Save assignment (sticky at the top of this panel), preview the student view, copy the share link, and switch between saved files.",
        highlight: "#builderInspector",
      },
      {
        title: "Top-bar save",
        body: "While editing, Save assignment also appears in the top bar so you can publish without scrolling — same action as the File information panel.",
        highlight: "#wfTopbarSaveBtn",
      },
      {
        title: "Templates & student defaults",
        body: "The Templates section shows each template’s default student experience before you run the wizard. Answer a few questions — WriteFlow fills prompts, timers, and rubrics. Everything stays editable.",
        section: "templates",
      },
      {
        title: "Content — prompts & vocabulary",
        body: "Set the assignment title, welcome message, writing prompt, and optional sentence starters. Add expected vocabulary — highlighted in Results when students use them.",
        section: "content",
      },
      {
        title: "Standards — attach benchmarks",
        body: "Browse ITEM 2025 (technology, grade 8) or MN ELA (grades 5–8). Filter by grade and strand, search benchmark text, attach standards, or add custom entries. Attached standards appear as chips for students.",
        section: "standards",
        highlight: "#bfStandardsCatalogList",
      },
      {
        title: "Standards — what Results show",
        body: "After students submit, Results analyzes each draft heuristically: benchmark terms, writing-structure patterns (claims, evidence, narrative cues), and craft scores. Demonstrated requires textual signals — not just strong mechanics. You get evidence lines, confidence, look-fors, conference prompts, and highlighted terms in the submission preview.",
      },
      {
        title: "Assignment teacher password",
        body: "Required in Content. Unlocks Results for this assignment and is separate from your account login. Share only with co-teachers who need access.",
        section: "content",
      },
      {
        title: "Share with colleagues",
        body: "When signed in, enable Share with other teachers before saving. Colleagues copy from the shared library and get their own link and password.",
        section: "content",
      },
      {
        title: "Timer & rules",
        body: "Assignment mode sets scoring focus and timer defaults. Choose soft, hard, goal, or no timer; set duration, word minimums, paste rules, and class requirements.",
        section: "timer",
      },
      {
        title: "Appearance — hero image",
        body: "Upload or paste a hero image, then Crop & position to drag, zoom, and pick banner, square, or circle display on the student welcome screen. URL images keep focus position; uploads bake the crop for reliable sharing.",
        section: "appearance",
        highlight: "#bfHero",
      },
      {
        title: "Appearance & accessibility",
        body: "Theme and fonts shape the student welcome screen. Accessibility presets bundle differentiation settings — large text, dyslexia font, high contrast — in one click.",
        section: "accessibility",
      },
      {
        title: "Classes & preview",
        body: "Reference class codes in Classes. Use Preview to see the student welcome screen — including standards chips and hero image — before you share.",
        section: "preview",
      },
      {
        title: "Save & publish",
        body: "Click Save assignment in File information (or the top bar) to publish to the cloud. Students can then load your assignment from the share link on any device.",
        highlight: "#bfSave",
      },
      {
        title: "Copy the student link",
        body: "After saving, copy the share link from File information. Send only /writeflow/a/?id=… to students — not the Studio builder URL.",
        highlight: "#bfCopyLink",
      },
    ],
    student: [
      {
        title: "Before you start",
        body: "Read the prompt carefully. If your teacher attached standards, you'll see chips at the top showing what the assignment targets. Enter your first name, pick your class, and type the class code if required.",
        highlight: "#startBtn",
      },
      {
        title: "Standards on screen",
        body: "Standards chips stay visible on the welcome screen and while you write. They remind you what to include — your teacher reviews alignment in Results, not on this screen.",
      },
      {
        title: "Writing time",
        body: "Press Start when you are ready — the timer begins immediately. Type your response in the box. Pasting may be disabled. Watch the word count; live WPM may show depending on your teacher's settings.",
      },
      {
        title: "Finishing up",
        body: "When time ends or you tap I'm done, your writing is analyzed and saved. Your teacher views submissions from WriteFlow Studio Results — including vocabulary highlights and standards alignment when benchmarks are attached.",
      },
    ],
  };

  // Legacy alias — landing page uses LANDING_QUICKSTART
  TUTORIAL_STEPS.home = LANDING_QUICKSTART;

  function parseVocabInput(raw) {
    return String(raw || "")
      .split(/[\n,;]+/)
      .map((w) => w.trim())
      .filter(Boolean);
  }

  window.WriteFlowDefaults = {
    APP_VERSION,
    CHANGELOG,
    DEFAULT_ASSIGNMENT,
    BUILDER_SECTIONS,
    TUTORIAL_STEPS,
    LANDING_QUICKSTART,
    ASSIGNMENT_TEMPLATES,
    ASSIGNMENT_MODES,
    MODE_DEFAULTS,
    DIFFERENTIATION_PRESETS,
    slugify,
    uniqueSlug,
    formatModeLabel,
    parseVocabInput,
    resolveTimerStyle,
    resolveShowLiveWpm,
    resolveRubrics,
    applyModeDefaults,
  };
})();
