(function () {
  'use strict';

  /* ------------------------------------------------------------------ *
   * 1. SITE BASE                                                       *
   * ------------------------------------------------------------------ */
  var SITE_BASE = new URL('../../', document.currentScript.src).href;

  /* ------------------------------------------------------------------ *
   * 2. Helpers                                                         *
   * ------------------------------------------------------------------ */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  /* getData(file): fetch a JSON source once, cache the promise, never throw.
   * On failure it resolves to null and logs a console warning - callers
   * must handle null gracefully. */
  var dataCache = {};
  function getData(file) {
    if (!dataCache[file]) {
      dataCache[file] = fetch(SITE_BASE + file)
        .then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status + ' for ' + file);
          return r.json();
        })
        .catch(function (err) {
          console.warn('[platform] could not load ' + file + ' - ' + err.message);
          return null;
        });
    }
    return dataCache[file];
  }

  /* ------------------------------------------------------------------ *
   * 3. Theme                                                           *
   * ------------------------------------------------------------------ */
  var THEME_KEY = 'atk-theme';

  function currentTheme() {
    var root = document.documentElement;
    var body = document.body;
    var value = root.getAttribute('data-theme') ||
                (body && body.getAttribute('data-theme')) ||
                'light';
    return value === 'dark' ? 'dark' : 'light';
  }

  function applyTheme(theme, persist) {
    document.documentElement.setAttribute('data-theme', theme);
    /* Some hand-written guides theme a body[data-theme] selector. Keeping
     * the attribute on both elements makes the shared toggle work for every
     * generation of guide without touching the guide's CSS. */
    if (document.body) document.body.setAttribute('data-theme', theme);
    if (persist) {
      try { localStorage.setItem(THEME_KEY, theme); } catch (e) { /* private mode */ }
    }
    var btn = $('.atk-theme-btn');
    if (btn) btn.setAttribute('aria-pressed', String(theme === 'dark'));
  }

  function toggleTheme() {
    applyTheme(currentTheme() === 'dark' ? 'light' : 'dark', true);
  }

  /* ------------------------------------------------------------------ *
   * 4. Toast (planned-state clicks use this instead of dead ends)      *
   * ------------------------------------------------------------------ */
  var toastTimer = null;
  function toast(message) {
    var node = $('.atk-toast');
    if (!node) {
      node = document.createElement('div');
      node.className = 'atk-toast';
      node.setAttribute('role', 'status');
      document.body.appendChild(node);
    }
    node.textContent = message;
    node.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { node.classList.remove('is-on'); }, 2400);
  }

  /* ------------------------------------------------------------------ *
   * 5. Inline SVG icon set (no emoji, no external icon fonts)          *
   * ------------------------------------------------------------------ */
  var ICONS = {
    shield: '<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false"><path d="M32 4 56 12v16c0 15-10 26-24 32C18 54 8 43 8 28V12L32 4z"/></svg>',
    search: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M10 4a6 6 0 1 0 3.7 10.7l4.8 4.8 1.4-1.4-4.8-4.8A6 6 0 0 0 10 4zm0 2a4 4 0 1 1 0 8 4 4 0 0 1 0-8z"/></svg>',
    sun: '<svg class="atk-icon-sun" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm-1-7h2v3.5h-2zm0 18.5h2V23h-2zM1.5 11H5v2H1.5zM19 11h3.5v2H19zM3.9 5.1l1.4-1.4 2.5 2.5-1.5 1.4zM16.2 17.4l1.4-1.4 2.5 2.5-1.4 1.4zM3.9 18.9l2.5-2.5 1.4 1.4-2.5 2.5zM16.2 6.2l2.5-2.5 1.4 1.4-2.5 2.5z"/></svg>',
    moon: '<svg class="atk-icon-moon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M13.2 3A9 9 0 1 0 21 13.2 7.2 7.2 0 0 1 13.2 3z"/></svg>',
    burger: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 5h18v2H3zm0 6h18v2H3zm0 6h18v2H3z"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 6.4 6.4 5 12 10.6 17.6 5 19 6.4 13.4 12 19 17.6 17.6 19 12 13.4 6.4 19 5 17.6 10.6 12z"/></svg>',
    github: '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>'
  };

  /* ------------------------------------------------------------------ *
   * 6. Shared chrome - header + footer injection                       *
   * ------------------------------------------------------------------ */
  function githubUrl() {
    try {
      var u = new URL(SITE_BASE);
      if (u.hostname.endsWith('.github.io')) {
        var user = u.hostname.split('.')[0];
        var repo = u.pathname.replace(/\//g, '');
        return 'https://github.com/' + user + '/' + (repo || 'attack-knowledge-platform');
      }
    } catch (e) { /* fall through */ }
    return '';
  }

  function renderHeader() {
    var mount = $('#atk-header');
    if (!mount) {
      mount = document.createElement('div');
      mount.id = 'atk-header';
      document.body.insertBefore(mount, document.body.firstChild);
    }
    var gh = githubUrl();
    var menu =
      '<a href="' + SITE_BASE + 'techniques/">Techniques</a>' +
      '<a href="' + SITE_BASE + 'actors/">Actors</a>' +
      '<a href="' + SITE_BASE + 'mitigations/">Mitigations</a>' +
      '<a href="' + SITE_BASE + 'campaigns/">Campaigns</a>' +
      '<a href="' + SITE_BASE + 'tools/">Tools</a>';
    mount.innerHTML =
      '<header class="atk-header">' +
        '<div class="atk-header-in">' +
          '<a class="atk-brand" href="' + SITE_BASE + '">' + ICONS.shield +
            '<span>ATT&amp;CK <em>Knowledge Platform</em></span></a>' +
          '<nav class="atk-nav" aria-label="Primary">' + menu + '</nav>' +
          '<details class="atk-nav-menu">' +
            '<summary aria-label="Open navigation menu">' + ICONS.burger + '</summary>' +
            '<div class="atk-menu-pop">' + menu + '</div>' +
          '</details>' +
          '<div class="atk-actions">' +
            '<button type="button" class="atk-icon-btn atk-search-btn" aria-label="Open search (Ctrl+K)">' + ICONS.search + '<kbd>Ctrl K</kbd></button>' +
            '<button type="button" class="atk-icon-btn atk-theme-btn" aria-label="Toggle color theme" aria-pressed="false">' + ICONS.sun + ICONS.moon + '</button>' +
            (gh ? '<a class="atk-icon-btn" href="' + gh + '" aria-label="View the repository on GitHub" target="_blank" rel="noopener">' + ICONS.github + '</a>' : '') +
          '</div>' +
        '</div>' +
      '</header>';

    $('.atk-theme-btn', mount).addEventListener('click', toggleTheme);
    $('.atk-search-btn', mount).addEventListener('click', function () { ensureSearch(''); });
    applyTheme(currentTheme(), false);
  }

  function renderFooter() {
    var mount = $('#atk-footer');
    if (!mount) {
      mount = document.createElement('div');
      mount.id = 'atk-footer';
      document.body.appendChild(mount);
    }
    mount.innerHTML =
      '<footer class="atk-footer"><div class="atk-footer-in">' +
        '<p class="atk-footer-note"><span class="atk-footer-update"></span>Unofficial Educational Project - content is the author\'s own analysis.</p>' +
        '<p class="atk-footer-attr">MITRE ATT&amp;CK<span class="atk-reg">\u00ae</span> is a registered trademark of The MITRE Corporation. ' +
        'Technique identifiers reference the public MITRE ATT&amp;CK knowledge base and are used with attribution.</p>' +
      '</div></footer>';

    var techId = ($('#atk-header') && $('#atk-header').dataset.technique) || '';
    if (techId) {
      getData('data/techniques.json').then(function (rows) {
        if (!rows) return;
        var row = rows.filter(function (r) { return r.id === techId; })[0];
        if (row && row.updated) {
          var slot = $('.atk-footer-update');
          if (slot) slot.textContent = 'Last updated ' + row.updated + ' \u00b7 ';
        }
      });
    }
  }

  /* ------------------------------------------------------------------ *
   * 7. Search wiring                                                   *
   * ------------------------------------------------------------------ */
  function ensureSearch(query) {
    if (window.__atkSearchReady) {
      document.dispatchEvent(new CustomEvent('atk:open-search', { detail: { query: query || '' } }));
      return;
    }
    var tag = document.querySelector('script[src*="search.js"]');
    if (tag) {
      tag.dataset.atkPending = query || '';
      return;
    }
    tag = document.createElement('script');
    tag.src = SITE_BASE + 'assets/js/search.js';
    tag.defer = true;
    tag.dataset.atkPending = query || '';
    document.body.appendChild(tag);
  }

  function initShortcuts() {
    document.addEventListener('keydown', function (e) {
      var t = e.target;
      var typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        ensureSearch('');
        return;
      }
      if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === '/') {
        e.preventDefault();
        ensureSearch('');
        return;
      }
      if (e.key === 't' || e.key === 'T') toggleTheme();
    });
  }

  /* ------------------------------------------------------------------ *
   * 8. Mount renderers                                                 *
   * ------------------------------------------------------------------ */

  function setCount(id, value) {
    var node = document.getElementById(id);
    if (node) node.textContent = String(value);
  }

  function renderLatest(techniques) {
    var mount = $('#atk-latest');
    if (!mount) return;
    var rows = techniques
      .filter(function (r) { return r.status === 'implemented' && r.page; })
      .sort(function (a, b) { return String(b.updated || '').localeCompare(String(a.updated || '')); })
      .slice(0, 3);
    mount.innerHTML = rows.length
      ? rows.map(function (r) {
          return '<a class="atk-latest-item" href="' + esc(SITE_BASE + r.page) + '">' +
                 '<span class="atk-latest-id">' + esc(r.id) + '</span>' + esc(r.name) + '</a>';
        }).join('')
      : '<span class="atk-latest-item is-none">No guides published yet.</span>';
  }

  function renderMatrix() {
    var mount = $('#atk-explorer');
    if (!mount) return;

    Promise.all([
      getData('data/tactics.json'),
      getData('data/techniques.json'),
      getData('data/sigma-index.json')
    ]).then(function (res) {
      var tactics = res[0], techniques = res[1], sigmaIndex = res[2] || {};
      if (!tactics || !techniques) {
        mount.innerHTML = '<p class="atk-hub-error">Explorer data unavailable right now.</p>';
        return;
      }

      var ordered = tactics.slice().sort(function (a, b) { return a.order - b.order; });
      var techById = {};
      techniques.forEach(function (r) { techById[r.id] = r; });

      var live = 0, planned = 0, coveredTactics = {};
      techniques.forEach(function (r) {
        if (r.status === 'implemented') {
          live += 1;
          coveredTactics[r.tactic] = true;
        } else {
          planned += 1;
        }
      });
      var tacticCoverage = Object.keys(coveredTactics).length;
      var ruleCount = sigmaIndex && sigmaIndex.count != null ? sigmaIndex.count : 0;

      setCount('atk-count-live', live);
      setCount('atk-count-planned', planned);
      setCount('atk-count-rules', ruleCount);
      setCount('atk-count-tactics', tacticCoverage);

      // Show both live and planned techniques by default so the status badges
      // are visible without hunting through the scope toggle. The v2 key
      // intentionally ignores the old live-only preference.
      var mode = 'all';
      try {
        var savedMode = localStorage.getItem('atk-explorer-mode-v2');
        if (savedMode === 'live' || savedMode === 'all') mode = savedMode;
      } catch (e) { /* private mode */ }

      var state = { tactic: null, technique: null };

      function readHash() {
        var params = {};
        var raw = String(window.location.hash || '').replace(/^#/, '');
        raw.split('&').forEach(function (part) {
          var eq = part.indexOf('=');
          if (eq > 0) params[decodeURIComponent(part.slice(0, eq))] = decodeURIComponent(part.slice(eq + 1));
        });
        state.tactic = null;
        state.technique = null;
        if (params.tactic && ordered.some(function (t) { return t.id === params.tactic; })) {
          state.tactic = params.tactic;
        } else {
          return;
        }
        var tech = params.technique ? techById[params.technique] : null;
        if (tech && tech.tactic === state.tactic && !parentId(tech.id)) {
          state.technique = tech.id;
        }
      }

      function syncHash() {
        var parts = [];
        if (state.tactic) parts.push('tactic=' + encodeURIComponent(state.tactic));
        if (state.technique) parts.push('technique=' + encodeURIComponent(state.technique));
        var next = parts.length ? '#' + parts.join('&') : '';
        try {
          if (window.location.hash !== next) {
            window.history.replaceState(null, '', window.location.pathname + window.location.search + next);
          }
        } catch (e) { /* file:// or restricted history */ }
      }

      function isLive(row) {
        return row.status === 'implemented' && !!row.page;
      }

      function byId(a, b) {
        return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
      }

      function parentId(id) {
        var dot = id.lastIndexOf('.');
        return dot === -1 ? null : id.slice(0, dot);
      }

      function childrenOf(id) {
        return techniques.filter(function (r) {
          return parentId(r.id) === id;
        }).sort(byId);
      }

      function rootsFor(tactic) {
        return techniques.filter(function (r) {
          var parent = parentId(r.id);
          return r.tactic === tactic && (!parent || !techById[parent]);
        }).sort(byId);
      }

      function rowsForTactic(tactic) {
        return techniques.filter(function (r) { return r.tactic === tactic; });
      }

      function liveChildren(id) {
        return childrenOf(id).filter(isLive);
      }

      function visibleRoot(row) {
        return mode === 'all' || isLive(row) || liveChildren(row.id).length > 0;
      }

      function visibleChildren(id) {
        return childrenOf(id).filter(function (r) {
          return mode === 'all' || isLive(r);
        });
      }

      function badgeFor(row) {
        if (isLive(row)) return '<span class="atk-badge is-live">Live</span>';
        var n = liveChildren(row.id).length;
        var plannedBadge = '<span class="atk-badge is-planned">Planned</span>';
        if (n) return plannedBadge + '<span class="atk-badge is-live">' + n + ' live sub</span>';
        return plannedBadge;
      }

      function metaFor(row, withChildren) {
        var bits = [];
        if (row.sigma && row.sigma.length) bits.push(row.sigma.length + ' rules');
        if (withChildren) {
          var n = childrenOf(row.id).length;
          if (n) bits.push(n + ' sub-techniques');
        }
        return bits.join(' \u00b7 ');
      }

      function tacticButton(t) {
        var all = rowsForTactic(t.id);
        var liveRows = all.filter(isLive);
        var selected = state.tactic === t.id;
        return '<button type="button" class="atk-explorer-node atk-node-tactic' +
          (selected ? ' is-selected' : '') + '" data-tactic="' + esc(t.id) + '" aria-pressed="' + selected + '">' +
          '<span class="atk-node-step">' + String(t.order).padStart(2, '0') + '</span>' +
          '<span class="atk-node-body">' +
            '<span class="atk-node-name">' + esc(t.name) + '</span>' +
            '<span class="atk-node-meta">' + liveRows.length + ' live \u00b7 ' + (all.length - liveRows.length) + ' planned</span>' +
          '</span>' +
          '<span class="atk-node-arrow" aria-hidden="true">\u203a</span>' +
        '</button>';
      }

      function techniqueButton(row) {
        var selected = state.technique === row.id;
        return '<button type="button" class="atk-explorer-node atk-node-tech' +
          (selected ? ' is-selected' : '') + '" data-technique="' + esc(row.id) + '" aria-pressed="' + selected + '">' +
          '<span class="atk-node-body">' +
            '<span class="atk-node-id">' + esc(row.id) + '</span>' +
            '<span class="atk-node-name">' + esc(row.name) + '</span>' +
            '<span class="atk-node-meta">' + esc(metaFor(row, true)) + '</span>' +
          '</span>' +
          '<span class="atk-node-tail">' + badgeFor(row) + '</span>' +
        '</button>';
      }

      function subtechNode(row) {
        var body = '<span class="atk-node-body">' +
          '<span class="atk-node-id">' + esc(row.id) + '</span>' +
          '<span class="atk-node-name">' + esc(row.name) + '</span>' +
          '<span class="atk-node-meta">' + esc(metaFor(row, false)) + '</span>' +
        '</span>';
        if (isLive(row)) {
          return '<a class="atk-explorer-node atk-node-sub is-live" href="' + esc(SITE_BASE + row.page) + '">' +
            body + '<span class="atk-node-tail"><span class="atk-badge is-live">Live</span><span class="atk-node-open">Open \u2192</span></span></a>';
        }
        return '<div class="atk-explorer-node atk-node-sub is-planned">' +
          body + '<span class="atk-node-tail"><span class="atk-badge is-planned">Planned</span></span></div>';
      }

      function welcomeHtml() {
        return '<div class="atk-explorer-welcome">' +
          '<svg class="atk-spider-mark" viewBox="0 0 120 120" aria-hidden="true">' +
            '<g fill="none" stroke="currentColor" stroke-width="1.3" opacity=".55">' +
              '<path d="M60 10v100M10 60h100M24 24l72 72M96 24 24 96"/>' +
              '<circle cx="60" cy="10" r="3"/><circle cx="110" cy="60" r="3"/><circle cx="60" cy="110" r="3"/><circle cx="10" cy="60" r="3"/>' +
              '<circle cx="24" cy="24" r="3"/><circle cx="96" cy="24" r="3"/><circle cx="24" cy="96" r="3"/><circle cx="96" cy="96" r="3"/>' +
            '</g>' +
            '<circle cx="60" cy="60" r="9" fill="currentColor"/>' +
          '</svg>' +
          '<h3>Start with a tactic</h3>' +
          '<p>Pick one of the 15 ATT&amp;CK tactics. Its techniques open in the middle. Choose a technique to see its sub-techniques on the right. Opening a new branch collapses the old one.</p>' +
          '<p class="atk-explorer-steps"><span>1 tactic</span><span>2 technique</span><span>3 sub-technique</span></p>' +
        '</div>';
      }

      function drawWeb() {
        var web = $('.atk-explorer-web', mount);
        var grid = $('.atk-explorer-grid', mount);
        if (!web || !grid) return;

        var gridRect = grid.getBoundingClientRect();
        web.setAttribute('viewBox', '0 0 ' + Math.max(1, gridRect.width) + ' ' + Math.max(1, gridRect.height));
        web.innerHTML = '';

        if (window.matchMedia && window.matchMedia('(max-width: 960px)').matches) return;

        var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        function edge(el, side) {
          var r = el.getBoundingClientRect();
          return {
            x: (side === 'right' ? r.right : r.left) - gridRect.left,
            y: r.top - gridRect.top + r.height / 2
          };
        }

        function link(a, b) {
          var d = 'M' + a.x.toFixed(1) + ' ' + a.y.toFixed(1) +
                  ' C' + (a.x + 34).toFixed(1) + ' ' + a.y.toFixed(1) +
                  ', ' + (b.x - 34).toFixed(1) + ' ' + b.y.toFixed(1) +
                  ', ' + b.x.toFixed(1) + ' ' + b.y.toFixed(1);
          var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          path.setAttribute('class', 'atk-web-line');
          path.setAttribute('d', d);
          web.appendChild(path);
          if (!reduce) {
            try {
              var length = path.getTotalLength();
              path.style.strokeDasharray = String(length);
              path.style.strokeDashoffset = String(length);
              window.requestAnimationFrame(function () {
                window.requestAnimationFrame(function () { path.style.strokeDashoffset = '0'; });
              });
            } catch (e) { /* older SVG engines */ }
          }
          [a, b].forEach(function (p) {
            var dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            dot.setAttribute('cx', p.x.toFixed(1));
            dot.setAttribute('cy', p.y.toFixed(1));
            dot.setAttribute('r', '2.4');
            dot.setAttribute('class', 'atk-web-dot');
            web.appendChild(dot);
          });
        }

        var tacticEl = state.tactic ? $('[data-tactic="' + state.tactic + '"]', mount) : null;
        var techEl = state.technique ? $('[data-technique="' + state.technique + '"]', mount) : null;
        var techHead = $('.atk-explorer-col.is-techniques .atk-explorer-colhead', mount);
        var subHead = $('.atk-explorer-col.is-subtechs .atk-explorer-colhead', mount);
        if (tacticEl && techHead) link(edge(tacticEl, 'right'), edge(techHead, 'left'));
        if (techEl && subHead) link(edge(techEl, 'right'), edge(subHead, 'left'));
      }

      function focusAfterDraw(selector) {
        if (!selector) return;
        window.requestAnimationFrame(function () {
          var el = $(selector, mount);
          if (el && el.focus) {
            try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); }
          }
        });
      }

      function draw(focusSelector) {
        var tacticRows = state.tactic ? rowsForTactic(state.tactic) : [];
        var roots = state.tactic ? rootsFor(state.tactic).filter(visibleRoot) : [];
        var children = state.technique ? visibleChildren(state.technique) : [];
        var selectedTech = state.technique ? techById[state.technique] : null;

        var tacticHtml = ordered.map(tacticButton).join('');
        var techniqueHtml;
        if (!state.tactic) {
          techniqueHtml = welcomeHtml();
        } else if (!roots.length) {
          techniqueHtml = '<div class="atk-explorer-empty">' +
            '<span class="atk-empty-mark" aria-hidden="true">\u25cc</span>' +
            '<h3>No live guide in this tactic yet</h3>' +
            '<p>' + esc((ordered.filter(function (t) { return t.id === state.tactic; })[0] || {}).name || 'This tactic') +
            ' has ' + tacticRows.length + ' tracked technique' + (tacticRows.length === 1 ? '' : 's') + ', but none has a published guide.</p>' +
            '<div class="atk-explorer-actions">' +
              '<button type="button" class="atk-btn atk-btn-ghost" data-explorer-mode="all">Browse the full catalogue</button>' +
              '<a class="atk-btn atk-btn-ghost" href="' + SITE_BASE + 'techniques/">Open techniques hub</a>' +
            '</div></div>';
        } else {
          techniqueHtml = roots.map(techniqueButton).join('');
        }

        var subHtml;
        if (!selectedTech) {
          subHtml = '<div class="atk-explorer-hint"><span class="atk-empty-mark" aria-hidden="true">\u25cc</span>' +
            '<p>Pick a technique in the middle column to reveal its sub-techniques.</p></div>';
        } else if (children.length) {
          var parentLink = isLive(selectedTech)
            ? '<a class="atk-explorer-parent-link" href="' + esc(SITE_BASE + selectedTech.page) + '">Open parent guide \u2192</a>'
            : '<span class="atk-explorer-parent-link is-muted">Parent guide planned</span>';
          subHtml = '<div class="atk-explorer-parent">' +
            '<span class="atk-parent-id">' + esc(selectedTech.id) + '</span>' +
            '<span class="atk-parent-name">' + esc(selectedTech.name) + '</span>' +
            parentLink + '</div>' + children.map(subtechNode).join('');
        } else {
          var leafLink = isLive(selectedTech)
            ? '<a class="atk-btn atk-btn-primary" href="' + esc(SITE_BASE + selectedTech.page) + '">Open the full guide \u2192</a>'
            : (mode === 'live'
              ? '<button type="button" class="atk-btn atk-btn-ghost" data-explorer-mode="all">Show planned techniques</button>'
              : '<a class="atk-btn atk-btn-ghost" href="' + SITE_BASE + 'techniques/">Browse the techniques hub</a>');
          var plannedChildren = childrenOf(selectedTech.id).length;
          subHtml = '<div class="atk-explorer-leaf">' +
            '<span class="atk-leaf-id">' + esc(selectedTech.id) + '</span>' +
            '<h3>' + esc(selectedTech.name) + '</h3>' +
            '<p>' + (plannedChildren
              ? 'This technique has ' + plannedChildren + ' sub-technique' + (plannedChildren === 1 ? '' : 's') + ', but none is live yet.'
              : 'This is a leaf technique: there are no sub-techniques to drill into.') + '</p>' +
            (isLive(selectedTech) ? '<p class="atk-leaf-sum">' + esc(selectedTech.summary || '') + '</p>' : '') +
            '<div class="atk-explorer-actions">' + leafLink +
              '<a class="atk-btn atk-btn-ghost" href="' + SITE_BASE + 'techniques/">Techniques hub</a></div>' +
          '</div>';
        }

        mount.innerHTML =
          '<div class="atk-explorer" role="region" aria-label="ATT&amp;CK Explorer">' +
          '<div class="atk-explorer-head">' +
            '<p class="atk-explorer-kicker">Interactive knowledge map \u00b7 tactic \u2192 technique \u2192 sub-technique</p>' +
            '<div class="atk-explorer-modes" role="group" aria-label="Explorer scope">' +
              '<button type="button" class="atk-mode-btn' + (mode === 'all' ? ' is-on' : '') + '" data-explorer-mode="all" aria-pressed="' + (mode === 'all') + '">Live + planned (' + (live + planned) + ')</button>' +
              '<button type="button" class="atk-mode-btn' + (mode === 'live' ? ' is-on' : '') + '" data-explorer-mode="live" aria-pressed="' + (mode === 'live') + '">Live only (' + live + ')</button>' +
            '</div>' +
          '</div>' +
          '<div class="atk-explorer-legend" aria-label="Technique status legend">' +
            '<span><span class="atk-badge is-live">Live</span> full guide ready</span>' +
            '<span><span class="atk-badge is-planned">Planned</span> tracked, guide not written yet</span>' +
            '<span class="atk-legend-note">A planned parent can still have live sub-guides.</span>' +
          '</div>' +
          '<div class="atk-explorer-grid">' +
            '<svg class="atk-explorer-web" aria-hidden="true" focusable="false"></svg>' +
            '<section class="atk-explorer-col is-tactics" aria-labelledby="atk-explorer-tactics-title">' +
              '<div class="atk-explorer-colhead"><span class="atk-step">1</span><h3 id="atk-explorer-tactics-title">Tactic</h3><span class="atk-col-total">' + ordered.length + '</span></div>' +
              '<div class="atk-explorer-list atk-explorer-tactics" role="group" aria-label="Tactics">' + tacticHtml + '</div>' +
            '</section>' +
            '<section class="atk-explorer-col is-techniques" aria-labelledby="atk-explorer-techniques-title" aria-live="polite">' +
              '<div class="atk-explorer-colhead"><span class="atk-step">2</span><h3 id="atk-explorer-techniques-title">Technique</h3><span class="atk-col-total">' + (state.tactic ? roots.length : '\u2014') + '</span></div>' +
              '<div class="atk-explorer-list">' + techniqueHtml + '</div>' +
            '</section>' +
            '<section class="atk-explorer-col is-subtechs" aria-labelledby="atk-explorer-subtechs-title" aria-live="polite">' +
              '<div class="atk-explorer-colhead"><span class="atk-step">3</span><h3 id="atk-explorer-subtechs-title">Sub-technique</h3><span class="atk-col-total">' + (state.technique ? children.length : '\u2014') + '</span></div>' +
              '<div class="atk-explorer-list">' + subHtml + '</div>' +
            '</section>' +
          '</div>' +
          '<div class="atk-explorer-foot">' +
            '<span><b>' + live + '</b> live guides</span>' +
            '<span><b>' + planned + '</b> planned</span>' +
            '<span><b>' + (live + planned) + '</b> total techniques</span>' +
            '<span><b>' + ruleCount + '</b> log-tested Sigma rules</span>' +
            '<span>' + tacticCoverage + ' of ' + ordered.length + ' tactics covered</span>' +
          '</div></div>';

        window.requestAnimationFrame(drawWeb);
        syncHash();
        focusAfterDraw(focusSelector);
      }

      readHash();
      draw();

      if (!mount.dataset.wired) {
        mount.dataset.wired = '1';
        mount.addEventListener('click', function (e) {
          var modeBtn = e.target.closest ? e.target.closest('[data-explorer-mode]') : null;
          if (modeBtn) {
            mode = modeBtn.dataset.explorerMode;
            try { localStorage.setItem('atk-explorer-mode-v2', mode); } catch (err) { /* private mode */ }
            state.technique = null;
            if (mode === 'live' && state.tactic) {
              var liveRoots = rootsFor(state.tactic).filter(visibleRoot);
              if (!liveRoots.length) state.tactic = null;
            }
            draw('[data-explorer-mode="' + mode + '"]');
            return;
          }

          var tacticBtn = e.target.closest ? e.target.closest('[data-tactic]') : null;
          if (tacticBtn) {
            var t = tacticBtn.dataset.tactic;
            state.tactic = state.tactic === t ? null : t;
            state.technique = null;
            draw(state.tactic ? '[data-tactic="' + t + '"]' : null);
            return;
          }

          var techBtn = e.target.closest ? e.target.closest('[data-technique]') : null;
          if (techBtn) {
            var id = techBtn.dataset.technique;
            state.technique = state.technique === id ? null : id;
            draw('[data-technique="' + id + '"]');
            return;
          }
        });

        var redrawTimer = null;
        function queueWebRedraw() {
          window.clearTimeout(redrawTimer);
          redrawTimer = window.setTimeout(drawWeb, 80);
        }
        window.addEventListener('resize', queueWebRedraw);
        mount.addEventListener('scroll', queueWebRedraw, true);
        window.addEventListener('hashchange', function () {
          readHash();
          draw();
        });
      }

      renderLatest(techniques);
    });
  }


  /* Fill a mount if present; otherwise create one at a sensible default
   * position. This is what makes the 4-line integration snippet enough
   * for hand-made pages: no mount, no problem. */
  function mountAt(selector, fallback) {
    var mount = $(selector);
    if (mount) return mount;
    mount = document.createElement('div');
    mount.id = selector.slice(1);
    fallback(mount);
    return mount;
  }

  function renderHub() {
    var mount = $('[data-hub]');
    if (!mount) return;
    var kind = mount.dataset.hub;
    var grid = $('#atk-hub-grid');
    var filter = $('#atk-hub-filter');
    if (!grid) return;

    var sources = {
      techniques: 'data/techniques.json',
      actors: 'data/actors.json',
      mitigations: 'data/mitigations.json',
      campaigns: 'data/campaigns.json'
    };
    if (!sources[kind]) {
      console.warn('[platform] unknown hub kind: ' + kind);
      return;
    }

    function emptyHtml() {
      return '<p class="atk-hub-error">Data unavailable right now \u2014 try again in a moment.</p>';
    }

    function badge(live) {
      return live
        ? '<span class="atk-badge is-live" title="Hand-written guide is live">Live guide</span>'
        : '<span class="atk-badge is-planned" title="Guide in progress">Planned</span>';
    }

    function techCard(r) {
      var live = r.status === 'implemented' && r.page;
      var ruleCount = (r.sigma || []).length;
      var open = live ? '<a href="' + esc(SITE_BASE + r.page) + '">' : '';
      var close = live ? '</a>' : '';
      return '<article class="atk-card" id="' + esc(r.id) + '" data-filter="' + esc((r.id + ' ' + r.name).toLowerCase()) + '">' +
        '<div class="atk-card-top"><span class="atk-card-id">' + esc(r.id) + '</span>' + badge(live) + '</div>' +
        '<h3 class="atk-card-name">' + open + esc(r.name) + close + '</h3>' +
        '<p class="atk-card-sum">' + esc(r.summary || '') + '</p>' +
        (live && ruleCount ? '<p class="atk-card-meta">Linked Sigma rules: ' + ruleCount + '</p>' : '') +
        '</article>';
    }

    function entityCard(kindName, r, techById) {
      var live = r.status === 'implemented' && r.page;
      var sub = kindName === 'campaigns'
        ? String(r.year || '')
        : (r.aliases || []).join(' \u00b7 ');
      var extra = kindName === 'mitigations' ? 'Type: ' + esc(r.type || '\u2014') : '';
      var refs = kindName === 'actors' ? (r.uses || [])
        : kindName === 'mitigations' ? (r.mitigates || [])
        : (r.techniques || []);
      var chips = refs.slice(0, 6).map(function (id) {
        var row = techById[id];
        var label = row ? (id + ' \u00b7 ' + row.name) : id;
        var href = row && row.status === 'implemented' && row.page
          ? SITE_BASE + row.page
          : SITE_BASE + 'techniques/#' + id;
        return '<a class="atk-chip ' + (row && row.status === 'implemented' ? 'is-live' : 'is-planned') +
          '" href="' + esc(href) + '" title="' + esc(label) + '">' + esc(id) + '</a>';
      }).join('');
      var more = refs.length > 6 ? '<span class="atk-chip is-none">+' + (refs.length - 6) + ' more</span>' : '';
      var label = r.id + ' ' + r.name + ' ' + (r.aliases || []).join(' ') + ' ' + refs.join(' ');
      var relationLabel = kindName === 'actors' ? 'Techniques'
        : kindName === 'mitigations' ? 'Mitigates' : 'Techniques';
      var open = live ? '<a href="' + esc(SITE_BASE + r.page) + '">' : '';
      var close = live ? '</a>' : '';
      return '<article class="atk-card" id="' + esc(r.id) + '" data-filter="' + esc(label.toLowerCase()) + '">' +
        '<div class="atk-card-top"><span class="atk-card-id">' + esc(r.id) + '</span>' + badge(live) + '</div>' +
        '<h3 class="atk-card-name">' + open + esc(r.name) + close + '</h3>' +
        (sub ? '<p class="atk-card-alias">' + esc(sub) + '</p>' : '') +
        '<p class="atk-card-sum">' + esc(r.summary || '') + '</p>' +
        (extra ? '<p class="atk-card-meta">' + extra + '</p>' : '') +
        (refs.length
          ? '<p class="atk-card-meta">' + relationLabel + ': ' + refs.length + '</p><div class="atk-chips">' + chips + more + '</div>'
          : '<p class="atk-card-meta">No linked techniques yet.</p>') +
        '</article>';
    }

    function wireFilter() {
      if (!filter || filter.dataset.wired) return;
      filter.dataset.wired = '1';
      filter.addEventListener('input', function () {
        var q = filter.value.trim().toLowerCase();
        $$('.atk-card', grid).forEach(function (card) {
          card.classList.toggle('is-hidden', !!q && card.dataset.filter.indexOf(q) === -1);
        });
        $$('.atk-hub-group', grid).forEach(function (g) {
          var visible = $$('.atk-card', g).filter(function (c) { return !c.classList.contains('is-hidden'); }).length;
          g.classList.toggle('is-hidden', visible === 0);
        });
      });
    }

    if (kind === 'techniques') {
      Promise.all([getData('data/tactics.json'), getData(sources[kind])]).then(function (res) {
        var tactics = res[0] || [], techniques = res[1];
        if (!techniques) { grid.innerHTML = emptyHtml(); return; }
        var mode = 'live';
        try {
          var saved = localStorage.getItem('atk-hub-mode');
          if (saved === 'live' || saved === 'all') mode = saved;
        } catch (e) { /* private mode */ }
        var liveCount = techniques.filter(function (r) { return r.status === 'implemented'; }).length;

        function draw() {
          var html =
            '<div class="atk-hub-controls" role="group" aria-label="Technique catalogue scope">' +
              '<button type="button" class="atk-mode-btn' + (mode === 'live' ? ' is-on' : '') + '" data-hub-mode="live" aria-pressed="' + (mode === 'live') + '">Live guides (' + liveCount + ')</button>' +
              '<button type="button" class="atk-mode-btn' + (mode === 'all' ? ' is-on' : '') + '" data-hub-mode="all" aria-pressed="' + (mode === 'all') + '">Full catalogue (' + techniques.length + ')</button>' +
              '<span class="atk-mode-note">' + (mode === 'live' ? 'Planned techniques stay in the data layer and search; switch to the full catalogue to browse them.' : 'The complete ATT&CK catalogue. Live guides are filled; planned rows are roadmapped.') + '</span>' +
            '</div>';
          tactics.slice().sort(function (a, b) { return a.order - b.order; }).forEach(function (t) {
            var all = techniques
              .filter(function (r) { return r.tactic === t.id; })
              .sort(function (a, b) { return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; });
            var visible = mode === 'live' ? all.filter(function (r) { return r.status === 'implemented'; }) : all;
            if (!visible.length) return;
            html += '<section class="atk-hub-group" id="' + esc(t.id) + '">' +
              '<h2 class="atk-hub-group-title">' + esc(t.name) +
              '<span class="atk-hub-group-count">' + visible.length + ' / ' + all.length + '</span></h2>' +
              '<div class="atk-grid">' + visible.map(techCard).join('') + '</div></section>';
          });
          grid.innerHTML = html;
          wireFilter();
        }

        draw();
        if (!grid.dataset.hubWired) {
          grid.dataset.hubWired = '1';
          grid.addEventListener('click', function (e) {
            var modeBtn = e.target.closest ? e.target.closest('[data-hub-mode]') : null;
            if (!modeBtn) return;
            mode = modeBtn.dataset.hubMode;
            try { localStorage.setItem('atk-hub-mode', mode); } catch (err) { /* private mode */ }
            draw();
          });
        }
      });
    } else {
      Promise.all([getData(sources[kind]), getData('data/techniques.json')]).then(function (res) {
        var rows = res[0], techniques = res[1] || [];
        if (!rows) { grid.innerHTML = emptyHtml(); return; }
        var techById = {};
        techniques.forEach(function (r) { techById[r.id] = r; });
        grid.innerHTML = '<div class="atk-grid">' +
          rows.map(function (r) { return entityCard(kind, r, techById); }).join('') + '</div>';
        wireFilter();
      });
    }
  }

  function renderBreadcrumbs(techId) {
    var mount = mountAt('#atk-breadcrumbs', function (node) {
      var header = $('#atk-header');
      if (header && header.parentNode) {
        header.parentNode.insertBefore(node, header.nextSibling);
      } else {
        document.body.insertBefore(node, document.body.firstChild);
      }
    });
    Promise.all([getData('data/tactics.json'), getData('data/techniques.json')]).then(function (res) {
      var tactics = res[0] || [], techniques = res[1];
      if (!techniques) return;
      var row = techniques.filter(function (r) { return r.id === techId; })[0];
      if (!row) { console.warn('[platform] technique ' + techId + ' not found in techniques.json'); return; }
      var tactic = tactics.filter(function (t) { return t.id === row.tactic; })[0];
      var tacticName = tactic ? tactic.name : row.tactic;
      mount.innerHTML =
        '<nav class="atk-breadcrumbs" aria-label="Breadcrumb">' +
          '<a href="' + SITE_BASE + '">Home</a><span class="atk-crumb-sep" aria-hidden="true">\u203a</span>' +
          '<a href="' + SITE_BASE + 'techniques/#' + esc(row.tactic) + '">' + esc(tacticName) + '</a><span class="atk-crumb-sep" aria-hidden="true">\u203a</span>' +
          '<strong aria-current="page">' + esc(row.id) + ' \u2014 ' + esc(row.name) + '</strong>' +
        '</nav>';
    });
  }

  function renderCrosslinks(techId) {
    var mount = mountAt('#atk-relations', function (node) {
      var main = $('main') || document.body;
      main.appendChild(node);
    });
    Promise.all([
      getData('data/techniques.json'),
      getData('data/actors.json'),
      getData('data/mitigations.json')
    ]).then(function (res) {
      var techniques = res[0], actors = res[1] || [], mitigations = res[2] || [];
      if (!techniques) return;
      var row = techniques.filter(function (r) { return r.id === techId; })[0];
      if (!row) { console.warn('[platform] technique ' + techId + ' not found for crosslinks'); return; }

      var usedBy = (row.used_by || []).map(function (id) {
        return actors.filter(function (a) { return a.id === id; })[0] || { id: id, name: id, status: 'planned' };
      });
      var mitigatedBy = (row.mitigated_by || []).map(function (id) {
        return mitigations.filter(function (m) { return m.id === id; })[0] || { id: id, name: id, status: 'planned' };
      });
      var rules = row.sigma || [];

      function entityChip(entry, hubPath) {
        var live = entry.status === 'implemented';
        var href = (live && entry.page) ? SITE_BASE + entry.page : SITE_BASE + hubPath + '#' + esc(entry.id);
        return '<a class="atk-chip ' + (live ? 'is-live' : 'is-planned') + '" ' +
               'href="' + href + '" ' +
               'title="' + (live ? 'Open the reference entry' : 'Reference entry - full dossier planned') + '">' +
               esc(entry.id) + ' \u2014 ' + esc(entry.name) + '</a>';
      }

      function ruleChip(file) {
        var label = file.split('/').pop().replace(/\.yml$/, '')
          .replace(/^[t]\d{4}(?:\.\d{3})?-/i, '').replace(/-/g, ' ');
        label = label.charAt(0).toUpperCase() + label.slice(1);
        return '<a class="atk-chip is-rule" href="' + SITE_BASE + 'tools/sigma.html#' + esc(file) + '" title="' + esc(file) + '">' +
               esc(label) + '</a>';
      }

      function group(title, count, inner) {
        return '<div class="atk-rel-group">' +
          '<h3 class="atk-rel-title">' + esc(title) +
          (count ? ' <span class="atk-rel-count">(' + count + ')</span>' : '') + '</h3>' +
          '<div class="atk-chips">' + inner + '</div></div>';
      }

      var usedHtml = usedBy.length
        ? usedBy.map(function (a) { return entityChip(a, 'actors/'); }).join('')
        : '<span class="atk-chip is-none">None linked yet</span>';
      var mitigatedHtml = mitigatedBy.length
        ? mitigatedBy.map(function (m) { return entityChip(m, 'mitigations/'); }).join('')
        : '<span class="atk-chip is-none">None linked yet</span>';
      var detectedHtml = rules.length
        ? rules.map(ruleChip).join('')
        : '<span class="atk-chip is-none">No Sigma rules linked yet</span>';

      mount.innerHTML =
        '<section class="atk-relations" aria-label="Relations">' +
        group('Used by', usedBy.length, usedHtml) +
        group('Mitigated by', mitigatedBy.length, mitigatedHtml) +
        group('Detected by', rules.length, detectedHtml) +
        '</section>';
    });
  }

  function renderPrevNext(techId) {
    var mount = mountAt('#atk-prevnext', function (node) {
      var main = $('main') || document.body;
      main.appendChild(node);
    });
    Promise.all([getData('data/tactics.json'), getData('data/techniques.json')]).then(function (res) {
      var tactics = res[0] || [], techniques = res[1];
      if (!techniques) return;
      var row = techniques.filter(function (r) { return r.id === techId; })[0];
      if (!row) return;
      var tactic = tactics.filter(function (t) { return t.id === row.tactic; })[0];
      var tacticName = tactic ? tactic.name : row.tactic;
      var chain = techniques
        .filter(function (r) { return r.tactic === row.tactic; })
        .sort(function (a, b) { return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; });
      var i = chain.indexOf(row);

      function nav(r, dir, fallbackText) {
        if (!r) {
          return '<span class="atk-pn-link is-disabled" aria-disabled="true">' +
                 '<span class="atk-pn-dir">' + dir + '</span>' +
                 '<span class="atk-pn-name">' + esc(fallbackText) + '</span></span>';
        }
        var href = (r.status === 'implemented' && r.page)
          ? SITE_BASE + r.page
          : SITE_BASE + 'techniques/#' + esc(r.tactic);
        return '<a class="atk-pn-link" href="' + esc(href) + '">' +
               '<span class="atk-pn-dir">' + dir + '</span>' +
               '<span class="atk-pn-name">' + esc(r.id) + ' \u2014 ' + esc(r.name) + '</span></a>';
      }

      mount.innerHTML =
        '<nav class="atk-prevnext" aria-label="Adjacent techniques in this tactic">' +
        nav(chain[i - 1], 'Previous', 'Start of the ' + tacticName + ' chain') +
        nav(chain[i + 1], 'Next', 'End of the ' + tacticName + ' chain') +
        '</nav>';
    });
  }

  /* ------------------------------------------------------------------ *
   * 9. Boot                                                            *
   * ------------------------------------------------------------------ */
  function boot() {
    renderHeader();
    initShortcuts();
    renderMatrix();
    renderHub();
    var mount = $('#atk-header');
    var techId = mount && mount.dataset.technique;
    if (techId) {
      renderBreadcrumbs(techId);
      renderCrosslinks(techId);
      renderPrevNext(techId);
    }
    /* Footer is deliberately last: the relations/prev-next fallbacks append
     * into <main> (or <body>) and must never land below the footer. */
    renderFooter();
    /* Smart 404: <body data-atk-auto-search> opens search on load and
     * prefills any T-pattern found in the dead URL. */
    if (document.body.dataset.atkAutoSearch) {
      var m = window.location.pathname.match(/T\d{4}(?:\.\d{3})?/i);
      window.setTimeout(function () { ensureSearch(m ? m[0] : ''); }, 250);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();