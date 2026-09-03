# Panel 12: Higher-order Runge-Kutta

Built. See `docs/idea.md` (section "12. Higher-order Runge-Kutta") for the beat, and
`docs/plan.md` for the pane contract. Panel 12 is the one exception to "side panes are one
deep": its right pane is a three-long chain (`#/12/right`, `#/12/right/2`, `#/12/right/3`).

- `spine.html` + `spine.js`: two graphs, stacked full width — the region for the store's
  method (with its eigenvalues), and the live run against the exact curve — then just the
  method picker below, no presets, no transport. The small multiples (Euler, RK4, implicit
  Euler pinned to the same λ) that used to sit between them were dropped: two graphs, not
  five. The plane centers and sizes itself to the current method's own shape (Euler and
  implicit's circles, RK4's wider bounded region) so the whole thing is visible rather than a
  crop, the same fix panel 10's disk got. The run plays on `createPlayer`'s own autoplay with
  nothing to pause it, and `m`, `k` are draggable in the prose's own equation (`data-scrub`
  straight into the tuple, same pattern as panel 8's `h`) rather than a pick from two fixed
  cases. The contrast: implicit Euler never explodes and visibly over-damps the essay spring.
  No readout: the method's verdict and `t`/`x`/exact are `drawText` in the run's own corner.
- `left.html` + `left.js`: refresher, Taylor series. Partial sums of eˣ added one term at a
  time (a local slider), against the exponential, with |Sₙ(hλ)| for the current spring. No
  readout: the graph title already carries `Sₙ(x): n+1 terms`; the expansion itself,
  `eᶻ = 1 + z + z²/2 + …` to degree `n`, prints under the strip as an `mtable` (`seriesMathML`)
  — one term per row, so growing `n` adds exactly one row instead of one long inline formula
  wrapping wherever the browser runs out of width, same pattern as panel 5 right's series.
  `|Sₙ(hλ)|` against the exact factor and the grow/shrink verdict are a live prose sentence,
  bound with `bindMath` on both the tuple store and `aux` (the strip's `n` lives in
  `aux.highlight`), reading `n` fresh from `aux` each time rather than a closure variable, so
  it owes nothing to subscription order.
- `right.html` + `right.js`: drill-down, depth 1, Explode order. RK1–RK4 regions as Taylor
  `order` layers in one shader pass; a local slider highlights one order and its polynomial.
  No readout: only the highlighted order's own polynomial and `|S|` verdict survive, `drawText`
  directly on the plane (top-right corner); the other three orders' rows were dropped as
  redundant with the overlaid regions, which already show which order reaches where.
- `right-2.html` + `right-2.js`: drill-down, depth 2, Implicit Euler. Its region, and a bundle
  of implicit runs across six step sizes against the exact curve; `h` drags continuously right
  in the prose's own "drag h" sentence (`data-scrub`, clamped to the bundle's own range), and
  `nearestIndex` highlights whichever bundled run it lands closest to — no separate slider. No
  readout: only the highlighted run's `x` at the window's end, against the exact one, survives,
  `drawText` in the run strip's corner; the other five rows were dropped — the bundle's own
  spread already shows the over-damping growing with the step.
- `right-3.html` + `right-3.js`: drill-down, depth 3, Verlet. The spectral radius `ρ` of its
  2×2 update as a heatmap over `(hω, ζ)`, with a switch to overlay semi-implicit Euler; hover a
  cell to run it against the exact curve. No readout: `ρ`/verdict, the phase-drift line, and
  the last-period amplitude comparison are `drawText` stacked beneath the run strip's own
  title; the duplicate `k = 0` fallback message was dropped (already drawn on the canvas).

Each `.js` exports `mount(root, ctx)`; each `.html` is an `<article>` with a `.viz` slot.
