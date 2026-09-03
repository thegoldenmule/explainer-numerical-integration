import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAuxStore, AUX_DEFAULTS, AUX_LIMITS } from './aux.js';

test('aux: documented keys, clamped ranges, integer highlight, nothing else', () => {
  const a = createAuxStore();
  assert.deepEqual(a.get(), AUX_DEFAULTS);
  a.set({ epsilon: 5, tol: 0 });
  assert.equal(a.get().epsilon, AUX_LIMITS.epsilon[1]);
  assert.equal(a.get().tol, AUX_LIMITS.tol[0]);
  a.set({ highlight: 2.6 });
  assert.equal(a.get().highlight, 3);
  a.set({ highlight: -5 });
  assert.equal(a.get().highlight, -1);
  a.set({ highlight: NaN });
  assert.equal(a.get().highlight, -1);
  assert.throws(() => a.set({ speed: 1 }), /unknown aux key/);
  a.reset();
  assert.deepEqual(a.get(), AUX_DEFAULTS);
});
