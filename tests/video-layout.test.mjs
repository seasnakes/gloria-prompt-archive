import test from 'node:test';
import assert from 'node:assert/strict';
import { fitVideoLayout } from '../src/video-layout.js';
test('Landscape, portrait and square players fit the viewport at their native ratio', () => {
  for (const [vw,vh] of [[1440,900],[390,844],[844,390]]) {
    for (const [w,h] of [[1920,1080],[1080,1920],[1080,1080],[2560,1080]]) {
      const result = fitVideoLayout(w,h,vw,vh);
      assert.ok(result.dialogWidth <= vw * .94);
      assert.ok(result.mediaWidth <= result.dialogWidth);
      assert.ok(result.mediaWidth / (w/h) <= vh - 150 + .01);
      assert.equal(result.orientation, w/h < .85 ? 'portrait' : 'landscape');
    }
  }
});
