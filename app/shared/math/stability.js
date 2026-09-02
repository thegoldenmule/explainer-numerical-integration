// Numerical stability of each integrator on the modal equation x' = λx and on the 2×2 system.
//
// Euler, RK4, and implicit Euler have a scalar amplification factor R(hλ); the method is
// stable at λ iff |R(hλ)| ≤ 1. Semi-implicit Euler and Verlet do not, so for them (and as a
// cross-check for the others) we use the spectral radius of the 2×2 update matrix.

import { ONE, cadd, csub, cmul, cscale, cinv, cabs } from './complex.js';
import { systemMatrix, eigenvalues } from './system.js';
import { METHODS } from './integrators.js';
import { expPartialSumComplex } from './taylor.js';
import { I2, madd, msub, mscale, mmul, mdet, minv } from './matrix2.js';

/** R(z) for z = hλ (complex). null for methods without a scalar amplification factor. */
export function amplification(method, z) {
  switch (method) {
    case 'euler': return cadd(ONE, z);
    case 'implicit': return cinv(csub(ONE, z));
    case 'rk4': {
      // Horner: 1 + z(1 + z/2 (1 + z/3 (1 + z/4)))
      let a = cadd(ONE, cscale(z, 1 / 4));
      a = cadd(ONE, cscale(cmul(z, a), 1 / 3));
      a = cadd(ONE, cscale(cmul(z, a), 1 / 2));
      return cadd(ONE, cmul(z, a));
    }
    default: return null;
  }
}

/**
 * The degree-n Taylor partial sum of e^z, by Horner: 1 + z(1 + z/2(1 + … (1 + z/n))).
 * n = 1 is explicit Euler's R, n = 4 is RK4's; the RK1–RK3 regions of panel 12-right are the
 * degrees in between. n = 0 is the constant 1.
 */
export const taylorAmplification = (z, n) => expPartialSumComplex(z, n);

/** |R(hλ)|, or NaN when the method has no scalar R. */
export function ampFactor(method, z) {
  const r = amplification(method, z);
  return r ? cabs(r) : NaN;
}

/** Time for the numerical amplitude to double at growth factor rho per step of h. */
export const doublingTime = (h, rho) => (rho > 1 ? h * Math.LN2 / Math.log(rho) : Infinity);
/** Time for it to halve when rho < 1. */
export const halvingTime = (h, rho) => (rho < 1 && rho > 0 ? h * Math.LN2 / -Math.log(rho) : Infinity);

/**
 * The linear map one step applies to the state. For euler/rk4/implicit the state is (x, v);
 * for semi-implicit it is (x, v) with the updated v; for Verlet it is (x_n, x_{n−1}).
 */
export function updateMatrix(method, { m, c, k, h }) {
  const A = systemMatrix(m, c, k);
  switch (method) {
    case 'euler': return madd(I2, mscale(A, h));
    case 'rk4': {
      const hA = mscale(A, h);
      let P = madd(I2, mscale(hA, 1 / 4));
      P = madd(I2, mscale(mmul(hA, P), 1 / 3));
      P = madd(I2, mscale(mmul(hA, P), 1 / 2));
      return madd(I2, mmul(hA, P));
    }
    case 'implicit': return minv(msub(I2, mscale(A, h)));
    case 'semi': {
      const a = 1 - h * c / m, b = h * k / m;
      return [[1 - h * b, h * a], [-b, a]];
    }
    case 'verlet': {
      const p = h * c / m, q = h * h * k / m;
      return [[2 - p - q, p - 1], [1, 0]];
    }
    default: throw new Error(`unknown integrator: ${method}`);
  }
}

/** Largest |eigenvalue| of a real 2×2 matrix. */
export function spectralRadius(M) {
  const T = M[0][0] + M[1][1], D = mdet(M);
  const disc = T * T - 4 * D;
  if (disc < 0) return Math.sqrt(D);
  const s = Math.sqrt(disc);
  return Math.max(Math.abs((T + s) / 2), Math.abs((T - s) / 2));
}

/**
 * Everything a readout needs in one call.
 * { lambdas, factors (|R(hλ)| per λ, NaN if none), rho (spectral radius), stable, doublingTime }
 */
export function stabilityReport(method, { m, c, k, h }) {
  const lambdas = eigenvalues(m, c, k);
  const factors = lambdas.map(l => ampFactor(method, cscale(l, h)));
  const rho = spectralRadius(updateMatrix(method, { m, c, k, h }));
  return {
    method: METHODS[method],
    lambdas,
    factors,
    rho,
    stable: rho <= 1,
    doublingTime: doublingTime(h, rho),
  };
}

// ---- normalized coordinates (hω, ζ) ----
// Every update matrix's eigenvalues depend on (m, c, k, h) only through hω = h√(k/m) and
// ζ = c / (2√(mk)): scaling the state by diag(1, ω) is a similarity, and similar matrices
// share a spectrum. So the heatmaps for semi-implicit Euler and Verlet (12-right-3, 11-right)
// are drawn in this space, where their hω < 2 wall is a straight line. The mapping used is
// m = 1, k = 1 (so ω = 1), c = 2ζ, h = hω.

/** The update matrix of the unit-frequency system with damping ratio ζ at step hω. */
export const updateMatrixNormalized = (method, hw, zeta) => updateMatrix(method, { m: 1, c: 2 * zeta, k: 1, h: hw });

/** ρ of that matrix: the verdict for any (m, c, k, h) with the same hω and ζ. */
export const spectralRadiusNormalized = (method, hw, zeta) => spectralRadius(updateMatrixNormalized(method, hw, zeta));
