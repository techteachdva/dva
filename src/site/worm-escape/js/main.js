import { Loop } from "./engine/loop.js";
import { Input } from "./engine/input.js";
import { SceneManager } from "./engine/scenes.js";
import { applyShake, W, H, COLORS, drawText } from "./engine/render.js";
import { toggleMute, isMuted, SFX } from "./engine/audio.js";
import { IntroScene } from "./scenes/intro.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

const game = {
  ctx,
  input: new Input(),
  scenes: new SceneManager(),
  t: 0,
  player: null,
  chamberIndex: 0,
  W, H,
};

game.scenes.push(new IntroScene(), game);

const loop = new Loop(
  (dt) => {
    game.t += dt;

    // Global mute toggle (M). Processed BEFORE scenes consume inputs,
    // but wasPressed persists across the frame so scenes still see it if needed.
    if (game.input.wasPressed("m")) {
      const nowMuted = toggleMute();
      if (!nowMuted) SFX.click();
    }

    game.scenes.update(dt, game);
    game.input.endFrame();
  },
  (dt) => {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    applyShake(ctx, dt);
    game.scenes.render(ctx, game);

    // Global mute indicator (floating, top-left tiny badge)
    if (isMuted()) {
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
