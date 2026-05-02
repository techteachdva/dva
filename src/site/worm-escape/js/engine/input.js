// Keyboard + mouse input with "held", "just pressed", and "just released"
// states. Mouse position is reported in CANVAS-SPACE coordinates (1280x800),
// so callers don't have to worry about CSS scaling. The canvas element is
// optional - if omitted, the mouse half of this class is a no-op.
export class Input {
  constructor(canvas = null) {
    this.down = new Set();
    this.pressed = new Set();
    this.released = new Set();
    // Reliable edge detection using e.code (some layouts mis-report e.key for \\).
    this._codesDown = new Set();
    this.codesPressed = new Set();

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
      let keyChar = e.key;
      // Backslash key (US + many international layouts report different e.key).
      if (e.code === "Backslash" || e.code === "IntlBackslash") {
        keyChar = "\\";
      }
      const k = this._norm(keyChar);
      if (!this.down.has(k)) this.pressed.add(k);
      this.down.add(k);
      if (!this._codesDown.has(e.code)) this.codesPressed.add(e.code);
      this._codesDown.add(e.code);
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " ", "Space"].includes(e.key)) {
        e.preventDefault();
      }
      if (e.code === "Backslash" || e.code === "IntlBackslash") {
        e.preventDefault();
      }
      if (e.key === "=" || e.code === "Equal" || e.code === "NumpadEqual") {
        e.preventDefault();
      }
    });

    window.addEventListener("keyup", (e) => {
      let keyChar = e.key;
      if (e.code === "Backslash" || e.code === "IntlBackslash") {
        keyChar = "\\";
      }
      const k = this._norm(keyChar);
      this.down.delete(k);
      this.released.add(k);
      this._codesDown.delete(e.code);
    });

    window.addEventListener("blur", () => {
      this.down.clear();
      this.pressed.clear();
      this.released.clear();
      this._codesDown.clear();
      this.codesPressed.clear();
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
      const setFromClient = (clientX, clientY) => {
        const rect = this.canvas.getBoundingClientRect();
        const sx = this.canvas.width / rect.width;
        const sy = this.canvas.height / rect.height;
        this._rawMouseX = clientX;
        this._rawMouseY = clientY;
        this.mouseX = (clientX - rect.left) * sx;
        this.mouseY = (clientY - rect.top) * sy;
      };
      window.addEventListener("mousemove", onMove);

      const onDown = (e) => {
        if (e.button === 0) e.preventDefault();
        // Must sync coords on press — mousemove may never have fired for this
        // pixel (first click, tap without move, or click-hold without drag).
        // Without this, mouseX/Y stay at 0,0 and bottom HUD hits (mana vial) miss.
        setFromClient(e.clientX, e.clientY);
        try {
          this.canvas.focus({ preventScroll: true });
        } catch (_) {
          try {
            this.canvas.focus();
          } catch (_) { /* noop */ }
        }
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
      this.canvas.addEventListener(
        "touchstart",
        (e) => {
          if (!e.changedTouches || e.changedTouches.length < 1) return;
          const t = e.changedTouches[0];
          e.preventDefault();
          setFromClient(t.clientX, t.clientY);
          try {
            this.canvas.focus({ preventScroll: true });
          } catch (_) {
            try {
              this.canvas.focus();
            } catch (_) { /* noop */ }
          }
          if (!this.down.has("Mouse0")) this.pressed.add("Mouse0");
          this.down.add("Mouse0");
        },
        { passive: false },
      );
      this.canvas.addEventListener(
        "touchmove",
        (e) => {
          if (!e.touches || e.touches.length < 1) return;
          e.preventDefault();
          const t = e.touches[0];
          setFromClient(t.clientX, t.clientY);
        },
        { passive: false },
      );
      this.canvas.addEventListener(
        "touchend",
        (e) => {
          e.preventDefault();
          if (this.down.has("Mouse0")) {
            this.down.delete("Mouse0");
            this.released.add("Mouse0");
          }
        },
        { passive: false },
      );
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

  wasCodePressed(...codes) {
    return codes.some((c) => this.codesPressed.has(c));
  }

  /** Held state by physical KeyboardEvent.code (useful alongside isDown when e.key lies). */
  isCodeDown(...codes) {
    return codes.some((c) => this._codesDown.has(c));
  }

  /** Drop keys from this frame's "just pressed" set (e.g. global UI consumed the click). */
  consumePress(...keys) {
    for (const key of keys) this.pressed.delete(this._norm(key));
  }

  consumeCodePress(...codes) {
    for (const code of codes) this.codesPressed.delete(code);
  }

  // Call at END of every frame.
  endFrame() {
    this.pressed.clear();
    this.released.clear();
    this.codesPressed.clear();
  }
}
