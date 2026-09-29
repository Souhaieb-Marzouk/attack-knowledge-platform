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
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }

  function applyTheme(theme, persist) {
    document.documentElement.setAttribute('data-theme', theme);
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
    var mount = $('#atk-matrix');
    if (!mount) return;

    Promise.all([getData('data/tactics.json'), getData('data/techniques.json')]).then(function (res) {
      var tactics = res[0], techniques = res[1];
      if (!tactics || !techniques) {
        mount.innerHTML = '<p class="atk-hub-error">Matrix data unavailable right now.</p>';
        return;
      }

      var ordered = tactics.slice().sort(function (a, b) { return a.order - b.order; });
      var live = 0, planned = 0;
      techniques.forEach(function (r) {
        if (r.status === 'implemented') live += 1; else planned += 1;
      });

      setCount('atk-count-live', live);
      setCount('atk-count-planned', planned);
      setCount('atk-count-tactics', ordered.length);
      getData('data/sigma-index.json').then(function (idx) {
        setCount('atk-count-rules', idx && idx.count ? idx.count : 0);
      });

      var html =
        '<div class="atk-matrix-legend">' +
          '<span class="atk-legend-item"><span class="atk-swatch is-impl" role="img" aria-label="Live guide"></span>Live guide</span>' +
          '<span class="atk-legend-item"><span class="atk-swatch is-planned" role="img" aria-label="Planned guide"></span>Planned</span>' +
          '<span class="atk-legend-note">' + live + ' of ' + (live + planned) + ' guides live across ' + ordered.length + ' tactics</span>' +
        '</div>' +
        '<div class="atk-matrix-scroll">' +
        '<div class="atk-matrix">';

      ordered.forEach(function (t) {
        var rows = techniques
          .filter(function (r) { return r.tactic === t.id; })
          .sort(function (a, b) { return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; });
        html += '<div class="atk-col"><h3 class="atk-col-title" title="' + esc(t.name) + '">' + esc(t.name) + '</h3>';
        rows.forEach(function (r) {
          var isLive = r.status === 'implemented' && r.page;
          var tip = esc(r.id + ' \u2014 ' + r.name + (isLive ? ' \u2014 Live guide' : ' \u2014 Guide in progress'));
          html += isLive
            ? '<button type="button" class="atk-tile is-impl" data-page="' + esc(SITE_BASE + r.page) + '" title="' + tip + '" aria-label="' + tip + '">' + esc(r.id) + '</button>'
            : '<button type="button" class="atk-tile is-planned" title="' + tip + '" aria-label="' + tip + '">' + esc(r.id) + '</button>';
        });
        if (!rows.length) html += '<p class="atk-col-empty">\u2014</p>';
        html += '</div>';
      });

      html += '</div></div>';
      mount.innerHTML = html;

      /* One delegated click handler survives innerHTML redraws. */
      if (!mount.dataset.wired) {
        mount.dataset.wired = '1';
        mount.addEventListener('click', function (e) {
          var tile = e.target.closest ? e.target.closest('.atk-tile') : null;
          if (!tile) return;
          if (tile.classList.contains('is-impl') && tile.dataset.page) {
            window.location.href = tile.dataset.page;
          } else {
            toast('Guide in progress - Watch the repo on GitHub to hear when it lands.');
          }
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

    function entityCard(kindName, r) {
      var live = r.status === 'implemented' && r.page;
      var sub = kindName === 'campaigns'
        ? String(r.year || '')
        : (r.aliases || []).join(' \u00b7 ');
      var extra = kindName === 'mitigations' ? 'Type: ' + esc(r.type || '—') : '';
      var label = r.id + ' ' + r.name + ' ' + (r.aliases || []).join(' ');
      return '<article class="atk-card" id="' + esc(r.id) + '" data-filter="' + esc(label.toLowerCase()) + '">' +
        '<div class="atk-card-top"><span class="atk-card-id">' + esc(r.id) + '</span>' + badge(live) + '</div>' +
        '<h3 class="atk-card-name">' + esc(r.name) + '</h3>' +
        (sub ? '<p class="atk-card-alias">' + esc(sub) + '</p>' : '') +
        '<p class="atk-card-sum">' + esc(r.summary || '') + '</p>' +
        (extra ? '<p class="atk-card-meta">' + extra + '</p>' : '') +
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
        var html = '';
        tactics.slice().sort(function (a, b) { return a.order - b.order; }).forEach(function (t) {
          var rows = techniques
            .filter(function (r) { return r.tactic === t.id; })
            .sort(function (a, b) { return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; });
          html += '<section class="atk-hub-group" id="' + esc(t.id) + '">' +
            '<h2 class="atk-hub-group-title">' + esc(t.name) +
            '<span class="atk-hub-group-count">' + rows.length + '</span></h2>' +
            '<div class="atk-grid">' + rows.map(techCard).join('') + '</div></section>';
        });
        grid.innerHTML = html;
        wireFilter();
      });
    } else {
      getData(sources[kind]).then(function (rows) {
        if (!rows) { grid.innerHTML = emptyHtml(); return; }
        grid.innerHTML = '<div class="atk-grid">' +
          rows.map(function (r) { return entityCard(kind, r); }).join('') + '</div>';
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
        if (entry.status === 'implemented') {
          return '<a class="atk-chip is-live" href="' + SITE_BASE + hubPath + '#' + esc(entry.id) + '">' +
                 esc(entry.id) + ' \u2014 ' + esc(entry.name) + '</a>';
        }
        return '<span class="atk-chip is-planned" title="Planned \u2014 page in progress">' +
               esc(entry.id) + ' \u2014 ' + esc(entry.name) + '</span>';
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
    renderFooter();
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