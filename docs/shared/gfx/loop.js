// A requestAnimationFrame loop with pause/resume. One per mounted pane; the loader pauses it
// when the pane is off-screen so hidden panels cost nothing.

export function createLoop() {
  const callbacks = new Set();
  let raf = 0, last = 0, running = false, paused = false, elapsed = 0;

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.1); // clamp after a tab switch
    last = now;
    elapsed += dt;
    for (const cb of callbacks) cb(dt, elapsed);
  }
  function start() {
    if (running || paused || callbacks.size === 0) return;
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }

  return {
    /** onFrame(cb(dt, elapsed)) → off() */
    onFrame(cb) {
      callbacks.add(cb);
      start();
      return () => { callbacks.delete(cb); if (callbacks.size === 0) stop(); };
    },
    pause() { paused = true; stop(); },
    resume() { paused = false; start(); },
    stop() { callbacks.clear(); stop(); },
    get running() { return running; },
    get elapsed() { return elapsed; },
  };
}
