import { test } from 'node:test';
import assert from 'node:assert/strict';
import { expCoefficients, expPartialSum, expTerms, expPartialSums, inverseSquareExpansion, derivatives, truncationTerm, localTruncationError } from './taylor.js';
import { amplification } from './stability.js';
import { exactSolution } from './system.js';

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} expected ${b} got ${a}`);

test('partial sums of e^x converge to Math.exp', () => {
  assert.deepEqual(expCoefficients(4), [1, 1, 1 / 2, 1 / 6, 1 / 24]);
  for (const x of [-2, -0.5, 0.3, 1, 2.5]) {
    let prev = Infinity;
    for (const n of [1, 2, 4, 8, 16]) {
      const err = Math.abs(expPartialSum(x, n) - Math.exp(x));
      assert.ok(err <= prev + 1e-15, `x=${x} n=${n} err ${err} > ${prev}`);
      prev = err;
    }
    near(expPartialSum(x, 30), Math.exp(x), 1e-12, `x=${x}`);
    const sums = expPartialSums(x, 6);
    assert.equal(sums.length, 7);
    near(sums[6], expPartialSum(x, 6), 1e-14);
    near(expTerms(x, 6).reduce((a, b) => a + b), sums[6], 1e-14);
  }
  near(expPartialSum(0.1, 1), 1.1, 1e-15); // Euler
});

test('the degree-1 and degree-4 sums are Euler and RK4 amplification on the real axis', () => {
  for (const x of [-2.5, -1, -0.1, 0.4]) {
    near(expPartialSum(x, 1), amplification('euler', [x, 0])[0], 1e-14);
    near(expPartialSum(x, 4), amplification('rk4', [x, 0])[0], 1e-14);
    near(amplification('rk4', [x, 0])[1], 0, 1e-15);
  }
});

test('the 1/r² expansion matches to second order near r₀', () => {
  const r0 = 10, e = inverseSquareExpansion(r0, 2);
  near(e.coefficients[0], 1 / 100, 1e-15);
  near(e.coefficients[1], -2 / 1000, 1e-15);
  near(e.coefficients[2], 3 / 10000, 1e-15);
  near(e.evaluate(r0), 1 / (r0 * r0), 1e-15);
  const d = 0.1;
  const err2 = Math.abs(e.evaluate(r0 + d) - 1 / (r0 + d) ** 2);
  const err1 = Math.abs(inverseSquareExpansion(r0, 1).evaluate(r0 + d) - 1 / (r0 + d) ** 2);
  const err0 = Math.abs(inverseSquareExpansion(r0, 0).evaluate(r0 + d) - 1 / (r0 + d) ** 2);
  assert.ok(err2 < 5 * Math.abs(e.coefficients[2]) * d ** 3, `second-order remainder ${err2}`); // next term is 4 δ³/r₀⁵
  assert.ok(err1 > err2 && err0 > err1);
  // halving δ cuts the degree-2 remainder by about 8×
  const errHalf = Math.abs(e.evaluate(r0 + d / 2) - 1 / (r0 + d / 2) ** 2);
  near(err2 / errHalf, 8, 0.3);
  assert.equal(e.terms(r0 + d).length, 3);
  near(inverseSquareExpansion(r0, 12).evaluate(r0 + 1), 1 / 121, 1e-12);
});

test('derivatives from the equation agree with the closed form', () => {
  const p = { m: 10, c: 0.1, k: 10 };
  const sol = exactSolution({ ...p, x0: 1, v0: 0 });
  const t = 0.7, x = sol.x(t), v = sol.v(t);
  const d = derivatives(p.m, p.c, p.k, x, v, 4);
  assert.equal(d.length, 5);
  near(d[0], x, 0); near(d[1], v, 0);
  const eps = 1e-3;
  near(d[2], (sol.v(t + eps) - sol.v(t - eps)) / (2 * eps), 1e-6);
  near(d[3], (sol.v(t + eps) - 2 * sol.v(t) + sol.v(t - eps)) / (eps * eps), 1e-5);
});

test("Euler's local truncation error is h²/2 · |a|; order p is h^{p+1}/(p+1)! · |x^{(p+1)}|", () => {
  const p = { m: 1, c: 0.1, k: 100 };
  const a = -(0.1 * 0 + 100 * 1) / 1;
  const e1 = localTruncationError({ ...p, x: 1, v: 0, h: 0.02, order: 1 });
  near(e1.x, 0.02 ** 2 / 2 * Math.abs(a), 1e-15);
  const d = derivatives(p.m, p.c, p.k, 1, 0, 6);
  const e4 = localTruncationError({ ...p, x: 1, v: 0, h: 0.1, order: 4 });
  near(e4.x, 0.1 ** 5 / 120 * Math.abs(d[5]), 1e-15);
  near(e4.v, 0.1 ** 5 / 120 * Math.abs(d[6]), 1e-15);
  assert.equal(e4.max, Math.max(e4.x, e4.v));
  near(truncationTerm(1, 0.5, 4), 0.5, 1e-15);
});
