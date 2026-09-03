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
