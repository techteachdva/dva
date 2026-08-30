/**
 * GTG — lightweight per-room interactable minigames.
 * Each room gets a quick challenge before choices unlock (first visit only).
 */
(() => {
  "use strict";

  const ROOM_GAMES = {
    start: { type: "wire", title: "Calibrate the briefing holo-map", hint: "Tap the nodes in order to power the campus grid." },
    design_lab: { type: "wire", title: "Wire the user-research circuit", hint: "Connect the interview nodes before the ship timer hits zero." },
    data_vault: { type: "sequence", title: "Vault lock sequence", hint: "Memorize the glowing data keys, then repeat the pattern." },
    password_temple: { type: "pick", title: "Pick the strongest vault key", hint: "Only one password survives a real breach.", options: ["password123", "P@ssw0rd!2024#vault", "dragon"], correct: 1 },
    footprint_scene: { type: "tap", title: "Scrub your digital footprints", hint: "Tap every glowing trace before it spreads." },
    media_chamber: { type: "pick", title: "Spot the real headline", hint: "Three screens, one verified source.", options: ["BREAKING: aliens confirmed", "Local school wins robotics — verified AP", "SHARE FAST: miracle cure found"], correct: 1 },
    prepare_phase: { type: "sort", title: "Order the simulation steps", hint: "Click the phases in the right build order.", items: ["Plan", "Prototype", "Test", "Ship"], order: [0, 1, 2, 3] },
    try_phase: { type: "tap", title: "Catch the prototype bugs", hint: "Tap the red glitches before they multiply." },
    debug_scene: { type: "patch", title: "Patch Hopper's fleet", hint: "Click every error flag on the console." },
    reflect_phase: { type: "sort", title: "Stack the reflection chart", hint: "Order the review steps.", items: ["Observe", "Analyze", "Improve", "Share"], order: [0, 1, 2, 3] },
    code_bay: { type: "wire", title: "Route the algorithm bus", hint: "Complete the logic circuit left to right." },
    network_closet: { type: "pick", title: "Route the secure signal", hint: "Pick the connection that won't leak data.", options: ["Public café Wi-Fi", "School VPN + 2FA", "Neighbor's open hotspot"], correct: 1 },
    sources_library: { type: "pick", title: "Find the primary source", hint: "Which link leads to the original study?", options: ["Random blog repost", "University research archive", "Screenshot chain on social"], correct: 1 },
    ip_chamber: { type: "pick", title: "License the track", hint: "Which option respects the artist?", options: ["Rip the full song", "Royalty-free with credit", "Hope nobody notices"], correct: 1 },
    collaboration_bridge: { type: "sequence", title: "Kindness relay codes", hint: "Repeat the support signal pattern." },
    trajectory_scene: { type: "tap", title: "Plot the trajectory", hint: "Tap the nav beacons in launch order." },
    ai_ethics: { type: "pick", title: "Bias scanner", hint: "Which test set is actually fair?", options: ["Engineers only", "Diverse faces + lighting", "One selfie from the CEO"], correct: 1 },
    hardware_graveyard: { type: "patch", title: "Wipe the graveyard drives", hint: "Clear every blinking data LED." },
    open_source: { type: "sort", title: "Restore the credits file", hint: "Put the attribution lines back in order.", items: ["Author name", "License type", "Source link", "Changes made"], order: [0, 1, 2, 3] },
    bias_unit: { type: "pick", title: "Fairness audit", hint: "Which chart shows the real disparity?", options: ["Overall average only", "Split by demographic group", "Marketing slide"], correct: 1 },
    data_detective: { type: "wire", title: "Trace the data trail", hint: "Follow the profile circuit across three apps." },
    final_trial: { type: "sequence", title: "Golden Rule handshake", hint: "Lock in the five-rule sequence." },
  };

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function mountShell(title, hint) {
    const host = document.getElementById("sceneChoices");
    if (!host) return null;
    host.innerHTML = `<div class="tt-minigame" role="region" aria-label="${title}">
      <div class="tt-minigame__header">
        <span class="tt-minigame__badge">⚡ Room challenge</span>
        <h3 class="tt-minigame__title">${title}</h3>
        <p class="tt-minigame__hint">${hint}</p>
      </div>
      <div class="tt-minigame__arena" id="minigameArena"></div>
      <p class="tt-minigame__status" id="minigameStatus"></p>
    </div>`;
    return {
      arena: document.getElementById("minigameArena"),
      status: document.getElementById("minigameStatus"),
      host,
    };
  }

  function runWire(ui, resolve) {
    const nodes = [
      { id: "A", x: 12, y: 50, color: "#9d8cff" },
      { id: "B", x: 50, y: 18, color: "#44ffcc" },
      { id: "C", x: 88, y: 50, color: "#ffd54a" },
      { id: "D", x: 50, y: 82, color: "#ff6688" },
    ];
    const order = ["A", "B", "C", "D"];
    let step = 0;
    let failed = false;
    ui.arena.innerHTML = `<svg class="tt-minigame__wires" viewBox="0 0 100 100" aria-hidden="true">
      <path class="tt-minigame__wire" d="M12,50 L50,18 L88,50 L50,82 Z" />
    </svg>
    ${nodes.map((n) => `<button type="button" class="tt-minigame__node" data-node="${n.id}" style="left:${n.x}%;top:${n.y}%;--node-color:${n.color}">${n.id}</button>`).join("")}`;
    const setStatus = (msg) => { if (ui.status) ui.status.textContent = msg; };
    setStatus("Tap node A to start the circuit.");
    ui.arena.querySelectorAll(".tt-minigame__node").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (failed) return;
        const id = btn.dataset.node;
        if (id === order[step]) {
          btn.classList.add("tt-minigame__node--lit");
          step += 1;
          if (step >= order.length) {
            setStatus("Circuit live! ✓");
            setTimeout(() => resolve(true), 500);
          } else {
            setStatus(`Good — now tap node ${order[step]}.`);
          }
        } else {
          failed = true;
          btn.classList.add("tt-minigame__node--fail");
          setStatus("Wrong node — short circuit! Try again.");
          setTimeout(() => resolve(false), 900);
        }
      });
    });
  }

  function runSequence(ui, resolve) {
    const colors = ["#9d8cff", "#44ffcc", "#ffd54a", "#ff6688"];
    const pads = shuffle([0, 1, 2, 3]).slice(0, 3 + Math.floor(Math.random() * 2));
    let showing = true;
    let inputStep = 0;
    ui.arena.innerHTML = `<div class="tt-minigame__pads">
      ${colors.map((c, i) => `<button type="button" class="tt-minigame__pad" data-pad="${i}" style="--pad-color:${c}"></button>`).join("")}
    </div>`;
    const setStatus = (msg) => { if (ui.status) ui.status.textContent = msg; };
    const padEls = [...ui.arena.querySelectorAll(".tt-minigame__pad")];

    function flash(idx, on) {
      padEls[idx]?.classList.toggle("tt-minigame__pad--lit", on);
    }

    async function playSequence() {
      setStatus("Watch the pattern…");
      for (const idx of pads) {
        flash(idx, true);
        await new Promise((r) => setTimeout(r, 420));
        flash(idx, false);
        await new Promise((r) => setTimeout(r, 180));
      }
      showing = false;
      setStatus("Your turn — repeat the pattern.");
    }

    padEls.forEach((btn) => {
      btn.addEventListener("click", () => {
        if (showing) return;
        const idx = Number(btn.dataset.pad);
        flash(idx, true);
        setTimeout(() => flash(idx, false), 200);
        if (idx === pads[inputStep]) {
          inputStep += 1;
          if (inputStep >= pads.length) {
            setStatus("Pattern matched! ✓");
            setTimeout(() => resolve(true), 500);
          }
        } else {
          setStatus("Wrong pad — sequence reset.");
          setTimeout(() => resolve(false), 800);
        }
      });
    });
    playSequence();
  }

  function runPick(ui, game, resolve) {
    const opts = shuffle(game.options.map((label, i) => ({ label, i })));
    ui.arena.innerHTML = `<div class="tt-minigame__picks">
      ${opts.map((o) => `<button type="button" class="tt-minigame__pick" data-idx="${o.i}">${o.label}</button>`).join("")}
    </div>`;
    const setStatus = (msg) => { if (ui.status) ui.status.textContent = msg; };
    setStatus("Make the call — one chance.");
    ui.arena.querySelectorAll(".tt-minigame__pick").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.idx);
        if (idx === game.correct) {
          btn.classList.add("tt-minigame__pick--good");
          setStatus("Correct! ✓");
          setTimeout(() => resolve(true), 500);
        } else {
          btn.classList.add("tt-minigame__pick--bad");
          setStatus("Wrong choice — that would fail in the field.");
          setTimeout(() => resolve(false), 900);
        }
      });
    });
  }

  function runTap(ui, resolve) {
    const count = 5;
    let hits = 0;
    let live = true;
    ui.arena.classList.add("tt-minigame__arena--tap");
    ui.arena.innerHTML = "";
    const setStatus = (msg) => { if (ui.status) ui.status.textContent = msg; };
    setStatus(`Tap ${count} glitches — ${hits}/${count}`);

    function spawn() {
      if (!live || hits >= count) return;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tt-minigame__glitch";
      btn.style.left = `${10 + Math.random() * 75}%`;
      btn.style.top = `${12 + Math.random() * 68}%`;
      btn.textContent = "⚡";
      const ttl = setTimeout(() => {
        if (!btn.isConnected) return;
        btn.remove();
        if (live && hits < count) {
          live = false;
          setStatus("Too slow — glitch spread!");
          setTimeout(() => resolve(false), 700);
        }
      }, 1400);
      btn.addEventListener("click", () => {
        clearTimeout(ttl);
        btn.classList.add("tt-minigame__glitch--hit");
        hits += 1;
        setTimeout(() => btn.remove(), 150);
        setStatus(`Tap ${count} glitches — ${hits}/${count}`);
        if (hits >= count) {
          live = false;
          setStatus("Sector clear! ✓");
          setTimeout(() => resolve(true), 500);
        } else {
          spawn();
        }
      });
      ui.arena.appendChild(btn);
    }
    for (let i = 0; i < 3; i++) setTimeout(spawn, i * 350);
  }

  function runSort(ui, game, resolve) {
    const items = shuffle(game.items.map((label, i) => ({ label, i })));
    let next = 0;
    ui.arena.innerHTML = `<div class="tt-minigame__sort">${items.map((it) =>
      `<button type="button" class="tt-minigame__sort-item" data-idx="${it.i}">${it.label}</button>`
    ).join("")}</div>`;
    const setStatus = (msg) => { if (ui.status) ui.status.textContent = msg; };
    setStatus(`Step 1: pick "${game.items[game.order[0]]}"`);
    ui.arena.querySelectorAll(".tt-minigame__sort-item").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.idx);
        if (idx === game.order[next]) {
          btn.classList.add("tt-minigame__sort-item--done");
          btn.disabled = true;
          next += 1;
          if (next >= game.order.length) {
            setStatus("Sequence locked! ✓");
            setTimeout(() => resolve(true), 500);
          } else {
            setStatus(`Step ${next + 1}: pick "${game.items[game.order[next]]}"`);
          }
        } else {
          btn.classList.add("tt-minigame__sort-item--fail");
          setStatus("Wrong order — circuit scrambled.");
          setTimeout(() => resolve(false), 800);
        }
      });
    });
  }

  function runPatch(ui, resolve) {
    const bugs = 6;
    let cleared = 0;
    ui.arena.classList.add("tt-minigame__arena--patch");
    ui.arena.innerHTML = `<div class="tt-minigame__console">
      <div class="tt-minigame__console-bar">root@hopper-fleet:~$ scan --errors</div>
      <div class="tt-minigame__console-body" id="patchBody"></div>
    </div>`;
    const body = document.getElementById("patchBody");
    const setStatus = (msg) => { if (ui.status) ui.status.textContent = msg; };
    setStatus(`Clear ${bugs} error flags.`);
    for (let i = 0; i < bugs; i++) {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "tt-minigame__bug";
      row.innerHTML = `<span>ERROR ${100 + i}</span><em>patch</em>`;
      row.addEventListener("click", () => {
        row.classList.add("tt-minigame__bug--fixed");
        row.disabled = true;
        cleared += 1;
        setStatus(`Clear ${bugs} error flags — ${cleared}/${bugs}`);
        if (cleared >= bugs) {
          setStatus("Fleet patched! ✓");
          setTimeout(() => resolve(true), 500);
        }
      });
      body.appendChild(row);
    }
  }

  function forRoom(roomId) {
    return ROOM_GAMES[roomId] || null;
  }

  function play(roomId) {
    const game = forRoom(roomId);
    if (!game) return Promise.resolve(true);
    const ui = mountShell(game.title, game.hint);
    if (!ui) return Promise.resolve(true);

    return new Promise((resolve) => {
      const done = (ok) => {
        if (ui.host) {
          ui.host.querySelector(".tt-minigame")?.classList.add(ok ? "tt-minigame--win" : "tt-minigame--fail");
        }
        setTimeout(() => resolve(ok), ok ? 400 : 600);
      };
      switch (game.type) {
        case "wire": runWire(ui, done); break;
        case "sequence": runSequence(ui, done); break;
        case "pick": runPick(ui, game, done); break;
        case "tap": runTap(ui, done); break;
        case "sort": runSort(ui, game, done); break;
        case "patch": runPatch(ui, done); break;
        default: resolve(true);
      }
    });
  }

  window.TechTrailMinigames = { forRoom, play, ROOM_GAMES };
})();
