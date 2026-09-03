# Panel 7: Finding eigenvalues

Built. See `design/idea.md` (section "7. Finding eigenvalues") for the beat, and `design/plan.md`
for the pane contract.

No pane in this panel has a slider. Every parameter is a `data-scrub` number inside the MathML
of the formula it belongs to (`bindScrub` + `bindMath` on the `<article>`), so the reader drags
`m`, `c`, `k` *in the quadratic formula* and the roots move.

- `spine.html` + `spine.js`: Finding eigenvalues. The quadratic formula with every number in it
  draggable, and the two roots on the complex plane. `Re λ > 0` is shaded on its own canvas
  layer under the plane, and `c` can be dragged negative so the roots actually cross into it.
- `left.html` + `left.js`: refresher, Quadratics and complex numbers. One root as a point on the
  plane with its real part, imaginary part and modulus, plus the two halves of the formula drawn
  on the same plane: the centre `−c/2m` and the `±√(c² − 4mk)/2m` that carries the roots away
  from it — along the real axis when the discriminant is positive, off it when it is negative.
  The root is draggable (cplane inverts λ back to `c` and `k`).
- `right.html` + `right.js`: drill-down, Under-, critically, and overdamped. Dragging `c`
  sweeps the discriminant through zero; the roots collide and split on the plane while the
  closed-form solution beside them switches regime. One button, `set c = 2√(mk)`, because
  critical is a measure-zero value no drag lands on; the prose defines the word before the
  button uses it.

- `local.js`: `localDamping(store, { range })`, a store-shaped facade whose `c` is the pane's
  own copy over its own range and is **never written to the tuple**; `m` and `k` still route to
  the tuple. The spine uses it for a negative `c` (`Re λ = −c/2m`, and `LIMITS.c = [0, 50]`
  makes a positive real part otherwise unreachable — the panel could never show the unstable
  half-plane it exists to explain); the right pane uses it for the overdamped sweep, which
  CLAUDE.md also names as a local-only what-if. An external write to the tuple's `c` re-seeds
  the local copy. Both panes say in prose that the `c` on screen is a local copy and print the
  spring's own alongside it. The left pane needs no what-if and reads and writes the tuple.

The roots on all three panes are colored by the physical verdict (`Re λ ≤ 0`), drawn over
cplane's method-dependent dots. Each `.js` exports `mount(root, ctx)`; each `.html` is an
`<article>` with a `.viz` slot.
