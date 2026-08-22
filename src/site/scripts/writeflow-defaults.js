/**
 * Default WriteFlow assignment configuration schema.
 */
(() => {
  "use strict";

  const APP_VERSION = "2.1.3";

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
  };

  const BUILDER_SECTIONS = [
    { id: "templates", label: "Templates", icon: "📋", hint: "Start from a guided template — modes set scoring and timer defaults" },
    { id: "content", label: "Content", icon: "📝", hint: "Prompt, sentence starters, and welcome message — clarity lowers anxiety" },
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

  const ASSIGNMENT_TEMPLATES = [
    {
      id: "quick-write",
      icon: "⚡",
      title: "Quick Write",
      description: "Short timed response — warm-ups, exit tickets, or bell work.",
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

  const TUTORIAL_STEPS = {
    home: [
      {
        title: "Welcome to WriteFlow",
        body: "WriteFlow helps you run timed writing assignments. Students type on a timer; you get scores and submissions in one place.",
      },
      {
        title: "Start from a template",
        body: "Use Templates in the builder — or pick one on the home page — to answer a few questions and generate a ready-to-share assignment.",
        highlight: "#wfTemplateGallery",
      },
      {
        title: "Step 1 — Configure",
        body: "Click Configure (or Create assignment) to open the builder. Set your prompt, timer, and class requirements.",
        highlight: "#builderLinkBtn",
      },
      {
        title: "Step 2 — Save & publish",
        body: "In the builder, click Save assignment in the right panel. That publishes your assignment so share links work on any device.",
      },
      {
        title: "Step 3 — Share the link",
        body: "Copy the share link from the builder and send it to students. They open it, enter their info, and write.",
      },
      {
        title: "Step 4 — View results",
        body: "Click Results and enter your teacher password to see submissions, refresh the list, or export CSV.",
        highlight: "#teacherBtn",
      },
    ],
    builder: [
      {
        title: "Builder overview",
        body: "Three areas: menu (left) picks what to edit, canvas (center) holds the settings, panel (right) saves and shares.",
      },
      {
        title: "Templates",
        body: "Pick a template, answer a few questions, and WriteFlow builds the assignment for you. You can still edit everything afterward.",
        section: "templates",
      },
      {
        title: "Content",
        body: "Write the assignment title, student welcome text, and the writing prompt. Set a teacher password you will use to view results.",
        section: "content",
      },
      {
        title: "Timer & rules",
        body: "Set time limits, minimum word counts, and whether students can finish early. Different settings help you support every learner.",
        section: "timer",
      },
      {
        title: "Classes",
        body: "Open the Classes tab to see each class name and its code. Share the correct code with each class.",
        section: "classes",
      },
      {
        title: "Save & share",
        body: "When you are done, click Save assignment, then copy the share link. Students use that URL — not the builder link.",
        highlight: "#bfSave",
      },
    ],
    student: [
      {
        title: "Before you start",
        body: "Read the prompt, enter your first name, pick your class, and type the class code your teacher gave you.",
        highlight: "#startBtn",
      },
      {
        title: "Writing time",
        body: "Press Start when ready. The timer runs immediately. If your teacher enabled it, you can tap \"I'm done\" when you finish.",
      },
      {
        title: "After time is up",
        body: "You will see scores and feedback. Your teacher can open Results with their password to view your submission.",
      },
    ],
  };

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
    ASSIGNMENT_TEMPLATES,
    ASSIGNMENT_MODES,
    MODE_DEFAULTS,
    DIFFERENTIATION_PRESETS,
    slugify,
    parseVocabInput,
    resolveTimerStyle,
    resolveShowLiveWpm,
    resolveRubrics,
    applyModeDefaults,
  };
})();
