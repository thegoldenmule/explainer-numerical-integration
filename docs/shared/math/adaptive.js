// Variable step sizes (panel 13). Estimate the local error of one step, grow h toward a
// target error when the estimate is under it, shrink and retry when it is over.
//
// Two estimators. Step doubling (the default) takes one step of h and two of h/2 from the
// same state; for a method of order p their difference over 2^p − 1 estimates the error of
// the two-half-step result, which is the one kept. The Taylor estimator is the essay's: the
// next term of the series, h^{p+1}/(p+1)! · |x^{(p+1)}| from math/taylor.js, evaluated at
// the current state. It is cheaper and it is what the college paper used.
//
// The error norm is the larger of the x and v estimates by default (norm: 'state'). The
// essay's recipe measures x alone (norm: 'x'); with the Taylor estimator that vanishes
// wherever x^{(p+1)} does, which is how a controller comes to try a 16-second step.

import { createStepper, METHODS } from './integrators.js';
import { exactSolution } from './system.js';
import { localTruncationError } from './taylor.js';

export const CONTROLLER_DEFAULTS = Object.freeze({
  safety: 0.9, growMax: 4, shrinkMin: 0.25, hMin: 1e-4, hMax: 20,
});

/**
 * Step doubling from the stepper's current state. Returns { error, next } where `next` is
 * an independent stepper advanced by h along the two-half-step path.
 */
export function estimateByDoubling(stepper, h, order, norm = 'state') {
  const big = stepper.clone().setH(h).step();
  const next = stepper.clone().setH(h / 2).step().step();
  const ex = Math.abs(big.x - next.x), ev = Math.abs(big.v - next.v);
  const error = (norm === 'x' ? ex : Math.max(ex, ev)) / (2 ** order - 1);
  return { error, next };
}

/** The next Taylor term at the current state as the error; `next` is one step of h. */
export function estimateByTaylor(stepper, h, order, { m, c, k }, norm = 'state') {
  const e = localTruncationError({ m, c, k, x: stepper.x, v: stepper.v, h, order });
  return { error: norm === 'x' ? e.x : e.max, next: stepper.clone().setH(h).step() };
}

/**
 * The controller: next(h, error) is the step to try after a step of h produced `error`,
 *   h · clamp(safety · (tol / error)^{1/(p+1)}, shrinkMin, growMax), then clamped to
 *   [hMin, hMax]. accepts(error) is error ≤ tol.
 */
export function createController(options = {}) {
  const { order, tol } = options;
  const opt = { ...CONTROLLER_DEFAULTS };
  for (const key of Object.keys(CONTROLLER_DEFAULTS)) if (options[key] != null) opt[key] = options[key];
  const { safety, growMax, shrinkMin, hMin, hMax } = opt;
  const clampH = h => Math.min(hMax, Math.max(hMin, h));
  return {
    tol, hMin, hMax,
    accepts: error => error <= tol,
    next(h, error) {
      const ratio = error > 0 ? safety * (tol / error) ** (1 / (order + 1)) : growMax;
      return clampH(h * Math.min(growMax, Math.max(shrinkMin, ratio)));
    },
    clampH,
  };
}

/**
 * Run with a variable step from t = 0 to tEnd.
 *   { method, tol, m, c, k, x0, v0, hInit, hMax, hMin, estimate: 'doubling' | 'taylor',
 *     norm: 'state' | 'x', safety, growMax, shrinkMin, maxSteps }
 * Returns Float64Arrays t, x, v, h, exact, error (all length n) plus counters:
 *   h[i]      the step taken from t[i]; h[n−1] is the step the controller would try next
 *   error[i]  the accepted step's error estimate; NaN at n−1
 *   rejected  steps thrown away and retried smaller
 *   forced    steps accepted over tol because h was already hMin
 *   hPeak     the largest step taken
 *   attempts  steps tried, accepted or not
 *   complete  true when the run reached tEnd; false after maxSteps attempts or a blow-up
 *   blewUp    true if the state stopped being finite (the run ends there)
 * The last step is clipped so the run lands on tEnd. A rejected step always retries
 * smaller (at most 0.9 h) whatever the controller proposes, so the loop cannot stall.
 */
export function runAdaptive({
  method, tol = 0.01, m, c, k, x0 = 1, v0 = 0,
  hInit = 1 / 30, hMax, hMin, estimate = 'doubling', norm = 'state',
  safety, growMax, shrinkMin, maxSteps = 200000,
}, tEnd) {
  if (!METHODS[method]) throw new Error(`unknown integrator: ${method}`);
  const order = METHODS[method].order;
  const ctl = createController({ order, tol, safety, growMax, shrinkMin, hMin, hMax });
  const est = estimate === 'taylor'
    ? (s, h) => estimateByTaylor(s, h, order, { m, c, k }, norm)
    : (s, h) => estimateByDoubling(s, h, order, norm);
  const sol = exactSolution({ m, c, k, x0, v0 });

  const t = [], x = [], v = [], hs = [], err = [];
  let s = createStepper({ method, h: hInit, m, c, k, x0, v0 });
  let h = ctl.clampH(hInit);
  let rejected = 0, forced = 0, hPeak = 0, blewUp = false, attempts = 0;
  const push = () => { t.push(s.t); x.push(s.x); v.push(s.v); };
  push();

  while (s.t < tEnd - 1e-12 && attempts < maxSteps) {
    attempts++;
    const hTry = Math.min(h, tEnd - s.t);
    const { error, next } = est(s, hTry);
    if (!Number.isFinite(error) || !Number.isFinite(next.x) || !Number.isFinite(next.v)) { blewUp = true; break; }
    const atFloor = hTry <= ctl.hMin + 1e-15;
    if (ctl.accepts(error) || atFloor) {
      if (!ctl.accepts(error)) forced++;
      hs.push(hTry); err.push(error);
      hPeak = Math.max(hPeak, hTry);
      s = next;
      h = ctl.next(hTry, error);
      push();
    } else {
      rejected++;
      h = Math.min(ctl.next(hTry, error), ctl.clampH(0.9 * hTry));
    }
  }
  hs.push(h); err.push(NaN);

  const n = t.length;
  const exact = new Float64Array(n);
  for (let i = 0; i < n; i++) exact[i] = sol.x(t[i]);
  return {
    t: Float64Array.from(t), x: Float64Array.from(x), v: Float64Array.from(v),
    h: Float64Array.from(hs), error: Float64Array.from(err), exact,
    n, rejected, forced, hPeak, attempts, blewUp, complete: !blewUp && s.t >= tEnd - 1e-12, order, tol,
  };
}
