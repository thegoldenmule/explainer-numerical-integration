// title.js: the background collage for the title page. Imports nothing.
//
//   export function mount(root, { signal }) → { pause, resume, destroy }
//
// A shuffled queue of gifs; at most MAX_LIVE are on screen at once. Each one is preloaded,
// dropped at a random spot with a random width, and handed to the CSS `title-drift`
// animation (fade in, slow scale up, fade out). When it ends the node is removed and the
// next one is scheduled. Timing is staggered so arrivals never line up.
//
// Nothing loads on mount: the title is mounted at boot for every visitor, including one
// deep-linking to #/7. The collage starts in resume() and pause() clears it, so no gif is
// downloaded or decoded while another panel is on screen.

// Filenames under ./gifs/. Kept as a literal because there is no build step and no
// directory listing to trust. Regenerate from `ls gifs` when the set changes.
const GIFS = [
  'assassins-creed-fly-01.gif',
  'cyberpunk-table-flip-01.gif',
  'gmod-ragdoll-spaz-01.gif',
  'goat-simulator-ragdoll-01.gif',
  'gta-ragdoll-fly-01.gif',
  'gta4-swing-launch-01.gif',
  'gta4-swing-launch-02.gif',
  'gta5-car-sky-launch-01.gif',
  'mass-effect-mako-flip-01.gif',
  'skate3-launch-01.gif',
  'skate3-launch-02.gif',
  'skate3-launch-03.gif',
  'skate3-picnic-table-01.gif',
  'skate3-ragdoll-01.gif',
  'skate3-ragdoll-02.gif',
  'skate3-space-spin-01.gif',
  'skate3-wall-bounce-01.gif',
  'skyrim-carriage-wobble-01.gif',
  'skyrim-dragon-skeleton-spaz-01.gif',
  'skyrim-giant-launch-01.gif',
];

const MAX_LIVE = 4;          // animated GIFs decode continuously; keep the count small
const DURATION = [14, 22];   // seconds on screen, min..max
const STAGGER = [2, 5];      // seconds between spawns, min..max
const WIDTH_VW = [22, 44];   // width as a share of the viewport, min..max
const GROW = [1.08, 1.22];   // end scale, min..max

const GIF_BASE = new URL('./gifs/', import.meta.url);
const rand = (lo, hi) => lo + Math.random() * (hi - lo);

export function mount(root, { signal } = {}) {
  const layer = root.querySelector('.gifs');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Shuffled queue that refills itself; never plays the same gif twice in a row.
  const queue = [];
  let last = null;
  function next() {
    if (queue.length === 0) {
      queue.push(...GIFS);
      for (let i = queue.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [queue[i], queue[j]] = [queue[j], queue[i]];
      }
      if (queue.length > 1 && queue[queue.length - 1] === last) queue.unshift(queue.pop());
    }
    last = queue.pop();
    return last;
  }

  function preload(name) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`gif failed to load: ${name}`));
      img.src = new URL(name, GIF_BASE).href;
    });
  }

  let live = 0;
  let running = false;
  let timer = 0;

  async function spawn() {
    if (!running || GIFS.length === 0) return;
    if (live >= MAX_LIVE) return;
    live++;

    let img;
    try {
      img = await preload(next());
    } catch (err) {
      console.warn(err.message);
      live--;
      schedule();
      return;
    }
    if (!running) { live--; return; }

    // Keep the middle band mostly clear: bias positions toward the edges so the title stays
    // legible even before the wash does its work.
    const edge = Math.random() < 0.5;
    const x = edge ? rand(4, 32) : rand(68, 96);
    const y = rand(8, 92);

    img.alt = '';
    img.style.setProperty('--x', `${x}vw`);
    img.style.setProperty('--y', `${y}vh`);
    img.style.setProperty('--w', `${rand(...WIDTH_VW)}vw`);
    img.style.setProperty('--dur', `${rand(...DURATION)}s`);
    img.style.setProperty('--grow', rand(...GROW).toFixed(3));

    img.addEventListener('animationend', () => {
      img.remove();
      live--;
      schedule();
    }, { once: true });

    layer.append(img);
    schedule();
  }

  function schedule() {
    if (!running || live >= MAX_LIVE) return;
    clearTimeout(timer);
    timer = setTimeout(spawn, rand(...STAGGER) * 1000);
  }

  function start() {
    if (running) return;
    running = true;
    if (!reduced) {
      spawn();   // the first one arrives immediately, the rest stagger in
    } else {
      for (let i = 0; i < Math.min(3, GIFS.length); i++) spawn();   // a few still frames
    }
  }

  function stop() {
    running = false;
    clearTimeout(timer);
    layer.replaceChildren();
    live = 0;
  }

  // The tab going to the background pauses the churn so the queue does not bunch up on
  // return; coming back restarts only if the pane itself is still the one on screen.
  let visible = false;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop(); else if (visible) start();
  }, { signal });

  return {
    resume() { visible = true; start(); },
    pause() { visible = false; stop(); },
    destroy() { visible = false; stop(); },
  };
}
