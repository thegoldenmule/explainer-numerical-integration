// From the 2×2 system x' = A x to the modal equation x' = λx.
//
// For each eigenvalue λ of A = systemMatrix(m, c, k) the eigenvector is (1, λ), so a state
// (x, v) = a₁ (1, λ₁) + a₂ (1, λ₂) with complex coefficients a₁, a₂ (conjugates when the
// pair is). One step of any method with a scalar R(hλ) multiplies each aᵢ by R(hλᵢ), which
// is the whole content of "apply the integrator to the modal equation". The critical regime
// is defective (λ₁ = λ₂, one eigenvector), so it has no modal decomposition: project()
// returns NaN coefficients and decompose() says so.

import { cadd, csub, cmul, cdiv, cabs } from './complex.js';
import { eigenvalues, regime } from './system.js';
import { amplification } from './stability.js';

/** { lambdas: [λ₁, λ₂], vectors: [[1, λ₁], [1, λ₂]] (complex pairs), defective } */
export function decompose(m, c, k) {
  const lambdas = eigenvalues(m, c, k);
  return {
    lambdas,
    vectors: lambdas.map(l => [[1, 0], l]),
    defective: regime(m, c, k) === 'critical',
  };
}

/**
 * Coefficients [a₁, a₂] (complex) with (x, v) = a₁ (1, λ₁) + a₂ (1, λ₂):
 *   a₁ = (v − λ₂ x) / (λ₁ − λ₂),  a₂ = x − a₁.
 */
export function project(modes, x, v) {
  if (modes.defective) return [[NaN, NaN], [NaN, NaN]];
  const [l1, l2] = modes.lambdas;
  const a1 = cdiv(csub([v, 0], cmul(l2, [x, 0])), csub(l1, l2));
  return [a1, csub([x, 0], a1)];
}

/** Back to the real state: x = a₁ + a₂, v = a₁λ₁ + a₂λ₂ (imaginary parts cancel). */
export function reconstruct(modes, [a1, a2]) {
  const [l1, l2] = modes.lambdas;
  return { x: cadd(a1, a2)[0], v: cadd(cmul(a1, l1), cmul(a2, l2))[0] };
}

/** The per-mode multipliers R(hλᵢ); null entries for methods without a scalar R. */
export const modalFactors = (method, h, modes) => modes.lambdas.map(l => amplification(method, [l[0] * h, l[1] * h]));

/** One modal step, x_{i+1} = R(hλ) x_i, on every coefficient at once. */
export function modalStep(method, h, modes, coefficients) {
  const R = modalFactors(method, h, modes);
  if (R.some(r => r === null)) throw new Error(`${method} has no scalar amplification factor`);
  return coefficients.map((a, i) => cmul(R[i], a));
}

/**
 * Run the modal simulation from (x0, v0) to tEnd and reconstruct the state at each step.
 * Returns { t, x, v, modes, coefficients: [[a₁, a₂] per step], magnitudes: [|a₁| per step] }.
 */
export function simulateModal({ method, h, m, c, k, x0 = 1, v0 = 0 }, tEnd) {
  const modes = decompose(m, c, k);
  const n = Math.max(0, Math.floor(tEnd / h + 1e-9));
  const t = new Float64Array(n + 1), x = new Float64Array(n + 1), v = new Float64Array(n + 1);
  const magnitudes = new Float64Array(n + 1);
  const coefficients = [];
  let a = project(modes, x0, v0);
  for (let i = 0; ; i++) {
    const s = reconstruct(modes, a);
    t[i] = i * h; x[i] = s.x; v[i] = s.v; magnitudes[i] = cabs(a[0]);
    coefficients.push(a);
    if (i === n) break;
    a = modalStep(method, h, modes, a);
  }
  return { t, x, v, modes, coefficients, magnitudes, n: n + 1 };
}
