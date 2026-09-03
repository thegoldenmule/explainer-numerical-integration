// Per-panel knobs that are not part of the tuple but must survive a remount (the pane
// manager destroys and recreates side panes, so pane closures lose them). One small store
// with documented keys; nothing else goes in here without an entry below.
//
//   epsilon    panel 4: the perturbation size, the radius of the ε-tube around the exact
//              solution and of the ball the neighbors start in. Range AUX_LIMITS.epsilon.
//   tol        panel 13: the target local error the step controller aims for. Range
//              AUX_LIMITS.tol; the adaptive confirmations in idea.md use 0.01.
//   highlight  the index the current sweep strip selects (ui/sweep.js writes it, every
//              explode pane reads it for drawBundle's `highlight`). An integer, −1 = none.
//              It is one value shared by every sweep, so a pane clamps it to its own
//              sweep's length on read.

import { createStore } from './state.js';

export const AUX_DEFAULTS = Object.freeze({ epsilon: 0.1, tol: 0.01, highlight: -1 });

export const AUX_LIMITS = Object.freeze({
  epsilon: [1e-3, 1],
  tol: [1e-5, 1],
});

function auxValidate(key, value) {
  if (key === 'highlight') {
    if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
    return Math.max(-1, Math.round(value));
  }
  throw new Error(`unknown aux key: ${key}`);
}

export function createAuxStore(initial = AUX_DEFAULTS) {
  return createStore(initial, { limits: AUX_LIMITS, validate: auxValidate, presets: {} });
}

export const aux = createAuxStore();
