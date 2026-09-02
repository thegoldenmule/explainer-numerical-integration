# app/

The no-build explainer. Plain HTML, CSS, and ES modules; nothing to install.

## Run

```
python3 -m http.server 8765 --bind 127.0.0.1     # from this directory
open http://127.0.0.1:8765/
```

`file://` does not work: modules, import maps, and `fetch` all need an HTTP origin.

## Test

```
node --test "shared/**/*.test.js"
```

## Where things are

- `index.html` declares the import map (`shared/`, `panels/`) and preloads `shared/`.
- `shared/` is loaded on first paint. Math in `shared/math/`, canvases and the region shader
  in `shared/gfx/`, store-bound controls in `shared/ui/`. Modules inside `shared/` import
  each other with relative paths so Node can run the tests; panels use the bare
  `shared/...` prefix.
- `panels/NN-slug/` holds one directory per spine panel. Each pane is `<pane>.html` (prose,
  an `<article>` with a `.viz` slot) plus `<pane>.js` (exports `mount(root, ctx)`). Panes are
  loaded on demand by `shared/loader.js`.
- `shared/manifest.js` lists the 13 panels and which side panes each one has.

## Add a pane

1. Create `panels/NN-slug/<pane>.html` and `<pane>.js` (copy `panels/01-rigid-bodies/`).
2. Make sure the manifest entry lists the pane (`left` / `right` non-null).
3. Reload. Nothing to register; the loader resolves the path from the manifest slug.

The full plan is in `docs/plan.md`.
