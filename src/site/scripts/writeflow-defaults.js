/**
 * Default WriteFlow assignment configuration schema.
 */
(() => {
  "use strict";

  const DEFAULT_ASSIGNMENT = {
    id: "sample-persuasive",
    version: 1,
    title: "Persuasive Essay Draft",
    subtitle: "Timed writing assignment",
    prompt: "Write a persuasive paragraph about a school rule you would change. State your claim, give two reasons with evidence, and end with a call to action.",
    promptBanner: "State your claim clearly. Support with reasons. End with a call to action.",
    welcomeTitle: "Ready to write?",
    welcomeLead: "You will have a timed window to type your first draft. Focus on getting ideas down — revision comes later.",
    checklist: [
      "Hit Start when you're ready — the timer runs automatically.",
      "Keep typing until time is up (auto-submits).",
      "Pasting is disabled — this measures your own typing.",
      "Don't worry about perfection; quantity and craft both count.",
    ],
    durationSec: 300,
    allowPaste: false,
    lockAfterTime: true,
    showLiveStats: true,
    requireName: true,
    requireClass: true,
    requireClassCode: true,
    rubrics: ["typing", "mechanics", "story"],
    theme: { preset: "dark", fontFamily: "", fontPreset: "google" },
    heroImage: "",
    heroImageData: "",
    teacherPassword: "changeme",
    measureCategories: [
      { id: "typing", icon: "⌨️", title: "Typing", desc: "Speed and stamina — how much you write in the time limit." },
      { id: "mechanics", icon: "✏️", title: "Mechanics", desc: "Spelling, capitalization, punctuation, and sentence structure." },
      { id: "story", icon: "📖", title: "Content", desc: "Voice, details, word choice, and organization." },
    ],
  };

  const BUILDER_SECTIONS = [
    { id: "content", label: "Content", icon: "📝", hint: "Prompt, welcome message, and teacher password" },
    { id: "timer", label: "Timer & rules", icon: "⏱️", hint: "Time limit and what students must enter" },
    { id: "appearance", label: "Appearance", icon: "🎨", hint: "Colors, fonts, and optional header image" },
    { id: "classes", label: "Classes", icon: "🏫", hint: "Class names and secret codes for students" },
    { id: "preview", label: "Preview", icon: "👁️", hint: "See what students will see before sharing" },
  ];

  const TUTORIAL_STEPS = {
    home: [
      {
        title: "Welcome to WriteFlow",
        body: "WriteFlow helps you run timed writing assignments. Students type on a timer; you get scores and submissions in one place.",
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
        title: "Content",
        body: "Write the assignment title, student welcome text, and the writing prompt. Set a teacher password you will use to view results.",
        section: "content",
      },
      {
        title: "Timer & rules",
        body: "Choose how many seconds students have. Toggle whether they need a name, class, class code, and whether paste is allowed.",
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
        body: "Press Start when ready. The timer runs immediately — keep typing until time runs out. Your work submits automatically.",
      },
      {
        title: "After time is up",
        body: "You will see scores and feedback. Your teacher can open Results with their password to view your submission.",
      },
    ],
  };

  window.WriteFlowDefaults = { DEFAULT_ASSIGNMENT, BUILDER_SECTIONS, TUTORIAL_STEPS };
})();
