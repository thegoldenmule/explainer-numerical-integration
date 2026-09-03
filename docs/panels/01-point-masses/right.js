// Panel 1, right: the step up from the point mass to the rigid body — add extent, add θ.
//
// The point grows into the L of `body.js`, whose body-local origin is its own area centroid,
// so the centre of mass is the body's anchor and lands exactly where the spine's point mass
// is. Position comes from the shared scene store: dragging the body here moves the same body
// the spine drags, which is what makes this a rung of the same ladder and not a new picture.
//
// θ is the coordinate a point mass could not have, and it is pane-local: the scene holds a
// point mass and has no room for a rotation, and a drill-down must not leave the tuple
// changed. Its store lives at module scope so a θ the reader set survives the pane manager
// destroying and remounting this pane, and it opens at a nonzero THETA0 so rotation reads as
// part of the state before anything has been touched.
//
// One facade over (scene position, local rotation) backs bindScrub and bindMath, so the three
// numbers of (x, y, θ) printed in the prose are themselves the controls.

import { clamp, fmt } from 'shared/dom.js';
import { createStore } from 'shared/state.js';
import { createStage } from 'shared/gfx/stage.js';
import { createDragHandles } from 'shared/gfx/drag.js';
import { cssVar, makeView, drawGrid, drawShape, drawPoint, drawPolyline, drawText } from 'shared/gfx/plot2d.js';
import { rotation, apply } from 'shared/math/matrix2.js';
import { scene, BODY_LIMITS } from 'shared/scene.js';
import { bindScrub } from 'shared/ui/scrub.js';
import { bindMath } from 'shared/ui/livemath.js';
import { BODY_RADIUS, worldPoints, grabSamples } from './body.js';

const HALF_W = 4;        // the same plane as the spine and panel 2, so the body never jumps
const CLAMP_Y = 2.2;
const HANDLE_R = BODY_RADIUS + 0.44;   // the rotate handle, clear of the body on its own axis
const ARC_R = 0.62;      // the θ arc, inside it
const THETA0 = 0.6;      // ≈ 34°: the body is already turned when the reader arrives
const THETA_LIMITS = [-Math.PI, Math.PI];
const GRAB_PX = 11;      // spacing of the body's grab samples, in CSS pixels
const HIT_PX = 14;       // createDragHandles' hit radius, wider than the lattice's own gaps

/** θ, the one piece of state the scene cannot hold. Module scope: it survives a remount. */
const rotationStore = createStore({ theta: THETA0 }, {
  limits: { theta: THETA_LIMITS },
  validate: key => { throw new Error(`1-right: unknown key ${key}`); },
  presets: {},
});

/** One store-shaped view of (x, y, θ): position from the scene, rotation from the local store. */
function stateFacade() {
  const get = () => {
    const { body } = scene.get();
    return { x: body.x[0], y: body.x[1], theta: rotationStore.get().theta, m: body.m };
  };
  return {
    get,
    set(patch) {
      const { body } = scene.get();
      const x = Number.isFinite(patch.x) ? patch.x : body.x[0];
      const y = Number.isFinite(patch.y) ? patch.y : body.x[1];
      if (x !== body.x[0] || y !== body.x[1]) scene.moveBody(x, y);
      if (Number.isFinite(patch.theta)) rotationStore.set({ theta: patch.theta });
      return get();
    },
    subscribe(fn, opts) {
      const relay = () => { const s = get(); fn(s, s); };
      const offScene = scene.subscribe(relay, opts);
      const offRot = rotationStore.subscribe(relay, { immediate: false });
      return () => { offScene(); offRot(); };
    },
    // tighter than BODY_LIMITS.x, so a scrub cannot push the body off this plane
    limits: { x: [-HALF_W, HALF_W], y: [-CLAMP_Y, CLAMP_Y], theta: THETA_LIMITS, m: BODY_LIMITS.m },
  };
}

/**
 * The angle from the +x axis round to θ. Plot angles run counter-clockwise and canvas y grows
 * downward, so plot angle a is canvas angle −a: the sweep 0 → θ is the canvas sweep 0 → −θ,
 * which runs counter-clockwise in canvas terms exactly when θ is positive.
 */
function drawAngle(g, view, x, y, theta) {
  if (Math.abs(theta) < 5e-3) return;
  g.save();
  g.strokeStyle = cssVar('--accent');
  g.lineWidth = 1.5 * view.dpr;
  g.beginPath();
  g.arc(view.X(x), view.Y(y), ARC_R * view.sx, 0, -theta, theta > 0);
  g.stroke();
  g.restore();
}

