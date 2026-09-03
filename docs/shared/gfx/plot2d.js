// Canvas 2D helpers shared by every panel: DPR-aware sizing, a plot-space view, axes, grid,
// polylines, points, and the small helpers of the later panels (band, vector field,
// transformed grid and shape, heatmap, small-multiple layout). Colors come from CSS custom
// properties so canvases and the stylesheet
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

// ---- small helpers for the later panels ----

/**
 * A filled band between yLo[i] and yHi[i] over xs (panel 4's ε-tube). A non-finite sample
 * in any of the three splits the band into separate pieces.
 */
export function drawBand(ctx, view, xs, yLo, yHi, { fill, alpha = 0.18, stroke = null, width = 1 } = {}) {
  ctx.save();
  ctx.fillStyle = fill ?? cssVar('--exact');
  ctx.globalAlpha = alpha;
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width * view.dpr; }
  const ok = i => Number.isFinite(xs[i]) && Number.isFinite(yLo[i]) && Number.isFinite(yHi[i]);
  let i = 0;
  while (i < xs.length) {
    while (i < xs.length && !ok(i)) i++;
    const start = i;
    while (i < xs.length && ok(i)) i++;
    if (i - start < 2) continue;
    ctx.beginPath();
    for (let j = start; j < i; j++) ctx.lineTo(view.X(xs[j]), view.Y(yHi[j]));
    for (let j = i - 1; j >= start; j--) ctx.lineTo(view.X(xs[j]), view.Y(yLo[j]));
    ctx.closePath();
    ctx.fill();
    if (stroke) ctx.stroke();
  }
  ctx.restore();
}

/**
 * A vector field f(x, y) → [dx, dy] drawn as small arrows on a lattice `spacing` CSS px
 * apart, aligned to the plot origin (4-right's flow). `scale` multiplies the vector in
 * plot units before it is drawn; `maxLength` (CSS px, default 0.85 · spacing) caps every
 * arrow so a strong flow stays legible; `normalize: true` draws every arrow at maxLength.
 */
export function drawVectorField(ctx, view, f, { spacing = 36, scale = 1, maxLength, normalize = false, color, width = 1, head = 4, alpha = 0.8 } = {}) {
  const { w, h, dpr } = view;
  const sp = spacing * dpr;
  const cap = (maxLength ?? spacing * 0.85) * dpr;
  const dx = sp / view.sx, dy = sp / view.sy;
  ctx.save();
  ctx.strokeStyle = ctx.fillStyle = color ?? cssVar('--tick');
  ctx.lineWidth = width * dpr;
  ctx.globalAlpha = alpha;
  const hd = head * dpr;
  ctx.beginPath();
  for (let x = Math.ceil(view.xMin / dx) * dx; x <= view.xMax; x += dx) {
    for (let y = Math.ceil(view.yMin / dy) * dy; y <= view.yMax; y += dy) {
      const v = f(x, y);
      if (!v) continue;
      let X = v[0] * scale * view.sx, Y = -v[1] * scale * view.sy;   // pixel offsets
      const len = Math.hypot(X, Y);
      if (!Number.isFinite(len) || len === 0) continue;
      const L = normalize ? cap : Math.min(len, cap);
      X *= L / len; Y *= L / len;
      const X0 = view.X(x), Y0 = view.Y(y), X1 = X0 + X, Y1 = Y0 + Y;
      if (X1 < -sp || X1 > w + sp || Y1 < -sp || Y1 > h + sp) continue;
      const a = Math.atan2(Y, X);
      ctx.moveTo(X0, Y0); ctx.lineTo(X1, Y1);
      ctx.moveTo(X1, Y1);
      ctx.lineTo(X1 - hd * Math.cos(a - 0.5), Y1 - hd * Math.sin(a - 0.5));
      ctx.moveTo(X1, Y1);
      ctx.lineTo(X1 - hd * Math.cos(a + 0.5), Y1 - hd * Math.sin(a + 0.5));
    }
  }
  ctx.stroke();
  ctx.restore();
}

/**
 * The lattice of lines x = i·spacing and y = j·spacing, each mapped through the 2×2 matrix
 * M (panels 6, 6-left). Linear maps keep lines straight, so only the endpoints are mapped.
 * `extent` is the half-range of the source lattice in plot units (default: twice the
 * view's largest bound, which covers the view unless M contracts by more than half). The
 * images of the two axes are drawn in --axis when `axes` is true.
 */
