// A stage: the `.stage` box with a stack of canvases, sized to its CSS box, redrawn at most
// once per animation frame no matter how many store patches, resizes, or player frames ask.
//
//   const stage = createStage(root, { layers: ['region', 'plane'], signal });   // aspect: 'fill'
//   stage.onDraw(size => { const g = stage.ctx('plane'); ... });   // any number, in order
//   stage.invalidate();                                              // coalesced to one flush
//
// Layer names are free labels; canvases stack bottom to top in the order given. A 2D context
// is created lazily by `ctx(name)`, so a layer meant for a dedicated WebGL2 context (label it
// 'gl' by convention) can be handed to createRegionRenderer instead; a layer that receives
// region *blits* (drawRegion) is an ordinary 2D layer. Everything is torn down on `signal`.
//
// The aspect is the stage's sizing kind in the `.viz` column (CLAUDE.md, "Pane layout
// standard"); the CSS in controls.css does all the sizing, so a stage is appended straight
// into the `.viz`, in the order it should stack:
//   'fill'    (the default) full width; its height is its share of the column's free height,
//             capped at its width and never below a third of it. Draw for any aspect 3:1..1:1.
//   'square'  the largest square that fits its share, left-aligned; for content with a fixed
//             square extent. The square sits in a `.stage-slot` wrapper, which is what flexes.
//   'strip'   full width, fixed 3:1, does not grow: a secondary time series under a primary.

import { el } from '../dom.js';
import { fitCanvas, observeResize } from './plot2d.js';

const ASPECT_CLASS = { fill: 'fill', square: 'square', strip: 'strip', wide: 'wide', half: 'half', tall: 'tall' };

/**
 * createStage(root, { layers = ['2d'], aspect = 'fill', signal, grab, draw })
 *   → { el, box, canvases, canvas(name), ctx(name), size, onDraw(fn) → off, invalidate(), flush(), destroy() }
 *   `el` is the `.stage` itself; `box` is what was appended to `root` (the `.stage-slot` of a
 *   square, otherwise `el`). Draw callbacks receive `size = { w, h, dpr }` in device pixels.
 */
export function createStage(root, { layers = ['2d'], aspect = 'fill', signal, grab = false, draw } = {}) {
  const canvases = new Map();
  const contexts = new Map();
  for (const name of layers) {
    if (canvases.has(name)) throw new Error(`stage: duplicate layer "${name}"`);
    canvases.set(name, el('canvas', { 'data-layer': name }));
  }
  const cls = ASPECT_CLASS[aspect];
  if (cls == null) throw new Error(`stage: unknown aspect "${aspect}"`);
  const node = el('div', { class: `stage ${cls}`, 'data-grab': grab ? '' : null }, [...canvases.values()]);
  const box = aspect === 'square' ? el('div', { class: 'stage-slot' }, node) : node;
  root?.append(box);

  const draws = new Set();
  if (draw) draws.add(draw);
  let size = { w: 1, h: 1, dpr: 1 };
  let pending = 0;
  let dead = false;

  function flush() {
    pending = 0;
    if (dead) return;
    for (const c of canvases.values()) size = fitCanvas(c);
    for (const fn of draws) fn(size);
  }
  function invalidate() {
    if (pending || dead) return;
    pending = requestAnimationFrame(flush);
  }

  const stopResize = observeResize(node, invalidate);

  function destroy() {
    if (dead) return;
    dead = true;
    stopResize();
    if (pending) cancelAnimationFrame(pending);
    draws.clear();
    box.remove();
  }
  signal?.addEventListener('abort', destroy, { once: true });

  return {
    el: node,
    box,
    canvases: [...canvases.values()],
    canvas(name) {
      const c = canvases.get(name);
      if (!c) throw new Error(`stage: no layer "${name}"`);
      return c;
    },
    /** The 2D context of a layer, created on first use. */
    ctx(name) {
      if (!contexts.has(name)) contexts.set(name, this.canvas(name).getContext('2d'));
      return contexts.get(name);
    },
    get size() { return size; },
    /** Register a draw callback. Returns a function that removes it. */
    onDraw(fn) { draws.add(fn); invalidate(); return () => draws.delete(fn); },
    invalidate,
    flush,
    destroy,
    /** cursor feedback for a drag in progress: stage.grabbing(true | false) */
    grabbing(active) { if (grab) node.dataset.grab = active ? 'active' : ''; },
  };
}
