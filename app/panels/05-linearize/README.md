# Panel 5: Stability analysis: linearize

Built. See `docs/idea.md` (section "5. Stability analysis: linearize") for the beat, and
`docs/plan.md` for the pane contract.

- `spine.html` + `spine.js`: each force as its equation with every parameter a scrubbable number
  (one facade store over the scene's `paramStore`s, so `bindScrub`/`bindMath` take the article
  once), on/off switches, the real-vs-linear switch on gravitation (the only model that differs),
  the force arrows, `a`, and a 2 s RK4 look-ahead; `M`, `C`, `K` assemble from `assemble(scene)` and
  `scene.pushToTuple()` writes the tuple on resume and on every scene change while on screen.
- `left.html` + `left.js`: refresher, What "linear" means. `f(a + b)` against `f(a) + f(b)` with
  two draggable inputs, for `f(x) = 2x` and `f(x) = x²`.
- `right.html` + `right.js`: drill-down, Taylor expansion and 1/r² gravity. `inverseSquareExpansion`
  about the gravity force's `r₀` with a term-count sweep strip (`aux.highlight`); then the nonlinear
  run (`simulate` with a custom `accel` from `netForce`, real models, RK4) beside the linearized run
  and the verdict from the assembled `M, C, K`, with a readout that flags the cases where the
  prediction says stable and the mass falls into the attractor.

Each `.js` exports `mount(root, ctx)`; each `.html` is an `<article>` with a `.viz` slot.
