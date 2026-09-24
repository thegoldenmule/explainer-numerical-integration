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
 * stepPlayer({ loop, h, step, reset, signal, maxStepsPerFrame = 200 }) → player-shaped object
 *
 * For a pane that integrates something of its own rather than the tuple (panel 2's 2D body,
 * its rotation): the same verbs `transport()` drives on the real player, so the pane gets the
 * shared Play/Pause, Step, Reset instead of a hand-built copy. While playing, `step()` runs
 * at wall-clock rate, `h()` seconds of time per call, at most `maxStepsPerFrame` per frame.
 * It never ends, and has no speed of its own. onChange(fn) fires on play, pause, step and reset.
 */
export function stepPlayer({ loop, h, step, reset, signal, maxStepsPerFrame = 200 }) {
  let playing = false, carry = 0;
  const listeners = new Set();
  const emit = () => { for (const fn of listeners) fn(); };
  const offFrame = loop.onFrame(dt => {
    if (!playing) return;
    carry += dt;
    const dh = h();
    let n = Math.min(Math.floor(carry / dh), maxStepsPerFrame);
    carry -= n * dh;
    while (n-- > 0) step();
  });
  signal?.addEventListener('abort', () => { offFrame(); listeners.clear(); }, { once: true });
  const player = {
    get playing() { return playing; },
    ended: false,
    speed: 1,
    play() { if (playing) return; playing = true; carry = 0; emit(); },
    pause() { if (!playing) return; playing = false; carry = 0; emit(); },
    toggle() { if (playing) player.pause(); else player.play(); },
    step() { step(); emit(); },
    reset() { reset(); emit(); },
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };
  return player;
}
