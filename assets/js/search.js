(function () {
  'use strict';
  window.__atkSearchReady = true;

  var pending = (document.currentScript && document.currentScript.dataset.atkPending) || '';
  var modal = null;
  var input = null;
  var opener = null;

  function ensureModal() {
    if (modal) return;
    modal = document.createElement('div');
    modal.className = 'atk-search-modal';
    modal.hidden = true;
    modal.innerHTML =
      '<div class="atk-search-overlay" data-close></div>' +
      '<div class="atk-search-panel" role="dialog" aria-modal="true" aria-label="Search the knowledge base">' +
        '<div class="atk-search-bar">' +
          '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M10 4a6 6 0 1 0 3.7 10.7l4.8 4.8 1.4-1.4-4.8-4.8A6 6 0 0 0 10 4zm0 2a4 4 0 1 1 0 8 4 4 0 0 1 0-8z"/></svg>' +
          '<input type="text" placeholder="Search techniques, actors, rules\u2026  ( / )" autocomplete="off" spellcheck="false" aria-label="Search query">' +
          '<button type="button" class="atk-search-close" aria-label="Close search (Esc)"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 6.4 6.4 5 12 10.6 17.6 5 19 6.4 13.4 12 19 17.6 17.6 19 12 13.4 6.4 19 5 17.6 10.6 12z"/></svg></button>' +
        '</div>' +
        '<ul class="atk-search-results" role="listbox" aria-label="Search results">' +
          '<li class="atk-search-empty">Search results arrive in <strong>Phase 5</strong> of the build. The shortcuts (Ctrl+K, \u2318K, /) and this modal are already wired.</li>' +
        '</ul>' +
        '<div class="atk-search-foot"><kbd>\u2191\u2193</kbd> navigate <kbd>Enter</kbd> open <kbd>Esc</kbd> close</div>' +
      '</div>';
    document.body.appendChild(modal);
    input = modal.querySelector('input');
    modal.addEventListener('click', function (e) {
      if (e.target.closest('[data-close]') || e.target.closest('.atk-search-close')) close();
    });
    document.addEventListener('keydown', function (e) {
      if (!modal || modal.hidden) return;
      if (e.key === 'Escape') { e.preventDefault(); close(); }
    });
  }

  function open(query) {
    ensureModal();
    opener = document.activeElement;
    modal.hidden = false;
    document.documentElement.classList.add('atk-search-open');
    if (query) input.value = query;
    input.focus();
    input.select();
  }

  function close() {
    modal.hidden = true;
    document.documentElement.classList.remove('atk-search-open');
    if (opener && opener.focus) opener.focus();
    opener = null;
  }

  document.addEventListener('atk:open-search', function (e) {
    open((e.detail && e.detail.query) || '');
  });
  if (pending) window.setTimeout(function () { open(pending); }, 60);
})();