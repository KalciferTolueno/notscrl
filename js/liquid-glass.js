(function () {
  'use strict';

  function init() {
    if (typeof window.liquidGL !== 'function') return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!document.querySelector('.liquid-glass')) return;

    try {
      window.liquidGlass = liquidGL({
        engine: 'auto',
        snapshot: '#mobile-app-shell',
        target: '.liquid-glass',
        resolution: 1.5,
        refraction: 0.03,
        bevelDepth: 0.06,
        bevelWidth: 0.22,
        frost: 8,
        shadow: true,
        specular: false,
        reveal: 'fade',
        tint: 'rgba(18, 17, 15, 0.55)'
      });
    } catch (error) {
      console.warn('liquidGL no disponible:', error);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
