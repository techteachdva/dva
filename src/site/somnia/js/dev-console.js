/**
 * Dev console UI — toggle with ` (backtick) when dev mode is on.
 */

import {
  isDevMode,
  enableDevMode,
  executeDevCommand,
} from "./dev-commands.js";

const MAX_HISTORY = 40;
const MAX_LOG = 80;

export function initDevConsole(getContext) {
  if (new URLSearchParams(window.location.search).get("dev") === "1") {
    enableDevMode();
  }

  const panel = document.getElementById("dev-console");
  const input = document.getElementById("dev-console-input");
  const logEl = document.getElementById("dev-console-log");
  const toggleBtn = document.getElementById("dev-console-toggle");
  const closeBtn = document.getElementById("dev-console-close");

  if (!panel || !input) return;

  const history = [];
  let historyIdx = -1;
  let open = false;

  function setVisible(visible) {
    open = visible;
    panel.classList.toggle("hidden", !visible);
    if (visible) {
      input.focus();
      input.select();
    }
  }

  function appendLog(text, ok = true) {
    const line = document.createElement("div");
    line.className = `dev-log-line ${ok ? "ok" : "err"}`;
    line.textContent = text;
    logEl.appendChild(line);
    while (logEl.children.length > MAX_LOG) {
      logEl.removeChild(logEl.firstChild);
    }
    logEl.scrollTop = logEl.scrollHeight;
  }

  function runLine(raw) {
    const ctx = getContext();
    if (!ctx?.state) {
      appendLog("Game not ready.", false);
      return;
    }
    const trimmed = raw.trim();
    if (!trimmed) return;

    history.push(trimmed);
    if (history.length > MAX_HISTORY) history.shift();
    historyIdx = history.length;

    appendLog(`> ${trimmed}`, true);
    const result = executeDevCommand(ctx.state, trimmed, ctx);
    const lines = result.lines || [result.message];
    lines.forEach((l) => appendLog(l, result.ok));
    if (ctx.renderAll) ctx.renderAll();
  }

  function refreshDevUi() {
    const on = isDevMode();
    toggleBtn?.classList.toggle("hidden", !on);
    if (!on) setVisible(false);
  }

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      runLine(input.value);
      input.value = "";
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setVisible(false);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (history.length === 0) return;
      historyIdx = Math.max(0, historyIdx - 1);
      input.value = history[historyIdx] || "";
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      historyIdx = Math.min(history.length, historyIdx + 1);
      input.value = history[historyIdx] || "";
    }
  });

  closeBtn?.addEventListener("click", () => setVisible(false));
  toggleBtn?.addEventListener("click", () => setVisible(!open));

  document.addEventListener("keydown", (e) => {
    if (!isDevMode()) return;
    if (e.key === "`" || e.key === "~") {
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") {
        if (document.activeElement !== input) return;
      }
      e.preventDefault();
      setVisible(!open);
    }
  });

  refreshDevUi();

  return {
    refresh: refreshDevUi,
    open: () => setVisible(true),
    run: runLine,
  };
}
