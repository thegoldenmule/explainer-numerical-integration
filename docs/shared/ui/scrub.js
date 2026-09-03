// Scrubbable numbers: a number in a formula you drag left or right to change (panels 5, 7).
// A prose fragment marks them with data-scrub; bindScrub binds each to a store key within
// that store's limits (any store shaped { get, set, subscribe, limits }: the tuple, aux, or
// scene.paramStore(i) for one force's parameters).
//
//   <mn data-var="k" data-scrub="k" data-digits="0">100</mn>
//   bindScrub(article, store, { signal });
//
// Drag horizontally (pointer capture, so the drag survives leaving the element); hold
// shift for a fine step; focus it and use the arrow keys (Home/End for the ends). A
// data-log attribute makes the drag multiplicative, for h and k. The text is written here
// only when the element has no data-var, so it coexists with bindMath on the same
// element: livemath owns the text, scrub owns the gesture.
//
// A data-snap="0" (or a comma list, "0,1") makes those values landable exactly, the way a
// stepped <input type=range> guarantees its grid points: a move that would step past a
// snap value, or land within one step of it, is replaced with the snap value itself. The
// tolerance is the size of the gesture that produced the move, so a slow drag must still
// come close and a fast one cannot skip over the value entirely. Nodes without data-snap
// are unaffected — snaps is empty and move() returns exactly what it always did.

import { fmt } from '../dom.js';

const FINE = 0.1;

/**
 * bindScrub(root, store, { signal, pixelsPerRange = 300, keySteps = 100, digits = 3, limits })
 *   pixelsPerRange  pixels of drag that sweep the whole range
 *   keySteps        arrow presses that sweep the whole range
 *   limits          overrides per key, else store.limits[key]; an unbounded key scrubs at
 *                   max(|value|, 1) per pixelsPerRange
 * → off()
 */
export function bindScrub(root, store, { signal, pixelsPerRange = 300, keySteps = 100, digits = 3, limits = {} } = {}) {
  const ac = new AbortController();
  signal?.addEventListener('abort', () => ac.abort(), { once: true });
  const sig = ac.signal;
  const nodes = [...root.querySelectorAll('[data-scrub]')];
  const offs = [];

  for (const node of nodes) {
    const key = node.dataset.scrub;
    let [lo, hi] = limits[key] ?? store.limits?.[key] ?? [-Infinity, Infinity];
    const bounded = Number.isFinite(lo) && Number.isFinite(hi);
    const log = node.hasAttribute('data-log') && bounded && hi > 0;
    if (log && lo <= 0) lo = hi / 1000;   // same floor rule as slider({ log })
    const d = node.dataset.digits != null ? Number(node.dataset.digits) : digits;
    const ownsText = !node.hasAttribute('data-var');
    const clamp = v => Math.min(hi, Math.max(lo, v));
    const value = () => store.get()[key];
    const snaps = node.dataset.snap != null ? node.dataset.snap.split(',').map(Number).filter(Number.isFinite) : [];

    node.classList.add('scrub');
    node.setAttribute('tabindex', '0');
    node.setAttribute('role', 'slider');
    node.setAttribute('aria-label', node.getAttribute('aria-label') ?? key);
    if (bounded) { node.setAttribute('aria-valuemin', lo); node.setAttribute('aria-valuemax', hi); }

    // one unit of gesture: a pixel of drag or 1/keySteps of a key sweep, in the key's units
    const perPixel = v => (log ? Math.log(hi / lo) / pixelsPerRange : (bounded ? (hi - lo) : Math.max(Math.abs(v), 1)) / pixelsPerRange);
    const perKey = v => (log ? Math.log(hi / lo) / keySteps : (bounded ? (hi - lo) : Math.max(Math.abs(v), 1)) / keySteps);
    const move = (v, amount) => {
      const next = clamp(log ? v * Math.exp(amount) : v + amount);
      if (snaps.length === 0) return next;
      const tol = Math.max(Math.abs(next - v), 1e-9);   // this move's own size: the snap window
      for (const target of snaps) {
        if (v === target) continue;   // already on the detent: let this move leave it
        if (Math.abs(next - target) < tol || (v - target) * (next - target) <= 0) return target;
      }
      return next;
    };
    const write = v => { if (v !== value()) store.set({ [key]: v }); };

    let drag = null;   // { id, lastX, v }
    node.addEventListener('pointerdown', e => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      drag = { id: e.pointerId, lastX: e.clientX, v: value() };
      node.setPointerCapture(e.pointerId);
      node.dataset.active = '';
      node.focus({ preventScroll: true });
      e.preventDefault();
    }, { signal: sig });
    node.addEventListener('pointermove', e => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.lastX;
      drag.lastX = e.clientX;
      if (dx === 0) return;
      drag.v = move(drag.v, dx * perPixel(drag.v) * (e.shiftKey ? FINE : 1));
      write(drag.v);
    }, { signal: sig });
    const release = e => {
      if (!drag || e.pointerId !== drag.id) return;
      drag = null;
      delete node.dataset.active;
    };
    node.addEventListener('pointerup', release, { signal: sig });
    node.addEventListener('pointercancel', release, { signal: sig });
    node.addEventListener('keydown', e => {
      const v = value();
      let next = null;
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = move(v, perKey(v) * (e.shiftKey ? FINE : 1));
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = move(v, -perKey(v) * (e.shiftKey ? FINE : 1));
      else if (e.key === 'Home' && bounded) next = lo;
      else if (e.key === 'End' && bounded) next = hi;
      if (next === null) return;
      e.preventDefault();   // main.js's arrow-key navigation checks defaultPrevented
      write(next);
    }, { signal: sig });
    // No wheel handler: wheel is the page's swipe gesture and must never be cancelled.

    offs.push(store.subscribe((s, patch) => {
      if (!(key in patch)) return;
      const v = s[key];
      node.setAttribute('aria-valuenow', v);
      if (ownsText) {
        const text = fmt(v, d);
        if (node.textContent !== text) node.textContent = text;
      }
    }));
  }

  sig.addEventListener('abort', () => { for (const o of offs) o(); }, { once: true });
  return () => ac.abort();
}
