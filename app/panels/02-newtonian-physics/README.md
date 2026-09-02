# Panel 2: Newtonian physics: F = ma

Not built yet. See `docs/idea.md` (section "2. Newtonian physics: F = ma") for the beat, and `docs/plan.md`
for the pane contract. Panes this directory will hold:

- `spine.html` + `spine.js`: Newtonian physics: F = ma
- `left.html` + `left.js`: refresher, Vectors
- `right.html` + `right.js`: drill-down, Torque and moment of inertia

Each `.js` exports `mount(root, ctx)`; each `.html` is an `<article>` with a `.viz` slot.
