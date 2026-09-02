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
 */
export function createStepper({ method, h, m, c, k, x0 = 1, v0 = 0 }) {
  if (!METHODS[method]) throw new Error(`unknown integrator: ${method}`);
  const acc = acceleration(m, c, k);
  let x = x0, v = v0, t = 0;
  let xPrev = method === 'verlet' ? exactSolution({ m, c, k, x0, v0 }).x(-h) : 0;

  const steps = {
    euler() {
      const a = acc(x, v);
      x += h * v;
      v += h * a;
    },
    rk4() {
      const k1v = v,                 k1a = acc(x, v);
      const k2v = v + h / 2 * k1a,   k2a = acc(x + h / 2 * k1v, k2v);
      const k3v = v + h / 2 * k2a,   k3a = acc(x + h / 2 * k2v, k3v);
      const k4v = v + h * k3a,       k4a = acc(x + h * k3v, k4v);
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
      v += h * acc(x, v);
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
    step() { advance(); t += h; return this; },
  };
}

/**
 * Run from t = 0 to tEnd (inclusive of the last step that fits).
 * Returns { t, x, v } as Float64Arrays plus `exact`, the closed form sampled at the same t.
 */
export function simulate(params, tEnd) {
  const s = createStepper(params);
  const n = Math.max(0, Math.floor(tEnd / params.h + 1e-9));
  const t = new Float64Array(n + 1), x = new Float64Array(n + 1), v = new Float64Array(n + 1);
  const sol = exactSolution(params);
  const exact = new Float64Array(n + 1);
  for (let i = 0; ; i++) {
    t[i] = s.t; x[i] = s.x; v[i] = s.v; exact[i] = sol.x(s.t);
    if (i === n) break;
    s.step();
  }
  return { t, x, v, exact, n: n + 1 };
}
