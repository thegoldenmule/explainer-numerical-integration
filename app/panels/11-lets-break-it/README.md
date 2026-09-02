# Panel 11: Let’s break it

Spine and left are built; the right pane is not. See `docs/idea.md` (section "11. Let’s break
it") for the beat, and `docs/plan.md` for the pane contract.

- `spine.html` + `spine.js`: Let’s break it. The region under a draggable λ, the spring
  running against the exact solution, transport, an `h` slider, the integrator picker, and
  presets. Laid out to fit beside the essay prose at 1280×800: the half plane beside the
  slider, transport, and a five-line readout; the run strip; picker and presets in one row.
- `left.html` + `left.js`: refresher, The exact solution, no method. A draggable λ on a plane
  with no region and the closed form for that λ in time; buttons jump to pure decay, a
  spiral, and pure oscillation.
- `right.html` + `right.js`: drill-down, Explode the plane: a grid of λ (not built).

Each `.js` exports `mount(root, ctx)`; each `.html` is an `<article>` with a `.viz` slot.
