import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPlayer } from './player.js';
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
