/* Famy Salud — formulario de postulación (solo interfaz: todavía no envía datos).
   Al enviar se muestra un check animado con Lottie; la librería se carga solo en ese momento. */
(() => {
  const form = document.querySelector('[data-apply-form]');
  const success = document.querySelector('[data-form-success]');
  const errorBox = document.querySelector('[data-form-error]');
  if (!form || !success) return;

  const LOTTIE_URL = 'https://cdn.jsdelivr.net/npm/lottie-web@5.12.2/build/player/lottie_light.min.js';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const linkedin = form.linkedin;
    if (linkedin.value && !/^https?:\/\//i.test(linkedin.value.trim())) linkedin.value = 'https://' + linkedin.value.trim();
    const invalid = [...form.elements].filter((el) => el.willValidate && !el.checkValidity());
    form.querySelectorAll('[aria-invalid]').forEach((el) => { el.removeAttribute('aria-invalid'); el.removeAttribute('aria-describedby'); });
    if (invalid.length) {
      invalid.forEach((el) => { el.setAttribute('aria-invalid', 'true'); el.setAttribute('aria-describedby', 'form-error'); });
      const nombres = invalid.map((el) => el.dataset.label || form.querySelector(`label[for="${el.id}"]`).textContent.replace('*', '').trim());
      errorBox.textContent = `Revisa estos campos: ${nombres.join(', ')}.`;
      errorBox.hidden = false;
      invalid[0].focus();
      return;
    }
    errorBox.hidden = true;
    form.hidden = true;
    success.hidden = false;
    success.focus();
    playCheck(success.querySelector('[data-lottie]'));
  });

  function playCheck(container) {
    loadScript(LOTTIE_URL)
      .then(() => {
        const anim = lottie.loadAnimation({ container, renderer: 'svg', loop: false, autoplay: !reduce, animationData: checkAnimation() });
        if (reduce) anim.addEventListener('DOMLoaded', () => anim.goToAndStop(anim.totalFrames - 1, true));
      })
      .catch(() => container.classList.add('is-static'));
  }

  function loadScript(src) {
    if (window.lottie) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.integrity = 'sha384-Vtbz3QbtSBqleuQry6kQy5smig1gPZCXUoTFN7RmN9QW47xpEDsV/J1w0Pw0rDJu';
      s.crossOrigin = 'anonymous';
      s.onload = resolve;
      s.onerror = reject;
      document.head.append(s);
    });
  }

  // Animación Lottie propia: un aro lima que se cierra y un check que se dibuja (trim paths).
  function checkAnimation() {
    const ease = { o: { x: [0.3], y: [0] }, i: { x: [0.2], y: [1] } };
    const trim = (from, to) => ({
      ty: 'tm', s: { a: 0, k: 0 }, o: { a: 0, k: 0 }, m: 1,
      e: { a: 1, k: [{ t: from, s: [0], ...ease }, { t: to, s: [100] }] },
    });
    const stroke = (rgb, width) => ({ ty: 'st', c: { a: 0, k: [...rgb, 1] }, o: { a: 0, k: 100 }, w: { a: 0, k: width }, lc: 2, lj: 2 });
    const group = (items) => ({ ty: 'gr', it: [...items, { ty: 'tr', p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: -90 }, o: { a: 0, k: 100 } }] });
    const layer = (shapes, ind) => ({
      ddd: 0, ind, ty: 4, nm: 'capa' + ind, sr: 1, ip: 0, op: 60, st: 0, bm: 0,
      ks: { o: { a: 0, k: 100 }, r: { a: 0, k: 0 }, p: { a: 0, k: [60, 60, 0] }, a: { a: 0, k: [0, 0, 0] }, s: { a: 0, k: [100, 100, 100] } },
      shapes,
    });
    const ring = group([{ ty: 'el', p: { a: 0, k: [0, 0] }, s: { a: 0, k: [96, 96] } }, stroke([0.494, 0.714, 0.122], 6), trim(0, 24)]);
    const check = {
      ty: 'gr',
      it: [
        { ty: 'sh', ks: { a: 0, k: { c: false, v: [[-22, 2], [-7, 17], [24, -16]], i: [[0, 0], [0, 0], [0, 0]], o: [[0, 0], [0, 0], [0, 0]] } } },
        stroke([0.059, 0.561, 0.184], 9),
        trim(18, 40),
        { ty: 'tr', p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } },
      ],
    };
    return { v: '5.7.4', fr: 60, ip: 0, op: 60, w: 120, h: 120, nm: 'check-famy', ddd: 0, assets: [], layers: [layer([check], 1), layer([ring], 2)] };
  }
})();
