# Plan for `app/`

How the page in `idea.md` is put together. `idea.md` is authoritative: the outline, the
panel-by-panel beats, the navigation rules, the rendering approach, the shared-code
inventory, the build order, and the numeric confirmations all live there and are not
repeated here. This file holds only the mechanics: directory layout, the load sequence, the
pane contract, the store API, the router internals, and the stylesheet split.

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
- **Math is typeset with native MathML.** No KaTeX or MathJax.

## Directory layout

```
app/
  index.html                  shell: import map, modulepreload, stylesheet links, boot script
  package.json                {"type":"module"} so `node --test` can import shared/ (a marker, not a build)
  README.md                   how to serve, how to test, where to add a panel

  styles/
    base.css                  design tokens, reset, typography, MathML sizing
    layout.css                spine grid, rails, side-pane cells, scroll snap
    controls.css              sliders, radios, readouts, stage (canvas stack)

  shared/                     loaded on first paint; everything a panel may import
    main.js                   boot: build the grid from the manifest, start the router
    manifest.js               the 13 panels: index, slug, title, which panes exist
    state.js                  the state tuple store
    router.js                 hash routes
    loader.js                 dynamic import + prose fetch + mount/pause/resume/destroy
    dom.js                    tiny DOM helpers (el, fragment, clamp, fmt)
    math/                     complex, system, integrators, stability (+ *.test.js)
    gfx/                      region shader, canvas 2D helpers, rAF loop
    ui/                       controls bound to the store

  panels/
    NN-slug/
      spine.html              prose for the spine pane (fragment, no <html>/<body>)
      spine.js                the interactive; exports mount(root, ctx)
      left.html  left.js      refresher pane, where the manifest lists one
      right.html right.js     drill-down pane, where the manifest lists one
      right-2.*  right-3.*    further right panes in a chain (panel 12)
```

Panel directories are numbered so the file tree reads in essay order. The manifest is the
source of truth for titles and which panes exist; the router and loader never guess from
the file system. The modules each panel will need, and which are still to be written, are
listed under "Shared code" in `idea.md`.

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
   out one row per panel with one cell per pane, and the two rails, then hands off to the
   router.

4. The router reads `location.hash`. For `#/7/left` it scrolls the spine to panel 7, scrolls
   that row to its left cell, and asks the pane manager for panel 7's panes. The manager
   mounts the spine panes of 6, 7, and 8 and the side panes of 7, so a swipe in any
   direction reveals content that is already there. Nothing else is fetched.

5. Scrolling fires `IntersectionObserver`s; when a new cell is most visible the router
   updates the hash (without triggering its own scroll handler) and repeats step 4.

Every pane costs two requests the first time it is mounted, one `.js` and one `.html`, and
zero afterwards. Side panes of other panels are destroyed when you move on; state lives in
the store, so remounting is free. Nothing is loaded that is not on or next to the screen.

## The pane contract

Every pane module exports the same shape:

```js
// panels/NN-slug/spine.js
export function mount(root, ctx) {
  // root: the <div class="viz"> inside this pane's fragment
  // ctx:  { store, panel, pane, index, loop, signal }
  //   store   the shared state store (get / set / subscribe)
  //   panel   the manifest entry for this panel
  //   pane    'spine' | 'left' | 'right' | 'right-2' | ...
  //   index   the panel's 1-based index
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

The loader fetches the fragment, injects it into the pane container, finds `.viz`, and
calls `mount`. A pane whose files are missing renders a "not built yet" placeholder and
logs a 404, which is expected while panels are unbuilt. Panes must never cancel wheel
events: wheel is the page's swipe gesture.

## The store

```js
{ method: 'euler' | 'rk4' | 'implicit' | 'semi' | 'verlet',
  h, m, c, k, x0, v0, t }
```

`store.get()` returns a frozen snapshot, `store.set(patch)` clamps to `LIMITS`, throws on
unknown keys, merges, and notifies; `store.subscribe(fn)` returns an unsubscribe function.
Subscribers receive `(state, patch)` so a pane can skip work when the keys it cares about
did not change. Panes never keep private copies of tuple entries. Defaults and presets
(`DEFAULTS`, `PRESETS.demo`, `PRESETS.essay`) follow the numeric notes in `idea.md`.

`t` changes every animation frame, so it is written with `{ silent: true }` and subscribers
are not notified for `t`-only patches. Panes that animate call `ctx.loop.onFrame(cb)`.

## Router and layout

The page is a real 2D scroll-snap grid, so a touchpad swipe in any direction is the primary
gesture and every other input (arrow keys, rail dots, deep links) lands on the same route,
which `main.js` applies in `onRoute`.

- The spine is a vertical `scroll-snap-type: y mandatory` container filling the viewport.
  Each panel is a row: a `100dvh` horizontal `scroll-snap-type: x mandatory` container whose
  children are the panel's cells, `[left] [spine] [right] [right-2] …`, each `100%` wide.
  Rows without a side pane simply have fewer cells. Every row starts scrolled to its spine
  cell.
- Two rails of identical dots: one per panel on the right edge, one per pane of the current
  panel on the bottom edge (a missing pane is an invisible slot so the spine dot stays
  centered).
- While a side pane is showing the spine gets `overflow-y: hidden`, so vertical scrolling is
  locked until you come back to the center. `overscroll-behavior-x: contain` on rows keeps
  the browser's back/forward swipe from firing.
- Only the visible cell of the current row is interactive; the others are `inert`.
- Routes are the deep links in `idea.md`'s navigation rules; anything else normalizes to
  `#/0`, the title row, and a side that a panel does not have drops to its spine.
