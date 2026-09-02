// Hash routes:  #/N   #/N/left   #/N/right     (N = 1..count)
// Anything else normalizes to #/1. The router owns `current`; main.js reacts in onRoute.

export function parseRoute(hash) {
  const m = /^#\/(\d{1,2})(?:\/(left|right))?\/?$/.exec(hash || '');
  return m ? { index: Number(m[1]), side: m[2] || null } : null;
}

export const formatRoute = ({ index, side }) => `#/${index}${side ? '/' + side : ''}`;

/**
 * createRouter({ count, canOpen(index, side), onRoute(route, source) })
 *   source: 'initial' | 'hash' | 'scroll' | 'go'
 */
export function createRouter({ count, canOpen = () => true, onRoute }) {
  let current = { index: 1, side: null };

  function normalize(route) {
    if (!route) return { index: 1, side: null };
    const index = Math.min(count, Math.max(1, route.index | 0));
    const side = route.side && canOpen(index, route.side) ? route.side : null;
    return { index, side };
  }

  function apply(route, source) {
    current = route;
    onRoute(route, source);
  }

  /**
   * go(index, side, { replace, source })
   *   replace: rewrite the URL without a history entry and apply immediately
   *            (used by scroll-driven updates; hashchange does not fire for replaceState)
   */
  function go(index, side = null, { replace = false, source = 'go' } = {}) {
    const route = normalize({ index, side });
    const hash = formatRoute(route);
    if (hash === location.hash) {
      if (source !== 'go') apply(route, source);
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
