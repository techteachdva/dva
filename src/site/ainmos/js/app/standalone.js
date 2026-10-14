/** True in itch.io / offline standalone builds (meta tag or window flag). */
export function isStandaloneMode() {
  if (typeof window !== "undefined" && window.SOMNIA_STANDALONE === true) return true;
  return document.querySelector('meta[name="somnia-standalone"]')?.content === "1";
}
