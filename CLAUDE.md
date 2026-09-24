# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Make incremental commits to main as you work.

## What this is

An interactive, in-browser explainer of physical and numerical stability (a damped mass-spring,
several integrators, one complex plane).

**`docs/` is the app, not the documentation.** GitHub Pages publishes this repo from
`main`'s `docs/` folder, which is the only folder name Pages accepts besides the repo root,
so the site lives there and `docs/.nojekyll` keeps Jekyll's hands off it. The writing about
the project is in `design/`.

`design/idea.md` is the concept and outline, section by
section; `design/plan.md` is the application architecture. Read `plan.md` before touching `docs/`.
`design/poc/` holds the original proof of concept and numeric scripts; the app ports them.
`design/checkpoints.md` is the plan for the "say it in your own words" checkpoints (a Claude
API grader behind a small `server/`); it is authoritative for that feature and is not built yet.

## Commands

Everything runs from `docs/`. There is no build, no bundler, no `npm install`.

```
cd docs
python3 -m http.server 8765 --bind 127.0.0.1     # serve (file:// does not work: modules + import map + fetch)
node --test "shared/**/*.test.js"                # all tests
node --test shared/math/stability.test.js        # one file
node --test --test-name-pattern "implicit" "shared/**/*.test.js"   # one test by name
```

`docs/package.json` exists only to set `"type": "module"` for Node; do not add dependencies.

Browser checks go through the chrome-devtools MCP against the running server (console, network
requests, screenshots, `evaluate_script`). If the MCP reports its browser profile is already in
use, kill the stale process: `pkill -f "user-data-dir=/Users/benjaminjordan/.cache/chrome-devtools-mcp/chrome-profile"`.
`window.app` exposes `{ store, router, manifest }` for probing from devtools.

## Architecture

