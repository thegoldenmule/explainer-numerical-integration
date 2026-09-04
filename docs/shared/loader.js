// Lazy loading of panes. A pane is one directory entry `panels/<slug>/<pane>.js` plus its
// prose `panels/<slug>/<pane>.html`. Both are fetched the first time the pane is shown.
//
// A pane is identified by `(side, depth)`: `side` is 'spine' | 'left' | 'right', `depth` is
// always 1 except along panel 12's right chain, where depth 2 and 3 reach `right-2` and
// `right-3`. `paneFileId` turns that pair into the file basename and the pane-manager key.
//
// The module contract (see design/plan.md):
//   export function mount(root, ctx) → { pause?, resume?, destroy }
//   ctx = { store, panel, pane, depth, index, loop, signal }
//     pane is the base side ('spine' | 'left' | 'right'); depth is 1, or 2/3 along the
//     right chain.

import { el, fragment } from './dom.js';
import { createLoop } from './gfx/loop.js';
import { fitPane } from './ui/fit.js';

const proseCache = new Map();

export function paneFileId(pane, depth = 1) {
  return pane === 'spine' || depth <= 1 ? pane : `${pane}-${depth}`;
}

function chainLength(entry, side) {
  return Array.isArray(entry?.[side]) ? entry[side].length : 0;
}

function paneExists(entry, side, depth) {
  if (side === 'spine') return true;
  if (side === 'left') return depth === 1 && Boolean(entry.left);
  return depth >= 1 && depth <= chainLength(entry, side);
}

function fetchProse(url) {
  if (!proseCache.has(url)) {
    proseCache.set(url, fetch(url).then(r => {
      if (!r.ok) throw new Error(`${r.status} ${r.statusText} for ${url}`);
      return r.text();
    }).catch(err => { proseCache.delete(url); throw err; }));
  }
  return proseCache.get(url);
}

function missing(entry, fileId, err) {
  return el('div', { class: 'pane-missing' },
    el('p', {}, el('strong', {}, `${entry.title}`), ` · ${fileId} pane is not built yet.`),
    el('p', {}, 'Expected ', el('code', {}, `panels/${entry.slug}/${fileId}.js`), ' and ',
      el('code', {}, `panels/${entry.slug}/${fileId}.html`), '.'),
    el('p', { class: 'muted' }, String(err?.message ?? err)));
}

/**
 * Mount one pane into a container. Resolves to a handle { pause, resume, destroy }.
 * Never rejects: a pane that fails to load renders a placeholder and warns in the console.
 */
export async function mountPane({ store, entry, pane, depth = 1, container }) {
  const fileId = paneFileId(pane, depth);
  const base = `panels/${entry.slug}/${fileId}`;
  const abort = new AbortController();
  const loop = createLoop();
  let instance = null;
  let destroyed = false;

  container.replaceChildren();
  container.classList.add('loading');
  try {
    const [mod, html] = await Promise.all([
      import(`${base}.js`),
      fetchProse(import.meta.resolve(`${base}.html`)),
    ]);
    if (destroyed) return noop;
    container.classList.remove('loading');
    container.replaceChildren(fragment(html));
    let viz = container.querySelector('.viz');
    if (!viz) { viz = el('div', { class: 'viz' }); (container.querySelector('article') ?? container).append(viz); }
    const ctx = { store, panel: entry, pane, depth, index: entry.index, loop, signal: abort.signal };
    instance = (await mod.mount?.(viz, ctx)) ?? {};
    // the pane is built: measure what it actually asks for and scale its stages to the room
    fitPane(container, abort.signal);
  } catch (err) {
    console.warn(`[loader] ${base}:`, err);
    container.classList.remove('loading');
    container.replaceChildren(missing(entry, fileId, err));
  }

  return {
    pause() { loop.pause(); instance?.pause?.(); },
    resume() { loop.resume(); instance?.resume?.(); },
    destroy() {
      destroyed = true;
      abort.abort();
      loop.stop();
      instance?.destroy?.();
      instance = null;
      container.replaceChildren();
    },
  };
}

const noop = { pause() {}, resume() {}, destroy() {} };

/**
 * Keeps the grid warm around the current position.
 *   mounted:   the spine panes of current ± 1, and the current panel's left pane and full
 *              right chain
 *   resumed:   the one pane on screen
 *   paused:    everything else that is mounted
 *   destroyed: spine panes farther than ± 2, panes of other panels
 * State lives in the store, so remounting a pane is free.
 */
export function createPaneManager({ store, manifest, containerFor }) {
  const mounted = new Map(); // "index/pane/depth" → Promise<handle>
  const key = (index, pane, depth = 1) => `${index}/${pane}/${depth}`;

  function ensure(index, pane, depth = 1) {
    if (index < 1 || index > manifest.length) return;
    const entry = manifest[index - 1];
    if (!paneExists(entry, pane, depth)) return;
    const k = key(index, pane, depth);
    if (mounted.has(k)) return;
    mounted.set(k, mountPane({ store, entry, pane, depth, container: containerFor(index, pane, depth) }));
  }

  function activate(index, side = null, depth = 1) {
    ensure(index, 'spine'); ensure(index + 1, 'spine'); ensure(index - 1, 'spine');
    ensure(index, 'left');
    const entry = manifest[index - 1];
    for (let d = 1; d <= chainLength(entry, 'right'); d++) ensure(index, 'right', d);

    const active = key(index, side ?? 'spine', side ? depth : 1);
    for (const [k, p] of mounted) {
      const [i, pane, d] = k.split('/');
      const far = pane === 'spine' ? Math.abs(i - index) > 2 : Number(i) !== index;
      if (far) { mounted.delete(k); p.then(h => h.destroy()); }
      else p.then(h => (k === active ? h.resume() : h.pause()));
    }
  }

  return { activate, ensure };
}
