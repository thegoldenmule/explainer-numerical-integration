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
  carry `* var(--fit, 1)`; only stages scale, never controls or prose. A pane with a square and
  a strip uses `.stage.half` inside `.viz-row`, whose first column must stay definite.
