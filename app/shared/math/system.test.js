import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eigenvalues, regime, exactSolution } from './system.js';

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} expected ${b} got ${a}`);

test('essay parameters: λ = −0.005 ± 0.99999i', () => {
  const [l1, l2] = eigenvalues(10, 0.1, 10);
  near(l1[0], -0.005, 1e-12); near(l1[1], 0.99999, 1e-5);
  near(l2[0], -0.005, 1e-12); near(l2[1], -0.99999, 1e-5);
  assert.equal(regime(10, 0.1, 10), 'underdamped');
});

test('demo parameters: λ = −0.05 ± 10i', () => {
  const [l1] = eigenvalues(1, 0.1, 100);
  near(l1[0], -0.05, 1e-12); near(l1[1], 9.999875, 1e-6); // ω = √(400 − 0.01) / 2
});

test('regime uses a relative tolerance at the critical point', () => {
  assert.equal(regime(1, 2, 1), 'critical');
  assert.equal(regime(1, 2 * (1 + 1e-9), 1), 'critical');
  assert.equal(regime(1, 2.01, 1), 'overdamped');
  assert.equal(regime(1, 1.99, 1), 'underdamped');
  assert.equal(regime(1, 0, 0), 'critical'); // k = c = 0 must not divide by zero
});

test('closed forms per regime, x₀ = 1, v₀ = 0', () => {
  // critical: x = e^{−t}(1 + t)
  near(exactSolution({ m: 1, c: 2, k: 1 }).x(1), 2 / Math.E, 1e-12);
  // overdamped: r = −1, −2 → x = 2e^{−t} − e^{−2t}
  near(exactSolution({ m: 1, c: 3, k: 2 }).x(1), 2 / Math.E - Math.exp(-2), 1e-12);
  // underdamped, undamped limit: x = cos t
  near(exactSolution({ m: 1, c: 0, k: 1 }).x(Math.PI / 3), 0.5, 1e-12);
});

test('v(t) is the derivative of x(t) in every regime', () => {
  for (const p of [{ m: 1, c: 0.1, k: 100 }, { m: 1, c: 2, k: 1 }, { m: 1, c: 3, k: 2 }]) {
    const s = exactSolution({ ...p, x0: 0.7, v0: -1.3 });
    for (const t of [0, 0.37, 2.5]) {
      const eps = 1e-5;
      const fd = (s.x(t + eps) - s.x(t - eps)) / (2 * eps);
      near(s.v(t), fd, 1e-5, `${s.regime} t=${t}`);
    }
    near(s.x(0), 0.7, 1e-12); near(s.v(0), -1.3, 1e-10);
  }
});
