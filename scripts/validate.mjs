import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const text = fs.readFileSync(path.join(root, 'public/data/catalog.json'), 'utf8');
const data = JSON.parse(text);
assert.equal(data.schemaVersion, 1);
assert.equal(data.count, data.items.length);
assert.ok(data.count > 0, 'Refusing to publish an empty catalog');
assert.equal(new Set(data.items.map(item => item.id)).size, data.count, 'Duplicate IDs');
assert.ok(!/"(?:file_token|tenant_access_token|user_access_token|app_secret|record_id)"\s*:/i.test(text), 'Private source metadata in public catalog');
assert.ok(Number.isFinite(Date.parse(data.updatedAt)));
const references = new Set();
const remote = data.mediaMode === 'feishu-links';
for (const item of data.items) {
  assert.match(item.id, /^[a-f0-9]{14}$/);
  assert.equal(item.kind, item.prompt ? 'prompt' : 'reference');
  for (const key of ['title', 'prompt', 'negativePrompt', 'description', 'usage', 'source', 'model', 'method', 'author']) assert.equal(typeof item[key], 'string', `Invalid ${key}`);
  assert.ok(Array.isArray(item.tags) && item.tags.every(tag => typeof tag === 'string'));
  assert.ok(item.width > 0 && item.height > 0);
  assert.ok(!item.sourceUrl || /^https?:\/\//.test(item.sourceUrl));
  for (const media of [item.cover, item.video, ...item.references]) {
    if (remote) { if (!media) continue; const url = new URL(media); assert.equal(url.protocol, 'https:'); assert.ok(!url.username && !url.password); continue; }
    assert.match(media, /^media\/[a-f0-9]{20}\.(jpg|jpeg|png|webp|mp4|webm)$/);
    const size = fs.statSync(path.join(root, 'public', media)).size;
    assert.ok(size > 0 && size < 100 * 1024 * 1024, 'Attachment missing, empty or too large');
    references.add(media);
  }
}
const files = fs.readdirSync(path.join(root, 'public/media'));
const total = files.reduce((size, name) => size + fs.statSync(path.join(root, 'public/media', name)).size, 0);
assert.ok(total < 900 * 1024 * 1024, 'Site media exceeds the publication budget');
assert.ok(remote || files.every(name => references.has('media/' + name)), 'Unreferenced media: run sync before publishing');
console.log(remote ? `Validated ${data.count} records with remote media links; no app credentials in catalog.` : `Validated ${data.count} records, ${references.size} local media files.`);
