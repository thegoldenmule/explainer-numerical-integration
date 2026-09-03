// Panel 8, left: one frame. A 16.7 ms (or 33.3 ms) timeline at true scale with the physics
// slice inside it. One spring step is ~16 ns, so a single object is an invisible sliver of a
// frame and magnifying it teaches nothing; a game does not simulate one object, so the pane
// carries an object count and the slice is count × steps-per-frame × cost-per-step. Drag the
// count up and the slice becomes a real fraction of the frame (the default 500 000 is the
// essay's "a few milliseconds every frame"), then overruns it and the axis
// stretches past the budget line to show how late the frame is.
//
// The count and the display rate are pane-local (a local store, never the shared tuple).

import { el } from 'shared/dom.js';
import { createStage } from 'shared/gfx/stage.js';
import { cssVar, niceStep } from 'shared/gfx/plot2d.js';
import { createStore } from 'shared/state.js';
import { stepCost } from 'shared/player.js';
import { controls } from 'shared/ui/controls.js';
import { bindMath } from 'shared/ui/livemath.js';
import { bindScrub } from 'shared/ui/scrub.js';
import { stepsPerFrame, fmtMs, fmtSteps, fmtCount } from './cost.js';

const MAX_OBJECTS = 1e7;

export function mount(root, ctx) {
  const { store, signal } = ctx;

  // pane-local: how many objects we are budgeting for, and which display. Never the tuple.
  const local = createStore({ objects: 500000, fps: 60 },
    { limits: { objects: [1, MAX_OBJECTS], fps: [30, 60] } });

  const stage = createStage(root, { layers: ['plot'], aspect: 'strip', signal });

  /** Everything both the canvas and the prose need, from the two stores. */
  function budget() {
    const state = store.get();
    const { objects, fps } = local.get();
    const n = Math.max(1, Math.round(objects));
    const frameMs = 1000 / fps;
    const perStep = stepCost(state).perStep;
    const steps = stepsPerFrame(state.h, frameMs);
    const slice = perStep * steps * n;
    return { state, n, fps, frameMs, perStep, steps, slice, fillAt: frameMs / (perStep * steps) };
  }

  stage.onDraw(({ w, h, dpr }) => {
    const g = stage.ctx('plot');
    const { n, fps, frameMs, perStep, steps, slice, fillAt } = budget();
    g.clearRect(0, 0, w, h);
    g.font = `${11 * dpr}px ${cssVar('--font') || 'system-ui'}`;
    g.textAlign = 'left';

    const pad = 10 * dpr, x0 = pad, bw = w - 2 * pad;
    // the axis stretches past the budget when the slice overruns, but never so far that the
    // budget line collapses onto the left edge
    const axisMax = Math.min(Math.max(frameMs, slice * 1.12), 4 * frameMs);
    const px = ms => x0 + bw * ms / axisMax;
    const budgetX = px(frameMs);
    // the three lines of arithmetic are anchored to the bottom; the band takes what is left.
    // Two label rows above the band, so the budget label never lands on the title when the
    // overrun pulls the budget line in towards the left edge.
    const textH = 74 * dpr;
    const y = 36 * dpr;
    const bh = Math.max(24 * dpr, h - y - 20 * dpr - textH);
    const yb = y + bh;

    // the frame's own room, and the "late" territory past it
    g.fillStyle = cssVar('--accent-soft');
    g.fillRect(x0, y, budgetX - x0, bh);
    if (axisMax > frameMs) {
      g.save();
      g.globalAlpha = 0.12;
      g.fillStyle = cssVar('--unstable');
      g.fillRect(budgetX, y, x0 + bw - budgetX, bh);
      g.restore();
    }

    // the physics slice at true scale
    const over = slice > frameMs;
    g.fillStyle = cssVar(over ? '--unstable' : '--approx');
    g.globalAlpha = 0.85;
    g.fillRect(x0, y, Math.max(dpr, px(slice) - x0), bh);
    g.globalAlpha = 1;

    // the budget line, and the outline
    g.strokeStyle = cssVar('--border-strong');
    g.lineWidth = 2 * dpr;
    g.beginPath(); g.moveTo(budgetX, y - 5 * dpr); g.lineTo(budgetX, yb + 5 * dpr); g.stroke();
    g.lineWidth = dpr;
    g.strokeRect(x0, y, bw, bh);

    // milliseconds along the bottom
    const step = niceStep(axisMax, 6);
    g.fillStyle = cssVar('--tick');
    for (let ms = 0; ms <= axisMax + 1e-9; ms += step) {
      const X = px(ms);
      g.fillRect(X, yb, dpr, 4 * dpr);
      if (X < x0 + bw - 24 * dpr) g.fillText(`${+ms.toFixed(2)}`, X + 2 * dpr, yb + 14 * dpr);
    }

    // labels: the title above, the budget line and the leftovers inside
    g.fillStyle = cssVar('--fg');
    g.fillText(`one frame at ${fps} fps — the whole bar is ${fmtMs(axisMax)} of wall-clock time`, x0, y - 22 * dpr);
    if (budgetX - x0 > 120 * dpr) {
      g.textAlign = 'right';
      g.fillText(`${frameMs.toFixed(1)} ms budget`, budgetX - 5 * dpr, y - 8 * dpr);
      g.textAlign = 'left';
    } else {
      g.fillText(`${frameMs.toFixed(1)} ms budget`, budgetX + 5 * dpr, y - 8 * dpr);
    }
    if (!over) {
      g.fillStyle = cssVar('--muted');
      const rest = px(slice) + 8 * dpr;
      if (budgetX - rest > 200 * dpr) g.fillText('everything else the game does this frame', rest, y + bh / 2 + 4 * dpr);
    }

    // the arithmetic, so the number on the bar is checkable
    let ty = h - textH + 20 * dpr;
    g.font = `${13 * dpr}px ${cssVar('--font') || 'system-ui'}`;
    g.fillStyle = cssVar('--fg');
    g.fillText(`${fmtCount(n)} objects × ${fmtSteps(steps)} per frame × ${fmtMs(perStep)} per step = ${fmtMs(slice)}`
      + `  (${(100 * slice / frameMs).toPrecision(3)}% of the frame)`, x0, ty);

    ty += 18 * dpr;
    g.font = `${11 * dpr}px ${cssVar('--font') || 'system-ui'}`;
    g.fillStyle = cssVar('--muted');
    g.fillText('one measured spring step, charged to every object — a real body costs more, never less', x0, ty);

    ty += 18 * dpr;
    if (over) {
      g.fillStyle = cssVar('--unstable');
      g.fillText(`${fmtMs(slice - frameMs)} late — ${(slice / frameMs).toPrecision(3)}× the budget: the display shows the previous frame again`, x0, ty);
    } else {
      g.fillStyle = cssVar('--fg');
      g.fillText(`the frame fills at about ${fmtCount(fillAt)} objects at this h`, x0, ty);
    }
  });

  const fpsRow = el('div', { class: 'controls-row' }, [60, 30].map(f => el('button', {
    class: 'btn', type: 'button', 'data-fps': f, onclick: () => local.set({ fps: f }),
  }, `${f} fps`)));
  const syncFps = () => { for (const b of fpsRow.children) b.setAttribute('aria-pressed', String(Number(b.dataset.fps) === local.get().fps)); };
  syncFps();

  root.append(controls(fpsRow));

  // one facade over the two numbers scrubbed in the prose — h (the tuple) and objects (this
  // pane's own budget) — so a single bindScrub call can bind both from the article.
  const scrub = {
    get: () => ({ h: store.get().h, objects: local.get().objects }),
    set(patch) {
      if (Number.isFinite(patch.h)) store.set({ h: patch.h });
      if (Number.isFinite(patch.objects)) local.set({ objects: patch.objects });
      return scrub.get();
    },
    subscribe(fn, opts) {
      const relay = () => { const s = scrub.get(); fn(s, s); };
      const offStore = store.subscribe(relay, opts);
      const offLocal = local.subscribe(relay, { immediate: false });
      return () => { offStore(); offLocal(); };
    },
    limits: { h: [0.002, 0.25], objects: [1, MAX_OBJECTS] },
  };

  const slots = () => {
    const { n, fps, frameMs, perStep, steps, slice, fillAt } = budget();
    return {
      fps, steps,
      objects: fmtCount(n), perStepText: fmtMs(perStep), sliceText: fmtMs(slice),
      frame: fmtMs(frameMs), fillAt: fmtCount(fillAt),
    };
  };
  const article = root.closest('article');
  bindMath(article, store, slots, { signal });
  bindMath(article, local, slots, { signal });
  const offScrub = bindScrub(article, scrub, { signal });

  const unsub = store.subscribe(stage.invalidate, { immediate: false });
  const unsubLocal = local.subscribe(() => { syncFps(); stage.invalidate(); }, { immediate: false });
  return { destroy() { unsub(); unsubLocal(); offScrub(); } };
}
