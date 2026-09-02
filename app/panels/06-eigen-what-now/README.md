# Panel 6: Eigen-what-now

Not built yet. See `docs/idea.md` (section "6. Eigen-what-now") for the beat, and `docs/plan.md`
for the pane contract. Panes this directory will hold:

- `spine.html` + `spine.js`: Eigen-what-now
- `left.html` + `left.js`: refresher, Matrices as transforms
- `right.html` + `right.js`: drill-down, Explode the eigenvector over a sweep

Each `.js` exports `mount(root, ctx)`; each `.html` is an `<article>` with a `.viz` slot.
