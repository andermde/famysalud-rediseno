/* Famy Salud — demostración visual de la validación por QR.
   En producción la respuesta la da el plugin sistema-certificados; aquí cualquier código con
   formato FS-AAAA-NNNNNN se da por válido para enseñar el estado de éxito. */
(() => {
  const codeEl = document.querySelector('[data-validate-code]');
  const visualEl = document.querySelector('[data-validate-visual]');
  const statusEl = document.querySelector('[data-validate-status]');
  const dataEl = document.querySelector('[data-validate-data]');
  const form = document.querySelector('[data-validate-form]');
  const titleEl = document.querySelector('[data-validate-title]');
  const TITULOS = { idle: 'Validar un certificado', loading: 'Comprobando el certificado', ok: 'Certificado válido', error: 'Certificado no encontrado' };
  if (!codeEl || !visualEl || !statusEl) return;

  const FORMATO = /^FS-\d{4}-\d{6}$/;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let request = 0;

  // El texto que se «descifra» es solo visual (aria-hidden); al lector de pantalla
  // le llega únicamente el mensaje final, por la región de estado.
  function say(text, state, id) {
    if (id !== request) return Promise.resolve(false);
    visualEl.dataset.state = state;
    statusEl.textContent = text;
    if (titleEl) titleEl.textContent = TITULOS[state];
    const canScramble = window.gsap && window.ScrambleTextPlugin && !reduce;
    if (!canScramble) {
      visualEl.textContent = text;
      return Promise.resolve(true);
    }
    gsap.killTweensOf(visualEl);
    return new Promise((resolve) => {
      gsap.to(visualEl, {
        duration: 1.1,
        scrambleText: { text, chars: '0123456789ABCDEF', speed: 0.6, revealDelay: 0.35 },
        onComplete: () => resolve(id === request),
        onInterrupt: () => resolve(false),
      });
    });
  }

  async function validate(code) {
    const id = ++request; // si llega otra validación, esta deja de escribir en pantalla
    dataEl.hidden = true;
    if (!code) {
      codeEl.textContent = '—';
      await say('Falta el código de validación. Escanea el QR del certificado o escribe el código.', 'idle', id);
      return;
    }
    codeEl.textContent = code;
    if (!(await say('Verificando código…', 'loading', id))) return;
    if (FORMATO.test(code)) {
      if (!(await say('Código verificado: el certificado es auténtico', 'ok', id))) return;
      dataEl.hidden = false;
      if (window.gsap && !reduce) gsap.from(dataEl.children, { opacity: 0, y: 12, stagger: 0.08, duration: 0.4 });
    } else {
      await say('Código no encontrado en el registro', 'error', id);
    }
  }

  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const code = form.codigo.value.trim().toUpperCase();
    history.replaceState(null, '', '?codigo=' + encodeURIComponent(code));
    validate(code);
  });

  const start = () => validate(new URLSearchParams(location.search).get('codigo')?.trim().toUpperCase() || '');
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start, { once: true });
})();
