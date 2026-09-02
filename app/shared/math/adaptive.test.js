import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runAdaptive, createController, estimateByDoubling, estimateByTaylor, CONTROLLER_DEFAULTS } from './adaptive.js';
import { createStepper, simulate } from './integrators.js';
import { localTruncationError } from './taylor.js';

const essay = { m: 10, c: 0.1, k: 10, x0: 1, v0: 0 };
const demo = { m: 1, c: 0.1, k: 100, x0: 1, v0: 0 };
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} expected ${b} got ${a}`);
const peakAbs = arr => Math.max(...arr.map(Math.abs));
const maxGlobalError = r => { let e = 0; for (let i = 0; i < r.n; i++) e = Math.max(e, Math.abs(r.x[i] - r.exact[i])); return e; };

test('stepper.clone() is independent and setH() changes the step from here on', () => {
  const s = createStepper({ ...demo, method: 'rk4', h: 0.01 });
  s.step();
  const c = s.clone();
  assert.equal(c.x, s.x); assert.equal(c.v, s.v); assert.equal(c.t, s.t); assert.equal(c.h, 0.01);
  c.setH(0.02).step();
  assert.equal(s.t, 0.01); near(c.t, 0.03, 1e-15);
  assert.notEqual(c.x, s.x);
  // one step of 0.02 from the clone equals a fresh stepper's step of 0.02 from the same state
  const fresh = createStepper({ ...demo, method: 'rk4', h: 0.02, x0: s.x, v0: s.v }).step();
  near(c.x, fresh.x, 1e-15); near(c.v, fresh.v, 1e-15);
});

test('Verlet keeps its backward difference across setH, and setH(h) with the same h is a no-op', () => {
  const a = createStepper({ ...demo, method: 'verlet', h: 0.01 });
  const b = createStepper({ ...demo, method: 'verlet', h: 0.01 });
  for (let i = 0; i < 5; i++) { a.step(); b.step(); }
  b.setH(0.01);
  a.step(); b.step();
  assert.equal(a.x, b.x);
  // halving h then stepping twice lands close to one step of h, and the gap shrinks
  // like h⁴ (the re-seed is consistent, not just first order)
  const one = a.clone().step();
  const two = a.clone().setH(0.005).step().step();
  near(two.x, one.x, 1e-4);
  near(two.t, one.t, 1e-15);
  const fine = createStepper({ ...demo, method: 'verlet', h: 0.005 });
  for (let i = 0; i < 10; i++) fine.step();
  const gapCoarse = Math.abs(one.x - two.x);
  const gapFine = Math.abs(fine.clone().step().x - fine.clone().setH(0.0025).step().step().x);
  assert.ok(gapCoarse / gapFine > 8, `halving h cut the gap by ${(gapCoarse / gapFine).toFixed(1)}×`);
  // clone carries x_{n−1}: a clone's next step equals the original's
  const c = a.clone();
  a.step(); c.step();
  assert.equal(a.x, c.x); assert.equal(a.v, c.v);
});

test('the controller grows h under tol, shrinks it over tol, and clamps growth and range', () => {
  const ctl = createController({ order: 4, tol: 0.01, hMin: 0.001, hMax: 2 });
  assert.ok(ctl.accepts(0.01) && !ctl.accepts(0.0100001));
  near(ctl.next(0.1, 0.01), 0.09, 1e-12);          // at tol: safety only
  near(ctl.next(0.1, 0.01 / 32), 0.9 * 0.1 * 2, 1e-12); // 32× under: (32)^(1/5) = 2
  assert.equal(ctl.next(0.1, 0), 0.1 * CONTROLLER_DEFAULTS.growMax);
  assert.equal(ctl.next(1, 0), 2);                   // hMax
  assert.equal(ctl.next(0.1, 1e6), 0.1 * CONTROLLER_DEFAULTS.shrinkMin);
  assert.equal(ctl.next(0.001, 1e6), 0.001);         // hMin
});

test('the step-doubling estimate for Euler is h²/4·|a| in x, and the Taylor one is the next term', () => {
  const s = createStepper({ ...demo, method: 'euler', h: 0.01 });
  const h = 0.01, a = -100;
  const { error, next } = estimateByDoubling(s, h, 1, 'x');
  near(error, h * h / 4 * Math.abs(a), 1e-12);
  near(next.t, h, 1e-15);
  assert.equal(s.t, 0); // the original is untouched
  const tay = estimateByTaylor(s, h, 1, demo);
  near(tay.error, localTruncationError({ ...demo, x: 1, v: 0, h, order: 1 }).max, 0);
  near(tay.next.t, h, 1e-15);
});

test('RK4 on the essay parameters at tol = 0.01 grows h well past 1 s', () => {
  const r = runAdaptive({ ...essay, method: 'rk4', tol: 0.01 }, 120);
  assert.ok(r.complete && !r.blewUp);
  assert.ok(r.hPeak > 1.5, `max h reached ${r.hPeak.toFixed(3)} s`);
  assert.ok(r.hPeak < 5, `max h reached ${r.hPeak.toFixed(3)} s; the essay's 16 s does not come from this spring`);
  assert.ok(r.n < 100, `${r.n} steps for 120 s`);
  assert.ok(maxGlobalError(r) < 0.5, `global error ${maxGlobalError(r)}`);
  // h[i] is the step from t[i]
  for (let i = 0; i + 1 < r.n; i++) near(r.t[i + 1] - r.t[i], r.h[i], 1e-12, `step ${i}`);
  near(r.t[r.n - 1], 120, 1e-9);
  assert.ok(Number.isNaN(r.error[r.n - 1]) && r.h[r.n - 1] > 0);
});