- The title page is row 0, above panel 1, and is not a manifest entry. `main.js` builds its
  one cell (`.pane.pane-title`, no meta), fetches `title/title.html` into it, and mounts
  `title/title.js` (`mount(root, { signal }) → { pause, resume, destroy }`) directly, outside
  the pane manager; `onRoute` resumes it on `#/0` and pauses it everywhere else. The title
  ships its own scoped `<style>` and imports nothing from `shared/`.
- The conclusion page is its bookend: row `panelCount + 1`, below the last panel, same
  non-manifest treatment (`main.js`'s `mountBookend` builds both from one function). It
  fetches `conclusion/conclusion.html` and mounts `conclusion/conclusion.js`, which has no
  logic of its own — it re-exports title.js's `mount` so the one gif-collage engine, and the
  20 filenames it knows about, is not duplicated. Its own `<style>` is scoped under
  `.conclusion` and swaps the title's directions footer for a references list.
- Two kinds of `IntersectionObserver` map scroll to route: one on the spine watching rows
  (ignored while a side pane is open), one per row watching its cells. Programmatic scrolls
  set a `navigating` flag cleared on `scrollend` (or a timeout) so the observers ignore them.
  Leaving a panel whose side pane was open snaps that row back to its spine cell.
- Cell targets are computed from the cell's index times the row width, not `offsetLeft`,
  which shifts with the row's own scroll offset.
- A fixed `#vignette` frame under the rails reads depth: `main.js` sets its opacity from the
  current row's horizontal scroll offset on every scroll event, so it tracks the swipe. The
  spine sits at a baseline the left pane lifts and each right pane presses further down.

## Rendering conventions

- A stage is a positioned `div` with stacked canvases (`.stage > canvas`), each sized by
  `plot2d.fitCanvas()` at a capped device pixel ratio.
- `createRegionRenderer` returns `null` without WebGL2 so a panel can show a one-line
  notice; there is no canvas-2D fallback.
- Colors are CSS custom properties read once per draw through `plot2d.cssVar`, so the canvas
  palette and the stylesheet cannot drift apart: `--exact`, `--approx`, `--stable`,
  `--unstable`, `--region`, `--region-edge`, `--region-none`, plus `--grid`, `--axis`,
  `--tick` for plot furniture.

## Stylesheet

`base.css` defines the tokens and the type scale, including `--stage-max`, the cap that
keeps a square stage inside the viewport so a panel never scrolls internally. `layout.css`
is the spine, rails, and pane mechanics and nothing else. `controls.css` styles the small
vocabulary of inputs every panel uses (`.control`, `.readout`, `.stage`). Panels do not
ship their own CSS; if a panel needs something new, it is added to `controls.css` so the
next panel gets it too.

## Testing

```
cd app
node --test "shared/**/*.test.js"
```

No dependencies. The tests assert the numbers recorded under "Numeric confirmations" in
`idea.md`; keep the two in sync when either changes.

Browser behaviour (lazy loading, routing) is checked in Chrome through the devtools MCP:
the network panel should show exactly the pane modules for the current panel and its
neighbours, and the console should hold only the expected 404s for panels not yet built.
`window.app` exposes `{ store, router, manifest }` for probing.

## Serving

```
cd app
python3 -m http.server 8765 --bind 127.0.0.1
open http://127.0.0.1:8765/
```

`file://` does not work: ES modules, import maps, and `fetch` all need an HTTP origin.

## Status

Scaffolded: `index.html`, the three stylesheets, `package.json`, `README.md`, all of
`shared/` as inventoried in `idea.md`, the manifest with all 13 panels, panel 1 with
placeholder panes so the loader path is exercised end to end, and a `README.md` in each
other panel directory naming its panes. Build order and the shared code each panel pulls
in are under "Shared code" in `idea.md`. A panel is done when its `spine.js` mounts,
subscribes, draws, and destroys cleanly, and the pane's prose is in `spine.html`.
