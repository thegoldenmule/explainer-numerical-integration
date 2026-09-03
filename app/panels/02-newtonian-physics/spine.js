// Panel 2, spine: F = ma on the scene's point mass. Each force is its own equation — a
// constant wind vector, Newton's G m₁ m₂ / r², drag −c v, a spring −k x — with every
// parameter a draggable number and the vector it produces read out inside the equation
// itself. Below them, ΣF and a = ΣF / m as live MathML with m draggable too.
//
// The scrubs bind to one facade over the scene store (unique keys per parameter, each routed
// to scene.setForceParam / setMass), the same shape panel 5's spine uses, so bindScrub and
// bindMath take the article once and every slot follows any scene change.
//
// Every active force is also an arrow from the body; the sum and a are drawn on top. Toggle
// each force, drag an arrow's head to scale it (through the scene store, so the left pane
// sees the same numbers), drag the body itself, and step time by hand: one explicit Euler
// step of the tuple's h in 2D. The scene is 2D and createStepper is 1D, so the step is
// written here; time is a local clock and lives on the canvas, not in the tuple.

import { el, fmt, fragment } from 'shared/dom.js';
import { createStage } from 'shared/gfx/stage.js';
import { createDragHandles } from 'shared/gfx/drag.js';
import { cssVar, makeView, drawGrid, drawPoint, drawText } from 'shared/gfx/plot2d.js';
import { netForce } from 'shared/math/forces.js';
import { scene, defaultScene, FORCE_LIMITS, BODY_LIMITS } from 'shared/scene.js';
import { toggleFn, controls } from 'shared/ui/controls.js';
import { bindScrub } from 'shared/ui/scrub.js';
import { bindMath } from 'shared/ui/livemath.js';
import { FORCE_COLOR, SUM_COLOR, ACCEL_COLOR, forceVectors, arrowMap, drawForceArrow, scalePatch, mag } from './arrows.js';

const HALF_W = 4;
const HALF_H = 2.2;
const BODY_R = 9;

/** One store-shaped view over every scrubbable parameter of the scene, keyed uniquely. */
function paramFacade() {
  const at = type => scene.forceIndex(type);
  const map = {
    'wind-fx': [at('wind'), 'fx', FORCE_LIMITS.fx], 'wind-fy': [at('wind'), 'fy', FORCE_LIMITS.fy],
    G: [at('gravity'), 'G', FORCE_LIMITS.G], m2: [at('gravity'), 'm2', FORCE_LIMITS.m2], r: [at('gravity'), 'r', FORCE_LIMITS.r],
    'drag-c': [at('drag'), 'c', FORCE_LIMITS.c], 'spring-k': [at('spring'), 'k', FORCE_LIMITS.k],
    m1: ['body', 'm', BODY_LIMITS.m],
  };
  const get = () => {
    const s = scene.get(), o = {};
    for (const [key, [i, p]] of Object.entries(map)) o[key] = i === 'body' ? s.body.m : s.forces[i][p];
    return o;
  };
  return {
    get,
    set(patch) {
      for (const [key, v] of Object.entries(patch)) {
        if (!map[key] || !Number.isFinite(v)) continue;
        const [i, p] = map[key];
        if (i === 'body') scene.setMass(v); else scene.setForceParam(i, p, v);
      }
      return get();
    },
    subscribe: (fn, opts) => scene.subscribe(() => { const g = get(); fn(g, g); }, opts),
    limits: Object.fromEntries(Object.entries(map).map(([key, [, , lim]]) => [key, lim])),
  };
}

const sc = (key, digits, log = false) => `<mn data-scrub="${key}" data-digits="${digits}"${log ? ' data-log' : ''}>0</mn>`;
const vec = (xk, yk) => `<mo>=</mo><mo>(</mo><mn data-var="${xk}" data-digits="2">0</mn><mo>,</mo><mn data-var="${yk}" data-digits="2">0</mn><mo>)</mo>`;

const EQUATIONS = {
  wind: `<math><mrow><mi>F</mi><mo>=</mo><mo>(</mo>${sc('wind-fx', 1)}<mo>,</mo>${sc('wind-fy', 1)}<mo>)</mo></mrow></math>`,
  gravity: `<math><mrow><mi>F</mi><mo>=</mo><mfrac><mrow>${sc('G', 2)}<mo>·</mo>${sc('m1', 2)}<mo>·</mo>${sc('m2', 0, true)}</mrow><msup><mn data-scrub="r" data-digits="1" data-log>0</mn><mn>2</mn></msup></mfrac>${vec('Fgx', 'Fgy')}</mrow></math>`,
  drag: `<math><mrow><mi>F</mi><mo>=</mo><mo>−</mo>${sc('drag-c', 2)}<mo>·</mo><mi>v</mi>${vec('Fdx', 'Fdy')}</mrow></math>`,
  spring: `<math><mrow><mi>F</mi><mo>=</mo><mo>−</mo>${sc('spring-k', 0, true)}<mo>·</mo><mi>x</mi>${vec('Fsx', 'Fsy')}</mrow></math>`,
};