export function mount(root, ctx) {
  const { signal } = ctx;
  const article = root.closest('article') ?? root;
  const facade = stateFacade();
  let view = null;
  let grab = [0, 0];   // pointer-to-centre offset, so the body does not snap under the cursor

  const stage = createStage(root, { layers: ['plane'], aspect: 'wide', signal });

  // the grab lattice is spaced in CSS pixels, not body units, so it still covers the body on a
  // wide stage; it is rebuilt only when the view's scale changes, not on every pointermove
  let samples = { step: 0, pts: [] };
  const bodySamples = v => {
    const step = Math.max(0.06, GRAB_PX / (v.sx / v.dpr));
    if (step !== samples.step) samples = { step, pts: grabSamples(step) };
    return samples.pts;
  };
  const handlePoint = (theta, x, y) => [x + HANDLE_R * Math.cos(theta), y + HANDLE_R * Math.sin(theta)];

  stage.onDraw(({ w, h, dpr }) => {
    const { x, y, theta, m } = facade.get();
    const g = stage.ctx('plane');
    view = makeView({ w, h, dpr, halfW: HALF_W });
    g.clearRect(0, 0, w, h);
    drawGrid(g, view, { xLabel: 'x', yLabel: 'y' });

    // the body first: its fill is opaque, and at the default θ the arc and its label both fall
    // inside the L's foot, so everything that measures θ has to be painted over it
    drawShape(g, view, worldPoints(theta, x, y), null, { fill: cssVar('--accent-soft'), stroke: cssVar('--accent'), width: 2 });

    // θ is measured from a line parallel to the x axis through the centre of mass
    const [hx, hy] = handlePoint(theta, x, y);
    drawPolyline(g, view, [x, x + HANDLE_R], [y, y], { color: cssVar('--muted'), width: 1, dash: [4, 4], alpha: 0.8 });
    drawAngle(g, view, x, y, theta);
    drawText(g, view, 'θ', x + ARC_R * 1.45 * Math.cos(theta / 2), y + ARC_R * 1.45 * Math.sin(theta / 2),
      { color: cssVar('--accent'), size: 13, align: 'center', dy: 4 });

    drawPolyline(g, view, [x, hx], [y, hy], { color: cssVar('--accent'), width: 1.5 });
    drawPoint(g, view, hx, hy, { r: 6, fill: cssVar('--accent') });
    drawText(g, view, 'drag to rotate', hx, hy, { color: cssVar('--muted'), size: 10, dx: 11, dy: 4 });

    // the point mass is still in here: it is the centre of mass, drawn as the spine draws it
    drawPoint(g, view, x, y, { r: 6, fill: cssVar('--fg') });
    drawText(g, view, 'centre of mass', x, y, { color: cssVar('--muted'), size: 10, dx: 11, dy: 17 });
    drawText(g, view, `m = ${fmt(m, 2)}`, x, y, { color: cssVar('--muted'), size: 11, dx: 11, dy: 30 });
  });

  // ---- drags: anywhere on the body to move it, the handle on its axis to spin it ----
  createDragHandles(stage.canvas('plane'), {
    signal, hitRadius: HIT_PX,
    handles: () => {
      const { x, y, theta } = facade.get();
      const [hx, hy] = handlePoint(theta, x, y);
      const R = rotation(theta);
      const hs = [{ id: 'rot', x: hx, y: hy }];
      if (view) for (const p of bodySamples(view)) { const q = apply(R, p); hs.push({ id: 'body', x: q[0] + x, y: q[1] + y }); }
      return hs;
    },
    view: () => view ?? makeView({ w: 1, h: 1, dpr: 1, halfW: HALF_W }),
    onStart: (id, p) => { const { x, y } = facade.get(); grab = [x - p.x, y - p.y]; },
    onMove: (id, p) => {
      const { x, y } = facade.get();
      if (id === 'rot') {
        const dx = p.x - x, dy = p.y - y;
        if (Math.hypot(dx, dy) < 1e-6) return;
        facade.set({ theta: Math.atan2(dy, dx) });   // atan2 lands in (−π, π]: the clamp never bites
        return;
      }
      facade.set({ x: clamp(p.x + grab[0], -HALF_W, HALF_W), y: clamp(p.y + grab[1], -CLAMP_Y, CLAMP_Y) });
    },
  });

  const offScrub = bindScrub(article, facade, { signal });
  const offMath = bindMath(article, facade, undefined, { signal });
  const unsubScene = scene.subscribe(stage.invalidate, { immediate: false });
  const unsubRot = rotationStore.subscribe(stage.invalidate, { immediate: false });
  return { destroy() { unsubScene(); unsubRot(); offScrub(); offMath(); } };
}
