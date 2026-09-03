# Panel 9: Finding error

Built. See `design/idea.md` (section "9. Finding error") for the beat, and `design/plan.md` for the
pane contract. Panes in this directory:

- `spine.html` + `spine.js`: Finding error. No readout: the measured ratio `z` and the
  doubling/halving time it implies — the panel's beat — are `drawText` in the error strip's
  own top-right corner instead of a box beside it.
- `left.html` + `left.js`: refresher, Geometric growth. No readout: `e₁ = z·e₀`, the value
  after `n` steps, and the doubling/halving time are `drawText` on the plot itself, in
  whichever top corner the curve isn't climbing toward.
- `right.html` + `right.js`: drill-down, The modal equation. No readout: `λ₁`/`|R(hλ₁)|` and
  `λ₂`/`|R(hλ₂)|` (colored by verdict) are `drawText` in the corner of the modal-magnitude
  sub-plot, and the `(x₀, v₀) = a₁(…) + a₂(…)` decomposition in the corner of the
  reconstructed-`x` sub-plot — each number beside the picture it belongs to.

Each `.js` exports `mount(root, ctx)`; each `.html` is an `<article>` with a `.viz` slot.
