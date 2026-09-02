---
title: "Physics Engines Explained: Part I"
subtitle: "How video physics engines work… and how they break. We go deep."
date: 2024-07-17
url: https://medium.com/p/25c595ddc5b2
words: 2180
source: posts/2024-07-17_Physics-Engines-Explained--Part-I-25c595ddc5b2.html
---

# Physics Engines Explained: Part I

*How video physics engines work… and how they break. We go deep.*

![From Wikimedia.](https://cdn-images-1.medium.com/max/800/0*IspZqqnDZvZmWWsY.png)

> Update: Part II is [here](https://medium.com/@thegoldenmule/physics-engine-deep-dive-part-ii-cb8d1fda1f9b).

My favorite game of all time is probably [Scorched Earth](https://en.wikipedia.org/wiki/Scorched_Earth_%28video_game%29).

Whew — just typing out that name and seeing the Wikipedia screenshot is giving me goosebumps. Nothing like mainlining uncut nostalgia. The other game that comes to mind is simply known as “Gorillas” or [GORILLA.BAS](https://en.wikipedia.org/wiki/Gorillas_%28video_game%29). I have no idea how this game came to exist (Microsoft apparently funded it?) but the premise is incredible: two King-Kongs on a city skyline, throwing explosive bananas at each other. Call of Duty could learn a thing or two from the simplicity of trajectory-based banana-play.

![From Wikimedia.](https://cdn-images-1.medium.com/max/800/0*aJ5bgXZb00UJYprR.png)

Both of these games, and my later favorites like Halo, Half-Life, or Portal are all, at their core, sandbox games. They plop you down in a world and you play with the rules of that world. Why is the Halo Warthog so much dang fun? Because it’s bouncy and slidey and it doesn’t handle very well. It’s completely unrealistic in the most realistic way and because of that it’s hilarious fun.

And somehow, deep deep down, underneath the napalm, underneath the sticky grenades and broken ragdoll, at the bottom of it all — there is math. While my 10-year-old brain couldn’t quite grok the GORILLA.BAS source, in the years since I’ve been able to deep dive how these things work, and now I want to write these things out in English.

This is the first of a three part series that deep dives physics engines for games. My intention is to explain why things work and what is happening when things *don’t* work. It is obviously not exhaustive.

It will, however, start easily enough. I’ll probably be enumerating things you already know — but sit tight! This eventually gets to some pretty involved analysis that I will try to explain in plain English.

We’ll see how well I do.

## Rigid Bodies

There are loads of physics engines out there that you may not realize are physics engines. Most particle systems, like [Unity’s Particles](https://learn.unity.com/tutorial/introduction-to-particle-systems), are physics engines. Particle systems don’t generally care about fine-grain collision detection, and they treat each physical object as a dimension-less point. Then there are fluid simulations like [Blender’s](https://docs.blender.org/manual/en/latest/physics/fluid/index.html) that can create realistic explosions, water effects, or gas visualizations. There are also soft-body dynamical systems that deal with cloth or other deformable objects. We’ve all seen these break in basically every game that includes capes.

What is most common in video games, and comes out of the box in many game engines, are **rigid body** dynamical systems. A rigid body is simply an object that has mass and dimensions that do not change. For the nerds among you, the precise definition follows:

![](https://cdn-images-1.medium.com/max/800/1*Fi6heSbbARZPZb2KRu-0Hw.png)

Here is a rigid body:

![Don’t get me started on how rigid this is.](https://cdn-images-1.medium.com/max/800/1*OqaQa3Qey6Voeaj9_1o5wA.png)

This is the definition we’ll be building all our analysis around.

## Newtonian Physics

When we talk about “rigid body physics engines”, we are generally talking about engines that use Newtonian physics. While some idiots have written [half-baked relativistic physics engines](https://thegoldenmule.com/blog/2011/08/internet-einstein-einstein-internet/), these are quite uncommon in games. Even more specifically, what we’re talking about is Newton’s second law. This law lets us describe forces based on mass (m) and acceleration (**a**) — the latter being the second derivative of position (**x**).

![](https://cdn-images-1.medium.com/max/800/1*hU36JDWFEv7NFZsfT6d16g.png)

The notation I’ll be using has scalars (numbers) in regular face and vectors in bold. In addition, while all of this applies to n-dimensional bodies, I will be writing out notation only for two-dimensional rigid bodies. This will greatly simplify calculation.

The high-level approach of rigid body physics engines is to describe all the forces acting on a rigid body and sum them together.

![](https://cdn-images-1.medium.com/max/800/1*l4NZrzYWQGt4Bo1XD0nZ9w.png)

In this example, we have wind pushing on the object, drag pulling it another direction (perhaps from friction on a surface), and gravity pulling the object down. We can sum all of these to get the total of all our forces.

Each of these individual forces is calculated based on a model for that specific force. For example, the wind force is probably just a constant vector, like \<1, 10>. It’s always windy, everywhere, in the same direction.

We could choose to model the force of gravity in the same way, though that would be fairly unrealistic as gravity scales with mass. Instead, we pick another model for gravity. [Newton’s gravitational force model](https://en.wikipedia.org/wiki/Newton%27s_law_of_universal_gravitation) describes an attractive force between two objects that is based on the mass of both objects, like the Earth and a dog. Then he divided by their distance from one another (r), squared:

![Newton just made this up with his brain.](https://cdn-images-1.medium.com/max/800/1*eO-JNfh1zzefgDg5rrhS5g.png)

This would make the force on both of the objects equal but because the Earth is more massive it is barely affected. Generally, games choose simpler models than this, not because it’s hard to multiply numbers, but because models like this can lead to issues with stability — and in reality you just can’t tell that the Earth moved a smidgen anyway.

We’ll revisit the gravitation model in a bit.

The forces on each rigid body are summed into *translational* and *rotational* sums. That is, all the forces that affect an object’s position are added together, and all the forces that affect an object’s rotation are added together.

The total rotational force is called “torque”, **T**.

![](https://cdn-images-1.medium.com/max/800/1*Jdi9ZpFMWnSUw4_vHmhk9A.png)

You can see here that total translational force is just a sum of a bunch of F=ma’s affecting the second derivative of an object’s position, **x**. Torque is the same thing, but for rotational forces we use sort of a “mass equivalent” for rotation, called the *moment of inertia.* This is given by *I*, which is a number like mass. Torque affects the second derivative of a body’s rotation, commonly given by θ.

## Solving for x

Now that we have a rigid body and we have a description of all the forces acting on that body, the next step is calculating the actual changes to position and rotation. The issue is that this is a Hard Problem to solve explicitly.

In fact, these problems (depending on your forces) are likely “analytically intractable”, meaning that calculating an exact solution is not possible. This is because what we’re looking at is called an Ordinary Differential Equation (ODE). You can’t just multiply through from forces described in terms of acceleration to get position. Instead, the general approach is to iteratively calculate an *approximation* to the explicit solution.

![From Wikimedia.](https://cdn-images-1.medium.com/max/800/0*Gd6A-6h0w4TnGUGG.png)

In the diagram above, the blue line represents the explicit solution for some trajectory. The red, segmented line represents iterative approximations to the trajectory. Those approximate solutions are calculated at small “steps” in time, called *dt*.

So, for example, we might calculate an approximation of what the simulation looks like with a *dt* of 1/60th of a second. This would mean that we calculate when t = 0, 1/60, 2/60, 3/60, etc. Most methods, in most cases, will be able to stay closer to the explicit solution with a smaller *dt* (we will show this in part two). However, more steps lead to more time spent processing.

Now you can see one of the tensions inside of a physics engine. We want to stay “close enough” to that blue line so that our physics engine doesn’t explode. At the same time, we’d like to spend the least possible amount of computation doing it.

So then, how do we spend the least amount of processing while still guaranteeing that our physics engine doesn’t “do something crazy”?

To answer this question, we have to introduce the notion of *physical stability*.

## Physical Stability

Physical Stability is a statement about a solution to our system of equations. It roughly says that a solution is physically stable if it starts out close to the real solution and stays close to the real solution, *forever*.

“*…the intuitive description is that a solution φ(t) is [physically] stable if each solution ψ(t) that starts out close to φ(t) remains close to it for all time.*” - [*Game Physics*](https://www.thriftbooks.com/w/game-physics-interactive-3d-technology-series_david-h-eberly/621003/) *by David Eberly*

So before we can answer any sort of optimization problem, we need to figure out if our solutions are physically stable. We can analyze this problem using something called [Linear Stability Theory](https://en.wikipedia.org/wiki/Linear_stability) (LST). However, this requires us to make some concessions. Like the name implies, LST requires that our system of equations is *linear*. This means we can’t have any squared or higher power terms.

Let’s back up to our Newtonian force model for gravitation. I told you we’d be back.

![](https://cdn-images-1.medium.com/max/800/1*eO-JNfh1zzefgDg5rrhS5g.png)

Notice that squared term on the bottom? That makes this thing non-linear, which is bad news for LST. This is why physics engines generally do not use the “real” Newtonian model: it is not linear. Instead, we simplify to a linear model that doesn’t divide by distance at all. This same principle of linearity requires us to change all our force models to linear models. This gives us something like the following models:

![](https://cdn-images-1.medium.com/max/800/1*z0IYQQey9AOMyNX7fTxuyg.png)

These are not the only force models a physics engine can use, but these are good examples of simple, linear forces.

The force of gravity is simply a constant (g) times mass. If you’re using kilograms, then g is probably a multiple of 9.8, which is a measure of [standard gravity at sea level](https://en.wikipedia.org/wiki/Standard_gravity).

Drag is proportional to velocity. This is “sort-of” how any sort of fluid resistance works — the faster you go, the stronger the oppositional force.

Spring forces are a bit of an outlier, in that they are proportional to the distance the spring is stretched. However, for our purposes, we can consider this linear (we’ll revisit later).

Any other forces (like perhaps magnetism or [lift](https://en.wikipedia.org/wiki/Lift_%28force%29) on an airfoil) can be linearized (made linear) by using something called a [Taylor series](https://en.wikipedia.org/wiki/Taylor_series) expansion. This creates an infinite series, from which we can take the lower-order terms and then simply discard the non-linear terms.

## Stability Analysis

Now we have a system of linear force equations operating on our rigid bodies. This is generally the starting point for any production rigid body physics engine. The next step is determining if solutions to that system are physically stable. This gets *slightly* mathy, but hang with me.

If we use our force models described above, any combination of those models will sum to something that looks like this:

![](https://cdn-images-1.medium.com/max/800/1*_fjG-l72JP2vot-fteFDug.png)

As you can see, what we’re left with is a description of force that is proportional to position, velocity, and acceleration. M, C, and K are constants that will be derived from our specific force parameters. There is also a constant term (not shown), but we can discard that as it will not affect stability.

![](https://cdn-images-1.medium.com/max/800/1*-lvAQFQBwmh8XXcuL9hSZg.png)

So, for example, all components of all forces that are proportional to position collapse into a single component. The same will happen for velocity and acceleration.

This is the general form that describes both translational and rotational force sums. LST then gives us a method for analyzing solutions to this by “*solving a characteristic equation for the homogeneous part of the equation to find our eigenvalues*.” This is a mouthful, and involves some linear algebra, but there is a very intuitive way to understand this. You may remember eigenvalues as some strange mathematical construction, but they are actually fairly simple concepts.

## Eigen-what-now

Forget all the physics for a second.

Say you have a matrix, A. If you were to multiply A by some other matrix, O, you would end up with a transformed version of O. An eigen*vector* (we’re not to eigen*values* yet) defines a direction vector that is *invariant* under that transformation, *except for scaling*.

This means that, regardless of the crazy transformation that A might apply to O (maybe it skews and rotates and translates), an eigen*vector* gives you an arrow in space such that A *only changes it in length*. It’s an arrow that only grows and shrinks under the transformation, A.

An eigen*value* is the magnitude of that scaling transformation, like *3* or *12* or *π*. It’s just a number that represents how far the matrix stretched or squished that invariant vector.

## Finding Eigenvalues

Now lets add physics back in.

What we’re actually doing is isolating the scaling characteristic of our force equation, and measuring how big it is. Mathematically, this means we need to solve for our eigenvalues, λi, when p(λ) = 0:

![](https://cdn-images-1.medium.com/max/800/1*EJwRNzYX_xWuC_4E4Lenyg.png)

You actually know how to find these roots. It’s the one equation you remember from high school: the quadratic equation!

![](https://cdn-images-1.medium.com/max/800/1*GDkVXHsXo1YXGjmma5tH2g.png)

The precise definition of physical stability is simple:

> “If all eigenvalues have negative real parts, the system is stable. If at least one eigenvalue has positive real parts, the system is unstable.” — Eberly

If and only if this is true, then our solution to our system of equations is going to “stick close” to the explicit solution.

This means that we can already see how a physical system might become unstable. If we choose force parameters that, downstream, result in eigenvalues with real parts greater than 0, we cannot guarantee stability of our physics engine.

## Next Steps

This was part one of a three part series deep-diving physics engines in games. For our next article, we’ll explore different numerical methods, how to analyze where they will work and where they don’t, and we’ll even calculate explicitly bad values and see what happens.

Update: [PART TWO IS OUT](https://medium.com/@thegoldenmule/physics-engine-deep-dive-part-ii-cb8d1fda1f9b)!
