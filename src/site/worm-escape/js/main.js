import { Loop } from "./engine/loop.js";
import { Input } from "./engine/input.js";
import { SceneManager } from "./engine/scenes.js";
import { applyShake, W, H, COLORS, drawText, drawPanel, drawBanner } from "./engine/render.js";
import { toggleMute, isMuted, SFX, initBGM } from "./engine/audio.js";
import { IntroScene } from "./scenes/intro.js";
import { applyCheatLine } from "./engine/cheatActions.js";

// Loop the "Level Up" track as background music. The file lives next to
// index.html (path relative to the HTML page, not this JS file). Spaces
// in the filename must be percent-encoded for the request to resolve.
initBGM("Level%20Up.mp3", { volume: 0.35, loop: true });

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

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

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
  /** Edge-detect ZXNM cheat chord previous frame */
  _cheatChordLast: false,
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
    if (res.ok) game.cheatInput = "";
  }
}

const loop = new Loop(
  (dt) => {
    game.t += dt;
    if (game.cheatFlashT > 0) game.cheatFlashT -= dt;

    // Fullscreen: Alt+Enter (F is reserved for brace in combat).
    const altEnter =
      (game.input.isDown("Alt") || game.input.isDown("Meta")) &&
      game.input.wasPressed("Enter");
    if (altEnter && document.fullscreenEnabled !== false) {
      toggleFullscreen();
      SFX.click();
    }

    // Global mute toggle (M). Processed BEFORE scenes consume inputs,
    // but wasPressed persists across the frame so scenes still see it if needed.
    if (game.input.wasPressed("m")) {
      const nowMuted = toggleMute();
      if (!nowMuted) SFX.click();
    }

    // ZXNM chord — open cheat overlay (rising edge; close with ESC).
    if (!game.cheatMenuOpen) {
      const chordHeld = game.input.allHeld("z", "x", "n", "m");
      if (chordHeld && !game._cheatChordLast) {
        game.cheatMenuOpen = true;
        game.cheatInput = "";
        game.cheatFlash = "";
        SFX.click();
      }
      game._cheatChordLast = chordHeld;
    } else {
      game._cheatChordLast = false;
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
      drawText(ctx, "Type a cheat, ENTER to submit, ESC closes.", W / 2, 226, {
        size: 16, color: COLORS.boneDim, align: "center",
      });
      const line = "> " + (game.cheatInput || "") + "_";
      drawText(ctx, line, W / 2, 280, {
        size: 22,
        color: COLORS.bile,
        align: "center",
        bold: true,
        maxWidth: W - 120,
      });
      drawText(ctx, "jackson  •  dez  •  acererack  •  bossnow", W / 2, 408, {
        size: 14, color: COLORS.gold, align: "center",
      });
      drawText(ctx, "(Hold ZXNM together to toggle this)", W / 2, H - 40, {
        size: 12, color: COLORS.boneDim, align: "center", italic: true,
      });
    } else if (game.cheatFlashT > 0 && game.cheatFlash) {
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(W / 2 - 340, H - 70, 680, 40);
      drawText(ctx, game.cheatFlash, W / 2, H - 58, {
        size: 14, color: COLORS.gold, align: "center", bold: true,
        maxWidth: W - 100,
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

    ctx.restore();
  }
);

loop.start();

window.__game = game;
