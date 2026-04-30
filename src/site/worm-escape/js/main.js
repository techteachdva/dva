import { Loop } from "./engine/loop.js";
import { Input } from "./engine/input.js";
import { SceneManager } from "./engine/scenes.js";
import { applyShake, W, H, COLORS, drawText, drawPanel, drawBanner } from "./engine/render.js";
import { pointInRect } from "./engine/pointer.js";
import { toggleMute, isMuted, SFX, initBGM } from "./engine/audio.js";
import { IntroScene } from "./scenes/intro.js";
import { applyCheatLine } from "./engine/cheatActions.js";
import { preloadWeaponArt } from "./engine/weaponArt.js";

// Loop the "Level Up" track as background music. The file lives next to
// index.html (path relative to the HTML page, not this JS file). Spaces
// in the filename must be percent-encoded for the request to resolve.
initBGM("Level%20Up.mp3", { volume: 0.35, loop: true });
void preloadWeaponArt();

/** Shown lower-right — bump alongside meaningful releases / CHANGELOG. */
const GAME_VERSION = "v0.16.1";

const stageEl = document.getElementById("stage");

function toggleFullscreen() {
  try {
    if (!document.fullscreenElement) {
      void (stageEl || document.documentElement).requestFullscreen();
    } else {
      void document.exitFullscreen();
    }
  } catch (e) {
    /* safari / blocked */
  }
}

/** Global fullscreen toggle — tucked right of hero stats stack, left of combat enemy HUD (~W−280). */
const FULLSCREEN_BTN = { x: W - 280 - 8 - 140, y: 8, w: 140, h: 30 };

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;
try {
  canvas.focus({ preventScroll: true });
} catch (_) {
  try {
    canvas.focus();
  } catch (_) { /* noop */ }
}

const game = {
  ctx,
  canvas,
  input: new Input(canvas),
  scenes: new SceneManager(),
  t: 0,
  player: null,
  chamberIndex: 0,
  W, H,
  invulnerable: false,
  pickAnyWeapon: false,
  cheatMenuOpen: false,
  cheatInput: "",
  cheatFlash: "",
  cheatFlashT: 0,
  cheatSaveRefresh: false,
};

game.scenes.push(new IntroScene(), game);

function updateCheatMenu(game) {
  const inp = game.input;
  if (inp.wasPressed("Escape")) {
    game.cheatMenuOpen = false;
    game.cheatInput = "";
    return;
  }

  const letters = "abcdefghijklmnopqrstuvwxyz0123456789";
  for (const ch of letters) {
    if (inp.wasPressed(ch)) game.cheatInput += ch;
  }
  if (inp.wasPressed("Backspace") && game.cheatInput.length > 0) {
    game.cheatInput = game.cheatInput.slice(0, -1);
  }

  if (inp.wasPressed(" ", "Space")) {
    game.cheatInput += " ";
  }

  if (inp.wasPressed("Enter")) {
    const res = applyCheatLine(game.cheatInput, game);
    game.cheatFlash = res.msg;
    game.cheatFlashT = res.ok ? 3.6 : 2.4;
    if (res.ok) {
      game.cheatInput = "";
      game.cheatMenuOpen = false;
    }
  }
}

