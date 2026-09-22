// Hash routes:  #/N   #/N/left   #/N/right   #/N/right/2   #/N/right/3
// A depth suffix only ever follows `right` (panel 12's three-pane chain); `left` never
// chains, and depth defaults to 1 when the suffix is absent. Anything else normalizes to
// the first row. The router owns `current`; main.js reacts in onRoute.
//
// A row id is usually the panel number, but the unnumbered rows between and around the
// panels are named instead (`#/guide`), so a row can be inserted into the vertical order
// without renumbering the panels and breaking every deep link. The router therefore knows
// the rows as an *ordered list of ids*, not a count: `order` is the spine top to bottom, and
// `step(±1)` is what down and up mean.

export function parseRoute(hash) {
  const m = /^#\/(\d{1,2}|[a-z][a-z-]{0,23})(?:\/(left|right)(?:\/(\d+))?)?\/?$/.exec(hash || '');
  if (!m) return null;
  return {
    index: /^\d+$/.test(m[1]) ? Number(m[1]) : m[1],
    side: m[2] || null,
    depth: m[3] ? Number(m[3]) : 1,
  };
}

export const formatRoute = ({ index, side, depth }) =>
  `#/${index}${side ? '/' + side + (depth > 1 ? '/' + depth : '') : ''}`;

/**
 * createRouter({ order, canOpen(index, side, depth), onRoute(route, source) })
 *   order:  every row id, top to bottom. order[0] is the route everything unparseable
 *           normalizes to, and `step` walks this list.
 *   source: 'initial' | 'hash' | 'scroll' | 'hscroll' | 'go'
 *   canOpen reports whether that exact depth exists for that side.
 */
export function createRouter({ order, canOpen = () => true, onRoute }) {
  const first = order[0];
  const numbered = order.filter(id => typeof id === 'number');
  let current = { index: first, side: null, depth: 1 };

  // An unknown id is a typo or a stale link: a number clamps into the numbered rows (#/99 →
  // the last panel), anything else goes home rather than guessing at a name.
  function resolveRow(raw) {
    if (order.includes(raw)) return raw;
    const n = Number(raw);
    if (Number.isFinite(n) && numbered.length) {
      return Math.min(numbered.at(-1), Math.max(numbered[0], Math.trunc(n)));
    }
    return first;
  }

  function normalize(route) {
    if (!route) return { index: first, side: null, depth: 1 };
    const index = resolveRow(route.index);
    let side = route.side || null;
    let depth = side ? Math.max(1, route.depth | 0 || 1) : 1;
    if (side) {
      // clamp downward to the deepest pane that exists, e.g. #/12/right/4 → #/12/right/3
      while (depth > 1 && !canOpen(index, side, depth)) depth--;
      if (!canOpen(index, side, depth)) { side = null; depth = 1; }
    }
    return { index, side, depth };
  }

  function apply(route, source) {
    current = route;
    onRoute(route, source);
  }

  /**
   * go(index, side, depth, { replace, source })
   *   replace: rewrite the URL without a history entry and apply immediately
   *            (used by scroll-driven updates; hashchange does not fire for replaceState)
   */
  function go(index, side = null, depth = 1, { replace = false, source = 'go' } = {}) {
    const route = normalize({ index, side, depth });
    const hash = formatRoute(route);
    if (hash === location.hash) {
      const same = route.index === current.index && route.side === current.side && route.depth === current.depth;
      if (source !== 'go' && !same) apply(route, source);
      return;
    }
    if (replace) {
      history.replaceState(null, '', hash);
      apply(route, source);
    } else {
      location.hash = hash; // triggers hashchange → apply(route, 'hash')
    }
  }

  window.addEventListener('hashchange', () => {
    const parsed = parseRoute(location.hash);
    const route = normalize(parsed);
    if (!parsed || formatRoute(route) !== location.hash) {
      history.replaceState(null, '', formatRoute(route));
    }
    apply(route, 'hash');
  });

  return {
    go,
    back: () => go(current.index, null),
    /** The row `delta` steps down the spine from the current one, clamped at both ends. */
    step: delta => order[Math.min(order.length - 1, Math.max(0, order.indexOf(current.index) + delta))],
    get current() { return current; },
    start() {
      const route = normalize(parseRoute(location.hash));
      if (formatRoute(route) !== location.hash) history.replaceState(null, '', formatRoute(route));
      apply(route, 'initial');
    },
  };
}
