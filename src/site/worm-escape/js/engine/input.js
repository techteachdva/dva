// Keyboard input with "held", "just pressed", and "just released" states.
export class Input {
  constructor() {
    this.down = new Set();
    this.pressed = new Set();
    this.released = new Set();

    window.addEventListener("keydown", (e) => {
      const k = this._norm(e.key);
      if (!this.down.has(k)) this.pressed.add(k);
      this.down.add(k);
      // Prevent arrow keys / space from scrolling page
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " ", "Space"].includes(e.key)) {
        e.preventDefault();
      }
    });

    window.addEventListener("keyup", (e) => {
      const k = this._norm(e.key);
      this.down.delete(k);
      this.released.add(k);
    });

    window.addEventListener("blur", () => {
      this.down.clear();
    });
  }

  _norm(k) {
    if (k === " ") return "Space";
    if (k.length === 1) return k.toLowerCase();
    return k;
  }

  isDown(...keys) {
    return keys.some((k) => this.down.has(this._norm(k)));
  }

  wasPressed(...keys) {
    return keys.some((k) => this.pressed.has(this._norm(k)));
  }

  wasReleased(...keys) {
    return keys.some((k) => this.released.has(this._norm(k)));
  }

  // Call at END of every frame.
  endFrame() {
    this.pressed.clear();
    this.released.clear();
  }
}
