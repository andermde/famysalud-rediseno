/* Famy Salud — escenas de la home. Se ejecutan dentro del gsap.matchMedia() de core.js. */
(() => {
  const root = document.documentElement;
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

  // Interacciones que deben funcionar aunque no haya movimiento ni GSAP.
  initBento();
  initCoverageHighlight();

  (window.FamyScenes ||= []).push((c, tools) => {
    // La intro arranca cuando llega la fuente, quizá después de que el contexto se haya creado:
    // se registra en él para que se revierta al cambiar de breakpoint (si no, SplitText parte el título otra vez).
    let alive = true;
    tools.context.add('heroIntro', heroIntro);
    tools.whenFontsReady(() => { if (alive) tools.context.heroIntro(); });
    tools.cleanups.push(() => { alive = false; });

    if (c.desktop) heroParallax(); // en móvil la foto bajaría sobre el dibujo de la familia
    heroCounters(tools.cleanups);
    doors(c, tools.cleanups);
    marquee();
    manifesto();
    coverage();
    collage(c);

    if (c.desktop) {
      if (c.finePointer) heroShader(tools.cleanups);
      aboutPinned(tools.cleanups);
      policiesPinned(tools.lenis, tools.cleanups);
      timelineHorizontal(tools.cleanups);
    } else {
      aboutMobile();
    }
  });

  /* ---------- Hero ---------- */

  function heroIntro() {
    const title = $('[data-split-chars]');
    const draws = $$('.hero__family [data-draw]');
    const ecg = $('.hero__family [data-ecg]');
    const dot = $('.hero__family [data-dot]');

    gsap.set(title, { opacity: 1 });
    const split = SplitText.create(title, { type: 'words,chars', mask: 'words' });
    gsap.set(draws, { strokeDasharray: 1, strokeDashoffset: 1 });
    gsap.set(dot, { scale: 0, transformOrigin: '50% 50%' });

    gsap.timeline({ defaults: { ease: 'power3.out' } })
      .fromTo('.hero [data-intro]', { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.8, stagger: 0.08 }, 0)
      .from(split.chars, { yPercent: 110, duration: 0.9, stagger: 0.018 }, 0.1)
      .fromTo('.hero__media', { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.2, ease: 'power4.inOut' }, 0.2)
      .to(draws.filter((el) => el !== ecg), { strokeDashoffset: 0, duration: 1.4, stagger: 0.07, ease: 'power2.inOut' }, 0.5)
      .to(ecg, { strokeDashoffset: 0, duration: 1.3, ease: 'power2.inOut' }, 1.2)
      .to(dot, { scale: 1, duration: 0.5, ease: 'back.out(3)' }, 2.4);
  }

  function heroParallax() {
    $$('.hero [data-depth]').forEach((layer) => {
      const depth = parseFloat(layer.dataset.depth);
      gsap.to(layer, {
        y: () => depth * window.innerHeight,
        ease: 'none',
        scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true, invalidateOnRefresh: true },
      });
    });
  }

  // Cifras que suben, y fuente variable que engorda con la velocidad del scroll.
  function heroCounters(cleanups) {
    const nums = $$('[data-count]');
    nums.forEach((el) => {
      const counter = { value: 0 };
      gsap.to(counter, {
        value: Number(el.dataset.count),
        duration: 1.6,
        delay: 0.6,
        ease: 'power2.out',
        onUpdate: () => { el.textContent = Math.round(counter.value); },
      });
    });

    const setWeight = nums.map((el) => gsap.quickTo(el, 'fontWeight', { duration: 0.5, ease: 'power3.out' }));
    const settle = gsap.delayedCall(0.18, () => setWeight.forEach((fn) => fn(400))).pause();
    ScrollTrigger.create({
      trigger: '.stats',
      start: 'top bottom',
      end: 'bottom top',
      onUpdate: (self) => {
        const weight = gsap.utils.clamp(400, 900, 400 + Math.abs(self.getVelocity()) / 5);
        setWeight.forEach((fn) => fn(weight));
        settle.restart(true);
      },
    });
    cleanups.push(() => {
      settle.kill();
      nums.forEach((el) => { el.textContent = el.dataset.count; });
    });
  }

  /* ---------- Fondo WebGL del hero ---------- */
  // Programa y buffers se crean una sola vez por página: cada entrada a escritorio solo arranca y para el bucle.

  let shader = null;

  function setupShader(canvas) {
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false });
    if (!gl) return null;
    const vertex = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
    const fragment = `
      precision mediump float;
      uniform vec2 r; uniform float t; uniform vec2 m;
      float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
        return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
      float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*n(p);p*=2.;a*=.5;}return v;}
      void main(){
        vec2 uv=gl_FragCoord.xy/r;
        vec2 q=uv*vec2(r.x/r.y,1.)*1.6;
        float f=fbm(q+vec2(t*.035,t*.025)+fbm(q*1.4-t*.02));
        f+=.28*smoothstep(.45,0.,distance(uv,m));
        vec3 paper=vec3(.961,.953,.918), lima=vec3(.494,.714,.122), pulso=vec3(.059,.561,.184);
        vec3 c=mix(paper,lima,smoothstep(.48,.95,f)*.32);
        c=mix(c,pulso,smoothstep(.8,1.1,f)*.16);
        gl_FragColor=vec4(c,1.);
      }`;
    const compile = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, vertex));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fragment));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const state = {
      gl,
      uR: gl.getUniformLocation(prog, 'r'),
      uT: gl.getUniformLocation(prog, 't'),
      uM: gl.getUniformLocation(prog, 'm'),
      lost: false,
    };
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); state.lost = true; canvas.classList.remove('is-on'); });
    return state;
  }

  function heroShader(cleanups) {
    const canvas = $('[data-shader]');
    if (!canvas) return;
    if (!shader) shader = setupShader(canvas);
    if (!shader || shader.lost) return;
    const { gl, uR, uT, uM } = shader;

    const SCALE = 0.5; // media resolución: es un degradado difuso y así cuesta un cuarto
    const resize = () => {
      canvas.width = Math.round(canvas.clientWidth * SCALE);
      canvas.height = Math.round(canvas.clientHeight * SCALE);
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    resize();
    canvas.classList.add('is-on');

    const pointer = { x: innerWidth * 0.7, y: innerHeight * 0.4 };
    const mouse = { x: 0.7, y: 0.6 };
    const onMove = (e) => { pointer.x = e.clientX; pointer.y = e.clientY; };

    let visible = true;
    const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; });
    io.observe(canvas);

    const render = (time) => {
      if (!visible || document.hidden || shader.lost) return;
      const b = canvas.getBoundingClientRect(); // una vez por fotograma, no por cada movimiento del ratón
      const tx = (pointer.x - b.left) / b.width;
      const ty = 1 - (pointer.y - b.top) / b.height;
      mouse.x += (tx - mouse.x) * 0.05;
      mouse.y += (ty - mouse.y) * 0.05;
      gl.uniform2f(uR, canvas.width, canvas.height);
      gl.uniform1f(uT, time);
      gl.uniform2f(uM, mouse.x, mouse.y);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    gsap.ticker.add(render);
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('resize', resize);
    cleanups.push(() => {
      gsap.ticker.remove(render);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('resize', resize);
      io.disconnect();
      canvas.classList.remove('is-on');
    });
  }

  // El punto del logo se transforma en el icono de cada puerta.
  function doors(c, cleanups) {
    ScrollTrigger.batch('[data-door]', {
      start: 'top 92%',
      once: true,
      onEnter: (batch) => gsap.fromTo(batch, { opacity: 0, y: 30 }, {
        opacity: 1, y: 0, stagger: 0.1, duration: 0.7, ease: 'power3.out',
        clearProps: 'transform', // devuelve el transform al CSS para que funcione el :hover
      }),
    });

    $$('[data-door]').forEach((door) => {
      const shape = $('.door__shape', door);
      const target = $('.door__target', door);
      const dotPath = shape.getAttribute('d');
      const toIcon = () => gsap.to(shape, { morphSVG: target, duration: 0.55, ease: 'power2.inOut', overwrite: true });
      const toDot = () => gsap.to(shape, { morphSVG: dotPath, duration: 0.45, ease: 'power2.inOut', overwrite: true });

      if (c.finePointer) {
        const events = [['pointerenter', toIcon], ['focus', toIcon], ['pointerleave', toDot], ['blur', toDot]];
        events.forEach(([type, fn]) => door.addEventListener(type, fn));
        cleanups.push(() => events.forEach(([type, fn]) => door.removeEventListener(type, fn)));
      } else {
        ScrollTrigger.create({ trigger: door, start: 'top 80%', once: true, onEnter: toIcon });
      }
      cleanups.push(() => {
        gsap.killTweensOf(shape);
        shape.setAttribute('d', dotPath);
      });
    });
  }

  /* ---------- Accesos rápidos: celdas que se expanden (Flip) ---------- */

  function initBento() {
    const grid = $('[data-bento]');
    if (!grid) return;
    grid.addEventListener('click', (e) => {
      const button = e.target.closest('[data-bento-toggle]');
      if (!button) return;
      const cell = button.closest('.bento__cell');
      const open = button.getAttribute('aria-expanded') !== 'true';
      const animate = window.Flip && root.classList.contains('motion-ready');
      const state = animate ? Flip.getState($$('.bento__cell', grid)) : null;

      $$('[data-bento-toggle]', grid).forEach((b) => {
        const mine = b === button;
        b.setAttribute('aria-expanded', String(mine && open));
        b.closest('.bento__cell').classList.toggle('is-open', mine && open);
      });

      if (animate) {
        Flip.from(state, { duration: 0.6, ease: 'power3.inOut', nested: true, absolute: false });
        if (open) gsap.from($('.bento__more', cell), { opacity: 0, y: 12, duration: 0.4, delay: 0.25 });
      }
    });
  }

  /* ---------- Quiénes somos ---------- */

  function aboutPinned(cleanups) {
    const section = $('.about');
    const media = $('.about__media');
    const img = $('img', media);
    const content = $('.about__content');
    const panels = $$('.about [data-panel]');
    const steps = $$('[data-step-dot]');

    gsap.set(media, { clipPath: 'inset(0% 0% 0% 0% round 0px)' });
    gsap.set(img, { scale: 1.2 });
    gsap.set(content, { opacity: 0, x: 60 });
    gsap.set(panels, { opacity: 0, y: 40 });

    const setStep = (index) => steps.forEach((li, i) => li.classList.toggle('is-active', i === index));
    setStep(0);

    // onUpdate en la línea de tiempo (no en el ScrollTrigger): con scrub, la línea de tiempo
    // sigue avanzando después de que el scroll se detiene, y el indicador tiene que seguirla a ella.
    const tl = gsap.timeline({
      defaults: { ease: 'power2.out' },
      onUpdate: () => setStep(tl.time() < tl.labels.vision ? 0 : tl.time() < tl.labels.valores ? 1 : 2),
      scrollTrigger: { trigger: section, start: 'top top', end: '+=2600', pin: true, scrub: 0.6, invalidateOnRefresh: true },
    });

    // La persona nítida está en la mitad derecha de la foto: se desliza hacia la ventana que queda a la izquierda.
    // El borde izquierdo de la foto recortada coincide con el de la rejilla del resto de la página.
    const left = () => (Math.max(16, (innerWidth - 1240) / 2) / innerWidth * 100).toFixed(2);
    tl.to(media, { clipPath: () => `inset(9% 52% 9% ${left()}% round 28px)`, duration: 1, ease: 'none' }, 0)
      .to(img, { scale: 1.05, xPercent: -44, duration: 1, ease: 'none' }, 0)
      .to(content, { opacity: 1, x: 0, duration: 0.5 }, 0.8)
      .addLabel('mision', 1.1)
      .to(panels[0], { opacity: 1, y: 0, duration: 0.4 }, 'mision')
      .to(panels[0], { opacity: 0, y: -40, duration: 0.4 }, 'mision+=0.9')
      .addLabel('vision', 'mision+=1.1')
      .to(panels[1], { opacity: 1, y: 0, duration: 0.4 }, 'vision')
      .to(panels[1], { opacity: 0, y: -40, duration: 0.4 }, 'vision+=0.9')
      .addLabel('valores', 'vision+=1.1')
      .to(panels[2], { opacity: 1, y: 0, duration: 0.4 }, 'valores')
      .from($$('.about .values li'), { opacity: 0, x: 30, stagger: 0.1, duration: 0.3 }, 'valores+=0.2')
      .to({}, { duration: 0.6 });

    // El único enlace está en Valores: si llega el foco de teclado, se lleva el scroll hasta ese panel.
    const onFocus = (e) => {
      if (!e.target.matches(':focus-visible')) return;
      const st = tl.scrollTrigger;
      window.scrollTo(0, st.start + (st.end - st.start) * ((tl.labels.valores + 0.6) / tl.duration()));
    };
    section.addEventListener('focusin', onFocus);
    cleanups.push(() => section.removeEventListener('focusin', onFocus));
  }

  function aboutMobile() {
    gsap.fromTo('.about__media img', { scale: 1.15 }, {
      scale: 1,
      ease: 'none',
      scrollTrigger: { trigger: '.about__media', start: 'top bottom', end: 'bottom top', scrub: true },
    });
    $$('.about [data-panel]').forEach((panel) => {
      gsap.from(panel, {
        opacity: 0, y: 30, duration: 0.7, ease: 'power3.out',
        scrollTrigger: { trigger: panel, start: 'top 88%', toggleActions: 'play none none none' },
      });
    });
  }

  /* ---------- Servicios: las dos filas de perfiles se cruzan con el scroll ---------- */

  function marquee() {
    $$('[data-marquee]').forEach((row) => {
      const dir = Number(row.dataset.marquee);
      gsap.fromTo(row, { xPercent: dir > 0 ? -30 : 0 }, {
        xPercent: dir > 0 ? 0 : -30,
        ease: 'none',
        scrollTrigger: { trigger: '.services-teaser', start: 'top bottom', end: 'bottom top', scrub: 0.4 },
      });
    });
  }

  /* ---------- Manifiesto: la frase se llena de color con el scroll ---------- */

  function manifesto() {
    const quote = $('[data-fill-words]');
    if (!quote) return;
    gsap.fromTo('.manifesto__media', { scale: 1.08 }, {
      scale: 1,
      ease: 'none',
      scrollTrigger: { trigger: '.manifesto', start: 'top bottom', end: 'bottom top', scrub: true },
    });
    SplitText.create(quote, {
      type: 'words',
      autoSplit: true,
      onSplit: (self) =>
        gsap.fromTo(self.words, { color: 'rgb(255 255 255 / 0.45)' }, {
          color: 'rgb(255 255 255 / 1)',
          stagger: 0.12,
          ease: 'none',
          scrollTrigger: { trigger: '.manifesto', start: 'top 70%', end: 'center 60%', scrub: true },
        }),
    });
  }

  /* ---------- Políticas: tarjetas apiladas ---------- */

  function policiesPinned(lenis, cleanups) {
    const cards = $$('[data-card]');
    const tabs = $$('[data-tab]');
    const last = cards.length - 1;
    const setTab = (index) => tabs.forEach((tab, i) => tab.setAttribute('aria-current', String(i === index)));
    setTab(0);

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: '.policies',
        start: 'top top',
        end: () => '+=' + last * window.innerHeight * 0.85,
        pin: true,
        scrub: 0.6,
        invalidateOnRefresh: true,
        snap: { snapTo: 'labels', duration: { min: 0.2, max: 0.6 }, delay: 0.1, ease: 'power1.inOut' },
        onUpdate: (self) => setTab(Math.round(self.progress * last)),
      },
    });

    // El oscurecido es una capa con opacidad (--dim en CSS): animar filter en tarjetas grandes cuesta mucho más.
    tl.addLabel('card0', 0);
    for (let i = 1; i <= last; i++) {
      const at = i - 1;
      // Cada tarjeta nueva espera fuera de la pantalla, no justo debajo de la pila (si no, asoma su borde).
      tl.fromTo(cards[i], { y: () => window.innerHeight }, { y: 0, duration: 1, ease: 'power2.inOut' }, at)
        .to(cards[i - 1], { scale: 0.92, yPercent: -5, '--dim': 0.28, duration: 1, ease: 'power2.inOut' }, at);
      if (i >= 2) tl.to(cards[i - 2], { scale: 0.85, yPercent: -10, duration: 1, ease: 'power2.inOut' }, at);
      tl.addLabel('card' + i, i);
    }

    tabs.forEach((tab, i) => {
      const go = () => {
        const st = tl.scrollTrigger;
        const y = st.start + (st.end - st.start) * (i / last);
        if (lenis) lenis.scrollTo(y, { duration: 1.1 });
        else window.scrollTo({ top: y, behavior: 'smooth' });
      };
      tab.addEventListener('click', go);
      cleanups.push(() => tab.removeEventListener('click', go));
    });
  }

  /* ---------- Trayectoria: el scroll vertical se vuelve horizontal ---------- */

  function timelineHorizontal(cleanups) {
    const track = $('[data-track]');
    const rail = $('[data-rail]');
    const viewport = $('.timeline__viewport');
    const distance = () => track.scrollWidth - viewport.clientWidth;

    const tween = gsap.to(track, {
      x: () => -distance(),
      ease: 'none',
      scrollTrigger: {
        trigger: '.timeline',
        start: 'top top',
        end: () => '+=' + distance(),
        pin: true,
        scrub: 0.6,
        invalidateOnRefresh: true,
        onUpdate: (self) => { rail.style.width = (self.progress * 100).toFixed(2) + '%'; },
      },
    });

    $$('.milestone', track).forEach((item) => {
      if (item.offsetLeft + item.offsetWidth <= viewport.clientWidth) return; // ya visibles al entrar: sin fundido
      gsap.from(item, {
        opacity: 0.25,
        y: 40,
        duration: 0.6,
        ease: 'power2.out',
        scrollTrigger: { trigger: item, containerAnimation: tween, start: 'left 85%', toggleActions: 'play none none reverse' },
      });
    });

    // Con teclado, el hito enfocado tiene que entrar en pantalla: se mueve el scroll vertical hasta él.
    // Solo con teclado: con ratón, el mousedown también enfoca, y mover la pista bajo el puntero anularía el clic.
    const onFocus = (e) => {
      const item = e.target.closest('.milestone');
      if (!item || !e.target.matches(':focus-visible')) return;
      const box = item.getBoundingClientRect();
      if (box.left >= 0 && box.right <= innerWidth) return;
      const st = tween.scrollTrigger;
      const progress = gsap.utils.clamp(0, 1, (item.offsetLeft - viewport.clientWidth * 0.15) / distance());
      window.scrollTo(0, st.start + progress * (st.end - st.start));
    };
    track.addEventListener('focusin', onFocus);
    cleanups.push(() => {
      track.removeEventListener('focusin', onFocus);
      rail.style.removeProperty('width');
    });
  }

  /* ---------- Cobertura ---------- */

  function coverage() {
    const map = $('[data-map]');
    if (!map) return;
    const links = $$('[data-link]', map);
    gsap.set(links, { strokeDasharray: (i, el) => el.getTotalLength(), strokeDashoffset: (i, el) => el.getTotalLength() });
    gsap.timeline({ scrollTrigger: { trigger: map, start: 'top 75%', toggleActions: 'play none none none' } })
      .from('.map__place--hq', { scale: 0, transformOrigin: 'center', duration: 0.5, ease: 'back.out(3)' })
      .to(links, { strokeDashoffset: 0, duration: 0.9, stagger: 0.06, ease: 'power2.inOut' }, '<0.2')
      .from($$('.map__place:not(.map__place--hq)', map), { opacity: 0, scale: 0.4, transformOrigin: 'center', duration: 0.4, stagger: 0.06, ease: 'back.out(2.5)' }, '<0.4');
  }

  function initCoverageHighlight() {
    const list = $('[data-coverage-list]');
    const map = $('[data-map]');
    if (!list || !map) return;
    const set = (place) => {
      $$('[data-place]', list).forEach((li) => li.classList.toggle('is-active', li.dataset.place === place));
      $$('.map__place', map).forEach((g) => g.classList.toggle('is-active', g.dataset.place === place));
    };
    [list, map].forEach((box) => {
      box.addEventListener('pointerover', (e) => { const el = e.target.closest('[data-place]'); if (el) set(el.dataset.place); });
      box.addEventListener('pointerleave', () => set(null));
    });
  }

  /* ---------- Bienestar: collage en movimiento ---------- */

  function collage(c) {
    $$('[data-scrap]').forEach((scrap, i) => {
      gsap.from(scrap, {
        opacity: 0,
        scale: 0.8,
        rotation: (i % 2 ? 1 : -1) * 12,
        duration: 0.8,
        ease: 'back.out(1.6)',
        scrollTrigger: { trigger: scrap, start: 'top 92%', toggleActions: 'play none none none' },
      });
      if (c.desktop) {
        const speed = [-28, 18, -14, 26, -20, 14, -26, 20, -16][i % 9];
        gsap.to(scrap, {
          y: speed,
          ease: 'none',
          immediateRender: false,
          scrollTrigger: { trigger: '.collage', start: 'top bottom', end: 'bottom top', scrub: true },
        });
      }
    });
  }
})();
