# Panel 4: Physical stability

Built. See `docs/idea.md` (section "4. Physical stability") for the beat, and `docs/plan.md`
for the pane contract.

- `spine.html` + `spine.js`: Physical stability. The exact solution inside an ε-tube with six
  closed-form neighbors started on the ε-circle in `(x₀, v₀/ω)`; ε is `aux.epsilon`. Damping is
  **local to the pane**, a small `createStore` with limits `[−2, 50]`, seeded from the tuple's
  `c` and re-seeded whenever the tuple's `c` changes elsewhere, never written back: the tuple
  clamps `c ≥ 0`, so without a local what-if the panel could never show the unstable case it
  exists to explain. The verdict is the sign of `Re λ = −c / 2m` and flips between
  asymptotically stable, stable-but-not-asymptotically, and unstable; the first escape from the
  tube is marked on the plot.
- No left pane. (The old "What 'close' means" refresher plotted `d(t)` for one neighbor and
  never showed a run-away, so it was cut; the manifest entry is `left: null`.)
- `right.html` + `right.js`: drill-down, Lyapunov vs asymptotic. Three phase portraits side by
  side (`c = 0`, `c`, `−c`) with the flow field from `systemMatrix`; the unstable one negates `c`
  locally because the tuple clamps `c ≥ 0`.

Each `.js` exports `mount(root, ctx)`; each `.html` is an `<article>` with a `.viz` slot.
