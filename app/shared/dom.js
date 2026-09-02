// Tiny DOM helpers. No framework.

/** el('div', { class: 'x', 'data-i': 1 }, child, 'text', ...) */
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  node.append(...children.flat().filter(c => c != null && c !== false));
  return node;
}

/** Parse an HTML fragment into a DocumentFragment. */
export function fragment(html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  return tpl.content;
}

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Number formatting for readouts: fixed digits, unicode minus. */
export function fmt(v, digits = 3) {
  if (!Number.isFinite(v)) return v > 0 ? '∞' : v < 0 ? '−∞' : 'NaN';
  const abs = Math.abs(v);
  const s = abs !== 0 && (abs >= 1e5 || abs < 1e-3) ? v.toExponential(digits - 1) : v.toFixed(digits);
  return s.replace('-', '−');
}
