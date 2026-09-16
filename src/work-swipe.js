export function swipeDirection(dx, dy, duration) {
  if (duration > 1600 || Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.6) return 0;
  return dx < 0 ? 1 : -1;
}

export function startWorkSwipe(dialog, move) {
  let start = null, dragging = false, suppressClickUntil = 0;
  const clear = () => { start = null; dragging = false; dialog.classList.remove('is-swiping'); };
  dialog.addEventListener('pointerdown', event => {
    if (!dialog.open || !event.isPrimary || event.button !== 0) return;
    if (!event.target.closest('.work-media, .dialog-toolbar')) return;
    if (event.target.closest('button,a,input,select')) return;
    // Leave the native play button, timeline and fullscreen controls alone.
    const video = event.target.closest('video');
    if (video && event.clientY > video.getBoundingClientRect().bottom - 64) return;
    start = { id: event.pointerId, x: event.clientX, y: event.clientY, time: performance.now() };
  }, { passive: true });
  dialog.addEventListener('pointermove', event => {
    if (!start || event.pointerId !== start.id) return;
    const dx = event.clientX - start.x, dy = event.clientY - start.y;
    if (!dragging && Math.abs(dy) > 14 && Math.abs(dy) > Math.abs(dx)) { clear(); return; }
    if (!dragging && Math.abs(dx) > 14 && Math.abs(dx) > Math.abs(dy) * 1.6) {
      dragging = true;
      dialog.setPointerCapture(event.pointerId);
      dialog.classList.add('is-swiping');
    }
    if (dragging && event.cancelable) event.preventDefault();
  });
  dialog.addEventListener('pointerup', event => {
    if (!start || event.pointerId !== start.id) return;
    const direction = swipeDirection(event.clientX - start.x, event.clientY - start.y, performance.now() - start.time);
    if (dragging) suppressClickUntil = performance.now() + 400;
    clear();
    if (dialog.hasPointerCapture(event.pointerId)) dialog.releasePointerCapture(event.pointerId);
    if (direction) move(direction);
  });
  dialog.addEventListener('click', event => {
    if (performance.now() < suppressClickUntil && !event.target.closest('button,a')) {
      event.preventDefault(); event.stopImmediatePropagation();
    }
  }, true);
  dialog.addEventListener('pointercancel', clear);
  dialog.addEventListener('lostpointercapture', event => {
    // Touch starts with implicit capture on the video. Transferring it to the
    // dialog emits a bubbling loss from the video; the drag is still active.
    if (event.target === dialog) clear();
  });
  dialog.addEventListener('close', clear);
}
