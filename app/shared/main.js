// Boot: build the shell from the manifest, then let the router drive everything.

import { manifest, PARTS, panelCount, panelAt } from './manifest.js';
import { store } from './state.js';
import { createRouter } from './router.js';
import { createSpineLoader, mountPane } from './loader.js';
import { el } from './dom.js';

const spine = document.getElementById('spine');
const rail = document.getElementById('rail');
const paneEl = document.getElementById('pane');

// ---- spine sections and rail dots ----
const bodies = new Map();
for (const entry of manifest) {
  const body = el('div', { class: 'pane-body' });
  bodies.set(entry.index, body);
  const nav = el('nav', { class: 'panel-nav', 'aria-label': 'Sideways' },
    entry.left
      ? el('a', { href: `#/${entry.index}/left` }, '← Refresher: ', el('b', {}, entry.left.title))
      : el('span', { class: 'spacer' }),
    entry.right
      ? el('a', { href: `#/${entry.index}/right` }, 'Drill-down: ', el('b', {}, entry.right.title), ' →')
      : el('span', { class: 'spacer' }));
  spine.append(el('section', {
    class: 'panel', id: `panel-${entry.index}`, 'data-index': entry.index, 'aria-label': entry.title,
  },
    el('div', { class: 'panel-meta' }, el('span', {}, PARTS[entry.part]), el('span', {}, `${entry.index} / ${panelCount}`)),
    body,
    nav));

  rail.append(el('a', {
    href: `#/${entry.index}`, title: `${entry.index}. ${entry.title}`, 'aria-label': `${entry.index}. ${entry.title}`,
    class: entry.index > 1 && panelAt(entry.index - 1).part !== entry.part ? 'part-break' : null,
  }));
}

// ---- side pane overlay ----
const paneBody = el('div', { class: 'pane-body' });
const paneKind = el('span');
const paneTitle = el('span');
const backBtn = el('button', { class: 'back', type: 'button' });
paneEl.append(el('div', { class: 'pane-header' }, backBtn, paneKind, paneTitle), paneBody);

let sideHandle = null;
async function openSide(entry, side) {
  const meta = entry[side];
  paneKind.textContent = side === 'left' ? 'Refresher · step down' : 'Drill-down · step up';
  paneTitle.textContent = meta.title;
  backBtn.textContent = `${side === 'left' ? '→' : '←'} Back to ${entry.index}. ${entry.title}`;
  paneEl.dataset.side = side;
  paneEl.setAttribute('aria-hidden', 'false');
  spine.inert = true;
  rail.inert = true;
  paneEl.classList.add('open');
  const previous = sideHandle;
  sideHandle = mountPane({ store, entry, pane: side, container: paneBody });
  previous?.then(h => h.destroy());
  backBtn.focus();
}
function closeSide() {
  if (!paneEl.classList.contains('open')) return;
  paneEl.classList.remove('open');
  paneEl.setAttribute('aria-hidden', 'true');
  spine.inert = false;
  rail.inert = false;
  sideHandle?.then(h => h.destroy());
  sideHandle = null;
}

// ---- router ----
const loader = createSpineLoader({ store, manifest, containerFor: i => bodies.get(i) });
let navigating = false;
let navTimer = 0;

function scrollToPanel(index, instant) {
  const target = document.getElementById(`panel-${index}`);
  navigating = true;
  clearTimeout(navTimer);
  const done = () => { navigating = false; spine.removeEventListener('scrollend', done); };
  spine.addEventListener('scrollend', done);
  navTimer = setTimeout(done, 800);
  target.scrollIntoView({ behavior: instant ? 'instant' : 'smooth', block: 'start' });
}

const router = createRouter({
  count: panelCount,
  canOpen: (index, side) => Boolean(panelAt(index)[side]),
  onRoute({ index, side }, source) {
    const entry = panelAt(index);
    document.title = `${index}. ${entry.title} · Why physics engines blow up`;
    for (const a of rail.children) {
      if (a.getAttribute('href') === `#/${index}`) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    }
    if (source !== 'scroll') scrollToPanel(index, source === 'initial');
    loader.activate(index);
    if (side) openSide(entry, side); else closeSide();
  },
});

// ---- scroll → route ----
const observer = new IntersectionObserver(entries => {
  if (navigating || router.current.side) return; // a resize with a pane open must not change panel
  for (const e of entries) {
    if (e.isIntersecting && e.intersectionRatio >= 0.5) {
      router.go(Number(e.target.dataset.index), null, { replace: true, source: 'scroll' });
    }
  }
}, { root: spine, threshold: 0.5 });
for (const section of spine.children) observer.observe(section);

// ---- keyboard ----
backBtn.addEventListener('click', () => router.back());
window.addEventListener('keydown', e => {
  if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
  const tag = e.target?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target?.isContentEditable) return;
  const { index, side } = router.current;
  const entry = panelAt(index);
  if (e.key === 'Escape' && side) { router.back(); e.preventDefault(); }
  else if (e.key === 'ArrowLeft') {
    if (side === 'right') router.back();
    else if (!side && entry.left) router.go(index, 'left');
    e.preventDefault();
  } else if (e.key === 'ArrowRight') {
    if (side === 'left') router.back();
    else if (!side && entry.right) router.go(index, 'right');
    e.preventDefault();
  } else if (!side && (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === 'j')) {
    router.go(index + 1); e.preventDefault();
  } else if (!side && (e.key === 'ArrowUp' || e.key === 'PageUp' || e.key === 'k')) {
    router.go(index - 1); e.preventDefault();
  }
});

router.start();

// Handy in devtools: window.app.store.set({ h: 0.2 })
window.app = { store, router, manifest };
