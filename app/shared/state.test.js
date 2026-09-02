import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore, DEFAULTS } from './state.js';

test('store: set merges, clamps, notifies with the patch only', () => {
  const s = createStore();
  const seen = [];
  const off = s.subscribe((state, patch) => seen.push(patch), { immediate: false });
  s.set({ h: 0.2, k: 5000 });
  assert.equal(s.get().h, 0.2);
  assert.equal(s.get().k, 2000, 'clamped to LIMITS');
  assert.deepEqual(seen, [{ h: 0.2, k: 2000 }]);
  s.set({ h: 0.2 });
  assert.equal(seen.length, 1, 'no notification when nothing changed');
  s.set({ t: 3 }, { silent: true });
  assert.equal(s.get().t, 3);
  assert.equal(seen.length, 1, 'silent patches do not notify');
  off();
  s.set({ m: 2 });
  assert.equal(seen.length, 1);
  assert.throws(() => s.set({ method: 'nope' }));
  assert.throws(() => s.set({ bogus: 1 }));
  assert.ok(Object.isFrozen(s.get()));
});

test('store: reset and presets', () => {
  const s = createStore();
  s.preset('essay');
  assert.deepEqual([s.get().m, s.get().c, s.get().k], [10, 0.1, 10]);
  s.reset();
  assert.deepEqual(s.get(), DEFAULTS);
});

test('createStore with its own schema: limits clamp, validate cleans other keys, unknown keys throw', () => {
  const s = createStore({ n: 1, name: 'a', list: [] }, {
    limits: { n: [0, 10] },
    validate: (key, value) => {
      if (key === 'name') return String(value);
      if (key === 'list') return Array.isArray(value) ? Object.freeze([...value]) : undefined;
      throw new Error(`unknown: ${key}`);
    },
    presets: { big: { n: 9 } },
  });
  s.set({ n: 50, name: 42, list: 'not a list' });
  assert.equal(s.get().n, 10);
  assert.equal(s.get().name, '42');
  assert.deepEqual(s.get().list, [], 'validate returning undefined skips the key');
  assert.throws(() => s.set({ other: 1 }));
  assert.throws(() => s.preset('nope'));
  s.preset('big');
  assert.equal(s.get().n, 9);
  s.reset();
  assert.deepEqual(s.get(), { n: 1, name: 'a', list: [] });
  assert.deepEqual(s.limits, { n: [0, 10] });
});

test('the default store still is the tuple store', () => {
  const s = createStore();
  assert.deepEqual(s.get(), DEFAULTS);
  assert.equal(s.limits.h[1], 0.5);
  assert.throws(() => s.set({ method: 'nope' }), /unknown integrator/);
  assert.throws(() => s.set({ bogus: 1 }), /unknown state key/);
  s.set({ method: 'rk4' });
  assert.equal(s.get().method, 'rk4');
});
