import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSceneStore, defaultScene, SCENE_MASS, FORCE_LIMITS, BODY_LIMITS } from './scene.js';
import { createStore, DEFAULTS } from './state.js';
import { netForce, assemble } from './math/forces.js';

test('the default scene starts consistent with the tuple defaults, mass aside', () => {
  const s = createSceneStore();
  const { body, forces, linear } = s.get();
  assert.equal(body.m, SCENE_MASS, 'the scene has its own mass; the tuple default is not it');
  assert.deepEqual(body.x, [1, 0.5], 'displaced, so the spring arrow has a length');
  assert.deepEqual(body.v, [0, 2], 'moving, so the drag arrow has a length');
  assert.equal(linear, false);
  assert.deepEqual(forces.map(f => f.type), ['wind', 'gravity', 'drag', 'spring']);
  assert.equal(forces[s.forceIndex('drag')].c, DEFAULTS.c);
  assert.equal(forces[s.forceIndex('spring')].k, DEFAULTS.k);
  assert.deepEqual(assemble(s.get()), { M: SCENE_MASS, C: DEFAULTS.c, K: DEFAULTS.k });
  assert.ok(Object.isFrozen(s.get().forces) && Object.isFrozen(s.get().body));
});

test('setters replace objects, clamp to limits, and notify with the changed key', () => {
  const s = createSceneStore();
  const seen = [];
  s.subscribe((state, patch) => seen.push(Object.keys(patch)), { immediate: false });
  const before = s.get();
  s.moveBody(99, -1);
  assert.deepEqual(s.get().body.x, [BODY_LIMITS.x[1], -1]);
  assert.notEqual(s.get().body, before.body, 'a new body object');
  assert.equal(s.get().forces, before.forces, 'forces untouched');
  s.setVelocity([1, 2]);
  assert.deepEqual(s.get().body.v, [1, 2]);
  const gi = s.forceIndex('gravity');
  s.toggleForce(gi);
  assert.equal(s.get().forces[gi].on, false);
  s.toggleForce(gi, true);
  assert.equal(s.get().forces[gi].on, true);
  s.setForceParam(gi, 'r', 0.01);
  assert.equal(s.get().forces[gi].r, FORCE_LIMITS.r[0]);
  assert.throws(() => s.setForceParam(gi, 'k', 1), /no parameter/);
  assert.throws(() => s.setForceParam(9, 'k', 1), /no force/);
  s.setLinear(1);
  assert.equal(s.get().linear, true);
  s.toggleLinear();
  assert.equal(s.get().linear, false);
  assert.deepEqual(seen, [['body'], ['body'], ['forces'], ['forces'], ['forces'], ['linear'], ['linear']]);
  assert.throws(() => s.set({ nope: 1 }));
});

test('mass syncs scene → tuple only; pushToTuple is the bridge', () => {
  const tuple = createStore();
  const s = createSceneStore({ tuple });
  s.setMass(4);
  assert.equal(s.get().body.m, 4);
  assert.equal(tuple.get().m, 4);
  tuple.set({ m: 7, c: 3, k: 9 });
  assert.equal(s.get().body.m, 4, 'nothing flows back from the tuple');
  s.setForceParam(s.forceIndex('drag'), 'c', 0.5);
  s.setForceParam(s.forceIndex('spring'), 'k', 40);
  assert.equal(tuple.get().c, 3, 'force parameters do not sync on their own');
  s.pushToTuple();
  assert.deepEqual([tuple.get().m, tuple.get().c, tuple.get().k], [4, 0.5, 40]);
  s.toggleForce(s.forceIndex('spring'), false);
  s.pushToTuple();
  assert.equal(tuple.get().k, 0, 'a switched-off spring contributes no K');
});

test('the linear switch changes the force sum away from the operating point', () => {
  const s = createSceneStore();
  s.moveBody(0, -5);
  const real = netForce(s.get(), { linear: s.get().linear });
  s.setLinear(true);
  const linear = netForce(s.get(), { linear: s.get().linear });
  assert.notEqual(real[1], linear[1]);
});

test('paramStore views one force (or the body) as a store for the controls', () => {
  const tuple = createStore();
  const s = createSceneStore({ tuple });
  const g = s.paramStore(s.forceIndex('gravity'));
  assert.deepEqual(Object.keys(g.limits), ['G', 'm2', 'r']);
  const seen = [];
  g.subscribe((state, patch) => seen.push(patch), { immediate: false });
  g.set({ r: 20, G: 'x' });
  assert.equal(g.get().r, 20);
  assert.equal(g.get().G, 1, 'a non-number is skipped');
  assert.equal(seen.length, 1);
  assert.equal(seen[0].r, 20);
  s.moveBody(1, 1);
  assert.deepEqual(seen[1], {}, 'a body change is an empty patch on a force view');
  const b = s.paramStore('body');
  b.set({ m: 2 });
  assert.equal(s.get().body.m, 2);
  assert.equal(tuple.get().m, 2);
  assert.deepEqual(b.limits, { m: BODY_LIMITS.m });
});

test('createSceneStore accepts a custom initial scene and cleans it', () => {
  const s = createSceneStore({ initial: { ...defaultScene(), body: { m: 1000, x: [0, 0], v: [0, 0] }, linear: 1 } });
  assert.equal(s.get().body.m, BODY_LIMITS.m[1]);
  assert.equal(s.get().linear, true);
  s.reset();
  assert.equal(s.get().body.m, BODY_LIMITS.m[1], 'reset returns to the cleaned initial scene');
});
