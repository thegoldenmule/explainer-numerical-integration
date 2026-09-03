// The sweep strip: a horizontal row of ticks, one per value of a sweep, where hovering or
// dragging selects an index. Every "explode a parameter" pane pairs one with drawBundle:
// the strip's index is the bundle's highlight, usually through aux.highlight so it
// survives a remount.
//
//   const strip = sweepStrip({ values: hs, format: h => h.toFixed(3), signal, initial: aux.get().highlight,
//                              onSelect: i => aux.set({ highlight: i }) });
//   root.append(strip.el);
//
// Hover selects without pressing; pointer capture keeps a drag selecting past the edges;
// arrow keys step, Home/End jump. select(i) from outside (a store subscription) updates
// the strip without calling onSelect again unless the index actually changes.

import { el } from '../dom.js';

/**
 * sweepStrip({ values, format, signal, onSelect, initial = -1, label, hover = true })
 * → { el, select(i, { notify = true }), index, values }
 */
export function sweepStrip({ values = [], format = v => String(+v.toPrecision(3)), signal, onSelect, initial = -1, label, hover = true } = {}) {
  const n = values.length;
  let index = -1;

  const out = el('output', { class: 'sweep-value' });
  const ticks = values.map((v, i) => el('span', {
    class: 'sweep-tick', 'data-i': i, title: format(v), style: `left: ${n > 1 ? (i / (n - 1)) * 100 : 50}%`,
  }));
  const inner = el('div', { class: 'sweep-ticks' }, ticks);
  const track = el('div', { class: 'sweep-track' }, inner);
  const node = el('div', { class: 'sweep', tabindex: '0', role: 'slider', 'aria-label': label ?? 'sweep' },
    el('div', { class: 'sweep-head' }, label ? el('span', {}, label) : el('span'), out),
    track,
    n > 0 ? el('div', { class: 'sweep-ends' }, el('span', {}, format(values[0])), el('span', {}, format(values[n - 1]))) : null);
  if (n > 0) { node.setAttribute('aria-valuemin', 0); node.setAttribute('aria-valuemax', n - 1); }

  function select(i, { notify = true } = {}) {
    const next = n === 0 ? -1 : Math.min(n - 1, Math.max(-1, Math.round(i)));
    if (next === index) return;
    index = next;
    ticks.forEach((t, j) => { if (j === index) t.setAttribute('aria-selected', 'true'); else t.removeAttribute('aria-selected'); });
    out.textContent = index >= 0 ? format(values[index]) : '';
    if (index >= 0) node.setAttribute('aria-valuenow', index); else node.removeAttribute('aria-valuenow');
    if (notify) onSelect?.(index, index >= 0 ? values[index] : undefined);
  }

  const indexAt = e => {
    const r = inner.getBoundingClientRect();
    if (r.width === 0 || n === 0) return -1;
    return Math.round(((e.clientX - r.left) / r.width) * (n - 1));
  };

  let dragging = null;
  track.addEventListener('pointerdown', e => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    dragging = e.pointerId;
    track.setPointerCapture(e.pointerId);
    node.focus({ preventScroll: true });
    select(indexAt(e));
    e.preventDefault();
  }, { signal });
  track.addEventListener('pointermove', e => {
    if (dragging !== null) { if (e.pointerId === dragging) select(indexAt(e)); return; }
    if (hover && e.pointerType === 'mouse') select(indexAt(e));
  }, { signal });
  const release = e => { if (e.pointerId === dragging) dragging = null; };
  track.addEventListener('pointerup', release, { signal });
  track.addEventListener('pointercancel', release, { signal });
  node.addEventListener('keydown', e => {
    let next = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = Math.max(0, index) + (index < 0 ? 0 : 1);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = Math.max(0, index - 1);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = n - 1;
    if (next === null) return;
    e.preventDefault();   // main.js's arrow-key navigation checks defaultPrevented
    select(next);
  }, { signal });
  // No wheel handler: wheel is the page's swipe gesture and must never be cancelled.

  select(initial, { notify: false });

  return {
    el: node,
    select,
    get index() { return index; },
    values,
  };
}