const loop = new Loop(
  (dt) => {
    game.t += dt;
    if (game.cheatFlashT > 0) game.cheatFlashT -= dt;

    // Fullscreen: Alt+Enter, "=", or the top-left button (see render pass).
    const altEnter =
      (game.input.isDown("Alt") || game.input.isDown("Meta")) &&
      game.input.wasPressed("Enter");
    if (document.fullscreenEnabled !== false) {
      if (altEnter) {
        toggleFullscreen();
        SFX.click();
        game.input.consumePress("Enter");
      } else if (game.input.wasPressed("=", "NumpadEqual")) {
        toggleFullscreen();
        SFX.click();
        game.input.consumePress("=", "NumpadEqual");
      } else if (
        game.input.wasPressed("Mouse0")
        && pointInRect(
          game.input.mouseX,
          game.input.mouseY,
          FULLSCREEN_BTN.x,
          FULLSCREEN_BTN.y,
          FULLSCREEN_BTN.w,
          FULLSCREEN_BTN.h,
        )
      ) {
        toggleFullscreen();
        SFX.click();
        game.input.consumePress("Mouse0");
      }
    }

    // Global mute toggle (M). Skip while cheat overlay is open so phrases can include "m".
    if (
      !game.cheatMenuOpen &&
      game.input.wasPressed("m")
    ) {
      const nowMuted = toggleMute();
      if (!nowMuted) SFX.click();
      game.input.consumePress("m");
    }

    const cheatPulse =
      game.input.wasPressed("\\") ||
      game.input.wasCodePressed("Backslash", "IntlBackslash");
    if (!game.cheatMenuOpen && cheatPulse) {
      game.cheatMenuOpen = true;
      game.cheatInput = "";
      game.cheatFlash = "";
      SFX.click();
    }

    if (game.cheatMenuOpen) {
      updateCheatMenu(game);
    } else {
      game.scenes.update(dt, game);
    }
    game.input.endFrame();
  },
  (dt) => {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    applyShake(ctx, dt);
    game.scenes.render(ctx, game);

    if (game.cheatMenuOpen) {
      ctx.fillStyle = "rgba(10, 4, 12, 0.88)";
      ctx.fillRect(0, 0, W, H);
      drawBanner(ctx, "CHEAT ENTRY", W / 2, 140, 32, COLORS.wormHi, COLORS.blood);
      drawPanel(ctx, W / 2 - 420, 200, 840, 360);
      drawText(
        ctx,
        "This terminal swallowed the manual. Whisper something that sounds plausible — ENTER to beg; ESC to leave empty-handed.",
        W / 2,
        216,
        {
          size: 15,
          color: COLORS.boneDim,
          align: "center",
          maxWidth: W - 120,
        },
      );
      const line = "> " + (game.cheatInput || "") + "_";
      drawText(ctx, line, W / 2, 280, {
        size: 24,
        color: COLORS.bile,
        align: "center",
        bold: true,
        maxWidth: W - 120,
      });
      drawText(ctx, "ENTER · ESC", W / 2, 392, {
        size: 14, color: COLORS.boneDim, align: "center",
      });
    } else if (game.cheatFlashT > 0 && game.cheatFlash) {
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(W / 2 - 340, H - 70, 680, 40);
      drawText(ctx, game.cheatFlash, W / 2, H - 58, {
        size: 14, color: COLORS.gold, align: "center", bold: true,
        maxWidth: W - 100,
      });
    }

    // Fullscreen control (above scene HUD; drawn after cheat overlay so it stays clickable).
    if (document.fullscreenEnabled !== false) {
      const { x, y, w, h } = FULLSCREEN_BTN;
      drawPanel(ctx, x, y, w, h);
      const fs = !!document.fullscreenElement;
      drawText(ctx, fs ? "EXIT (=)" : "FULLSCREEN (=)", x + w / 2, y + h / 2, {
        size: 12,
        color: fs ? "#ffcc88" : COLORS.bone,
        align: "center",
        baseline: "middle",
        bold: true,
        maxWidth: w - 10,
      });
    }

    // Global mute indicator (floating, top-left tiny badge)
    if (!game.cheatMenuOpen && isMuted()) {
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.65)";
      ctx.fillRect(W / 2 - 48, 2, 96, 20);
      ctx.strokeStyle = "#ff8888";
      ctx.lineWidth = 1;
      ctx.strokeRect(W / 2 - 48, 2, 96, 20);
      drawText(ctx, "MUTED (M)", W / 2, 4, {
        size: 12,
        color: "#ff8888",
        align: "center",
        baseline: "top",
        bold: true,
      });
      ctx.restore();
    }

    drawText(ctx, GAME_VERSION, W - 12, H - 8, {
      size: 11,
      color: "rgba(233,220,193,0.42)",
      align: "right",
      baseline: "bottom",
      bold: true,
      outline: false,
    });

    ctx.restore();
  }
);

loop.start();

// Dev helper only — avoid exposing live game state on public deploys / file opens.
try {
  const h = typeof location !== "undefined" ? location.hostname : "";
  if (/^(localhost|127\.0\.0\.1)$/i.test(String(h))) {
    window.__game = game;
  }
} catch (_) {
  /* noop */
}
