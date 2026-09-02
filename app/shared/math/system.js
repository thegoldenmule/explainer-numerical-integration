// The damped mass-spring  m x'' + c x' + k x = 0  and everything closed-form about it:
// eigenvalues, damping regime, exact solution, system matrix.

/** Relative tolerance for calling the discriminant zero. Sliders never hit equality exactly. */
export const CRITICAL_TOL = 1e-6;

export const discriminant = (m, c, k) => c * c - 4 * m * k;

/** 'underdamped' | 'critical' | 'overdamped' */
export function regime(m, c, k) {
  const d = discriminant(m, c, k);
  const scale = Math.max(c * c, 4 * m * k, Number.MIN_VALUE);
  if (Math.abs(d) <= CRITICAL_TOL * scale) return 'critical';
  return d < 0 ? 'underdamped' : 'overdamped';
}

/** Roots of m λ² + c λ + k = 0 as two complex [re, im] pairs. */
export function eigenvalues(m, c, k) {
  const alpha = -c / (2 * m);
  switch (regime(m, c, k)) {
    case 'critical': return [[alpha, 0], [alpha, 0]];
    case 'underdamped': {
      const w = Math.sqrt(-discriminant(m, c, k)) / (2 * m);
      return [[alpha, w], [alpha, -w]];
    }
    default: {
      const s = Math.sqrt(discriminant(m, c, k)) / (2 * m);
      return [[alpha + s, 0], [alpha - s, 0]];
    }
  }
}

/** Natural frequency √(k/m) and damping ratio c / (2√(mk)). */
export const naturalFrequency = (m, k) => Math.sqrt(k / m);
export const dampingRatio = (m, c, k) => c / (2 * Math.sqrt(m * k));

/** First-order form x' = A x with x = (x, v):  A = [[0, 1], [−k/m, −c/m]]. */
export const systemMatrix = (m, c, k) => [[0, 1], [-k / m, -c / m]];

/** a(x, v) = −(c v + k x) / m */
export const acceleration = (m, c, k) => (x, v) => -(c * v + k * x) / m;

/**
 * Closed-form solution. Returns { regime, x(t), v(t) }.
 *   underdamped: x = e^{αt} (x₀ cos ωt + (v₀ − αx₀)/ω · sin ωt)
 *   critical:    x = e^{αt} (x₀ + (v₀ − αx₀) t)
 *   overdamped:  x = A e^{r₁t} + B e^{r₂t},  A = (v₀ − r₂x₀)/(r₁ − r₂),  B = x₀ − A
 */
export function exactSolution({ m, c, k, x0 = 1, v0 = 0 }) {
  const r = regime(m, c, k);
  const alpha = -c / (2 * m);
  if (r === 'underdamped') {
    const w = Math.sqrt(-discriminant(m, c, k)) / (2 * m);
    const A = x0, B = (v0 - alpha * x0) / w;
    return {
      regime: r,
      x: t => Math.exp(alpha * t) * (A * Math.cos(w * t) + B * Math.sin(w * t)),
      v: t => Math.exp(alpha * t) * ((alpha * A + w * B) * Math.cos(w * t) + (alpha * B - w * A) * Math.sin(w * t)),
    };
  }
  if (r === 'critical') {
    const A = x0, B = v0 - alpha * x0;
    return {
      regime: r,
      x: t => Math.exp(alpha * t) * (A + B * t),
      v: t => Math.exp(alpha * t) * (alpha * A + B + alpha * B * t),
    };
  }
  const s = Math.sqrt(discriminant(m, c, k)) / (2 * m);
  const r1 = alpha + s, r2 = alpha - s;
  const A = (v0 - r2 * x0) / (r1 - r2), B = x0 - A;
  return {
    regime: r,
    x: t => A * Math.exp(r1 * t) + B * Math.exp(r2 * t),
    v: t => A * r1 * Math.exp(r1 * t) + B * r2 * Math.exp(r2 * t),
  };
}
