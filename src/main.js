import './style.css';
import { startIntro } from './intro.js';
import { escapeHTML as esc, filterItems, summaryFor, safeURL } from './catalog.js';
import { version } from '../package.json';

const $ = selector => document.querySelector(selector);
const base = import.meta.env.BASE_URL;
const mediaURL = path => new URL(base + path, location.href.split('#')[0]).href;
const storage = { get(key) { try { return localStorage.getItem(key); } catch { return null; } }, set(key, value) { try { localStorage.setItem(key, value); return true; } catch { return false; } } };
let favorites;
try { const saved = JSON.parse(storage.get('gloria-favorites') || '[]'); favorites = new Set(Array.isArray(saved) ? saved.filter(x => typeof x === 'string') : []); } catch { favorites = new Set(); }
let items = [], filtered = [], limit = 12, current = null, modalItems = [], lastFocus, toastTimer;
const filters = { kind: 'all', query: '', source: '', model: '', method: '', tag: '' };
const dialog = $('#work-dialog'), video = $('#work-video');
const titleForKind = kind => kind === 'prompt' ? '有提示词' : '效果参考';
function toast(message) { $('#toast').textContent = message; $('#toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 2600); }
function setTheme(theme) { document.documentElement.dataset.theme = theme; const light = theme === 'light'; $('#theme-toggle').setAttribute('aria-label', `切换为${light ? '深' : '浅'}色主题`); $('.theme-label').textContent = light ? '深色' : '浅色'; $('.theme-icon').textContent = light ? '◐' : '☼'; }
setTheme(storage.get('gloria-theme') === 'light' ? 'light' : 'dark');
$('#theme-toggle').addEventListener('click', () => { const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; setTheme(theme); storage.set('gloria-theme', theme); });
startIntro();
import('./background.js').then(({ startBackground }) => startBackground()).catch(() => { $('.ocean-background').dataset.state = 'fallback'; });
$('#site-version').textContent = `V${version}`;

function updateFavoriteButtons() {
  const count = items.filter(item => favorites.has(item.id)).length;
  $('#favorite-count').textContent = count;
  $('[data-kind="favorites"] span').textContent = count;
  document.querySelectorAll('.card-favorite').forEach(button => { const active = favorites.has(button.dataset.favorite); button.setAttribute('aria-pressed', active); button.textContent = active ? '♥' : '♡'; button.setAttribute('aria-label', `${active ? '取消收藏' : '收藏'}：${items.find(item => item.id === button.dataset.favorite)?.title || ''}`); });
  if (current) { const active = favorites.has(current.id); $('#detail-favorite').textContent = active ? '♥ 已收藏' : '♡ 收藏'; $('#detail-favorite').setAttribute('aria-pressed', active); }
}
function toggleFavorite(id) {
  const adding = !favorites.has(id); adding ? favorites.add(id) : favorites.delete(id);
  const saved = storage.set('gloria-favorites', JSON.stringify([...favorites]));
  updateFavoriteButtons();
  if (filters.kind === 'favorites') render();
  toast(saved ? (adding ? '已收藏，保存在当前浏览器' : '已取消收藏') : '已更新本次收藏，浏览器暂不允许保存');
}
function card(item, index) {
  const article = document.createElement('article'); article.className = 'work-card'; article.dataset.id = item.id;
  article.innerHTML = `<button class="card-open" data-open="${esc(item.id)}" aria-label="查看作品：${esc(item.title)}"><span class="card-media" style="--ratio:${item.width}/${item.height}"><img src="${esc(mediaURL(item.cover))}" alt="${esc(item.title)}" width="${item.width}" height="${item.height}" loading="${index < 4 ? 'eager' : 'lazy'}" decoding="async"><span class="card-top"><span class="play-dot" aria-hidden="true">▶</span> ${titleForKind(item.kind)}</span><span class="card-summary"><span>${esc(summaryFor(item))}</span></span><span class="card-error"><strong>封面未能加载</strong><span>点击查看作品与视频</span></span></span><span class="card-title">${esc(item.title)}</span><span class="card-caption"><span>${esc(item.source)}</span><span>${esc(item.model === '待确认' ? '模型待确认' : item.model)}</span></span></button><button class="card-favorite" data-favorite="${esc(item.id)}" aria-label="收藏：${esc(item.title)}" aria-pressed="false">♡</button>`;
  const img = article.querySelector('img');
  const ready = () => { article.classList.remove('failed'); article.classList.add('ready'); };
  img.addEventListener('load', ready, { once: true });
  img.addEventListener('error', () => article.classList.add('failed'), { once: true });
  if (img.complete && img.naturalWidth) ready();
  return article;
}
function render(append = false) {
  filtered = filterItems(items, filters, favorites);
  const gallery = $('#gallery');
  const before = append ? gallery.children.length : 0;
  if (!append) gallery.replaceChildren();
  const fragment = document.createDocumentFragment();
  filtered.slice(before, limit).forEach((item, i) => fragment.append(card(item, before + i)));
  gallery.append(fragment);
  document.querySelectorAll('[data-kind]').forEach(button => button.setAttribute('aria-pressed', button.dataset.kind === filters.kind));
  document.querySelectorAll('[data-tag]').forEach(button => button.setAttribute('aria-pressed', button.dataset.tag === filters.tag));
  $('#empty-state').hidden = !!filtered.length || !items.length;
  $('#result-count').textContent = `${filtered.length} 个作品`;
  $('#reset-filters').hidden = filters.kind === 'all' && !Object.entries(filters).some(([name, value]) => name !== 'kind' && value);
  $('#load-more-area').hidden = !filtered.length;
  $('#batch-status').textContent = `已呈现 ${Math.min(limit, filtered.length)} / ${filtered.length}`;
  $('#load-more').hidden = limit >= filtered.length;
  updateFavoriteButtons();
}
function applyFilters() { limit = 12; render(); }
function resetFilters() { Object.assign(filters, { kind: 'all', query: '', source: '', model: '', method: '', tag: '' }); $('#search').value = ''; ['source', 'model', 'method'].forEach(name => $(`#${name}-filter`).value = ''); applyFilters(); }
$('#gallery').addEventListener('click', event => {
  const favorite = event.target.closest('[data-favorite]'); if (favorite) { toggleFavorite(favorite.dataset.favorite); return; }
  const open = event.target.closest('[data-open]'); if (open) openWork(open.dataset.open, true);
});
document.querySelectorAll('[data-kind]').forEach(button => button.addEventListener('click', () => { filters.kind = button.dataset.kind; applyFilters(); }));
$('#search').addEventListener('input', event => { filters.query = event.target.value; applyFilters(); });
['source', 'model', 'method'].forEach(name => $(`#${name}-filter`).addEventListener('change', event => { filters[name] = event.target.value; applyFilters(); }));
$('#tag-filters').addEventListener('click', event => { const button = event.target.closest('[data-tag]'); if (button) { filters.tag = filters.tag === button.dataset.tag ? '' : button.dataset.tag; applyFilters(); } });
$('#reset-filters').addEventListener('click', resetFilters); $('#empty-reset').addEventListener('click', resetFilters);
$('#open-favorites').addEventListener('click', () => { filters.kind = 'favorites'; applyFilters(); $('#archive').scrollIntoView({ behavior: 'smooth' }); });
$('#load-more').addEventListener('click', () => { limit += 12; render(true); });
// Each batch needs an explicit request; browsing remains stable while images load.

function setVideo(item) {
  video.pause(); video.removeAttribute('src'); video.load();
  $('#video-error').hidden = true;
  video.poster = mediaURL(item.cover); video.preload = 'metadata'; video.src = mediaURL(item.video); video.load();
}
function openWork(id, push = false) {
  const item = items.find(item => item.id === id); if (!item) return;
  if (!dialog.open) { lastFocus = document.activeElement; modalItems = filtered.some(item => item.id === id) ? [...filtered] : [...items]; }
  current = item;
  const position = modalItems.findIndex(item => item.id === id);
  $('#work-position').textContent = `${String(position + 1).padStart(2, '0')} / ${String(modalItems.length).padStart(2, '0')}`;
  $('#previous-work').disabled = position <= 0; $('#next-work').disabled = position >= modalItems.length - 1;
  $('#work-kind').textContent = titleForKind(item.kind);
  $('#work-title').textContent = item.title;
  $('#work-credit').textContent = [item.author, item.source].filter(Boolean).join(' · ');
  $('#work-tags').innerHTML = item.tags.map(tag => `<span>${esc(tag)}</span>`).join('');
  $('#work-facts').innerHTML = [['模型', item.model], ['生成方式', item.method], ['模型版本', item.modelVersion || '待确认']].map(([label, value]) => `<div><dt>${label}</dt><dd>${esc(value)}</dd></div>`).join('');
  $('#prompt-title').textContent = item.prompt ? '提示词' : '效果说明';
  $('#prompt-text').textContent = item.prompt || [item.description || '这条收录用于视觉效果参考。', item.usage && `适合用途：${item.usage}`].filter(Boolean).join('\n\n');
  $('#copy-prompt').hidden = !item.prompt;
  $('#prompt-note').textContent = item.prompt ? '保留收录时的原文。使用时可按自己的素材调整。' : '原作者未提供原始提示词；以上为效果说明，不代表可直接复现的提示词。';
  $('#negative-section').hidden = !item.negativePrompt; $('#negative-text').textContent = item.negativePrompt;
  $('#parameters-section').open = false;
  $('#parameters-text').textContent = [`${item.width} × ${item.height} · ${item.duration ? item.duration + ' 秒' : '时长未标注'}`, item.parameters].filter(Boolean).join('\n\n');
  const source = safeURL(item.sourceUrl); $('#source-link').hidden = !source; if (source) $('#source-link').href = source;
  $('#media-caption').textContent = '点击播放视频 · 作品及提示词权利归原作者所有';
  setVideo(item); updateFavoriteButtons();
  $('.work-info').scrollTop = 0;
  if (!dialog.open) dialog.showModal();
  dialog.scrollTop = 0;
  if (push) history.pushState({ gloriaWork: true }, '', `#work/${encodeURIComponent(id)}`);
}
function closeWork(updateURL = true) {
  video.pause(); video.removeAttribute('src'); video.removeAttribute('poster'); video.load(); current = null;
  if (dialog.open) dialog.close();
  if (updateURL && location.hash.startsWith('#work/')) {
    // Back returns to the exact scroll position and filters that opened this item.
    if (history.state?.gloriaWork) history.back(); else history.replaceState(null, '', '#archive');
  }
  lastFocus?.focus({ preventScroll: true });
}
function moveWork(offset) { if (!current) return; const position = modalItems.findIndex(item => item.id === current.id); const item = modalItems[position + offset]; if (item) { openWork(item.id); history.replaceState(history.state, '', `#work/${encodeURIComponent(item.id)}`); } }
$('#close-work').addEventListener('click', () => closeWork());
dialog.addEventListener('cancel', event => { event.preventDefault(); closeWork(); });
$('#previous-work').addEventListener('click', () => moveWork(-1)); $('#next-work').addEventListener('click', () => moveWork(1));
$('#detail-favorite').addEventListener('click', () => current && toggleFavorite(current.id));
video.addEventListener('error', () => { if (current && video.hasAttribute('src')) $('#video-error').hidden = false; });
$('#retry-video').addEventListener('click', () => current && setVideo(current));
async function copy(text, message) { try { await navigator.clipboard.writeText(text); toast(message); } catch { toast('复制未成功，请长按或选中文字复制'); } }
$('#copy-prompt').addEventListener('click', () => current?.prompt && copy(current.prompt, '提示词已复制'));
$('#copy-negative').addEventListener('click', () => current?.negativePrompt && copy(current.negativePrompt, '负面提示词已复制'));
$('#share-work').addEventListener('click', () => current && copy(new URL(`#work/${current.id}`, location.href).href, '作品链接已复制'));
document.querySelectorAll('dialog').forEach(modal => modal.addEventListener('click', event => { if (event.target !== modal) return; const rect = modal.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) { if (modal === dialog) closeWork(); else modal.close(); } }));
document.addEventListener('keydown', event => {
  if (event.altKey || event.ctrlKey || event.metaKey || event.target.closest('input,textarea,select,[contenteditable=true]')) return;
  if (dialog.open && !event.target.closest('video')) { if (event.key === 'ArrowLeft') { event.preventDefault(); moveWork(-1); } if (event.key === 'ArrowRight') { event.preventDefault(); moveWork(1); } }
  else if (event.key === '/' && !document.querySelector('dialog[open]')) { event.preventDefault(); $('#search').focus(); }
});
function readHash() { if (location.hash.startsWith('#work/')) { const id = location.hash.slice(6); if (items.some(item => item.id === id)) openWork(id); else toast('未找到这个作品，可能已从收录中移除'); } else if (dialog.open) closeWork(false); }
window.addEventListener('popstate', readHash);
async function loadCatalog() {
  $('#catalog-error').hidden = true; $('#result-count').textContent = '正在整理影像…';
  try {
    const response = await fetch(base + 'data/catalog.json'); if (!response.ok) throw new Error('catalog');
    const catalog = await response.json(); if (catalog.schemaVersion !== 1 || !Array.isArray(catalog.items) || catalog.count !== catalog.items.length) throw new Error('schema');
    items = catalog.items;
    const prompts = items.filter(item => item.prompt).length;
    $('#total-count').textContent = items.length;
    $('#hero-count').textContent = `${items.length} 个作品 · ${prompts} 条提示词 · ${items.length - prompts} 个效果参考`;
    $('#updated-at').textContent = `最近收录同步 ${new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(catalog.updatedAt))}`;
    $('[data-kind="all"] span').textContent = items.length; $('[data-kind="prompt"] span').textContent = prompts; $('[data-kind="reference"] span').textContent = items.length - prompts;
    ['source', 'model', 'method'].forEach(name => { const select = $(`#${name}-filter`); select.querySelectorAll('option:not(:first-child)').forEach(option => option.remove()); [...new Set(items.map(item => item[name]))].filter(Boolean).forEach(value => select.add(new Option(value, value))); });
    $('#tag-filters').innerHTML = [...new Set(items.flatMap(item => item.tags))].map(tag => `<button data-tag="${esc(tag)}" aria-pressed="false">${esc(tag)}</button>`).join('');
    applyFilters(); readHash();
  } catch { $('#catalog-error').hidden = false; $('#result-count').textContent = '加载未完成'; }
}
$('#retry-catalog').addEventListener('click', loadCatalog);
loadCatalog();
window.addEventListener('pagehide', () => { video.pause(); });
