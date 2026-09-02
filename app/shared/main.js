// Boot: build the 2D grid from the manifest, then let the router drive everything.
//
// The page is a grid. Vertical scroll snaps between panels (rows); horizontal scroll snaps
// within a row between its panes: an optional left pane, the spine pane, and an optional
// right chain (one pane, or panel 12's three in a row). Both directions are real scrolling,
// so touchpads, arrow keys, and rail dots all end up in the same place: a hash route that
// the router applies.

import { manifest, PARTS, panelCount, panelAt } from './manifest.js';
import { store } from './state.js';
import { createRouter } from './router.js';
import { createPaneManager, paneFileId } from './loader.js';
import { el } from './dom.js';

const spine = document.getElementById('spine');
const rail = document.getElementById('rail');
const hrail = document.getElementById('hrail');

const KIND = { left: 'Refresher · step down', right: 'Drill-down · step up' };

// Ordered list of panes for one manifest entry: an optional left, always spine, then the
// right chain in order. Each item carries `id` (the file basename / cell key), `pane` (the
// base side), `depth`, and `title`.
function paneList(entry) {
  const list = [];
  if (entry.left) list.push({ id: 'left', pane: 'left', depth: 1, title: entry.left.title });
  list.push({ id: 'spine', pane: 'spine', depth: 1, title: entry.title });
  (entry.right ?? []).forEach((r, i) => {
    const depth = i + 1;
    list.push({ id: paneFileId('right', depth), pane: 'right', depth, title: r.title });
  });
  return list;
}

// ---- rows and cells ----
const rows = new Map();   // index → row element
const cells = new Map();  // "index/id" → { cell, body, pane, depth }
const key = (index, id) => `${index}/${id}`;

for (const entry of manifest) {
  const row = el('section', { class: 'panel', id: `panel-${entry.index}`, 'data-index': entry.index, 'aria-label': entry.title });
  for (const p of paneList(entry)) {
    const body = el('div', { class: 'pane-body' });
    const meta = p.pane === 'spine'
      ? el('div', { class: 'pane-meta' }, el('span', {}, PARTS[entry.part]), el('span', {}, `${entry.index} / ${panelCount}`))
      : el('div', { class: 'pane-meta' }, el('span', { class: 'kind' }, KIND[p.pane]), el('span', {}, `${entry.index}. ${entry.title}`));
    const cell = el('div', {
      class: `pane pane-${p.pane}`, 'data-index': entry.index, 'data-pane': p.pane, 'data-depth': p.depth,
    }, meta, body);
    row.append(cell);
    cells.set(key(entry.index, p.id), { cell, body, pane: p.pane, depth: p.depth });
  }
  rows.set(entry.index, row);
  spine.append(row);

  rail.append(el('a', {
    href: `#/${entry.index}`, title: `${entry.index}. ${entry.title}`, 'aria-label': `${entry.index}. ${entry.title}`,
    class: entry.index > 1 && panelAt(entry.index - 1).part !== entry.part ? 'part-break' : null,
  }));
}

