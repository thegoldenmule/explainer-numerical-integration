// Shared by panel 2's three panes: the force arrows of the scene, their colors, and the
// scale that maps force units to plot units. Forces span two orders of magnitude (gravity
// at the defaults is 1, the spring at x = 1 is 100), so the scale adapts to the largest
// arrow; a pane freezes it for the duration of a drag so the tip stays under the pointer.

import { cssVar, drawArrow, drawText } from 'shared/gfx/plot2d.js';
import { MODELS, forceOf } from 'shared/math/forces.js';

/** CSS variable per force type; the sum and the acceleration have their own. */
export const FORCE_COLOR = Object.freeze({ wind: '--accent', gravity: '--axis', drag: '--muted', spring: '--region-edge' });
export const SUM_COLOR = '--approx';
export const ACCEL_COLOR = '--exact';

export const mag = ([x, y]) => Math.hypot(x, y);
export const ARROW_LEN = 1.6;   // plot units for the largest arrow

/**
 * The active forces of a scene state as [{ i, type, label, F: [fx, fy] }] (real or linear
 * per `linear`; the scene's own flag by default), plus the sum.
 */
export function forceVectors(state, { linear = state.linear, all = false } = {}) {
  const list = [];
  const sum = [0, 0];
  state.forces.forEach((f, i) => {
    if (!f.on && !all) return;
    const F = forceOf(f, state.body, { linear });
    if (f.on) { sum[0] += F[0]; sum[1] += F[1]; }
    list.push({ i, type: f.type, label: MODELS[f.type].label, F, on: f.on });
  });
  return { list, sum };
}

/** Plot units per force unit so the largest of `vectors` (and `extra`) is ARROW_LEN long. */
export function arrowScale(vectors, extra = []) {
  let m = 1;
  for (const v of vectors) m = Math.max(m, mag(v.F ?? v));
  for (const v of extra) m = Math.max(m, mag(v));
  return ARROW_LEN / m;
}

/** Draw one arrow from `from` along F·scale, with an optional label at the tip. */
export function drawForceArrow(g, view, from, F, scale, { color, width = 2, label, head = 8, alpha = 1 } = {}) {
  const tip = [from[0] + F[0] * scale, from[1] + F[1] * scale];
  if (mag(F) * scale < 1e-3) return tip;
  g.save();
  g.globalAlpha = alpha;
  drawArrow(g, view, from[0], from[1], tip[0], tip[1], { color: cssVar(color), width, head });
  if (label && mag(F) * scale >= 0.3) {   // an arrow too short to read gets no label, or they pile up
    const dx = F[0] >= 0 ? 8 : -8;
    drawText(g, view, label, tip[0], tip[1], { color: cssVar(color), size: 11, align: F[0] >= 0 ? 'left' : 'right', dx, dy: F[1] >= 0 ? -6 : 14 });
  }
  g.restore();
  return tip;
}

/**
 * The parameter patch that scales a force so its vector becomes F′ (a dragged tip):
 * wind takes the vector itself; gravity, drag, and spring keep their direction and scale
 * their one magnitude parameter by the projection of F′ onto it. Null when the force
 * currently has no length to scale (drag at v = 0, spring at x = 0).
 */
export function scalePatch(force, F, Fnext) {
  if (force.type === 'wind') return { fx: Fnext[0], fy: Fnext[1] };
  const len = mag(F);
  if (len < 1e-9) return null;
  const along = Math.max(0, (Fnext[0] * F[0] + Fnext[1] * F[1]) / len);
  const key = { gravity: 'G', drag: 'c', spring: 'k' }[force.type];
  return { [key]: force[key] * along / len };
}
