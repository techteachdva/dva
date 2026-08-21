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
    { id: "content", label: "Content", icon: "📝" },
    { id: "timer", label: "Timer & rules", icon: "⏱️" },
    { id: "appearance", label: "Appearance", icon: "🎨" },
    { id: "classes", label: "Classes", icon: "🏫" },
    { id: "preview", label: "Preview", icon: "👁️" },
  ];

  window.WriteFlowDefaults = { DEFAULT_ASSIGNMENT, BUILDER_SECTIONS };
})();
