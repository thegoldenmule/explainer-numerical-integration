# Panel 8: Recap: real time

Built. See `docs/idea.md` (section "8. Recap: real time") for the beat, and `docs/plan.md` for the
pane contract. Panes in this directory:

- `spine.html` + `spine.js`: Recap: real time
- `left.html` + `left.js`: refresher, Frame budget, ms per frame
- `right.html` + `right.js`: drill-down, Explode h: all step sizes at once
- `cost.js`: local helpers shared by the three panes (the frame budget, steps per frame, the
  budget bar); the per-step cost is `shared/player.js`'s calibrated benchmark

Each `.js` exports `mount(root, ctx)`; each `.html` is an `<article>` with a `.viz` slot.
