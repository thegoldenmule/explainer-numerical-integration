import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseColor, toCss, withAlpha, mix, divergingColormap } from './color.js';
import { layoutGrid, bestGrid } from './plot2d.js';

test('parseColor reads the forms base.css uses', () => {
  assert.deepEqual(parseColor('#1a9c4a'), [26, 156, 74, 1]);
  assert.deepEqual(parseColor('#fff'), [255, 255, 255, 1]);
  assert.deepEqual(parseColor('#00000080')[3].toFixed(2), '0.50');
  assert.deepEqual(parseColor('rgba(0, 0, 0, 0.08)'), [0, 0, 0, 0.08]);
  assert.deepEqual(parseColor('rgb(10 20 30 / 0.5)'), [10, 20, 30, 0.5]);
  assert.deepEqual(parseColor(' rgb(1,2,3) '), [1, 2, 3, 1]);
  assert.throws(() => parseColor('red'));
  assert.throws(() => parseColor('hsl(1 2 3)'));
});

test('withAlpha and mix return CSS strings a canvas accepts', () => {
  assert.equal(withAlpha('#d43a2f', 0.25), 'rgba(212, 58, 47, 0.25)');
  assert.equal(withAlpha('rgba(0, 0, 0, 0.08)', 1), 'rgb(0, 0, 0)');
  assert.equal(withAlpha('#000', 2), 'rgb(0, 0, 0)', 'alpha clamps');
  assert.equal(mix('#000000', '#ffffff', 0.5), 'rgb(128, 128, 128)');
  assert.equal(mix('#000000', '#ffffff', 0), 'rgb(0, 0, 0)');
  assert.equal(mix('#000000', '#ffffff', 5), 'rgb(255, 255, 255)', 't clamps');
  assert.equal(toCss([1.4, 2.6, 3, 1]), 'rgb(1, 3, 3)');
});

test('divergingColormap is neutral at the center and saturates at the spans', () => {
  const cm = divergingColormap({ lo: '#00ff00', mid: '#ffffff', hi: '#ff0000', center: 1, spanLo: 1, spanHi: 0.5 });
  assert.equal(cm(1), 'rgb(255, 255, 255)');
  assert.equal(cm(0), 'rgb(0, 255, 0)');
  assert.equal(cm(-3), 'rgb(0, 255, 0)');
  assert.equal(cm(1.5), 'rgb(255, 0, 0)');
  assert.equal(cm(9), 'rgb(255, 0, 0)');
  assert.equal(cm(1.25), 'rgb(255, 128, 128)');
  assert.equal(cm(0.5), 'rgb(128, 255, 128)');
  assert.equal(cm(NaN), null);
  assert.equal(divergingColormap({ lo: '#000', mid: '#fff', hi: '#000', none: '#123456' })(Infinity), '#123456');
});

test('layoutGrid tiles the box row-major with gaps between cells only', () => {
  const cells = layoutGrid(100, 50, 2, 3, 5);
  assert.equal(cells.length, 6);
  assert.deepEqual(cells[0], { x: 0, y: 0, w: 30, h: 22.5, row: 0, col: 0 });
  assert.deepEqual(cells[1], { x: 35, y: 0, w: 30, h: 22.5, row: 0, col: 1 });
  assert.deepEqual(cells[5], { x: 70, y: 27.5, w: 30, h: 22.5, row: 1, col: 2 });
  const last = cells[5];
  assert.equal(last.x + last.w, 100);
  assert.equal(last.y + last.h, 50);
  assert.deepEqual(layoutGrid(10, 10, 1, 1), [{ x: 0, y: 0, w: 10, h: 10, row: 0, col: 0 }]);
});

test('bestGrid picks the arrangement with the largest square cells', () => {
  // three squares in a square box: 2 × 2 with one empty beats 1 × 3 or 3 × 1
  const sq = bestGrid(100, 100, 3, 4);
  assert.equal(sq.rows, 2);
  assert.equal(sq.cols, 2);
  assert.equal(sq.cells.length, 3);
  assert.deepEqual(sq.cells[2], { x: 0, y: 52, w: 48, h: 48, row: 1, col: 0 });
  // in a 3:1 strip they go 1 × 3
  const strip = bestGrid(300, 100, 3, 0);
  assert.equal(strip.cols, 3);
  assert.equal(strip.cells[1].w, 100);
  assert.equal(strip.cells[1].h, 100);
  // a tall box stacks them
  assert.equal(bestGrid(100, 300, 3, 0).rows, 3);
  // non-square cells keep their aspect
  const wide = bestGrid(200, 100, 2, 0, 2);
  assert.equal(wide.rows, 2);
  assert.deepEqual(wide.cells[1], { x: 0, y: 50, w: 100, h: 50, row: 1, col: 0 });
});
