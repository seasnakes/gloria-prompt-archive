import test from 'node:test';
import assert from 'node:assert/strict';
import { swipeDirection } from '../src/work-swipe.js';

test('Horizontal swipes navigate once in the expected direction', () => {
  assert.equal(swipeDirection(-120, 12, 350), 1);
  assert.equal(swipeDirection(90, -20, 600), -1);
});

test('Scrolling, taps, diagonal drags and long presses do not switch works', () => {
  for (const gesture of [[20, 0, 100], [65, 150, 400], [80, 60, 400], [120, 0, 2000]]) {
    assert.equal(swipeDirection(...gesture), 0);
  }
});
