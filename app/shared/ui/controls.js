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

/** slider(store, 'h', { label, min, max, step, format, signal }) */
export function slider(store, key, { label = key, min, max, step = 'any', format = v => String(+v.toPrecision(3)), signal } = {}) {
  const [lo, hi] = LIMITS[key] ?? [0, 1];
  const input = el('input', { type: 'range', min: min ?? lo, max: max ?? hi, step, value: store.get()[key], name: key });
  const out = el('output');
  input.addEventListener('input', () => store.set({ [key]: Number(input.value) }));
  bind(store, signal, (s, patch) => {
    if (!(key in patch)) return;
    if (Number(input.value) !== s[key]) input.value = s[key];
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
