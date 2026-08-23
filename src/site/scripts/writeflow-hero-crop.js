/**
 * WriteFlow — hero image crop & shape picker (banner, square, circle).
 */
(() => {
  "use strict";

  const SHAPES = ["banner", "square", "circle"];
  const VIEW_W = 320;
  const VIEW_H = 240;

  function cropFrame(shape) {
    if (shape === "banner") {
      const w = Math.min(280, VIEW_W - 24);
      const h = Math.round(w / 2.5);
      return { w, h, left: (VIEW_W - w) / 2, top: (VIEW_H - h) / 2 };
    }
    const size = Math.min(200, VIEW_W - 40, VIEW_H - 40);
    return { w: size, h: size, left: (VIEW_W - size) / 2, top: (VIEW_H - size) / 2 };
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Could not load image."));
      img.src = src;
    });
  }

  function exportCrop(img, shape, panX, panY, zoom) {
    const frame = cropFrame(shape);
    const scale = Math.max(frame.w / img.naturalWidth, frame.h / img.naturalHeight) * zoom;
    const iw = img.naturalWidth * scale;
    const ih = img.naturalHeight * scale;
    const ix = (VIEW_W - iw) / 2 + panX;
    const iy = (VIEW_H - ih) / 2 + panY;
    let sx = (frame.left - ix) / scale;
    let sy = (frame.top - iy) / scale;
    let sw = frame.w / scale;
    let sh = frame.h / scale;
    sx = Math.max(0, Math.min(img.naturalWidth - 1, sx));
    sy = Math.max(0, Math.min(img.naturalHeight - 1, sy));
    sw = Math.max(1, Math.min(img.naturalWidth - sx, sw));
    sh = Math.max(1, Math.min(img.naturalHeight - sy, sh));
    const outW = shape === "banner" ? 800 : 480;
    const outH = shape === "banner" ? 320 : 480;
    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);
    return canvas.toDataURL("image/jpeg", 0.88);
  }

  function panToFocus(panX, panY, zoom) {
    const clamp = (n) => Math.max(0, Math.min(100, n));
    return {
      x: clamp(50 - panX * 0.12),
      y: clamp(50 - panY * 0.12),
    };
  }

  function focusToPan(focus) {
    return {
      panX: (50 - (focus?.x ?? 50)) / 0.12,
      panY: (50 - (focus?.y ?? 50)) / 0.12,
      zoom: 1,
    };
  }

  function drawCropCanvas(ctx, img, shape, panX, panY, zoom) {
    const frame = cropFrame(shape);
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = "#0b1220";
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    const scale = Math.max(frame.w / img.naturalWidth, frame.h / img.naturalHeight) * zoom;
    const iw = img.naturalWidth * scale;
    const ih = img.naturalHeight * scale;
    const ix = (VIEW_W - iw) / 2 + panX;
    const iy = (VIEW_H - ih) / 2 + panY;
    ctx.drawImage(img, ix, iy, iw, ih);

    ctx.fillStyle = "rgba(4, 8, 16, 0.72)";
    ctx.fillRect(0, 0, VIEW_W, frame.top);
    ctx.fillRect(0, frame.top, frame.left, frame.h);
    ctx.fillRect(frame.left + frame.w, frame.top, VIEW_W - frame.left - frame.w, frame.h);
    ctx.fillRect(0, frame.top + frame.h, VIEW_W, VIEW_H - frame.top - frame.h);

    ctx.strokeStyle = "rgba(56, 189, 248, 0.95)";
    ctx.lineWidth = 2;
    if (shape === "circle") {
      ctx.beginPath();
      ctx.arc(frame.left + frame.w / 2, frame.top + frame.h / 2, frame.w / 2, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.strokeRect(frame.left + 0.5, frame.top + 0.5, frame.w - 1, frame.h - 1);
    }
  }

  /**
   * @param {{ src: string, shape?: string, focus?: {x:number,y:number}, allowBake?: boolean }} options
   * @returns {Promise<{ shape: string, dataUrl?: string, focus?: {x:number,y:number} } | null>}
   */
  async function open(options = {}) {
    const modal = document.getElementById("wfHeroCropModal");
    const canvas = document.getElementById("wfHeroCropCanvas");
    const zoomInput = document.getElementById("wfHeroCropZoom");
    const shapeInputs = () => [...document.querySelectorAll('input[name="wfHeroCropShape"]')];
    const applyBtn = document.getElementById("wfHeroCropApply");
    const cancelBtn = document.getElementById("wfHeroCropCancel");
    const backdrop = document.getElementById("wfHeroCropBackdrop");
    const hintEl = document.getElementById("wfHeroCropHint");

    if (!modal || !canvas || !options.src) return null;

    let img;
    let canBake = options.allowBake !== false;
    try {
      img = await loadImage(options.src);
    } catch {
      canBake = false;
      try {
        img = await new Promise((resolve, reject) => {
          const fallback = new Image();
          fallback.onload = () => resolve(fallback);
          fallback.onerror = () => reject(new Error("Could not load image."));
          fallback.src = options.src;
        });
      } catch (err) {
        throw err;
      }
    }

    const ctx = canvas.getContext("2d");
    canvas.width = VIEW_W;
    canvas.height = VIEW_H;

    let shape = SHAPES.includes(options.shape) ? options.shape : "banner";
    const start = focusToPan(options.focus);
    let panX = start.panX;
    let panY = start.panY;
    let zoom = start.zoom || 1;
    let dragging = false;
    let dragStart = { x: 0, y: 0, panX: 0, panY: 0 };

    function selectedShape() {
      const checked = shapeInputs().find((el) => el.checked);
      return checked?.value || shape;
    }

    function syncShapeInputs() {
      shapeInputs().forEach((el) => { el.checked = el.value === shape; });
    }

    function redraw() {
      shape = selectedShape();
      drawCropCanvas(ctx, img, shape, panX, panY, zoom);
      if (hintEl) {
        hintEl.textContent = canBake
          ? "Drag to reposition. Circle and square export as a square crop."
          : "Drag to reposition. URL images save focus only (no crop) — use upload for full crop control.";
      }
    }

    zoomInput.value = String(zoom);
    syncShapeInputs();
    redraw();
    modal.classList.remove("dw-hidden");

    return new Promise((resolve) => {
      function cleanup(result) {
        modal.classList.add("dw-hidden");
        canvas.removeEventListener("pointerdown", onPointerDown);
        canvas.removeEventListener("pointermove", onPointerMove);
        canvas.removeEventListener("pointerup", onPointerUp);
        canvas.removeEventListener("pointerleave", onPointerUp);
        zoomInput.removeEventListener("input", onZoom);
        shapeInputs().forEach((el) => el.removeEventListener("change", redraw));
        applyBtn?.removeEventListener("click", onApply);
        cancelBtn?.removeEventListener("click", onCancel);
        backdrop?.removeEventListener("click", onCancel);
        document.removeEventListener("keydown", onKey);
        resolve(result);
      }

      function onPointerDown(e) {
        dragging = true;
        dragStart = { x: e.clientX, y: e.clientY, panX, panY };
        canvas.setPointerCapture(e.pointerId);
      }
      function onPointerMove(e) {
        if (!dragging) return;
        panX = dragStart.panX + (e.clientX - dragStart.x);
        panY = dragStart.panY + (e.clientY - dragStart.y);
        redraw();
      }
      function onPointerUp(e) {
        dragging = false;
        try { canvas.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
      }
      function onZoom() {
        zoom = Math.max(1, Math.min(3, Number(zoomInput.value) || 1));
        redraw();
      }
      function onApply() {
        shape = selectedShape();
        const focus = panToFocus(panX, panY, zoom);
        if (canBake && !String(options.src).includes("image/gif")) {
          try {
            const dataUrl = exportCrop(img, shape, panX, panY, zoom);
            cleanup({ shape, dataUrl, focus });
            return;
          } catch {
            /* fall through to focus-only */
          }
        }
        cleanup({ shape, focus });
      }
      function onCancel() { cleanup(null); }
      function onKey(e) {
        if (e.key === "Escape") onCancel();
      }

      canvas.addEventListener("pointerdown", onPointerDown);
      canvas.addEventListener("pointermove", onPointerMove);
      canvas.addEventListener("pointerup", onPointerUp);
      canvas.addEventListener("pointerleave", onPointerUp);
      zoomInput.addEventListener("input", onZoom);
      shapeInputs().forEach((el) => el.addEventListener("change", redraw));
      applyBtn?.addEventListener("click", onApply);
      cancelBtn?.addEventListener("click", onCancel);
      backdrop?.addEventListener("click", onCancel);
      document.addEventListener("keydown", onKey);
    });
  }

  window.WriteFlowHeroCrop = { open, SHAPES, cropFrame };
})();
