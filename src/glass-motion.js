// Transform the inner shell only: masonry owns the article's position and height.
export function startGlassMotion(gallery) {
  const visible = new IntersectionObserver(entries => {
    for (const entry of entries) entry.target.classList.toggle('glass-visible', entry.isIntersecting);
  }, { rootMargin: '160px 0px' });
  new MutationObserver(records => {
    for (const record of records) {
      record.removedNodes.forEach(node => { if (node.nodeType === 1) visible.unobserve(node); });
      record.addedNodes.forEach(node => { if (node.nodeType === 1) visible.observe(node); });
    }
  }).observe(gallery, { childList: true });
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let active, frame = 0, point;
  const reset = () => {
    cancelAnimationFrame(frame); frame = 0;
    if (active) {
      for (const key of ['--tilt-x', '--tilt-y', '--shine-x', '--shine-y']) active.style.removeProperty(key);
      active.classList.remove('is-tilted');
    }
    active = null;
  };
  gallery.addEventListener('pointermove', event => {
    if (!fine.matches || reduced.matches || event.pointerType !== 'mouse') return;
    const shell = event.target.closest('.card-glass');
    if (shell !== active) { reset(); active = shell; }
    if (!active) return;
    point = { x: event.clientX, y: event.clientY };
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (!active?.isConnected) { reset(); return; }
      const rect = active.parentElement.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (point.x - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, (point.y - rect.top) / rect.height));
      active.style.setProperty('--tilt-x', `${(0.5 - y) * 7}deg`);
      active.style.setProperty('--tilt-y', `${(x - 0.5) * 7}deg`);
      active.style.setProperty('--shine-x', `${x * 100}%`);
      active.style.setProperty('--shine-y', `${y * 100}%`);
      active.classList.add('is-tilted');
    });
  }, { passive: true });
  gallery.addEventListener('pointerleave', reset);
  gallery.addEventListener('pointercancel', reset);
  window.addEventListener('blur', reset);
  window.addEventListener('scroll', reset, { passive: true });
  reduced.addEventListener('change', reset);
}

export function createDetailTransition(layout) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let sequence = 0, busy = false, animations = [], pendingSwap = null;
  const animate = (element, frames, duration, delay = 0) => {
    const animation = element.animate(frames, { duration, delay, easing: 'cubic-bezier(.22,.7,.2,1)', fill: 'both' });
    animations.push(animation);
    return animation.finished;
  };
  const cancel = () => {
    sequence++;
    animations.forEach(animation => animation.cancel());
    animations = []; busy = false; pendingSwap = null;
  };
  const finishImmediately = () => {
    const swap = pendingSwap;
    cancel();
    swap?.();
  };
  reduced.addEventListener('change', finishImmediately);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) finishImmediately();
  });
  return {
    get busy() { return busy; }, cancel,
    async move(direction, swap) {
      if (busy) return;
      if (document.hidden || reduced.matches || !layout.animate) { swap(); return; }
      busy = true;
      pendingSwap = swap;
      const run = ++sequence;
      try {
        await animate(layout, [
          { transform: 'perspective(1100px) translateX(0) rotateY(0) scale(1)', opacity: 1 },
          { transform: `perspective(1100px) translateX(${-direction * 48}px) rotateY(${-direction * 9}deg) scale(.96)`, opacity: 0 }
        ], 180);
        if (run !== sequence) return;
        animations.forEach(animation => animation.cancel()); animations = [];
        pendingSwap = null;
        swap();
        const incoming = animate(layout, [
          { transform: `perspective(1100px) translateX(${direction * 48}px) rotateY(${direction * 9}deg) scale(.96)`, opacity: 0 },
          { transform: 'perspective(1100px) translateX(0) rotateY(0) scale(1)', opacity: 1 }
        ], 360);
        const layers = [...layout.querySelectorAll('.work-media, .work-info')].map((element, index) => animate(element, [
          { transform: `translateX(${direction * (index ? 24 : 10)}px)`, opacity: .4 },
          { transform: 'translateX(0)', opacity: 1 }
        ], 300, index * 35));
        await Promise.all([incoming, ...layers]);
      } catch (error) {
        if (error.name !== 'AbortError') console.warn('Card transition:', error);
      } finally {
        if (run === sequence) cancel();
      }
    }
  };
}
