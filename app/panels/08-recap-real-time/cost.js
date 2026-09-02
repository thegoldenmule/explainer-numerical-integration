// Local helpers for panel 8's three panes: a calibrated per-step cost and the frame-budget
// bar. The player reports its own per-frame and per-step cost, but on a page that is not
// cross-origin isolated performance.now() is quantized to 0.1 ms, and two Euler steps per
// frame take well under a microsecond, so its numbers read 0 with 0.1 ms spikes. The
// benchmark below times enough steps to get over that resolution and is used to size the
// bars; the player's raw number is still shown alongside. (A stand-in: if the player grows a
// calibrated per-step cost, use that instead.)

import { createStepper } from 'shared/math/integrators.js';
import { cssVar } from 'shared/gfx/plot2d.js';

export const FRAME_MS = 1000 / 60;
export const BAR_MIN_MS = 1e-4;   // left edge of the log bar: 0.1 µs

let benchKey = '', benchValue = 0;

/** ms per step of the given method and parameters, measured on at least ~4 ms of stepping. */
export function benchmarkStep(state) {
  const key = `${state.method}/${state.m}/${state.c}/${state.k}`;
  if (key === benchKey) return benchValue;
  const s = createStepper({ ...state, h: 0.001 });   // the cost of a step does not depend on h
  for (let i = 0; i < 20000; i++) s.step();          // warm the JIT before timing
  let steps = 0;
  const t0 = performance.now();
  let elapsed = 0;
  while (elapsed < 4 && steps < 4e6) {
    for (let i = 0; i < 5000; i++) s.step();
    steps += 5000;
    elapsed = performance.now() - t0;
  }
  benchKey = key;
  benchValue = elapsed / steps;
  return benchValue;
}

/** Steps of h that one frame of the display needs (fractional when h is longer than a frame). */
export const stepsPerFrame = (h, frameMs = FRAME_MS) => frameMs / 1000 / h;

export function fmtMs(ms) {
  if (!Number.isFinite(ms)) return '—';
  if (ms >= 1) return `${ms.toFixed(2)} ms`;
  if (ms >= 1e-3) return `${(ms * 1e3).toFixed(1)} µs`;
  return `${(ms * 1e6).toFixed(0)} ns`;
}

/**
 * The frame budget as a horizontal bar on a log scale from BAR_MIN_MS to `budget` ms, with
 * decade ticks. Draws into the rectangle (x, y, w, h) in device pixels.
 */
export function drawBudgetBar(g, { x, y, w, h, dpr }, { cost, budget = FRAME_MS, label = 'physics per frame' }) {
  const lo = Math.log10(BAR_MIN_MS), hi = Math.log10(budget);
  const px = ms => x + w * Math.min(1, Math.max(0, (Math.log10(Math.max(ms, BAR_MIN_MS)) - lo) / (hi - lo)));
  const over = cost > budget;
  g.save();
  g.font = `${11 * dpr}px ${cssVar('--font') || 'system-ui'}`;
  // the frame
  g.fillStyle = cssVar('--accent-soft');
  g.fillRect(x, y, w, h);
  g.strokeStyle = cssVar('--border-strong');
  g.lineWidth = dpr;
  g.strokeRect(x, y, w, h);
  // decade ticks
  g.fillStyle = cssVar('--tick');
  g.strokeStyle = cssVar('--grid');
  for (let e = Math.ceil(lo); e <= Math.floor(hi); e++) {
    const X = px(10 ** e);
    g.beginPath(); g.moveTo(X, y); g.lineTo(X, y + h); g.stroke();
    if (x + w - X > 95 * dpr) g.fillText(fmtMs(10 ** e), X + 3 * dpr, y + h + 12 * dpr);
  }
  g.textAlign = 'right';
  g.fillText(`${fmtMs(budget)} frame`, x + w, y + h + 12 * dpr);
  // the cost
  g.fillStyle = cssVar(over ? '--unstable' : '--approx');
  g.globalAlpha = 0.85;
  g.fillRect(x, y, Math.max(2 * dpr, px(cost) - x), h);
  g.globalAlpha = 1;
  g.textAlign = 'left';
  g.fillStyle = cssVar('--fg');
  g.fillText(`${label}: ${fmtMs(cost)} of ${fmtMs(budget)} (${(100 * cost / budget).toPrecision(2)}%)`, x + 4 * dpr, y - 5 * dpr);
  g.restore();
}
