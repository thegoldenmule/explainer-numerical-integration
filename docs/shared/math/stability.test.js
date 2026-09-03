import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ampFactor, amplification, taylorAmplification, doublingTime, updateMatrix, spectralRadius, stabilityReport, updateMatrixNormalized, spectralRadiusNormalized } from './stability.js';
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

test('taylorAmplification: degree 1 is explicit Euler, degree 4 is RK4, degree 0 is 1', () => {
  for (const z of [[0.1, 0.3], [-3, 2], [-0.05 / 30, 10 / 30], [-1.9, 2.8]]) {
    const e = amplification('euler', z), t1 = taylorAmplification(z, 1);
    near(t1[0], e[0], 1e-12); near(t1[1], e[1], 1e-12);
    const r = amplification('rk4', z), t4 = taylorAmplification(z, 4);
    near(t4[0], r[0], 1e-12); near(t4[1], r[1], 1e-12);
  }
  assert.deepEqual(taylorAmplification([5, 5], 0), [1, 0]);
  // degree 2 on the imaginary axis: |1 + iy − y²/2| > 1 for every y ≠ 0 (RK2 has no imaginary-axis stability)
  assert.ok(Math.hypot(...taylorAmplification([0, 0.5], 2)) > 1);
});

test('normalized (hω, ζ): ρ is a similarity invariant, so it matches every (m, c, k, h) with the same hω, ζ', () => {
  const cases = [[1, 0.1, 100, 0.19], [10, 0.1, 10, 1 / 30], [2, 3, 5, 0.4], [0.5, 0.2, 40, 0.05], [1, 4, 4, 0.3]];
  for (const [m, c, k, h] of cases) {
    const hw = h * Math.sqrt(k / m), zeta = c / (2 * Math.sqrt(m * k));
    for (const method of ['euler', 'rk4', 'implicit', 'semi', 'verlet']) {
      const direct = spectralRadius(updateMatrix(method, { m, c, k, h }));
      near(spectralRadiusNormalized(method, hw, zeta), direct, 1e-10 * Math.max(1, direct), `${method} ${[m, c, k, h]}`);
    }
  }
});

test('normalized: semi-implicit Euler and Verlet cross ρ = 1 at hω = 2 with ζ = 0', () => {
  for (const method of ['semi', 'verlet']) {
    near(spectralRadiusNormalized(method, 1.0, 0), 1, 1e-12, `${method} inside the wall`);
    near(spectralRadiusNormalized(method, 1.99, 0), 1, 1e-12, `${method} just inside`);
    assert.ok(spectralRadiusNormalized(method, 2.01, 0) > 1.05, `${method} just outside`);
    assert.ok(spectralRadiusNormalized(method, 3, 0) > 2, `${method} well outside`);
  }
  // the h = 0.19 / 0.20 confirmation at k/m = 100 (ω = 10, ζ = 0.005) through the normalized form
  near(spectralRadiusNormalized('semi', 1.9, 0.005), 0.990, 2e-3);
  near(spectralRadiusNormalized('semi', 2.0, 0.005), 1.21, 2e-2);
  const M = updateMatrixNormalized('verlet', 1.9, 0.005);
  assert.equal(M.length, 2);
});
