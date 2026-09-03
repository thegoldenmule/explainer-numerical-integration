import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eigenvalues, regime, exactSolution, paramsFromEigenvalue, exactFromEigenvalue } from './system.js';

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

test('paramsFromEigenvalue inverts eigenvalues for a conjugate pair', () => {
  for (const p of [{ m: 1, c: 0.1, k: 100 }, { m: 10, c: 0.1, k: 10 }, { m: 2.5, c: 1.7, k: 30 }]) {
    const [l1] = eigenvalues(p.m, p.c, p.k);
    const { c, k } = paramsFromEigenvalue(p.m, l1);
    near(c, p.c, 1e-9, 'c'); near(k, p.k, 1e-9, 'k');
    const [r1, r2] = eigenvalues(p.m, c, k);
    near(r1[0], l1[0], 1e-9); near(r1[1], l1[1], 1e-9); near(r2[1], -l1[1], 1e-9);
  }
  // a real λ comes back as the critically damped system with λ as a double root
  const { c, k } = paramsFromEigenvalue(2, [-3, 0]);
  assert.equal(regime(2, c, k), 'critical');
  near(eigenvalues(2, c, k)[0][0], -3, 1e-12);
  // Re λ > 0 asks for negative drag; the store clamps that, not the math
  assert.ok(paramsFromEigenvalue(1, [0.5, 1]).c < 0);
});

test('exactFromEigenvalue matches exactSolution for the same system', () => {
  const p = { m: 10, c: 0.1, k: 10, x0: 0.6, v0: -0.4 };
  const direct = exactSolution(p);
  const viaLambda = exactFromEigenvalue({ m: p.m, lambda: eigenvalues(p.m, p.c, p.k)[0], x0: p.x0, v0: p.v0 });
  assert.equal(viaLambda.regime, 'underdamped');
  for (const t of [0, 1.3, 7]) { near(viaLambda.x(t), direct.x(t), 1e-9); near(viaLambda.v(t), direct.v(t), 1e-9); }
  // pure imaginary λ: undamped cosine
  near(exactFromEigenvalue({ lambda: [0, 2] }).x(Math.PI / 4), 0, 1e-12);
});
