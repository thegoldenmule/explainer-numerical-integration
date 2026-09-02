// The complex λ-plane: Re and Im axes, the eigenvalue pair from stabilityReport drawn
// stable/unstable with |R| labels, an optional region underneath (blitted from the shared
// shader canvas), analytic Euler circles for the nested-disk pane, and an optional draggable
// λ handle that inverts to (c, k) through paramsFromEigenvalue and writes the store. It stays
// on screen from panel 7 to the end, so it is one module.
//
//   const plane = createComplexPlane({ stage, store, signal, region: true, drag: true });
//   stage layers: 'region' (blit target) under 'plane' (axes, points); pass `layers` to rename.
//
// Without a stage, pass `canvases: { region, plane }` and call plane.draw(size) yourself.

import { cssVar, makeView, drawGrid, drawPoint, drawText, niceStep, fmtTick } from './plot2d.js';
import { drawRegion } from './region-gl.js';
import { fmt } from '../dom.js';
import { paramsFromEigenvalue } from '../math/system.js';
import { stabilityReport, taylorAmplification } from '../math/stability.js';
import { cabs, cscale } from '../math/complex.js';

const HIT_PX = 14;   // css px around the handle that start a drag

/** The root used as the drag handle: largest imaginary part, then largest real part. */
export function handleIndex(lambdas) {
  let best = 0;
  for (let i = 1; i < lambdas.length; i++) {
    const a = lambdas[i], b = lambdas[best];
    if (a[1] > b[1] + 1e-12 || (Math.abs(a[1] - b[1]) <= 1e-12 && a[0] > b[0])) best = i;
  }
  return best;
}

/**
 * createComplexPlane({ stage | canvases, layers = { region: 'region', plane: 'plane' }, store,
 *   signal, halfRange = 12, cx = 0, cy = 0, region = false, drag = false, circles = null,
 *   labels = true, grid = true, verdict = null, onDraw })
 *   halfRange  number | state → number: half the view's width in λ units
 *   cx, cy     number | state → number: the view's center (10-right centers on −1/h)
 *   region     false | true (the store's method and h) | { layers, highlight } | state → that
 *   circles    null | number[] of h | state → number[]: Euler disks, center −1/h, radius 1/h
 *   labels     true (|R| beside each root) | false | (factor, i, state) → string
 *   verdict    what colors the roots (and what the |R| labels read):
 *                null         the store's method at the store's h (the default)
 *                'physical'   Re λ ≤ 0, no integrator and no |R| label (panels 7, 11-left)
 *                '<method>'   that method's stabilityReport at the store's h, whatever the
 *                             store's method is (10: 'euler', 12-right-2: 'implicit')
 *                { method, h } | { order, h }   a region-layer spec: that method, or the
 *                             degree-`order` Taylor sum, at `h` (defaults to the store's)
 *                state → any of the above
 *   onDraw     (g, view, state) → void, drawn last on the plane layer
 * → { draw(size), get view, get report, setHalfRange(r), invalidate(), destroy() }
 * `report` is always the store's method's stabilityReport, whatever `verdict` says.
 */
