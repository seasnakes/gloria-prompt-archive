export function startStickyFilters() {
  const header = document.querySelector('.site-header');
  const anchor = document.querySelector('.filter-anchor');
  const panel = document.querySelector('.filter-panel');
  let height = 0, headerHeight = 0, lastY = scrollY, distance = 0, direction = 0, frame = 0, fixed = false, hidden = false;
  function show(hide) {
    hidden = hide;
    panel.classList.toggle('is-hidden', hide);
    panel.inert = hide;
  }
  function measure() {
    headerHeight = header.getBoundingClientRect().height;
    height = panel.getBoundingClientRect().height;
    document.documentElement.style.setProperty('--header-height', `${headerHeight}px`);
    anchor.style.height = `${height}px`;
    panel.style.setProperty('--filter-left', `${anchor.getBoundingClientRect().left}px`);
    panel.style.setProperty('--filter-width', `${anchor.clientWidth}px`);
    update();
  }
  function update() {
    frame = 0;
    const y = Math.max(0, scrollY), delta = y - lastY;
    const rect = anchor.getBoundingClientRect();
    fixed = rect.top <= headerHeight;
    panel.classList.toggle('is-fixed', fixed);
    header.classList.toggle('with-filters', fixed);
    const editing = panel.contains(document.activeElement) && document.activeElement.matches('input,textarea,select');
    if (!fixed || rect.bottom > headerHeight || editing) {
      show(false); distance = 0;
    } else if (Math.abs(delta) > 1) {
      const next = Math.sign(delta);
      distance = next === direction ? distance + Math.abs(delta) : Math.abs(delta);
      direction = next;
      if (distance > (next > 0 ? 32 : 12)) show(next > 0);
    }
    lastY = y;
  }
  const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
  const observer = new ResizeObserver(measure);
  observer.observe(header); observer.observe(panel); observer.observe(anchor);
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', measure, { passive: true });
  panel.addEventListener('focusin', () => show(false));
  document.fonts?.ready.then(measure);
  measure();
  return { reveal() { show(false); distance = 0; } };
}
