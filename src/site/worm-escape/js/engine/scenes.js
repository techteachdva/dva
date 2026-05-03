import { clearPinkFloydTrail } from "./pinkFloydVfx.js";

// Tiny scene stack. Each scene is an object: { enter?, exit?, update(dt, game), render(ctx, game) }.

export class SceneManager {
  constructor() {
    this.stack = [];
  }

  get current() {
    return this.stack[this.stack.length - 1];
  }

  replace(scene, game) {
    if (this.current && this.current.exit) this.current.exit(game);
    this.stack.pop();
    this.stack.push(scene);
    clearPinkFloydTrail(game);
    if (scene.enter) scene.enter(game);
  }

  push(scene, game) {
    if (this.current && this.current.pause) this.current.pause(game);
    this.stack.push(scene);
    clearPinkFloydTrail(game);
    if (scene.enter) scene.enter(game);
  }

  pop(game) {
    const top = this.stack.pop();
    if (top && top.exit) top.exit(game);
    clearPinkFloydTrail(game);
    if (this.current && this.current.resume) this.current.resume(game);
  }

  update(dt, game) {
    if (this.current && this.current.update) this.current.update(dt, game);
  }

  render(ctx, game) {
    if (this.current && this.current.render) this.current.render(ctx, game);
  }
}
