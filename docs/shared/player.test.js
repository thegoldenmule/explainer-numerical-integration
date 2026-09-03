import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPlayer, benchmarkStep, stepCost, clearStepCosts, TIMER_RESOLUTION_MS } from './player.js';
import { createStore } from './state.js';
import { ampFactor } from './math/stability.js';
import { eigenvalues } from './math/system.js';
import { cscale } from './math/complex.js';

// a loop we tick by hand
function fakeLoop() {
  const cbs = new Set();
  return { onFrame(cb) { cbs.add(cb); return () => cbs.delete(cb); }, tick(dt) { for (const cb of cbs) cb(dt, 0); } };
}

test('player starts at t = 0, advances by wall-clock time at h, and writes t silently', () => {
  const store = createStore();
  const loop = fakeLoop();
  const seen = [];
  store.subscribe((s, p) => seen.push(p), { immediate: false });
  const player = createPlayer({ store, loop });
  assert.equal(player.n, 1);
  assert.equal(player.series.x[0], 1);
  loop.tick(0.5);                       // 0.5 s at h = 1/30 → 15 steps
  assert.equal(player.n, 16);
  assert.ok(Math.abs(store.get().t - 0.5) < 1e-9);
  assert.equal(seen.length, 0, 't is silent');
  const s = player.series;
  assert.equal(s.err.length, 16);
  assert.ok(Math.abs(s.x[15] - s.exact[15]) === s.err[15]);
});

test('player restarts on any tuple change but not on t, and step() pauses', () => {
  const store = createStore();
  const loop = fakeLoop();
  const player = createPlayer({ store, loop });
  loop.tick(1);
  assert.ok(player.n > 20);
  store.set({ t: 99 }, { silent: true });
  assert.ok(player.n > 20, 't alone does not restart');
  store.set({ method: 'rk4' });
  assert.equal(player.n, 1, 'method change restarts');
  assert.equal(store.get().t, 0);
  player.step();
  assert.equal(player.playing, false);
  assert.equal(player.n, 2);
  loop.tick(1);
  assert.equal(player.n, 2, 'paused: frames do nothing');
  player.play();
  loop.tick(1);
  assert.ok(player.n > 2);
});

test('a tiny h is capped per frame instead of stalling', () => {
  const store = createStore({ ...createStore().get(), h: 0.001 });
  const loop = fakeLoop();
  const player = createPlayer({ store, loop, maxStepsPerFrame: 100 });
  loop.tick(10);                        // would be 10 000 steps
  assert.equal(player.n, 101);
});

test('measured error growth on the demo parameters matches |1 + hλ| for explicit Euler', () => {
  const store = createStore();          // euler, h = 1/30, m=1 c=0.1 k=100
  const loop = fakeLoop();
  const player = createPlayer({ store, loop, maxStepsPerFrame: 10000 });
  loop.tick(8);
  const g = player.growth();
  const expected = ampFactor('euler', cscale(eigenvalues(1, 0.1, 100)[0], 1 / 30));
  assert.ok(g, 'growth available');
  assert.ok(Math.abs(g.ratio - expected) < 5e-3, `ratio ${g.ratio} vs |R| ${expected}`);
  assert.ok(g.doublingTime > 0.4 && g.doublingTime < 0.6, `doubling ${g.doublingTime}`);
});

test('benchmarkStep times a warmed batch that clears the timer resolution by a wide margin', () => {
  // a fake clock that ticks a fraction of the resolution per call (a binary-exact one, so
  // the sum is exact), so the batch loop has to run many batches before minMs is reached
  // and the count is deterministic
  const quantum = 1 / 16;   // ms
  let ticks = 0;
  const now = () => ++ticks * quantum;
  const state = createStore().get();
  const r = benchmarkStep(state, { now, minMs: 4, batch: 5000, warmup: 100 });
  const batches = 4 / quantum;                      // 64
  assert.equal(r.steps, batches * 5000);
  assert.equal(r.ms, 4);
  assert.ok(r.ms >= 40 * TIMER_RESOLUTION_MS, 'the batch is far above the resolution');
  assert.ok(Math.abs(r.perStep - r.ms / r.steps) < 1e-18);
  // maxSteps caps a run that never reaches minMs
  const capped = benchmarkStep(state, { now: () => 0, minMs: 4, batch: 1000, warmup: 0, maxSteps: 3000 });
  assert.equal(capped.steps, 3000);
  assert.equal(capped.perStep, 0);
});

test('benchmarkStep on the real clock is sub-microsecond per step for every method', () => {
  for (const method of ['euler', 'rk4', 'implicit', 'semi', 'verlet']) {
    const r = benchmarkStep({ ...createStore().get(), method }, { minMs: 1 });
    assert.ok(r.perStep > 0 && r.perStep < 1e-2, `${method}: ${r.perStep} ms per step`);
    assert.ok(r.ms >= 1, `${method}: timed ${r.ms} ms`);
  }
});

test('stepCost memoizes per method and h', () => {
  clearStepCosts();
  const state = createStore().get();
  const a = stepCost(state);
  assert.equal(stepCost({ ...state, k: 5 }), a, 'k does not change the key');
  assert.notEqual(stepCost({ ...state, h: state.h * 2 }), a);
  assert.notEqual(stepCost({ ...state, method: 'rk4' }), a);
  assert.equal(stepCost(state), a);
  clearStepCosts();
});

test('player cost is the benchmark times the steps of the frame, re-run only when method or h change', () => {
  const store = createStore();
  const loop = fakeLoop();
  const calls = [];
  const benchmark = state => { calls.push(`${state.method}/${state.h}`); return { perStep: 2e-6, steps: 1000, ms: 2e-3 }; };
  const player = createPlayer({ store, loop, benchmark });
  assert.equal(calls.length, 0, 'lazy: nothing measured until cost is read');
  let c = player.cost;
  assert.equal(calls.length, 1);
  assert.equal(c.perStep, 2e-6);
  assert.equal(c.steps, 0);
  assert.equal(c.perFrame, 0);
  loop.tick(0.5);                       // 15 steps at h = 1/30
  c = player.cost;
  assert.equal(c.steps, 15);
  assert.ok(Math.abs(c.perFrame - 15 * 2e-6) < 1e-18, 'perFrame = perStep × steps');
  assert.deepEqual(c.benchmark, { steps: 1000, ms: 2e-3 });
  assert.equal(c.timer.resolution, TIMER_RESOLUTION_MS);
  assert.ok(Number.isFinite(c.timer.perFrame) && Number.isFinite(c.timer.perStep), 'the raw timing is still reported');
  loop.tick(0.5); player.cost;
  assert.equal(calls.length, 1, 'frames never re-run the benchmark');
  store.set({ k: 50 }); player.cost;
  assert.equal(calls.length, 1, 'a restart that keeps method and h reuses the measurement');
  store.set({ h: 0.05 }); player.cost;
  assert.equal(calls.length, 2, 'h changed');
  store.set({ method: 'rk4' });
  assert.equal(calls.length, 2, 'still lazy after the change');
  player.cost;
  assert.equal(calls.length, 3, 'method changed');
  assert.deepEqual(calls, ['euler/0.03333333333333333', 'euler/0.05', 'rk4/0.05']);
});
