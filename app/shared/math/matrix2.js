// Real 2×2 matrices as [[a, b], [c, d]] (row-major) and 2-vectors as [x, y]. The helpers
// stability.js needs for the update matrices, the constructors panel 6 drags (rotation,
// scale, shear), and an eigen-decomposition that says, honestly, when the invariant
// directions stop existing: real eigenvalues with unit eigenvectors while the discriminant
// allows, the complex pair with `vectors: null` once it does not. 6-right's rotation sweep
// is built to show exactly that moment.

import { CRITICAL_TOL } from './system.js';

export const I2 = Object.freeze([Object.freeze([1, 0]), Object.freeze([0, 1])]);
export const identity = () => [[1, 0], [0, 1]];

export const madd = (A, B) => [[A[0][0] + B[0][0], A[0][1] + B[0][1]], [A[1][0] + B[1][0], A[1][1] + B[1][1]]];
export const msub = (A, B) => [[A[0][0] - B[0][0], A[0][1] - B[0][1]], [A[1][0] - B[1][0], A[1][1] - B[1][1]]];
export const mscale = (A, s) => [[A[0][0] * s, A[0][1] * s], [A[1][0] * s, A[1][1] * s]];
export const mmul = (A, B) => [
  [A[0][0] * B[0][0] + A[0][1] * B[1][0], A[0][0] * B[0][1] + A[0][1] * B[1][1]],
  [A[1][0] * B[0][0] + A[1][1] * B[1][0], A[1][0] * B[0][1] + A[1][1] * B[1][1]],
];
export const mdet = A => A[0][0] * A[1][1] - A[0][1] * A[1][0];
export const mtrace = A => A[0][0] + A[1][1];
export const mtranspose = A => [[A[0][0], A[1][0]], [A[0][1], A[1][1]]];
/** Inverse; entries are ±Infinity/NaN when the matrix is singular (no throw). */
export const minv = A => mscale([[A[1][1], -A[0][1]], [-A[1][0], A[0][0]]], 1 / mdet(A));

/** Counter-clockwise rotation by θ radians (in y-up coordinates). */
export const rotation = theta => {
  const c = Math.cos(theta), s = Math.sin(theta);
  return [[c, -s], [s, c]];
};
/** Scale by sx along x and sy along y (sy defaults to sx). */
export const scale = (sx, sy = sx) => [[sx, 0], [0, sy]];
/** Shear: x' = x + kx·y, y' = y + ky·x. */
export const shear = (kx, ky = 0) => [[1, kx], [ky, 1]];

/** M v */
export const apply = (M, v) => [M[0][0] * v[0] + M[0][1] * v[1], M[1][0] * v[0] + M[1][1] * v[1]];

const unit = v => {
  const n = Math.hypot(v[0], v[1]);
  return n === 0 ? [1, 0] : [v[0] / n, v[1] / n];
};

/** Unit eigenvector of M for a real eigenvalue λ, from a nonzero row of M − λI. */
function eigenvector(M, lambda) {
  const [[a, b], [c, d]] = M;
  // (a − λ) x + b y = 0  and  c x + (d − λ) y = 0; take whichever row is not identically zero
  if (Math.abs(b) > 0) return unit([b, lambda - a]);
  if (Math.abs(c) > 0) return unit([lambda - d, c]);
  // diagonal: the axes, matched to the diagonal entry that equals λ
  return Math.abs(a - lambda) <= Math.abs(d - lambda) ? [1, 0] : [0, 1];
}

/**
 * eigen(M) → { values: [[re, im], [re, im]], vectors: [[x, y], [x, y]] | null, real, defective }
 *   values    the two eigenvalues as complex pairs, in the order system.eigenvalues uses:
 *             the larger real root first, or the positive-imaginary one first
 *   vectors   unit eigenvectors matching `values` when both eigenvalues are real; null for
 *             a complex pair (no real invariant direction exists)
 *   real      true when both eigenvalues are real
 *   defective a repeated real eigenvalue with only one eigenvector (a shear): vectors
 *             holds that one direction twice
 * The discriminant is compared to zero with the same relative tolerance system.regime uses,
 * so eigen(systemMatrix(m, c, k)) agrees with eigenvalues(m, c, k) in every regime.
 */
export function eigen(M) {
  const T = mtrace(M), D = mdet(M);
  const disc = T * T - 4 * D;
  const tol = CRITICAL_TOL * Math.max(T * T, Math.abs(4 * D), Number.MIN_VALUE);
  if (Math.abs(disc) <= tol) {
    const l = T / 2;
    const v = eigenvector(M, l);
    // repeated root: a multiple of the identity has every direction, a shear has one
    const isScalar = Math.abs(M[0][1]) <= tol && Math.abs(M[1][0]) <= tol && Math.abs(M[0][0] - M[1][1]) <= tol;
    return { values: [[l, 0], [l, 0]], vectors: isScalar ? [[1, 0], [0, 1]] : [v, v], real: true, defective: !isScalar };
  }
  if (disc < 0) {
    const w = Math.sqrt(-disc) / 2;
    return { values: [[T / 2, w], [T / 2, -w]], vectors: null, real: false, defective: false };
  }
  const s = Math.sqrt(disc) / 2;
  const l1 = T / 2 + s, l2 = T / 2 - s;
  return { values: [[l1, 0], [l2, 0]], vectors: [eigenvector(M, l1), eigenvector(M, l2)], real: true, defective: false };
}
