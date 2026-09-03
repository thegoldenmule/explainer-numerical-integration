// Complex numbers as [re, im] pairs. Hand-rolled: the whole app needs about a dozen lines.
// Modules inside shared/ import each other relatively so `node --test` can run them.

export const C = (re, im = 0) => [re, im];
export const ONE = Object.freeze([1, 0]);

export const cadd = (a, b) => [a[0] + b[0], a[1] + b[1]];
export const csub = (a, b) => [a[0] - b[0], a[1] - b[1]];
export const cmul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
export const cscale = (a, s) => [a[0] * s, a[1] * s];
export const cconj = a => [a[0], -a[1]];
export const cabs = a => Math.hypot(a[0], a[1]);
export const carg = a => Math.atan2(a[1], a[0]);

export function cinv(a) {
  const n = a[0] * a[0] + a[1] * a[1];
  return [a[0] / n, -a[1] / n];
}
export const cdiv = (a, b) => cmul(a, cinv(b));

export function cexp(a) {
  const e = Math.exp(a[0]);
  return [e * Math.cos(a[1]), e * Math.sin(a[1])];
}

/** "−0.005 + 1.000i" style formatting for readouts. */
export function cfmt(a, digits = 3) {
  const re = a[0].toFixed(digits);
  const im = Math.abs(a[1]).toFixed(digits);
  const sign = a[1] < 0 ? '−' : '+';
  return `${re.replace('-', '−')} ${sign} ${im}i`;
}
