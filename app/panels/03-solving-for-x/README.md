# Panel 3: Solving for x

Built. See `docs/idea.md` (section "3. Solving for x") for the beat, and `docs/plan.md` for the
pane contract. Panes in this directory:

- `spine.html` + `spine.js`: Solving for x
- `left.html` + `left.js`: refresher, x, v, a: derivatives
- `right.html` + `right.js`: drill-down, ODEs vs PDEs; intractability

Each `.js` exports `mount(root, ctx)`; each `.html` is an `<article>` with a `.viz` slot.