export function drawTransformedGrid(ctx, view, M, { spacing = 1, extent, color, width = 1, alpha = 1, axes = true } = {}) {
  const ext = extent ?? 2 * Math.max(Math.abs(view.xMin), Math.abs(view.xMax), Math.abs(view.yMin), Math.abs(view.yMax));
  const map = ([x, y]) => [M[0][0] * x + M[0][1] * y, M[1][0] * x + M[1][1] * y];
  const line = (p, q) => {
    const [x0, y0] = map(p), [x1, y1] = map(q);
    ctx.moveTo(view.X(x0), view.Y(y0)); ctx.lineTo(view.X(x1), view.Y(y1));
  };
  ctx.save();
  ctx.lineWidth = width * view.dpr;
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color ?? cssVar('--grid');
  ctx.beginPath();
  for (let i = Math.ceil(-ext / spacing) * spacing; i <= ext; i += spacing) {
    if (axes && Math.abs(i) < 1e-9) continue;
    line([i, -ext], [i, ext]);
    line([-ext, i], [ext, i]);
  }
  ctx.stroke();
  if (axes) {
    ctx.strokeStyle = cssVar('--axis');
    ctx.beginPath();
    line([0, -ext], [0, ext]);
    line([-ext, 0], [ext, 0]);
    ctx.stroke();
  }
  ctx.restore();
}

/** A polygon of [x, y] plot points mapped through M (null for the identity), filled and/or stroked. */
export function drawShape(ctx, view, points, M = null, { fill, stroke, width = 2, alpha = 1, close = true } = {}) {
  if (points.length === 0) return;
  const map = ([x, y]) => (M ? [M[0][0] * x + M[0][1] * y, M[1][0] * x + M[1][1] * y] : [x, y]);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  points.forEach((p, i) => {
    const [x, y] = map(p);
    if (i === 0) ctx.moveTo(view.X(x), view.Y(y)); else ctx.lineTo(view.X(x), view.Y(y));
  });
  if (close) ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke !== null) { ctx.strokeStyle = stroke ?? cssVar('--fg'); ctx.lineWidth = width * view.dpr; ctx.stroke(); }
  ctx.restore();
}

/**
 * A heatmap of f(x, y) over the whole view on a coarse nx × ny lattice (12-right-3's ρ
 * over (hω, ζ), 11-right). f is sampled at cell centers; colormap(value) returns a CSS
 * color, or null to leave the cell unpainted (see gfx/color.js's rhoColormap). Cells are
 * laid out in pixel space, so a log axis works, and each is padded by a pixel so there are
 * no seams. Returns { nx, ny, min, max } of the finite samples.
 */
export function drawHeatmap(ctx, view, f, { nx = 48, ny = 48, colormap, alpha = 1 } = {}) {
  const { w, h } = view;
  const cw = w / nx, ch = h / ny;
  let min = Infinity, max = -Infinity;
  ctx.save();
  ctx.globalAlpha = alpha;
  for (let j = 0; j < ny; j++) {
    const py = (j + 0.5) * ch;
    for (let i = 0; i < nx; i++) {
      const px = (i + 0.5) * cw;
      const v = f(view.x(px), view.y(py));
      if (Number.isFinite(v)) { if (v < min) min = v; if (v > max) max = v; }
      const color = colormap ? colormap(v) : null;
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(Math.floor(i * cw), Math.floor(j * ch), Math.ceil(cw) + 1, Math.ceil(ch) + 1);
    }
  }
  ctx.restore();
  return { nx, ny, min, max };
}

/**
 * Cell rectangles for small multiples (11-right's grid of λ, panel 12's three regions):
 *   layoutGrid(w, h, rows, cols, gap) → [{ x, y, w, h, row, col }], row-major
 * in the units of w and h (device pixels when laying out a canvas, so gap is device px
 * too: pass gap * dpr). To draw into one cell:
 *   ctx.save(); ctx.translate(cell.x, cell.y);
 *   ctx.beginPath(); ctx.rect(0, 0, cell.w, cell.h); ctx.clip();
 *   const v = makeView({ w: cell.w, h: cell.h, dpr, … });   // then drawGrid(ctx, v), …
 *   ctx.restore();
 */
export function layoutGrid(w, h, rows, cols, gap = 0) {
  const cw = (w - gap * (cols - 1)) / cols, ch = (h - gap * (rows - 1)) / rows;
  const cells = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      cells.push({ x: c * (cw + gap), y: r * (ch + gap), w: cw, h: ch, row: r, col: c });
    }
  }
  return cells;
}
