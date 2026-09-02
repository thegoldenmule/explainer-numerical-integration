# Panel 10: Runge-Kutta family: explicit Euler

Not built yet. See `docs/idea.md` (section "10. Runge-Kutta family: explicit Euler") for the beat, and `docs/plan.md`
for the pane contract. Panes this directory will hold:

- `spine.html` + `spine.js`: Runge-Kutta family: explicit Euler
- `left.html` + `left.js`: refresher, Euler, step by step, to the disk
- `right.html` + `right.js`: drill-down, Explode h: nested disks

Each `.js` exports `mount(root, ctx)`; each `.html` is an `<article>` with a `.viz` slot.
