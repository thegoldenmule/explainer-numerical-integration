# Panel 11: Let’s break it

Built. See `docs/idea.md` (section "11. Let’s break it") for the beat, and `docs/plan.md`
for the pane contract.

- `spine.html` + `spine.js`: Let’s break it. The region under a draggable λ, the spring
  running against the exact solution, transport, an `h` slider, the integrator picker, and
  presets. Laid out to fit beside the essay prose at 1280×800: the half plane beside the
  slider and transport; the run strip; picker and presets in one row. No readout: the
  verdict/`|R|`, the predicted-vs-measured doubling time, and `t`/`x`/exact are `drawText` in
  the run strip's own top-right corner.
- `left.html` + `left.js`: refresher, The exact solution, no method. A draggable λ on a plane
  with no region and the closed form for that λ in time; buttons jump to pure decay, a
  spiral, and pure oscillation. No readout: `verdict: 'physical'` turns off the plane's own
  `|R|` labels, so λ's value is `drawText` in the run's own corner (the only place it is
  printed), alongside a one/two-word category name (the long definitions stay in the prose).
- `right.html` + `right.js`: drill-down, Explode the plane: a grid of λ. Nine λ inside, on,
  and outside the current method's boundary, drawn on the plane over the region, each with a
  mini trajectory in a 3×3 grid of small multiples; hover a point or a multiple to highlight
  it. No readout: every number it carried (λ, kind, `|R|`/`ρ`, verdict) was already drawn on
  the plane or per-cell, so the box was a duplicate. The `.viz-row` around the plane stage
  stays even with an empty second column: standalone, `.stage.half` loses the
  `min(48%, …)` cap that keeps it from growing taller than the `wide` grid stage stacked
  under it can afford.

Each `.js` exports `mount(root, ctx)`; each `.html` is an `<article>` with a `.viz` slot.
