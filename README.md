# Why physics engines blow up

An interactive, in-browser explainer of physical and numerical stability.

The site is `docs/`; the notes behind it (`idea.md`, `plan.md`, the proof of concept, the
source essays) are in `design/`. GitHub Pages publishes `main`'s `docs/` folder as-is —
`docs/.nojekyll` turns Jekyll off, and every path in the page is relative, so it works from
a project subpath.

## Quickstart

```
cd docs
python3 -m http.server 8765 --bind 127.0.0.1   # any static server; file:// will not work
open http://127.0.0.1:8765/
```
