// The force models of Part I, each as a real and a linearized function, and the scene they
// act on. A scene is plain data so a store can hold and clone it:
//
//   scene = { body: { m, x: [x, y], v: [vx, vy] }, forces: [force, …] }
//   force = { type, on, …params }            (see createForce)
//
// Models are looked up by `type`. Each has parameter defaults, real(force, body) and
// linear(force, body) returning a 2D force vector, and coefficients(force) → { C, K }: what
// the linear model contributes to  M x'' + C x' + K x = 0.  Constant forces (wind, m g)
// contribute nothing; the equation is homogeneous and they are forcing terms.
//
// Coordinates: the body's reference position is the origin, "down" is −y.

const DOWN = [0, -1];
const ZERO = () => [0, 0];
const scale = ([x, y], s) => [x * s, y * s];

export const MODELS = Object.freeze({
  /** A constant vector, the same everywhere. Already linear. */
  wind: {
    label: 'Wind',
    defaults: { fx: 1, fy: 0 },
    real: f => [f.fx, f.fy],
    linear: f => [f.fx, f.fy],
    coefficients: () => ({ C: 0, K: 0 }),
  },
  /**
   * Newton's gravitation toward an attractor of mass m2 sitting a distance r below the
   * origin. Real: G m1 m2 / dist² along the line to the attractor. Linear: m1 g straight
   * down with g = G m2 / r², which equals the real force at the operating point (the origin).
   */
  gravity: {
    label: 'Gravity',
    defaults: { G: 1, m2: 100, r: 10 },
    real: (f, body) => {
      const dx = 0 - body.x[0], dy = -f.r - body.x[1];
      const dist = Math.hypot(dx, dy);
      if (dist === 0) return ZERO();
      return scale([dx / dist, dy / dist], f.G * body.m * f.m2 / (dist * dist));
    },
    linear: (f, body) => scale(DOWN, body.m * gravityG(f)),
    coefficients: () => ({ C: 0, K: 0 }),
  },
  /** Drag proportional to velocity, −c v. Already linear: real and linear coincide. */
  drag: {
    label: 'Drag',
    defaults: { c: 0.1 },
    real: (f, body) => scale(body.v, -f.c),
    linear: (f, body) => scale(body.v, -f.c),
    coefficients: f => ({ C: f.c, K: 0 }),
  },
  /** A spring anchored at the origin with zero rest length, −k x. Already linear. */
  spring: {
    label: 'Spring',
    defaults: { k: 100 },
    real: (f, body) => scale(body.x, -f.k),
    linear: (f, body) => scale(body.x, -f.k),
    coefficients: f => ({ C: 0, K: f.k }),
  },
});
export const FORCE_TYPES = Object.freeze(Object.keys(MODELS));

/** The linear model's g for a gravity force: G m2 / r². */
export const gravityG = f => f.G * f.m2 / (f.r * f.r);

/** A force instance: plain data, defaults filled in, on unless told otherwise. */
export function createForce(type, overrides = {}) {
  const model = MODELS[type];
  if (!model) throw new Error(`unknown force: ${type}`);
  return { type, on: true, ...model.defaults, ...overrides };
}

/** A body at rest at the origin plus the given forces. */
export function createScene({ m = 1, x = [0, 0], v = [0, 0], forces = [] } = {}) {
  return { body: { m, x: [...x], v: [...v] }, forces: forces.map(f => ({ ...f })) };
}

/** One force's vector on the body, real or linear. */
export function forceOf(force, body, { linear = false } = {}) {
  const model = MODELS[force.type];
  if (!model) throw new Error(`unknown force: ${force.type}`);
  return linear ? model.linear(force, body) : model.real(force, body);
}

/** Sum of the active forces as [fx, fy]. */
export function netForce(scene, opts = {}) {
  const sum = ZERO();
  for (const f of scene.forces) {
    if (!f.on) continue;
    const [fx, fy] = forceOf(f, scene.body, opts);
    sum[0] += fx; sum[1] += fy;
  }
  return sum;
}

/** F / m for the active forces. */
export const acceleration = (scene, opts) => scale(netForce(scene, opts), 1 / scene.body.m);

/**
 * The coefficients of  M x'' + C x' + K x = 0  from the active forces' linear models.
 * Panel 5 writes these into the tuple's m, c, k.
 */
export function assemble(scene) {
  let C = 0, K = 0;
  for (const f of scene.forces) {
    if (!f.on) continue;
    const co = MODELS[f.type].coefficients(f);
    C += co.C; K += co.K;
  }
  return { M: scene.body.m, C, K };
}
