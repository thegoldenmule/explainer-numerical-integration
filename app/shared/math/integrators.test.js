import { test } from 'node:test';
import assert from 'node:assert/strict';
import { simulate, createStepper, METHOD_IDS, EXPLICIT_METHODS } from './integrators.js';
import { exactSolution } from './system.js';

const essay = { m: 10, c: 0.1, k: 10, x0: 1, v0: 0 };
const demo = { m: 1, c: 0.1, k: 100, x0: 1, v0: 0 };
const at = (run, t) => run.x[Math.round(t / (run.t[1] - run.t[0]))];

test('every integrator starts at (x₀, v₀) and advances t by h', () => {
  for (const method of METHOD_IDS) {
    const s = createStepper({ ...demo, method, h: 0.01 });
    assert.equal(s.x, 1); assert.equal(s.v, 0); assert.equal(s.t, 0);
    s.step();
    assert.ok(Math.abs(s.t - 0.01) < 1e-15);
  }
});

test('explicit Euler at h = 1/30 on the essay parameters grows to about −1.93 at t = 60', () => {
  const run = simulate({ ...essay, method: 'euler', h: 1 / 30 }, 60);
  const x60 = at(run, 60);
  assert.ok(x60 < -1.8 && x60 > -2.1, `x(60) = ${x60}`);
  assert.ok(Math.abs(run.exact[run.n - 1] - -0.71) < 0.02);
});

test('explicit Euler on the demo parameters reaches ~1e8 by t = 12', () => {
  const run = simulate({ ...demo, method: 'euler', h: 1 / 30 }, 12);
  assert.ok(Math.abs(at(run, 12)) > 1e7);
});

test('RK4 at h = 1/30 tracks the exact solution through 600 s', () => {
  const run = simulate({ ...essay, method: 'rk4', h: 1 / 30 }, 600);
  let maxErr = 0;
  for (let i = 0; i < run.n; i++) maxErr = Math.max(maxErr, Math.abs(run.x[i] - run.exact[i]));
  assert.ok(maxErr < 1e-3, `max error ${maxErr}`);
});

test('implicit Euler never explodes but over-damps: 0.26 vs exact 0.71 at t = 60', () => {
  const run = simulate({ ...essay, method: 'implicit', h: 1 / 30 }, 60);
  const x60 = Math.abs(at(run, 60));
  assert.ok(x60 > 0.2 && x60 < 0.3, `|x(60)| = ${x60}`);
  assert.ok(Math.abs(Math.abs(run.exact[run.n - 1]) - 0.71) < 0.02);
  const long = simulate({ ...demo, method: 'implicit', h: 0.5 }, 100);
  assert.ok(Math.abs(long.x[long.n - 1]) < 1);
});

test('semi-implicit Euler and Verlet stay bounded at h = 1/30 on the demo parameters', () => {
  for (const method of ['semi', 'verlet']) {
    const run = simulate({ ...demo, method, h: 1 / 30 }, 12);
    const peak = Math.max(...run.x.map(Math.abs));
    assert.ok(peak < 1.5, `${method} peak ${peak}`);
  }
});

test('Verlet is seeded with the exact x(−h) and converges faster than first order', () => {
  const sol = exactSolution(demo);
  const errAt = h => {
    const run = simulate({ ...demo, method: 'verlet', h }, 1);
    return Math.abs(run.x[run.n - 1] - sol.x(1));
  };
  const first = simulate({ ...demo, method: 'verlet', h: 0.01 }, 1);
  assert.ok(Math.abs(first.x[1] - sol.x(0.01)) < 1e-4);
  assert.ok(errAt(0.01) < 5e-3, `error at h=0.01: ${errAt(0.01)}`);
  const ratio = errAt(0.02) / errAt(0.01);
  assert.ok(ratio > 2.5, `halving h cut the error by only ${ratio.toFixed(2)}×`);
});

test('a custom accel equal to the linear one reproduces the default run exactly', () => {
  const { m, c, k } = demo;
  const linear = (x, v) => -(c * v + k * x) / m;
  for (const method of ['euler', 'rk4', 'semi']) {
    const a = simulate({ ...demo, method, h: 1 / 30 }, 3);
    const b = simulate({ ...demo, method, h: 1 / 30, accel: linear }, 3);
    assert.equal(a.n, b.n);
    for (let i = 0; i < a.n; i++) {
      assert.equal(b.x[i], a.x[i], `${method} x[${i}]`);
      assert.equal(b.v[i], a.v[i], `${method} v[${i}]`);
    }
    assert.equal(a.hasExact, true);
    assert.equal(b.hasExact, false);
    assert.ok(Number.isNaN(b.exact[0]) && Number.isNaN(b.exact[b.n - 1]), 'exact is NaN with a custom accel');
    assert.equal(b.exact.length, b.n);
  }
});

test('a custom accel sees t (rk4 stage times) and survives clone and setH', () => {
  const seen = [];
  const s = createStepper({ method: 'rk4', h: 0.1, m: 1, c: 0, k: 0, accel: (x, v, t) => { seen.push(t); return 0; } });
  s.step();
  assert.deepEqual(seen.map(t => +t.toFixed(12)), [0, 0.05, 0.05, 0.1]);
  const forced = createStepper({ method: 'euler', h: 0.5, m: 1, c: 0, k: 0, accel: () => 2 });
  forced.step().step();
  assert.equal(forced.v, 2, 'v = a t with a = 2, t = 1');
  const copy = forced.clone().setH(0.25).step();
  assert.equal(copy.v, 2.5, 'the clone keeps the custom accel');
  assert.equal(forced.v, 2);
});

test('implicit Euler and Verlet refuse a custom accel', () => {
  for (const method of ['implicit', 'verlet']) {
    assert.throws(() => createStepper({ ...demo, method, h: 0.01, accel: () => 0 }), /linear system only/);
    assert.throws(() => simulate({ ...demo, method, h: 0.01, accel: () => 0 }, 1), /linear system only/);
  }
  assert.deepEqual(EXPLICIT_METHODS, ['euler', 'rk4', 'semi']);
});
