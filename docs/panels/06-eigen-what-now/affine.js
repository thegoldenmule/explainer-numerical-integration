// Homogeneous 3×3 affine matrices, for panel 6's left pane only. shared/math/matrix2.js is
// 2×2 and always will be — the rest of the piece never translates anything — but this pane's
// whole subject is the translation column, which a 2×2 cannot hold. Row-major, with the
// bottom row pinned to [0 0 1]:
//
//   [ a  b  tx ]
//   [ c  d  ty ]
//   [ 0  0   1 ]

/** T(tx, ty) · R(θ) · S(s): scale, then turn, then move — the order an engine composes. */
export function trs({ tx = 0, ty = 0, theta = 0, s = 1 }) {
  const c = Math.cos(theta), sn = Math.sin(theta);
  return [[s * c, -s * sn, tx], [s * sn, s * c, ty], [0, 0, 1]];
}

/** M p for a plane point, in homogeneous coordinates with w = 1. */
export const applyPoint = (M, [x, y]) => [
  M[0][0] * x + M[0][1] * y + M[0][2],
  M[1][0] * x + M[1][1] * y + M[1][2],
];

/** The determinant of the linear part: the area factor (the 3×3's determinant is the same). */
export const areaFactor = M => M[0][0] * M[1][1] - M[0][1] * M[1][0];

/**
 * plot2d's drawTransformedGrid with a translation: the lattice under a 3×3, so the origin
 * moves with everything else. `color` is required (this file imports nothing, so it cannot
 * read a CSS custom property itself).
 */
export function drawAffineGrid(ctx, view, M, { spacing = 1, extent = 12, color, width = 1, alpha = 1 } = {}) {
  const line = (p, q) => {
    const [x0, y0] = applyPoint(M, p), [x1, y1] = applyPoint(M, q);
    ctx.moveTo(view.X(x0), view.Y(y0));
    ctx.lineTo(view.X(x1), view.Y(y1));
  };
  ctx.save();
  ctx.lineWidth = width * view.dpr;
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.beginPath();
  for (let i = Math.ceil(-extent / spacing) * spacing; i <= extent; i += spacing) {
    line([i, -extent], [i, extent]);
    line([-extent, i], [extent, i]);
  }
  ctx.stroke();
  ctx.restore();
}
