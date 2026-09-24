# Panel 1: Point masses

Built. See `design/idea.md` (section "1. Point masses") for the beat, and `design/plan.md` for the
pane contract. The panel is the ground floor of the ladder: fully concrete, no wildcards,
nothing animated. There is no left pane.

- `spine.html` + `spine.js`: the point mass itself. One dot on a `fill` stage, dragged with
  `createDragHandles` through `scene.moveBody`, so the body panel 2 hangs its force arrows on
  and panel 5 scrubs its force models around is the body the reader just moved here. Its two
  coordinates are drawn as dashed drop lines onto the axes, `m` is a label beside the dot and a
  scrubbable number in the prose over `scene.paramStore('body')`, and `(x, y)` and `m` are live `data-var` slots in the
  prose (`bindMath` over the scene). No readout: `x`, `y`, and `m` are each already drawn once,
  on the canvas beside the point they describe, so the box only ever repeated them.
  The dot's radius never moves with `m`: the panel's one sentence is "all the mass at one point,
  no extent", and a dot that grew with mass would draw the opposite.
- `right.html` + `right.js`: drill-down, Rigid bodies: extent and rotation. The point grows into
  the L of `body.js`, drawn already turned by `THETA0 = 0.6` rad so rotation reads as part of the
  state before anything is touched. `(x, y, θ)` is printed in the prose as MathML and every one
  of the three numbers is scrubbable (`bindScrub` + `bindMath` over one facade); the body can
  also be dragged anywhere on its outline or interior, and a handle on its own axis spins it
  about the centre of mass, with the reference ray, the arc and the θ label on the canvas. No readout: `x` and `y` were already implied by the body's drawn
  position and `θ` by the prose equation, but `m` was not shown anywhere on this pane before, so
  it now gets its own `drawText` beside the centre-of-mass label. Position lives in the shared
  scene, so dragging here moves the spine's point; `θ` lives in a pane-local `createStore` at
  module scope, which is what makes it survive the pane manager destroying and remounting the
  pane. Neither pane writes the tuple except through `scene.setMass`, the scene's one documented
  sync, and only on a reader's drag.
- `body.js`: the rigid body as pure geometry — the `OUTLINE`, its shoelace `polygonCentroid`,
  `BODY` (the outline recentred on its centre of mass), `BODY_RADIUS`, `worldPoints(θ, x, y)`,
  a `inside()` ray cast and `grabSamples(step)`. It is a module rather than a constant in
  `right.js` because the body is a shared prop: panel 2's drill-down puts torque on the same
  one and can `import { BODY, worldPoints } from 'panels/01-point-masses/body.js'`.

## Two notes for whoever touches this next

- **The plane's coordinates are shared, its scale is not.** `HALF_W = 4` and the drag clamp
  `|y| ≤ 2.2` match panel 2's spine exactly (panel 5's spine uses a tighter ±3 × ±1), so the
  body keeps its `(x, y)` from panel to panel. Each view is fitted to its own stage, though,
  and on a stage wider than square `makeView`'s `minHalfH` widens it so the whole drag box
  shows: at 1280×720 panel 1's spine shows ±4 × ±4 and panel 2's ±6.5 × ±2.6, so the body can
  shift on screen between panels. Changing `HALF_W` or the clamp means changing it in each.
- **`grabSamples` is a workaround, not a design.** `createDragHandles` hit-tests against a list
  of points, so "grab the body anywhere" has to be spelled out as a lattice dense enough that
  its 14 px radius covers the gaps. The step is computed in CSS pixels from the live view and
  the lattice is rebuilt only on a resize. A `hitTest` callback on `createDragHandles` would
  retire the whole thing.

Each `.js` exports `mount(root, ctx)`; each `.html` is an `<article>` with a `.viz` slot.
