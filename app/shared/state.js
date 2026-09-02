// The one state tuple every visualization is a view of:
//   (method, h, m, c, k, x0, v0, t)
// Panes never keep private copies of these. Side panes show the reviewer's current case
// precisely because there is a single source of truth.

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

export function createStore(initial = DEFAULTS) {
  let state = Object.freeze({ ...initial });
  const subs = new Set();

  function set(patch, { silent = false } = {}) {
    const clean = {};
    for (const [key, raw] of Object.entries(patch)) {
      let value = raw;
      if (key === 'method') {
        if (!METHODS[value]) throw new Error(`unknown integrator: ${value}`);
      } else if (key in LIMITS) {
        if (typeof value !== 'number' || !Number.isFinite(value)) continue;
        const [lo, hi] = LIMITS[key];
        value = Math.min(hi, Math.max(lo, value));
      } else {
        throw new Error(`unknown state key: ${key}`);
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
    reset: () => set(DEFAULTS),
    preset: name => set(PRESETS[name]),
  };
}

export const store = createStore();
