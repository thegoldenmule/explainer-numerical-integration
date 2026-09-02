# Panel 4: Physical stability

Not built yet. See `docs/idea.md` (section "4. Physical stability") for the beat, and `docs/plan.md`
for the pane contract. Panes this directory will hold:

- `spine.html` + `spine.js`: Physical stability
- `left.html` + `left.js`: refresher, What “close” means
- `right.html` + `right.js`: drill-down, Lyapunov vs asymptotic

Each `.js` exports `mount(root, ctx)`; each `.html` is an `<article>` with a `.viz` slot.
