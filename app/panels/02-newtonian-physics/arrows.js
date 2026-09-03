// Shared by panel 2's three panes: the force arrows of the scene, their colors, and the map
// between force units and plot units.
//
// Two problems the map has to solve at once. Forces here span two orders of magnitude (the
// spring at x = 1 with k = 100 is ~100, gravity at the defaults is ~1, drag at v = 2 is 0.2),
// so a linear scale that fits the spring leaves the other two invisible; and the scale must
// not depend on *which* forces are switched on, or toggling one arrow off would move all the
// others. So: the reference magnitude is taken over every force, on and off, and the length
// is logarithmic in the magnitude —
//
//   len(F) = ARROW_LEN · ln(1 + |F| / F0) / ln(1 + ref / F0)
//
// which puts every arrow on screen at once while the numbers in the equations stay the truth.
// `toForce` inverts it, so a dragged tip still reads back as a force; a pane freezes the whole
// map for the duration of a drag so the tip stays under the pointer.

import { el, fragment } from 'shared/dom.js';
import { cssVar, drawArrow, drawText } from 'shared/gfx/plot2d.js';
import { MODELS, forceOf } from 'shared/math/forces.js';
import { scene, FORCE_LIMITS, BODY_LIMITS } from 'shared/scene.js';
import { toggleFn } from 'shared/ui/controls.js';

/** CSS variable per force type; the sum and the acceleration have their own. */
export const FORCE_COLOR = Object.freeze({ wind: '--force-wind', gravity: '--force-gravity', drag: '--force-drag', spring: '--force-spring' });
export const SUM_COLOR = '--approx';
export const ACCEL_COLOR = '--exact';

export const mag = ([x, y]) => Math.hypot(x, y);
export const ARROW_LEN = 1.6;   // plot units for an arrow at the reference magnitude
const F0 = 0.1;                 // the knee of the log: below this, length is ~linear in |F|

/**
 * The active forces of a scene state as [{ i, type, label, F: [fx, fy], on }] (real or linear
 * per `linear`; the scene's own flag by default), plus the sum of the ones that are on.
 * With `all: true` the switched-off forces are in the list too (the sum still is not).
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

/**
 * arrowMap(state, { linear }) → { ref, len(F), toPlot(F), toForce(p) }
 *
 * `ref` is the largest magnitude in the picture — every force, switched on or not, the sum of
 * all of them, and that sum over m (the acceleration arrow) — so the map is a function of the
 * scene's numbers only, never of which switches are up.
 */
export function arrowMap(state, { linear = state.linear } = {}) {
  const { list } = forceVectors(state, { linear, all: true });
  const all = [0, 0];
  let ref = 1;
  for (const v of list) {
    all[0] += v.F[0]; all[1] += v.F[1];
    ref = Math.max(ref, mag(v.F));
  }
  const m = Math.max(state.body.m, 1e-9);
  ref = Math.max(ref, mag(all), mag(all) / m);
  const span = Math.log1p(ref / F0);
  const len = F => ARROW_LEN * Math.log1p(mag(F) / F0) / span;
  return {
    ref,
    len,
    /** A force as the plot-space offset from the arrow's tail. */
    toPlot(F) {
      const q = mag(F);
      if (q < 1e-12) return [0, 0];
      const l = len(F);
      return [F[0] / q * l, F[1] / q * l];
    },
    /** The inverse: a plot-space offset (a dragged tip) back as a force. */
    toForce(p) {
      const l = mag(p);
      if (l < 1e-12) return [0, 0];
      const q = F0 * Math.expm1(l / ARROW_LEN * span);
      return [p[0] / l * q, p[1] / l * q];
    },
  };
}

/**
 * The map for a pane whose arrows are already in plot units and need no compression: the
 * left pane's two free vectors, where the axes *are* the numbers.
 */
export const IDENTITY_MAP = Object.freeze({
  ref: 1,
  len: F => mag(F),
  toPlot: F => [F[0], F[1]],
  toForce: p => [p[0], p[1]],
});

