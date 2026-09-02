# Panel 7: Finding eigenvalues

Built. See `docs/idea.md` (section "7. Finding eigenvalues") for the beat, and `docs/plan.md`
for the pane contract.

- `spine.html` + `spine.js`: Finding eigenvalues. The quadratic formula with live numbers, the
  two roots on the complex plane, `m`, `c`, `k` sliders.
- `left.html` + `left.js`: refresher, Quadratics and complex numbers. The formula on the real
  line with the discriminant drawn as the ±√disc / 2m bracket (lifted off the line when it is
  negative), then one root as a point with its real part, imaginary part, and modulus.
- `right.html` + `right.js`: drill-down, Under-, critically, and overdamped. A `c` slider
  sweeps the discriminant through zero; the roots collide and split on the plane while the
  closed-form solution beside them switches regime.

The roots on all three panes are colored by the physical verdict (Re λ < 0), drawn over
cplane's method-dependent dots. Each `.js` exports `mount(root, ctx)`; each `.html` is an
`<article>` with a `.viz` slot.