test('explicit Euler on the demo parameters stays bounded adaptively where h = 1/30 explodes', () => {
  const fixed = simulate({ ...demo, method: 'euler', h: 1 / 30 }, 12);
  assert.ok(peakAbs(fixed.x) > 1e7);
  const r = runAdaptive({ ...demo, method: 'euler', tol: 0.01 }, 12);
  assert.ok(r.complete);
  const peak = peakAbs(r.x);
  assert.ok(peak < 100, `adaptive Euler peak |x| = ${peak.toFixed(2)} (fixed: ${peakAbs(fixed.x).toExponential(2)})`);
  assert.ok(r.hPeak < 0.05 && r.hPeak > 0.001, `h stayed at ${r.hPeak}`);
  assert.ok(r.rejected > 0);
  // not stable, just slow: it is still outside the Euler disk (h ≤ 0.001 would be inside)
  assert.ok(peak > 1.5, `peak ${peak}`);
});

test('a step that is too big is rejected and retried smaller', () => {
  const r = runAdaptive({ ...essay, method: 'rk4', tol: 0.01, hInit: 4 }, 20);
  assert.ok(r.rejected >= 1);
  assert.ok(r.h[0] < 4 && r.h[0] > 0.5, `first accepted h ${r.h[0]}`);
  assert.equal(r.forced, 0);
  const floor = runAdaptive({ ...demo, method: 'euler', tol: 1e-9, hMin: 0.01, hInit: 0.01 }, 0.1);
  assert.ok(floor.forced > 0 && floor.complete);
  assert.ok(floor.h.every(h => h >= 0.01 - 1e-15));
});

test('a free particle has zero local error, so h runs up to hMax with either estimator', () => {
  for (const estimate of ['doubling', 'taylor']) {
    const r = runAdaptive({ method: 'rk4', tol: 0.01, m: 1, c: 0, k: 0, x0: 0, v0: 1, hMax: 16, estimate }, 200);
    assert.equal(r.hPeak, 16, estimate);
    assert.ok(r.complete && r.rejected === 0);
    near(r.x[r.n - 1], 200, 1e-9);
  }
});

test('every method runs adaptively to completion on the demo parameters', () => {
  for (const method of ['euler', 'rk4', 'implicit', 'semi', 'verlet']) {
    const r = runAdaptive({ ...demo, method, tol: 0.01 }, 6);
    assert.ok(r.complete && !r.blewUp, method);
    assert.ok(peakAbs(r.x) < 100, `${method} peak ${peakAbs(r.x)}`);
    assert.ok(r.attempts === r.n - 1 + r.rejected, method);
  }
  assert.throws(() => runAdaptive({ ...demo, method: 'leapfrog' }, 1));
});

test('a controller that cannot shrink still terminates and reports incomplete', () => {
  const r = runAdaptive({ ...essay, method: 'rk4', tol: 0.01, safety: 1, growMax: Infinity, shrinkMin: 0, maxSteps: 500 }, 120);
  assert.ok(r.attempts <= 500);
  assert.ok(r.n >= 2);
  assert.equal(typeof r.complete, 'boolean');
});
