// The stability region as a WebGL2 fragment shader: for every pixel λ in the plane, shade
// |R(hλ)| ≤ 1. Ported from design/poc/stability-poc.html. `precision highp float` is required;
// mediump breaks at large |hλ|. The boundary is anti-aliased with fwidth.
//
// One draw composites up to MAX_LAYERS regions in a single pass, so 10-right's nested Euler
// disks and 12-right's RK1–RK4 overlay are one call:
//
//   draw({ view, layers: [{ method, h, alpha, order }], highlight })
//   draw({ view, method, h })                                  // one layer, still works
//
// `method` is 'euler' | 'rk4' | 'implicit' | 'taylor'; a layer with `order: n` and no method
// is the degree-n Taylor partial sum of e^{hλ} (matches stability.taylorAmplification).
// Methods without a scalar R (semi-implicit Euler, Verlet) get the flat --region-none fill;
// use stability.spectralRadius for their verdict. With `highlight` set, that layer keeps its
// solid edge and full alpha and the others are dimmed.
//
// The shader draws over a transparent background so its output composes onto --surface
// either directly (a dedicated canvas via createRegionRenderer) or by blit: drawRegion(ctx2d,
// opts) renders on one shared, hidden WebGL2 canvas and drawImage()s the result into an
// ordinary 2D canvas. Browsers cap live contexts around sixteen and panel 12 wants three
// regions at once, so every stage shares that one context.

import { cssRgb } from './plot2d.js';

export const METHOD_INDEX = { euler: 0, rk4: 1, implicit: 2, taylor: 3 };
export const MAX_LAYERS = 8;
export const MAX_ORDER = 12;
const DIM = 0.35;   // alpha multiplier for layers other than the highlighted one

const VS = `#version 300 es
in vec2 a; out vec2 v;
void main() { v = a; gl_Position = vec4(a, 0.0, 1.0); }`;

const FS = `#version 300 es
precision highp float;
#define MAXL ${MAX_LAYERS}
#define MAXO ${MAX_ORDER}
in vec2 v; out vec4 o;
uniform vec2 uCenter, uHalf;          // view: λ = center + v * half
uniform int uCount, uHighlight;
uniform int uMethod[MAXL], uOrder[MAXL];
uniform float uH[MAXL], uAlpha[MAXL];
uniform vec3 uFill, uEdge, uNone;
vec2 cmul(vec2 a, vec2 b) { return vec2(a.x*b.x - a.y*b.y, a.x*b.y + a.y*b.x); }
vec2 cinv(vec2 a) { return vec2(a.x, -a.y) / dot(a, a); }
vec2 R(int method, int order, vec2 z) {
  if (method == 0) return vec2(1.0, 0.0) + z;                 // explicit Euler
  if (method == 2) return cinv(vec2(1.0, 0.0) - z);           // implicit Euler
  int n = method == 1 ? 4 : order;                            // RK4, or a Taylor degree
  vec2 a = vec2(1.0, 0.0);                                    // Horner, highest term first
  for (int i = MAXO; i >= 1; i--) {
    if (i > n) continue;
    a = vec2(1.0, 0.0) + cmul(z, a) / float(i);
  }
  return a;
}
void main() {
  vec2 lambda = uCenter + v * uHalf;
  vec4 acc = vec4(0.0);                                       // premultiplied, back to front
  for (int i = 0; i < MAXL; i++) {
    if (i >= uCount) break;
    bool lit = uHighlight < 0 || uHighlight == i;
    float alpha = uAlpha[i] * (lit ? 1.0 : ${DIM});
    vec4 src;
    if (uMethod[i] < 0) {
      src = vec4(uNone, 1.0) * alpha;                         // no scalar R: flat fill
    } else {
      float d = length(R(uMethod[i], uOrder[i], uH[i] * lambda)) - 1.0;   // < 0 inside
      float w = fwidth(d);
      float inside = 1.0 - smoothstep(-w, w, d);
      float edge = 1.0 - smoothstep(0.0, 2.0 * w, abs(d));
      float fillA = inside * 0.55 * alpha;
      float edgeA = edge * uAlpha[i] * (lit ? 1.0 : 0.45);
      src = vec4(uFill, 1.0) * fillA;
      src = vec4(uEdge, 1.0) * edgeA + src * (1.0 - edgeA);
    }
    acc = src + acc * (1.0 - src.a);
  }
  o = acc;
}`;