**The page is a 2D scroll-snap grid driven by a hash route.** `#spine` scrolls vertically
between a title row and 13 panels (rows). Each row scrolls horizontally between its cells:
`[left] [spine] [right] [right-2] …`, each a full viewport. Routes are `#/N`, `#/N/left`,
`#/N/right`, and `#/N/right/D` for a chain of right panes (panel 12 has three); an
out-of-range depth clamps down. `#/0` is the title page (`docs/title/`, not a manifest
entry, mounted by `main.js` itself) and is where an empty or unparseable hash lands. Every input
(touchpad swipe, arrow keys, rail dots, deep link) ends as a route the router applies in
`shared/main.js`'s `onRoute`; IntersectionObservers map user scrolling back to routes, with
`navigating` flags so programmatic scrolls are ignored. While a side cell is showing, the spine
gets `overflow-y: hidden`. Cell scroll targets are computed from cell index × row width, never
`offsetLeft` (it shifts with the row's own scroll offset).

**Source of truth is `shared/manifest.js`**, not the file system: it lists each panel's slug,
title, and which side panes exist (`left` is an object or null; `right` is null or an array of
`{ title }`, one per chain step). Adding a pane means the manifest entry says it exists and the
files `panels/<slug>/<pane>.{html,js}` are present (`right`, `right-2`, `right-3` for a chain);
nothing is registered anywhere else. `design/idea.md` is authoritative for what each panel and
pane is; the manifest follows it. A pane
whose files are missing renders a "not built yet" placeholder and logs a 404, which is expected
while panels are unbuilt.

**Pane contract** (`shared/loader.js`): `<pane>.html` is an `<article>` fragment with a `.viz`
slot; `<pane>.js` exports `mount(root, ctx) → { pause?, resume?, destroy }` where `ctx = { store,
panel, pane, index, loop, signal }`. Pass `ctx.signal` to every `addEventListener` and use
`ctx.loop.onFrame` for animation; the loader pauses/aborts them when the pane leaves the screen.
`createPaneManager` keeps spine panes of current ±1 and both side panes of the current panel
mounted; farther ones are destroyed and remounted for free because all state lives in the store.

**One state tuple, one store** (`shared/state.js`): `(method, h, m, c, k, x0, v0, t)`. Panes
never keep private copies; side panes exist to show *the reader's* current case. `set()` clamps
to `LIMITS`, throws on unknown keys, notifies subscribers with `(state, patch)`; `t` is written
with `{ silent: true }` per frame. Defaults are the demo parameters `m=1, c=0.1, k=100`
(explicit Euler blows up in seconds); `PRESETS.essay` is the essays' `m=10, c=0.1, k=10`.

**Math** (`shared/math/`): `system.js` (eigenvalues, damping regime with a *relative*
tolerance for the critical case, closed-form solution), `integrators.js` (`createStepper`,
`simulate`; Verlet is seeded with the exact `x(−h)`), `stability.js` (scalar `R(hλ)` for
Euler/RK4/implicit; 2×2 `updateMatrix` + `spectralRadius` for every method, which is the only
honest verdict for semi-implicit Euler and Verlet). Tests assert the numeric confirmations
recorded in `design/idea.md`; keep them in sync if those numbers change.

**Rendering** (`shared/gfx/`): the stability region is a WebGL2 fragment shader
(`region-gl.js`, `precision highp float` is required); everything else is canvas 2D via
`plot2d.js`, which owns DPR sizing, the plot `view` mapping, grid/axes, and reads colors from
CSS custom properties so canvases match the stylesheet.

## Pane layout standard

Every pane with a `.viz` column (spine, left, right, right-N alike) is laid out this way. The
reference viewports are 1440×900 (viz column ≈ 648×720 px) and 1280×720 (≈ 488×540); a pane
meets every rule at both. Layout is checked by arithmetic from the CSS, not by opening a browser.

**Order in `.viz`, top to bottom. Nothing else, and nothing in between:**

1. **Stages.** The first stage's top edge is level with the prose's first line. Nothing sits
   above a stage.
2. **Controls**, in one block directly under the last stage, in this order: the transport
   (`transport()`: Play/Pause, Step, Reset), then the method picker, then sliders and sweeps, then
   toggles and force rows, then any other buttons.
3. **Equations.** A block equation belongs in the viz only if it is live: it has `data-var`
   numbers or scrubbable numbers. It goes last, under the controls. An equation with no live
   numbers goes in the prose. An equation whose height changes with the state (a series that
   grows as a sweep moves) reserves its tallest height, so nothing above it moves.

Why this order: the stage is the anchor and sits in the same place on every pane. The controls
sit next to what they move. Whatever can grow goes last, where it pushes nothing.

**Sizing: stages get all the height that nothing else needs.**

- Controls and equations take their natural height and never scale. The stages share the rest of
  the column. At the reference viewports, the only empty height left in a column is under a
  stage that has reached its cap.
- The stage kind is chosen by what it shows:
  - `fill` (the default): full column width. Its height is its share of the free height, capped
    at its width, so it is never taller than square. The drawing works at any aspect from 3:1 to
    1:1. For equal-axis views (planes, the physical scene), pass `halfW` and let `makeView`
    derive the vertical range. Plots pass explicit ranges and stretch.
  - `square`: only for content that has a fixed square extent (both half-ranges fixed). The
    stage is the largest square that fits its share, left-aligned.
  - `strip`: a secondary time series under a primary stage. Full width, fixed at 3:1, and it
    does not grow.
- **Several stages:** the primary stage (the one the prose is about) comes first. Strips take
  their fixed height, then the `fill` and `square` stages split what is left equally. A stage
  that draws N cells side by side arranges them (1×N, or a grid) so each cell is as large as
  possible, and square if the content has equal axes.
- **Budget:** at 1280×720, controls plus equations take at most 40% of the column height
  (≈ 216 px). A pane over budget moves content out of the viz rather than shrinking the stage. A
  static equation moves to the prose. A single parameter becomes a scrubbable number in the
  prose. A control readers rarely touch moves to a side pane.
- Stages are left-aligned, and a stage never has controls beside it. There is no `.viz-row`,
  and no `.half`, `.wide` or `.tall` sizing.
- Every canvas is a layer of a stage made with `createStage`, so a bare canvas never sits in the
  viz.

**Controls**

- Build controls with the shared helpers in `shared/ui/` (`controls`, `row`, `transport`,
  `methodPicker`, `slider`, `sweepStrip`, `toggle`). Never hand-build a copy of one.
- A button is its natural width, and buttons in a row are left-aligned. A lone button never
  stretches across the column.
- Time controls are always the shared transport, labelled Play/Pause, Step, Reset. Never Run.

**Prose** does not describe the layout. If it must point at something, "below" is the only
direction that stays true under this standard, because everything in the viz stacks.

## Rules that are not obvious from the code

- Modules inside `shared/` import each other with **relative** paths (Node runs the tests and
  does not read the import map). Panels import with the bare `shared/...` prefix.
- **Never cancel wheel events** in a pane; wheel is the page's swipe gesture.
- Panels ship no CSS. Add shared classes to `docs/styles/controls.css` instead.
- Light mode only; no theme toggle, no `prefers-color-scheme` branch.
- Math is typeset with native MathML; no KaTeX/MathJax.
- Latest desktop browsers only; no polyfills, no fallbacks for WebGL2.
- Draw through `createStage` and call `stage.invalidate()`; never call a draw function
  directly (draws are coalesced to one per frame).
- Never open a WebGL2 context per stage. Regions go through `drawRegion(ctx2d, opts)`, which
  blits from one shared context; `createRegionRenderer` is only for a dedicated canvas.
- The player owns `t` and restarts on any non-`t` patch; panes never write `t` or reset a
  run themselves.
- Panes are mounted off-screen (current ±1), so a store write in `mount()` fires while the
  reader is elsewhere; anything with side effects belongs in `resume()`. A pane must not
  leave the tuple changed as a side effect of being visited: a "what if" case (negative
  `c`, an overdamped view, a constant-force run) is computed locally, never written.
- Live numbers in prose are `<mn data-var="…" data-digits="…">` slots filled by
  `bindMath(article, store, derive)`; pass the `<article>`, not `.viz`.
- `--stage-max` is the *ceiling* for one square stage, not the budget: the loader runs
  `shared/ui/fit.js` on every pane, which measures the column and writes `--fit` on the `.viz`.
  Every stage width in `controls.css` is multiplied by it, so a pane with more chrome than the
  ceiling assumes shrinks its stages instead of running off the bottom. New stage widths must
  carry `* var(--fit, 1)`; controls and equations never scale. A pane with a square and a strip
  uses `.stage.half` inside `.viz-row`, whose first column must stay definite.
- The prose column is fitted the same way by the same module, with `--prose-fit` on the
  `.prose`: it scales the type and the measure together, so the line stays `--measure-chars`
  characters wide (read in `rem` at the root, in `em` inside a `.prose`) and only the column's
  height gives. It floors at 0.8; a pane that needs more than that clips, and the fix is to
  write less, not to scale further.
