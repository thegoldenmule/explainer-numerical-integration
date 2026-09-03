// Drag handles on a canvas: pointer capture, hit testing against a list of handles in plot
// coordinates, move/end callbacks, all attached with the pane's AbortSignal. Never touches
// wheel events; wheel is the page's swipe gesture.
//
// While a drag is active the canvas's enclosing .stage gets data-grab="active"; while the
// pointer rests over a handle it gets data-grab="hover"; otherwise the attribute is removed,
// so the stylesheet can set the cursor.

/**
 * createDragHandles(canvas, { handles, view, onStart, onMove, onEnd, signal, hitRadius })
 *   handles()   → [{ id, x, y }] in plot coordinates, read on every pointerdown/hover
 *   view()      → the current plot2d view (its fromEvent maps a pointer event to plot coords)
 *   onStart(id, point, event)   optional, when a handle is grabbed
 *   onMove(id, point, event)    on every pointermove while grabbed; point = { x, y } in plot coords
 *   onEnd(id, point, event)     optional, on release
 *   hitRadius   in CSS pixels (default 12)
 * Returns { active() → id | null }.
 */
export function createDragHandles(canvas, { handles, view, onStart, onMove, onEnd, signal, hitRadius = 12 }) {
  const stage = canvas.closest('.stage');
  let active = null, pointerId = null;
  const setGrab = state => { if (stage) { if (state) stage.dataset.grab = state; else delete stage.dataset.grab; } };

  function hit(ev) {
    const v = view();
    const r = canvas.getBoundingClientRect();
    const px = (ev.clientX - r.left) * v.dpr, py = (ev.clientY - r.top) * v.dpr;
    const radius = hitRadius * v.dpr;
    let best = null, dist = radius;
    for (const h of handles()) {
      const d = Math.hypot(v.X(h.x) - px, v.Y(h.y) - py);
      if (d <= dist) { dist = d; best = h; }
    }
    return best;
  }
  const point = ev => view().fromEvent(ev, canvas);

  canvas.addEventListener('pointerdown', ev => {
    if (ev.button !== 0 && ev.pointerType === 'mouse') return;
    const h = hit(ev);
    if (!h) return;
    active = h.id; pointerId = ev.pointerId;
    canvas.setPointerCapture(ev.pointerId);
    setGrab('active');
    ev.preventDefault();
    onStart?.(active, point(ev), ev);
  }, { signal });

  canvas.addEventListener('pointermove', ev => {
    if (active === null) { setGrab(hit(ev) ? 'hover' : null); return; }
    if (ev.pointerId !== pointerId) return;
    onMove(active, point(ev), ev);
  }, { signal });

  const release = ev => {
    if (active === null || ev.pointerId !== pointerId) return;
    const id = active;
    active = null; pointerId = null;
    if (canvas.hasPointerCapture(ev.pointerId)) canvas.releasePointerCapture(ev.pointerId);
    setGrab(null);
    onEnd?.(id, point(ev), ev);
  };
  canvas.addEventListener('pointerup', release, { signal });
  canvas.addEventListener('pointercancel', release, { signal });
  canvas.addEventListener('pointerleave', ev => { if (active === null) setGrab(null); }, { signal });
  signal?.addEventListener('abort', () => setGrab(null), { once: true });

  return { active: () => active };
}
