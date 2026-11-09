/**
 * Íconos de interfaz - Ruben: En Busca de Angelo (Claude)
 *
 * Reemplaza los emojis de la interfaz por íconos SVG de trazo simple (tinta, puntas
 * redondeadas) que heredan el color del texto (currentColor), así combinan con los
 * botones crema/mostaza y se ven iguales en Windows, Mac y celulares.
 *
 * Uso:
 *   - En HTML: <span class="ui-icon" data-icon="gear"></span>  (se rellena solo al cargar)
 *   - En JS:   UIIcons.svg('book')  -> string con <svg ...>
 *              UIIcons.fill(rootElement)  -> rellena los data-icon que haya adentro
 */
(function () {
  'use strict';

  const P = {
    key: '<circle cx="7.5" cy="12" r="4"/><path d="M11.5 12H21M17.5 12v3.2M20.5 12v2.2"/>',
    stone: '<path d="M4.5 15.5 7 9l5.5-3.5L18 8l2 6.5-3.5 4H8.5z"/><path d="M9.5 9.5l3 1.5 1.5 3.5" opacity=".55"/>',
    gear: '<path d="M12 2.8l1.5 2.1 2.6-.6.6 2.6 2.4 1.1-1 2.5 1 2.5-2.4 1.1-.6 2.6-2.6-.6L12 21.2l-1.5-2.1-2.6.6-.6-2.6-2.4-1.1 1-2.5-1-2.5 2.4-1.1.6-2.6 2.6.6z"/><circle cx="12" cy="12" r="3"/>',
    book: '<path d="M4.5 5.5A2.5 2.5 0 0 1 7 3h12.5v14.5H7a2.5 2.5 0 0 0-2.5 2.5z"/><path d="M4.5 20A2.5 2.5 0 0 1 7 17.5h12.5V21H7a2.5 2.5 0 0 1-2.5-1"/><path d="M9 7.5h6.5M9 10.5h4.5"/>',
    play: '<path d="M8 5.5v13l10.5-6.5z"/>',
    sliders: '<path d="M4 6.5h9M17 6.5h3M4 12h3M11 12h9M4 17.5h11M19 17.5h1"/><circle cx="15" cy="6.5" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="17.5" r="2"/>',
    'restart-room': '<path d="M4 4.5v5.5h5.5"/><path d="M5.2 14.5a7.5 7.5 0 1 0 1.6-7.6L4 10"/>',
    'restart-game': '<path d="M5.5 5v14"/><path d="M19 5.5 9 12l10 6.5z"/>',
    home: '<path d="M3.5 11 12 4l8.5 7"/><path d="M5.8 9.3V20h4.4v-5.5h3.6V20h4.4V9.3"/>',
    gamepad: '<path d="M7.5 7.5h9a4.2 4.2 0 0 1 4.1 3.5l.7 4.6a2.4 2.4 0 0 1-4.2 1.9L15.4 15.5H8.6l-1.7 2a2.4 2.4 0 0 1-4.2-1.9l.7-4.6a4.2 4.2 0 0 1 4.1-3.5z"/><path d="M8 10.2v3.4M6.3 11.9h3.4"/><circle cx="15.3" cy="11" r=".6" fill="currentColor"/><circle cx="17.2" cy="12.9" r=".6" fill="currentColor"/>',
    mouse: '<rect x="6.5" y="3" width="11" height="18" rx="5.5"/><path d="M12 6.5v3.5"/>',
    jump: '<path d="M4.5 20.5h15"/><path d="M12 16.5V4.5M7.5 9 12 4.5 16.5 9"/>',
    sword: '<path d="M19.5 4.5 9 15"/><path d="M19.5 4.5h-3.8M19.5 4.5v3.8" opacity=".6"/><path d="M6.2 12.2l5.6 5.6"/><path d="M8 16l-3.8 3.8"/>',
    grab: '<path d="M6 17.5 8 12l4.5-2.5 4 2 1.5 4.5-3 3H9z"/><path d="M3 9.5c1.5-3 4-4.5 7-4.5M3.5 13c.8-1.4 1.8-2.4 3-3"/>',
    scroll: '<path d="M7 4.5h10.5a2 2 0 0 1 2 2v1H17"/><path d="M17 6.5V17a2.5 2.5 0 0 1-2.5 2.5h-8A2.5 2.5 0 0 1 4 17v-1h10.5v1a2.5 2.5 0 0 0 2.5 2.5"/><path d="M7 4.5a2 2 0 0 0-2 2V16"/><path d="M8.5 9h5.5M8.5 12h4"/>',
    'arrow-left': '<path d="M19 12H5M10.5 6.5 5 12l5.5 5.5"/>',
    'arrow-right': '<path d="M5 12h14M13.5 6.5 19 12l-5.5 5.5"/>',
    'arrow-up': '<path d="M12 19V5M6.5 10.5 12 5l5.5 5.5"/>',
    'arrow-down': '<path d="M12 5v14M6.5 13.5 12 19l5.5-5.5"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    wind: '<path d="M3 8h10.5a3 3 0 1 0-3-3"/><path d="M3 12.5h15a3 3 0 1 1-3 3"/><path d="M3 17h6"/>'
  };

  function svg(name, extraClass) {
    const body = P[name];
    if (!body) return '';
    const cls = 'ui-svg' + (extraClass ? ' ' + extraClass : '');
    return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
  }

  function fill(root) {
    (root || document).querySelectorAll('[data-icon]').forEach((el) => {
      if (el.dataset.iconDone) return;
      const s = svg(el.dataset.icon);
      if (!s) return;
      el.insertAdjacentHTML('afterbegin', s);
      el.dataset.iconDone = '1';
      if (!el.classList.contains('ui-icon') && !el.textContent.trim()) el.classList.add('ui-icon');
    });
  }

  window.UIIcons = { svg, fill, names: Object.keys(P) };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => fill());
  else fill();
})();
