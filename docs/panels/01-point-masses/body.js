// The rigid body panel 1's drill-down grows the point mass into: an L, whose facing is
// unmistakable, so a rotation reads as a rotation and not as "the square looks the same".
//
// It lives in its own module because the body is a shared prop, not a detail of one pane:
// panel 2's drill-down puts torque on the same body, and `import { BODY, worldPoints } from
// 'panels/01-point-masses/body.js'` is all it takes to draw it there. Everything here is
// pure geometry — no DOM, no store, no canvas.
//
// Body-local coordinates have their origin at the body's own area centroid, so the anchor a
// pane rotates about and draws at is the centre of mass, and the centre of mass sits exactly
// where the spine's point mass sits.

import { rotation, apply } from 'shared/math/matrix2.js';

/** The L, in body units, before its centroid is subtracted. The long foot runs along +x. */
export const OUTLINE = Object.freeze([[0, 0], [1.6, 0], [1.6, 0.5], [0.5, 0.5], [0.5, 1.2], [0, 1.2]]);

/** Area centroid of a simple polygon (the shoelace formula). */
export function polygonCentroid(pts) {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[(i + 1) % pts.length];
    const cross = x0 * y1 - x1 * y0;
    a += cross; cx += (x0 + x1) * cross; cy += (y0 + y1) * cross;
  }
  a *= 0.5;
  return [cx / (6 * a), cy / (6 * a)];
}

/** Ray casting: is (x, y) inside the polygon? */
export function inside(pts, x, y) {
  let hit = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

/** The centre of mass of OUTLINE, in the raw outline's own coordinates. */
export const COM = Object.freeze(polygonCentroid(OUTLINE));

/** The body, origin at its centre of mass. This is the one every pane draws. */
export const BODY = Object.freeze(OUTLINE.map(([x, y]) => Object.freeze([x - COM[0], y - COM[1]])));

/** How far the farthest point of the body is from its centre of mass. */
export const BODY_RADIUS = Math.max(...BODY.map(p => Math.hypot(p[0], p[1])));

/** The body's outline in plot coordinates: rotated by θ about the centre of mass, then placed. */
export function worldPoints(theta, x, y, pts = BODY) {
  const R = rotation(theta);
  return pts.map(p => { const q = apply(R, p); return [q[0] + x, q[1] + y]; });
}

/**
 * A grab region for a move drag: points along the outline plus a lattice of interior ones,
 * `step` apart in body units. `createDragHandles` hit-tests against points, so "anywhere on
 * the body" has to be spelled out as points close enough together that its radius covers the
 * gaps between them.
 */
export function grabSamples(step, pts = BODY) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[(i + 1) % pts.length];
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / step));
    for (let k = 0; k < n; k++) out.push([x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n]);
  }
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  for (let x = Math.min(...xs); x <= Math.max(...xs); x += step) {
    for (let y = Math.min(...ys); y <= Math.max(...ys); y += step) {
      if (inside(pts, x, y)) out.push([x, y]);
    }
  }
  return out;
}
