// A time-series plot of one run: the exact curve dashed underneath (--exact), the
// integrator's polyline on top (--approx), optional step markers and tangent segments
// (10-left's follow-the-tangent), auto-ranged or pinned y, linear or log y.
//
//   const view = drawTrajectory(ctx, size, series, opts);
//   series: { t, x, v?, exact?, n? }   arrays (typed or plain); n = how many entries are valid
//   opts:   { tMin, tMax, y: 'auto' | [lo, hi], yLog, cap, markers, tangents, h, grid, xLabel,
//             yLabel, exact, approx, width }
//
// Non-finite samples (Euler at 1e8 and beyond) are skipped, never propagated into the range.

import { cssVar, makeView, drawGrid, drawPolyline } from './plot2d.js';

const count = s => s.n ?? s.t.length;

/** Index range [i0, i1) of samples with tMin ≤ t ≤ tMax (t is monotone). */
export function windowIndices(series, tMin, tMax) {
  const n = count(series), t = series.t;
  let i0 = 0, i1 = n;
  while (i0 < n && t[i0] < tMin) i0++;
  while (i1 > i0 && t[i1 - 1] > tMax) i1--;
  return [i0, i1];
}

/**
 * [lo, hi] covering the finite samples of x and exact in the window, padded. `cap` bounds the
 * integrator's contribution so a blow-up cannot flatten the exact curve to a line; the
 * polyline simply leaves the frame. On a log axis only positive values count.
 */
export function autoRange(series, [i0, i1], { yLog = false, cap = Infinity, pad = 0.08 } = {}) {
  let lo = Infinity, hi = -Infinity;
  const take = v => { if (Number.isFinite(v) && (!yLog || v > 0)) { if (v < lo) lo = v; if (v > hi) hi = v; } };
  for (let i = i0; i < i1; i++) {
    if (series.exact) take(series.exact[i]);
    const v = series.x[i];
    take(Math.abs(v) > cap ? Math.sign(v) * cap : v);
  }
  if (!Number.isFinite(lo)) return yLog ? [1e-3, 1] : [-1, 1];
  if (yLog) {
    const a = Math.log10(lo), b = Math.log10(hi), span = Math.max(b - a, 1);
    return [10 ** (a - pad * span), 10 ** (b + pad * span)];
  }
  if (lo === hi) { lo -= 1; hi += 1; }
  const span = hi - lo;
  return [lo - pad * span, hi + pad * span];
}

export function drawTrajectory(ctx, { w, h, dpr }, series, {
  tMin, tMax, y = 'auto', yLog = false, cap = Infinity, markers = false, tangents = false, h: step,
  grid = true, xLabel = 't', yLabel = 'x', exact, approx, width = 1.75, maxMarkers = 600,
} = {}) {
  const n = count(series);
  if (tMin == null) tMin = n ? series.t[0] : 0;
  if (tMax == null) tMax = n ? Math.max(series.t[n - 1], tMin + 1e-3) : 1;
  const [i0, i1] = windowIndices(series, tMin, tMax);
  const [yMin, yMax] = y === 'auto' ? autoRange(series, [i0, i1], { yLog, cap }) : y;
  const view = makeView({ w, h, dpr, xMin: tMin, xMax: tMax, yMin, yMax, yLog });

  ctx.clearRect(0, 0, w, h);
  if (grid) drawGrid(ctx, view, { xLabel, yLabel });

  const exactColor = exact ?? cssVar('--exact'), approxColor = approx ?? cssVar('--approx');
  const ts = series.t.subarray ? series.t.subarray(i0, i1) : series.t.slice(i0, i1);
  if (series.exact) {
    const ex = series.exact.subarray ? series.exact.subarray(i0, i1) : series.exact.slice(i0, i1);
    drawPolyline(ctx, view, ts, ex, { color: exactColor, width, dash: [6, 4] });
  }
  const xs = series.x.subarray ? series.x.subarray(i0, i1) : series.x.slice(i0, i1);

  if (tangents && series.v) {
    ctx.save();
    ctx.strokeStyle = approxColor;
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = dpr;
    ctx.beginPath();
    for (let i = i0; i < i1; i++) {
      const hh = step ?? (i + 1 < n ? series.t[i + 1] - series.t[i] : 0);
      const X0 = view.X(series.t[i]), Y0 = view.Y(series.x[i]);
      const X1 = view.X(series.t[i] + hh), Y1 = view.Y(series.x[i] + hh * series.v[i]);
      if (![X0, Y0, X1, Y1].every(Number.isFinite)) continue;
      ctx.moveTo(X0, Y0); ctx.lineTo(X1, Y1);
    }
    ctx.stroke();
    ctx.restore();
  }

  drawPolyline(ctx, view, ts, xs, { color: approxColor, width });

  if (markers && i1 - i0 <= maxMarkers) {
    ctx.save();
    ctx.fillStyle = approxColor;
    const r = 2.5 * dpr;
    for (let i = i0; i < i1; i++) {
      const X = view.X(series.t[i]), Y = view.Y(series.x[i]);
      if (!Number.isFinite(X) || !Number.isFinite(Y) || Y < -r || Y > h + r) continue;
      ctx.beginPath(); ctx.arc(X, Y, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
  return view;
}

/**
 * The sample nearest a pixel position, for hover and touch.
 *   nearestSample(view, xs, ys, px, py, n = xs.length) → { i, dist } (dist in device px) or null
 */
export function nearestSample(view, xs, ys, px, py, n = xs.length) {
  let best = -1, bestD = Infinity;
  for (let i = 0; i < n; i++) {
    const X = view.X(xs[i]), Y = view.Y(ys[i]);
    if (!Number.isFinite(X) || !Number.isFinite(Y)) continue;
    const d = Math.hypot(X - px, Y - py);
    if (d < bestD) { bestD = d; best = i; }
  }
  return best < 0 ? null : { i: best, dist: bestD };
}