// ---- horizontal rail: one dot per pane of the current panel, rebuilt on every route ----
function updateHrail(index, side, depth) {
  const entry = panelAt(index);
  const activeId = side ? paneFileId(side, depth) : 'spine';
  hrail.replaceChildren(...paneList(entry).map(p => {
    const href = p.pane === 'spine' ? `#/${index}` : `#/${index}/${p.pane}${p.depth > 1 ? '/' + p.depth : ''}`;
    const title = p.pane === 'spine' ? `${index}. ${entry.title}` : `${KIND[p.pane]}: ${p.title}`;
    const a = el('a', { href, title, 'aria-label': title, 'data-pane': p.id });
    if (p.id === activeId) a.setAttribute('aria-current', 'true');
    return a;
  }));
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

function alignRow(index, side, depth, instant) {
  const row = rows.get(index);
  const id = side ? paneFileId(side, depth) : 'spine';
  const { cell } = cells.get(key(index, id));
  // by cell position, not offsetLeft: offsetLeft moves with the row's own scroll offset
  const left = [...row.children].indexOf(cell) * row.clientWidth;
  if (Math.abs(row.scrollLeft - left) < 1) return;
  if (!instant) settle(row, v => { navigatingH = v; });
  row.scrollTo({ left, behavior: instant ? 'instant' : 'smooth' });
}

// every row starts on its spine pane, not its left pane
for (const entry of manifest) alignRow(entry.index, null, 1, true);

// ---- router ----
const panes = createPaneManager({ store, manifest, containerFor: (i, pane, depth) => cells.get(key(i, paneFileId(pane, depth))).body });
let last = null;

function setInert(index, activeId) {
  const row = rows.get(index);
  for (const cell of row.children) {
    const id = paneFileId(cell.dataset.pane, Number(cell.dataset.depth));
    cell.inert = activeId != null && id !== activeId;
  }
}

const router = createRouter({
  count: panelCount,
  canOpen: (index, side, depth) => {
    const entry = panelAt(index);
    if (side === 'left') return depth === 1 && Boolean(entry.left);
    if (side === 'right') return Array.isArray(entry.right) && depth >= 1 && depth <= entry.right.length;
    return false;
  },
  onRoute({ index, side, depth }, source) {
    const entry = panelAt(index);
    const sideTitle = side ? (side === 'left' ? entry.left.title : entry.right[depth - 1].title) : null;
    document.title = `${index}. ${entry.title}${sideTitle ? ` · ${sideTitle}` : ''} · Why physics engines blow up`;
    for (const a of rail.children) {
      if (a.getAttribute('href') === `#/${index}`) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
    }
    updateHrail(index, side, depth);

    const changedPanel = !last || last.index !== index;
    // leaving a panel whose side pane was open: put that row back on its spine pane
    if (last && changedPanel && last.side) alignRow(last.index, null, 1, true);
    spine.classList.toggle('side-open', Boolean(side));
    if (source !== 'scroll' && source !== 'hscroll') scrollToPanel(index, source === 'initial');
    if (source !== 'hscroll') alignRow(index, side, depth, source === 'initial' || changedPanel);

    // only the visible cell of the current row is reachable by keyboard / screen reader
    if (last && changedPanel) setInert(last.index, null);
    setInert(index, side ? paneFileId(side, depth) : 'spine');

    panes.activate(index, side, depth);
    last = { index, side, depth };
  },
});

// ---- scroll → route ----
// vertical: which row is on screen (ignored while a side pane is open: the spine is locked)
const verticalObserver = new IntersectionObserver(entries => {
  if (navigatingV || router.current.side) return;
  for (const e of entries) {
    if (e.isIntersecting && e.intersectionRatio >= 0.5) {
      router.go(Number(e.target.dataset.index), null, 1, { replace: true, source: 'scroll' });
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
        const depth = Number(e.target.dataset.depth) || 1;
        router.go(index, pane === 'spine' ? null : pane, depth, { replace: true, source: 'hscroll' });
      }
    }
  }, { root: row, threshold: 0.5 });
  for (const cell of row.children) observer.observe(cell);
}

// a resize changes cell widths: re-align every row instantly to the pane it is showing
window.addEventListener('resize', () => {
  const { index, side, depth } = router.current;
  for (const entry of manifest) {
    alignRow(entry.index, entry.index === index ? side : null, entry.index === index ? depth : 1, true);
  }
  scrollToPanel(index, true);
});

// ---- keyboard ----
window.addEventListener('keydown', e => {
  if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
  const tag = e.target?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target?.isContentEditable) return;
  const { index, side, depth } = router.current;
  const entry = panelAt(index);
  const rightLen = Array.isArray(entry.right) ? entry.right.length : 0;
  if (e.key === 'Escape' && side) { router.back(); e.preventDefault(); }
  else if (e.key === 'ArrowLeft') {
    if (side === 'right' && depth > 1) router.go(index, 'right', depth - 1);
    else if (side === 'right') router.back();
    else if (!side && entry.left) router.go(index, 'left');
    e.preventDefault();
  } else if (e.key === 'ArrowRight') {
    if (side === 'left') router.back();
    else if (side === 'right' && depth < rightLen) router.go(index, 'right', depth + 1);
    else if (!side && rightLen > 0) router.go(index, 'right', 1);
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
