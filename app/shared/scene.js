// The scene store for the 2D panels (1, 2, 5): one point mass on a plane and the list of
// force arrows acting on it, with a real-vs-linear switch. Panel 2's left pane draws the
// same arrows the reviewer just dragged on the spine and the pane manager remounts side
// panes freely, so this state lives here, not in a pane.
//
//   scene.get() → { body: { m, x: [x, y], v: [vx, vy] }, forces: [force, …], linear }
//
// The shape is exactly math/forces.js's createScene, so netForce(scene.get()) and
// assemble(scene.get()) work unchanged. Values are immutable: every setter replaces `body`
// or `forces` with a new object (the store detects change by identity).
//
// Sync with the tuple, in one direction: scene → tuple. setMass writes the tuple's `m`
// as well, so panels 1–5 and the spring of Part II agree on the mass; pushToTuple() is the
// bridge panel 5 uses to write the assembled M, C, K. Nothing flows back: a later panel
// changing the tuple's m, c, k (panel 7's sliders) leaves the scene alone, because those
// panels are past the scene and the scene is the record of what the reviewer set up.

import { createStore, store as tupleStore, DEFAULTS, LIMITS } from './state.js';
import { MODELS, createForce, createScene, assemble } from './math/forces.js';

/** Ranges of every force parameter, by parameter name (shared across models). */
export const FORCE_LIMITS = Object.freeze({
  fx: [-20, 20], fy: [-20, 20],     // wind
  G: [0, 10], m2: [1, 1000], r: [0.5, 50],   // gravity
  c: LIMITS.c,                      // drag
  k: LIMITS.k,                      // spring
});

/** Ranges of the body's numbers; x and v apply per component. */
export const BODY_LIMITS = Object.freeze({
  m: LIMITS.m,
  x: [-5, 5],
  v: [-20, 20],
});

const clamp = (v, [lo, hi]) => Math.min(hi, Math.max(lo, v));
const finite = v => typeof v === 'number' && Number.isFinite(v);
const pair = (p, lim, fallback) => (Array.isArray(p) && finite(p[0]) && finite(p[1]) ? [clamp(p[0], lim), clamp(p[1], lim)] : fallback);

/**
 * The scene every 2D panel starts from: the demo mass with all four force models.
 * The body is displaced and moving, not at rest at the origin: drag is −c v and the spring
 * is −k x, so a body at rest at the origin makes two of the four arrows zero vectors and
 * panels 2 and 5 open on a picture that cannot show what they are about.
 */
export function defaultScene() {
  return createScene({
    m: DEFAULTS.m,
    x: [1, 0.5],
    v: [0, 2],
    forces: [
      createForce('wind'),
      createForce('gravity'),
      createForce('drag', { c: DEFAULTS.c }),
      createForce('spring', { k: DEFAULTS.k }),
    ],
  });
}

function cleanBody(body, prev) {
  if (!body || typeof body !== 'object') throw new Error('scene: body must be an object');
  return Object.freeze({
    m: finite(body.m) ? clamp(body.m, BODY_LIMITS.m) : prev.m,
    x: Object.freeze(pair(body.x, BODY_LIMITS.x, prev.x)),
    v: Object.freeze(pair(body.v, BODY_LIMITS.v, prev.v)),
  });
}

function cleanForce(f) {
  const model = MODELS[f?.type];
  if (!model) throw new Error(`scene: unknown force type ${f?.type}`);
  const out = { type: f.type, on: Boolean(f.on) };
  for (const key of Object.keys(model.defaults)) {
    const v = finite(f[key]) ? f[key] : model.defaults[key];
    out[key] = FORCE_LIMITS[key] ? clamp(v, FORCE_LIMITS[key]) : v;
  }
  return Object.freeze(out);
}

function sceneValidate(key, value, state) {
  switch (key) {
    case 'body': return cleanBody(value, state.body);
    case 'forces':
      if (!Array.isArray(value)) throw new Error('scene: forces must be an array');
      return Object.freeze(value.map(cleanForce));
    case 'linear': return Boolean(value);
    default: throw new Error(`unknown scene key: ${key}`);
  }
}

