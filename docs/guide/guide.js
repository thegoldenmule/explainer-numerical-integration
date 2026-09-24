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

// ---- geometry, in viewBox units ----
// A node is a landscape rectangle because that is what it stands for: one full viewport. The
// spine's are wider than the side ones, so the middle column reads as the trunk the thread
// runs down and the side ones as what hangs off it. Columns: -1 surface, 0 spine, 1..3 dive.
const SIDE_W = 22, SPINE_W = 34, CH = 14;   // node
const CGAP = 10, RGAP = 8;                  // between columns, between rows
const ROWP = CH + RGAP;
const wAt = col => (col === 0 ? SPINE_W : SIDE_W);
const xAt = col => col < 0 ? 0
  : col === 0 ? SIDE_W + CGAP
  : SIDE_W + CGAP + SPINE_W + CGAP + (col - 1) * (SIDE_W + CGAP);
const cxAt = col => xAt(col) + wAt(col) / 2;
const MAP_W = xAt(3) + SIDE_W;
// The bottom margin is where the spine's thread runs on out of the diagram; the top is a
// sliver, just room for the first row's stroke, because the diagram is pinned to the top of
// its column and the asides beside it line up with the first row. The right is air. The left is whatever it takes to put the middle column's center in the middle of
// the box, so the spine is the center line of the page and the rest of the diagram hangs off
// it. The dive side runs three columns deep against the surface side's one, so that comes to
// most of a column of empty space.
const PAD = { top: 1, right: 6, bottom: 17, left: 0 };
PAD.left = MAP_W + PAD.right - 2 * cxAt(0);

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
    // The column is taller than the diagram needs, and that slack goes below it rather than
    // being split above and below: the diagram hangs from the top of its column, where the
    // two asides start.
    preserveAspectRatio: 'xMidYMin meet',
    'aria-hidden': 'true',
  });

  // The vertical axis needs no label and no rule of its own: it is the spine, so it is drawn
  // as the spine — one thread down through the middle column, running on out of the bottom of
  // the diagram with a head on it. The sideways axis is not annotated at all; the shape says
  // it, and the two asides sit on the very sides they name.
  svg.append(node('path', {
    class: 'thread',
    d: `M ${cxAt(0)} ${CH / 2} V ${H + 9} m -3 -4.5 l 3 4.5 l 3 -4.5`,
  }));

  const cells = new Map();
  SHAPE.forEach((shape, r) => {
    const y = r * ROWP;
    const put = (col, cls) => {
      const cell = node('rect', {
        class: `cell ${cls}`, x: xAt(col), y, width: wAt(col), height: CH, rx: 2.5,
        'data-row': r, 'data-col': col,
      });
      svg.append(cell);
      cells.set(spot(r, col), { cell, cx: cxAt(col), cy: y + CH / 2 });
    };
    const tie = (x1, x2) => svg.append(node('line', { class: 'tie', x1, y1: y + CH / 2, x2, y2: y + CH / 2 }));

    if (shape.left) { put(-1, 'surface'); tie(xAt(-1) + SIDE_W, xAt(0)); }
    put(0, 'spine');
    for (let d = 1; d <= shape.right; d++) { put(d, `dive d${d}`); tie(xAt(d) - CGAP, xAt(d)); }
  });

  // the reader: one node of the diagram is where you are standing
  const token = node('g', { class: 'token' },
    node('circle', { class: 'halo', r: 3.6 }),
    node('circle', { r: 2.1 }));
  svg.append(token);
  host.replaceChildren(svg);

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
