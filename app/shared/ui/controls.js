// Controls bound to the store. Every factory takes `signal` (ctx.signal from the loader) so
// its store subscription is dropped when the pane is destroyed.

import { el } from '../dom.js';
import { LIMITS } from '../state.js';
import { METHODS, METHOD_IDS } from '../math/integrators.js';

function bind(store, signal, fn) {
  const off = store.subscribe(fn);
  signal?.addEventListener('abort', off, { once: true });
  return off;
}

/** The range a control uses for a key: the store's own limits first, then the tuple's. */
export const limitsOf = (store, key) => store.limits?.[key] ?? LIMITS[key] ?? [0, 1];

/**
 * slider(store, 'h', { label, min, max, step, format, signal, log })
 * With `log: true` the input runs in log space and the store gets the real value (use it
 * for h and k). A log axis needs a positive floor: a non-positive min is raised to
 * max / 1000, so slider(store, 'k', { log: true }) spans 2..2000 without a `min`.
 */
export function slider(store, key, { label = key, min, max, step = 'any', format = v => String(+v.toPrecision(3)), signal, log = false } = {}) {
  const [lo0, hi0] = limitsOf(store, key);
  const hi = max ?? hi0;
  let lo = min ?? lo0;
  if (log && lo <= 0) lo = hi / 1000;
  const toInput = log ? v => Math.log(Math.max(v, lo)) : v => v;
  const fromInput = log ? v => Math.exp(v) : v => v;
  const input = el('input', {
    type: 'range', min: toInput(lo), max: toInput(hi), step: log ? 'any' : step, value: toInput(store.get()[key]),
    name: key, 'data-log': log ? '' : null,
  });
  const out = el('output');
  input.addEventListener('input', () => store.set({ [key]: fromInput(Number(input.value)) }));
  bind(store, signal, (s, patch) => {
    if (!(key in patch)) return;
    const want = toInput(s[key]);
    if (Math.abs(Number(input.value) - want) > 1e-9 * Math.max(1, Math.abs(want))) input.value = want;
    out.textContent = format(s[key]);
  });
  return el('label', { class: 'control' }, el('span', { class: 'control-label' }, el('span', {}, label), out), input);
}

/** Radio group. options: [{ value, label }] */
export function choice(store, key, options, { legend, signal, name = key } = {}) {
  const inputs = options.map(o => {
    const input = el('input', { type: 'radio', name, value: o.value });
    input.addEventListener('change', () => input.checked && store.set({ [key]: o.value }));
    return { input, label: el('label', {}, input, o.label) };
  });
  bind(store, signal, (s, patch) => {
    if (!(key in patch)) return;
    for (const { input } of inputs) input.checked = input.value === String(s[key]);
  });
  return el('fieldset', { class: 'choice' }, legend ? el('legend', {}, legend) : null, inputs.map(i => i.label));
}

/** Integrator picker. `only` restricts to a subset of METHOD_IDS. */
export function methodPicker(store, { only = METHOD_IDS, legend = 'Integrator', signal } = {}) {
  return choice(store, 'method', only.map(id => ({ value: id, label: METHODS[id].label })), { legend, signal, name: `method-${Math.random().toString(36).slice(2, 7)}` });
}

/** Preset buttons: { demo: 'Demo (m=1, c=0.1, k=100)', essay: 'Essay (m=10, c=0.1, k=10)' } */
export function presets(store, labels) {
  return el('div', { class: 'controls-row' },
    Object.entries(labels).map(([name, label]) =>
      el('button', { class: 'btn', type: 'button', onclick: () => store.preset(name) }, label)));
}

/**
 * A switch bound to a store key (booleans, or any two values with { on, off }):
 *   toggle(scene, 'linear', { label: 'Linear model', signal })
 */
export function toggle(store, key, { label = key, signal, on = true, off = false } = {}) {
  const input = el('input', { type: 'checkbox', name: key });
  input.addEventListener('change', () => store.set({ [key]: input.checked ? on : off }));
  bind(store, signal, (s, patch) => { if (key in patch) input.checked = s[key] === on; });
  return el('label', { class: 'toggle' }, input, el('span', { class: 'toggle-track' }), el('span', { class: 'toggle-label' }, label));
}

/**
 * The same switch for a value that is not a plain store key: get() reads it, set(bool)
 * writes it, and an optional subscribe(fn) → off keeps the switch current (a store's
 * subscribe works as is). Real vs linear through the scene store's own setter:
 *   toggleFn({ label: 'Linear model', get: () => scene.get().linear, set: v => scene.setLinear(v), subscribe: scene.subscribe, signal })
 * The element carries sync() to re-read get() when there is nothing to subscribe to.
 */
export function toggleFn({ label = '', get, set, subscribe, signal } = {}) {
  const input = el('input', { type: 'checkbox' });
  const sync = () => { input.checked = Boolean(get()); };
  input.addEventListener('change', () => { set(input.checked); sync(); });
  sync();
  if (subscribe) {
    const off = subscribe(sync);
    if (typeof off === 'function') signal?.addEventListener('abort', off, { once: true });
  }
  const node = el('label', { class: 'toggle' }, input, el('span', { class: 'toggle-track' }), el('span', { class: 'toggle-label' }, label));
  node.sync = sync;
  return node;
}

/** A monospace readout. set(text | Node[]) */
export function readout({ label } = {}) {
  const body = el('span');
  const node = el('div', { class: 'readout' }, label ? el('span', { class: 'label' }, `${label}\n`) : null, body);
  return {
    el: node,
    set(content) { typeof content === 'string' ? (body.textContent = content) : body.replaceChildren(...[].concat(content)); },
  };
}

export const controls = (...children) => el('div', { class: 'controls' }, children);
export const row = (...children) => el('div', { class: 'controls-row' }, children);
