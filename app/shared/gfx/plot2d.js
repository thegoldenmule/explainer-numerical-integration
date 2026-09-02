// Canvas 2D helpers shared by every panel: DPR-aware sizing, a plot-space view, axes, grid,
// polylines, points. Colors come from CSS custom properties so canvases and the stylesheet
// cannot drift apart.

export const MAX_DPR = 2;

const styleCache = new Map();
/** Read a CSS custom property from :root, e.g. cssVar('--exact'). */
export function cssVar(name) {
  if (!styleCache.has(name)) styleCache.set(name, getComputedStyle(document.documentElement).getPropertyValue(name).trim());
  return styleCache.get(name);
}
/** Same, parsed to [r, g, b] in 0..1 for WebGL uniforms. Accepts #rgb, #rrggbb, rgb(a)(). */
export function cssRgb(name) {
  const v = cssVar(name);
  let m;
  if ((m = /^#([0-9a-f]{3})$/i.exec(v))) return [...m[1]].map(ch => parseInt(ch + ch, 16) / 255);
  if ((m = /^#([0-9a-f]{6})/i.exec(v))) return [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16) / 255);
  if ((m = /^rgba?\(([^)]+)\)/.exec(v))) return m[1].split(/[\s,/]+/).slice(0, 3).map(n => Number(n) / 255);
  throw new Error(`cssRgb: cannot parse ${name} = "${v}"`);
}

/** Size the canvas backing store to its CSS box. Returns { w, h, dpr } in device pixels. */
export function fitCanvas(canvas, maxDpr = MAX_DPR) {
  const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
  const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
  const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  return { w, h, dpr };
}

/** ResizeObserver wrapper. Returns a disconnect function. */
export function observeResize(target, cb) {
  const ro = new ResizeObserver(() => cb());
  ro.observe(target);
  return () => ro.disconnect();
}

/**
 * A view maps plot coordinates to device pixels.
 *   makeView({ w, h, dpr, xMin, xMax, yMin, yMax })
 *   view.X(x), view.Y(y)   plot → pixel;   view.x(px), view.y(py)   pixel → plot
 * Convenience: pass { cx, cy, halfW, halfH } instead of min/max.
 * `yLog: true` maps y through log10 (yMin, yMax > 0, in linear units); y ≤ 0 maps to NaN,
 * which drawPolyline skips.
 */
export function makeView({ w, h, dpr = 1, xMin, xMax, yMin, yMax, cx = 0, cy = 0, halfW, halfH, yLog = false }) {
  if (xMin == null) { xMin = cx - halfW; xMax = cx + halfW; }
  if (yMin == null) { yMin = cy - (halfH ?? halfW * h / w); yMax = cy + (halfH ?? halfW * h / w); }
  const sx = w / (xMax - xMin);
  const lyMin = yLog ? Math.log10(yMin) : yMin, lyMax = yLog ? Math.log10(yMax) : yMax;
  const sy = h / (lyMax - lyMin);
  const fy = yLog ? Math.log10 : (y => y), gy = yLog ? (l => 10 ** l) : (l => l);
  return {
    w, h, dpr, xMin, xMax, yMin, yMax, sx, sy, yLog,
    X: x => (x - xMin) * sx,
    Y: y => h - (fy(y) - lyMin) * sy,
    x: px => xMin + px / sx,
    y: py => gy(lyMin + (h - py) / sy),
    /** pointer event → plot coords */
    fromEvent(ev, canvas) {
      const r = canvas.getBoundingClientRect();
      return { x: this.x((ev.clientX - r.left) * dpr), y: this.y((ev.clientY - r.top) * dpr) };
    },
  };
}

/** A round tick spacing giving about `target` ticks across `range`. */
export function niceStep(range, target = 5) {
  const raw = range / target;
  const p = 10 ** Math.floor(Math.log10(raw));
  const n = raw / p;
  return (n < 1.5 ? 1 : n < 3.5 ? 2 : n < 7.5 ? 5 : 10) * p;
}
export function fmtTick(v) {
  if (Math.abs(v) < 1e-12) return '0';
  const a = Math.abs(v);
  const s = a >= 1e5 || a < 1e-3 ? v.toExponential(0).replace('e+', 'e') : a >= 100 ? v.toFixed(0) : a >= 1 ? String(+v.toFixed(2)) : String(+v.toPrecision(2));
  return s.replace(/-/g, '−');
}

/** Grid lines, axes through the origin (if visible), tick labels. */
export function drawGrid(ctx, view, { labels = true, xLabel, yLabel, ticks = 5 } = {}) {
  const { w, h, dpr } = view;
  ctx.save();
  ctx.lineWidth = dpr;
  ctx.font = `${11 * dpr}px ${cssVar('--font') || 'system-ui'}`;
  ctx.strokeStyle = cssVar('--grid');
  ctx.fillStyle = cssVar('--tick');
  const xs = niceStep(view.xMax - view.xMin, ticks), ys = niceStep(view.yMax - view.yMin, ticks);
  const X0 = view.X(0), Y0 = view.yLog ? h : view.Y(0);
  const labelY = Math.min(Math.max(Y0, 14 * dpr), h - 4 * dpr);
  const labelX = Math.min(Math.max(X0, 4 * dpr), w - 30 * dpr);
  ctx.beginPath();
  for (let v = Math.ceil(view.xMin / xs) * xs; v <= view.xMax + 1e-9; v += xs) {
    if (Math.abs(v) < 1e-9) continue;
    const X = view.X(v);
    ctx.moveTo(X, 0); ctx.lineTo(X, h);
    if (labels) ctx.fillText(fmtTick(v), X + 3 * dpr, labelY - 4 * dpr);
  }
  if (view.yLog) {
    // one line per decade, labels on each
    for (let e = Math.ceil(Math.log10(view.yMin) - 1e-9); e <= Math.log10(view.yMax) + 1e-9; e++) {
      const Y = view.Y(10 ** e);
      ctx.moveTo(0, Y); ctx.lineTo(w, Y);
      if (labels) ctx.fillText(fmtTick(10 ** e), labelX + 4 * dpr, Y - 3 * dpr);
    }
  } else {
    for (let v = Math.ceil(view.yMin / ys) * ys; v <= view.yMax + 1e-9; v += ys) {
      if (Math.abs(v) < 1e-9) continue;
      const Y = view.Y(v);
      ctx.moveTo(0, Y); ctx.lineTo(w, Y);
      if (labels) ctx.fillText(fmtTick(v), labelX + 4 * dpr, Y - 3 * dpr);
    }
  }
  ctx.stroke();
  ctx.strokeStyle = cssVar('--axis');
  ctx.beginPath();
  if (!view.yLog && Y0 >= 0 && Y0 <= h) { ctx.moveTo(0, Y0); ctx.lineTo(w, Y0); }
  if (X0 >= 0 && X0 <= w) { ctx.moveTo(X0, 0); ctx.lineTo(X0, h); }
  ctx.stroke();
  if (labels) {
    ctx.fillStyle = cssVar('--axis');
    if (xLabel) ctx.fillText(xLabel, w - ctx.measureText(xLabel).width - 6 * dpr, labelY - 6 * dpr);
    if (yLabel) ctx.fillText(yLabel, labelX + 6 * dpr, 14 * dpr);
  }
  ctx.restore();
}

/** Polyline through (xs[i], ys[i]). Skips non-finite samples. */
export function drawPolyline(ctx, view, xs, ys, { color, width = 1.5, dash = null, alpha = 1 } = {}) {
  ctx.save();
  ctx.strokeStyle = color ?? cssVar('--fg');
  ctx.lineWidth = width * view.dpr;
  ctx.globalAlpha = alpha;
  ctx.lineJoin = 'round';
  if (dash) ctx.setLineDash(dash.map(d => d * view.dpr));
  ctx.beginPath();
  let pen = false;
  for (let i = 0; i < xs.length; i++) {
    const X = view.X(xs[i]), Y = view.Y(ys[i]);
    if (!Number.isFinite(X) || !Number.isFinite(Y) || Math.abs(Y) > 1e6) { pen = false; continue; }
    if (pen) ctx.lineTo(X, Y); else { ctx.moveTo(X, Y); pen = true; }
  }
  ctx.stroke();
  ctx.restore();
}

export function drawPoint(ctx, view, x, y, { r = 5, fill, stroke = '#fff', width = 2 } = {}) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(view.X(x), view.Y(y), r * view.dpr, 0, Math.PI * 2);
  ctx.fillStyle = fill ?? cssVar('--fg');
  ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width * view.dpr; ctx.stroke(); }
  ctx.restore();
}

export function drawArrow(ctx, view, x0, y0, x1, y1, { color, width = 2, head = 8 } = {}) {
  const X0 = view.X(x0), Y0 = view.Y(y0), X1 = view.X(x1), Y1 = view.Y(y1);
  const a = Math.atan2(Y1 - Y0, X1 - X0), hd = head * view.dpr;
  ctx.save();
  ctx.strokeStyle = ctx.fillStyle = color ?? cssVar('--fg');
  ctx.lineWidth = width * view.dpr;
  ctx.beginPath(); ctx.moveTo(X0, Y0); ctx.lineTo(X1, Y1); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(X1, Y1);
  ctx.lineTo(X1 - hd * Math.cos(a - 0.4), Y1 - hd * Math.sin(a - 0.4));
  ctx.lineTo(X1 - hd * Math.cos(a + 0.4), Y1 - hd * Math.sin(a + 0.4));
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

export function drawText(ctx, view, text, x, y, { color, size = 12, align = 'left', dx = 0, dy = 0 } = {}) {
  ctx.save();
  ctx.fillStyle = color ?? cssVar('--fg');
  ctx.font = `${size * view.dpr}px ${cssVar('--font') || 'system-ui'}`;
  ctx.textAlign = align;
  ctx.fillText(text, view.X(x) + dx * view.dpr, view.Y(y) + dy * view.dpr);
  ctx.restore();
}
