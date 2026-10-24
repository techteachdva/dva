/**
 * The pause card's oscilloscope. A phosphor sun climbs a horizon line while
 * the card itself rises. The lab renderer is untouched. This canvas is only
 * the face of the pause shell for a moment.
 */

export function startPauseScope(canvas, opts = {}) {
  if (!canvas) return () => {};
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return () => {};

  let raf = 0;
  let stopped = false;
  const t0 = performance.now();
  const reduceFlashing = !!opts.reduceFlashing;
  const onResize = () => {};
  window.addEventListener('resize', onResize);

  const frame = (now) => {
    if (stopped) return;
    const rect = canvas.getBoundingClientRect();
    const cssW = Math.max(2, rect.width);
    const cssH = Math.max(2, rect.height);
    const dpr = Math.min(window.devicePixelRatio || 1, /CrOS/i.test(navigator.userAgent || '') ? 1 : 1.5);
    const bw = Math.floor(cssW * dpr);
    const bh = Math.floor(cssH * dpr);
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw;
      canvas.height = bh;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawScope(ctx, cssW, cssH, (now - t0) / 1000, reduceFlashing);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  return () => {
    stopped = true;
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', onResize);
  };
}

function drawScope(ctx, w, h, t, reduceFlashing) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#02140c';
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.strokeStyle = 'rgba(120, 220, 150, 0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i <= 8; i++) {
    const x = (w * i) / 8;
    ctx.moveTo(x, 8);
    ctx.lineTo(x, h - 8);
  }
  for (let i = 0; i <= 6; i++) {
    const y = (h * i) / 6;
    ctx.moveTo(8, y);
    ctx.lineTo(w - 8, y);
  }
  ctx.stroke();
  ctx.restore();

  const horizon = h * 0.64;
  const rise = Math.min(1, t / 2.4);
  const ease = 1 - (1 - rise) * (1 - rise) * (1 - rise);
  const radius = 8 + ease * Math.min(w * 0.18, h * 0.28);

  ctx.fillStyle = 'rgba(80, 255, 150, 0.16)';
  ctx.beginPath();
  ctx.arc(w / 2, horizon, radius * 1.85, Math.PI, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#c8ffd8';
  ctx.beginPath();
  ctx.arc(w / 2, horizon, radius, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f4fff8';
  ctx.beginPath();
  ctx.arc(w / 2, horizon, radius * 0.45, Math.PI, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(180, 255, 200, 0.7)';
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.moveTo(18, horizon);
  ctx.lineTo(w - 18, horizon);
  ctx.stroke();

  ctx.beginPath();
  const amp = 8 + 5 * Math.sin(t * 0.9);
  for (let x = 0; x <= w; x += 3) {
    const u = x / w;
    const env = Math.sin(u * Math.PI);
    const y = horizon
      - Math.sin(u * 14 + t * 2.4) * amp * env
      - Math.sin(u * 5 - t * 1.1) * 4 * env;
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = 'rgba(70, 255, 140, 0.35)';
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.strokeStyle = '#f3fff6';
  ctx.lineWidth = 1.7;
  ctx.stroke();

  ctx.font = '13px ui-monospace, Consolas, monospace';
  ctx.fillStyle = 'rgba(190, 255, 210, 0.8)';
  ctx.textAlign = 'left';
  ctx.fillText('CH1', 16, 28);
  ctx.fillText('0.5 V', 16, h - 16);

  if (!reduceFlashing && t > 2.7 && t < 3.3) {
    const f = (t - 2.7) / 0.6;
    if (f < 0.14 || (f > 0.34 && f < 0.46)) {
      ctx.fillStyle = 'rgba(230, 255, 236, 0.28)';
      ctx.fillRect(0, 0, w, h);
    } else if (f > 0.18 && f < 0.26) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.fillRect(0, 0, w, h);
    }
  }
}
