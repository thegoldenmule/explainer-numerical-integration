// The stability region as a WebGL2 fragment shader: for every pixel λ in the plane, shade
// |R(hλ)| ≤ 1. Ported from docs/poc/stability-poc.html. `precision highp float` is required;
// mediump breaks at large |hλ|. The boundary is anti-aliased with fwidth.
//
// Methods without a scalar R (semi-implicit Euler, Verlet) get uMethod = -1 and a flat
// "no region" fill; use stability.spectralRadius for their verdict instead.

import { cssRgb } from './plot2d.js';

export const METHOD_INDEX = { euler: 0, rk4: 1, implicit: 2 };

const VS = `#version 300 es
in vec2 a; out vec2 v;
void main() { v = a; gl_Position = vec4(a, 0.0, 1.0); }`;

const FS = `#version 300 es
precision highp float;
in vec2 v; out vec4 o;
uniform float uH;
uniform vec2 uCenter, uHalf;        // view: λ = center + v * half
uniform int uMethod;
uniform vec3 uFill, uEdge, uNone, uBg;
vec2 cmul(vec2 a, vec2 b) { return vec2(a.x*b.x - a.y*b.y, a.x*b.y + a.y*b.x); }
vec2 cinv(vec2 a) { return vec2(a.x, -a.y) / dot(a, a); }
vec2 R(vec2 z) {
  if (uMethod == 0) return vec2(1.0, 0.0) + z;                 // explicit Euler
  if (uMethod == 2) return cinv(vec2(1.0, 0.0) - z);           // implicit Euler
  vec2 a = vec2(1.0, 0.0) + z * 0.25;                          // RK4 via Horner
  a = vec2(1.0, 0.0) + cmul(z, a) / 3.0;
  a = vec2(1.0, 0.0) + cmul(z, a) / 2.0;
  return vec2(1.0, 0.0) + cmul(z, a);
}
void main() {
  if (uMethod < 0) { o = vec4(uNone, 1.0); return; }
  vec2 lambda = uCenter + v * uHalf;
  float d = length(R(uH * lambda)) - 1.0;   // < 0 inside the stability region
  float w = fwidth(d);
  float inside = 1.0 - smoothstep(-w, w, d);
  float edge = 1.0 - smoothstep(0.0, 2.0 * w, abs(d));
  vec3 col = mix(uBg, uFill, inside * 0.55);
  col = mix(col, uEdge, edge);
  o = vec4(col, 1.0);
}`;

/**
 * createRegionRenderer(canvas) → { draw(opts), resize(), destroy() } or null without WebGL2.
 *   draw({ method, h, view })   view from plot2d.makeView (xMin..yMax in λ units)
 */
export function createRegionRenderer(canvas) {
  const gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: false, alpha: false });
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
  for (const n of ['uH', 'uCenter', 'uHalf', 'uMethod', 'uFill', 'uEdge', 'uNone', 'uBg']) loc[n] = gl.getUniformLocation(prog, n);
  gl.uniform3fv(loc.uFill, cssRgb('--region'));
  gl.uniform3fv(loc.uEdge, cssRgb('--region-edge'));
  gl.uniform3fv(loc.uNone, cssRgb('--region-none'));
  gl.uniform3fv(loc.uBg, cssRgb('--surface'));

  return {
    gl,
    resize() { gl.viewport(0, 0, canvas.width, canvas.height); },
    draw({ method, h, view }) {
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform1f(loc.uH, h);
      gl.uniform2f(loc.uCenter, (view.xMin + view.xMax) / 2, (view.yMin + view.yMax) / 2);
      gl.uniform2f(loc.uHalf, (view.xMax - view.xMin) / 2, (view.yMax - view.yMin) / 2);
      gl.uniform1i(loc.uMethod, METHOD_INDEX[method] ?? -1);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
    destroy() {
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
}
