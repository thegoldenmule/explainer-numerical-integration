// Panel 1, spine: a point mass with (x, y) and m readouts. Placeholder that proves the
// pane contract end to end.

import { fmt } from 'shared/dom.js';
import { makeView, drawGrid, drawPoint, cssVar } from 'shared/gfx/plot2d.js';
import { createStage } from 'shared/gfx/stage.js';
import { readout } from 'shared/ui/controls.js';

export function mount(root, ctx) {
  const stage = createStage(root, { layers: ['plane'], signal: ctx.signal });
  const out = readout({ label: 'state' });
  root.append(out.el);
  const p = { x: 1, y: 0.5 };

  stage.onDraw(({ w, h, dpr }) => {
    const g = stage.ctx('plane');
    const view = makeView({ w, h, dpr, halfW: 4 });
    g.clearRect(0, 0, w, h);
    drawGrid(g, view, { xLabel: 'x', yLabel: 'y' });
    drawPoint(g, view, p.x, p.y, { r: 7, fill: cssVar('--accent') });
    out.set(`x = ${fmt(p.x, 2)}\ny = ${fmt(p.y, 2)}\nm = ${ctx.store.get().m}`);
  });
  const unsubscribe = ctx.store.subscribe(stage.invalidate);
  return { destroy() { unsubscribe(); } };
}
