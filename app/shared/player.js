// The live player: one object that owns a stepper, advances it by wall-clock time at the
// store's h, and keeps the growing trajectory with the exact curve and the error sampled at
// the same times. It restarts whenever any tuple entry other than t changes, writes t to the
// store `{ silent: true }` each frame, and reports what panels 8 and 9 read off the run: the
// per-frame compute cost and the measured step-to-step error ratio with its doubling time.
//
//   const player = createPlayer({ store, loop, signal });
//   player.onChange(stage.invalidate);
//   player.series → { t, x, v, exact, err, n }   (typed-array views, valid up to n)
//   verbs: play(), pause(), toggle(), reset(), step(); player.speed = 2

import { createStepper } from './math/integrators.js';
import { exactSolution } from './math/system.js';
import { doublingTime } from './math/stability.js';

const TUPLE = ['method', 'h', 'm', 'c', 'k', 'x0', 'v0'];

/** Resolution of performance.now() on a page that is not cross-origin isolated, in ms. */
export const TIMER_RESOLUTION_MS = 0.1;

/**
 * benchmarkStep(state, { now, minMs = 4, warmup = 20000, batch = 5000, maxSteps = 4e6 })
 *   → { perStep, steps, ms }
 * ms per step of state.method at state.h, from a fresh stepper (the live one may have blown
 * up, and NaN arithmetic does not time like a step): `warmup` steps untimed for the JIT, then
 * batches of `batch` steps until at least `minMs` have elapsed (40 × the 0.1 ms resolution
 * by default) or `maxSteps` were taken. `now` is injectable for tests.
 */
export function benchmarkStep(state, { now = () => performance.now(), minMs = 4, warmup = 20000, batch = 5000, maxSteps = 4e6 } = {}) {
  const s = createStepper(state);
  for (let i = 0; i < warmup; i++) s.step();
  let steps = 0, ms = 0;
  const t0 = now();
  while (ms < minMs && steps < maxSteps) {
    for (let i = 0; i < batch; i++) s.step();
    steps += batch;
    ms = now() - t0;
  }
  return { perStep: steps > 0 ? ms / steps : 0, steps, ms };
}

const costKey = state => `${state.method}/${state.h}`;
const costCache = new Map();
const COST_CACHE_CAPACITY = 16;

/** The memoized benchmark, keyed on method and h: the number every pane on the page shares. */
export function stepCost(state) {
  const key = costKey(state);
  let hit = costCache.get(key);
  if (hit) { costCache.delete(key); costCache.set(key, hit); return hit; }
  hit = benchmarkStep(state);
  costCache.set(key, hit);
  while (costCache.size > COST_CACHE_CAPACITY) costCache.delete(costCache.keys().next().value);
  return hit;
}
export const clearStepCosts = () => costCache.clear();

function growable(capacity = 4096) {
  let buf = new Float64Array(capacity), n = 0;
  return {
    push(v) {
      if (n === buf.length) { const b = new Float64Array(n * 2); b.set(buf); buf = b; }
      buf[n++] = v;
    },
    clear() { n = 0; },
    get n() { return n; },
    at: i => buf[i],
    view: () => buf.subarray(0, n),
  };
}

/**
 * createPlayer({ store, loop, signal, autoplay = true, speed = 1, maxStepsPerFrame = 400,
 *                maxSamples = 250000, ratioWindow = 1, benchmark = stepCost })
 *   ratioWindow: seconds of run over which the error growth is measured
 *   benchmark:   state → { perStep, steps, ms }, run when method or h changed (tests stub it)
 */
