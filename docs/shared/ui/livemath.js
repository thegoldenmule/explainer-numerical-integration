// Live numbers inside native MathML (or any element). A prose fragment marks slots with
// data-var; bindMath fills them from the store state and from derived values and keeps
// them current. No typesetting library: the browser lays out the <math> itself.
//
//   <mn data-var="c" data-digits="2">0.10</mn>   … <mi data-var="regime">underdamped</mi>
//   bindMath(article, store, state => ({ disc: discriminant(state.m, state.c, state.k) }), { signal });
//
// Numbers go through fmt (fixed digits, unicode minus); strings and Nodes are used as they are.

import { fmt } from '../dom.js';

/** bindMath(root, store, derive = () => ({}), { signal, digits = 3 }) → off */
export function bindMath(root, store, derive = () => ({}), { signal, digits = 3 } = {}) {
  const slots = [...root.querySelectorAll('[data-var]')].map(node => ({
    node, name: node.dataset.var, digits: node.dataset.digits != null ? Number(node.dataset.digits) : null,
  }));
  if (slots.length === 0) return () => {};

  function update(state) {
    const values = { ...state, ...derive(state) };
    for (const slot of slots) {
      const v = values[slot.name];
      if (v === undefined) continue;
      if (v instanceof Node) { slot.node.replaceChildren(v); continue; }
      const text = typeof v === 'number' ? fmt(v, slot.digits ?? digits) : String(v);
      if (slot.node.textContent !== text) slot.node.textContent = text;
    }
  }
  const off = store.subscribe(update);
  signal?.addEventListener('abort', off, { once: true });
  return off;
}
