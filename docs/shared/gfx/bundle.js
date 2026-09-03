// A bundle: several series on one plot with one highlighted and the rest dimmed. Every
// "explode a parameter" pane draws its sweep through this. Victor's caution about pretty,
// unreadable bundles is enforced by MAX_SERIES: anything past it is not drawn.

import { drawPolyline, cssVar } from './plot2d.js';

export const MAX_SERIES = 12;
let warned = false;

/**
 * drawBundle(ctx, view, series, { highlight, color, dimAlpha, width, dimWidth, dash })
 *   series     [{ xs, ys }]; at most MAX_SERIES are drawn
 *   highlight  index drawn last, full alpha and width; −1 or null highlights nothing
 *   color      a CSS color, or (index) → color; default --approx
 *   dimAlpha   alpha of the non-highlighted series (default 0.25)
 *   width      highlighted line width in CSS px; dimWidth for the rest (default width)
 */
export function drawBundle(ctx, view, series, { highlight = -1, color, dimAlpha = 0.25, width = 2, dimWidth, dash = null } = {}) {
  if (series.length > MAX_SERIES && !warned) {
    warned = true;
    console.warn(`drawBundle: ${series.length} series; only the first ${MAX_SERIES} are drawn (keep sweeps small)`);
  }
  const n = Math.min(series.length, MAX_SERIES);
  const colorOf = typeof color === 'function' ? color : () => color ?? cssVar('--approx');
  for (let i = 0; i < n; i++) {
    if (i === highlight) continue;
    drawPolyline(ctx, view, series[i].xs, series[i].ys, { color: colorOf(i), width: dimWidth ?? width, alpha: dimAlpha, dash });
  }
  if (highlight >= 0 && highlight < n) {
    drawPolyline(ctx, view, series[highlight].xs, series[highlight].ys, { color: colorOf(highlight), width, alpha: 1, dash });
  }
}
