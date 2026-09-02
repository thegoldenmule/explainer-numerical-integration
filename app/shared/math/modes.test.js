import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decompose, project, reconstruct, modalStep, modalFactors, simulateModal } from './modes.js';
import { createStepper } from './integrators.js';
import { cabs } from './complex.js';

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} expected ${b} got ${a}`);
const demo = { m: 1, c: 0.1, k: 100 };

test('eigenvectors are (1, λ): A (1, λ) = λ (1, λ)', () => {
  const { lambdas, vectors } = decompose(demo.m, demo.c, demo.k);
  for (let i = 0; i < 2; i++) {
    const [one, l] = vectors[i];
    assert.deepEqual(one, [1, 0]);
    assert.deepEqual(l, lambdas[i]);
    // second row of A v: −k/m · 1 − c/m · λ should equal λ · λ
    const re = -demo.k / demo.m - demo.c / demo.m * l[0], im = -demo.c / demo.m * l[1];
    near(re, l[0] * l[0] - l[1] * l[1], 1e-9); near(im, 2 * l[0] * l[1], 1e-9);
  }
});

test('project then reconstruct round-trips in every non-defective regime', () => {
  for (const p of [demo, { m: 10, c: 0.1, k: 10 }, { m: 1, c: 3, k: 2 }, { m: 1, c: 0, k: 1 }]) {
    const modes = decompose(p.m, p.c, p.k);
    assert.equal(modes.defective, false);
    for (const [x, v] of [[1, 0], [0.3, -2.5], [-1, 7]]) {
      const s = reconstruct(modes, project(modes, x, v));
      near(s.x, x, 1e-12, JSON.stringify(p)); near(s.v, v, 1e-10, JSON.stringify(p));
    }
  }
  // underdamped coefficients are a conjugate pair
  const modes = decompose(demo.m, demo.c, demo.k);
  const [a1, a2] = project(modes, 1, 0);
  near(a1[0], a2[0], 1e-12); near(a1[1], -a2[1], 1e-12);
});

test('the critical regime is defective and projects to NaN instead of throwing', () => {
  const modes = decompose(1, 2, 1);
  assert.equal(modes.defective, true);
  const [a1] = project(modes, 1, 0);
  assert.ok(Number.isNaN(a1[0]));
});

test('iterating the modal step reconstructs the stepper trajectory for every scalar-R method', () => {
  const h = 1 / 30;
  for (const method of ['euler', 'rk4', 'implicit']) {
    for (const p of [demo, { m: 10, c: 0.1, k: 10 }, { m: 1, c: 3, k: 2 }]) {
      const modes = decompose(p.m, p.c, p.k);
      const s = createStepper({ ...p, method, h, x0: 1, v0: 0 });
      let a = project(modes, 1, 0);
      for (let i = 0; i < 300; i++) {
        s.step();
        a = modalStep(method, h, modes, a);
        const r = reconstruct(modes, a);
        const scale = Math.max(1, Math.abs(s.x), Math.abs(s.v));
        near(r.x / scale, s.x / scale, 1e-9, `${method} x step ${i + 1}`);
        near(r.v / scale, s.v / scale, 1e-9, `${method} v step ${i + 1}`);
      }
    }
  }
});

test('|R(hλ)| for Euler on the demo point is the 1.0525 from the confirmations', () => {
  const modes = decompose(demo.m, demo.c, demo.k);
  const [R] = modalFactors('euler', 1 / 30, modes);
  near(cabs(R), 1.0525, 5e-5);
  assert.throws(() => modalStep('verlet', 1 / 30, modes, project(modes, 1, 0)));
});

test('simulateModal matches simulate-by-stepper and reports coefficient magnitudes', () => {
  const run = simulateModal({ ...demo, method: 'euler', h: 1 / 30, x0: 1, v0: 0 }, 2);
  const s = createStepper({ ...demo, method: 'euler', h: 1 / 30, x0: 1, v0: 0 });
  assert.equal(run.n, 61);
  for (let i = 0; i < run.n; i++) {
    near(run.x[i], s.x, 1e-9 * Math.max(1, Math.abs(s.x)), `step ${i}`);
    s.step();
  }
  assert.ok(run.magnitudes[60] > run.magnitudes[0]);
  const rho = cabs(modalFactors('euler', 1 / 30, run.modes)[0]);
  near(run.magnitudes[60] / run.magnitudes[0], rho ** 60, 1e-9);
});
