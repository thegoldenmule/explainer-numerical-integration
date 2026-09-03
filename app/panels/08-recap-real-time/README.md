# Panel 8: Recap: real time

Built. See `docs/idea.md` (section "8. Recap: real time") for the beat, and `docs/plan.md` for the
pane contract. Panes in this directory:

- `spine.html` + `spine.js`: Recap: real time. The run with the log-scaled frame-budget bar above
  it. Every cost number is on the bar's label and in the prose (`bindMath`); the live error is
  drawn in the top-right of the plot. No readout. The window is a few periods of the current
  spring and the vertical range is the run's own amplitude, so the trace oscillates at a readable
  scale and a blown-up Euler leaves the frame. Preset buttons (`demo`, `essay`) are the only
  writes of `m, c, k`, and only when the reader presses one.
- `left.html` + `left.js`: refresher, Frame budget, ms per frame. One frame at true scale with the
  physics slice inside it. A spring step is ~16 ns, so the pane budgets for an **object count**
  (pane-local store, log slider 1 … 10 M, default 500 000 — the essay's "a few milliseconds every
  frame") and the slice is `count × steps-per-frame × cost-per-step`; push it past the budget line
  and the axis stretches to show how late the frame is. The display rate (60/30 fps) is pane-local too. No readout.
- `right.html` + `right.js`: drill-down, Explode h: all step sizes at once. The bundle, with the
  highlighted run's `h`, cost, and error drawn in the top-right of the plot. No readout.
- `cost.js`: local helpers shared by the three panes (the frame budget, steps per frame, the
  budget bar, `plotSpan` for how many seconds of run to show, and the `fmtMs` / `fmtCount` /
  `fmtSteps` formatters); the per-step cost is `shared/player.js`'s calibrated benchmark.

Neither the object count nor the display rate touches the shared tuple: both live in a pane-local
`createStore`, so visiting the left pane leaves `(method, h, m, c, k, x0, v0, t)` untouched.

Each `.js` exports `mount(root, ctx)`; each `.html` is an `<article>` with a `.viz` slot.
