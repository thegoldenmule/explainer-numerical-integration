# Why physics engines blow up

An interactive, in-browser explainer of physical and numerical stability: a damped
mass-spring, three integrators, and one complex plane, where you drag the system's
eigenvalues across the stability boundary and watch the spring go from decaying to ringing
to exploding. No build step, no dependencies; the concept is in `docs/idea.md` and the
application plan in `docs/plan.md`.

## Quickstart

```
cd app
python3 -m http.server 8765 --bind 127.0.0.1   # any static server; file:// will not work
open http://127.0.0.1:8765/
```
