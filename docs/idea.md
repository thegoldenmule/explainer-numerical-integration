# Numerical integration explainer — the idea

An interactive, in-browser explainer for why physics engines blow up. It turns the two *Physics Engines Explained* essays (in `reference/`) into something you can drag, and the visualization/abstraction approach is structured on Bret Victor's *Up and Down the Ladder of Abstraction* (https://worrydream.com/LadderOfAbstraction/).

A damped mass-spring, three integrators, one complex plane: drag the system's eigenvalue
across the stability boundary and watch the spring go from decaying to ringing to exploding,
with the closed-form solution underneath the whole time.

## What the essays already contain

- Part I: rigid bodies, linearized force models (gravity, drag, spring), the sum
  `M x'' + C x' + K x = 0`, and Linear Stability Theory: the system is stable iff every
  eigenvalue of the characteristic equation has a negative real part.
- Part II: apply an integrator to the modal equation `x' = λx`, get an amplification factor
  `R(hλ)`, and the method is numerically stable iff `|R(hλ)| ≤ 1`. Mathematica `RegionPlot`
  snippets draw that region for explicit Euler (`|1 + hλ| ≤ 1`), RK4
  (`|Σ (hλ)^n / n!, n ≤ 4| ≤ 1`), and implicit Euler (`|1 − hλ| ≥ 1`). A mass-spring-drag
  example (m=10, c=0.1, k=10) whose eigenvalues fall outside the Euler disk, and the
  variable-step-size / local truncation error idea (the "16-second step" college anecdote).

The essays have the ground level (the blue exact curve vs. the red segmented approximation)
and the top rung (the stability region). Everything in between, and the transitions, is what
the tool adds.

## Outline

The explainer follows the two essays section by section, in their order. Each step names
the concept from the essay, then the interactive beat that carries it. Part I sections are
1–7, Part II sections are 8–13.

### Part I: how physics engines work, and how they break

1. **Rigid bodies.** A body with mass and dimensions that do not change; particle systems,
   fluids, and soft bodies are the other kinds. Everything that follows is built on this
   definition. The tool simplifies further to a point mass: all the mass at one point, no
   rotation, so the whole piece can stay in `(x, v)`. *Beat:* one point mass on screen.
   Position `x`. Nothing moves yet. The full rigid body, with rotation `θ`, is the drill-down.
2. **Newtonian physics: `F = ma`.** Newton's second law; forces are summed into a
   translational total and a rotational total (torque, moment of inertia `I`). Force models:
   a constant wind vector, Newton's gravitation `G m₁ m₂ / r²`. *Beat:* drag force arrows
   onto the point mass and watch the sum vector update. Toggle each force on and off.
3. **Solving for `x`.** The force sum is an ordinary differential equation, generally
   analytically intractable, so it is approximated iteratively at time steps `dt`. The blue
   exact curve vs. the red segmented approximation; smaller `dt` is closer but costs more.
   *Beat:* scrub `dt` and watch the red polyline hug or leave the blue curve. This is the
   ground level of the ladder and the core tension of the whole piece: least computation,
   still close enough.
4. **Physical stability.** A solution is physically stable if it starts close to the real
   solution and stays close forever (Eberly). This is a property of the *system*, before any
   integrator is chosen. *Beat:* perturb the initial state and watch whether neighboring
   trajectories converge or diverge.
5. **Stability analysis: linearize.** Linear Stability Theory needs linear equations, so
   engines drop `1/r²` gravity for `m g`, use drag proportional to velocity, springs
   proportional to displacement, and Taylor-expand anything else. Any combination collapses
   to `M x'' + C x' + K x = 0`. *Beat:* switch a force between its real and linearized model;
   show the `M`, `C`, `K` coefficients assembling from the sliders.
6. **Eigen-what-now.** An eigenvector is a direction a matrix only scales; the eigenvalue is
   how much. Isolating the scaling character of the force equation. *Beat:* a small 2D
   transform demo with a draggable vector that shows the invariant directions.
7. **Finding eigenvalues.** Solve the characteristic polynomial `p(λ) = 0`, which is the
   quadratic formula. Stable iff every eigenvalue has a negative real part. *Beat:* the two
   roots appear as points in the complex plane and move live with `m`, `c`, `k`. This is the
   first time the complex plane appears; it stays on screen for the rest of the piece.

### Part II: numerical methods, and where they stop working

8. **Recap: real time.** Games have 1/60 s per frame, so an engine wants the largest step
   that does not accumulate too much error. Trial and error cannot test a sandbox; you need
   something provable. *Beat:* a frame-budget bar next to the simulation; raise `h` and watch
   the compute cost fall and the error rise.
9. **Finding error.** The ratio of future to present error, `z`. The modal equation
   `x' = λx` isolates one mode. Apply a method to the modal equation and require `|z| ≤ 1`.
   *Beat:* the measured step-to-step error ratio and the doubling time derived from it;
   the formula `R(hλ)` waits for step 10.
10. **Runge-Kutta family: explicit Euler.** `x_{i+1} = x_i + h f(t, x_i)`. Applied to the
    modal equation, the characteristic polynomial has the single root `z = 1 + hλ`, so
    Euler is stable iff `|1 + hλ| ≤ 1`: a disk in the complex plane. Rhodes' reading:
    imaginary axis is oscillation, real axis is growth or decay, so Euler needs aggressive
    damping and is unstable under oscillation. *Beat:* the first shaded region, with the
    eigenvalues from step 7 sitting on it. This is where the Mathematica `RegionPlot` becomes
    the fragment shader.
11. **Let's break it.** Two forces, drag and a spring, with `m=10, c=0.1, k=10`: eigenvalues
    `−0.005 ± i`, outside the disk. The solver strays. Decreasing `h` to 1/60 scales the
    region and helps for a while but never handles oscillation. *Beat:* the spring runs
    against the exact solution and grows without bound; drag `h` and watch the region
    rescale around the fixed eigenvalues. (Use `m=1, c=0.1, k=100` as the demo default so
    the blow-up is visible in seconds; see the numeric notes below.)
