/* Famy Salud — filtros de Actualidad. Las tarjetas se reordenan con Flip si hay movimiento. */
(() => {
  const root = document.documentElement;
  const grid = document.querySelector('[data-news-grid]');
  const box = document.querySelector('[data-filters]');
  const status = document.querySelector('[data-filter-status]');
  if (!grid || !box) return;

  const cards = [...grid.querySelectorAll('.news-card')];
  const buttons = [...box.querySelectorAll('[data-filter]')];
  const NOMBRES = { todas: 'publicaciones', noticias: 'noticias', eventos: 'publicaciones de bienestar', convocatorias: 'convocatorias' };

  function apply(filter, animate) {
    const useFlip = animate && window.Flip && root.classList.contains('motion-ready');
    const state = useFlip ? Flip.getState(cards) : null;
    // Durante el Flip las tarjetas van en posición absoluta y la rejilla colapsaría: se mantiene su altura.
    if (useFlip) grid.style.minHeight = grid.offsetHeight + 'px';

    buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filter === filter)));
    let shown = 0;
    cards.forEach((card) => {
      const on = filter === 'todas' || card.dataset.cat === filter;
      card.hidden = !on;
      if (on) shown++;
    });
    status.textContent = `Mostrando ${shown} ${NOMBRES[filter]}.`;

    if (useFlip) {
      Flip.from(state, {
        duration: 0.6,
        ease: 'power3.inOut',
        scale: true,
        absolute: true,
        onEnter: (els) => gsap.fromTo(els, { autoAlpha: 0, scale: 0.85 }, { autoAlpha: 1, scale: 1, duration: 0.5 }),
        onLeave: (els) => gsap.to(els, { autoAlpha: 0, scale: 0.85, duration: 0.35 }),
        onComplete: () => {
          grid.style.minHeight = '';
          window.ScrollTrigger?.refresh();
        },
      });
    }
  }

  box.addEventListener('click', (e) => {
    const button = e.target.closest('[data-filter]');
    if (!button) return;
    apply(button.dataset.filter, true);
    history.replaceState(null, '', button.dataset.filter === 'todas' ? location.pathname : '#' + button.dataset.filter);
  });

  const initial = location.hash.slice(1);
  if (NOMBRES[initial]) apply(initial, false);
})();
