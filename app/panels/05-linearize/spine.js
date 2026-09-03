// Panel 5, spine: each force as its equation with every parameter a scrubbable number, a
// real-vs-linear switch (only gravitation differs: G m₁ m₂ / r² against m₁ g), the force
// arrows, a, and a short predicted trajectory updating live; below, M, C, K assembling from
// the scene's linear models into M x″ + C x′ + K x = 0 and pushed into the tuple's m, c, k.
//
// The scrubs bind to one facade over the scene store (unique keys per parameter, each routed
// to scene.setForceParam / setMass), so bindScrub and bindMath take the article once. The
// bridge to Part II, scene.pushToTuple(), runs on resume and on every scene change while this
// pane is on screen; not on mount, because the pane manager mounts this spine off-screen
// beside panels 4 and 6, and panel 6 sets the tuple's c for its own overdamped preset.

import { el, fmt, fragment } from 'shared/dom.js';
import { createStage } from 'shared/gfx/stage.js';
import { createDragHandles } from 'shared/gfx/drag.js';
import { cssVar, makeView, drawGrid, drawPoint, drawPolyline, drawText, drawArrow } from 'shared/gfx/plot2d.js';
import { netForce, forceOf, gravityG, assemble } from 'shared/math/forces.js';
import { scene, FORCE_LIMITS, BODY_LIMITS } from 'shared/scene.js';
import { toggleFn, readout, controls } from 'shared/ui/controls.js';
import { bindScrub } from 'shared/ui/scrub.js';
import { bindMath } from 'shared/ui/livemath.js';

const HALF_W = 3;
const ARROW_LEN = 1.2;
const PREDICT = { dt: 1 / 60, steps: 120 };   // a 2 s look-ahead, RK4 in 2D
const COLOR = { wind: '--accent', gravity: '--axis', drag: '--muted', spring: '--region-edge' };

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

const mn = (key, digits, log = false) => `<mn data-scrub="${key}" data-digits="${digits}"${log ? ' data-log' : ''}>0</mn>`;
const EQUATIONS = {
  wind: `<math><mrow><mi>F</mi><mo>=</mo><mo>(</mo>${mn('wind-fx', 1)}<mo>,</mo>${mn('wind-fy', 1)}<mo>)</mo></mrow></math>`,
  gravityReal: `<math><mrow><mi>F</mi><mo>=</mo><mfrac><mrow>${mn('G', 2)}<mo>·</mo>${mn('m1', 2)}<mo>·</mo>${mn('m2', 0, true)}</mrow><msup><mn data-scrub="r" data-digits="1" data-log>0</mn><mn>2</mn></msup></mfrac></mrow></math>`,
  gravityLinear: `<math><mrow><mi>F</mi><mo>=</mo>${mn('m1', 2)}<mo>·</mo><mi>g</mi><mo>,</mo><mspace width="0.5em"/><mi>g</mi><mo>=</mo><mfrac><mrow>${mn('G', 2)}<mo>·</mo>${mn('m2', 0, true)}</mrow><msup><mn data-scrub="r" data-digits="1" data-log>0</mn><mn>2</mn></msup></mfrac><mo>=</mo><mn data-var="g" data-digits="2">0</mn></mrow></math>`,
  drag: `<math><mrow><mi>F</mi><mo>=</mo><mo>−</mo>${mn('drag-c', 2)}<mo>·</mo><mi>v</mi></mrow></math>`,
  spring: `<math><mrow><mi>F</mi><mo>=</mo><mo>−</mo>${mn('spring-k', 0, true)}<mo>·</mo><mi>x</mi></mrow></math>`,
};
const ASSEMBLY = `<math display="block"><mrow>
  <mi>M</mi><mo>=</mo><msub><mi>m</mi><mn>1</mn></msub><mo>=</mo><mn data-var="M" data-digits="2">0</mn><mo>,</mo><mspace width="1em"/>
  <mi>C</mi><mo>=</mo><mi data-var="C-from">c</mi><mo>=</mo><mn data-var="C" data-digits="2">0</mn><mo>,</mo><mspace width="1em"/>
  <mi>K</mi><mo>=</mo><mi data-var="K-from">k</mi><mo>=</mo><mn data-var="K" data-digits="1">0</mn>
</mrow></math>`;