/**
 * createSceneStore({ initial = defaultScene(), tuple = null })
 *   tuple: the tuple store that setMass and pushToTuple write to (null: no sync)
 * → the store (get, set, subscribe, reset, limits) plus the setters below.
 */
export function createSceneStore({ initial = defaultScene(), tuple = null } = {}) {
  // the initial state goes through the same cleaning as set()
  const blank = { body: { m: DEFAULTS.m, x: [0, 0], v: [0, 0] } };
  const initialState = {
    body: cleanBody(initial.body ?? blank.body, blank.body),
    forces: sceneValidate('forces', initial.forces ?? []),
    linear: Boolean(initial.linear),
  };
  const s = createStore(initialState, { limits: {}, validate: sceneValidate, presets: {} });

  const forceAt = i => {
    const f = s.get().forces[i];
    if (!f) throw new Error(`scene: no force at index ${i}`);
    return f;
  };
  const replaceForce = (i, next) => {
    const forces = s.get().forces.slice();
    forces[i] = next;
    return s.set({ forces });
  };

  const api = {
    ...s,
    /** Index of the first force of a type, or −1. */
    forceIndex: type => s.get().forces.findIndex(f => f.type === type),
    forceAt,
    /** moveBody(x, y) or moveBody([x, y]) */
    moveBody(x, y) {
      const p = Array.isArray(x) ? x : [x, y];
      return s.set({ body: { ...s.get().body, x: p } });
    },
    setVelocity(vx, vy) {
      const p = Array.isArray(vx) ? vx : [vx, vy];
      return s.set({ body: { ...s.get().body, v: p } });
    },
    /** The one automatic sync: the scene's mass is also the tuple's m. */
    setMass(m) {
      const state = s.set({ body: { ...s.get().body, m } });
      tuple?.set({ m: state.body.m });
      return state;
    },
    /** toggleForce(i) flips; toggleForce(i, on) sets. */
    toggleForce(i, on) {
      const f = forceAt(i);
      return replaceForce(i, { ...f, on: on === undefined ? !f.on : Boolean(on) });
    },
    setForceParam(i, key, value) {
      const f = forceAt(i);
      if (!(key in MODELS[f.type].defaults)) throw new Error(`scene: ${f.type} has no parameter ${key}`);
      return replaceForce(i, { ...f, [key]: value });
    },
    setLinear: linear => s.set({ linear: Boolean(linear) }),
    toggleLinear: () => s.set({ linear: !s.get().linear }),
    /** { M, C, K } of the active forces' linear models. */
    coefficients: () => assemble(s.get()),
    /** The bridge: write M, C, K into the tuple's m, c, k. Returns the tuple state (or null). */
    pushToTuple() {
      const { M, C, K } = assemble(s.get());
      return tuple ? tuple.set({ m: M, c: C, k: K }) : null;
    },
    /**
     * A store-shaped view of one force's parameters (or of the body with target 'body'):
     * { get, set, subscribe, limits }, keyed by parameter name, so slider() and bindScrub()
     * can bind to `G`, `r`, `k`, … exactly as they bind to the tuple's keys.
     */
    paramStore(target) {
      if (target === 'body') {
        return {
          get: () => ({ m: s.get().body.m }),
          set: patch => { if (finite(patch.m)) api.setMass(patch.m); return s.get(); },
          subscribe: (fn, opts) => s.subscribe((state, patch) => fn({ m: state.body.m }, 'body' in patch ? { m: state.body.m } : {}), opts),
          limits: { m: BODY_LIMITS.m },
        };
      }
      const i = target;
      const keys = Object.keys(MODELS[forceAt(i).type].defaults);
      const limits = Object.fromEntries(keys.map(k => [k, FORCE_LIMITS[k] ?? [-Infinity, Infinity]]));
      const view = () => forceAt(i);
      return {
        get: view,
        set(patch) {
          for (const [key, v] of Object.entries(patch)) if (finite(v)) api.setForceParam(i, key, v);
          return view();
        },
        subscribe: (fn, opts) => s.subscribe((state, patch) => fn(view(), 'forces' in patch ? view() : {}), opts),
        limits,
      };
    },
  };
  return api;
}

/** The shared scene, synced to the shared tuple store. */
export const scene = createSceneStore({ tuple: tupleStore });
