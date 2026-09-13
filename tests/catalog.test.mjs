import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { filterItems, summaryFor, escapeHTML, safeURL } from '../src/catalog.js';
const { items } = JSON.parse(fs.readFileSync(new URL('../public/data/catalog.json', import.meta.url)));
const sample = [
  { id: 'p', title: 'Editorial', kind: 'prompt', prompt: 'Create a film', negativePrompt: '', description: '', usage: '', source: 'X / Twitter', author: 'Artist', model: 'minimax h3', modelVersion: '', method: '图生视频', tags: ['人物'] },
  { id: 'r', title: 'Visual', kind: 'reference', prompt: '', negativePrompt: '', description: '时间暂停', usage: '', source: 'Higgsfield', author: 'Studio', model: '待确认', modelVersion: '', method: '待确认', tags: ['运镜'] },
];
test('Search reaches every record, including records beyond the first batch', () => {
  for (const item of items) assert.ok(filterItems(items, { query: item.title }).some(match => match.id === item.id));
  assert.ok(filterItems(sample, { query: 'MINIMAX h3', kind: 'prompt' }).some(item => item.prompt));
});
test('Source, kind and tag filters combine; missing models remain explicit', () => {
  const reference = sample[1];
  const result = filterItems(sample, { source: reference.source, model: reference.model, kind: 'reference', tag: reference.tags[0] });
  assert.ok(result.length);
  assert.ok(result.every(item => item.source === reference.source && item.model === reference.model && !item.prompt && item.tags.includes(reference.tags[0])));
  assert.equal(filterItems(items, { source: reference.source, kind: 'prompt', query: 'impossible-keyword-8741' }).length, 0);
});
test('Favorites preserve catalog order and never include unsaved works', () => {
  const chosen = [sample.at(-1), sample[0]];
  assert.deepEqual(filterItems(sample, { kind: 'favorites' }, new Set(chosen.map(item => item.id))).map(item => item.id), chosen.reverse().map(item => item.id));
  assert.deepEqual(filterItems(items, { kind: 'favorites' }, new Set()), []);
});
test('Effect descriptions are labeled; no prompt is fabricated', () => {
  const reference = sample[1];
  assert.equal(reference.prompt, '');
  assert.match(summaryFor(reference), /^效果/);
  const prompt = sample[0];
  assert.equal(summaryFor(prompt), prompt.prompt);
});
test('Untrusted content cannot become markup or executable source links', () => {
  assert.equal(escapeHTML('<img src=x onerror="alert(1)">&'), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;&amp;');
  assert.equal(safeURL('javascript:alert(1)'), null);
  assert.equal(safeURL('data:text/html,<script>'), null);
  assert.equal(safeURL('https://example.com/work'), 'https://example.com/work');
});
