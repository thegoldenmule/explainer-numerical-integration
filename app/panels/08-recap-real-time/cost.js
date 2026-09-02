// Local helpers for panel 8's three panes: the frame budget (which display we are budgeting
// for, and the steps one frame needs at h) and the budget bar. The per-step cost itself
// comes from shared/player.js (`player.cost`, or `stepCost(state)` for a pane without a
// player): a warmed benchmark, since performance.now() cannot resolve a spring step.

import { cssVar } from 'shared/gfx/plot2d.js';

export const FRAME_MS = 1000 / 60;
export const BAR_MIN_MS = 1e-4;   // left edge of the log bar: 0.1 µs

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
