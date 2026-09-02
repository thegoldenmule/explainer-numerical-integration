# Panel 11: Let’s break it

Not built yet. See `docs/idea.md` (section "11. Let’s break it") for the beat, and `docs/plan.md`
for the pane contract. Panes this directory will hold:

- `spine.html` + `spine.js`: Let’s break it
- `left.html` + `left.js`: refresher, Reading the complex plane
- `right.html` + `right.js`: drill-down, Methods with no scalar R

Each `.js` exports `mount(root, ctx)`; each `.html` is an `<article>` with a `.viz` slot.
