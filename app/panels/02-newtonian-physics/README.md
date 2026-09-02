# Panel 2: Newtonian physics: F = ma

Built. See `docs/idea.md` (section "2. Newtonian physics: F = ma") for the beat, and
`docs/plan.md` for the pane contract.

- `spine.html` + `spine.js`: F = ma on the scene store's point mass. Force arrows from
  `math/forces.js` (real models), the sum, `a = ΣF / m`, and `v`; toggle each force, drag an
  arrow's head to scale it (`scene.setForceParam` through `paramStore`), drag the body, and step
  time by one explicit Euler step of the tuple's `h` in 2D (a local step: `createStepper` is 1D).
- `left.html` + `left.js`: refresher, Vectors. The scene's wind and gravity arrows tail to tail,
  their sum, the parallelogram, components and magnitudes; drag either tip.
- `right.html` + `right.js`: drill-down, Torque and moment of inertia. The rectangle from panel
  1's drill-down with the same forces applied at a lever arm; `ΣT = I θ″` with
  `I = m(w² + h²)/12`, θ integrated locally (there is no rigid-body store).
- `arrows.js`: shared by the three panes: force colors, the adaptive arrow scale, and the
  parameter patch a dragged tip produces.

Each `.js` exports `mount(root, ctx)`; each `.html` is an `<article>` with a `.viz` slot.