export function createComplexPlane({
  stage = null, canvases = null, layers = { region: 'region', plane: 'plane' }, store, signal,
  halfRange = 12, cx = 0, cy = 0, region = false, drag = false, circles = null, labels = true,
  grid = true, verdict = null, onDraw,
} = {}) {
  const hasLayer = name => (stage ? stage.canvases.some(c => c.dataset.layer === layers[name]) : Boolean(canvases?.[name]));
  const canvasOf = name => (stage ? stage.canvas(layers[name]) : canvases[name]);
  const ctxCache = new Map();
  const ctxOf = name => {
    if (!hasLayer(name)) return null;
    if (stage) return stage.ctx(layers[name]);
    if (!ctxCache.has(name)) ctxCache.set(name, canvases[name].getContext('2d'));
    return ctxCache.get(name);
  };
  const resolve = (opt, state) => (typeof opt === 'function' ? opt(state) : opt);

  let view = null, report = null, handle = null;   // handle: [re, im] of the dragged root
  let dragging = null;

  function regionOpts(state) {
    const r = resolve(region, state);
    if (!r) return null;
    if (r === true) return { method: state.method, h: state.h };
    return r;
  }

  /**
   * The verdict on each root: { stable[], factors[] (NaN when there is no scalar |R|),
   * labels: false when nothing is worth labelling (the physical verdict) }.
   */
  function verdicts(state, rep) {
    const v = resolve(verdict, state);
    if (v === 'physical') {
      return { stable: rep.lambdas.map(l => l[0] <= 0), factors: rep.lambdas.map(() => NaN), labels: false };
    }
    let spec = v == null ? { method: state.method } : typeof v === 'string' ? { method: v } : v;
    const h = spec.h ?? state.h;
    if (spec.order != null && spec.method == null) {
      const factors = rep.lambdas.map(l => cabs(taylorAmplification(cscale(l, h), spec.order)));
      return { stable: factors.map(f => f <= 1), factors, labels: true };
    }
    const r = spec.method === state.method && h === state.h ? rep : stabilityReport(spec.method, { ...state, h });
    return {
      stable: r.factors.map(f => (Number.isNaN(f) ? r.stable : f <= 1)),
      factors: r.factors,
      rho: r.rho,
      labels: true,
    };
  }

  const font = dpr => `${11 * dpr}px ${cssVar('--font') || 'system-ui'}`;

  /**
   * Where drawGrid put its tick labels and axis names, as [x0, y0, x1, y1] in device px,
   * so the root labels can stay clear of them. Mirrors drawGrid's layout.
   */
  function gridLabelRects(g, v) {
    const { w, h, dpr } = v, rects = [];
    g.save();
    g.font = font(dpr);
    const box = (x, yb, text) => rects.push([x, yb - 11 * dpr, x + g.measureText(text).width, yb + 2 * dpr]);
    const xs = niceStep(v.xMax - v.xMin), ys = niceStep(v.yMax - v.yMin);
    const X0 = v.X(0), Y0 = v.Y(0);
    const labelY = Math.min(Math.max(Y0, 14 * dpr), h - 4 * dpr);
    const labelX = Math.min(Math.max(X0, 4 * dpr), w - 30 * dpr);
    for (let t = Math.ceil(v.xMin / xs) * xs; t <= v.xMax + 1e-9; t += xs) if (Math.abs(t) >= 1e-9) box(v.X(t) + 3 * dpr, labelY - 4 * dpr, fmtTick(t));
    for (let t = Math.ceil(v.yMin / ys) * ys; t <= v.yMax + 1e-9; t += ys) if (Math.abs(t) >= 1e-9) box(labelX + 4 * dpr, v.Y(t) - 3 * dpr, fmtTick(t));
    box(w - g.measureText('Re λ').width - 6 * dpr, labelY - 6 * dpr, 'Re λ');
    box(labelX + 6 * dpr, 14 * dpr, 'Im λ');
    g.restore();
    return rects;
  }

  /**
   * Where a root's label goes: beside the root, on the side of the real axis the root is on,
   * the first of right-near, right-far, left-near, left-far that stays inside the frame and
   * clear of `obstacles` (the grid's labels and the labels already placed). Returns
   * { align, dx, dy, rect }; when nothing clears, the right side, pushed inside the frame.
   */
  function placeLabel(X, Y, width, imPositive, v, obstacles) {
    const { w, h, dpr } = v;
    const pad = 10, near = imPositive ? -6 : 14, far = imPositive ? 14 : -6;
    const rect = ({ align, dx, dy }) => {
      const x0 = X + dx * dpr - (align === 'right' ? width : 0), yb = Y + dy * dpr;
      return [x0, yb - 11 * dpr, x0 + width, yb + 2 * dpr];
    };
    const inside = r => r[0] >= 4 * dpr && r[2] <= w - 4 * dpr && r[1] >= 2 * dpr && r[3] <= h - 2 * dpr;
    const hits = r => obstacles.some(o => r[0] < o[2] && r[2] > o[0] && r[1] < o[3] && r[3] > o[1]);
    const candidates = [
      { align: 'left', dx: pad, dy: near }, { align: 'left', dx: pad, dy: far },
      { align: 'right', dx: -pad, dy: near }, { align: 'right', dx: -pad, dy: far },
    ];
    for (const c of candidates) { const r = rect(c); if (inside(r) && !hits(r)) return { ...c, rect: r }; }
    const c = { align: 'left', dx: Math.min(pad, (w - 4 * dpr - width - X) / dpr), dy: near };
    return { ...c, rect: rect(c) };
  }

  function draw({ w, h, dpr }) {
    const state = store.get();
    const half = resolve(halfRange, state);
    view = makeView({ w, h, dpr, halfW: half, cx: resolve(cx, state), cy: resolve(cy, state) });
    report = stabilityReport(state.method, state);
    const vd = verdicts(state, report);

    // region layer (a stage without one, panel 7, simply has no region)
    const gr = ctxOf('region');
    if (gr) {
      gr.clearRect(0, 0, w, h);
      const opts = regionOpts(state);
      if (opts) drawRegion(gr, { ...opts, view });
    }

    // plane layer
    const g = ctxOf('plane');
    g.clearRect(0, 0, w, h);
    if (grid) drawGrid(g, view, { xLabel: 'Re λ', yLabel: 'Im λ' });

    const cs = resolve(circles, state);
    if (cs?.length) {
      g.save();
      g.strokeStyle = cssVar('--region-edge');
      g.lineWidth = 1.25 * dpr;
      g.setLineDash([5 * dpr, 4 * dpr]);
      g.globalAlpha = 0.7;
      for (const hc of cs) {
        const r = 1 / hc;
        g.beginPath();
        g.ellipse(view.X(-r), view.Y(0), r * view.sx, r * view.sy, 0, 0, Math.PI * 2);
        g.stroke();
      }
      g.restore();
    }

    const hi = handleIndex(report.lambdas);
    const obstacles = labels && vd.labels && grid ? gridLabelRects(g, view) : [];
    report.lambdas.forEach((l, i) => {
      const factor = vd.factors[i];
      const color = cssVar(vd.stable[i] ? '--stable' : '--unstable');
      if (drag && i === hi) {
        g.save();
        g.strokeStyle = color; g.globalAlpha = 0.35; g.lineWidth = 2 * dpr;
        g.beginPath(); g.arc(view.X(l[0]), view.Y(l[1]), 11 * dpr, 0, Math.PI * 2); g.stroke();
        g.restore();
      }
      drawPoint(g, view, l[0], l[1], { r: 5.5, fill: color });
      if (labels && vd.labels) {
        const text = typeof labels === 'function' ? labels(factor, i, state)
          : Number.isNaN(factor) ? `ρ = ${fmt(vd.rho, 3)}` : `|R| = ${fmt(factor, 3)}`;
        g.save();
        g.font = font(dpr);
        const width = g.measureText(text).width;
        g.restore();
        const { rect, ...at } = placeLabel(view.X(l[0]), view.Y(l[1]), width, l[1] >= 0, view, obstacles);
        obstacles.push(rect);
        drawText(g, view, text, l[0], l[1], { color, size: 11, ...at });
      }
    });
    handle = report.lambdas[hi];
    onDraw?.(g, view, state);
  }

  // ---- λ drag → (c, k) ----
  const planeCanvas = canvasOf('plane');
  const invalidate = () => stage?.invalidate();
  if (drag) {
    const near = e => {
      if (!view || !handle) return false;
      const r = planeCanvas.getBoundingClientRect();
      const px = (e.clientX - r.left) * view.dpr, py = (e.clientY - r.top) * view.dpr;
      return Math.hypot(px - view.X(handle[0]), py - view.Y(handle[1])) <= HIT_PX * view.dpr;
    };
    const apply = e => {
      const p = view.fromEvent(e, planeCanvas);
      store.set(paramsFromEigenvalue(store.get().m, [p.x, p.y]));   // the store clamps c and k
    };
    planeCanvas.addEventListener('pointerdown', e => {
      if (!near(e)) return;
      dragging = e.pointerId;
      planeCanvas.setPointerCapture(e.pointerId);
      stage?.grabbing(true);
      apply(e);
      e.preventDefault();
    }, { signal });
    planeCanvas.addEventListener('pointermove', e => {
      if (dragging === e.pointerId) { apply(e); return; }
      if (stage) planeCanvas.style.cursor = near(e) ? 'grab' : '';
    }, { signal });
    const end = e => {
      if (dragging !== e.pointerId) return;
      dragging = null;
      stage?.grabbing(false);
    };
    planeCanvas.addEventListener('pointerup', end, { signal });
    planeCanvas.addEventListener('pointercancel', end, { signal });
    // No wheel handler: wheel is the page's swipe gesture and must never be cancelled.
  }

  const offDraw = stage?.onDraw(draw);
  const unsubscribe = store.subscribe(invalidate, { immediate: false });
  function destroy() { offDraw?.(); unsubscribe(); }
  signal?.addEventListener('abort', destroy, { once: true });

  return {
    draw,
    get view() { return view; },
    get report() { return report; },
    setHalfRange(r) { halfRange = r; invalidate(); },
    invalidate,
    destroy,
  };
}
