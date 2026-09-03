# Panel 6: Eigen-what-now

Built. See `docs/idea.md` (section "6. Eigen-what-now") for the beat, and `docs/plan.md`
for the pane contract.

- `spine.html` + `spine.js`: Eigen-what-now. Three things, in order, and no readout under the
  picture: **Â**, a 2×2 matrix whose four entries are draggable numbers right in the
  equation; **v**, an arrow dragged around the plane (also draggable as the same equation's
  two numbers); and **R = Â v**, drawn *split* — the part of `v` along one invariant
  direction, scaled by that direction's eigenvalue, plus whatever is left over, laid head to
  tail so the two pieces visibly add up to `R`. Land `v` on a direction and the leftover is
  zero and `R = λ̂ v`. The split is the eigenbasis one (`v = c₁û₁ + c₂û₂`, so
  `Âv = λ̂₁c₁û₁ + λ̂₂c₂û₂` exactly), not an orthogonal projection; `decompose` returns `null`
  — and the canvas says why — for a complex pair, for the defective repeated root at
  critical, and for a degenerate basis. Â opens at the spring's own matrix in natural units,
  overdamped (`ζ = PRESET_FACTOR`, so the diagonal opens at a plain constant, `−2 ·
  PRESET_FACTOR`, regardless of `m` and `k`), so both invariant directions are real from the
  first frame — but from there it is a free matrix, and dragging any entry stops it being any
  spring's. `R` is the one output slot (`bindMath`, no `data-scrub`); the verdict sentence and
  the eigen-directions are `drawText` on the canvas, same as always.
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

1. **The spine never reads or writes the tuple, at all.** `idea.md` wants an overdamped case
   so there are real invariant directions to land on, but the tuple's `c` is the demo's
   lightly-damped `0.1`; a version that built Â from the tuple's own `m, c, k` used to leak a
   write back into every later panel — the `c` slider on panels 7-13 landed on an overdamped
   spring after a reader passed through, killing the Euler blow-up Part II depends on. So Â's
   four entries and v's two live in this pane's own closure, seeded once at mount to the
   overdamped natural-units default (`PRESET_FACTOR`, a plain constant — not derived from any
   tuple read), and from then on are the reader's own: a store-shaped adapter (`local`) whose
   six keys (`a00, a01, a10, a11, vx, vy`) are all writable within `M_RANGE` / `V_RANGE`, so
   `bindScrub` can drag every one of them where the prose prints them. A remount opens fresh
   at the same default; nothing in this directory calls `ctx.store` at all.
2. **`left` drives the matrix from the controls, not the other way round.** An earlier version
   had four scrubbable matrix entries and preset buttons; the entries are now read-only output.
   (The spine's own Â is a different matrix in a different equation and is unaffected by this —
   its four entries are the point there.)

Each `.js` exports `mount(root, ctx)`; each `.html` is an `<article>` with a `.viz` slot.
