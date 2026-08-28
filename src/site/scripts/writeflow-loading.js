/**
 * WriteFlow — shared loading / busy-state helpers for student UI.
 */
(() => {
  "use strict";

  const buttonState = new WeakMap();
  const guards = new Map();

  function escapeHtml(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function ensureGlobalBar(host) {
    const root = host || document.body;
    let bar = root.querySelector(".wf-global-loading");
    if (!bar) {
      bar = document.createElement("div");
      bar.className = "wf-global-loading dw-hidden";
      bar.setAttribute("role", "status");
      bar.setAttribute("aria-live", "polite");
      bar.innerHTML = `
        <div class="wf-global-loading__track" aria-hidden="true"></div>
        <p class="wf-global-loading__label wf-sr-only">Loading</p>`;
      root.insertBefore(bar, root.firstChild);
    }
    return bar;
  }

  function setButtonBusy(btn, busy, options = {}) {
    if (!btn) return;
    const busyLabel = options.busyLabel || "Working…";
    if (busy) {
      if (!buttonState.has(btn)) {
        buttonState.set(btn, {
          html: btn.innerHTML,
          disabled: btn.disabled,
          text: btn.textContent,
        });
      }
      btn.disabled = true;
      btn.setAttribute("aria-busy", "true");
      btn.classList.add("wf-btn--loading");
      btn.innerHTML = `<span class="wf-btn__spinner" aria-hidden="true"></span><span>${escapeHtml(busyLabel)}</span>`;
      return;
    }
    const prev = buttonState.get(btn);
    if (prev) {
      btn.innerHTML = prev.html;
      btn.disabled = prev.disabled;
      buttonState.delete(btn);
    } else {
      btn.disabled = false;
    }
    btn.removeAttribute("aria-busy");
    btn.classList.remove("wf-btn--loading");
  }

  async function withButtonBusy(btn, fn, options = {}) {
    if (!btn || btn.getAttribute("aria-busy") === "true") return;
    setButtonBusy(btn, true, options);
    try {
      return await fn();
    } finally {
      setButtonBusy(btn, false);
    }
  }

  function setFormBusy(form, busy) {
    if (!form) return;
    form.querySelectorAll("button, input, select, textarea").forEach((el) => {
      if (busy) {
        el.dataset.wfPrevDisabled = el.disabled ? "1" : "0";
        el.disabled = true;
        return;
      }
      if (el.dataset.wfPrevDisabled === "0") el.disabled = false;
      delete el.dataset.wfPrevDisabled;
    });
  }

  async function withFormBusy(form, fn, options = {}) {
    if (!form || form.dataset.wfBusy === "1") return;
    form.dataset.wfBusy = "1";
    setFormBusy(form, true);
    const submitBtn = form.querySelector('[type="submit"]');
    if (submitBtn) setButtonBusy(submitBtn, true, options);
    try {
      return await fn();
    } finally {
      delete form.dataset.wfBusy;
      setFormBusy(form, false);
      if (submitBtn) setButtonBusy(submitBtn, false);
    }
  }

  function showGlobalBar(host, message) {
    const bar = ensureGlobalBar(host);
    const label = bar.querySelector(".wf-global-loading__label");
    if (label) label.textContent = message || "Loading…";
    bar.classList.remove("dw-hidden");
    bar.setAttribute("aria-hidden", "false");
  }

  function hideGlobalBar(host) {
    const bar = (host || document.body).querySelector(".wf-global-loading");
    if (!bar) return;
    bar.classList.add("dw-hidden");
    bar.setAttribute("aria-hidden", "true");
  }

  function showListLoading(container, message = "Loading your work…") {
    if (!container) return;
    container.innerHTML = `
      <div class="wf-list-loading" role="status" aria-live="polite" aria-busy="true">
        <div class="wf-progress wf-progress--indeterminate" aria-hidden="true"><div class="wf-progress__bar"></div></div>
        <p class="wf-list-loading__text dw-muted">${escapeHtml(message)}</p>
      </div>`;
  }

  function setAnalyzingStatus(message, progress) {
    const label = document.getElementById("analyzingStatus");
    const bar = document.getElementById("analyzingProgressBar");
    const wrap = document.getElementById("analyzingProgress");
    if (label && message) label.textContent = message;
    if (wrap) wrap.classList.remove("dw-hidden");
    if (bar && Number.isFinite(progress)) {
      const pct = Math.max(0, Math.min(100, progress));
      bar.style.width = `${pct}%`;
      wrap?.setAttribute("aria-valuenow", String(Math.round(pct)));
    }
  }

  function resetAnalyzingStatus() {
    setAnalyzingStatus("Analyzing your writing…", 8);
  }

  async function runGuarded(key, fn) {
    if (guards.get(key)) return guards.get(key);
    const promise = Promise.resolve().then(fn).finally(() => {
      guards.delete(key);
    });
    guards.set(key, promise);
    return promise;
  }

  function isGuarded(key) {
    return guards.has(key);
  }

  window.WriteFlowLoading = {
    setButtonBusy,
    withButtonBusy,
    setFormBusy,
    withFormBusy,
    showGlobalBar,
    hideGlobalBar,
    showListLoading,
    setAnalyzingStatus,
    resetAnalyzingStatus,
    runGuarded,
    isGuarded,
  };
})();
