# Panel 13: Variable step sizes

Not built yet. See `docs/idea.md` (section "13. Variable step sizes") for the beat, and `docs/plan.md`
for the pane contract. Panes this directory will hold:

- `spine.html` + `spine.js`: Variable step sizes
- `left.html` + `left.js`: refresher, Local vs global error
- `right.html` + `right.js`: drill-down, Adaptive step controllers

Each `.js` exports `mount(root, ctx)`; each `.html` is an `<article>` with a `.viz` slot.
