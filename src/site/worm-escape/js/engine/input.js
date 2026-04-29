// Keyboard + mouse input with "held", "just pressed", and "just released"
// states. Mouse position is reported in CANVAS-SPACE coordinates (1280x800),
// so callers don't have to worry about CSS scaling. The canvas element is
// optional - if omitted, the mouse half of this class is a no-op.
export class Input {
  constructor(canvas = null) {
    this.down = new Set();
    this.pressed = new Set();
    this.released = new Set();

    // Mouse state - always populated even without a canvas so callers can
    // read .mouseX / .mouseY without guarding.
    this.canvas = canvas || null;
    this.mouseX = 0;
    this.mouseY = 0;
    // Raw page coords (before scaling) - kept for debugging.
    this._rawMouseX = 0;
    this._rawMouseY = 0;
    // Mouse buttons use the same pressed/released pattern as keys but under
    // synthetic keys "Mouse0" (left), "Mouse1" (middle), "Mouse2" (right).
    //
    // We wire mouse position to the window (not just the canvas) so the
    // reticle keeps updating while the mouse is outside the canvas - it
    // just clamps to the canvas edge.

    window.addEventListener("keydown", (e) => {
      const k = this._norm(e.key);
      if (!this.down.has(k)) this.pressed.add(k);
      this.down.add(k);
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

    // Mouse plumbing (only attached if a canvas was supplied).
    if (this.canvas) {
      const onMove = (e) => {
        this._rawMouseX = e.clientX;
        this._rawMouseY = e.clientY;
        const rect = this.canvas.getBoundingClientRect();
        // Map from CSS pixels to the canvas drawing buffer (1280x800).
        const sx = this.canvas.width  / rect.width;
        const sy = this.canvas.height / rect.height;
        this.mouseX = (e.clientX - rect.left) * sx;
        this.mouseY = (e.clientY - rect.top)  * sy;
      };
      window.addEventListener("mousemove", onMove);

      const onDown = (e) => {
        const k = `Mouse${e.button}`;
        if (!this.down.has(k)) this.pressed.add(k);
        this.down.add(k);
      };
      const onUp = (e) => {
        const k = `Mouse${e.button}`;
        this.down.delete(k);
        this.released.add(k);
      };
      // Only count clicks originating on the canvas so UI elements outside
      // (if any) don't produce spurious combat events.
      this.canvas.addEventListener("mousedown", onDown);
      window.addEventListener("mouseup", onUp);
      // Suppress the browser's right-click context menu inside the game.
      this.canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    }
  }

  _norm(k) {
    if (k === " ") return "Space";
    if (k.length === 1) return k.toLowerCase();
    return k;
  }

  isDown(...keys) {
    return keys.some((k) => this.down.has(this._norm(k)));
  }

  /** True when every listed key is currently held (for chords). */
  allHeld(...keys) {
    return keys.every((k) => this.down.has(this._norm(k)));
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
