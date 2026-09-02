# Panel 12: Higher-order Runge-Kutta

Spine, left, right, and right-2 are built; right-3 (Verlet) is not. See `docs/idea.md`
(section "12. Higher-order Runge-Kutta") for the beat, and `docs/plan.md` for the pane
contract. Panel 12 is the one exception to "side panes are one deep": its right pane is a
three-long chain (`#/12/right`, `#/12/right/2`, `#/12/right/3`).

- `spine.html` + `spine.js`: the region for the store's method beside the live run; three
  small multiples (Euler, RK4, implicit Euler) pinned to the same λ, each a stage blitted
  from the one shared WebGL2 canvas; picker, presets, transport with speeds. The contrast:
  implicit Euler never explodes and visibly over-damps the essay spring.
- `left.html` + `left.js`: refresher, Taylor series. Partial sums of eˣ added one term at a
  time (a local slider), against the exponential, with |Sₙ(hλ)| for the current spring.
- `right.html` + `right.js`: drill-down, depth 1, Explode order. RK1–RK4 regions as Taylor
  `order` layers in one shader pass; a local slider highlights one order and its polynomial.
- `right-2.html` + `right-2.js`: drill-down, depth 2, Implicit Euler. Its region, and a bundle
  of implicit runs across six step sizes against the exact curve; a discrete slider sets the
  store's `h` to highlight one.
- `right-3.html` + `right-3.js`: drill-down, depth 3, Verlet (not built).

Each `.js` exports `mount(root, ctx)`; each `.html` is an `<article>` with a `.viz` slot.