/** A 2D RK4 look-ahead from the body's state under the scene's current models. */
function predict(s) {
  const { linear } = s;
  const acc = (x, v) => netForce({ body: { m: s.body.m, x, v }, forces: s.forces }, { linear }).map(F => F / s.body.m);
  let x = [...s.body.x], v = [...s.body.v];
  const xs = [x[0]], ys = [x[1]];
  const h = PREDICT.dt;
  for (let i = 0; i < PREDICT.steps; i++) {
    const a1 = acc(x, v);
    const v2 = [v[0] + h / 2 * a1[0], v[1] + h / 2 * a1[1]], x2 = [x[0] + h / 2 * v[0], x[1] + h / 2 * v[1]], a2 = acc(x2, v2);
    const v3 = [v[0] + h / 2 * a2[0], v[1] + h / 2 * a2[1]], x3 = [x[0] + h / 2 * v2[0], x[1] + h / 2 * v2[1]], a3 = acc(x3, v3);
    const v4 = [v[0] + h * a3[0], v[1] + h * a3[1]], x4 = [x[0] + h * v3[0], x[1] + h * v3[1]], a4 = acc(x4, v4);
    x = [x[0] + h / 6 * (v[0] + 2 * v2[0] + 2 * v3[0] + v4[0]), x[1] + h / 6 * (v[1] + 2 * v2[1] + 2 * v3[1] + v4[1])];
    v = [v[0] + h / 6 * (a1[0] + 2 * a2[0] + 2 * a3[0] + a4[0]), v[1] + h / 6 * (a1[1] + 2 * a2[1] + 2 * a3[1] + a4[1])];
    xs.push(x[0]); ys.push(x[1]);
  }
  return { xs, ys };
}

