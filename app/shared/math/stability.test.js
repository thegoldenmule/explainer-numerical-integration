import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ampFactor, doublingTime, updateMatrix, spectralRadius, stabilityReport } from './stability.js';
import { eigenvalues } from './system.js';
import { cscale } from './complex.js';

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} expected ${b} got ${a}`);

test('explicit Euler at h = 1/30 on the essay parameters: |1 + hλ| = 1.0004, doubling ~59 s', () => {
  const z = cscale(eigenvalues(10, 0.1, 10)[0], 1 / 30);
  const rho = ampFactor('euler', z);
  near(rho, 1.0004, 5e-5);
  near(doublingTime(1 / 30, rho), 59, 1.5);
});

test('explicit Euler on the demo parameters: |1 + hλ| = 1.0525, doubling ~0.5 s', () => {
  const z = cscale(eigenvalues(1, 0.1, 100)[0], 1 / 30);
  const rho = ampFactor('euler', z);
  near(rho, 1.0525, 5e-5);
  const d = doublingTime(1 / 30, rho);
  assert.ok(d > 0.4 && d < 0.55, `doubling time ${d}`);
});

test('RK4 and implicit Euler are stable at the demo point; RK4 fails at hλ ≈ 2.8i', () => {
  const z = cscale(eigenvalues(1, 0.1, 100)[0], 1 / 30);
  assert.ok(ampFactor('rk4', z) < 1);
  assert.ok(ampFactor('implicit', z) < 1);
  near(ampFactor('rk4', cscale(eigenvalues(1, 0.1, 100)[0], 0.2)), 0.735, 5e-3); // from idea.md
  assert.ok(ampFactor('rk4', [0, 2.9]) > 1); // RK4's imaginary-axis limit is ≈ 2.83
  assert.ok(ampFactor('rk4', [0, 2.7]) < 1);
});

test('methods without a scalar R return NaN', () => {
  assert.ok(Number.isNaN(ampFactor('semi', [0.1, 0.1])));
  assert.ok(Number.isNaN(ampFactor('verlet', [0.1, 0.1])));
});

test('spectral radius of the 2×2 update agrees with |R(hλ)| where both exist', () => {
  for (const p of [{ m: 10, c: 0.1, k: 10, h: 1 / 30 }, { m: 1, c: 0.1, k: 100, h: 0.2 }, { m: 1, c: 3, k: 2, h: 0.5 }]) {
    const ls = eigenvalues(p.m, p.c, p.k);
    for (const method of ['euler', 'rk4', 'implicit']) {
      const expected = Math.max(...ls.map(l => ampFactor(method, cscale(l, p.h))));
      near(spectralRadius(updateMatrix(method, p)), expected, 1e-9, `${method} ${JSON.stringify(p)}`);
    }
  }
});

test('semi-implicit Euler hits the hω < 2 wall between h = 0.19 and 0.20 at k/m = 100', () => {
  const at = h => spectralRadius(updateMatrix('semi', { m: 1, c: 0.1, k: 100, h }));
  near(at(0.19), 0.990, 2e-3);
  near(at(0.20), 1.21, 2e-2);
  assert.ok(at(1 / 30) <= 1);
});

test('Verlet is also bounded by the hω < 2 wall', () => {
  const at = h => spectralRadius(updateMatrix('verlet', { m: 1, c: 0.1, k: 100, h }));
  assert.ok(at(1 / 30) <= 1);
  assert.ok(at(0.19) <= 1.001);
  assert.ok(at(0.25) > 1);
});

test('stabilityReport bundles the verdict', () => {
  const r = stabilityReport('euler', { m: 1, c: 0.1, k: 100, h: 1 / 30 });
  assert.equal(r.stable, false);
  assert.equal(r.method.label, 'Explicit Euler');
  assert.equal(r.lambdas.length, 2);
  assert.ok(r.doublingTime < 1);
  assert.equal(stabilityReport('rk4', { m: 1, c: 0.1, k: 100, h: 1 / 30 }).stable, true);
});
