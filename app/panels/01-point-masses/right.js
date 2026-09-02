// Panel 1, right: one rigid body with (x, y, θ) readouts. Placeholder interactive that proves
// the pane contract: stage, plot2d view, pointer events on ctx.signal, store subscription,
// clean destroy.

import { fmt } from 'shared/dom.js';
import { makeView, drawGrid, cssVar } from 'shared/gfx/plot2d.js';
import { createStage } from 'shared/gfx/stage.js';
import { readout } from 'shared/ui/controls.js';

export function mount(root, ctx) {
  const stage = createStage(root, { layers: ['plane'], signal: ctx.signal, grab: true });
  const canvas = stage.canvas('plane');
  const out = readout({ label: 'state' });
  root.append(out.el);

  const body = { x: 0, y: 0, theta: 0, w: 1.6, h: 1 };
  let view;

  stage.onDraw(({ w, h, dpr }) => {
    const g = stage.ctx('plane');
    view = makeView({ w, h, dpr, halfW: 4 });
    g.clearRect(0, 0, w, h);
    drawGrid(g, view, { xLabel: 'x', yLabel: 'y' });
    g.save();
    g.translate(view.X(body.x), view.Y(body.y));
    g.rotate(-body.theta);
    const pw = body.w * view.sx, ph = body.h * view.sy;
    g.fillStyle = cssVar('--accent-soft');
    g.strokeStyle = cssVar('--accent');
    g.lineWidth = 2 * dpr;
    g.beginPath(); g.rect(-pw / 2, -ph / 2, pw, ph); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(0, 0); g.lineTo(pw / 2, 0); g.stroke();   // body axis
    g.fillStyle = cssVar('--accent');
    g.beginPath(); g.arc(0, 0, 3 * dpr, 0, Math.PI * 2); g.fill();      // center of mass
    g.restore();
    out.set(`x = ${fmt(body.x, 2)}\ny = ${fmt(body.y, 2)}\nθ = ${fmt(body.theta, 2)} rad\nm = ${ctx.store.get().m} (from the shared store)`);
  });

  const inside = p => {
    const dx = p.x - body.x, dy = p.y - body.y, c = Math.cos(body.theta), s = Math.sin(body.theta);
    const lx = dx * c + dy * s, ly = -dx * s + dy * c;
    return Math.abs(lx) <= body.w / 2 && Math.abs(ly) <= body.h / 2;
  };
  let drag = null;
  const { signal } = ctx;
  canvas.addEventListener('pointerdown', e => {
    if (!view) return;
    const p = view.fromEvent(e, canvas);
    if (!inside(p)) return;
    drag = { dx: body.x - p.x, dy: body.y - p.y };
    stage.grabbing(true);
    canvas.setPointerCapture(e.pointerId);
  }, { signal });
  canvas.addEventListener('pointermove', e => {
    if (!drag) return;
    const p = view.fromEvent(e, canvas);
    body.x = p.x + drag.dx; body.y = p.y + drag.dy;
    stage.invalidate();
  }, { signal });
  canvas.addEventListener('pointerup', () => { drag = null; stage.grabbing(false); }, { signal });
  // No wheel handler: wheel events are the page's swipe gesture and must never be cancelled.

  const unsubscribe = ctx.store.subscribe(stage.invalidate);
  return { destroy() { unsubscribe(); } };
}
