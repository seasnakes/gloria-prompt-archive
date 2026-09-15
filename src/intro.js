import Typed from 'typed.js';
import triangle from './assets/seasnake-logo-triangle.svg?raw';

export function startIntro() {
  document.querySelectorAll('[data-logo]').forEach(el => {
    const suffix = el.dataset.logo;
    el.innerHTML = triangle.replaceAll('seasnake-logo-triangle', `seasnake-logo-triangle-${suffix}`).replaceAll('id="title"', `id="title-${suffix}"`).replaceAll('id="desc"', `id="desc-${suffix}"`).replace('aria-labelledby="title desc"', `aria-labelledby="title-${suffix} desc-${suffix}"`);
  });
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const writers = [];
  function type(element, string, speed, delay = 0) {
    const html = element.innerHTML;
    element.setAttribute('aria-label', element.textContent);
    element.classList.add('typewriter');
    element.innerHTML = `<span class="typewriter-reserve" aria-hidden="true">${html}</span><span class="typewriter-output" aria-hidden="true"></span>`;
    const output = element.querySelector('.typewriter-output');
    const writer = { output, html, instance: null, started: false }; writers.push(writer);
    return () => {
      if (writer.started) return; writer.started = true;
      if (reduced.matches) output.innerHTML = html;
      else writer.instance = new Typed(output, { strings: [string], typeSpeed: speed, startDelay: delay, showCursor: false });
    };
  }
  type(document.querySelector('#hero-title'), '光彩跃然', 200)();
  type(document.querySelector('#hero-poem'), '宛如^500一只蓝色蝴蝶^500扑闪着翅膀在无边海洋上空^500漫舞^500、求索。', 100)();
  reduced.addEventListener('change', event => { if (event.matches) writers.forEach(w => { w.instance?.destroy(); w.instance = null; w.output.innerHTML = w.html; }); });
  const observer = new IntersectionObserver(([entry]) => document.querySelector('.site-header').classList.toggle('scrolled', !entry.isIntersecting), { rootMargin: '-110px 0px 0px 0px' });
  observer.observe(document.querySelector('.hero'));
  window.addEventListener('pagehide', event => { if (!event.persisted) { observer.disconnect(); writers.forEach(w => w.instance?.destroy()); } });
}
