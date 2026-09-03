# Panel 13: Variable step sizes

Built. See `design/idea.md` (section "13. Variable step sizes") for the beat, and `design/plan.md` for the
pane contract. Panes in this directory:

- `spine.html` + `spine.js`: Variable step sizes. One `wide` stage, the run on top and `h(t)`
  underneath; no presets — `m`, `c`, `k` are draggable in the prose's own equation instead
  (one facade, `scrub`, over aux's `tol` and the tuple's `m`/`c`/`k`, since bindScrub binds
  every `[data-scrub]` node under the article it is given regardless of which store owns the
  key, so two calls over the same article would double-bind). No readout: the
  target/step-count/rejected tally, the h-peak-vs-cap verdict, and the max error are all
  `drawText` in the `h(t)` subplot's own top-right corner.
- `left.html` + `left.js`: refresher, Local vs global error. No readout: the local and global
  error lines are `drawText` top-right on the plot, colored to match the point each one
  measures, instead of a swatch icon beside text in a box.
- `right.html` + `right.js`: drill-down, Adaptive step controllers. One `wide` stage split
  into the error-estimate-vs-target subplot on top and the `h(t)` bundle underneath. No
  readout: the controller's last-decision arithmetic (the full growth formula, unabridged) is
  `drawText` over the top subplot where that decision is made; the accept/reject/`h`-peak/
  error tally is `drawText` over the bottom subplot it summarizes. Nothing dropped — this pane
  carries the whole step-controller story.

Each `.js` exports `mount(root, ctx)`; each `.html` is an `<article>` with a `.viz` slot.
