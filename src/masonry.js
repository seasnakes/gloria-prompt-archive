export function masonryLayout(heights, width, columns, gap = 16) {
  if (!(width > 0) || !columns) return { positions: [], height: 0, columnWidth: 0 };
  const columnWidth = (width - gap * (columns - 1)) / columns;
  const bottoms = Array(columns).fill(0);
  const positions = heights.map(height => {
    const column = bottoms.indexOf(Math.min(...bottoms));
    const position = { x: column * (columnWidth + gap), y: bottoms[column] };
    bottoms[column] += height + gap;
    return position;
  });
  return { positions, height: Math.max(0, ...bottoms) - (heights.length ? gap : 0), columnWidth };
}

export function createMasonry(container) {
  let frame = 0, previousWidth = 0;
  function layout() {
    frame = 0;
    const width = container.clientWidth;
    if (!width) return;
    const columns = width >= 1100 ? 4 : width >= 780 ? 3 : 2;
    const gap = width < 480 ? 12 : 16;
    const cards = [...container.children];
    const columnWidth = (width - gap * (columns - 1)) / columns;
    cards.forEach(card => { card.style.width = `${columnWidth}px`; });
    const result = masonryLayout(cards.map(card => card.offsetHeight), width, columns, gap);
    cards.forEach((card, i) => {
      card.style.transform = `translate3d(${result.positions[i].x}px,${result.positions[i].y}px,0)`;
    });
    container.style.height = `${result.height}px`;
    container.dataset.columns = columns;
  }
  function schedule() { if (!frame) frame = requestAnimationFrame(layout); }
  const resize = new ResizeObserver(([entry]) => {
    if (Math.abs(entry.contentRect.width - previousWidth) < .5) return;
    previousWidth = entry.contentRect.width;
    schedule();
  });
  resize.observe(container);
  document.fonts?.ready.then(schedule);
  return { layout, schedule };
}