export function createPlayer({
  store, loop, signal, autoplay = true, speed = 1, maxStepsPerFrame = 400, maxSamples = 250000, ratioWindow = 1,
  benchmark = stepCost,
} = {}) {
  const T = growable(), X = growable(), V = growable(), E = growable(), ERR = growable();
  const listeners = new Set();
  let stepper = null, exact = null, h = 0;
  let playing = autoplay, ended = false, dead = false;
  let acc = 0;            // wall-clock seconds not yet turned into steps
  let timerFrame = 0;     // ms spent stepping per frame by performance.now(), smoothed
  let timerStep = 0;      // the same per step, smoothed
  let lastSteps = 0;
  let bench = null, benchKey = '';   // the calibrated cost, measured on the first read after method or h changed

  const notify = () => { for (const fn of listeners) fn(api); };

  function push() {
    const t = stepper.t, x = stepper.x;
    const ex = exact.x(t);
    T.push(t); X.push(x); V.push(stepper.v); E.push(ex); ERR.push(Math.abs(x - ex));
  }

  function restart(state) {
    stepper = createStepper(state);
    exact = exactSolution(state);
    h = state.h;
    T.clear(); X.clear(); V.clear(); E.clear(); ERR.clear();
    push();
    acc = 0; ended = false; lastSteps = 0;
    if (costKey(state) !== benchKey) { benchKey = costKey(state); bench = null; }
    store.set({ t: 0 }, { silent: true });
    notify();
  }

  // ---- SEAM: adaptive stepping (panel 13) ----------------------------------------------
  // The controller plugs in here. It would look at the last step's local error estimate
  // (math/adaptive.js) and choose the next h before advancing, via stepper.setH(next), and
  // the series would gain an h(t) array. Until it is wired in, every step is the store's
  // fixed h.
  function stepOnce() {
    stepper.step();
    push();
    if (T.n >= maxSamples) { playing = false; ended = true; }
  }
  // ---------------------------------------------------------------------------------------

  function advance(steps) {
    const t0 = performance.now();
    for (let i = 0; i < steps && !ended; i++) stepOnce();
    const ms = performance.now() - t0;
    timerFrame += (ms - timerFrame) * 0.2;
    if (steps > 0) timerStep += (ms / steps - timerStep) * 0.2;
    lastSteps = steps;
    store.set({ t: stepper.t }, { silent: true });
  }

  function frame(dt) {
    if (!playing || !stepper) return;
    acc += dt * speed;
    let steps = Math.floor(acc / h);
    if (steps > maxStepsPerFrame) { steps = maxStepsPerFrame; acc = 0; }   // a tiny h slows, never stalls
    else acc -= steps * h;
    if (steps === 0) return;
    advance(steps);
    notify();
  }

  let offFrame = () => {}, unsubscribe = () => {};
  function destroy() {
    if (dead) return;
    dead = true;
    offFrame(); unsubscribe(); listeners.clear();
  }

  const api = {
    play() { if (ended) restart(store.get()); playing = true; acc = 0; notify(); },
    pause() { playing = false; notify(); },
    toggle() { playing ? api.pause() : api.play(); },
    reset() { restart(store.get()); },
    /** one step, paused */
    step() { playing = false; if (ended) restart(store.get()); advance(1); notify(); },
    get playing() { return playing; },
    get ended() { return ended; },
    get speed() { return speed; },
    set speed(s) { speed = Math.max(0, s); },
    get h() { return h; },
    get t() { return stepper?.t ?? 0; },
    get n() { return T.n; },
    get series() { return { t: T.view(), x: X.view(), v: V.view(), exact: E.view(), err: ERR.view(), n: T.n }; },
    /** the current state of the run: { t, x, v, exact, err } */
    get current() {
      const i = T.n - 1;
      return { t: T.at(i), x: X.at(i), v: V.at(i), exact: E.at(i), err: ERR.at(i) };
    },
    /**
     * The compute cost, in ms: perStep from the calibrated benchmark, perFrame = perStep ×
     * the steps taken last frame, `steps` that count, `benchmark` the batch it was measured
     * on ({ steps, ms }), and `timer`, the raw performance.now() timing of the frame
     * (smoothed) which is quantized to TIMER_RESOLUTION_MS on this page and reads 0 or
     * 0.1 ms for a spring: shown for honesty, never used for sizing.
     */
    get cost() {
      if (!bench) bench = benchmark(store.get());
      return {
        perStep: bench.perStep, perFrame: bench.perStep * lastSteps, steps: lastSteps,
        benchmark: { steps: bench.steps, ms: bench.ms },
        timer: { perFrame: timerFrame, perStep: timerStep, resolution: TIMER_RESOLUTION_MS },
      };
    },
    /**
     * Measured growth of the error: the ratio per step between the peak error over the
     * last `ratioWindow` seconds and over the window before it, so an oscillating error's
     * zero crossings do not swing the number. { ratio, doublingTime, steps } or null while
     * the run is too short.
     */
    growth() {
      const W = Math.max(2, Math.round(ratioWindow / h));
      const n = ERR.n;
      if (n < 2 * W + 1) return null;
      let a = 0, b = 0;
      for (let i = n - W; i < n; i++) a = Math.max(a, ERR.at(i));
      for (let i = n - 2 * W; i < n - W; i++) b = Math.max(b, ERR.at(i));
      if (!(a > 0 && b > 0) || !Number.isFinite(a) || !Number.isFinite(b)) return null;
      const ratio = (a / b) ** (1 / W);
      return { ratio, doublingTime: doublingTime(h, ratio), steps: W };
    },
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    destroy,
  };

  // the immediate subscribe call carries the whole state as its patch, which starts the run
  unsubscribe = store.subscribe((state, patch) => {
    if (TUPLE.some(k => k in patch)) restart(state);
  });
  offFrame = loop.onFrame(frame);
  signal?.addEventListener('abort', destroy, { once: true });
  return api;
}
