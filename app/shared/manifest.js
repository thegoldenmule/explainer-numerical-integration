// The spine, in essay order. This is the source of truth for titles and for which side
// panes exist; the router and loader never guess from the file system.
//
// `rung` records which entries of (method, h, m, c, k, x0, v0, t) are wildcards on the
// spine, per the ladder-of-abstraction reading in docs/idea.md.

export const manifest = Object.freeze([
  { index: 1,  part: 1, slug: '01-rigid-bodies',        title: 'Rigid bodies',
    rung: 'fully concrete',
    left:  { title: 'A point mass' },
    right: null },
  { index: 2,  part: 1, slug: '02-newtonian-physics',   title: 'Newtonian physics: F = ma',
    rung: 't stepped by hand',
    left:  { title: 'Vectors' },
    right: { title: 'Torque and moment of inertia' } },
  { index: 3,  part: 1, slug: '03-solving-for-x',       title: 'Solving for x',
    rung: 't = *',
    left:  { title: 'x, v, a: derivatives' },
    right: { title: 'ODEs vs PDEs' } },
  { index: 4,  part: 1, slug: '04-physical-stability',  title: 'Physical stability',
    rung: '(x₀, v₀) perturbed',
    left:  { title: 'What “close” means' },
    right: { title: 'Lyapunov vs asymptotic' } },
  { index: 5,  part: 1, slug: '05-linearize',           title: 'Stability analysis: linearize',
    rung: 'force models vary',
    left:  { title: 'What “linear” means' },
    right: { title: 'Taylor expansion and 1/r² gravity' } },
  { index: 6,  part: 1, slug: '06-eigen-what-now',      title: 'Eigen-what-now',
    rung: 'concrete matrix',
    left:  { title: 'Matrices as transforms' },
    right: { title: 'Complex eigenvalues: rotate and scale' } },
  { index: 7,  part: 1, slug: '07-finding-eigenvalues', title: 'Finding eigenvalues',
    rung: 'concrete (m, c, k) → λ',
    left:  { title: 'Quadratics and complex numbers' },
    right: { title: 'Under-, critically, and overdamped' } },
  { index: 8,  part: 2, slug: '08-recap-real-time',     title: 'Recap: real time',
    rung: 'h adjustable',
    left:  { title: 'Frame budget, ms per frame' },
    right: null },
  { index: 9,  part: 2, slug: '09-finding-error',       title: 'Finding error',
    rung: 't = * on error',
    left:  { title: 'Geometric growth' },
    right: { title: 'The modal equation' } },
  { index: 10, part: 2, slug: '10-explicit-euler',      title: 'Runge-Kutta family: explicit Euler',
    rung: '(m, c, k) = *',
    left:  { title: 'Euler step by step' },
    right: { title: 'Characteristic polynomial to disk' } },
  { index: 11, part: 2, slug: '11-lets-break-it',       title: 'Let’s break it',
    rung: 'plane + live simulation',
    left:  { title: 'Reading the complex plane' },
    right: { title: 'Methods with no scalar R' } },
  { index: 12, part: 2, slug: '12-higher-order-rk',     title: 'Higher-order Runge-Kutta',
    rung: 'method = *',
    left:  { title: 'Taylor series' },
    right: { title: 'Implicit methods: why hard' } },
  { index: 13, part: 2, slug: '13-variable-step-sizes', title: 'Variable step sizes',
    rung: 'h = h(t)',
    left:  { title: 'Local vs global error' },
    right: { title: 'Adaptive step controllers' } },
]);

export const PARTS = Object.freeze({
  1: 'Part I · How physics engines work, and how they break',
  2: 'Part II · Numerical methods, and where they stop working',
});

export const panelCount = manifest.length;
export const panelAt = index => manifest[index - 1];
