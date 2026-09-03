# Panel 6: Eigen-what-now

Built. See `docs/idea.md` (section "6. Eigen-what-now") for the beat, and `docs/plan.md`
for the pane contract.

- `spine.html` + `spine.js`: Eigen-what-now. Three things, in order, and no readout under the
  picture: **Â**, the spring's system matrix with live entries; **v**, an arrow dragged around
  the plane; and **R = Â v**, drawn *split* — the part of `v` along one invariant direction,
  scaled by that direction's eigenvalue, plus whatever is left over, laid head to tail so the
  two pieces visibly add up to `R`. Land `v` on a direction and the leftover is zero and
  `R = λ̂ v`. The split is the eigenbasis one (`v = c₁û₁ + c₂û₂`, so `Âv = λ̂₁c₁û₁ + λ̂₂c₂û₂`
  exactly), not an orthogonal projection; `decompose` returns `null` — and the canvas says why
  — for a complex pair, for the defective repeated root at critical, and for a degenerate
  basis. Drawn in the spring's natural units `(x, v/ω)` per `1/ω` s, where
  `A = [[0, 1], [−k/m, −c/m]]` reads `Â = [[0, 1], [−1, −2ζ]]` (similar, so the eigenvectors
  are the same directions and the eigenvalues are `λ/ω`; at the demo `k/m = 100` the raw `A`
  has no readable picture). Everything the old readout said is still there, split by kind:
  the verdict sentence and the eigen-directions are `drawText` on the canvas, and the numbers
  (`λ̂`, the split coefficients, the raw `A`, `ω`, the regime, this pane's `c` against
  `2√(mk)`, the spring's untouched `c`) are `bindMath` slots in a `<small class="muted">` line
  under the equations. The prose column stayed near its old height on purpose: `.pane-body` is
  `overflow: hidden`, so a paragraph that does not fit is silently clipped.
- `left.html` + `left.js`: refresher, Matrices as transforms. **One matrix, three controls.**
  The matrix is a homogeneous 3×3 with the bottom row pinned to `[0 0 1]` (translation is the
  point, and a 2×2 has nowhere to put it) and its six live entries are *output*; translate
  (x and y), rotate, and scale are the input, composed as `M = T(tx, ty) · R(θ) · S(s)`.
  While a control is being dragged or keyed, the entries it writes are highlighted with
  `mathcolor` / `mathbackground` on the `<mn>` slots (panels ship no CSS): translate → the
  third column, rotate → all four of the top-left block, scale → the two diagonal entries at
  `θ = 0` and all four once the shape has been turned, because `s` multiplies `sin θ` too.
  The rule is read off `θ`, never off the drag, so it cannot flicker. `affine.js` holds the
  3×3 helpers and the affine twin of `drawTransformedGrid`; `shared/math/matrix2.js` is 2×2
  and stays that way.
- `right.html` + `right.js`: drill-down, Explode the eigenvector over a sweep. Rotation sweep
  `M(θ) = R(θ) · S(3, 1)` (the case `matrix2.test.js` pins: real directions converge and vanish at
  `θ* = arccos(2√(ab)/(a+b)) = 30°`) or the dull scale sweep `S(s, 0.5)`; one bundle per
  eigenvector, highlighted through `aux.highlight` from the sweep strip. No readout: the
  verdict for the highlighted value (how many degrees apart the directions are, or that they
  have gone complex) is `drawText` on the canvas, and `θ*` is left for the reader to find.

Two things that are deliberate and must survive any rewrite:

1. **The spine keeps its own damping and never writes the tuple.** `idea.md` wants an
   overdamped case so there are real invariant directions to land on, but the tuple's `c` is
   the demo's lightly-damped `0.1`. So `localC` defaults to `1.5 · 2√(mk)`, is recomputed only
   when the tuple's `m` or `k` change, and is otherwise left alone — including while the reader
   drags it down through critical to watch the directions converge and vanish. A write here
   used to leak into every later panel: the `c` slider on panels 7-13 landed on an overdamped
   spring after a reader passed through, killing the Euler blow-up Part II depends on. The
   pane exposes `localC` through a small store-shaped adapter whose one writable key is
   `localC` itself (range `C_RANGE`), so `bindScrub` can drag it where the prose prints it
   and `bindMath` can read it; nothing in this directory calls the tuple's `store.set`.
2. **`left` drives the matrix from the controls, not the other way round.** An earlier version
   had four scrubbable matrix entries and preset buttons; the entries are now read-only output.

Each `.js` exports `mount(root, ctx)`; each `.html` is an `<article>` with a `.viz` slot.
