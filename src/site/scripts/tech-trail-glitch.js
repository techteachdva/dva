/**
 * GTG — scam / glitch burst on wrong citizenship choices (Tech Escape inspired).
 */
(() => {
  "use strict";

  const SCAM_TEMPLATES = [
    { title: "CONGRATULATIONS!!!", body: "You won a FREE iPhone! Click HERE to claim!", cta: "CLAIM NOW" },
    { title: "Urgent: Virus Detected", body: "847 threats found. Call Microsoft Support NOW.", cta: "SCAN PC" },
    { title: "Your account will be deleted", body: "Verify your password in the next 5 minutes.", cta: "VERIFY" },
    { title: "You have (1) package", body: "Pay $2.99 customs fee to release delivery.", cta: "PAY FEE" },
    { title: "Crypto Giveaway", body: "Send 0.1 ETH, get 1 ETH back instantly!!!", cta: "SEND ETH" },
    { title: "School IT Alert", body: "Your grades were posted to a public link. Sign in.", cta: "SIGN IN" },
    { title: "FREE Robux Generator", body: "No survey. Enter your login. 100% real.", cta: "GET ROBUX" },
    { title: "System Error 0x800", body: "Windows license expired. Enter credit card.", cta: "ACTIVATE" },
  ];

  const FAKE_ERRORS = [
    "CRITICAL: kernel panic — save work???",
    "Connection lost. Re-enter SSN to continue.",
    "Your webcam is being accessed by 3 apps.",
    "WARNING: 12 accounts compromised.",
  ];

  let overlay;
  let popHost;
  let glitchTimer = 0;

  function ensureDom() {
    overlay = document.getElementById("gtgGlitchOverlay");
    popHost = document.getElementById("gtgGlitchPopups");
    return overlay && popHost;
  }

  function reduced() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches
      || document.body.classList.contains("tt-still-camera");
  }

  function burst() {
    if (!ensureDom()) return;
    overlay.classList.remove("is-firing", "is-firing-soft");
    void overlay.offsetWidth;
    overlay.classList.add(reduced() ? "is-firing-soft" : "is-firing");
    clearTimeout(glitchTimer);
    glitchTimer = setTimeout(() => {
      overlay.classList.remove("is-firing", "is-firing-soft");
    }, reduced() ? 260 : 620);
  }

  function spawnPopup() {
    if (!popHost) return;
    const tpl = SCAM_TEMPLATES[Math.floor(Math.random() * SCAM_TEMPLATES.length)];
    const err = FAKE_ERRORS[Math.floor(Math.random() * FAKE_ERRORS.length)];
    const el = document.createElement("div");
    el.className = "tt-gtg-scam";
    el.innerHTML = `
      <button type="button" class="tt-gtg-scam__x" aria-label="Close fake popup">&times;</button>
      <div class="tt-gtg-scam__title">${tpl.title}</div>
      <p class="tt-gtg-scam__body">${tpl.body}</p>
      <p class="tt-gtg-scam__err">${err}</p>
      <button type="button" class="tt-gtg-scam__cta">${tpl.cta}</button>`;
    el.style.left = `${8 + Math.random() * 52}%`;
    el.style.top = `${10 + Math.random() * 38}%`;
    el.querySelector(".tt-gtg-scam__x")?.addEventListener("click", () => el.remove());
    el.querySelector(".tt-gtg-scam__cta")?.addEventListener("click", () => {
      el.classList.add("tt-gtg-scam--shake");
      setTimeout(() => el.remove(), 400);
    });
    popHost.appendChild(el);
    const ttl = reduced() ? 2200 : 3600 + Math.random() * 1800;
    setTimeout(() => el.remove(), ttl);
  }

  function onWrongChoice(choice) {
    const bad = (typeof choice?.integrity === "number" && choice.integrity < 0)
      || (typeof choice?.reputation === "number" && choice.reputation < 0)
      || /recovery|_fail|wrong/i.test(String(choice?.next || ""));
    if (!bad) return;
    burst();
    const count = reduced() ? 1 : 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < count; i++) {
      setTimeout(spawnPopup, i * (reduced() ? 120 : 280));
    }
  }

  window.TechTrailGlitch = { burst, onWrongChoice, spawnPopup };
})();
