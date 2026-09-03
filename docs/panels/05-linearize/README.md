# Panel 5: Stability analysis: linearize

Built. See `design/idea.md` (section "5. Stability analysis: linearize") for the beat, and
`design/plan.md` for the pane contract.

- `spine.html` + `spine.js`: each force as its equation with every parameter a scrubbable number
  (one facade store over the scene's `paramStore`s, so `bindScrub`/`bindMath` take the article
  once), on/off switches, the real-vs-linear switch on gravitation (the only model that differs),
  a coloured swatch per force keyed to its arrow (`--force-*` tokens, one hue each), the
  force arrows, `a`, and a 2 s RK4
  look-ahead. Arrow length is a *static* log map of `|F|` (`LEN` in `spine.js`), so an arrow's
  length depends on nothing but its own force: switching one off or scrubbing `k` leaves every
  other arrow exactly where it was. `M`, `C`, `K` assemble from `assemble(scene)` into the MathML
  block under the stage and into the prose's `M x″ + C x′ + K x = 0`, and `scene.pushToTuple()`
  writes the tuple on resume and on every scene change while on screen. There is no readout.
- `left.html` + `left.js`: refresher, What "linear" means. `f(a + b)` against `f(a) + f(b)` with
  two draggable inputs on the x axis, their outputs dropped to the curve, and the arithmetic
  (`f(a) + f(b) = …`, `f(a + b) = …`, the pass/fail verdict) `drawText` in the top-right corner
  of the plot, for `f(x) = 2x` and `f(x) = x²`. No readout.
- `right.html` + `right.js`: drill-down, Taylor expansion and 1/r² gravity. One square stage:
  `inverseSquareExpansion` about the gravity force's `r₀`, every term count drawn at once
  (`drawBundle`) against the true curve, with `r₀` and the mass's own distance marked; the
  term-count sweep strip (`aux.highlight`) sits under the graph and is the pane's only control.
  No readout, and no second stage: the nonlinear-vs-linearized run and its parameter sliders
  were cut, so `design/idea.md`'s "payoff beat" for this pane no longer describes it.

Each `.js` exports `mount(root, ctx)`; each `.html` is an `<article>` with a `.viz` slot.
