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

import { cssVar, makeView, drawGrid, drawPoint, drawText } from './plot2d.js';
import { drawRegion } from './region-gl.js';
import { fmt } from '../dom.js';
import { paramsFromEigenvalue } from '../math/system.js';
import { stabilityReport } from '../math/stability.js';

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
 *   signal, halfRange = 12, region = false, drag = false, circles = null, labels = true,
 *   grid = true, onDraw })
 *   halfRange  number | state → number
 *   region     false | true (the store's method and h) | { layers, highlight } | state → that
 *   circles    null | number[] of h | state → number[]: Euler disks, center −1/h, radius 1/h
 *   onDraw     (g, view, state) → void, drawn last on the plane layer
 * → { draw(size), get view, get report, setHalfRange(r), invalidate(), destroy() }
 */
export function createComplexPlane({
  stage = null, canvases = null, layers = { region: 'region', plane: 'plane' }, store, signal,
  halfRange = 12, region = false, drag = false, circles = null, labels = true, grid = true, onDraw,
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

  function draw({ w, h, dpr }) {
    const state = store.get();
    const half = resolve(halfRange, state);
    view = makeView({ w, h, dpr, halfW: half });
    report = stabilityReport(state.method, state);

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
    report.lambdas.forEach((l, i) => {
      const factor = report.factors[i];
      const stable = Number.isNaN(factor) ? report.stable : factor <= 1;
      const color = cssVar(stable ? '--stable' : '--unstable');
      if (drag && i === hi) {
        g.save();
        g.strokeStyle = color; g.globalAlpha = 0.35; g.lineWidth = 2 * dpr;
        g.beginPath(); g.arc(view.X(l[0]), view.Y(l[1]), 11 * dpr, 0, Math.PI * 2); g.stroke();
        g.restore();
      }
      drawPoint(g, view, l[0], l[1], { r: 5.5, fill: color });
      if (labels) {
        const text = Number.isNaN(factor) ? `ρ = ${fmt(report.rho, 3)}` : `|R| = ${fmt(factor, 3)}`;
        // to the right of the point, unless that runs into the frame edge or the Im axis's tick labels
        const X = view.X(l[0]), X0 = view.X(0);
        const right = X < w - 90 * dpr && !(X < X0 + 4 * dpr && X > X0 - 40 * dpr);
        drawText(g, view, text, l[0], l[1], { color, size: 11, align: right ? 'left' : 'right', dx: right ? 10 : -10, dy: l[1] >= 0 ? -6 : 14 });
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
