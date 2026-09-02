// Lazy loading of panes. A pane is one directory entry `panels/<slug>/<pane>.js` plus its
// prose `panels/<slug>/<pane>.html`. Both are fetched the first time the pane is shown.
//
// The module contract (see docs/plan.md):
//   export function mount(root, ctx) → { pause?, resume?, destroy }
//   ctx = { store, panel, pane, index, loop, signal }

import { el, fragment } from './dom.js';
import { createLoop } from './gfx/loop.js';

const proseCache = new Map();

function fetchProse(url) {
  if (!proseCache.has(url)) {
    proseCache.set(url, fetch(url).then(r => {
      if (!r.ok) throw new Error(`${r.status} ${r.statusText} for ${url}`);
      return r.text();
    }).catch(err => { proseCache.delete(url); throw err; }));
  }
  return proseCache.get(url);
}

function missing(entry, pane, err) {
  return el('div', { class: 'pane-missing' },
    el('p', {}, el('strong', {}, `${entry.title}`), ` · ${pane} pane is not built yet.`),
    el('p', {}, 'Expected ', el('code', {}, `panels/${entry.slug}/${pane}.js`), ' and ',
      el('code', {}, `panels/${entry.slug}/${pane}.html`), '.'),
    el('p', { class: 'muted' }, String(err?.message ?? err)));
}

/**
 * Mount one pane into a container. Resolves to a handle { pause, resume, destroy }.
 * Never rejects: a pane that fails to load renders a placeholder and warns in the console.
 */
export async function mountPane({ store, entry, pane, container }) {
  const base = `panels/${entry.slug}/${pane}`;
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
    const ctx = { store, panel: entry, pane, index: entry.index, loop, signal: abort.signal };
    instance = (await mod.mount?.(viz, ctx)) ?? {};
  } catch (err) {
    console.warn(`[loader] ${base}:`, err);
    container.classList.remove('loading');
    container.replaceChildren(missing(entry, pane, err));
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
 *   mounted:   the spine panes of current ± 1, and the current panel's side panes
 *   resumed:   the one pane on screen
 *   paused:    everything else that is mounted
 *   destroyed: spine panes farther than ± 2, side panes of other panels
 * State lives in the store, so remounting a pane is free.
 */
export function createPaneManager({ store, manifest, containerFor }) {
  const mounted = new Map(); // "index/pane" → Promise<handle>
  const key = (index, pane) => `${index}/${pane}`;

  function ensure(index, pane) {
    if (index < 1 || index > manifest.length) return;
    const entry = manifest[index - 1];
    if (pane !== 'spine' && !entry[pane]) return;
    const k = key(index, pane);
    if (mounted.has(k)) return;
    mounted.set(k, mountPane({ store, entry, pane, container: containerFor(index, pane) }));
  }

  function activate(index, side = null) {
    ensure(index, 'spine'); ensure(index + 1, 'spine'); ensure(index - 1, 'spine');
    ensure(index, 'left'); ensure(index, 'right');
    const active = key(index, side ?? 'spine');
    for (const [k, p] of mounted) {
      const [i, pane] = k.split('/');
      const far = pane === 'spine' ? Math.abs(i - index) > 2 : Number(i) !== index;
      if (far) { mounted.delete(k); p.then(h => h.destroy()); }
      else p.then(h => (k === active ? h.resume() : h.pause()));
    }
  }

  return { activate, ensure };
}
