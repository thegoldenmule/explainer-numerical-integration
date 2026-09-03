# Panel 2: Newtonian physics: F = ma

Built. See `docs/idea.md` (section "2. Newtonian physics: F = ma") for the beat, and
`docs/plan.md` for the pane contract. No pane here has a `.readout`: every number the reader
needs is either a slot inside a live MathML equation (`bindMath`) or a label on the canvas
(`drawText`).

- `spine.html` + `spine.js`: F = ma on the scene store's point mass. Each force is its own
  equation — wind `F = (fx, fy)`, gravity `F = G·m₁·m₂ / r²`, drag `F = −c·v`, spring
  `F = −k·x` — with every parameter a `data-scrub` draggable number and the vector it produces
  read out in the same equation. Below them, `ΣF` and `a = ΣF / m` as live MathML with `m`
  draggable too (there is no separate mass slider). The scrubs and slots bind through one
  pane-local `paramFacade()` over the scene store, the same shape panel 5's spine uses.
  Force arrows from `math/forces.js` (real models), the sum, `a`, and `v` on the plane; toggle
  each force, drag an arrow's head to scale it (`scene.setForceParam` through `paramStore`),
  drag the body, and step time by one explicit Euler step of the tuple's `h` in 2D (a local
  step: `createStepper` is 1D). `t`, the step count, `h`, `x` and `v` are canvas labels.
- `left.html` + `left.js`: refresher, Vectors. Two **free** vectors in a pane-local store, not
  the scene's forces: `a` from the origin, `b` from `a`'s tip, so the drawing is the
  decomposition and `a + b` runs from the origin to `b`'s tip. The dashed copies still close the
  parallelogram. Drag either tip, or scrub any of the four components in the equation; the
  components, the magnitudes and the triangle inequality are live MathML. Square (larger) stage
  with a fixed view that only ever grows, so the defaults keep both arrows and the sum on
  screen. *Departure from `docs/idea.md`, which says these are "the same arrows the reviewer
  just dragged on the spine": a force can only be scaled along the direction its model gives it
  (gravity has one parameter and always points at the attractor), so scene-backed arrows cannot
  both turn freely. This pane writes neither the scene nor the tuple.*
- `right.html` + `right.js`: drill-down, Torque and moment of inertia. The rectangle from panel
  1's drill-down with the same forces applied at a lever arm; `ΣT = r × ΣF`, `I = m(w² + h²)/12`
  and `θ″ = ΣT / I` as live MathML, θ integrated locally (there is no rigid-body store). θ, θ′
  and `t` live in a pane-local store together with the lever arm `d`, so one `bindMath` over it
  catches the integration and a second over the scene catches a force being toggled or dragged.
- `arrows.js`: shared by the three panes: force colors, `forceVectors`, `arrowMap` (below), the
  identity map the left pane draws through, and the parameter patch a dragged tip produces.

## The arrow map

`arrowMap(state)` replaces the old `arrowScale`, which normalised to the largest *active* force
so switching one force off moved every other arrow. Two properties now hold:

- **Toggle-independent.** The reference magnitude `ref` is taken over every force in the scene,
  switched on or not, plus the sum of all of them and that sum over `m`. Flipping a switch
  removes one arrow and leaves the rest exactly where they were.
- **Logarithmic length.** Forces here span two orders of magnitude (the spring at `x = 1` with
  `k = 100` is ~100, gravity at the defaults is ~1, drag at `v = 2` is 0.2), so
  `len(F) = ARROW_LEN · ln(1 + |F| / F0) / ln(1 + ref / F0)` with `F0 = 0.1`. Every arrow is
  visible at once; the numbers in the equations stay the truth, and the canvas says so.

`toForce()` inverts `len`, so dragging an arrow's tip still reads back as a force; a pane
freezes the whole map for the duration of a drag so the tip stays under the pointer.

Each `.js` exports `mount(root, ctx)`; each `.html` is an `<article>` with a `.viz` slot.
