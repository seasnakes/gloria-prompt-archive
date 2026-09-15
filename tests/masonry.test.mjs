import test from 'node:test';
import assert from 'node:assert/strict';
import { masonryLayout } from '../src/masonry.js';
test('Mixed aspect ratios fill shortest columns without overlap', () => {
  const heights = Array.from({ length: 120 }, (_, i) => [235, 540, 370, 260, 600][i % 5]);
  const result = masonryLayout(heights, 1200, 4);
  const bottoms = Array(4).fill(0);
  result.positions.forEach((p, i) => {
    const column = Math.round(p.x / (result.columnWidth + 16));
    assert.equal(p.y, Math.min(...bottoms));
    assert.equal(p.y, bottoms[column]);
    bottoms[column] += heights[i] + 16;
  });
  assert.ok(Math.max(...bottoms) - Math.min(...bottoms) <= Math.max(...heights) + 16);
  assert.equal(result.height, Math.max(...bottoms) - 16);
});
test('Appending preserves positions of already measured cards', () => {
  const first = [300, 180, 520, 410, 220, 350];
  assert.deepEqual(masonryLayout([...first, 600, 280], 390, 2, 12).positions.slice(0, first.length), masonryLayout(first, 390, 2, 12).positions);
  assert.deepEqual(masonryLayout(first, 0, 2).positions, []);
});
