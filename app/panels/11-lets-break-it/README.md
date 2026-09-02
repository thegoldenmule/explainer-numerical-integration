# Panel 11: Let’s break it

Not built yet. See `docs/idea.md` (section "11. Let’s break it") for the beat, and `docs/plan.md`
for the pane contract. Panes this directory will hold:

- `spine.html` + `spine.js`: Let’s break it
- `left.html` + `left.js`: refresher, The exact solution, no method
- `right.html` + `right.js`: drill-down, Explode the plane: a grid of λ

Each `.js` exports `mount(root, ctx)`; each `.html` is an `<article>` with a `.viz` slot.
