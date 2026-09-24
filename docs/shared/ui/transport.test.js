import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stepPlayer } from './transport.js';

// a loop we tick by hand, which also counts its registered frame callbacks
function fakeLoop() {
  const cbs = new Set();
  return {
    onFrame(cb) { cbs.add(cb); return () => cbs.delete(cb); },
    tick(dt) { for (const cb of [...cbs]) cb(dt, 0); },
    get size() { return cbs.size; },
  };
}

function counter({ max = Infinity } = {}) {
  const loop = fakeLoop();
  const run = { n: 0, resets: 0 };
  const player = stepPlayer({
    loop, h: () => 0.1,
    step: () => { run.n = Math.min(max, run.n + 1); },
    reset: () => { run.n = 0; run.resets++; },
    ended: () => run.n >= max,
  });
  return { loop, run, player };
}

test('stepPlayer runs step() at wall-clock rate, h() seconds per call, only while playing', () => {
  const { loop, run, player } = counter();
  loop.tick(1);
  assert.equal(run.n, 0, 'idle: nothing happens');
  player.play();
  assert.equal(player.playing, true);
  loop.tick(0.25);                       // two steps of 0.1, 0.05 carried
  assert.equal(run.n, 2);
  loop.tick(0.03);                       // 0.08 carried: not yet a whole step
  assert.equal(run.n, 2);
  loop.tick(0.03);                       // 0.11: the carry makes a third
  assert.equal(run.n, 3);
  player.pause();
  loop.tick(1);
  assert.equal(run.n, 3);
});

test('stepPlayer registers its frame callback only while playing', () => {
  const { loop, player } = counter();
  assert.equal(loop.size, 0);
  player.play();
  assert.equal(loop.size, 1);
  player.play();                         // idempotent
  assert.equal(loop.size, 1);
  player.pause();
  assert.equal(loop.size, 0);
  player.toggle();
  assert.equal(loop.size, 1);
  player.toggle();
  assert.equal(loop.size, 0);
});

test('stepPlayer caps the steps per frame', () => {
  const loop = fakeLoop();
  let n = 0;
  const player = stepPlayer({ loop, h: () => 0.001, step: () => n++, reset: () => { n = 0; }, maxStepsPerFrame: 50 });
  player.play();
  loop.tick(1);
  assert.equal(n, 50);
});

test('stepPlayer pauses itself at ended(), reads ended, and Play or Step from there resets first', () => {
  const { loop, run, player } = counter({ max: 3 });
  const changes = [];
  player.onChange(() => changes.push([player.playing, player.ended]));
  player.play();
  loop.tick(1);                          // ten steps' worth, but the run ends at 3
  assert.equal(run.n, 3);
  assert.equal(player.playing, false);
  assert.equal(player.ended, true);
  assert.equal(loop.size, 0, 'no frames asked for once it has ended');
  assert.deepEqual(changes.at(-1), [false, true]);
  player.play();                         // Replay: reset, then run
  assert.equal(run.resets, 1);
  assert.equal(run.n, 0);
  assert.equal(player.playing, true);
  assert.equal(player.ended, false);
  loop.tick(0.1);
  assert.equal(run.n, 1);
  player.pause();
  run.n = 3;                             // the pane moved the run to its end itself
  player.changed();
  assert.equal(player.ended, true);
  player.step();                         // Step from the end: reset, then one step
  assert.equal(run.resets, 2);
  assert.equal(run.n, 1);
});

test('stepPlayer step() and reset() notify, and never end without an ended()', () => {
  const loop = fakeLoop();
  let n = 0, seen = 0;
  const player = stepPlayer({ loop, h: () => 0.1, step: () => n++, reset: () => { n = 0; } });
  player.onChange(() => seen++);
  player.step(); player.step();
  assert.equal(n, 2);
  player.reset();
  assert.equal(n, 0);
  assert.equal(seen, 3);
  assert.equal(player.ended, false);
});

test('stepPlayer stops asking for frames when its signal aborts', () => {
  const loop = fakeLoop();
  const abort = new AbortController();
  const player = stepPlayer({ loop, h: () => 0.1, step: () => {}, reset: () => {}, signal: abort.signal });
  player.play();
  assert.equal(loop.size, 1);
  abort.abort();
  assert.equal(loop.size, 0);
  assert.equal(player.playing, false);
  player.play();
  assert.equal(loop.size, 0, 'a dead player does not come back');
});
