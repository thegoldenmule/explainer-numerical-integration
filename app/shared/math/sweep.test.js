import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sweep, sweepRange, sweepKey, createSweeper, nearestIndex, clearSweeps } from './sweep.js';

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} expected ${b} got ${a}`);

test('the callback runs once per value per key and not again on a repeat with the same key', () => {
  const { sweep } = createSweeper();
  let calls = 0;
  const fn = v => { calls++; return v * 2; };
  const values = [1, 2, 3];
  const key = sweepKey({ method: 'euler', m: 1, c: 0.1, k: 100 });
  const first = sweep(values, fn, { key });
  assert.equal(calls, 3);
  assert.deepEqual(first, [{ value: 1, result: 2 }, { value: 2, result: 4 }, { value: 3, result: 6 }]);
  const again = sweep([1, 2, 3], fn, { key });
  assert.equal(calls, 3);
  assert.equal(again, first);
  // a different key reruns
  sweep(values, fn, { key: sweepKey({ method: 'rk4', m: 1, c: 0.1, k: 100 }) });
  assert.equal(calls, 6);
  // the same key with different values reruns too
  const other = sweep([1, 2, 3, 4], fn, { key });
  assert.equal(calls, 10);
  assert.notEqual(other, first);
  // no key: never memoized
  sweep(values, fn); sweep(values, fn);
  assert.equal(calls, 16);
});

test('the cache is bounded and refreshes recency on hits', () => {
  const s = createSweeper({ capacity: 2 });
  let calls = 0;
  const fn = v => ++calls;
  s.sweep([1], fn, { key: 'a' });
  s.sweep([1], fn, { key: 'b' });
  s.sweep([1], fn, { key: 'a' }); // hit, refreshes a
  s.sweep([1], fn, { key: 'c' }); // evicts b
  assert.equal(s.size, 2);
  s.sweep([1], fn, { key: 'a' });
  assert.equal(calls, 3);
  s.sweep([1], fn, { key: 'b' });
  assert.equal(calls, 4);
  s.clear();
  assert.equal(s.size, 0);
});

test('sweepRange spaces linearly or logarithmically and includes both ends', () => {
  assert.deepEqual(sweepRange(0, 1, 5), [0, 0.25, 0.5, 0.75, 1]);
  const log = sweepRange(1 / 60, 1 / 15, 3, { log: true });
  near(log[0], 1 / 60, 1e-15); near(log[1], 1 / 30, 1e-15); near(log[2], 1 / 15, 1e-15);
  assert.deepEqual(sweepRange(3, 5, 1), [3]);
  assert.deepEqual(sweepRange(3, 5, 0), []);
  assert.throws(() => sweepRange(0, 1, 3, { log: true }));
});

test('nearestIndex picks the closest value and the shared sweeper works', () => {
  assert.equal(nearestIndex([0.1, 0.2, 0.4], 0.33), 2);
  assert.equal(nearestIndex([0.1, 0.2, 0.4], 0.29), 1);
  assert.equal(nearestIndex([], 1), -1);
  let calls = 0;
  sweep([1, 2], () => ++calls, { key: 'shared-test' });
  sweep([1, 2], () => ++calls, { key: 'shared-test' });
  assert.equal(calls, 2);
  clearSweeps();
  sweep([1, 2], () => ++calls, { key: 'shared-test' });
  assert.equal(calls, 4);
});
