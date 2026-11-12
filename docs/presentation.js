(() => {
  'use strict';
  const slides = Array.from(document.querySelectorAll('.slide'));
  const progress = document.querySelector('.slide-progress');
  const counter = document.querySelector('[data-slide-counter]');
  let current = 0;

  function show(index) {
    if (!slides.length) return;
    current = Math.max(0, Math.min(slides.length - 1, index));
    slides.forEach((slide, position) => {
      const active = position === current;
      slide.classList.toggle('active', active);
      slide.setAttribute('aria-hidden', active ? 'false' : 'true');
    });
    if (progress) {
      progress.max = slides.length;
      progress.value = current + 1;
    }
    if (counter) counter.textContent = (current + 1) + ' / ' + slides.length;
    const title = slides[current].querySelector('h1')?.textContent || 'Ví Nhỏ';
    document.title = title + ' — Ví Nhỏ';
    history.replaceState(null, '', '#slide-' + (current + 1));
  }

  function fromHash() {
    const match = location.hash.match(/slide-(\d+)/);
    return match ? Number(match[1]) - 1 : 0;
  }

  document.querySelector('[data-previous]')?.addEventListener('click', () => show(current - 1));
  document.querySelector('[data-next]')?.addEventListener('click', () => show(current + 1));
  document.querySelector('[data-print]')?.addEventListener('click', () => window.print());
  document.querySelector('[data-fullscreen]')?.addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.();
  });

  window.addEventListener('hashchange', () => show(fromHash()));
  window.addEventListener('keydown', event => {
    if (['ArrowRight', 'PageDown', ' ', 'Enter'].includes(event.key)) {
      event.preventDefault(); show(current + 1);
    } else if (['ArrowLeft', 'PageUp', 'Backspace'].includes(event.key)) {
      event.preventDefault(); show(current - 1);
    } else if (event.key === 'Home') show(0);
    else if (event.key === 'End') show(slides.length - 1);
    else if (event.key.toLowerCase() === 'f') document.querySelector('[data-fullscreen]')?.click();
  });

  show(fromHash());
})();
