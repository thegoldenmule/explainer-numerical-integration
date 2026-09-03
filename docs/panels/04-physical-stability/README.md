# Panel 4: Physical stability

Built. See `design/idea.md` (section "4. Physical stability") for the beat, and `design/plan.md`
for the pane contract.

- `spine.html` + `spine.js`: Physical stability. The exact solution inside an ε-tube with six
  closed-form neighbors started on the ε-circle in `(x₀, v₀/ω)`; ε is `aux.epsilon`. Damping is
  **local to the pane**, a small `createStore` with limits `[−2, 50]`, seeded from the tuple's
  `c` and re-seeded whenever the tuple's `c` changes elsewhere, never written back: the tuple
  clamps `c ≥ 0`, so without a local what-if the panel could never show the unstable case it
  exists to explain. The verdict is the sign of `Re λ = −c / 2m` and flips between
  asymptotically stable, stable-but-not-asymptotically, and unstable; the first escape from the
  tube is marked on the plot. No readout: the neighbor sweep (`exact[]`, the six perturbed
  curves, the escape stats) is memoized once behind `measure()`, called by both the draw and a
  live prose sentence — the colored verdict word, `Re λ`, the farthest strayed, and the
  distance (and inside/outside verdict) at `t = 6 s` — bound with `bindMath` on all three
  stores (tuple, local damping, aux) so it stays current whichever one moves.
- No left pane. (The old "What 'close' means" refresher plotted `d(t)` for one neighbor and
  never showed a run-away, so it was cut; the manifest entry is `left: null`.)
- `right.html` + `right.js`: drill-down, Lyapunov vs asymptotic. Three phase portraits side by
  side (`c = 0`, `c`, `−c`) with the flow field from `systemMatrix`; the unstable one negates `c`
  locally because the tuple clamps `c ≥ 0`. No readout: each portrait's own label now reads
  `c = …, Re λ = …` instead of just `c = …`, so the formula lands beside the picture it
  describes; the fact that the tuple's `c ≥ 0` forces the third portrait to negate `c` locally
  is static prose now, alongside the Lyapunov definitions.

Each `.js` exports `mount(root, ctx)`; each `.html` is an `<article>` with a `.viz` slot.
