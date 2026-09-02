# Panel 8: Recap: real time

Built. See `docs/idea.md` (section "8. Recap: real time") for the beat, and `docs/plan.md` for the
pane contract. Panes in this directory:

- `spine.html` + `spine.js`: Recap: real time
- `left.html` + `left.js`: refresher, Frame budget, ms per frame
- `right.html` + `right.js`: drill-down, Explode h: all step sizes at once
- `cost.js`: local helpers shared by the three panes (a warmed per-step benchmark, the
  frame-budget bar); the player's own timer is quantized to 0.1 ms on this page

Each `.js` exports `mount(root, ctx)`; each `.html` is an `<article>` with a `.viz` slot.
