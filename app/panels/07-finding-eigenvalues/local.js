// Panel 7's pane-local damping: a store-shaped facade over the tuple whose `c` is this pane's
// own copy, with its own (wider) range, and which is never written back.
//
// Why the spine needs it: Re λ = −c / 2m, and the tuple clamps c to LIMITS.c = [0, 50]. So a
// positive real part is structurally unreachable through the tuple and the panel could never
// show the unstable half-plane it exists to explain. Why the right pane needs it: sweeping the
// discriminant through zero means walking c far past 2√(mk), and CLAUDE.md names that case —
// "a 'what if' case (negative c, an overdamped view, a constant-force run) is computed
// locally, never written."
//
// m and k still route to the tuple: they are the reader's actual spring, and dragging them is
// the panel's whole point. c does not. An external write to the tuple's c (another panel's
// control) re-seeds the local copy, since this facade is by construction the only thing that
// could otherwise have moved it — so "reset" always means the spring's real damping.
//
// The result is shaped { get, set, subscribe, limits }, which is all bindScrub, bindMath and
// createComplexPlane ever ask for.

/**
 * localDamping(store, { range = [-5, 30], signal })
 *   → { get, set, subscribe, limits, c, springC, reset(), destroy() }
 * `range` is this pane's own [lo, hi] for c and is what bindScrub reads through `limits`.
 */
export function localDamping(store, { range = [-5, 30], signal } = {}) {
  const [lo, hi] = range;
  const clamp = v => Math.min(hi, Math.max(lo, v));
  let c = clamp(store.get().c);
  const subs = new Set();
  const get = () => ({ ...store.get(), c });

  // One subscription to the tuple, fanned out. A `c` in the tuple's patch can only be an
  // external write (this facade never sends one), so it re-seeds the local copy.
  const off = store.subscribe((s, patch) => {
    if ('c' in patch) c = clamp(s.c);
    const state = get();
    for (const fn of [...subs]) fn(state, patch);
  }, { immediate: false });
  signal?.addEventListener('abort', off, { once: true });

  const facade = {
    get,
    /** c stays here; only m and k are forwarded to the tuple. */
    set(patch) {
      const shared = {};
      if ('m' in patch) shared.m = patch.m;
      if ('k' in patch) shared.k = patch.k;
      if (Object.keys(shared).length) store.set(shared);
      if ('c' in patch && typeof patch.c === 'number' && Number.isFinite(patch.c)) {
        const next = clamp(patch.c);
        if (next !== c) {
          c = next;
          const state = get();
          for (const fn of [...subs]) fn(state, { c });
        }
      }
      return get();
    },
    subscribe(fn, { immediate = true } = {}) {
      subs.add(fn);
      if (immediate) { const state = get(); fn(state, state); }
      return () => subs.delete(fn);
    },
    limits: { ...store.limits, c: range },
    /** this pane's own c, and the spring's, for the prose that has to say they differ */
    get c() { return c; },
    get springC() { return store.get().c; },
    /** back to the spring's real damping */
    reset() { return facade.set({ c: store.get().c }); },
    destroy: off,
  };
  return facade;
}
