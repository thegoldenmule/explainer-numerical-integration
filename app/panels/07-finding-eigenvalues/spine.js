// Panel 7, spine: the quadratic formula with live numbers and the two roots on the complex
// plane. Proof of stage + cplane + livemath; the prose is a placeholder.

import { createStage } from 'shared/gfx/stage.js';
import { createComplexPlane } from 'shared/gfx/cplane.js';
import { bindMath } from 'shared/ui/livemath.js';
import { slider, controls } from 'shared/ui/controls.js';
import { discriminant, regime, eigenvalues } from 'shared/math/system.js';
import { cfmt } from 'shared/math/complex.js';

export function mount(root, ctx) {
  const { store, signal } = ctx;
  const stage = createStage(root, { layers: ['plane'], aspect: 'half', signal });
  createComplexPlane({
    stage, store, signal,
    // keep both roots comfortably inside the frame as k and c sweep
    halfRange: s => Math.max(3, 1.3 * Math.max(...eigenvalues(s.m, s.c, s.k).flat().map(Math.abs))),
  });
  root.append(controls(
    slider(store, 'm', { label: 'm (mass)', min: 0.1, max: 20, signal }),
    slider(store, 'c', { label: 'c (drag)', min: 0, max: 30, signal }),
    slider(store, 'k', { label: 'k (spring)', min: 0, max: 400, signal }),
  ));

  bindMath(root.closest('article') ?? root, store, s => {
    const d = discriminant(s.m, s.c, s.k), r = regime(s.m, s.c, s.k);
    const [l1, l2] = eigenvalues(s.m, s.c, s.k);
    const alpha = -s.c / (2 * s.m);
    return {
      disc: d,
      sign: r === 'critical' ? 'zero' : d < 0 ? 'negative' : 'positive',
      regime: r === 'critical' ? 'critically damped' : r,
      l1: cfmt(l1), l2: cfmt(l2),
      alpha,
      verdict: alpha < 0 ? 'negative: the spring settles' : 'not negative: nothing pulls it back',
    };
  }, { signal });

  return { destroy() {} };
}
