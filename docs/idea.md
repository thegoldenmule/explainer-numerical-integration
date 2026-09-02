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
    trajectory; the reviewer can reproduce the 16-second step themselves.

## Flow diagram

The page is a grid of full-viewport panels. The **spine** runs vertically: each of the 13
outline steps is one panel, and scrolling down advances to the next concept. Each panel holds
its interactive visualization and its explainer text. From any panel you can move sideways,
never more than one pane:

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
   [Taylor series] <--------- 12  Higher-order RK  -------> [explode order: RK1–RK4 regions]
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
  against the exact curve. Margin note on implicit Euler: it is hard in general, a solve
  per step, but the linear case has a 2×2 closed form (see Integrators below), and its
  region `|1 − hλ| ≥ 1` is the outside of a disk. Semi-implicit Euler and Verlet have no
  scalar `R(hλ)` and are kept out of the flow; see the design caveat under Integrators.
- *Left, step down (one term at a time):* Taylor series. Add terms to the expansion one by
  one and watch the approximation of `e^{hλ}` improve; Euler is the first two, RK4 the first
  five.
- *Right, step up (explode order):* the same truncation across the whole plane. The regions
  for RK1 through RK4 overlaid on one plane, each the set where the degree-`n` Taylor
  polynomial of `e^{hλ}` has modulus at most 1. Hover an order to highlight its region and
  its polynomial and dim the rest. The left is one `λ` term by term; this is every `λ`
  order by order.

**13. Variable step sizes.** `h` becomes a function of `t`.
- *Spine viz:* a target-error slider with `h(t)` plotted as its own trajectory under the
  simulation. Set the bound to 0.01 with RK4 and watch the controller push `h` toward the
  16-second step from the college paper.
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
- Side panes are one deep. A right pane has no right pane of its own.
- Deep links: `#/7`, `#/7/left`, `#/7/right`. The whole grid is addressable.

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
