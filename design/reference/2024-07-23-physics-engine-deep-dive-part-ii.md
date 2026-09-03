---
title: "Physics Engine Deep Dive: Part II"
subtitle: "In part two, we explore specific criteria for making physics engines break."
date: 2024-07-23
url: https://medium.com/p/cb8d1fda1f9b
words: 2386
source: posts/2024-07-23_Physics-Engine-Deep-Dive--Part-II-cb8d1fda1f9b.html
---

# Physics Engine Deep Dive: Part II

*In part two, we explore specific criteria for making physics engines break.*

![“Numbers” | Kevin Dooley](https://cdn-images-1.medium.com/max/800/1*GDEI8bHKk6Yfq4hxdu_SFg.jpeg)

> If you’re a non-premium user, click [here](https://thegoldenmule.medium.com/physics-engine-deep-dive-part-ii-cb8d1fda1f9b?sk=3d47aa8555a0dfa9feebdab3943a5db5) to read the full article for free. Otherwise, continue reading.
>
> This is part two of a series. Part one can be found [here](https://thegoldenmule.medium.com/physics-engines-explained-part-i-25c595ddc5b2).

In the [last article](https://thegoldenmule.medium.com/physics-engines-explained-part-i-25c595ddc5b2), we defined some terms: we learned what **rigid bodies** were, breezed through **Newtonian kinematics**, and developed some simple force models. We also explored the idea of ***physical stability*** using Linear Stability Theory (LST). This gave us an explicit method for determining how our force models and parameters affect the stability of the system.

In this article, we are going to deep dive numerical methods. We’re going to try to understand how they work and more importantly, why sometimes they *don’t* work.

![From Wikimedia.](https://cdn-images-1.medium.com/max/800/0*auUpNusmhowOei7G.png)

## Recap

In Part I, we briefly touched on the fact that numerical methods operate *iteratively*. That is, given the current state of a system, a numerical method approximates a future state (Why can’t we just figure out the exact solution to a complex system? Among other reasons, see [Bonini’s Paradox](https://en.wikipedia.org/wiki/Bonini%27s_paradox).). These methods are generally given small time steps like 1/60th or 1/30th of a second where the smaller the time step, the closer the approximation will be to the actual solution.

Games are particularly fascinating bits of software because they need to operate in *realtime*. They need to do work many times a second, usually linked in some way to the refresh rate of a display. This means that, for a game trying to run at 60 fps, each frame we only have 1/60th of a second (probably less) to do processing. Add in a physics simulation that may take a few milliseconds every frame, and now we’ve got even less time to do any processing.

Because of this, it behooves a physics engine to maximize that time step without letting the difference between the approximation and the explicit solution grow. This is fairly simple to see: if we can achieve good results from running our physics engine only once every 1/15th of a second or every 1/10th — that is preferable to running it every 1/60th of a second.

Many game developers just use trial and error here — and this isn’t a terrible solution. They set a time step, or simpler still just use the default, and then they play the game to see if there are issues.

The problem with this method is that adequately testing a sandbox is logically impossible. A tester can’t possibly test every physical situation. How would you test that the physics of the Halo Warthog works in all situations? You can’t. You can throw an entire QA department at it for weeks, but you still haven’t tested every potential physical state. Instead, you need something *provable*.

To find this optimal time step, LST relies on error calculation. Intuitively speaking, LST is looking for a threshold where our simulation has accumulated “too much error” — in which case it kerplodes. I’m speaking in generalities but I will now derive a very explicit definition of these terms.

![“Graph” | Alice Bartlett](https://cdn-images-1.medium.com/max/800/1*8AGJAULHvCIdHuoF6N8G6A.jpeg)

## Finding Error

The main idea of this type of analysis is that we want to calculate the ratio of future to present error, usually denoted by **z**. If we can explicitly calculate this ratio, then we know whether error is growing or shrinking. This means that what we’re going to be looking to do is pick parameters of our system and our numerical methods *such that this ratio is less than one*. If we can do that, then we’ve proved that our error is shrinking.

LST gives us powerful tools for this. I’ve provided some derivations below for completeness, but feel free to use only their results.

First, we need to start with a construction called the **modal equation**. Modal equations define independent behaviors of a system of equations: different “modes” of a system. This is, conceptually, very similar to what an eigenvalue describes about a square matrix (see Part I): the magnitude of an independent scaling transformation. This is a clue to why eigenvalues will show up here, though a complete derivation is well outside the scope of this article. For a more full treatment, see [*Game Physics*](https://www.thriftbooks.com/w/game-physics-interactive-3d-technology-series_david-h-eberly/621003/) by David Eberly. I am referencing him throughout this article, though be warned: the source is prohibitively dense (or maybe it’s simple and *I am dense*).

The modal equation is given by the following equation, given a state vector (the state of the rigid body will be position and rotation) **x**, and eigenvalue λ:

![](https://cdn-images-1.medium.com/max/800/1*sWgbFSqo_YLauRIeFZutdA.png)

What we need to do is take our numerical method and apply it to the modal equation. We can do this by example.

## Runge-Kutta Family

The most common class of methods used in rigid body physics engines are [Runge-Kutta methods](https://en.wikipedia.org/wiki/Runge%E2%80%93Kutta_methods) (pronunciation [here](https://www.youtube.com/watch?v=QGcP8Humeqg)). This class includes the oft-used explicit Euler method:

![](https://cdn-images-1.medium.com/max/800/1*dTR5kr4obbOHwy1z04xpSw.png)

It looks dense, but this equation is saying that the next state vector (at *t = i+1*) can be calculated from the current state vector at *t = i*. The *h* is our time step, or *dt*. To calculate our error ratio, the verbiage is that we “apply the method to the modal equation” by using f(t, **x**) = λ**x**.

![](https://cdn-images-1.medium.com/max/800/1*jfswHrDiANM4e3LxuNcGYw.png)

Then we find the characteristic polynomial *p(z) = 0* of the linear difference equation, i.e. the error equation given by our value for **x** minus its modal equation. This is done by setting the equation equal to zero:

![](https://cdn-images-1.medium.com/max/800/1*HsPOD5H-PiylcZw73brIMw.png)

and then replacing *xi+j* with *zj* for *j ≥ 0* (pardon Medium’s awful typography support):

![](https://cdn-images-1.medium.com/max/800/1*C15Rg-sBcuj2EWen5REzTw.png)

The only root of this equation is *z = (1 + hλ)*. Here we introduce the definition of numerical stability: we have that Euler’s method is stable if and only if ***|z| = |1 + hλ| ≤ 1***. Looking at the derivation above, you can see how this makes perfect sense: since *z* is a ratio of future to present errors, a value greater than 1 would mean that error is growing.

We can now plot the Euler method’s region of stability on the complex plane, using the following Mathematica code.

```
h = 0.032; (* You can change h to any value *)
lambda = ComplexExpand[Re[lambda] + I Im[lambda]];

(* Generate the plot for the inequality |1 + h*lambda| <= 1 *)
RegionPlot[
  Abs[1 + h (x + I y)] <= 1,
  {x, -100, 100}, {y, -100, 100},
  Axes -> True,
  AxesLabel -> {"Re(z)", "Im(z)"},
  PlotLabel -> "|z| = |1 + h \[Lambda]| <= 1, h=0.032",
  PlotRange -> {{-100, 100}, {-100, 100}},
  BoundaryStyle -> {Thick, Blue},
  Epilog -> {Red, PointSize[Large], Point[{0, 0}]},
  GridLines -> Automatic,
  PlotPoints -> 100
]
```

This generates the plot:

![](https://cdn-images-1.medium.com/max/800/1*MYy1opZyItunXvo9ijoo2A.png)

Note that, since our time step *h* is in the inequality, it heavily affects the stability of a method. In this case, we’re using an *h* value roughly equivalent to a frame-rate of 30 (1/30 ≃ 0.032).

This shows that Euler’s method is unstable for eigenvalues with *any* positive real component and large imaginary components. But what the heck does this mean?

Graham Rhodes, in [his paper on *Stable Rigid Body Physics*](https://www.researchgate.net/publication/228548521_Stable_Rigid-body_Physics), gives an intuitive description for interpreting this graph. According to Rhodes, the imaginary axis represents oscillation while the real axis shows growth or decay of physical position. With this understanding we can see that Euler’s method needs aggressive dampening and is unstable under oscillation (like what might happen with a spring force).

## Let’s Break It

For a real demonstration, we can see the results of this numerical instability with only two forces: fluid drag and a spring. We can define our linear system in terms of a vector **r** (this is taken from Part I):

![](https://cdn-images-1.medium.com/max/800/1*bMdq5SGZqTPLzndQD3canQ.png)

If we pick our mass to be 10, [drag coefficient](https://en.wikipedia.org/wiki/Drag_coefficient) to be 0.1, and [spring constant](https://en.wikipedia.org/wiki/Hooke%27s_law) to be 10:

![](https://cdn-images-1.medium.com/max/800/1*k7ERe8kA_2B2U7HHS2jCew.png)

Which, via the quadratic formula, gives us eigenvalues:

![](https://cdn-images-1.medium.com/max/800/1*tLxv2BkAMtYbn4o0UEcQAA.png)

Since the imaginary component of λ is so large, and the real part so small, the eigenvalues are not within the region of stability. Plugging this model into a simple solver, the output is given below, output every second:

![](https://cdn-images-1.medium.com/max/800/1*HRSUXYVemnqj--LdaEHXRw.png)

Uh oh. Unless we expect the physical position of our rigid body to be outside the bounds of the visible Universe, something is wrong.

As you can see, using a method outside of its region of stability causes solutions to stray. In this particular example, decreasing *h* is enough to make the solutions stable for *some time*, but not indefinitely– recall that we’ve already discussed that from the plot we can tell this method is unsuitable for oscillation.

We can take a quick look at what happens when we decrease *h* to 1/60 (≃ 0.016) which makes the algorithm take smaller steps.

![](https://cdn-images-1.medium.com/max/800/1*iSCIFuf2a7cUBFnb9SmqmQ.png)

With a 1/60 second step, the region of stability scales. This means that it does include eigenvalues for which it would previously have been unstable — but it still does not account well for oscillation.

## Higher Order Runge-Kutta

If we try the same spring simulation on a higher order Runge-Kutta numerical method, like the fourth order (abbreviated RK4), it runs without issue. Let’s analyze this method to see why that would be the case.

Here is the definition of the fourth order Runge-Kutta method (note that the first two terms are equivalent to Euler’s method):

![](https://cdn-images-1.medium.com/max/800/1*Y9zGSxGeT7SoEkub75X5Fg.png)

Analysis for this method is quite a bit more complicated, but when we work through the problem we end up with:

![](https://cdn-images-1.medium.com/max/800/1*2WCnFYqDA9w4Jb7wK8L4dw.png)

To simplify a bit, it’s common to define a function *q* such that:

![](https://cdn-images-1.medium.com/max/800/1*bKhwDKfbtoebqzQpXhxxjA.png)

This is so that the characteristic polynomial might be written as *p(z) = z − q(hλ)*, giving us a single root at *z = q(hλ)*. Then we can say that the RK4 method is numerically stable when *|q(hλ)| ≤ 1*.

Mathematica is able to map this out as well for a step size of 1/5:

```
(* Define the parameters *)
h = 0.2; (* Small step size to better capture the stability region *)
lambda = ComplexExpand[Re[lambda] + I Im[lambda]];

RegionPlot[
  Abs[1 + h (x + I y) + (1/2) (h (x + I y))^2 + (1/6) (h (x + I y))^3 + (1/24) (h (x + I y))^4] <= 1,
  {x, -50, 50}, {y, -50, 50},
  Axes -> True,
  AxesLabel -> {"Re(z)", "Im(z)"},
  PlotLabel -> "h=0.2, |z| = |1 + h \[Lambda] + (1/2)(h \[Lambda])^2 + (1/6)(h \[Lambda])^3 + (1/24)(h \[Lambda])^4| <= 1",
  PlotRange -> {{-50, 50}, {-50, 50}},
  BoundaryStyle -> {Thick, Blue},
  Epilog -> {Red, PointSize[Large], Point[{0, 0}]},
  GridLines -> Automatic,
  PlotPoints -> 200
]
```

Which gives us the plot:

![](https://cdn-images-1.medium.com/max/800/1*MT7AiNZrejWUQiuzMLhqkQ.png)

We can see two things: not only is the stability region pretty dang large for a stupidly big step size— the RK4 method handles oscillation much better as well. However, we can still see that there are issues with positive real values or extreme negative real values. Again, shrinking the step size will scale this region of stability, which we can see by re-plotting with h=0.1.

![](https://cdn-images-1.medium.com/max/800/1*E7QUzR18HIvmO0otqVQxCQ.png)

For completeness, I’ll include the *implicit* Euler method’s stability region as well:

```
h = 0.1; (* You can change h to any value *)
lambda = ComplexExpand[Re[lambda] + I Im[lambda]];

(* Generate the plot for the inequality |1 + h*lambda| <= 1 *)
RegionPlot[
  Abs[1 - h (x + I y)] >= 1,
  {x, -25, 25}, {y, -25, 25},
  Axes -> True,
  AxesLabel -> {"Re(h\[Lambda])", "Im(h\[Lambda])"},
  PlotLabel -> "|z| = |1 - h \[Lambda]| >= 1",
  PlotRange -> {{-25, 25}, {-25, 25}},
  BoundaryStyle -> {Thick, Blue},
  Epilog -> {Red, PointSize[Large], Point[{0, 0}]},
  GridLines -> Automatic,
  PlotPoints -> 100
]
```

Which yields a very interesting plot:

![](https://cdn-images-1.medium.com/max/800/1*_-7Gses10kzsiQcmv3mppg.png)

Careful readers will ask: *why not use this for everything*?? The truth is, that would be nice, but it turns out to be really hard to implement. For now, we’ll skip this one.

## Variable Step Sizes

Rigid body physics engines typically use only one numerical method. Conventional wisdom says that you just pick the one with the largest stability region: RK4 or explicit Euler (there are many others as well, including “multi-step” solvers that we will not discuss).

However, not only does this not guarantee stability (you still need to do the work of calculating your eigenvalues), it may be that we are instead *over-calculating*.

As discussed before, in a video game we want to use the least amount of CPU possible. Thus, as we asked in the last article: how can we do the least amount of processing required to keep our engine stable?

This is where *local truncation error* comes in. While it’s great that we can make claims about stability and pick the correct method that covers our needs, ideally we want to be able to make *h* as large as possible without blowing up our simulation.

Euler and RK4 make this nice to work with, because both actually belong to the same family of numerical methods. In passing, we said that Euler was just the first two terms of RK4. In fact, they are *both* the first few terms of an infinite Taylor series. This is good news, because it means we can simply take the next term in the Taylor expansion as our error estimate. For Euler’s method, this would look like:

![](https://cdn-images-1.medium.com/max/800/1*BCqMaFDgN5ok_EEmhFsZRw.png)

whereas for RK4, it would look like:

![](https://cdn-images-1.medium.com/max/800/1*BwWNSSPYErW3EXs4YgyPig.png)

These are both easily calculable in real-time. What this allows us to do is not just measure error, but work backward and instead *describe a target error threshold*.

For example, we could specify a target local truncation error of *0.01*. Then, we could calculate the Euler method error explicitly for some step size. If local error is less than 0.01, then we can increase *h* until we hit that bound. If local error is greater than 0.01, we can either lower *h* or just keep adding expansion terms!

In college I wrote a paper where I implemented such a system. It used variable step sizes based on this target error. Here is an excerpt I found from my first run:

> Using the error bound of 0.01 for both, I found that the Euler method worked well in most situations but the RK4a method was so much more accurate that [the engine] attempted to set the step size as great as 16 seconds! This resulted in a frame rate of 1/16 frames per second.

That’s… kinda hilarious.

## Next Steps

*Whew*.

This was part two of my three part series deep-diving physics engines in games. For our next article, we’ll explore a couple ideas around collision detection and response. You’ve probably already used one and didn’t know it!

Stay tuned.
