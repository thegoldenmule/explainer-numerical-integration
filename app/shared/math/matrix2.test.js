import { test } from 'node:test';
import assert from 'node:assert/strict';
import { I2, identity, madd, msub, mscale, mmul, mdet, minv, mtrace, rotation, scale, shear, apply, eigen } from './matrix2.js';
import { systemMatrix, eigenvalues } from './system.js';

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} expected ${b} got ${a}`);
const mnear = (A, B, tol, msg) => A.forEach((row, i) => row.forEach((v, j) => near(v, B[i][j], tol, `${msg ?? ''} [${i}][${j}]`)));

test('arithmetic: identity, inverse, determinant, products', () => {
  const A = [[2, 1], [-1, 3]];
  mnear(mmul(A, identity()), A, 0);
  mnear(mmul(A, I2), A, 0);
  mnear(mmul(A, minv(A)), I2, 1e-12);
  near(mdet(A), 7, 0);
  near(mtrace(A), 5, 0);
  mnear(madd(A, msub(A, A)), A, 0);
  mnear(mscale(A, 2), [[4, 2], [-2, 6]], 0);
  assert.deepEqual(apply(A, [1, 1]), [3, 2]);
  assert.deepEqual(apply(rotation(Math.PI / 2), [1, 0]).map(v => +v.toFixed(12)), [0, 1]);
  assert.deepEqual(apply(scale(2, 3), [1, 1]), [2, 3]);
  assert.deepEqual(apply(shear(1), [0, 1]), [1, 1]);
  assert.ok(Object.isFrozen(I2));
});

test('eigen: V Λ V⁻¹ reconstructs a diagonalizable matrix with real eigenvalues', () => {
  for (const M of [[[2, 1], [1, 2]], [[3, 0], [0, -1]], [[1, 2], [3, 4]], [[0, 1], [-2, -3]], [[0, 1], [1, 0]]]) {
    const e = eigen(M);
    assert.equal(e.real, true);
    assert.equal(e.defective, false);
    const V = [[e.vectors[0][0], e.vectors[1][0]], [e.vectors[0][1], e.vectors[1][1]]];
    const L = [[e.values[0][0], 0], [0, e.values[1][0]]];
    mnear(mmul(mmul(V, L), minv(V)), M, 1e-9, JSON.stringify(M));
    for (const v of e.vectors) near(Math.hypot(...v), 1, 1e-12, 'unit');
    assert.ok(e.values[0][0] >= e.values[1][0], 'larger root first');
  }
});

test('eigen: a rotation sweep of an anisotropic scale goes complex at the predicted angle', () => {
  // M(θ) = R(θ)·S(a, b): trace (a + b) cos θ, det ab; real iff cos²θ ≥ 4ab / (a + b)²
  const a = 3, b = 1;
  const critical = Math.acos(2 * Math.sqrt(a * b) / (a + b));
  const at = theta => eigen(mmul(rotation(theta), scale(a, b)));
  assert.equal(at(0).real, true);
  assert.equal(at(critical - 0.01).real, true);
  assert.equal(at(critical + 0.01).real, false);
  assert.equal(at(critical + 0.01).vectors, null);
  assert.equal(at(Math.PI / 2).real, false);
  // just before the collision the two directions have nearly converged
  const e = at(critical - 1e-4);
  const dot = e.vectors[0][0] * e.vectors[1][0] + e.vectors[0][1] * e.vectors[1][1];
  assert.ok(Math.abs(dot) > 0.99, `eigenvectors nearly parallel: |cos| = ${Math.abs(dot)}`);
  // a pure rotation is complex for every angle but 0 and π
  assert.equal(eigen(rotation(0.3)).real, false);
  assert.equal(eigen(rotation(0)).real, true);
  assert.equal(eigen(rotation(0)).vectors.length, 2);
});

test('eigen: a shear is defective (one eigenvector, repeated root); a scalar matrix is not', () => {
  const e = eigen(shear(2));
  assert.equal(e.real, true);
  assert.equal(e.defective, true);
  assert.deepEqual(e.values, [[1, 0], [1, 0]]);
  assert.deepEqual(e.vectors[0], [1, 0]);
  assert.deepEqual(e.vectors[1], [1, 0]);
  const s = eigen(scale(2));
  assert.equal(s.defective, false);
  assert.deepEqual(s.vectors, [[1, 0], [0, 1]]);
});

test('eigen(systemMatrix) agrees with system.eigenvalues in every regime', () => {
  for (const [m, c, k] of [[1, 0.1, 100], [10, 0.1, 10], [1, 3, 2], [1, 2, 1], [1, 0, 4], [2, 10, 0.5]]) {
    const e = eigen(systemMatrix(m, c, k));
    const l = eigenvalues(m, c, k);
    for (let i = 0; i < 2; i++) {
      near(e.values[i][0], l[i][0], 1e-9, `re ${[m, c, k]}`);
      near(e.values[i][1], l[i][1], 1e-9, `im ${[m, c, k]}`);
    }
    if (e.real) {
      // the eigenvector of the system matrix for λ is (1, λ), normalized
      e.vectors.forEach((v, i) => near(v[1] / v[0], e.values[i][0], 1e-9, 'direction (1, λ)'));
    }
  }
  assert.equal(eigen(systemMatrix(1, 2, 1)).defective, true, 'critical damping is a double root with one direction');
});
