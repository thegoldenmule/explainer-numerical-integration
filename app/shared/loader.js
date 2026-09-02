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
 * Keeps the spine warm around the current panel:
 *   mounted:   current ± 1
 *   paused:    everything mounted that is not current
 *   destroyed: anything farther than ± 2 (state lives in the store, so remounting is free)
 */
export function createSpineLoader({ store, manifest, containerFor }) {
  const mounted = new Map(); // index → Promise<handle>

  function ensure(index) {
    if (index < 1 || index > manifest.length || mounted.has(index)) return;
    mounted.set(index, mountPane({ store, entry: manifest[index - 1], pane: 'spine', container: containerFor(index) }));
  }

  async function activate(current) {
    for (const i of [current, current + 1, current - 1]) ensure(i);
    for (const [i, p] of mounted) {
      if (Math.abs(i - current) > 2) { mounted.delete(i); p.then(h => h.destroy()); }
      else p.then(h => (i === current ? h.resume() : h.pause()));
    }
  }

  return { activate, ensure };
}
