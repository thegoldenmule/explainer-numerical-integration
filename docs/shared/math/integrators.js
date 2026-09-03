// The integrators, applied to the linear mass-spring-drag system.
// createStepper() advances one state; simulate() fills arrays for a whole trajectory.

import { acceleration, exactSolution } from './system.js';

export const METHODS = Object.freeze({
  euler:    { id: 'euler',    label: 'Explicit Euler',      order: 1, hasRegion: true },
  rk4:      { id: 'rk4',      label: 'RK4',                 order: 4, hasRegion: true },
  implicit: { id: 'implicit', label: 'Implicit Euler',      order: 1, hasRegion: true },
  semi:     { id: 'semi',     label: 'Semi-implicit Euler', order: 1, hasRegion: false },
  verlet:   { id: 'verlet',   label: 'Störmer–Verlet',      order: 2, hasRegion: false },
});
export const METHOD_IDS = Object.freeze(Object.keys(METHODS));

/**
 * A stepper holds (x, v, t) and advances by h per step().
 * Verlet keeps x_{n−1} internally, seeded with the exact x(−h); its v is the backward
 * difference (x_n − x_{n−1}) / h, an estimate, which is also what its drag term uses.
 *
 * setH(h) changes the step from here on (Verlet rebuilds x_{n−1} so its velocity at t is
 * preserved) and clone() returns an independent stepper at the same state; together they
 * let the adaptive controller take trial steps of varying size (math/adaptive.js).
 *
 * `accel(x, v, t)` replaces the linear acceleration for the explicit methods (euler, rk4,
 * semi), which is how panel 2 integrates an arbitrary force sum and 5-right runs the
 * nonlinear model. Implicit Euler and Verlet keep their linear closed forms and throw if
 * one is passed; restrict the method picker to EXPLICIT_METHODS when a custom force is in
 * play.
 */
export const EXPLICIT_METHODS = Object.freeze(['euler', 'rk4', 'semi']);

export function createStepper({ method, h, m, c, k, x0 = 1, v0 = 0, accel = null }) {
  if (!METHODS[method]) throw new Error(`unknown integrator: ${method}`);
  if (accel && !EXPLICIT_METHODS.includes(method)) {
    throw new Error(`${METHODS[method].label} integrates the linear system only; a custom accel needs one of ${EXPLICIT_METHODS.join(', ')}`);
  }
  const xPrev = method === 'verlet' ? exactSolution({ m, c, k, x0, v0 }).x(-h) : 0;
  return makeStepper({ method, h, m, c, k, accel }, { x: x0, v: v0, t: 0, xPrev });
}

function makeStepper({ method, h, m, c, k, accel }, init) {
  const acc = accel ?? acceleration(m, c, k);
  let { x, v, t, xPrev } = init;

  const steps = {
    euler() {
      const a = acc(x, v, t);
      x += h * v;
      v += h * a;
    },
    rk4() {
      const k1v = v,                 k1a = acc(x, v, t);
      const k2v = v + h / 2 * k1a,   k2a = acc(x + h / 2 * k1v, k2v, t + h / 2);
      const k3v = v + h / 2 * k2a,   k3a = acc(x + h / 2 * k2v, k3v, t + h / 2);
      const k4v = v + h * k3a,       k4a = acc(x + h * k3v, k4v, t + h);
      x += h / 6 * (k1v + 2 * k2v + 2 * k3v + k4v);
      v += h / 6 * (k1a + 2 * k2a + 2 * k3a + k4a);
    },
    // (I − hA) y = s solved in closed form:  det = 1 + hc/m + h²k/m
    implicit() {
      const p = h * c / m, q = h * k / m;
      const det = 1 + p + h * q;
      const xn = ((1 + p) * x + h * v) / det;
      const vn = (-q * x + v) / det;
      x = xn; v = vn;
    },
    semi() {
      v += h * acc(x, v, t);
      x += h * v;
    },
    verlet() {
      const vEst = (x - xPrev) / h;
      const xn = 2 * x - xPrev + h * h * acc(x, vEst);
      xPrev = x; x = xn;
      v = (x - xPrev) / h;
    },
  };
  const advance = steps[method];

  return {
    get x() { return x; },
    get v() { return v; },
    get t() { return t; },
    get h() { return h; },
    step() { advance(); t += h; return this; },
    /**
     * Use `next` as the step from here on. Verlet re-seeds x_{n−1}: its backward difference
     * is the velocity at t − h/2, so v(t) ≈ (x − x_{n−1})/h + a h/2 and the new
     * x_{n−1} = x − h' v(t) + h'² a / 2, which is the old x_{n−1} exactly when h' = h.
     */
    setH(next) {
      if (method === 'verlet') {
        const vHalf = (x - xPrev) / h;
        const a = acc(x, vHalf);
        const vNow = vHalf + a * h / 2;
        xPrev = x - next * vNow + next * next * a / 2;
      }
      h = next;
      return this;
    },
    /** An independent copy at the same (x, v, t, x_{n−1}) and h, for trial steps. */
    clone() { return makeStepper({ method, h, m, c, k, accel }, { x, v, t, xPrev }); },
  };
}

/**
 * Run from t = 0 to tEnd (inclusive of the last step that fits).
 * Returns { t, x, v } as Float64Arrays plus `exact`, the closed form sampled at the same t.
 * With a custom `accel` there is no closed form to compare against: `exact` is still an
 * array of the right length, filled with NaN, so plots that draw it simply draw nothing
 * (plot2d and trajectory skip non-finite samples), and `hasExact` is false.
 */
export function simulate(params, tEnd) {
  const s = createStepper(params);
  const n = Math.max(0, Math.floor(tEnd / params.h + 1e-9));
  const t = new Float64Array(n + 1), x = new Float64Array(n + 1), v = new Float64Array(n + 1);
  const sol = params.accel ? null : exactSolution(params);
  const exact = new Float64Array(n + 1);
  if (!sol) exact.fill(NaN);
  for (let i = 0; ; i++) {
    t[i] = s.t; x[i] = s.x; v[i] = s.v;
    if (sol) exact[i] = sol.x(s.t);
    if (i === n) break;
    s.step();
  }
  return { t, x, v, exact, n: n + 1, hasExact: Boolean(sol) };
}
