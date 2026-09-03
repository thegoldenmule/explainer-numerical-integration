# Panel 10: Runge-Kutta family: explicit Euler

Built. See `design/idea.md` (section "10. Runge-Kutta family: explicit Euler") for the beat,
and `design/plan.md` for the pane contract.

- `spine.html` + `spine.js`: the first shaded region, `|1 + hλ| ≤ 1`, with the eigenvalues
  on it in green or red, Rhodes' reading in the margins, `h`, `m`, `c`, `k` scrubbable in the prose. No
  readout: the verdict word and the halving/doubling time it implies are `bindMath` slots in
  the prose sentence that already carries `|1 + hλ|`.
- `left.html` + `left.js`: refresher, Euler, step by step, to the disk. A local explicit-Euler
  stepper walked one step at a time over the exact curve, the hand computation of
  `|1 + hλ|` in the prose, then the derivation. No readout: the last step's `t`/`x`/`exact`/
  error/ratio are `drawText` in the top-right corner of the plot. Stage is `wide`, not `strip`:
  a tangent walk reads better tall, and nothing sits under it: `h` is scrubbed in the prose.
- `right.html` + `right.js`: drill-down, Explode h: nested disks. Six Euler disks (10 to 60
  fps) as region layers in one shader pass with the analytic circles over them; a discrete
  slider sets the store's `h` and highlights that disk. No readout: only the highlighted h's
  own `|1 + hλ|` and inside/outside verdict survive, `drawText` on the plane itself beside the
  disk-geometry label that was already there — the other five h's own rows were dropped as
  redundant with the nested disks, which already show visually which radii the eigenvalue
  falls inside.

Every pane is pinned to explicit Euler regardless of the store's `method` (the region, the
verdict dots, and the numbers are Euler's); nothing here writes `method`. Each `.js` exports
`mount(root, ctx)`; each `.html` is an `<article>` with a `.viz` slot.
