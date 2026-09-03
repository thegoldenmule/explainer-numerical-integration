// Panel 7, spine: the quadratic formula with every number in it draggable, and the two roots
// on the complex plane, colored by the physical verdict (no integrator exists yet, so cplane's
// 'physical' verdict: Re λ ≤ 0). No sliders — the formula *is* the control.
//
// The unstable half-plane, Re λ > 0, is shaded under the plane layer. Reaching it is the point
// of the panel and it needs a negative c, which the tuple cannot hold (LIMITS.c = [0, 50]), so
// c here comes from ./local.js: this pane's own copy over the range C_RANGE, never written
// back. m and k still route to the tuple — they are the reader's actual spring.

import { el, fmt } from 'shared/dom.js';
import { createStage } from 'shared/gfx/stage.js';
import { createComplexPlane } from 'shared/gfx/cplane.js';
import { cssVar, drawText } from 'shared/gfx/plot2d.js';
import { bindMath } from 'shared/ui/livemath.js';
import { bindScrub } from 'shared/ui/scrub.js';
import { controls, row } from 'shared/ui/controls.js';
import { discriminant, regime, eigenvalues } from 'shared/math/system.js';
import { cfmt } from 'shared/math/complex.js';
import { localDamping } from './local.js';

/** This pane's own range for c. Negative damping is the whole point; the tuple stops at 0. */
const C_RANGE = [-5, 30];
const SHADE_ALPHA = 0.09;

export function mount(root, ctx) {
  const { store, signal } = ctx;
  const article = root.closest('article') ?? root;
  const local = localDamping(store, { range: C_RANGE, signal });

  // 'shade' sits under 'plane'; cplane is given only the plane layer, so it never touches it.
  const stage = createStage(root, { layers: ['shade', 'plane'], aspect: 'square', signal });
  const plane = createComplexPlane({
    stage, store: local, signal, layers: { plane: 'plane' },
    // keep both roots comfortably inside the frame as k and c sweep
    halfRange: s => Math.max(3, 1.3 * Math.max(...eigenvalues(s.m, s.c, s.k).flat().map(Math.abs))),
    verdict: 'physical',
    onDraw(g, view, s) {
      const alpha = -s.c / (2 * s.m);
      const unstable = alpha > 0;
      drawText(g, view, 'Re λ > 0: grows without bound', view.xMax, view.yMax, {
        color: cssVar('--unstable'), size: 11, align: 'right', dx: -8, dy: 16,
      });
      drawText(g, view, `Re λ = −c/2m = ${fmt(alpha, 3)}`, alpha, 0, {
        color: cssVar(unstable ? '--unstable' : '--muted'), size: 11, align: 'center', dy: 18,
      });
    },
  });

  // the unstable half-plane, on its own layer beneath the axes and the roots
  stage.onDraw(({ w, h }) => {
    const g = stage.ctx('shade');
    g.clearRect(0, 0, w, h);
    const view = plane.view;
    if (!view) return;
    const x0 = Math.max(0, Math.min(w, view.X(0)));
    g.save();
    g.fillStyle = cssVar('--unstable');
    g.globalAlpha = SHADE_ALPHA;
    g.fillRect(x0, 0, w - x0, h);
    g.restore();
  });

  // The only control: a way back from the what-if. Nothing here writes the tuple's c.
  const reset = el('button', { class: 'btn', type: 'button' }, 'reset c');
  reset.addEventListener('click', () => local.reset(), { signal });
  root.append(controls(row(reset)));
  const unsubscribe = local.subscribe(() => {
    reset.textContent = `reset c to the spring’s ${fmt(local.springC, 2)}`;
  });

  bindScrub(article, local, { signal });
  bindMath(article, local, s => {
    const d = discriminant(s.m, s.c, s.k), r = regime(s.m, s.c, s.k);
    const [l1, l2] = eigenvalues(s.m, s.c, s.k);
    const alpha = -s.c / (2 * s.m);
    return {
      disc: d,
      sign: r === 'critical' ? 'zero' : d < 0 ? 'negative' : 'positive',
      regime: r === 'critical' ? 'critically damped' : r,
      l1: cfmt(l1), l2: cfmt(l2),
      alpha,
      verdict: alpha < 0 ? 'negative: every mode decays and the spring settles'
        : alpha > 0 ? 'positive: the modes grow and the spring tears itself apart'
        : 'zero: the oscillation neither decays nor grows',
      localc: s.c,
      springc: local.springC,
      clo: C_RANGE[0],
    };
  }, { signal });

  return { destroy() { unsubscribe(); plane.destroy(); local.destroy(); } };
}
