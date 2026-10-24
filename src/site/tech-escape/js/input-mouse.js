/**
 * Pointer look only.
 *
 * Movement, pickup, throw, eat, and the flashlight are keyboard actions
 * (WASD or arrows, E, R, F). Mouse buttons used to walk, throw, and eat at
 * the same time, so a click while steering with the keyboard did both.
 * Buttons are swallowed so a right-click cannot open a menu under pointer
 * lock. They do not move the player and they do not use an item.
 */

export const mousePlay = {
  init(canvas) {
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 1 || e.button === 2) e.preventDefault();
    }, true);
    canvas.addEventListener('wheel', (e) => e.preventDefault(), { passive: false });
  },

  releaseAll() {},
  tick() {},
  absorbLookDelta(dx) { return dx; },
  augmentMoveAxes(axes) { return { x: axes.x, y: axes.y, sprint: false }; },
  consumeEdges() {
    return { primary: false, eat: false, light: false, crouch: false, wheel: 0 };
  },
  clearEdges() {},
};
