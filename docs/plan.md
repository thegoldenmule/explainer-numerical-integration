# Plan for `app/`

The build-free, single-page application that carries the explainer in `idea.md`. This
document is the working plan: directory layout, the module contracts every panel follows,
how panels are loaded lazily, and what to do next. Read `idea.md` first for *what* the
piece says; this file is *how* the page is put together.

## Ground rules

- **No build step, no dependencies.** Plain HTML, CSS, and ES modules served as-is. A static
  server is the only tool. Anything that needs `npm install` or a bundler is out.
- **Latest desktop browsers only.** Chrome, Safari, Firefox, Edge as shipped today. That
  buys us import maps, `modulepreload`, WebGL2, native MathML, CSS nesting, container
  queries, `:has()`, scroll snap, `inert`, and `structuredClone` without polyfills.
- **Shared code loads once, panel code loads on demand.** `index.html` pulls in
  `shared/` during the initial page load. Each panel and each side pane is its own module,
  fetched with dynamic `import()` the first time it is needed.
- **Light mode, and only light mode.** One stylesheet, no theme toggle, no
  `prefers-color-scheme` branch.
- **Math is typeset with native MathML.** No KaTeX or MathJax. All current desktop browsers
  render `<math>` natively.

## Directory layout

```
app/
  index.html                  shell: import map, modulepreload, stylesheet links, boot script
  package.json                {"type":"module"} so `node --test` can import shared/ (a marker, not a build)
  README.md                   how to serve, how to test, where to add a panel

  styles/
    base.css                  design tokens, reset, typography, MathML sizing
    layout.css                spine grid, rail, side-pane overlay, scroll snap
    controls.css              sliders, radios, readouts, stage (canvas stack)

  shared/                     loaded on first paint; everything a panel may import
    main.js                   boot: build the shell from the manifest, start the router
    manifest.js               the 13 panels: index, slug, title, which panes exist
    state.js                  the state tuple store (method, h, m, c, k, x0, v0, t)
    router.js                 hash routes  #/N  #/N/left  #/N/right
    loader.js                 dynamic import + prose fetch + mount/pause/resume/destroy
    dom.js                    tiny DOM helpers (el, html, clamp, fmt)
    math/
      complex.js              cmul, cdiv, cabs, cadd, cscale
      system.js               eigenvalues, damping regime, exact solution, M C K assembly
      integrators.js          euler, rk4, implicitEuler, semiImplicitEuler, verlet, simulate()
      stability.js            R(z) per method, |R(hλ)|, doubling time, spectral radius
      *.test.js               node --test; ports the numeric confirmations in idea.md
    gfx/
      region-gl.js            WebGL2 stability-region shader (from docs/poc)
      plot2d.js               canvas 2D helpers: DPR resize, axes, grid, nice ticks, polyline
      loop.js                 rAF loop with pause/resume, used by every animated pane
    ui/
      controls.js             slider / radio / readout factories bound to the store

  panels/
    01-rigid-bodies/
      spine.html              prose for the spine panel (fragment, no <html>/<body>)
      spine.js                the interactive; exports mount(root, ctx)
      left.html  left.js      refresher pane
      right.html right.js     drill-down pane (only where idea.md lists one)
    02-newtonian-physics/
    03-solving-for-x/
    04-physical-stability/
    05-linearize/
    06-eigen-what-now/
    07-finding-eigenvalues/
    08-recap-real-time/
    09-finding-error/
    10-explicit-euler/
    11-lets-break-it/
    12-higher-order-rk/
    13-variable-step-sizes/
```

Panel directories are numbered so the file tree reads in essay order. The manifest is the
source of truth for titles and which panes exist; the router never guesses from the file
system.

## How the page loads

1. `index.html` declares an inline import map:

   ```html
   <script type="importmap">
   { "imports": { "shared/": "./shared/", "panels/": "./panels/" } }
   </script>
   ```

   Panel modules import with bare prefixes (`import { store } from 'shared/state.js'`), so
   nothing depends on relative depth. Dynamic imports resolve through the same map:
   `import('panels/07-finding-eigenvalues/spine.js')`, and the loader resolves the prose
   fragment's URL with `import.meta.resolve`. One rule: modules *inside* `shared/` import
   each other with relative paths (`./math/system.js`), because Node does not read the
   import map and the math tests run under `node --test`.

