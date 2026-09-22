// guide.js: the diagram on the unnumbered guide row (#/guide).
//
//   export function mount(root, { signal }) → { pause, resume, destroy }
//
// The page explains the grid by drawing it. The middle column is a schematic of the spine —
// nodes, not pages: a column of steps, some with a lighter node out to the left and one to
// three deeper nodes out to the right. It is deliberately wordless and deliberately not the
// real outline, because the reader has not met the outline yet; the shape is the whole point.
//
// A token walks a short tour of the three moves — left to the surface, right into a dive,
// down to the next step — lighting the aside that explains whichever one it is making. The
// diagram carries no words of its own: the two asides are the caption.

import { manifest, panelCount } from 'shared/manifest.js';

// ---- geometry, in viewBox units ----
// A node is a landscape rectangle because that is what it stands for: one full viewport.
const CW = 22, CH = 14;      // node
const CGAP = 10, RGAP = 8;   // between columns, between rows
const COLP = CW + CGAP, ROWP = CH + RGAP;
const xAt = col => (col + 1) * COLP;   // col: -1 surface, 0 spine, 1..3 dive
const MAP_W = xAt(3) + CW;
const PAD = { top: 4, right: 6, bottom: 4, left: 24 };   // left margin carries the spine arrow

// The fake outline: one entry per row, saying which side nodes that row has. Shaped like the
// real thing — most rows have a dive, many have a surface, one goes three deep, and the two
// ends have neither — without claiming to be it.
const SHAPE = [
  { left: false, right: 0 },
  { left: false, right: 1 },
  { left: true,  right: 1 },
  { left: true,  right: 1 },
  { left: true,  right: 3 },
  { left: false, right: 1 },
  { left: true,  right: 1 },
  { left: false, right: 0 },
];
const TOUR_ROW = 3;   // the row the tour works from: it has both a surface and a dive

const SVG = 'http://www.w3.org/2000/svg';
const node = (name, attrs = {}, ...kids) => {
  const n = document.createElementNS(SVG, name);
  for (const [k, v] of Object.entries(attrs)) if (v != null) n.setAttribute(k, v);
  n.append(...kids);
  return n;
};

const spot = (row, col) => `${row}:${col}`;

// The tour, as squares of the diagram plus how long to sit on each. A side node lights the
// aside that explains it; the spine holds the pause between moves, with neither lit.
const TOUR = [
  { row: 1, col: 0, hold: 1500 },
  { row: 2, col: 0, hold: 1500 },
  { row: 3, col: 0, hold: 1600 },
  { row: 3, col: -1, hold: 2800 },
  { row: 3, col: 0, hold: 1700 },
  { row: 3, col: 1, hold: 2800 },
  { row: 3, col: 0, hold: 1500 },
  { row: 4, col: 0, hold: 1500 },
  { row: 4, col: 1, hold: 1300 },
  { row: 4, col: 2, hold: 1300 },
  { row: 4, col: 3, hold: 2200 },
  { row: 4, col: 0, hold: 1500 },
  { row: 5, col: 0, hold: 1500 },
];

export function mount(root, { signal } = {}) {
  const host = root.querySelector('.map');
  const asides = {
    surface: root.querySelector('.axis.surface'),
    dive: root.querySelector('.axis.dive'),
  };

  const H = SHAPE.length * ROWP - RGAP;
  const svg = node('svg', {
    viewBox: `${-PAD.left} ${-PAD.top} ${MAP_W + PAD.left + PAD.right} ${H + PAD.top + PAD.bottom}`,
    'aria-hidden': 'true',
  });

  // the vertical axis, drawn in the left margin: one arrow the length of the column
  svg.append(
    node('path', { class: 'down', d: `M -8 3 V ${H - 5} m -2.5 -4 l 2.5 4 l 2.5 -4` }),
    node('text', { class: 'down-label', transform: `rotate(-90 -15 ${H / 2})`, x: -15, y: H / 2, 'text-anchor': 'middle' },
      'the spine'),
  );

  // the ribbon the spine nodes sit on, so the middle column reads as one thread
  svg.append(node('line', {
    class: 'thread', x1: xAt(0) + CW / 2, y1: CH / 2, x2: xAt(0) + CW / 2, y2: H - CH / 2,
  }));

  const cells = new Map();
  SHAPE.forEach((shape, r) => {
    const y = r * ROWP;
    const put = (col, cls) => {
      const x = xAt(col);
      const cell = node('rect', {
        class: `cell ${cls}`, x, y, width: CW, height: CH, rx: 2.5,
        'data-row': r, 'data-col': col,
      });
      svg.append(cell);
      cells.set(spot(r, col), { cell, cx: x + CW / 2, cy: y + CH / 2 });
    };
    const tie = (x1, x2) => svg.append(node('line', { class: 'tie', x1, y1: y + CH / 2, x2, y2: y + CH / 2 }));

    if (shape.left) { put(-1, 'surface'); tie(xAt(-1) + CW, xAt(0)); }
    put(0, 'spine');
    for (let d = 1; d <= shape.right; d++) { put(d, `dive d${d}`); tie(xAt(d) - CGAP, xAt(d)); }
  });

  // the reader: one node of the diagram is where you are standing
  const token = node('g', { class: 'token' },
    node('circle', { class: 'halo', r: 3.6 }),
    node('circle', { r: 2.1 }));
  svg.append(token);
  host.replaceChildren(svg);

  // ---- the two counts: real facts about the real outline, read off the manifest ----
  const withLeft = manifest.filter(e => e.left).length;
  const dives = manifest.reduce((n, e) => n + (e.right?.length ?? 0), 0);
  root.querySelector('[data-count="left"]').textContent = `${withLeft} of the ${panelCount} steps have one`;
  root.querySelector('[data-count="right"]').textContent = `${dives} in all, and one of them goes three deep`;

  let current = null;
  function show({ row, col }) {
    const at = cells.get(spot(row, col));
    if (!at) return;
    if (current) current.cell.classList.remove('on');
    current = at;
    at.cell.classList.add('on');
    token.style.transform = `translate(${at.cx}px, ${at.cy}px)`;
    // which column you are standing in is the whole message: the asides are the caption
    const lit = col < 0 ? 'surface' : col > 0 ? 'dive' : null;
    for (const [name, aside] of Object.entries(asides)) aside.classList.toggle('lit', name === lit);
  }

  // ---- the tour ----
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  let timer = 0, step = 0;

  function tick() {
    const s = TOUR[step % TOUR.length];
    step++;
    show(s);
    timer = setTimeout(tick, s.hold);
  }
  function stopTour() { clearTimeout(timer); timer = 0; }
  function startTour() {
    if (timer || still.matches) return;
    timer = setTimeout(tick, 500);
  }

  // Hovering takes the wheel: the tour stops and the selection follows you around the shape.
  // A node stands for no page in particular, so there is nothing to click through to; moving
  // the selection yourself, and watching which aside lights up, is the whole interaction.
  svg.addEventListener('pointerover', e => {
    const cell = e.target.closest?.('.cell');
    if (!cell) return;
    stopTour();
    show({ row: Number(cell.dataset.row), col: Number(cell.dataset.col) });
  }, { signal });
  svg.addEventListener('pointerleave', () => startTour(), { signal });

  show({ row: TOUR_ROW, col: 0 });

  return {
    pause: stopTour,
    resume() { step = 0; startTour(); },
    destroy() { stopTour(); host.replaceChildren(); },
  };
}
