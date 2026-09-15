import fs from 'node:fs';
const catalog = JSON.parse(fs.readFileSync('dist/data/catalog.json', 'utf8'));
if (catalog.mediaMode === 'feishu-links') fs.rmSync('dist/media', { recursive: true, force: true });
