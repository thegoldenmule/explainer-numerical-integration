# Panel 6: Eigen-what-now

Built. See `docs/idea.md` (section "6. Eigen-what-now") for the beat, and `docs/plan.md`
for the pane contract.

- `spine.html` + `spine.js`: Eigen-what-now. The spring's system matrix acting on a grid with
  a draggable vector and its image; the real invariant directions light up when the vector
  lands within 4° of one, with the eigenvalue as the scale factor. Drawn in the spring's natural
  units `(x, v/ω)` per `1/ω` s, where `A = [[0, 1], [−k/m, −c/m]]` reads `Â = [[0, 1], [−1, −2ζ]]`
  (similar, so the eigenvectors are the same directions and the eigenvalues are `λ/ω`; at the
  demo `k/m = 100` the raw `A` has no readable picture). Starts from an overdamped preset
  (`c = 1.5 · 2√(mk)` applied on mount and on resume when the tuple is underdamped; the readout
  says so); lower `c` and the directions vanish at `c = 2√(mk)`.
- `left.html` + `left.js`: refresher, Matrices as transforms. A shape under a matrix whose four
  entries are scrubbable numbers in a local store; presets for identity, scale, skew, rotate, flip.
- `right.html` + `right.js`: drill-down, Explode the eigenvector over a sweep. Rotation sweep
  `M(θ) = R(θ) · S(3, 1)` (the case `matrix2.test.js` pins: real directions converge and vanish at
  `θ* = arccos(2√(ab)/(a+b)) = 30°`) or the dull scale sweep `S(s, 0.5)`; one bundle per
  eigenvector, highlighted through `aux.highlight` from the sweep strip.

Each `.js` exports `mount(root, ctx)`; each `.html` is an `<article>` with a `.viz` slot.