/** Draw one arrow from `from` along the mapped F, with an optional label at the tip. */
export function drawForceArrow(g, view, from, F, map, { color, width = 2, label, head = 8, alpha = 1 } = {}) {
  const d = map.toPlot(F);
  const tip = [from[0] + d[0], from[1] + d[1]];
  const l = mag(d);
  if (l < 1e-3) return tip;
  g.save();
  g.globalAlpha = alpha;
  drawArrow(g, view, from[0], from[1], tip[0], tip[1], { color: cssVar(color), width, head });
  if (label && l >= 0.3) {   // an arrow too short to read gets no label, or they pile up
    const dx = d[0] >= 0 ? 8 : -8;
    drawText(g, view, label, tip[0], tip[1], { color: cssVar(color), size: 11, align: d[0] >= 0 ? 'left' : 'right', dx, dy: d[1] >= 0 ? -6 : 14 });
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

// ---- the four forces' draggable equations, and the on/off row that shows one (the spine
// and the right pane both let the reader drag and toggle the same four forces) ----

const sc = (key, digits, log = false) => `<mn data-scrub="${key}" data-digits="${digits}"${log ? ' data-log' : ''}>0</mn>`;
const vec = (xk, yk) => `<mo>=</mo><mo>(</mo><mn data-var="${xk}" data-digits="2">0</mn><mo>,</mo><mn data-var="${yk}" data-digits="2">0</mn><mo>)</mo>`;

/**
 * Each force's model as a live MathML fragment: every parameter scrubbable (bindScrub, via
 * forceParamFacade below), the vector it produces read out at the end — Fgx/Fgy, Fdx/Fdy,
 * Fsx/Fsy, filled by whatever bindMath derive computes forceVectors' list.
 */
export const FORCE_EQUATIONS = Object.freeze({
  wind: `<math><mrow><mi>F</mi><mo>=</mo><mo>(</mo>${sc('wind-fx', 1)}<mo>,</mo>${sc('wind-fy', 1)}<mo>)</mo></mrow></math>`,
  gravity: `<math><mrow><mi>F</mi><mo>=</mo><mfrac><mrow>${sc('G', 2)}<mo>·</mo>${sc('m1', 2)}<mo>·</mo>${sc('m2', 0, true)}</mrow><msup><mn data-scrub="r" data-digits="1" data-log>0</mn><mn>2</mn></msup></mfrac>${vec('Fgx', 'Fgy')}</mrow></math>`,
  drag: `<math><mrow><mi>F</mi><mo>=</mo><mo>−</mo>${sc('drag-c', 2)}<mo>·</mo><mi>v</mi>${vec('Fdx', 'Fdy')}</mrow></math>`,
  spring: `<math><mrow><mi>F</mi><mo>=</mo><mo>−</mo>${sc('spring-k', 0, true)}<mo>·</mo><mi>x</mi>${vec('Fsx', 'Fsy')}</mrow></math>`,
});

/**
 * One store-shaped view over every scrubbable parameter of every force, plus the body's
 * mass m1 (gravity's own equation, and any totals beside the rows): unique keys, so one
 * bindScrub over one article catches every row.
 */
export function forceParamFacade() {
  const at = type => scene.forceIndex(type);
  const map = {
    'wind-fx': [at('wind'), 'fx', FORCE_LIMITS.fx], 'wind-fy': [at('wind'), 'fy', FORCE_LIMITS.fy],
    G: [at('gravity'), 'G', FORCE_LIMITS.G], m2: [at('gravity'), 'm2', FORCE_LIMITS.m2], r: [at('gravity'), 'r', FORCE_LIMITS.r],
    'drag-c': [at('drag'), 'c', FORCE_LIMITS.c], 'spring-k': [at('spring'), 'k', FORCE_LIMITS.k],
    m1: ['body', 'm', BODY_LIMITS.m],
  };
  const get = () => {
    const s = scene.get(), o = {};
    for (const [key, [i, p]] of Object.entries(map)) o[key] = i === 'body' ? s.body.m : s.forces[i][p];
    return o;
  };
  return {
    get,
    set(patch) {
      for (const [key, v] of Object.entries(patch)) {
        if (!map[key] || !Number.isFinite(v)) continue;
        const [i, p] = map[key];
        if (i === 'body') scene.setMass(v); else scene.setForceParam(i, p, v);
      }
      return get();
    },
    subscribe: (fn, opts) => scene.subscribe(() => { const g = get(); fn(g, g); }, opts),
    limits: Object.fromEntries(Object.entries(map).map(([key, [, , lim]]) => [key, lim])),
  };
}

/**
 * One force's row: the on/off switch, its equation, and a hint that always occupies its full
 * width so toggling a force cannot itself change the row's width — pair with the .force-row /
 * .force-off-hint CSS, which reserves the row's height too.
 */
export function forceRow(f, i, { signal } = {}) {
  return el('div', { class: 'transport force-row' },
    toggleFn({
      label: f.type[0].toUpperCase() + f.type.slice(1),
      get: () => scene.get().forces[i].on, set: v => scene.toggleForce(i, v), subscribe: scene.subscribe, signal,
    }),
    fragment(FORCE_EQUATIONS[f.type]),
    el('span', { class: 'muted force-off-hint' }, 'off — not in ΣF'),
  );
}

/** Every force's row, in scene order. */
export function forceRows(signal) {
  return scene.get().forces.map((f, i) => forceRow(f, i, { signal }));
}

/** The vector each force produces, keyed for bindMath: Fgx/Fgy, Fdx/Fdy, Fsx/Fsy. */
export function forceComponents(state) {
  const { list } = forceVectors(state, { all: true });
  const at = type => list.find(v => v.type === type)?.F ?? [0, 0];
  const [Fgx, Fgy] = at('gravity'), [Fdx, Fdy] = at('drag'), [Fsx, Fsy] = at('spring');
  return { Fgx, Fgy, Fdx, Fdy, Fsx, Fsy };
}
