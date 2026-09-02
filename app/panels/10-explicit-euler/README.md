# Panel 10: Runge-Kutta family: explicit Euler

Built. See `docs/idea.md` (section "10. Runge-Kutta family: explicit Euler") for the beat,
and `docs/plan.md` for the pane contract.

- `spine.html` + `spine.js`: the first shaded region, `|1 + hλ| ≤ 1`, with the eigenvalues
  on it in green or red, Rhodes' reading in the margins, sliders on `h`, `m`, `c`, `k`.
- `left.html` + `left.js`: refresher, Euler, step by step, to the disk. A local explicit-Euler
  stepper walked one step at a time over the exact curve, the hand computation of
  `|1 + hλ|` in the prose, then the derivation.
- `right.html` + `right.js`: drill-down, Explode h: nested disks. Six Euler disks (10 to 60
  fps) as region layers in one shader pass with the analytic circles over them; a discrete
  slider sets the store's `h` and highlights that disk.

Every pane is pinned to explicit Euler regardless of the store's `method` (the region, the
verdict dots, and the numbers are Euler's); nothing here writes `method`. Each `.js` exports
`mount(root, ctx)`; each `.html` is an `<article>` with a `.viz` slot.