const TOTALS = `<math display="block"><mrow>
  <munder><mo>∑</mo><mi>i</mi></munder><msub><mi>F</mi><mi>i</mi></msub>
  <mo>=</mo><mo>(</mo><mn data-var="Sx" data-digits="2">0</mn><mo>,</mo><mn data-var="Sy" data-digits="2">0</mn><mo>)</mo>
  <mspace width="1.5em"/>
  <mi>a</mi><mo>=</mo>
  <mfrac><mrow><munder><mo>∑</mo><mi>i</mi></munder><msub><mi>F</mi><mi>i</mi></msub></mrow><mn data-scrub="m1" data-digits="2">1.00</mn></mfrac>
  <mo>=</mo><mo>(</mo><mn data-var="ax" data-digits="2">0</mn><mo>,</mo><mn data-var="ay" data-digits="2">0</mn><mo>)</mo>
</mrow></math>`;

export function mount(root, ctx) {
  const { store, signal } = ctx;
  const article = root.closest('article') ?? root;
  const facade = paramFacade();
  let t = 0, steps = 0;           // this pane's clock: the tuple's t belongs to the players
  let view = null, frozenMap = null;

  // ---- the force rows: switch, equation, and whether it counts toward the sum ----
  const rows = scene.get().forces.map((f, i) => el('div', { class: 'transport' },
    toggleFn({
      label: f.type[0].toUpperCase() + f.type.slice(1),
      get: () => scene.get().forces[i].on, set: v => scene.toggleForce(i, v), subscribe: scene.subscribe, signal,
    }),
    fragment(EQUATIONS[f.type]),
    el('span', { class: 'muted', 'data-var': `${f.type}-off` }),
  ));
  const stepBtn = el('button', { class: 'btn', type: 'button', title: 'One explicit Euler step of the tuple’s h' }, 'Step once');
  const resetBtn = el('button', { class: 'btn', type: 'button' }, 'Reset');
  root.append(controls(rows, el('div', { class: 'transport' }, el('div', { class: 'transport-group' }, stepBtn, resetBtn))));

  const stage = createStage(root, { layers: ['plane'], aspect: 'wide', signal });
  root.append(fragment(TOTALS));

  const mapNow = () => frozenMap ?? arrowMap(scene.get());

  stage.onDraw(({ w, h, dpr }) => {
    const s = scene.get();
    const { body } = s;
    const { list, sum } = forceVectors(s);
    const map = mapNow();
    const a = [sum[0] / body.m, sum[1] / body.m];
    const g = stage.ctx('plane');
    view = makeView({ w, h, dpr, halfW: HALF_W });
    g.clearRect(0, 0, w, h);
    drawGrid(g, view, { xLabel: 'x', yLabel: 'y' });

    // the spring's anchor is part of the picture: the spring pulls back toward the origin
    const spring = s.forces.find(f => f.type === 'spring');
    if (spring?.on && mag(body.x) > 1e-6) {
      g.save(); g.strokeStyle = cssVar(FORCE_COLOR.spring); g.globalAlpha = 0.35; g.lineWidth = dpr; g.setLineDash([3 * dpr, 3 * dpr]);
      g.beginPath(); g.moveTo(view.X(0), view.Y(0)); g.lineTo(view.X(body.x[0]), view.Y(body.x[1])); g.stroke(); g.restore();
      drawText(g, view, 'spring anchor', 0, 0, { color: cssVar('--muted'), size: 10, dx: 6, dy: 14 });
    }

    for (const f of list) drawForceArrow(g, view, body.x, f.F, map, { color: FORCE_COLOR[f.type], label: f.label });
    drawForceArrow(g, view, body.x, sum, map, { color: SUM_COLOR, width: 4, head: 11 });
    drawForceArrow(g, view, body.x, a, map, { color: ACCEL_COLOR, width: 1.5, head: 6 });
    if (mag(body.v) > 1e-6) drawForceArrow(g, view, body.x, body.v, map, { color: '--stable', width: 1.5, head: 6, alpha: 0.8 });
    drawPoint(g, view, body.x[0], body.x[1], { r: BODY_R, fill: cssVar('--fg') });

    // a legend for the three arrows that share the body's tail (and, when m = 1, a tip)
    drawText(g, view, 'ΣF', view.xMin, view.yMax, { color: cssVar(SUM_COLOR), size: 11, dx: 8, dy: 16 });
    drawText(g, view, 'a = ΣF / m', view.xMin, view.yMax, { color: cssVar(ACCEL_COLOR), size: 11, dx: 8, dy: 30 });
    drawText(g, view, 'v', view.xMin, view.yMax, { color: cssVar('--stable'), size: 11, dx: 8, dy: 44 });

    // the clock and the state the equations do not already carry
    const hint = list.length === 0 ? 'every force is off' : 'arrow lengths are compressed (log) so all four fit; the equations are the truth';
    drawText(g, view, `x = (${fmt(body.x[0], 2)}, ${fmt(body.x[1], 2)})   v = (${fmt(body.v[0], 2)}, ${fmt(body.v[1], 2)})`,
      view.xMin, view.yMin, { color: cssVar('--fg'), size: 11, dx: 8, dy: -32 });
    drawText(g, view, `t = ${fmt(t, 3)} s: ${steps} step${steps === 1 ? '' : 's'} of h = ${fmt(store.get().h, 3)} s`,
      view.xMin, view.yMin, { color: cssVar('--muted'), size: 11, dx: 8, dy: -18 });
    drawText(g, view, hint, view.xMin, view.yMin, { color: cssVar('--muted'), size: 10, dx: 8, dy: -5 });
  });

  // ---- drags: the body, and every arrow tip long enough to grab ----
  const canvas = stage.canvas('plane');
  createDragHandles(canvas, {
    signal, hitRadius: 12,
    handles: () => {
      const s = scene.get();
      const map = mapNow();
      const hs = [{ id: 'body', x: s.body.x[0], y: s.body.x[1] }];
      for (const f of forceVectors(s).list) {
        const d = map.toPlot(f.F);
        if (mag(d) < 0.15) continue;   // too short to grab; the body wins the hit test
        hs.push({ id: f.i, x: s.body.x[0] + d[0], y: s.body.x[1] + d[1] });
      }
      return hs;
    },
    view: () => view ?? makeView({ w: 1, h: 1, dpr: 1, halfW: HALF_W }),
    onStart: () => { frozenMap = arrowMap(scene.get()); },
    onMove: (id, p) => {
      if (id === 'body') { scene.moveBody(Math.max(-HALF_W, Math.min(HALF_W, p.x)), Math.max(-HALF_H, Math.min(HALF_H, p.y))); return; }
      const s = scene.get();
      const f = s.forces[id];
      const F = forceVectors(s).list.find(v => v.i === id)?.F ?? [0, 0];
      const Fnext = (frozenMap ?? arrowMap(s)).toForce([p.x - s.body.x[0], p.y - s.body.x[1]]);
      const patch = scalePatch(f, F, Fnext);
      if (patch) scene.paramStore(id).set(patch);
    },
    onEnd: () => { frozenMap = null; stage.invalidate(); },
  });

  // ---- step time by hand: one explicit Euler step in 2D ----
  function step() {
    const s = scene.get();
    const h = store.get().h;
    const a = netForce(s).map(F => F / s.body.m);
    const { x, v } = s.body;
    scene.moveBody(x[0] + h * v[0], x[1] + h * v[1]);
    scene.setVelocity(v[0] + h * a[0], v[1] + h * a[1]);
    t += h; steps++;
    stage.invalidate();
  }
  function reset() {
    const body = defaultScene().body;   // the displaced, moving body: drag and spring are not zero vectors
    scene.setVelocity(body.v[0], body.v[1]);
    scene.moveBody(body.x[0], body.x[1]);
    t = 0; steps = 0;
    stage.invalidate();
  }
  stepBtn.addEventListener('click', step, { signal });
  resetBtn.addEventListener('click', reset, { signal });

  // ---- live math: every scrub and every slot reads the one facade over the scene ----
  bindScrub(article, facade, { signal });
  bindMath(article, facade, () => {
    const s = scene.get();
    const { list, sum } = forceVectors(s, { all: true });
    const at = type => list.find(v => v.type === type)?.F ?? [0, 0];
    const [Fgx, Fgy] = at('gravity'), [Fdx, Fdy] = at('drag'), [Fsx, Fsy] = at('spring');
    const off = Object.fromEntries(s.forces.map(f => [`${f.type}-off`, f.on ? '' : 'off — not in ΣF']));
    return {
      ...off,
      Fgx, Fgy, Fdx, Fdy, Fsx, Fsy,
      Sx: sum[0], Sy: sum[1],
      ax: sum[0] / s.body.m, ay: sum[1] / s.body.m,
    };
  }, { signal });

  const unsub = scene.subscribe(stage.invalidate, { immediate: false });
  const unsubTuple = store.subscribe((s, patch) => { if ('h' in patch) stage.invalidate(); }, { immediate: false });
  return { destroy() { unsub(); unsubTuple(); } };
}
