// Hash routes:  #/N   #/N/left   #/N/right   #/N/right/2   #/N/right/3
// A depth suffix only ever follows `right` (panel 12's three-pane chain); `left` never
// chains, and depth defaults to 1 when the suffix is absent. Anything else normalizes to
// #/1. The router owns `current`; main.js reacts in onRoute.

export function parseRoute(hash) {
  const m = /^#\/(\d{1,2})(?:\/(left|right)(?:\/(\d+))?)?\/?$/.exec(hash || '');
  if (!m) return null;
  return { index: Number(m[1]), side: m[2] || null, depth: m[3] ? Number(m[3]) : 1 };
}

export const formatRoute = ({ index, side, depth }) =>
  `#/${index}${side ? '/' + side + (depth > 1 ? '/' + depth : '') : ''}`;

/**
 * createRouter({ count, canOpen(index, side, depth), onRoute(route, source) })
 *   source: 'initial' | 'hash' | 'scroll' | 'hscroll' | 'go'
 *   canOpen reports whether that exact depth exists for that side.
 */
export function createRouter({ count, canOpen = () => true, onRoute }) {
  let current = { index: 1, side: null, depth: 1 };

  function normalize(route) {
    if (!route) return { index: 1, side: null, depth: 1 };
    const index = Math.min(count, Math.max(1, route.index | 0));
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
    get current() { return current; },
    start() {
      const route = normalize(parseRoute(location.hash));
      if (formatRoute(route) !== location.hash) history.replaceState(null, '', formatRoute(route));
      apply(route, 'initial');
    },
  };
}
