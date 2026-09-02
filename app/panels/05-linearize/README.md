# Panel 5: Stability analysis: linearize

Not built yet. See `docs/idea.md` (section "5. Stability analysis: linearize") for the beat, and `docs/plan.md`
for the pane contract. Panes this directory will hold:

- `spine.html` + `spine.js`: Stability analysis: linearize
- `left.html` + `left.js`: refresher, What “linear” means
- `right.html` + `right.js`: drill-down, Taylor expansion and 1/r² gravity

Each `.js` exports `mount(root, ctx)`; each `.html` is an `<article>` with a `.viz` slot.
