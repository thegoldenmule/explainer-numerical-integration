# Panel 12: Higher-order Runge-Kutta

Not built yet. See `docs/idea.md` (section "12. Higher-order Runge-Kutta") for the beat, and `docs/plan.md`
for the pane contract. Panes this directory will hold:

- `spine.html` + `spine.js`: Higher-order Runge-Kutta
- `left.html` + `left.js`: refresher, Taylor series
- `right.html` + `right.js`: drill-down, Implicit methods: why hard

Each `.js` exports `mount(root, ctx)`; each `.html` is an `<article>` with a `.viz` slot.
