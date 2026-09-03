// Panel 1, spine: the point mass itself, fully concrete — no wildcards, nothing animated.
// One dot on the plane with its two coordinates drawn as drop lines onto the axes, plus the
// mass. The dot is dragged through the shared scene store, not a local variable, so the body
// panel 2 hangs its force arrows on and panel 5 scrubs its force models around is the same
// body the reviewer just moved here.
//
// The dot's size never changes with m: this panel's one sentence is "all the mass at one
// point, no extent", and a dot that grows with mass would draw the opposite. The mass shows
// up as a number beside the point (drawText) and in the prose (bindMath).
//
// Nothing writes the tuple on mount. All three numbers — x, y, m — are scrubbable right in
// the block equation, the same as panel 1's right pane does for (x, y, θ): one store-shaped
// facade over the scene body backs both bindScrub and bindMath, so the printed numbers are
// themselves the controls, not just a readout of the canvas drag. x and y route through
// scene.moveBody, m through scene.setMass, the scene's one documented sync into the tuple's m.

import { clamp, fmt } from 'shared/dom.js';
import { createStage } from 'shared/gfx/stage.js';
import { createDragHandles } from 'shared/gfx/drag.js';
import { cssVar, makeView, drawGrid, drawPoint, drawPolyline, drawText } from 'shared/gfx/plot2d.js';
import { scene, BODY_LIMITS } from 'shared/scene.js';
import { bindMath } from 'shared/ui/livemath.js';
import { bindScrub } from 'shared/ui/scrub.js';

const HALF_W = 4;       // the same plane as panel 2's spine, so the body does not jump
const CLAMP_Y = 2.2;
const BODY_R = 9;

/** A store-shaped view of (x, y, m): the three numbers printed in the spine's own equation. */
function stateFacade() {
  const get = () => { const { body } = scene.get(); return { x: body.x[0], y: body.x[1], m: body.m }; };
  return {
    get,
    set(patch) {
      const { body } = scene.get();
      const x = Number.isFinite(patch.x) ? patch.x : body.x[0];
      const y = Number.isFinite(patch.y) ? patch.y : body.x[1];
      if (x !== body.x[0] || y !== body.x[1]) scene.moveBody(x, y);
      if (Number.isFinite(patch.m)) scene.setMass(patch.m);
      return get();
    },
    subscribe(fn, opts) {
      const relay = () => { const s = get(); fn(s, s); };
      return scene.subscribe(relay, opts);
    },
    // tighter than BODY_LIMITS.x, so a scrub cannot push the body past this plane's edge
    limits: { x: [-HALF_W, HALF_W], y: [-CLAMP_Y, CLAMP_Y], m: BODY_LIMITS.m },
  };
}

export function mount(root, ctx) {
  const { signal } = ctx;
  const article = root.closest('article') ?? root;
  const facade = stateFacade();
  let view = null;
  let grab = [0, 0];    // pointer-to-body offset, so the dot does not snap under the cursor

  const stage = createStage(root, { layers: ['plane'], aspect: 'wide', signal });

  stage.onDraw(({ w, h, dpr }) => {
    const { body } = scene.get();
    const [x, y] = body.x;
    const g = stage.ctx('plane');
    view = makeView({ w, h, dpr, halfW: HALF_W });
    g.clearRect(0, 0, w, h);
    drawGrid(g, view, { xLabel: 'x', yLabel: 'y' });

    // the two numbers, drawn: where the point sits on each axis
    const guide = { color: cssVar('--accent'), width: 1, dash: [4, 4], alpha: 0.6 };
    drawPolyline(g, view, [x, x], [0, y], guide);
    drawPolyline(g, view, [0, x], [y, y], guide);
    drawText(g, view, `x = ${fmt(x, 2)}`, x, 0, { color: cssVar('--accent'), size: 11, align: 'center', dy: y >= 0 ? 16 : -8 });
    drawText(g, view, `y = ${fmt(y, 2)}`, 0, y, { color: cssVar('--accent'), size: 11, align: x >= 0 ? 'right' : 'left', dx: x >= 0 ? -8 : 8, dy: -6 });

    drawPoint(g, view, x, y, { r: BODY_R, fill: cssVar('--fg') });
    drawText(g, view, `m = ${fmt(body.m, 2)}`, x, y, { color: cssVar('--muted'), size: 11, dx: BODY_R + 6, dy: 4 });
    drawText(g, view, 'drag it', view.xMin, view.yMax, { color: cssVar('--muted'), size: 11, dx: 8, dy: 18 });
  });

  // ---- drag the mass ----
  createDragHandles(stage.canvas('plane'), {
    signal, hitRadius: 16,
    handles: () => { const p = scene.get().body.x; return [{ id: 'body', x: p[0], y: p[1] }]; },
    view: () => view ?? makeView({ w: 1, h: 1, dpr: 1, halfW: HALF_W }),
    onStart: (id, p) => { const b = scene.get().body.x; grab = [b[0] - p.x, b[1] - p.y]; },
    onMove: (id, p) => scene.moveBody(clamp(p.x + grab[0], -HALF_W, HALF_W), clamp(p.y + grab[1], -CLAMP_Y, CLAMP_Y)),
  });

  const offMath = bindMath(article, facade, undefined, { signal });
  const offScrub = bindScrub(article, facade, { signal });
  const unsub = scene.subscribe(stage.invalidate, { immediate: false });
  return { destroy() { unsub(); offMath(); offScrub(); } };
}
