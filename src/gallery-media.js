// Observe the whole card. A skeleton always reserves a non-zero media area.
export function createCoverLoader(resolveURL, onSize) {
  const jobs = new WeakMap();
  const queue = [];
  let active = 0;
  function pump() {
    while (active < 6 && queue.length) {
      const job = queue.shift();
      if (!job.card.isConnected || job.cancelled) continue;
      active++;
      load(job).finally(() => { active--; pump(); });
    }
  }
  async function load(job) {
    const { card, item, img } = job;
    card.classList.remove('failed', 'ready');
    const url = resolveURL(item.cover);
    try {
      if (!url || url.startsWith('data:')) throw new Error('No cover');
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => { cleanup(); reject(new Error('timeout')); }, 25000);
        function cleanup() { clearTimeout(timer); img.onload = img.onerror = null; }
        img.onload = () => { cleanup(); resolve(); };
        img.onerror = () => { cleanup(); reject(new Error('image')); };
        img.src = url;
      });
      await img.decode();
      if (job.cancelled || !card.isConnected || img.src !== url) return;
      if (!(img.naturalWidth > 1 && img.naturalHeight > 1)) throw new Error('placeholder');
      if (!item.aspectKnown) {
        item.width = img.naturalWidth; item.height = img.naturalHeight; item.aspectKnown = true;
        card.querySelector('.card-media').style.setProperty('--ratio', `${item.width}/${item.height}`);
        onSize();
      }
      card.classList.add('ready');
    } catch {
      if (!job.cancelled && card.isConnected) card.classList.add('failed');
    }
  }
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      observer.unobserve(entry.target);
      const job = jobs.get(entry.target);
      if (job) { queue.push(job); pump(); }
    }
  }, { rootMargin: '600px 0px' });
  return {
    observe(card, item) {
      const job = { card, item, img: card.querySelector('img'), cancelled: false };
      jobs.set(card, job); observer.observe(card);
    },
    clear(container) {
      for (const card of container.children) { observer.unobserve(card); const job = jobs.get(card); if (job) job.cancelled = true; }
    },
    retry(card) { const job = jobs.get(card); if (job) { queue.push(job); pump(); } },
  };
}
