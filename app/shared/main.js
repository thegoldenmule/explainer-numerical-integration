// Boot: build the 2D grid from the manifest, then let the router drive everything.
//
// The page is a grid. Vertical scroll snaps between panels (rows); horizontal scroll snaps
// within a row between its left pane, spine pane, and right pane. Both directions are real
// scrolling, so touchpads, arrow keys, and rail dots all end up in the same place: a hash
// route that the router applies.

import { manifest, PARTS, panelCount, panelAt } from './manifest.js';
import { store } from './state.js';
import { createRouter } from './router.js';
import { createPaneManager } from './loader.js';
import { el } from './dom.js';

const spine = document.getElementById('spine');
const rail = document.getElementById('rail');
const hrail = document.getElementById('hrail');

const PANES = ['left', 'spine', 'right'];
const KIND = { left: 'Refresher · step down', right: 'Drill-down · step up' };

// ---- rows and cells ----
const rows = new Map();   // index → row element
const cells = new Map();  // "index/pane" → { cell, body }
const key = (index, pane) => `${index}/${pane}`;

for (const entry of manifest) {
  const row = el('section', { class: 'panel', id: `panel-${entry.index}`, 'data-index': entry.index, 'aria-label': entry.title });
  for (const pane of PANES) {
    if (pane !== 'spine' && !entry[pane]) continue;
    const body = el('div', { class: 'pane-body' });
    const meta = pane === 'spine'
      ? el('div', { class: 'pane-meta' }, el('span', {}, PARTS[entry.part]), el('span', {}, `${entry.index} / ${panelCount}`))
      : el('div', { class: 'pane-meta' }, el('span', { class: 'kind' }, KIND[pane]), el('span', {}, `${entry.index}. ${entry.title}`));
    const cell = el('div', { class: `pane pane-${pane}`, 'data-index': entry.index, 'data-pane': pane }, meta, body);
    row.append(cell);
    cells.set(key(entry.index, pane), { cell, body });
  }
  rows.set(entry.index, row);
  spine.append(row);

  rail.append(el('a', {
    href: `#/${entry.index}`, title: `${entry.index}. ${entry.title}`, 'aria-label': `${entry.index}. ${entry.title}`,
    class: entry.index > 1 && panelAt(entry.index - 1).part !== entry.part ? 'part-break' : null,
  }));
}

// ---- horizontal rail: three dots, hidden (but still spaced) where the pane does not exist ----
const hdots = Object.fromEntries(PANES.map(pane => [pane, el('a', { href: '#/1', 'data-pane': pane })]));
hrail.append(...PANES.map(p => hdots[p]));

function updateHrail(index, side) {
  const entry = panelAt(index);
  for (const pane of PANES) {
    const a = hdots[pane];
    const exists = pane === 'spine' || Boolean(entry[pane]);
    a.hidden = !exists;
    a.href = pane === 'spine' ? `#/${index}` : `#/${index}/${pane}`;
    const title = pane === 'spine' ? `${index}. ${entry.title}` : `${KIND[pane]}: ${entry[pane]?.title ?? ''}`;
    a.title = title;
    a.setAttribute('aria-label', title);
    if ((side ?? 'spine') === pane) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
  }
}

// ---- programmatic scrolling, flagged so the observers ignore our own scrolls ----
let navigatingV = false, navigatingH = false;
function settle(target, setFlag) {
  setFlag(true);
  let timer = 0;
  const done = () => { clearTimeout(timer); target.removeEventListener('scrollend', done); setFlag(false); };
  target.addEventListener('scrollend', done);
  timer = setTimeout(done, 800);
}

function scrollToPanel(index, instant) {
  const row = rows.get(index);
  if (Math.abs(spine.scrollTop - row.offsetTop) < 1) return;
  if (!instant) settle(spine, v => { navigatingV = v; });
  spine.scrollTo({ top: row.offsetTop, behavior: instant ? 'instant' : 'smooth' });
}

function alignRow(index, side, instant) {
  const row = rows.get(index);
  const { cell } = cells.get(key(index, side ?? 'spine'));
  // by cell position, not offsetLeft: offsetLeft moves with the row's own scroll offset
  const left = [...row.children].indexOf(cell) * row.clientWidth;
  if (Math.abs(row.scrollLeft - left) < 1) return;
  if (!instant) settle(row, v => { navigatingH = v; });
  row.scrollTo({ left, behavior: instant ? 'instant' : 'smooth' });
}

// every row starts on its spine pane, not its left pane
for (const entry of manifest) alignRow(entry.index, null, true);

// ---- router ----
const panes = createPaneManager({ store, manifest, containerFor: (i, pane) => cells.get(key(i, pane)).body });
let last = null;

function setInert(index, activePane) {
  for (const p of PANES) {
    const c = cells.get(key(index, p));
    if (c) c.cell.inert = activePane != null && p !== activePane;
  }
}

const router = createRouter({
  count: panelCount,
  canOpen: (index, side) => Boolean(panelAt(index)[side]),
  onRoute({ index, side }, source) {
    const entry = panelAt(index);
    document.title = `${index}. ${entry.title}${side ? ` · ${entry[side].title}` : ''} · Why physics engines blow up`;
    for (const a of rail.children) {
      if (a.getAttribute('href') === `#/${index}`) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
    }
    updateHrail(index, side);

    const changedPanel = !last || last.index !== index;
    // leaving a panel whose side pane was open: put that row back on its spine pane
    if (last && changedPanel && last.side) alignRow(last.index, null, true);
    spine.classList.toggle('side-open', Boolean(side));
    if (source !== 'scroll' && source !== 'hscroll') scrollToPanel(index, source === 'initial');
    if (source !== 'hscroll') alignRow(index, side, source === 'initial' || changedPanel);

    // only the visible cell of the current row is reachable by keyboard / screen reader
    if (last && changedPanel) setInert(last.index, null);
    setInert(index, side ?? 'spine');

    panes.activate(index, side);
    last = { index, side };
  },
});

// ---- scroll → route ----
// vertical: which row is on screen (ignored while a side pane is open: the spine is locked)
const verticalObserver = new IntersectionObserver(entries => {
  if (navigatingV || router.current.side) return;
  for (const e of entries) {
    if (e.isIntersecting && e.intersectionRatio >= 0.5) {
      router.go(Number(e.target.dataset.index), null, { replace: true, source: 'scroll' });
    }
  }
}, { root: spine, threshold: 0.5 });
for (const row of rows.values()) verticalObserver.observe(row);

// horizontal: which cell of the current row is on screen (one observer per row)
for (const [index, row] of rows) {
  const observer = new IntersectionObserver(entries => {
    if (navigatingH || router.current.index !== index) return;
    for (const e of entries) {
      if (e.isIntersecting && e.intersectionRatio >= 0.5) {
        const pane = e.target.dataset.pane;
        router.go(index, pane === 'spine' ? null : pane, { replace: true, source: 'hscroll' });
      }
    }
  }, { root: row, threshold: 0.5 });
  for (const cell of row.children) observer.observe(cell);
}

// a resize changes cell widths: re-align every row instantly to the pane it is showing
window.addEventListener('resize', () => {
  const { index, side } = router.current;
  for (const entry of manifest) alignRow(entry.index, entry.index === index ? side : null, true);
  scrollToPanel(index, true);
});

// ---- keyboard ----
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
