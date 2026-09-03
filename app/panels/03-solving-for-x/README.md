# Panel 3: Solving for x

Built. See `docs/idea.md` (section "3. Solving for x") for the beat, and `docs/plan.md` for the
pane contract. Panes in this directory:

- `spine.html` + `spine.js`: Solving for x. Two `strip` stages stacked on one time axis
  (`0 … SPAN = 4 s`): the blue exact curve with the red segmented approximation on top, and
  `|x − exact|` at every integrator step underneath on a **log** axis, so the growth reads as
  a slope. Two strips rather than `wide` + `strip` because a 16/9 top plot plus a strip runs
  past the fold at 1920×1080 and `.pane-body` clips; panel 9's spine pairs the same way. One
  `dt` slider (0.0005 … 0.033 s, floored at `LIMITS.h` = 0.001 by the store) drives both.
  Hovering (or touching) either canvas picks the nearest step and highlights it on both
  graphs; the step's `|error|` is drawn on the strip, `t` on the top plot. The trajectory, its
  error array, and the error peak/floor are memoized on a `sweepKey`. There is no readout
  block: the step count and the max error are live `data-var` slots in the prose, filled by
  `bindMath`.
- `left.html` + `left.js`: refresher, x, v, a: derivatives. Two `strip` stages plus a local
  a-bar; the scrubbed `t` is local to the pane, not the tuple. No readout: `t` is on the local
  slider's own output, `x` and `v` are `drawText` in the corner of the strip that plots them
  (opposite each strip's title), and `a` stays exactly where it was, the a-bar canvas — now
  sized from its own wrapper `<div>` instead of the removed box.
- `right.html` + `right.js`: drill-down, ODEs vs PDEs; intractability. Two `strip` stages, the
  point mass (ODE) over a plucked string (PDE, explicit leapfrog under the CFL bound). Both
  carry a canvas-drawn title at `size: 15` in `--fg` instead of `drawGrid`'s 11px `yLabel`. No
  readout: the running "ODE state / PDE state" line is now `drawText` split onto the two
  strips it was summarizing — `x = …` on the mass strip, `N numbers, max |u| = …` on the string
  strip. The prose links out to Bonini's paradox on Wikipedia.

Each `.js` exports `mount(root, ctx)`; each `.html` is an `<article>` with a `.viz` slot.
Neither the spine's hover pick nor the right pane's clock writes the shared tuple.
