# Panel 4: Physical stability

Built. See `docs/idea.md` (section "4. Physical stability") for the beat, and `docs/plan.md`
for the pane contract.

- `spine.html` + `spine.js`: Physical stability. The exact solution inside an ε-tube with six
  closed-form neighbors started on the ε-circle in `(x₀, v₀/ω)`; ε is `aux.epsilon`, `c` is the
  tuple's. The readout says that a linear spring with `c ≥ 0` is never unstable.
- `left.html` + `left.js`: refresher, What "close" means. Exactly two curves and their distance
  `d(t)` as one line; drag the neighbor's start on the top strip.
- `right.html` + `right.js`: drill-down, Lyapunov vs asymptotic. Three phase portraits side by
  side (`c = 0`, `c`, `−c`) with the flow field from `systemMatrix`; the unstable one negates `c`
  locally because the tuple clamps `c ≥ 0`.

Each `.js` exports `mount(root, ctx)`; each `.html` is an `<article>` with a `.viz` slot.