12. **Higher-order Runge-Kutta.** RK4 is the first five terms of the same Taylor series;
    `z = q(hλ)` with `q` the degree-4 polynomial, stable iff `|q(hλ)| ≤ 1`. The region is
    larger and handles oscillation. Implicit Euler, `|1 − hλ| ≥ 1`, is stable almost
    everywhere but hard to implement. *Beat:* switch integrator and the region redraws;
    small multiples of Euler, RK4, implicit Euler pinned to one `λ`. The teaching contrast:
    implicit Euler never explodes but artificially damps the spring.
13. **Variable step sizes.** Euler and RK4 are truncations of one Taylor series, so the next
    term is a local truncation error estimate, computable in real time. Set a target error
    and grow `h` until you hit it, or add terms. The college paper: RK4 at a 0.01 error bound
    tried a 16-second step. *Beat:* a target-error slider with `h(t)` plotted as its own
    trajectory. On the spring the controller tops out near 2 s (see the numeric notes); the
    16-second step needs a system whose higher derivatives vanish, and the panel shows why.

## Flow diagram

The page is a grid of full-viewport panels. The **spine** runs vertically: each of the 13
outline steps is one panel, and scrolling down advances to the next concept. Each panel holds
its interactive visualization and its explainer text. From any panel you can move sideways,
never more than one pane (panel 12 is the one exception; see Navigation rules):

- **Left = refresher.** A prerequisite you may have forgotten. Lighter, faster, assumes less.
- **Right = drill-down.** A deeper concept the panel gestures at but does not need. Assumes
  more. Not every panel has one.

Side panes are dead ends: the only way onward is back to the spine and down. This keeps the
spine the single narrative and makes the side panes optional by construction.

### Side panes are ladder moves

Bret Victor's ladder of abstraction gives the sideways axis its meaning. Every visualization
in the piece is a view of one state tuple:

```
(method, h, m, c, k, x₀, v₀, t)
```

A fully concrete view fixes every entry: one integrator, one step, one system, one instant.
Each entry replaced by a wildcard `*` is one rung up: `t = *` shows a whole trajectory,
`h = *` shows a bundle across step sizes, `(m, c, k) = *` shows the entire complex plane at
once. Victor's three ingredients map cleanly: the **independent variable** is `t`, the
**structure** is `(method, h)`, the **data** is `(m, c, k, x₀, v₀)`.

- **Left = step down.** Remove a wildcard or drop a dimension. Fewer moving parts, one
  concrete case, numbers you can check by hand. That is what a refresher is.
- **Right = step up.** Add a wildcard or add a dimension. Sweep a parameter, add rotation,
  add space, add nonlinearity. That is what a drill-down is. The usual form is to
  **explode** one parameter: every value in a small range drawn at once, with a drag or
  hover on the range highlighting one value's result and dimming the rest. Each panel entry
  below says which parameter it explodes.
- **The spine** sits at the rung the essay is on, and it climbs as it goes: panel 1 is fully
  concrete, panel 10 has two wildcards, panel 13 has `h` as a function of `t`.

Every pane shares the panel's live state, so stepping down shows *the reviewer's* current
case and stepping up sweeps around it. Victor: "the deepest insights are born … in the
transitions between [levels]." The sideways gesture *is* the transition.

Victor's caution applies throughout: bundles of overlapping trajectories get pretty and
unreadable fast. Keep sweeps small and let linked highlighting carry the comparison.

```
        LEFT (refresher)          SPINE                          RIGHT (drill-down)

                               1  Point masses  ----------> [rigid bodies: extent & rotation]
                               |
   [vectors] <------------- 2  F = ma  ------------------> [torque & moment of inertia]
                               |
   [x, v, a: derivatives] <--- 3  Solving for x  ---------> [ODEs vs PDEs; intractability]
                               |
   [what "close" means] <----- 4  Physical stability  ----> [Lyapunov vs asymptotic]
                               |
   [what "linear" means] <---- 5  Linearize  -------------> [Taylor expansion; 1/r² gravity]
                               |
   [matrices as transforms] <- 6  Eigen-what-now  --------> [explode the eigenvector over a sweep]
                               |
   [quadratic & complex nums]<- 7  Finding eigenvalues  ---> [under / critical / overdamped]
                               |
   [frame budget, ms/frame] <- 8  Recap: real time  -------> [explode h: all step sizes at once]
                               |
   [geometric growth] <------- 9  Finding error  ---------> [the modal equation (required)]
                               |
   [Euler → the disk] <------ 10  Explicit Euler  --------> [explode h: nested disks]
                               |
   [exact solution, no method]<- 11  Let's break it  ------> [explode the plane: a grid of λ]
                               |
   [Taylor series] <--------- 12  Higher-order RK  -------> [explode order] -> [implicit Euler] -> [Verlet]
                               |
   [local vs global error] <- 13  Variable step sizes  ---> [adaptive step controllers]
```

### Panel by panel

Each entry gives the spine visualization with its rung (which entries of the tuple are
wildcards), then the left pane as a step down and the right pane as a step up.

**1. Point masses.** Fully concrete, no wildcards.
- *Spine viz:* one point mass on a plane with `(x, y)` readouts and a mass `m`. Drag it.
  Nothing else moves. The definition is the whole panel: all the mass at one point, no
  extent, no rotation. This is the object the rest of the piece integrates.
- *Left:* none.
- *Right, step up (add extent, add `θ`):* the rigid body. The point grows into a shape;
  mass and center of mass, then degrees of freedom appear one at a time until the body has
  `(x, y, θ)` and can be rotated. The essay starts here; the tool drops `θ` to keep the
  state at `(x, v)`.

**2. Newtonian physics, `F = ma`.** Concrete; `t` stepped by hand.
- *Spine viz:* force arrows on the point mass (wind, gravity, drag), the summed vector, the
  resulting `a`. Toggle each force; drag an arrow's head to scale it; tap to step time once.
