import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MODELS, FORCE_TYPES, createForce, createScene, forceOf, netForce, acceleration, assemble, gravityG } from './forces.js';

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} expected ${b} got ${a}`);

test('drag c and spring k assemble to exactly those coefficients, with M the body mass', () => {
  const scene = createScene({ m: 10, forces: [createForce('drag', { c: 0.1 }), createForce('spring', { k: 10 })] });
  assert.deepEqual(assemble(scene), { M: 10, C: 0.1, K: 10 });
});

test('switched-off forces and constant forces contribute nothing to C and K', () => {
  const scene = createScene({ m: 2, forces: [
    createForce('wind', { fx: 3, fy: 4 }),
    createForce('gravity'),
    createForce('drag', { c: 5, on: false }),
    createForce('spring', { k: 7 }),
  ] });
  assert.deepEqual(assemble(scene), { M: 2, C: 0, K: 7 });
});

test('the linear gravity model equals the real one at the operating point', () => {
  const g = createForce('gravity', { G: 2, m2: 50, r: 4 });
  const body = { m: 3, x: [0, 0], v: [0, 0] };
  const real = forceOf(g, body), linear = forceOf(g, body, { linear: true });
  near(real[0], 0, 1e-12); near(real[1], -3 * 2 * 50 / 16, 1e-12);
  near(linear[0], real[0], 1e-12); near(linear[1], real[1], 1e-12);
  near(gravityG(g), 100 / 16, 1e-12);
  // Away from the operating point the real model changes and the linear one does not.
  const closer = { ...body, x: [0, -2] };
  near(forceOf(g, closer)[1], -3 * 2 * 50 / 4, 1e-12);
  near(forceOf(g, closer, { linear: true })[1], linear[1], 1e-12);
  // Off the vertical, the real force points at the attractor.
  const aside = { ...body, x: [3, 0] };
  const F = forceOf(g, aside), d = Math.hypot(3, 4);
  near(F[0] / F[1], 3 / 4, 1e-12);
  near(Math.hypot(F[0], F[1]), 3 * 2 * 50 / (d * d), 1e-12);
});

test('netForce sums the active forces and acceleration divides by m', () => {
  const scene = createScene({ m: 2, x: [1, 0], v: [0, 3], forces: [
    createForce('wind', { fx: 1, fy: 0 }),
    createForce('spring', { k: 4 }),
    createForce('drag', { c: 0.5 }),
    createForce('gravity', { G: 1, m2: 10, r: 1, on: false }),
  ] });
  assert.deepEqual(netForce(scene), [1 - 4, -1.5]);
  assert.deepEqual(netForce(scene, { linear: true }), [-3, -1.5]);
  assert.deepEqual(acceleration(scene), [-1.5, -0.75]);
});

test('every model has defaults, both functions, and coefficients; unknown types throw', () => {
  for (const type of FORCE_TYPES) {
    const f = createForce(type);
    assert.equal(f.on, true);
    for (const key of Object.keys(MODELS[type].defaults)) assert.equal(f[key], MODELS[type].defaults[key]);
    const body = { m: 1, x: [0.5, 0.25], v: [1, -1] };
    for (const linear of [false, true]) {
      const F = forceOf(f, body, { linear });
      assert.equal(F.length, 2);
      assert.ok(Number.isFinite(F[0]) && Number.isFinite(F[1]));
    }
    const co = MODELS[type].coefficients(f);
    assert.ok('C' in co && 'K' in co);
  }
  assert.throws(() => createForce('magnetism'));
  assert.throws(() => forceOf({ type: 'lift' }, { m: 1, x: [0, 0], v: [0, 0] }));
});

test('createScene copies its inputs so the scene is independent data', () => {
  const x = [1, 2], f = createForce('drag');
  const scene = createScene({ x, forces: [f] });
  x[0] = 9; f.c = 9;
  assert.deepEqual(scene.body.x, [1, 2]);
  assert.equal(scene.forces[0].c, 0.1);
});
