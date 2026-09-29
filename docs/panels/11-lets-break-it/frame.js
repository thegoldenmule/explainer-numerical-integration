// The plane's framing per method, shared by the spine and the right pane: each method's
// region at step h, in view with a margin, whatever h is. In units of 1/h, since every
// region scales with it: `scale` is the region's vertical extent (right's grid rows sit at
// 0.45, 0.7, 0.9 of it), cx and half frame the view around it.

export const GEOM = {
  euler:    { scale: 1,   cx: -0.7, half: 1.5 },
  implicit: { scale: 1,   cx: 0.7,  half: 1.5 },
  rk4:      { scale: 2.8, cx: -1,   half: 4.6 },
  semi:     { scale: 2,   cx: -0.6, half: 3 },
  verlet:   { scale: 2,   cx: -0.6, half: 3 },
};

const geom = method => GEOM[method] ?? GEOM.euler;

/** The view around `method`'s whole region at step `h`: { cx, half } in λ units. */
export function regionFrame(method, h) {
  const g = geom(method);
  return { cx: g.cx / h, half: g.half / h };
}

const MARGIN = 1.15;

/**
 * regionFrame, grown if need be so every λ in `roots` is in view too, with a margin. The view
 * is at least ±half on both axes about (cx, 0) (a stage wider than tall shows more real axis).
 */
export function frameWith(method, h, roots) {
  const f = regionFrame(method, h);
  let half = f.half;
  for (const [re, im] of roots) half = Math.max(half, MARGIN * Math.abs(im), MARGIN * Math.abs(re - f.cx));
  return { cx: f.cx, half };
}
