// Play / pause, reset, and single-step buttons bound to a player, plus optional speed
// buttons. Labels follow the player's state through onChange.

import { el } from '../dom.js';

/** transport(player, { signal, speeds = null }) → element */
export function transport(player, { signal, speeds = null } = {}) {
  const play = el('button', { class: 'btn', type: 'button', onclick: () => player.toggle() });
  const reset = el('button', { class: 'btn', type: 'button', onclick: () => player.reset() }, 'Reset');
  const step = el('button', { class: 'btn', type: 'button', onclick: () => player.step(), title: 'Advance one step of h' }, 'Step');
  const speedBtns = (speeds ?? []).map(s => el('button', {
    class: 'btn', type: 'button', 'data-speed': s, onclick: () => { player.speed = s; sync(); },
  }, `${s}×`));

  function sync() {
    const label = player.playing ? 'Pause' : player.ended ? 'Replay' : 'Play';
    if (play.textContent !== label) play.textContent = label;
    play.setAttribute('aria-pressed', String(player.playing));
    for (const b of speedBtns) b.setAttribute('aria-pressed', String(Number(b.dataset.speed) === player.speed));
  }
  sync();
  const off = player.onChange(sync);
  signal?.addEventListener('abort', off, { once: true });

  return el('div', { class: 'transport' },
    el('span', { class: 'transport-group' }, play, step, reset),
    speedBtns.length ? el('span', { class: 'transport-group' }, speedBtns) : null);
}

/**
 * stepPlayer({ loop, h, step, reset, ended, signal, maxStepsPerFrame = 200 }) → player-shaped object
 *
 * For a pane that integrates something of its own rather than the tuple — panel 2's 2D body
 * (spine) and its rotation (right), and 9 left's geometric sequence — the same verbs
 * `transport()` drives on the real player, so the pane gets the shared Play/Pause, Step,
 * Reset instead of a hand-built copy. While playing, `step()` runs at wall-clock rate, `h()`
 * seconds of time per call, at most `maxStepsPerFrame` per frame; the frame callback is
 * registered only while playing, so an idle pane asks for no animation frames.
 *
 * `ended()` (optional; never, by default) says the run has nowhere left to go. The player
 * pauses itself on reaching it, `ended` reads true so the transport shows Replay, and Play or
 * Step from there resets first, as the real player restarts. onChange(fn) fires on play,
 * pause, step, reset, and changed() (a pane that moves its run by other means calls it).
 */
export function stepPlayer({ loop, h, step, reset, ended = () => false, signal, maxStepsPerFrame = 200 }) {
  let playing = false, carry = 0, offFrame = null;
  const listeners = new Set();
  const emit = () => { for (const fn of listeners) fn(); };
  const frame = dt => {
    carry += dt;
    const dh = h();
    let n = Math.min(Math.floor(carry / dh), maxStepsPerFrame);
    carry -= n * dh;
    while (n-- > 0 && playing) {
      step();
      if (ended()) player.pause();
    }
  };
  const stopFrames = () => { offFrame?.(); offFrame = null; };
  signal?.addEventListener('abort', () => { stopFrames(); playing = false; listeners.clear(); }, { once: true });
  const player = {
    get playing() { return playing; },
    get ended() { return !playing && Boolean(ended()); },
    speed: 1,
    play() {
      if (playing || signal?.aborted) return;
      if (ended()) reset();
      playing = true; carry = 0;
      offFrame = loop.onFrame(frame);
      emit();
    },
    pause() { if (!playing) return; playing = false; carry = 0; stopFrames(); emit(); },
    toggle() { if (playing) player.pause(); else player.play(); },
    step() {
      if (ended()) reset();
      step();
      if (playing && ended()) { player.pause(); return; }
      emit();
    },
    reset() { reset(); emit(); },
    /** The pane moved its run itself (not through these verbs): let the transport re-read. */
    changed() { emit(); },
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };
  return player;
}