- *Left, step down (drop the mass):* vectors alone. Two arrows and their sum. Drag the tip
  of either arrow and the sum, its components, and its magnitude update live; drag one arrow
  around the other to see the parallelogram close. The arrows are the same ones the reviewer
  just dragged on the spine, minus the mass.
- *Right, step up (add `θ`):* the rotational half. A point mass has no `θ`, so this pane
  needs the rigid body from panel 1's drill-down. Torque, moment of inertia `I` as the
  rotational mass, the second sum feeding `θ''`. Same forces, one more dimension.

**3. Solving for `x`.** First wildcard: `t = *`.
- *Spine viz:* the blue exact curve and the red segmented approximation, whole trajectory
  shown. Scrub `dt` and the red polyline hugs or leaves the blue. Touch the curve to step
  back down to one instant. This is the ground level of the ladder and the core tension of
  the piece.
- *Left, step down (`t` concrete):* one instant. `x`, `v`, `a` at a single point with `v` as
  the slope of `x` and `a` as the slope of `v`; nudge `t` and watch the tangent tilt.
- *Right, step up (add space):* an ODE has one independent variable. Add a second and you
  have a PDE: a string or heat bar next to the point mass. Why that is a different problem,
  and why even the ODE is generally intractable (Bonini's paradox).

**4. Physical stability.** `x₀, v₀` perturbed: a small bundle around one solution.
- *Spine viz:* the exact solution with an ε-tube around it and a handful of neighbors
  started nearby. Drag the perturbation size; the neighbors converge into the tube or leave
  it. This is a property of the system, before any integrator exists.
- *Left, step down (one neighbor):* exactly two curves, the exact and one perturbed, with
  their distance plotted as a single number over time. "Starts close and stays close" as one
  line that either flattens or climbs.
- *Right, step up (`(x₀, v₀) = *`):* the whole initial-condition plane as a phase portrait
  with a flow field. Stable, asymptotically stable, and unstable as three portraits side by
  side (Lyapunov's three flavors).

**5. Stability analysis: linearize.** Concrete system; the force *models* vary.
- *Spine viz:* each force is shown as its equation with default values, and every parameter
  in it is a draggable number. Gravitation reads `G m₁ m₂ / r²`; drag `G`, `m₁`, `m₂`, or
  `r` and the force arrow, the resulting `a`, and the trajectory update in real time. Drag
  and spring get the same treatment with `c` and `k`. Each force also has a switch between
  its real model and its linear one (`G m₁m₂/r²` vs `m g`, and so on), so the reviewer can
  see which of the dragged parameters survive the linearization and where. Below, the
  coefficients `M`, `C`, `K` assemble live into `M x'' + C x' + K x = 0` and move with the
  same drags.
- *Left, step down (one function):* what linear means. One function, two inputs, the sum of
  outputs equals the output of the sum. Then a squared term, and the same check fails.
- *Right, step up (add nonlinearity, add terms):* Taylor expansion of `1/r²` around an
  operating point with a slider for how many terms to keep. Then the payoff beat: run the
  nonlinear simulation next to the *linearized* stability prediction and find the cases
  where the prediction says stable and the simulation explodes. Victor's "details that have
  fallen through the cracks of an abstraction," live.

**6. Eigen-what-now.** Concrete matrix from the current `(m, c, k)`.
- *Spine viz:* the 2×2 system matrix acting on a grid. Drag a vector; it skews and rotates.
  The invariant directions light up when the dragged vector lands on one; the scale factor
  along each is the eigenvalue.
- *Left, step down (one matrix, no invariant):* transformations only. A shape on a plane and
  the matrix that moves it; drag the matrix entries and the shape scales, skews, and rotates.
  No eigenvectors, no invariant directions. Matrices as transformations, nothing more.
- *Right, step up (transformation `= *`):* explode the eigenvector. Sweep the matrix across a
  range of one transformation, scale or rotation, and draw the eigenvector for every value
  in the range at once. Mousing over a value in the range highlights its eigenvector and
  dims the rest. Along a rotation sweep the real eigenvectors converge and then vanish,
  which is where the eigenvalues go complex: the bridge to the complex plane.

**7. Finding eigenvalues.** Concrete `(m, c, k)`; output is the pair `λ`.
- *Spine viz:* the quadratic formula assembled from the sliders, and the two roots drawn as
  points in the complex plane. Drag `m`, `c`, `k` and the points move live. The complex plane
  appears here for the first time and stays for the rest of the piece.
- *Left, step down (real line, one number):* the quadratic formula on the real line with the
  discriminant highlighted; then one complex number as a point, its real part, imaginary
  part, and modulus.
- *Right, step up (`(m, c, k) = *` along a path):* sweep the discriminant through zero. The
  roots collide on the real axis and split into the plane; beside them the closed-form
  solution switches between overdamped, critically damped, and underdamped.

**8. Recap: real time.** Concrete; `h` adjustable.
- *Spine viz:* the simulation running with a frame-budget bar beside it. Raise `h` and the
  compute cost per frame falls while the error against the exact curve rises. The tension
  from panel 3, now with a clock on it.
- *Left, step down (one frame):* a single 16.7 ms frame as a timeline with the physics step
  inside it. What a millisecond is.
- *Right, step up (`h = *`):* explode `h`. The same simulation runs across a spread of step
  sizes at once, one trajectory per `h`, all against the exact curve. A draggable `h`
  marker highlights the trajectory it lands on and dims the rest, with that run's compute
  cost and error called out. The spine's single `h` becomes one line in the bundle. Keep the
  spread small, per Victor's caution, and let the highlight carry the comparison.

**9. Finding error.** `t = *` on error, not position.
- *Spine viz:* the error between simulation and exact solution plotted over time next to the
  simulation. The readout is *measured*: the ratio of the error at step `i+1` to the error
  at step `i`, and the doubling time `h·ln2 / ln(ratio)` derived from it. No integrator has
  been introduced yet, so there is no formula for the ratio here; panel 10 derives it as
  `R(hλ)`. The number becomes a story.
- *Left, step down (one step):* error in, error out, the ratio as a single number. Then a
  geometric sequence: a ratio above 1 compounds, below 1 decays.
- *Right, step up (decouple the system):* the modal equation. The 2D system split into
  independent modes, each with its own `λ` and its own `R`. Abstracting over the system to
  a single scalar problem `x' = λx`. This pane is **required**, not optional: panel 10's
  spine is built on it, so the spine text should point at it. Caveat: a single damped spring
  has one conjugate pair, so both modes share `|R|` and the decoupling is not very visible on
  this system.

**10. Runge-Kutta family: explicit Euler.** Two wildcards: `(m, c, k) = *` as the whole plane.
- *Spine viz:* the first shaded region, `|1 + hλ| ≤ 1`, filling the complex plane, with the
  eigenvalues from panel 7 sitting on it in green or red. Rhodes' reading in the margins:
  imaginary axis is oscillation, real axis is growth or decay. This is where Mathematica's
  `RegionPlot` becomes a fragment shader evaluating every `λ` at once.
- *Left, step down (one `λ`, one step):* Euler's method as follow-the-tangent, land, repeat,
  drawn one step at a time; then `|1 + hλ|` computed by hand for the current eigenvalue.
  From there the derivation: apply Euler to the modal equation, form the characteristic
  polynomial `p(z)`, find the root `z = 1 + hλ`, and see why `|z| ≤ 1` is a disk of radius
  `1/h` centered at `−1/h`. The hand computation is one point of that disk.
- *Right, step up (explode `h`):* nested disks. The Euler region drawn for a small range of
  step sizes at once, radius `1/h` each, all on one plane with the eigenvalues fixed. Drag
  `h` along the range to highlight one disk and dim the rest. Same gesture as panel 8's
  right, now on the region instead of the trajectory; panel 11's single-`h` drag is one
  slice of this.

**11. Let's break it.** Plane plus live simulation; `h` draggable.
- *Spine viz:* the spring runs against the exact solution with its eigenvalues on the region.
  Drag `λ` directly across the boundary and the spring goes from decaying to ringing to
  exploding. Dragging `λ` inverts to the data: for the current `m`, `c = −2m·Re λ` and
  `k = m|λ|²`, so the rest of the piece still drives from `(m, c, k)`. Drag `h` and the
  region rescales around the fixed eigenvalues. Demo default `m=1, c=0.1, k=100` so the
  blow-up is visible in seconds.
- *Left, step down (drop the method):* the exact solution only, no integrator. Pick a `λ`
  and see the closed-form curve: pure decay on the negative real axis, pure oscillation on
  the imaginary axis, a spiral in between. Reading the plane by example, before any method
  can get it wrong.
- *Right, step up (explode the plane):* a small grid of `λ` points inside, on, and outside
  the boundary, each with a mini trajectory of the simulation against the exact curve.
  Hover a point to highlight its trajectory and dim the rest. The left pane is one of these
  with no method; the spine is one of these with the current system; this is all of them.

**12. Higher-order Runge-Kutta.** `method = *`.
- *Spine viz:* switch integrator and the region redraws; small multiples of Euler, RK4, and
  implicit Euler pinned to the same `λ`, which falls inside one and outside another. The
  teaching contrast: implicit Euler never explodes, but its spring is visibly over-damped
  against the exact curve. The spine only shows that; the second and third right panes
  explain it.
- *Left, step down (one term at a time):* Taylor series. Add terms to the expansion one by
  one and watch the approximation of `e^{hλ}` improve; Euler is the first two, RK4 the first
  five.
- *Right, step up (explode order):* the same truncation across the whole plane. The regions
  for RK1 through RK4 overlaid on one plane, each the set where the degree-`n` Taylor
  polynomial of `e^{hλ}` has modulus at most 1. Hover an order to highlight its region and
  its polynomial and dim the rest. The left is one `λ` term by term; this is every `λ`
  order by order.
- *Right 2, step up (implicit Euler):* the same one step, but solved for the *next* state:
  `x_{i+1} = x_i + h f(t, x_{i+1})`. Why that is hard in general, a solve per step, and the
  2×2 closed form that makes it cheap for the linear system (see Integrators below). Apply
  it to the modal equation and the root is `z = 1 / (1 − hλ)`, so the region is
  `|1 − hλ| ≥ 1`: the outside of a disk, stable almost everywhere. Explode `h` on the
  implicit spring, a small bundle of runs against the exact curve; drag `h` to highlight
  one and watch the over-damping grow with the step. Never explodes, always lies.
- *Right 3, step up (Verlet):* a different structure. Störmer–Verlet updates position from
  the two previous positions, `x_{i+1} = 2x_i − x_{i−1} + h² a_i`, and with a
  velocity-dependent force like drag the velocity it needs is the one it has not computed
  yet, so it is solved implicitly or lagged (see Integrators). It is symplectic: it preserves
  amplitude and drifts phase instead of decaying or exploding. There is no scalar `R(hλ)`,
  so no region on the `λ`-plane; the honest picture is a heatmap of the spectral radius of
  its 2×2 update over `(hω, ζ)`, with the `hω < 2` wall as a hard edge. Hover a cell to
  see its trajectory against the exact curve. The three right panes together are the three
  ways out of the Euler disk: more terms, solve backward, or change the structure.

**13. Variable step sizes.** `h` becomes a function of `t`.
- *Spine viz:* a target-error slider with `h(t)` plotted as its own trajectory under the
  simulation. Set the bound to 0.01 with RK4 and watch the controller push `h` to about 2 s
  on this spring. A "constant force only" switch (`k = c = 0`) shows the college paper's
  mechanism: with no higher derivatives the next Taylor term is zero, the estimator reads no
  error, and `h` runs to its cap, the 16-second step.
- *Left, step down (one step's error):* local truncation error on a single step, the next
  Taylor term, versus the global error accumulated over many steps.
- *Right, step up (explode target error):* the adaptive control loop in detail, then a sweep
  of target errors producing a small bundle of `h(t)` profiles. Drag the target error along
  the range to highlight one profile and dim the rest. Where the cost-versus-accuracy
  tradeoff from panels 3 and 8 finally becomes a dial.

### Navigation rules

- Vertical scroll snaps panel to panel. The spine index is always visible as a thin rail.
- A left or right pane slides in over the spine and shares the panel's live state, so a
  refresher on vectors uses the same force arrows the reviewer just dragged.
- Leaving a side pane returns to the exact spine panel it came from; the spine never scrolls
  while a side pane is open.
- Side panes are one deep, with one exception: panel 12 has three right panes in a row
  (explode order, implicit Euler, Verlet), each reached by another rightward move, and
  leaving any of them returns to panel 12.
- Deep links: `#/7`, `#/7/left`, `#/7/right`, and `#/12/right/2`, `#/12/right/3` for the
  chain. The whole grid is addressable.

## Rendering research: how to run the Mathematica math in a browser

We do not need Mathematica. Everything `RegionPlot` did reduces to one function `R(z)`
evaluated per pixel, which is exactly what a fragment shader is for.

**Recommendation: zero dependencies, no build step.**

- A WebGL2 fragment shader shades `|R(hλ)| ≤ 1` in the `λ`-plane and draws an anti-aliased
  boundary via `fwidth` (two `smoothstep`s on `abs(R) − 1`). `precision highp float` is
  required; mediump breaks at large `|hλ|`.
- A transparent 2D canvas on top draws axes, grid, labels, and the eigenvalue points.
- A second 2D canvas plots the simulation polylines with the closed-form solution dashed
  underneath.

### Tradeoffs (measured; 800×800, slider dragging)

| Approach | Cost per frame | Weight | Verdict |
|---|---|---|---|
| WebGL2 fragment shader | sub-millisecond, indifferent to device pixel ratio | 0 KB | **Recommended** |
| Canvas 2D pixel loop | 1.3–2.6 ms compute + `putImageData`; 8–14 ms at DPR 2 | 0 KB | Fallback behind a WebGL2 check |
| d3-contour (marching squares) | 0.3–1 ms grid + 1–3 ms contour; polygonal edges | ~23 KB | Only if you want exportable vector geometry |
| Plotly contour | 20–60 ms per slider event | 1–4.5 MB | Too heavy, too slow |
| Observable Plot | same grid-recompute problem, SVG output | 209 KB + d3 | Static figures only |
| function-plot / JSXGraph / Desmos API | 1-D only / slow implicit curves / hosted key | 203 KB / 916 KB / hosted | Not a fit |
| mathbox | GPU, would work | 1.2 MB + three.js | Overkill; hides the math |
| Wolfram Cloud embed / Player | evaluates on wolframcloud.com; free tier expires in 60 days, ~500 compute-s/month; plugin dead; no WASM | hosted | **Not viable** for a static page |

Node benchmark of the per-pixel math (`poc/bench.mjs`): Euler 1.6 ms, RK4 (Horner) 2.6 ms,
implicit Euler 1.3 ms per 800×800 frame on CPU. The shader makes this moot.

### Complex arithmetic and the exact solution

Hand-roll it; about 15 lines. math.js (660 KB) and complex.js (9 KB) do not earn their place
for four operations. Eigenvalues by the quadratic formula with a branch on the discriminant;
`R(z)` via a couple of `cmul` helpers.

Closed form for `m x'' + c x' + k x = 0`, with `α = −c / 2m`:

- Underdamped (`c² < 4mk`): `ω = √(4mk − c²) / 2m`,
  `x = e^{αt} (x₀ cos ωt + (v₀ − αx₀)/ω · sin ωt)`
- Critically damped (use a *relative* tolerance; sliders never hit equality):
  `x = e^{αt} (x₀ + (v₀ − αx₀) t)`
- Overdamped: `r₁,₂ = (−c ± √(c² − 4mk)) / 2m`, `x = A e^{r₁t} + B e^{r₂t}`,
  `A = (v₀ − r₂x₀)/(r₁ − r₂)`, `B = x₀ − A`

### Integrators

- Explicit Euler, RK4: straightforward.
- Implicit Euler on the linear system has a closed-form update. Solve `(I − hA) y = s` with
  `A = [[0, 1], [−k/m, −c/m]]`: `det = (1 + hc/m) + h²k/m`,
  `x' = ((1 + hc/m) x + h v) / det`, `v' = (−hk/m · x + v) / det`.
- Verlet: velocity Verlet with drag is not explicit (acceleration depends on `v_{n+1}`), so
  use the Störmer position form with `v_n ≈ (x_n − x_{n−1}) / h` in the drag term, seeded
  with the exact `x_{−1}`.

**Design caveat:** semi-implicit Euler and Verlet have no scalar `R(hλ)`, so there is no
`λ`-plane region to shade for them. The honest indicator is the spectral radius of the 2×2
update matrix (`poc/specrad.mjs`). At `k/m = 100`, semi-implicit is stable at `h = 0.19`
(ρ = 0.990) and unstable at `h = 0.20` (ρ = 1.21), the `hω < 2` wall; RK4 at the same point
has `|R| = 0.735`. So "switch integrators and the region redraws" works exactly for Euler,
RK4, and implicit Euler. Grey out the region for the other two, or draw it in `(hω, ζ)` space.

## Shared code

What the 13 panels and their side panes need from `app/shared/`, beyond what is already
there. `plan.md` has the directory layout and the pane contract; this section is the
inventory: which shared pieces exist, which are missing, and which panels consume each one.
The rule stays the same: a panel ships prose and one `mount()`, and everything two panels
would otherwise both write lives in `shared/`.

### What exists

`shared/` already holds the skeleton and the whole numeric core: the store and its limits
(`state.js`), the manifest, router, loader, and pane manager, the rAF loop, and the math
(`complex.js`, `system.js` with eigenvalues, regime, and the closed form, `integrators.js`
with the five steppers and `simulate()`, `stability.js` with `R(hλ)`, the 2×2 update
matrices, spectral radius, and doubling time). Rendering has `plot2d.js` (DPR sizing, a
plot view, grid, axes, polyline, point, arrow, text, CSS-variable colors) and the region
shader (`region-gl.js`). `ui/controls.js` has a slider, a radio group, the integrator
picker, preset buttons, and a monospace readout. Panel 1's two placeholder panes exercise
the loader path end to end. Everything below is what the outline asks for and that layer
does not yet give.

### State beyond the tuple

- **A scene store for the 2D panels (1, 2, 5).** The tuple describes the 1D spring; panels
  1, 2, and 5 draw a point mass on a plane with a set of force arrows (wind, gravity, drag,
  spring), each with an on/off switch, draggable parameters, and a real-vs-linear switch.
  Panel 2's left pane draws *the same arrows* the reviewer just dragged on the spine, and
  the pane manager destroys and remounts side panes, so this state cannot live in a pane. It
  needs a second store. The tuple store throws on unknown keys and hardcodes its limits, so
  `createStore` grows an options argument (`{ limits, validate }`) and `shared/scene.js`
  instantiates it with the scene schema. The tuple itself stays at eight entries.
- **Per-panel knobs that must survive a remount.** Panel 4's perturbation size, panel 13's
  target error, and the highlighted index of every sweep (below) belong in the same kind of
  side store, one `shared/aux.js` with documented keys, not in the tuple and not in pane
  closures.
- **The bridge.** Panel 5 assembles `M`, `C`, `K` from the scene's linearized forces and
  writes them into the tuple's `m`, `c`, `k`. That single `store.set()` is how Part I's
  forces become Part II's eigenvalues; it is the one place the two stores touch.

### Math

- **Force models, `math/forces.js`** (2, 5, 2-right, 5-right). Each force as a pair of
  functions, real and linearized, with its parameters: constant wind, gravitation
  `G m₁ m₂ / r²` vs `m g`, drag `c v`, spring `k x`. `assemble(scene) → { M, C, K }` sums
  the linear coefficients for panel 5. Torque and moment of inertia for 2-right ride on the
  same shapes with a lever arm.
- **Custom acceleration in `integrators.js`** (2, 5-right). `createStepper` is wired to the
  linear `acceleration(m, c, k)`. Panel 2 integrates an arbitrary force sum and 5-right runs
  the *nonlinear* simulation next to the linearized verdict, so the explicit steppers
  (Euler, RK4, semi-implicit) take an optional `accel(x, v, t)`. Implicit Euler and Verlet
  keep their linear closed forms; the picker restricts to explicit methods when a custom
  force is in play. `simulate()` also returns the error series `|x − exact|` so panel 9 does
  not recompute it.
- **2×2 matrices, `math/matrix2.js`** (6, 6-left, 6-right, 9-right). The helpers now
  private to `stability.js` (`madd`, `mmul`, `mdet`, `minv`) move here and are exported,
  plus constructors for rotation, scale, and shear, and an eigen-decomposition of a real
  2×2: real eigenvectors when the discriminant allows, the complex pair otherwise, which is
  exactly the moment 6-right's sweep is built to show. `stability.js` imports from here.
- **Modes, `math/modes.js`** (9-right, 10). Eigenvectors of the system matrix, projection
  of `(x, v)` onto them, and the scalar modal simulation `x_{i+1} = R(hλ) x_i` in complex
  arithmetic per method. This is the step from the 2×2 system to `x' = λx` that panel 10's
  spine is built on.
- **Taylor tools, `math/taylor.js`** (5-right, 12-left, 12-right, 13-left). Partial sums of
  `e^z` to degree `n` (Euler is `n = 1`, RK4 is `n = 4`), `amplification` extended with a
  `taylor(z, n)` case for RK1 through RK3, and the expansion of `1/r²` about an operating
  point for 5-right. Panel 13-left's local truncation error is the next term of the same
  series.
- **Adaptive stepping, `math/adaptive.js`** (13, 13-right). A local error estimate per step
  (step doubling or the embedded next Taylor term), a controller that grows or shrinks `h`
  toward a target error, and a run that returns `t`, `x`, and `h(t)` arrays. The stepper
  gets a `setH` so `h` can change every step; Verlet re-seeds its `x_{−1}` consistently.
- **Inversion, in `system.js`** (11, 11-left). `paramsFromEigenvalue(m, λ)` giving
  `c = −2m·Re λ`, `k = m|λ|²`, so dragging `λ` on the plane still drives the tuple, and an
  `exactFromEigenvalue` for the no-method left pane.
- **Normalized stability, in `stability.js`** (12-right-3, 11-right). `updateMatrix` in
  `(hω, ζ)` coordinates so the Verlet and semi-implicit heatmaps are drawn in the space where
  their `hω < 2` wall is a straight line.

### Simulation

- **A live player, `shared/player.js`** (8, 9, 11, 12, 12-right-2, 13). One object that
  owns a stepper, advances it by wall-clock time at the tuple's `h` (several steps per frame
  when `h` is small), writes `t` to the store `{ silent: true }`, exposes the growing
  trajectory arrays and the exact curve sampled at the same times, and restarts when any
  tuple entry other than `t` changes. It also reports per-frame compute cost (panel 8's
  budget bar), the error series and its measured step-to-step ratio (panel 9), and can
  run the adaptive controller instead of a fixed `h` (panel 13). Play, pause, reset, and
  single-step are its verbs; `ui/transport.js` renders them.
- **Sweeps, `math/sweep.js`** (6-right, 8-right, 10-right, 11-right, 12-right-2, 13-right).
  `sweep(values, value => result)` with memoization keyed on the tuple, so exploding `h` or
  the target error across a small range is one call and does not rerun on every frame.

### Rendering

- **A stage helper, `gfx/stage.js`** (every pane). Both panel-1 panes repeat the same
  boilerplate: make a canvas, wrap it in `.stage`, fit it, observe resize, redraw on
  subscribe. `createStage(root, { layers, aspect, signal })` returns the stacked canvases,
  a coalesced `redraw()` that runs at most once per frame no matter how many store patches,
  resizes, and player frames ask for it, and cleans itself up on `signal`.
- **Trajectory plots, `gfx/trajectory.js`** (3, 3-left, 4, 8, 9, 11, 12, 13). Time on the
  horizontal axis, the exact curve dashed underneath, the integrator's polyline on top with
  optional step markers and tangent segments (10-left's follow-the-tangent), auto-ranged or
  pinned `y`, and a log-`y` option in `makeView` because panel 9's error is exponential.
  Nearest-sample hit testing for hover and for panel 3's touch-the-curve step down.
- **Bundles with highlight, `gfx/bundle.js`** (4, 6-right, 8-right, 10-right, 11-right,
  12-right-2, 13-right). Draw a list of series with one index highlighted and the rest
  dimmed. This is the single most reused new piece; Victor's caution about pretty,
  unreadable bundles is enforced here by a small cap on the count.
- **The complex plane, `gfx/cplane.js`** (7, 7-left, 7-right, 10, 11, 11-left, 12). Axes
  labeled Re and Im, the eigenvalue pair drawn green or red from `stabilityReport`, a
  draggable `λ` handle that inverts to `(c, k)`, and the analytic circles for nested Euler
  disks. It stays on screen from panel 7 to the end, so it is one module, not seven.
- **Region shader, `region-gl.js`** (10, 10-right, 12, 12-right). Three changes. A `layers`
  argument, `[{ method, h, alpha }]` with a highlighted index, so 10-right's nested disks
  and 12-right's RK1–RK4 overlay are one draw. A degree-`n` Taylor mode (`uOrder`) to match
  `math/taylor.js`. And one shared WebGL2 canvas that renders and blits into ordinary 2D
  canvases: the pane manager keeps up to five panes mounted, panel 12's spine alone wants
  three regions, and browsers cap live contexts around sixteen, so one context that draws
  into many stages is safer than one context per stage.
- **Small helpers in `plot2d.js`.** A filled band between two curves (panel 4's ε-tube), a
  vector field (4-right's flow), a transformed grid and shape (6, 6-left), a heatmap over a
  view with a diverging colormap centered on `ρ = 1` (12-right-3, 11-right), a grid layout
  for small multiples (11-right, 12), and `gfx/color.js` for alpha and mixing of the CSS
  palette.
- **Drag handles, `gfx/drag.js`** (1, 2, 2-left, 5, 6, 7, 11). Pointer capture, hit test
  against a list of handles, and move/end callbacks on `ctx.signal`. Panel 1's spine hand-
  rolls this today; the arrows of panel 2 and the vector of panel 6 want the same thing.

### UI

- **Live MathML, `ui/livemath.js`** (5, 7, 7-left, 10-left, 12-left). Prose fragments mark
  `<mn data-var="m">` slots; `bind(root, store, derive)` fills them from the tuple and from
  computed values (the discriminant, `|1 + hλ|`, the Taylor sum). Native MathML only.
- **Scrubbable numbers, `ui/scrub.js`** (5, 7). A number in a formula you drag left or right
  to change, bound to a store key with the store's limits. This is what makes panel 5's
  "every parameter is a draggable number" true.
- **Additions to `ui/controls.js`.** A `log` option on `slider` for `h` and `k`, a toggle
  switch for on/off and real-vs-linear (2, 5), `ui/transport.js` for the player (8, 9, 11,
  12, 13), and `ui/sweep.js`: a range strip whose hover or drag sets the highlighted index
  that `gfx/bundle.js` reads (every explode pane).

### Shell

- **Chained right panes** (12). The router accepts `#/N/right`, the manifest holds one
  `right` entry, the loader checks `entry[pane]`, and `main.js` stamps one cell per side.
  Panel 12's `#/12/right/2` and `#/12/right/3` need the route regex to carry a depth, the
  manifest's `right` to be a list, the row to hold as many cells as panes, the bottom rail
  to show them, and files named `right.js`, `right-2.js`, `right-3.js`.
- **Manifest sync.** The manifest predates this outline: panel 1's spine and left are the
  reverse of the entry above, panel 8 has no right pane where the outline explodes `h`, and
  the right-pane titles for 6, 10, 11, and 12 do not match. It is the source of truth for
  the shell, so it is corrected when those panels are built.

### Who uses what

| Panel | Existing | New |
|---|---|---|
| 1 | plot2d, readout | scene store, drag handles, stage |
| 2 | drawArrow, store | scene store, forces, custom accel, drag handles, toggle |
| 3 | simulate, exactSolution | trajectory plot, stage, hit testing |
| 4 | simulate, exactSolution | bundle, band fill, vector field, aux (ε) |
| 5 | store, MathML | scene store, forces, assemble → tuple, live math, scrub, Taylor |
| 6 | systemMatrix | matrix2 + eigenvectors, transformed grid, drag handles, sweep, bundle |
| 7 | eigenvalues, regime, cfmt | cplane, live math, scrub |
| 8 | store, loop | player, transport, trajectory, sweep, bundle |
| 9 | doublingTime, amplification | player (error series, ratio), log-y, modes |
| 10 | region-gl, stabilityReport | cplane, modes, layers in the shader, live math, trajectory |
| 11 | region-gl, PRESETS | cplane with λ drag, inversion, player, small multiples, heatmap |
| 12 | region-gl, METHODS, updateMatrix | shared GL canvas, Taylor mode, taylor.js, bundle, heatmap, chained right panes |
| 13 | simulate | adaptive, player, trajectory (h(t)), aux (target error), sweep, bundle |

### Tests

`node --test` covers the math and nothing that touches the DOM. New modules with tests:
`matrix2` (eigenvectors reconstruct the matrix; the rotation sweep goes complex at the
predicted angle), `forces` (assembling the linearized drag and spring reproduces the
tuple's `c` and `k`), `taylor` (the degree-4 sum equals `amplification('rk4')`), `modes`
(projection and reconstruction round-trip), `adaptive` (RK4 with the essay parameters at a
0.01 bound peaks near `h = 2.1 s`; with `k = c = 0` it runs to the cap), and the measured
error ratio in `simulate` matching `|1 + hλ|` for Euler in the unstable regime. Any number
those tests pin is added to the confirmations below.

### Order

Follow `plan.md`'s panel order and let it pull the shared code in: `cplane`, `stage`,
`livemath`, `player`, `trajectory`, and the shader's layers first (panels 7, 10, 11, 12
all draw the plane, and 11 and 12 run the spring against the exact curve), then `bundle`,
`sweep`, and `adaptive` (panels 3, 8, 9, 13), then the scene store, `forces`, `matrix2`,
and drag handles (panels 1, 2, 4, 5, 6). Nothing in the third group blocks the payload.

## Numeric confirmations, and one correction to Part II

Scripts: `poc/numerics.mjs`, `poc/numerics2.mjs`.

- Eigenvalues for `m=10, c=0.1, k=10`: `λ = −0.005 ± 0.99999i`. Matches the essay.
- At `h = 1/30`: `|1 + hλ| = 1.0004`. Explicit Euler is unstable as claimed, but barely:
  amplitude doubles every ~59 s. At `t = 60` it reads `−1.93` vs exact `−0.71`; at
  `t = 600`, `−1.08e3` vs `−0.05`. Exponential and unbounded, but the "outside the visible
  Universe" magnitude in the essay's screenshot is **not reproducible** from this linear
  system at this step. Whatever solver produced it had something else going on.
- **Demo defaults:** use `m=1, c=0.1, k=100` (`λ = −0.05 ± 10i`). `|1 + hλ| = 1.0525`,
  doubling every 0.5 s, `|x| ≈ 1e8` by `t = 12`. Visible in seconds.
- RK4 at `h = 1/30` tracks the exact solution to three significant figures through 600 s in
  both parameter sets.
- Implicit Euler is stable everywhere but artificially damps: `0.26` vs exact `0.71` at
  `t = 60` with the essay's parameters. That contrast is the teaching payload.
- Semi-implicit Euler and Störmer–Verlet preserve amplitude and slowly drift phase.
- **Adaptive RK4 with the essay's parameters at a 0.01 bound** (`shared/math/adaptive.js`,
  step doubling): `h` peaks at `2.10 s`, median `1.81 s`, 70 steps for 120 s, no
  rejections, max global error `0.29`. With the essay's own recipe (next Taylor term, `x`
  only) the peak is `1.55 s`, or `1.86 s` with no growth clamp. **The 16-second step is not
  reachable on this spring:** `h⁵/120 · |x⁽⁵⁾| ≤ 0.01` at `h = 16` needs
  `|x⁽⁵⁾| ≈ 1e−6`, and with `ω ≈ 1` the fifth derivative is order 1. The mechanism that does
  produce it: with `k = c = 0` every derivative past `a` vanishes, both estimators read zero
  error, and `h` runs straight to its cap. The likely story behind the anecdote is a
  projectile under constant gravity, where RK4's next term is exactly zero while Euler's
  `h²/2 · |a|` is not, which matches "Euler worked well but RK4 tried 16 s".
- **Adaptive explicit Euler with the demo parameters at a 0.01 bound** is slowed, not
  stabilized: `|x| ≈ 3.2` by `t = 12` (`11.8` by `t = 60`) against `9.8e7` for fixed
  `h = 1/30`, with `h` held at `0.005–0.018` and 112 rejected steps. The Euler disk needs
  `h ≤ 0.001` there; a local-error tolerance never enforces stability.

## Prior art (and the gap)

- PhysSandbox RK stability regions (canvas; Euler/RK2/RK4; `hλ` marker; no sim):
  https://physandbox.com/math/runge-kutta-stability
- NovaSolver RK stability simulator (region + scalar decay sim, real `λ` only):
  https://novasolver.jp/en/tools/runge-kutta-stability.html
- Wolfram Demonstrations, θ-method absolute stability (needs Wolfram Player):
  https://demonstrations.wolfram.com/AbsoluteStabilityOfAnIntegrationMethod
- ShareTechnote damped-spring integrator sim (sliders; no region):
  https://www.sharetechnote.com/html/WebProgramming/Websim_NumericalIntegration.html
- mysimulator.uk Euler/Heun/RK4/Verlet oscillator with exact overlay:
  https://www.mysimulator.uk/content/articles/numerical-ode-methods.html
- RWTH physics-simulation spring plot incl. implicit Euler:
  https://interactivecomputergraphics.github.io/physics-simulation/examples/spring_plot.html
- myPhysicsLab single spring: https://www.myphysicslab.com/springs/single-spring-en.html
- References: Chebfun regions https://www.chebfun.org/examples/ode-linear/Regions.html;
  Driscoll & Braun §11.3 https://tobydriscoll.net/fnc-julia/diffusion/absstab-diffusion.html;
  Gaffer on Games https://gafferongames.com/post/integration_basics/;
  Erin Catto GDC 2015 https://box2d.org/files/ErinCatto_NumericalMethods_GDC2015.pdf

Nobody ties the three together: a physical system whose complex eigenvalues sit live on the
region while the simulation runs against the exact solution. Nobody draws implicit Euler in
plain HTML, and nobody renders the region as a GPU field. That is the differentiator.

## The proof of concept

`poc/stability-poc.html` is a single 9 KB file, no dependencies. Radio buttons for Euler,
RK4, implicit Euler; sliders for `h`, `m`, `c`, `k`, plot half-range; eigenvalues drawn
green (stable) or red (unstable) with `|R|` readout; URL params pre-seed state, e.g.
`?method=1&h=0.2&r=50`. Screenshots from headless Chrome: `euler.png`, `rk4.png`,
`implicit-euler.png`. Serve it with any static server:

```
python3 -m http.server 8765 --bind 127.0.0.1
open http://127.0.0.1:8765/poc/stability-poc.html
```

Note: the POC plots all three regions in the `λ`-plane. Part II's implicit-Euler snippet
labels its axes `hλ`; the shape is the same, scaled by `h`.
