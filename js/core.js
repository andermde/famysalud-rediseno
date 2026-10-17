/* Famy Salud — comportamiento común a todas las páginas.
   El contenido es HTML completo; este archivo solo añade movimiento e interacción.
   Las páginas registran sus escenas en window.FamyScenes antes de que cargue este archivo:
     (window.FamyScenes ||= []).push((conditions, tools) => cleanupFn?) */
(() => {
  const root = document.documentElement;
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

  initMenu();
  initTabs();
  initBackgroundVideos();

  const hasMotionLibs = window.gsap && window.ScrollTrigger && window.SplitText && window.MorphSVGPlugin;
  // Si GSAP llegó después de que el contenido ya se mostrara sin movimiento, no se vuelve a ocultar nada.
  if (!hasMotionLibs || window.__famyMotionTimedOut) {
    root.classList.remove('motion-ready');
    return;
  }
  clearTimeout(window.__famyMotionFallback);
  gsap.registerPlugin(...[ScrollTrigger, SplitText, MorphSVGPlugin, window.Flip, window.ScrambleTextPlugin].filter(Boolean));

  // Activa (true) o no (false) el scroll suave con Lenis.
  // Recibe las condiciones de la media query activa: { desktop, mobile, reduce, finePointer }.
  function shouldUseSmoothScroll(conditions) {
    // TODO(human)
    return false;
  }

  const mm = gsap.matchMedia();

  mm.add(
    {
      // Rangos complementarios: con zoom del navegador el ancho puede ser fraccionario (800,5 px).
      desktop: '(width >= 801px)',
      mobile: '(width < 801px)',
      reduce: '(prefers-reduced-motion: reduce)',
      finePointer: '(hover: hover) and (pointer: fine)',
    },
    (context) => {
      const c = context.conditions;
      const cleanups = [];

      if (c.reduce) {
        root.classList.remove('motion-ready');
        return;
      }
      root.classList.add('motion-ready');
      if (c.desktop) root.classList.add('motion-desktop');

      const tools = {
        $, $$, cleanups, context,
        lenis: shouldUseSmoothScroll(c) && window.Lenis ? startLenis(cleanups) : null,
        whenFontsReady,
      };

      try {
        splitHeadings(c);
        dividers();
        reveals();
        if (c.finePointer) cursor(cleanups);
        if (c.finePointer && c.desktop) {
          tilt(cleanups);
          glassPointer(cleanups);
        }
        // Solo en escritorio: en pantallas estrechas el botón de la cabecera se desplazaría sobre el menú.
        if (c.finePointer && c.desktop) magnetic(cleanups);
        (window.FamyScenes || []).forEach((scene) => {
          const cleanup = scene(c, tools);
          if (typeof cleanup === 'function') cleanups.push(cleanup);
        });
      } catch (error) {
        // Una escena rota no puede dejar contenido oculto: se muestra todo sin movimiento.
        console.error('Famy Salud: error en una escena de movimiento', error);
        root.classList.remove('motion-ready', 'motion-desktop');
        setTimeout(() => mm.revert(), 0); // deshace también las fijaciones que alcanzaron a crearse
        return () => cleanups.forEach((fn) => fn());
      }

      document.fonts?.ready.then(() => ScrollTrigger.refresh());

      return () => {
        root.classList.remove('motion-desktop');
        cleanups.forEach((fn) => fn());
      };
    }
  );

  /* ---------- Scroll suave ---------- */

  function startLenis(cleanups) {
    const lenis = new Lenis({ lerp: 0.1, anchors: { offset: -80 } });
    const raf = (time) => lenis.raf(time * 1000);
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);
    cleanups.push(() => {
      gsap.ticker.remove(raf);
      gsap.ticker.lagSmoothing(500, 33);
      lenis.destroy();
    });
    return lenis;
  }

  // SplitText mide las letras: si corta antes de que llegue Montserrat, mide la fuente de reserva.
  // Se espera a la fuente como mucho 1,2 s para no dejar texto oculto con una conexión lenta.
  function whenFontsReady(fn) {
    let done = false;
    const run = () => { if (!done) { done = true; fn(); } };
    document.fonts?.ready.then(run);
    setTimeout(run, 1200);
  }

  /* ---------- Títulos que aparecen por líneas ---------- */

  function splitHeadings(c) {
    $$('[data-split-lines]').forEach((el) => {
      gsap.set(el, { visibility: 'visible' });
      if (c.desktop && el.closest('.about')) return; // en escritorio entra con su escena fijada
      SplitText.create(el, {
        type: 'lines',
        mask: 'lines',
        autoSplit: true,
        onSplit: (self) =>
          gsap.from(self.lines, {
            yPercent: 105,
            duration: 0.9,
            stagger: 0.09,
            ease: 'power3.out',
            scrollTrigger: { trigger: el, start: 'top 88%', toggleActions: 'play none none none' },
          }),
      });
    });
  }

  /* ---------- El trazo entre secciones y su punto final ---------- */

  function dividers() {
    $$('[data-divider]').forEach((path) => {
      const svg = path.ownerSVGElement;
      const endDot = $('[data-end-dot]', svg);
      gsap.set(path, { strokeDasharray: 1, strokeDashoffset: 1 });
      if (endDot) gsap.set(endDot, { scale: 0, transformOrigin: '50% 50%' });

      const tl = gsap.timeline({
        scrollTrigger: { trigger: svg, start: 'top 92%', end: 'bottom 45%', scrub: 0.6 },
      });
      tl.to(path, { strokeDashoffset: 0, ease: 'none', duration: 1 });
      if (endDot) tl.to(endDot, { scale: 1, ease: 'back.out(3)', duration: 0.25 });
    });
  }

  /* ---------- Apariciones genéricas ---------- */
  // Con opacity y no con autoAlpha: visibility:hidden sacaría el contenido del árbol de accesibilidad.

  function reveals() {
    ScrollTrigger.batch('[data-reveal]', {
      start: 'top 90%',
      once: true,
      onEnter: (batch) => gsap.fromTo(batch, { opacity: 0, y: 32 }, { opacity: 1, y: 0, duration: 0.7, stagger: 0.08, ease: 'power3.out', overwrite: true }),
    });
    $$('[data-reveal-list]').forEach((list) => {
      gsap.from(list.children, {
        opacity: 0,
        x: -16,
        duration: 0.5,
        stagger: 0.04,
        ease: 'power2.out',
        scrollTrigger: { trigger: list, start: 'top 85%', toggleActions: 'play none none none' },
      });
    });
  }

  /* ---------- Cursor: el punto del logo, que muestra fotos sobre las listas ---------- */
  // GSAP mueve el contenedor; el tamaño y la foto cambian en sus hijos con CSS, para no pisarse.

  function cursor(cleanups) {
    const box = $('.cursor');
    const img = $('.cursor__img', box);
    root.classList.add('has-cursor');
    const xTo = gsap.quickTo(box, 'x', { duration: 0.35, ease: 'power3.out' });
    const yTo = gsap.quickTo(box, 'y', { duration: 0.35, ease: 'power3.out' });

    const move = (e) => { xTo(e.clientX); yTo(e.clientY); };
    const over = (e) => {
      const withImage = e.target.closest('[data-hover-img]');
      if (withImage) {
        if (img.getAttribute('src') !== withImage.dataset.hoverImg) img.src = withImage.dataset.hoverImg;
        box.classList.add('has-image');
        box.classList.remove('is-grown');
        return;
      }
      box.classList.remove('has-image');
      box.classList.toggle('is-grown', !!e.target.closest('a, button, [role="tab"]'));
    };
    const leave = () => box.classList.add('is-away');
    const enter = () => box.classList.remove('is-away');

    window.addEventListener('pointermove', move, { passive: true });
    document.addEventListener('pointerover', over);
    root.addEventListener('pointerleave', leave);
    root.addEventListener('pointerenter', enter);
    cleanups.push(() => {
      root.classList.remove('has-cursor');
      box.classList.remove('has-image', 'is-grown', 'is-away');
      window.removeEventListener('pointermove', move);
      document.removeEventListener('pointerover', over);
      root.removeEventListener('pointerleave', leave);
      root.removeEventListener('pointerenter', enter);
    });
  }

  function magnetic(cleanups) {
    const FIELD = 90;      // radio de atracción alrededor del botón, en px
    const STRENGTH = 0.35; // fracción de la distancia que se desplaza el botón
    const magnets = $$('[data-magnetic]').map((el) => ({
      el,
      xTo: gsap.quickTo(el, 'x', { duration: 0.6, ease: 'elastic.out(1, 0.4)' }),
      yTo: gsap.quickTo(el, 'y', { duration: 0.6, ease: 'elastic.out(1, 0.4)' }),
    }));

    let frame = 0;
    const onMove = (e) => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        magnets.forEach(({ el, xTo, yTo }) => {
          const r = el.getBoundingClientRect();
          if (r.bottom < -FIELD || r.top > innerHeight + FIELD) return;
          const dx = e.clientX - (r.left + r.width / 2);
          const dy = e.clientY - (r.top + r.height / 2);
          const inside = Math.abs(dx) < r.width / 2 + FIELD && Math.abs(dy) < r.height / 2 + FIELD;
          xTo(inside ? dx * STRENGTH : 0);
          yTo(inside ? dy * STRENGTH : 0);
        });
      });
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    cleanups.push(() => {
      window.removeEventListener('pointermove', onMove);
      cancelAnimationFrame(frame);
      magnets.forEach(({ el }) => gsap.set(el, { clearProps: 'transform' }));
    });
  }

  /* ---------- Vídeos de fondo ---------- */
  // Solo en escritorio, sin ahorro de datos y sin movimiento reducido; si no, queda la imagen de portada.
  // Se cargan al acercarse a la pantalla y se pausan al salir, para no gastar batería ni datos.

  function initBackgroundVideos() {
    const videos = $$('video[data-bg-video]');
    if (!videos.length) return;
    const wide = matchMedia('(width >= 801px)');
    const calm = matchMedia('(prefers-reduced-motion: reduce)');
    const allowed = () => wide.matches && !calm.matches && !navigator.connection?.saveData;
    if (!('IntersectionObserver' in window)) return;

    // Si con la página abierta la ventana se estrecha o se pide menos movimiento, se pausan.
    const onChange = () => { if (!allowed()) videos.forEach((v) => v.pause()); };
    wide.addEventListener('change', onChange);
    calm.addEventListener('change', onChange);

    const io = new IntersectionObserver((entries) => {
      entries.forEach(({ target: video, isIntersecting }) => {
        if (isIntersecting && allowed()) {
          const sources = $$('source[data-src]', video);
          if (sources.length) {
            sources.forEach((source) => { source.src = source.dataset.src; source.removeAttribute('data-src'); });
            video.load();
          }
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      });
    }, { rootMargin: '200px 0px' });
    videos.forEach((video) => io.observe(video));
  }

  /* ---------- Inclinación 3D con reflejo y brillo del vidrio ---------- */

  function tilt(cleanups) {
    const MAX = 6; // grados
    root.classList.add('has-tilt');
    const items = $$('[data-tilt]').map((el) => ({
      el,
      rx: gsap.quickTo(el, 'rotationX', { duration: 0.5, ease: 'power3.out' }),
      ry: gsap.quickTo(el, 'rotationY', { duration: 0.5, ease: 'power3.out' }),
    }));
    const handlers = items.map(({ el, rx, ry }) => {
      gsap.set(el, { transformPerspective: 900 });
      const move = (e) => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        rx((0.5 - py) * MAX);
        ry((px - 0.5) * MAX);
        el.style.setProperty('--gx', (px * 100).toFixed(1) + '%');
        el.style.setProperty('--gy', (py * 100).toFixed(1) + '%');
        el.style.setProperty('--glare', '1');
      };
      const leave = () => { rx(0); ry(0); el.style.setProperty('--glare', '0'); };
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerleave', leave);
      return { el, move, leave };
    });
    cleanups.push(() => {
      root.classList.remove('has-tilt');
      handlers.forEach(({ el, move, leave }) => {
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerleave', leave);
        gsap.set(el, { clearProps: 'transform' });
        ['--gx', '--gy', '--glare'].forEach((v) => el.style.removeProperty(v));
      });
    });
  }

  // El reflejo del botón de vidrio sigue al ratón (variables --mx y --my del CSS).
  function glassPointer(cleanups) {
    const move = (e) => {
      const btn = e.target.closest('.btn');
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      btn.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%');
      btn.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%');
    };
    document.addEventListener('pointermove', move, { passive: true });
    cleanups.push(() => document.removeEventListener('pointermove', move));
  }

  /* ---------- Menú móvil (funciona con o sin GSAP) ---------- */

  function initMenu() {
    const toggle = $('[data-menu-toggle]');
    const list = $('#menu');
    const icon = $('[data-menu-icon]');
    if (!toggle || !list || !icon) return;
    const BARS = icon.getAttribute('d');
    const CROSS = 'M5.6 4.2 12 10.6l6.4-6.4 1.4 1.4-6.4 6.4 6.4 6.4-1.4 1.4-6.4-6.4-6.4 6.4-1.4-1.4 6.4-6.4-6.4-6.4z';

    const setOpen = (open) => {
      toggle.setAttribute('aria-expanded', String(open));
      $('.visually-hidden', toggle).textContent = open ? 'Cerrar menú' : 'Abrir menú';
      list.classList.toggle('is-open', open);
      const d = open ? CROSS : BARS;
      const canMorph = window.gsap && window.MorphSVGPlugin && !matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (canMorph) gsap.to(icon, { morphSVG: d, duration: 0.35, ease: 'power2.inOut' });
      else icon.setAttribute('d', d);
    };

    toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
    list.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && list.classList.contains('is-open')) { setOpen(false); toggle.focus(); }
    });
  }

  /* ---------- Pestañas accesibles (patrón WAI-ARIA, activación automática) ---------- */
  // Sin JS todos los paneles se ven; aquí se ocultan los que no están seleccionados.

  function initTabs() {
    $$('[data-tabs]').forEach((box) => {
      const tabs = $$('[role="tab"]', box);
      const select = (tab, focus) => {
        tabs.forEach((t) => {
          const on = t === tab;
          t.setAttribute('aria-selected', String(on));
          t.tabIndex = on ? 0 : -1;
          document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
        });
        if (focus) tab.focus();
      };
      select(tabs.find((t) => t.getAttribute('aria-selected') === 'true') || tabs[0], false);
      tabs.forEach((tab, i) => {
        tab.addEventListener('click', () => select(tab, false));
        tab.addEventListener('keydown', (e) => {
          const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
          if (next === undefined) return;
          e.preventDefault();
          select(tabs[(next + tabs.length) % tabs.length], true);
        });
      });
    });
  }
})();
