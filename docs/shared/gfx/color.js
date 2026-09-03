// Alpha and mixing for the CSS palette, and the diverging colormap the spectral-radius
// heatmaps use (12-right-3, 11-right). Colors in and out are CSS strings, so a result can
// go straight into fillStyle; the parsers cover what base.css uses (#rgb, #rrggbb, with or
// without an alpha pair, rgb() and rgba() in comma or slash form). Named colors and other
// color spaces are not supported. Nothing here touches the DOM at import time; only
// rhoColormap reads the stylesheet, when it is called.

import { cssVar } from './plot2d.js';

const clamp01 = v => Math.min(1, Math.max(0, v));

/** parseColor(css) → [r, g, b, a] with r, g, b in 0..255 and a in 0..1. Throws on anything else. */
export function parseColor(css) {
  const v = String(css).trim();
  let m;
  if ((m = /^#([0-9a-f]{3,4})$/i.exec(v))) {
    const ch = [...m[1]].map(c => parseInt(c + c, 16));
    return [ch[0], ch[1], ch[2], ch.length === 4 ? ch[3] / 255 : 1];
  }
  if ((m = /^#([0-9a-f]{6}|[0-9a-f]{8})$/i.exec(v))) {
    const ch = [0, 2, 4, 6].filter(i => i < m[1].length).map(i => parseInt(m[1].slice(i, i + 2), 16));
    return [ch[0], ch[1], ch[2], ch.length === 4 ? ch[3] / 255 : 1];
  }
  if ((m = /^rgba?\(([^)]+)\)$/i.exec(v))) {
    const parts = m[1].split(/[\s,/]+/).filter(Boolean);
    if (parts.length < 3) throw new Error(`parseColor: cannot parse "${css}"`);
    const num = s => (s.endsWith('%') ? Number(s.slice(0, -1)) * 2.55 : Number(s));
    const a = parts.length > 3 ? (parts[3].endsWith('%') ? Number(parts[3].slice(0, -1)) / 100 : Number(parts[3])) : 1;
    return [num(parts[0]), num(parts[1]), num(parts[2]), a];
  }
  throw new Error(`parseColor: cannot parse "${css}"`);
}

/** [r, g, b, a] → 'rgb(r, g, b)' or 'rgba(r, g, b, a)' when a < 1. */
export function toCss([r, g, b, a = 1]) {
  const R = Math.round(r), G = Math.round(g), B = Math.round(b);
  return a >= 1 ? `rgb(${R}, ${G}, ${B})` : `rgba(${R}, ${G}, ${B}, ${+a.toFixed(3)})`;
}

/** The same color at alpha a (replacing, not multiplying, any alpha it had). */
export function withAlpha(css, a) {
  const [r, g, b] = parseColor(css);
  return toCss([r, g, b, clamp01(a)]);
}

/** Linear mix of two colors in sRGB: t = 0 is a, t = 1 is b. Alpha mixes too. */
export function mix(a, b, t) {
  const A = parseColor(a), B = parseColor(b), s = clamp01(t);
  return toCss(A.map((v, i) => v + (B[i] - v) * s));
}

/**
 * A diverging colormap: `center` maps to `mid`, values `spanLo` below it saturate to `lo`
 * and `spanHi` above it to `hi`, linearly in between. Non-finite values map to `none`
 * (null by default: drawHeatmap skips the cell).
 *   divergingColormap({ lo, mid, hi, center = 0, spanLo = 1, spanHi = spanLo, none = null }) → v => css
 */
export function divergingColormap({ lo, mid, hi, center = 0, spanLo = 1, spanHi = spanLo, none = null }) {
  const L = parseColor(lo), M = parseColor(mid), H = parseColor(hi);
  const lerp = (a, b, t) => toCss(a.map((v, i) => v + (b[i] - v) * t));
  return v => {
    if (!Number.isFinite(v)) return none;
    if (v < center) return lerp(M, L, clamp01((center - v) / spanLo));
    return lerp(M, H, clamp01((v - center) / spanHi));
  };
}

/**
 * The spectral-radius colormap: ρ = 1 is the boundary (--surface, neutral), ρ → 0 runs to
 * --stable and ρ ≥ 1 + spanHi is fully --unstable. Reads the palette when called.
 *   rhoColormap({ spanLo = 1, spanHi = 0.5 }) → rho => css
 */
export function rhoColormap({ spanLo = 1, spanHi = 0.5 } = {}) {
  return divergingColormap({
    lo: cssVar('--stable'), mid: cssVar('--surface') || '#ffffff', hi: cssVar('--unstable'),
    center: 1, spanLo, spanHi,
  });
}
