# Panel 12: Higher-order Runge-Kutta

Not built yet. See `docs/idea.md` (section "12. Higher-order Runge-Kutta") for the beat, and `docs/plan.md`
for the pane contract. Panel 12 is the one exception to "side panes are one deep": its right
pane is a three-long chain, each reached by another rightward move (`#/12/right`,
`#/12/right/2`, `#/12/right/3`). Panes this directory will hold:

- `spine.html` + `spine.js`: Higher-order Runge-Kutta
- `left.html` + `left.js`: refresher, Taylor series
- `right.html` + `right.js`: drill-down, depth 1, Explode order
- `right-2.html` + `right-2.js`: drill-down, depth 2, Implicit Euler
- `right-3.html` + `right-3.js`: drill-down, depth 3, Verlet

Each `.js` exports `mount(root, ctx)`; each `.html` is an `<article>` with a `.viz` slot.
