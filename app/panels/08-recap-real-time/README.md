# Panel 8: Recap: real time

Not built yet. See `docs/idea.md` (section "8. Recap: real time") for the beat, and `docs/plan.md`
for the pane contract. Panes this directory will hold:

- `spine.html` + `spine.js`: Recap: real time
- `left.html` + `left.js`: refresher, Frame budget, ms per frame
- `right.html` + `right.js`: drill-down, Explode h: all step sizes at once

Each `.js` exports `mount(root, ctx)`; each `.html` is an `<article>` with a `.viz` slot.
