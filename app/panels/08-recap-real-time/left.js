// Panel 8, left: one frame. A 16.7 ms (or 33.3 ms) timeline with the physics slice inside
// it, sized from the per-step cost times the steps one frame needs at the current h, then
// the slice magnified so the individual steps can be counted.

import { el, fmt } from 'shared/dom.js';
import { createStage } from 'shared/gfx/stage.js';
import { cssVar } from 'shared/gfx/plot2d.js';
import { createPlayer } from 'shared/player.js';
import { slider, readout, controls } from 'shared/ui/controls.js';
import { bindMath } from 'shared/ui/livemath.js';
import { benchmarkStep, stepsPerFrame, fmtMs } from './cost.js';

const MAX_BOXES = 60;   // steps drawn individually in the magnified band

export function mount(root, ctx) {
  const { store, loop, signal } = ctx;
  let fps = 60;   // local: which display we are budgeting for

  const stage = createStage(root, { layers: ['plot'], aspect: 'strip', signal });
  // a player so the pane also reports what the live run's own timer says
  const player = createPlayer({ store, loop, signal });
  const out = readout({ label: 'this frame' });

  stage.onDraw(({ w, h, dpr }) => {
    const state = store.get();
    const g = stage.ctx('plot');
    g.clearRect(0, 0, w, h);
    g.font = `${11 * dpr}px ${cssVar('--font') || 'system-ui'}`;

    const frameMs = 1000 / fps;
    const perStep = benchmarkStep(state);
    const steps = stepsPerFrame(state.h, frameMs);
    const slice = perStep * steps;
    const pad = 10 * dpr, x0 = pad, bw = w - 2 * pad;

    // band 1: the whole frame at true scale
    const y1 = 26 * dpr, h1 = 34 * dpr;
    g.fillStyle = cssVar('--fg');
    g.fillText(`one frame at ${fps} fps: ${fmtMs(frameMs)}`, x0, y1 - 8 * dpr);
    g.fillStyle = cssVar('--accent-soft');
    g.fillRect(x0, y1, bw, h1);
    g.strokeStyle = cssVar('--border-strong'); g.lineWidth = dpr;
    g.strokeRect(x0, y1, bw, h1);
    g.fillStyle = cssVar('--tick');
    for (let ms = 0; ms <= frameMs; ms += 2) {
      const X = x0 + bw * ms / frameMs;
      g.fillRect(X, y1 + h1, dpr, 4 * dpr);
      if (X < x0 + bw - 40 * dpr) g.fillText(`${ms}`, X + 2 * dpr, y1 + h1 + 14 * dpr);
    }
    g.textAlign = 'right';
    g.fillText(`${frameMs.toFixed(1)} ms`, x0 + bw, y1 + h1 + 14 * dpr);
    g.textAlign = 'left';
    const sliceW = Math.max(2 * dpr, bw * Math.min(1, slice / frameMs));
    g.fillStyle = cssVar(slice > frameMs ? '--unstable' : '--approx');
    g.fillRect(x0, y1, sliceW, h1);
    g.fillStyle = cssVar('--muted');
    g.fillText('everything else the game does this frame', x0 + sliceW + 8 * dpr, y1 + h1 / 2 + 4 * dpr);

    // band 2: the physics slice magnified to the full width
    const y2 = y1 + h1 + 44 * dpr, h2 = 34 * dpr;
    const zoom = frameMs / slice;
    g.fillStyle = cssVar('--fg');
    g.fillText(`the physics slice, magnified ${zoom >= 10 ? Math.round(zoom) : zoom.toFixed(1)}×: ${fmtMs(slice)} for ${steps >= 1 ? fmt(steps, 1) : fmt(steps, 2)} steps of h = ${fmt(state.h, 3)} s`, x0, y2 - 8 * dpr);
    // the magnified slice's outline, from the frame to the band
    g.strokeStyle = cssVar('--border-strong');
    g.setLineDash([3 * dpr, 3 * dpr]);
    g.beginPath();
    g.moveTo(x0, y1 + h1); g.lineTo(x0, y2);
    g.moveTo(x0 + sliceW, y1 + h1); g.lineTo(x0 + bw, y2);
    g.stroke();
    g.setLineDash([]);
    const boxes = Math.min(MAX_BOXES, Math.ceil(steps));
    const boxW = bw / Math.max(steps, 1);
    g.fillStyle = cssVar('--approx');
    for (let i = 0; i < boxes; i++) {
      const wBox = i === boxes - 1 && steps < boxes ? boxW * (steps - (boxes - 1)) : boxW;
      g.globalAlpha = 0.85;
      g.fillRect(x0 + i * boxW + dpr, y2, Math.max(dpr, wBox - 2 * dpr), h2);
    }
    g.globalAlpha = 1;
    if (steps > MAX_BOXES) {
      g.fillStyle = cssVar('--fg');
      g.fillText(`… ${Math.round(steps)} steps`, x0 + bw - 70 * dpr, y2 + h2 / 2 + 4 * dpr);
    }
    if (steps < 1) {
      g.fillStyle = cssVar('--muted');
      g.fillText(`one step covers ${fmt(1 / steps, 1)} frames of simulated time`, x0 + boxW * steps + 8 * dpr, y2 + h2 / 2 + 4 * dpr);
    }

    const m = player.cost;
    out.set([
      `${fmtMs(perStep)} per step × ${fmt(steps, 2)} steps = ${fmtMs(slice)}, ${(100 * slice / frameMs).toPrecision(2)}% of the frame\n`,
      `a millisecond here is ${(1 / perStep).toExponential(1).replace('e+', 'e')} steps of this integrator\n`,
      el('span', { class: 'label' }, `player timer: ${fmtMs(m.perStep)} per step (0.1 ms resolution)`),
    ]);
  });
  player.onChange(stage.invalidate);

  const fpsRow = el('div', { class: 'controls-row' }, [60, 30].map(f => el('button', {
    class: 'btn', type: 'button', 'data-fps': f, 'aria-pressed': String(fps === f),
    onclick() { fps = f; for (const b of fpsRow.children) b.setAttribute('aria-pressed', String(Number(b.dataset.fps) === fps)); stage.invalidate(); },
  }, `${f} fps`)));

  root.append(controls(
    slider(store, 'h', { label: 'h (step)', min: 0.002, max: 0.25, format: v => `${v.toFixed(3)} s`, signal }),
    fpsRow,
  ));
  root.append(out.el);

  const unsub = store.subscribe(stage.invalidate, { immediate: false });
  bindMath(root.closest('article'), store, state => ({ steps: stepsPerFrame(state.h) }), { signal });
  return { destroy() { unsub(); } };
}