2. `<link rel="modulepreload">` lists the `shared/` modules so they arrive alongside the
   HTML instead of in a waterfall.

3. `<script type="module" src="shared/main.js">` boots. `main.js` reads the manifest, stamps
   out 13 empty `<section class="panel">` elements and the rail, then hands off to the router.

4. The router reads `location.hash`. For `#/7/left` it scrolls the spine to panel 7, scrolls
   that row to its left cell, and asks the pane manager for panel 7's panes. The manager
   mounts the spine panes of 6, 7, and 8 and both side panes of 7, so a swipe in any
   direction reveals content that is already there. Nothing else is fetched.

5. Scrolling the spine fires an `IntersectionObserver`; when a new panel is most visible the
   router updates the hash (without triggering its own scroll handler) and repeats step 4.

Every pane costs two requests the first time it is mounted, one `.js` and one `.html`, and
zero afterwards. Side panes of other panels are destroyed when you move on; state lives in
the store, so remounting is free. The whole app is addressable by URL and nothing is loaded that is not on
or next to the screen.

## The pane contract

Every `spine.js`, `left.js`, and `right.js` exports the same shape:

```js
// panels/NN-slug/spine.js
export function mount(root, ctx) {
  // root: the <div class="viz"> inside this pane's fragment
  // ctx:  { store, panel, pane, loop, signal }
  //   store   the shared state store (get / set / subscribe)
  //   panel   the manifest entry for this panel
  //   pane    'spine' | 'left' | 'right'
  //   loop    a rAF loop already wired to pause when the pane is hidden
  //   signal  an AbortSignal; pass it to addEventListener and it is cleaned up for you
  const unsub = ctx.store.subscribe(draw);
  return {
    pause()   {},   // optional: off-screen; stop timers
    resume()  {},   // optional: back on-screen
    destroy() { unsub(); }  // required: undo everything mount did
  };
}
```

The prose fragment (`spine.html`) is plain HTML with one required slot:

```html
<article>
  <h2>Finding eigenvalues</h2>
  <p>… prose, with <math> inline …</p>
  <div class="viz"></div>
</article>
```

The loader fetches the fragment with `fetch(new URL('./spine.html', import.meta.url))`,
injects it into the pane container, finds `.viz`, and calls `mount`. Prose and code stay
side by side in the same directory and load together, but prose is authored as HTML rather
than inside a template literal.

## Shared state

One store, one tuple, the whole app:

```js
{ method: 'euler' | 'rk4' | 'implicit' | 'semi' | 'verlet',
  h: 1/30, m: 1, c: 0.1, k: 100, x0: 1, v0: 0, t: 0 }
```

`store.get()` returns a frozen snapshot, `store.set(patch)` merges and notifies,
`store.subscribe(fn)` returns an unsubscribe function. Subscribers receive `(state, patch)`
so a pane can skip work when the keys it cares about did not change. Panes must never keep
private copies of tuple entries; the point of the side panes is that they show *the
reviewer's* current case, and that only works if there is one source of truth.

Defaults follow the demo recommendation in `idea.md` (`m=1, c=0.1, k=100`) so explicit
Euler blows up within seconds when the reader reaches panel 11. Panel 11 also seeds the
essay's own parameters (`m=10, c=0.1, k=10`) through a preset button, not by changing
defaults.

`t` is the exception to "the store owns it". It changes every animation frame, so it lives
in the store as a value that panes *read* when they want the shared clock but is written by
`shared/gfx/loop.js`, and subscribers are not notified for `t`-only patches. Panes that
animate call `ctx.loop.onFrame(cb)`.

## Router and layout

The page is a real 2D scroll-snap grid, so a touchpad swipe in any direction is the primary
gesture and every other input (arrow keys, rail dots, deep links) lands on the same route.

- The spine is a vertical `scroll-snap-type: y mandatory` container filling the viewport.
  Each panel is a row: a `100dvh` horizontal `scroll-snap-type: x mandatory` container whose
  children are the panel's cells, `[left] [spine] [right]`, each `100%` wide. Rows without a
  side pane simply have fewer cells. Every row starts scrolled to its spine cell.
- Two rails of identical dots. The right edge shows one dot per panel; the bottom edge shows
  one dot per pane of the current panel (three slots, a missing pane is an invisible slot so
  the center dot stays centered). Filled is where you are, hollow is where you can go.
