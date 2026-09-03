// Taylor tools: partial sums of e^z (the one series Euler and RK4 are truncations of), the
// expansion of 1/r² about an operating point, and the local truncation error of one step as
// the next term of the series.
//
// Euler is the degree-1 partial sum of e^{hλ}, RK4 the degree-4 one. The complex sum below
// is the single implementation; stability.taylorAmplification and the region shader's
// Taylor mode are that same Horner loop.

import { ONE, cadd, cmul, cscale } from './complex.js';

/** Σ_{i≤n} z^i / i!  for complex z = [re, im], by Horner. */
export function expPartialSumComplex(z, n) {
  let a = ONE;
  for (let i = Math.max(0, n | 0); i >= 1; i--) a = cadd(ONE, cscale(cmul(z, a), 1 / i));
  return a;
}

/** [1, 1, 1/2!, …, 1/n!] */
export function expCoefficients(n) {
  const c = [1];
  for (let i = 1; i <= n; i++) c.push(c[i - 1] / i);
  return c;
}

/** Σ_{i≤n} x^i / i!  on the real line. */
export const expPartialSum = (x, n) => expPartialSumComplex([x, 0], n)[0];

/** The terms x^i / i! for i = 0..n, so a pane can add them one at a time. */
export function expTerms(x, n) {
  const terms = [1];
  for (let i = 1; i <= n; i++) terms.push(terms[i - 1] * x / i);
  return terms;
}

const SUPERSCRIPT = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
const sup = n => String(n).split('').map(d => SUPERSCRIPT[d]).join('');

/** "1 + z + z²/2 + z³/6 + …" up to degree n, the partial sum of e^z as text; `sep` joins the terms. */
export function polynomialText(n, sep = ' + ') {
  const terms = ['1'];
  let f = 1;
  for (let i = 1; i <= n; i++) { f *= i; terms.push(i === 1 ? 'z' : `z${sup(i)}/${f}`); }
  return terms.join(sep);
}

/** The running partial sums S_0 … S_n of e^x. */
export function expPartialSums(x, n) {
  const terms = expTerms(x, n), sums = [];
  let s = 0;
  for (const term of terms) sums.push(s += term);
  return sums;
}

/**
 * 1/r² about r₀:  1/(r₀ + δ)² = Σ_{i≥0} (−1)^i (i + 1) δ^i / r₀^{i+2},  δ = r − r₀.
 * Keeps n + 1 terms (degrees 0..n). Degree 0 is the constant the essay's `m g` keeps.
 * Returns { r0, n, coefficients (of δ^i), terms(r), evaluate(r) }.
 */
export function inverseSquareExpansion(r0, n) {
  const coefficients = [];
  for (let i = 0; i <= n; i++) coefficients.push((i % 2 ? -1 : 1) * (i + 1) / r0 ** (i + 2));
  const terms = r => {
    const d = r - r0, out = [];
    let p = 1;
    for (let i = 0; i <= n; i++) { out.push(coefficients[i] * p); p *= d; }
    return out;
  };
  return {
    r0, n, coefficients, terms,
    evaluate: r => terms(r).reduce((a, b) => a + b, 0),
  };
}

/**
 * Derivatives of x(t) at a state, [x, x', x'', …, x^{(n)}], from the equation itself:
 * x'' = −(c x' + k x) / m, so every higher derivative follows by the same recursion.
 * Exact for the linear system, in every regime, with no closed form needed.
 */
export function derivatives(m, c, k, x, v, n) {
  const d = [x, v];
  for (let i = 2; i <= n; i++) d.push(-(c * d[i - 1] + k * d[i - 2]) / m);
  return d.slice(0, n + 1);
}

/** h^{p+1} / (p+1)! · |d|, the next Taylor term for a method of order p. */
export function truncationTerm(order, h, derivative) {
  let f = 1;
  for (let i = 2; i <= order + 1; i++) f *= i;
  return h ** (order + 1) / f * Math.abs(derivative);
}

/**
 * Local truncation error estimate for one step of size h from (x, v) with a method of
 * order p: the next Taylor term of x and of v (= the next-next term of x), as
 * { x, v, max }. Euler (p = 1) gives h²/2 · |a| for x.
 */
export function localTruncationError({ m, c, k, x, v, h, order }) {
  const d = derivatives(m, c, k, x, v, order + 2);
  const ex = truncationTerm(order, h, d[order + 1]);
  const ev = truncationTerm(order, h, d[order + 2]);
  return { x: ex, v: ev, max: Math.max(ex, ev) };
}
