const DEFAULT_LONG_PRESS_MS = 450;
const DEFAULT_MOVE_TOLERANCE = 12;

/**
 * Fire `onLongPress` after a stationary primary-pointer hold.
 * Mouse right-click is left to contextmenu; this is for touch / pen.
 */
export function bindLongPress(el, onLongPress, {
  ms = DEFAULT_LONG_PRESS_MS,
  moveTolerance = DEFAULT_MOVE_TOLERANCE,
  pointerTypes = ["touch", "pen"],
} = {}) {
  if (!el || typeof onLongPress !== "function") return () => {};

  let timer = 0;
  let pointerId = null;
  let startX = 0;
  let startY = 0;

  const cancel = () => {
    if (timer) {
      window.clearTimeout(timer);
      timer = 0;
    }
    pointerId = null;
  };

  const onDown = (event) => {
    if (event.isPrimary === false) return;
    if (event.button != null && event.button !== 0) return;
    if (pointerTypes.length && !pointerTypes.includes(event.pointerType)) return;
    cancel();
    pointerId = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;
    timer = window.setTimeout(() => {
      timer = 0;
      pointerId = null;
      onLongPress(event);
    }, ms);
  };

  const onMove = (event) => {
    if (pointerId == null || event.pointerId !== pointerId) return;
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    if (Math.hypot(dx, dy) > moveTolerance) cancel();
  };

  const onUp = (event) => {
    if (pointerId == null || event.pointerId !== pointerId) return;
    cancel();
  };

  el.addEventListener("pointerdown", onDown);
  el.addEventListener("pointermove", onMove);
  el.addEventListener("pointerup", onUp);
  el.addEventListener("pointercancel", onUp);
  el.addEventListener("lostpointercapture", onUp);

  return () => {
    cancel();
    el.removeEventListener("pointerdown", onDown);
    el.removeEventListener("pointermove", onMove);
    el.removeEventListener("pointerup", onUp);
    el.removeEventListener("pointercancel", onUp);
    el.removeEventListener("lostpointercapture", onUp);
  };
}

/** Long-press plus right-click → inspect. Suppresses the click that follows a hold. */
export function bindInspectGesture(el, onInspect, options = {}) {
  if (!el || typeof onInspect !== "function") return () => {};

  const markSuppress = () => {
    el.dataset.inspectSuppressClick = "1";
  };

  const unbindLongPress = bindLongPress(el, (event) => {
    markSuppress();
    onInspect(event);
  }, options);

  const onContext = (event) => {
    event.preventDefault();
    event.stopPropagation();
    onInspect(event);
  };

  const onClick = (event) => {
    if (el.dataset.inspectSuppressClick !== "1") return;
    delete el.dataset.inspectSuppressClick;
    event.preventDefault();
    event.stopPropagation();
  };

  el.addEventListener("contextmenu", onContext);
  el.addEventListener("click", onClick, true);

  return () => {
    unbindLongPress();
    el.removeEventListener("contextmenu", onContext);
    el.removeEventListener("click", onClick, true);
  };
}