export function mount(root, ctx) {
  const { store, signal } = ctx;
  const article = root.closest('article') ?? root;
  const facade = paramFacade();
  let active = false;   // on screen: the only time the scene writes the tuple
  let view = null;

  // ---- the force rows: switch, equation, value ----
  const s0 = scene.get();
  const rows = [];
  const values = {};
  const forceRow = (type, label, ...math) => {
    const i = scene.forceIndex(type);
    const on = toggleFn({ label, get: () => scene.get().forces[i].on, set: v => scene.toggleForce(i, v), subscribe: scene.subscribe, signal });
    const value = el('span', { class: 'mono muted' });
    values[type] = value;
    const row = el('div', { class: 'transport' }, on, ...math, value);
    rows.push(row);
    return row;
  };
  forceRow('wind', 'Wind', fragment(EQUATIONS.wind));
  const realEq = el('span', {}, fragment(EQUATIONS.gravityReal));
  const linEq = el('span', {}, fragment(EQUATIONS.gravityLinear));
  const linearSwitch = toggleFn({ label: 'linear', get: () => scene.get().linear, set: v => scene.setLinear(v), subscribe: scene.subscribe, signal });
  forceRow('gravity', 'Gravity', realEq, linEq, linearSwitch);
  forceRow('drag', 'Drag', fragment(EQUATIONS.drag));
  forceRow('spring', 'Spring', fragment(EQUATIONS.spring));
  root.append(el('div', { class: 'controls' }, rows));

  // ---- the stage: body, arrows, a, and the look-ahead ----
  const stage = createStage(root, { layers: ['plane'], aspect: 'strip', signal });
  root.append(fragment(ASSEMBLY));
  const out = readout({ label: 'the bridge to the tuple' });
  root.append(out.el);

  stage.onDraw(({ w, h, dpr }) => {
    const s = scene.get();
    const { body, linear } = s;
    const g = stage.ctx('plane');
    view = makeView({ w, h, dpr, halfW: HALF_W });
    g.clearRect(0, 0, w, h);
    drawGrid(g, view, { xLabel: 'x', yLabel: 'y', ticks: 4 });

    const list = s.forces.map((f, i) => ({ f, i, F: forceOf(f, body, { linear }) })).filter(v => v.f.on);
    const sum = list.reduce((acc, v) => [acc[0] + v.F[0], acc[1] + v.F[1]], [0, 0]);
    const a = [sum[0] / body.m, sum[1] / body.m];
    let big = 1;
    for (const v of list) big = Math.max(big, Math.hypot(...v.F));
    const scale = ARROW_LEN / Math.max(big, Math.hypot(...sum));

    const path = predict(s);
    drawPolyline(g, view, path.xs, path.ys, { color: cssVar('--exact'), width: 1.5, dash: [5, 4], alpha: 0.8 });
    for (const v of list) {
      values[v.f.type].textContent = `= (${fmt(v.F[0], 2)}, ${fmt(v.F[1], 2)})`;
      if (Math.hypot(...v.F) * scale < 1e-3) continue;
      drawArrow(g, view, body.x[0], body.x[1], body.x[0] + v.F[0] * scale, body.x[1] + v.F[1] * scale, { color: cssVar(COLOR[v.f.type]), width: 2, head: 7 });
    }
    for (const f of s.forces) if (!f.on) values[f.type].textContent = 'off';
    if (Math.hypot(...sum) * scale > 1e-3) drawArrow(g, view, body.x[0], body.x[1], body.x[0] + sum[0] * scale, body.x[1] + sum[1] * scale, { color: cssVar('--approx'), width: 3.5, head: 10 });
    drawPoint(g, view, body.x[0], body.x[1], { r: 7, fill: cssVar('--fg') });
    drawText(g, view, `a = (${fmt(a[0], 2)}, ${fmt(a[1], 2)})   ${linear ? 'linear' : 'real'} models   next 2 s dashed   (drag the mass)`, view.xMin, view.yMax, { color: cssVar('--muted'), size: 11, dx: 8, dy: 16 });
  });

  createDragHandles(stage.canvas('plane'), {
    signal, hitRadius: 14,
    handles: () => [{ id: 'body', x: scene.get().body.x[0], y: scene.get().body.x[1] }],
    view: () => view ?? makeView({ w: 1, h: 1, dpr: 1, halfW: HALF_W }),
    onMove: (id, p) => scene.moveBody(Math.max(-HALF_W, Math.min(HALF_W, p.x)), Math.max(-1, Math.min(1, p.y))),
  });

  // ---- live math: scrubs on the facade, derived values from the scene, the tuple's m c k from the store ----
  bindScrub(article, facade, { signal });
  bindMath(article, facade, () => {
    const s = scene.get();
    const gi = scene.forceIndex('gravity'), di = scene.forceIndex('drag'), si = scene.forceIndex('spring');
    const { M, C, K } = assemble(s);
    return {
      g: gravityG(s.forces[gi]), M, C, K,
      'C-from': s.forces[di].on ? 'c' : '0 (drag off)',
      'K-from': s.forces[si].on ? 'k' : '0 (spring off)',
    };
  }, { signal });
  bindMath(article, store, () => ({}), { signal });

  function refresh() {
    const s = scene.get();
    realEq.hidden = s.linear;
    linEq.hidden = !s.linear;
    const t = store.get();
    const { M, C, K } = assemble(s);
    const synced = t.m === M && t.c === C && t.k === K;
    out.set([
      `M x″ + C x′ + K x = 0 with M = ${fmt(M, 2)}, C = ${fmt(C, 2)}, K = ${fmt(K, 1)}\n`,
      `tuple now: m = ${fmt(t.m, 2)}, c = ${fmt(t.c, 2)}, k = ${fmt(t.k, 1)}   `,
      synced ? el('span', { class: 'stable' }, 'in sync') : el('span', { class: 'unstable' }, 'out of sync (a later panel moved the tuple; it resyncs while this panel is on screen)'), '\n',
      el('span', { class: 'label' }, `wind and m₁g are constant terms and never reach C or K; G, m₂, r survive only inside g = ${fmt(gravityG(s.forces[scene.forceIndex('gravity')]), 2)}`),
    ]);
    stage.invalidate();
  }
  const push = () => { if (active) scene.pushToTuple(); };

  const unsub = scene.subscribe(() => { push(); refresh(); }, { immediate: false });
  const unsubTuple = store.subscribe((t, patch) => { if ('m' in patch || 'c' in patch || 'k' in patch) refresh(); }, { immediate: false });
  refresh();
  return {
    resume() { active = true; scene.pushToTuple(); refresh(); },
    pause() { active = false; },
    destroy() { unsub(); unsubTuple(); },
  };
}
