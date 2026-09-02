// The one state tuple every visualization is a view of:
//   (method, h, m, c, k, x0, v0, t)
// Panes never keep private copies of these. Side panes show the reviewer's current case
// precisely because there is a single source of truth.
//
// createStore is generic: the tuple store below is one instance of it, and shared/scene.js
// and shared/aux.js make the two side stores with their own schemas.

import { METHODS } from './math/integrators.js';

export const DEFAULTS = Object.freeze({
  method: 'euler',
  h: 1 / 30,
  m: 1, c: 0.1, k: 100,   // demo parameters: λ = −0.05 ± 10i, Euler blows up in seconds
  x0: 1, v0: 0,
  t: 0,
});

export const PRESETS = Object.freeze({
  demo:  { m: 1,  c: 0.1, k: 100 },
  essay: { m: 10, c: 0.1, k: 10 },  // Part II's own example: λ = −0.005 ± i
});

/** Slider ranges. Values are clamped on set(). */
export const LIMITS = Object.freeze({
  h:  [0.001, 0.5],
  m:  [0.1, 50],
  c:  [0, 50],
  k:  [0, 2000],
  x0: [-2, 2],
  v0: [-20, 20],
  t:  [0, Infinity],
});

/** The tuple's only non-numeric key. Anything else outside LIMITS is an error. */
function tupleValidate(key, value) {
  if (key === 'method') {
    if (!METHODS[value]) throw new Error(`unknown integrator: ${value}`);
    return value;
  }
  throw new Error(`unknown state key: ${key}`);
}

/**
 * createStore(initial = DEFAULTS, { limits = LIMITS, validate = tupleValidate, presets = PRESETS })
 *
 * A store holds one frozen object and notifies subscribers with (state, patch) where patch
 * holds only the keys that actually changed. set() cleans every key of a patch:
 *   - a key in `limits` must be a finite number and is clamped to its [lo, hi]; a
 *     non-number is skipped, not an error;
 *   - any other key goes through validate(key, value, state), which returns the cleaned
 *     value, returns undefined to skip it, or throws (unknown keys throw by default).
 * Change detection is identity (`!==`), so a store that holds arrays or objects must
 * replace them in set(), never mutate them in place.
 *
 * With no arguments this is exactly the tuple store: clamps to LIMITS, validates `method`,
 * throws on unknown keys. reset() returns to `initial`; preset(name) applies `presets[name]`.
 * `store.limits` exposes the ranges so controls can read a key's range from any store.
 */
export function createStore(initial = DEFAULTS, { limits = LIMITS, validate = tupleValidate, presets = PRESETS } = {}) {
  let state = Object.freeze({ ...initial });
  const subs = new Set();

  function set(patch, { silent = false } = {}) {
    const clean = {};
    for (const [key, raw] of Object.entries(patch)) {
      let value = raw;
      if (key in limits) {
        if (typeof value !== 'number' || !Number.isFinite(value)) continue;
        const [lo, hi] = limits[key];
        value = Math.min(hi, Math.max(lo, value));
      } else {
        value = validate(key, value, state);
        if (value === undefined) continue;
      }
      if (state[key] !== value) clean[key] = value;
    }
    if (Object.keys(clean).length === 0) return state;
    state = Object.freeze({ ...state, ...clean });
    if (!silent) for (const fn of subs) fn(state, clean);
    return state;
  }

  return {
    get: () => state,
    set,
    /** fn(state, patch). Called immediately with (state, state) unless immediate: false. */
    subscribe(fn, { immediate = true } = {}) {
      subs.add(fn);
      if (immediate) fn(state, state);
      return () => subs.delete(fn);
    },
    reset: () => set(initial),
    preset(name) {
      if (!presets[name]) throw new Error(`unknown preset: ${name}`);
      return set(presets[name]);
    },
    limits,
  };
}

export const store = createStore();