/** Accept the old single-layer call or the new layers call; returns { layers, highlight }. */
export function normalizeLayers(opts) {
  const layers = opts.layers ?? [{ method: opts.method, h: opts.h, alpha: opts.alpha ?? 1, order: opts.order }];
  if (layers.length > MAX_LAYERS) throw new Error(`region: at most ${MAX_LAYERS} layers`);
  return {
    layers: layers.map(l => ({
      method: l.method ?? (l.order != null ? 'taylor' : undefined),
      h: l.h, alpha: l.alpha ?? 1, order: Math.min(MAX_ORDER, Math.max(0, l.order ?? 0)),
    })),
    highlight: opts.highlight ?? -1,
  };
}

/**
 * createRegionRenderer(canvas) → { gl, canvas, draw(opts), resize(), destroy() }, or null
 * without WebGL2. draw() renders into the canvas's bottom-left `viewport` (default: the
 * whole canvas) over a transparent background.
 */
export function createRegionRenderer(canvas) {
  const gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: false, alpha: true, premultipliedAlpha: true });
  if (!gl) return null;

  const compile = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VS));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const a = gl.getAttribLocation(prog, 'a');
  gl.enableVertexAttribArray(a);
  gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);

  const loc = {};
  for (const n of ['uCenter', 'uHalf', 'uCount', 'uHighlight', 'uMethod', 'uOrder', 'uH', 'uAlpha', 'uFill', 'uEdge', 'uNone']) {
    loc[n] = gl.getUniformLocation(prog, n);
  }
  gl.uniform3fv(loc.uFill, cssRgb('--region'));
  gl.uniform3fv(loc.uEdge, cssRgb('--region-edge'));
  gl.uniform3fv(loc.uNone, cssRgb('--region-none'));
  gl.clearColor(0, 0, 0, 0);

  const methods = new Int32Array(MAX_LAYERS), orders = new Int32Array(MAX_LAYERS);
  const hs = new Float32Array(MAX_LAYERS), alphas = new Float32Array(MAX_LAYERS);

  return {
    gl,
    canvas,
    resize() { gl.viewport(0, 0, canvas.width, canvas.height); },
    /** draw({ view, layers, highlight, viewport: [w, h] }) or draw({ view, method, h }) */
    draw(opts) {
      const { layers, highlight } = normalizeLayers(opts);
      const [vw, vh] = opts.viewport ?? [canvas.width, canvas.height];
      const { view } = opts;
      gl.viewport(0, 0, vw, vh);
      gl.clear(gl.COLOR_BUFFER_BIT);
      layers.forEach((l, i) => {
        methods[i] = METHOD_INDEX[l.method] ?? -1;
        orders[i] = l.order;
        hs[i] = l.h;
        alphas[i] = l.alpha;
      });
      gl.uniform2f(loc.uCenter, (view.xMin + view.xMax) / 2, (view.yMin + view.yMax) / 2);
      gl.uniform2f(loc.uHalf, (view.xMax - view.xMin) / 2, (view.yMax - view.yMin) / 2);
      gl.uniform1i(loc.uCount, layers.length);
      gl.uniform1i(loc.uHighlight, highlight);
      gl.uniform1iv(loc.uMethod, methods);
      gl.uniform1iv(loc.uOrder, orders);
      gl.uniform1fv(loc.uH, hs);
      gl.uniform1fv(loc.uAlpha, alphas);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
    destroy() {
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
}

// ---- the shared canvas ----
let shared = null;       // { renderer } or null; false once WebGL2 is known to be missing
function sharedRenderer() {
  if (shared === false) return null;
  if (shared && !shared.gl.isContextLost()) return shared;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); shared = null; });
  shared = createRegionRenderer(canvas);
  if (!shared) shared = false;
  return shared || null;
}

/**
 * Render the region for the target 2D canvas's size on the shared WebGL2 canvas and blit it
 * in at (0, 0). Same options as draw(). Returns false when WebGL2 is unavailable, so the
 * caller can leave the layer blank or show a notice.
 */
export function drawRegion(ctx2d, opts) {
  const r = sharedRenderer();
  if (!r) return false;
  const { width: w, height: h } = ctx2d.canvas;
  if (w === 0 || h === 0) return true;
  // grow-only, so stages of different sizes alternating per frame do not reallocate
  if (r.canvas.width < w) r.canvas.width = w;
  if (r.canvas.height < h) r.canvas.height = h;
  r.draw({ ...opts, viewport: [w, h] });
  // the viewport sits at WebGL's bottom-left; as an image the buffer's top row is y = 0
  ctx2d.drawImage(r.canvas, 0, r.canvas.height - h, w, h, 0, 0, w, h);
  return true;
}

/** True once the shared context exists; for tests and diagnostics. */
export const hasSharedContext = () => Boolean(shared);
