// Fixed-delta game loop with a max step to avoid spiral-of-death.
export class Loop {
  constructor(update, render) {
    this.update = update;
    this.render = render;
    this.last = 0;
    this.running = false;
    this.rafId = 0;
    /** Throttle when the same error throws every frame (avoids console/CPU churn). */
    this._catchLog = /** @type {{ lastKey: string, lastAt: number }} */ ({ lastKey: "", lastAt: 0 });
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const tick = (now) => {
      if (!this.running) return;
      let dt = (now - this.last) / 1000;
      this.last = now;
      if (dt > 0.1) dt = 0.1; // clamp huge pauses (tab switch)
      try {
        this.update(dt);
        this.render(dt);
      } catch (e) {
        // RAF is scheduled below; without scheduling after a throw rAF chaining stops mid-scene.
        const key = String(e?.message ?? e);
        const t = typeof performance !== "undefined" ? performance.now() : Date.now();
        if (
          key !== this._catchLog.lastKey
          || t - this._catchLog.lastAt > 1250
        ) {
          this._catchLog.lastKey = key;
          this._catchLog.lastAt = t;
          console.error("[worm-escape loop]", e);
        }
      }
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }
}
