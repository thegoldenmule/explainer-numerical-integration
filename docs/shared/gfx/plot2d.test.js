import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeView } from './plot2d.js';

const close = (a, b, eps = 1e-12) => assert.ok(Math.abs(a - b) <= eps, `${a} ≉ ${b}`);

test('makeView with halfW alone gives equal axes: the vertical range follows the aspect', () => {
  const v = makeView({ w: 300, h: 100, halfW: 3 });
  close(v.xMax, 3);
  close(v.yMax, 1);
  close(v.sx, v.sy);
});

test('makeView minHalfH widens a wide view until ±minHalfH fits vertically, axes still equal', () => {
  // 3:1, halfW 4: equal axes alone would show only ±1.33 vertically
  const v = makeView({ w: 300, h: 100, halfW: 4, minHalfH: 2.6 });
  close(v.yMax, 2.6);
  close(v.yMin, -2.6);
  close(v.xMax, 7.8);
  close(v.sx, v.sy);
  // the box ±halfW × ±minHalfH is inside the view
  assert.ok(v.xMax >= 4 && v.yMax >= 2.6);
});

test('makeView minHalfH changes nothing when the equal-axis view already shows it', () => {
  const square = makeView({ w: 200, h: 200, halfW: 4, minHalfH: 4 });
  close(square.xMax, 4);
  close(square.yMax, 4);
  const roomy = makeView({ w: 200, h: 200, halfW: 4, minHalfH: 2.6 });
  close(roomy.xMax, 4);
  close(roomy.yMax, 4);
});

test('makeView minHalfH keeps the centre, and yields to explicit ranges', () => {
  const v = makeView({ w: 400, h: 100, cx: -10, cy: 1, halfW: 2, minHalfH: 1 });
  close((v.xMin + v.xMax) / 2, -10);
  close((v.yMin + v.yMax) / 2, 1);
  close(v.xMax - v.xMin, 8);
  close(v.yMax - v.yMin, 2);
  // an explicit halfH or explicit min/max is taken as given
  const fixedH = makeView({ w: 400, h: 100, halfW: 2, halfH: 0.5, minHalfH: 1 });
  close(fixedH.xMax, 2);
  close(fixedH.yMax, 0.5);
  const explicit = makeView({ w: 400, h: 100, xMin: 0, xMax: 1, yMin: 0, yMax: 1, minHalfH: 5 });
  close(explicit.xMax, 1);
  close(explicit.yMax, 1);
});
