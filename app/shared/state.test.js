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
