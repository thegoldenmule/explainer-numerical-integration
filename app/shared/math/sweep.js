// Sweeps for the "explode a parameter" panes: run one computation across a small list of
// values and memoize the whole bundle on a key derived from the current parameters, so a
// redraw does not rerun every trajectory. Keep sweeps small (Victor's caution); the cap on
// what gets drawn lives in gfx/bundle.js.

/** n values from lo to hi inclusive, linear or logarithmic. */
export function sweepRange(lo, hi, n, { log = false } = {}) {
  if (n < 1) return [];
  if (n === 1) return [lo];
  if (log && (lo <= 0 || hi <= 0)) throw new Error('sweepRange: log spacing needs positive bounds');
  const out = [];
  for (let i = 0; i < n; i++) {
    const s = i / (n - 1);
    out.push(log ? lo * (hi / lo) ** s : lo + (hi - lo) * s);
  }
  return out;
}

/** A memo key from the parameters a sweep depends on: sweepKey({ method, m, c, k }) */
export const sweepKey = (params) => JSON.stringify(params);

const sameValues = (a, b) => a.length === b.length && a.every((v, i) => Object.is(v, b[i]));

/**
 * A sweeper with its own bounded cache. sweep(values, fn, { key }) returns
 * [{ value, result }], the same array reference on a hit (compare cheaply). A hit needs
 * the same key and the same values; fn runs once per value otherwise. Without a key,
 * nothing is memoized.
 */
export function createSweeper({ capacity = 16 } = {}) {
  const cache = new Map();
  function sweep(values, fn, { key } = {}) {
    if (key != null) {
      const hit = cache.get(key);
      if (hit && sameValues(hit.values, values)) {
        cache.delete(key); cache.set(key, hit); // refresh recency
        return hit.results;
      }
    }
    const results = values.map(value => ({ value, result: fn(value) }));
    if (key != null) {
      cache.set(key, { values: [...values], results });
      while (cache.size > capacity) cache.delete(cache.keys().next().value);
    }
    return results;
  }
  return { sweep, clear: () => cache.clear(), get size() { return cache.size; } };
}

const shared = createSweeper();
/** The shared sweeper: sweep(values, fn, { key }). */
export const sweep = shared.sweep;
export const clearSweeps = shared.clear;

/** Index of the value in a sweep closest to `target` (for highlighting a dragged marker). */
export function nearestIndex(values, target) {
  let best = -1, dist = Infinity;
  values.forEach((v, i) => { const d = Math.abs(v - target); if (d < dist) { dist = d; best = i; } });
  return best;
}