- While a side pane is showing the spine gets `overflow-y: hidden`, so vertical scrolling is
  locked until you come back to the center. `overscroll-behavior-x: contain` on rows keeps
  the browser's back/forward swipe from firing.
- Only the visible cell of the current row is interactive; the others are `inert`.
- Deep links: `#/7`, `#/7/left`, `#/7/right`. Anything else redirects to `#/1`.
- Two `IntersectionObserver`s map scroll to route: one on the spine watching rows (ignored
  while a side pane is open), one per row watching its cells. Programmatic scrolls set a
  `navigating` flag cleared on `scrollend` (or a timeout) so the observers ignore them.
  Leaving a panel whose side pane was open snaps that row back to its spine cell.
- Cell targets are computed from the cell's index times the row width, not `offsetLeft`,
  which shifts with the row's own scroll offset.

## Rendering

- **Stability region:** one WebGL2 fragment shader (`gfx/region-gl.js`), ported from
  `docs/poc/stability-poc.html`. `precision highp float` is required; the boundary is
  anti-aliased with `fwidth`. The shader shades `|R(hλ)| ≤ 1` in the `λ`-plane for Euler,
  RK4, and implicit Euler. Semi-implicit Euler and Verlet have no scalar `R`, so the region
  is greyed out for them and the spectral-radius readout takes over. There is no canvas-2D
  fallback: every current desktop browser has WebGL2, and `createRegionRenderer` returns
  `null` so a panel can show a one-line notice if it is ever missing.
- **Everything else:** canvas 2D through `gfx/plot2d.js`, which owns DPR handling and the
  axes/grid/tick code so no panel re-implements it. A stage is a positioned `div` with
  stacked canvases (`.stage > canvas`), each sized by `plot2d.fit()`.
- **Colors** are CSS custom properties read once per draw with `getComputedStyle`, so the
  canvas palette and the stylesheet cannot drift apart: `--exact` (blue), `--approx` (red),
  `--stable` (green), `--unstable` (red), `--region` (shader fill).

## Stylesheet

`base.css` defines the tokens and the type scale, including `--stage-max`, the cap that
keeps a square stage inside the viewport so a panel never scrolls internally. `layout.css` is the spine, rail, and pane
mechanics and nothing else. `controls.css` styles the small vocabulary of inputs every panel
uses (`.control`, `.readout`, `.stage`). Panels do not ship their own CSS; if a panel needs
something new, it is added to `controls.css` so the next panel gets it too.

## Testing

`node --test app/shared/math/` runs the numeric checks with no dependencies. The tests assert
the confirmations recorded in `idea.md`:

- eigenvalues of `(m, c, k) = (10, 0.1, 10)` are `−0.005 ± 0.99999i`
- `|1 + hλ|` at `h = 1/30` is `1.0004` there, and `1.0525` for `(1, 0.1, 100)`
- RK4 tracks the exact solution through 600 s
- implicit Euler at `t = 60` reads `0.26` against an exact `0.71`
- semi-implicit Euler's spectral radius crosses 1 between `h = 0.19` and `0.20` at `k/m = 100`

Browser behaviour (lazy loading, routing) is checked in Chrome through the devtools MCP:
the network panel should show exactly the pane modules for the current panel and its
neighbours, and the console should hold only the expected 404s for panels not yet built.

## Serving

```
cd app
python3 -m http.server 8765 --bind 127.0.0.1
open http://127.0.0.1:8765/
```

`file://` does not work: ES modules, import maps, and `fetch` all need an HTTP origin.

## What is scaffolded now

- `index.html`, the three stylesheets, `package.json`, `README.md`
- all of `shared/` with real implementations of the math (ported and extended from the POC),
  the region shader, the plot helpers, the store, the router, and the loader
- the manifest with all 13 panels
- `panels/01-rigid-bodies/` with a placeholder spine and left pane, so the loader path is
  exercised end to end
- the other 12 panel directories, each with a `README.md` naming its panes

## Next: the spine

Build panels in essay order, one directory at a time, each as `spine.html` + `spine.js`
first and the side panes after. Suggested order of effort: 7, 10, 11, 12 first (they share
the complex plane and the region shader and are the payload), then 3, 8, 9, 13 (trajectory
plots), then 1, 2, 4, 5, 6 (bespoke interactives). Each panel is done when its `spine.js`
mounts, subscribes, draws, and destroys cleanly, and the pane's prose is in `spine.html`.
