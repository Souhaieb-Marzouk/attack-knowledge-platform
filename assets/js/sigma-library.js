/*! ATT&CK Knowledge Platform - sigma-library.js
 * Renders the Sigma Rule Library from the CI-generated index
 * (data/sigma-index.json). Filters, Copy YAML, deep links.
 */
(function () {
  'use strict';

  var SITE_BASE = new URL('../../', document.currentScript.src).href;

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  /* Clipboard: execCommand first (works on http://localhost and file://),
   * navigator.clipboard as fallback (needs a secure context). */
  function copyText(text, done) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    if (!ok && navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
      return;
    }
    done(ok);
  }

  function fmtDate(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso || '');
    return d.toISOString().slice(0, 10);
  }

  var tacticFilter = '';
  var productFilter = '';

  fetch(SITE_BASE + 'data/sigma-index.json')
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function (idx) {
      /* techniques.json is optional here - it only enriches links. */
      return fetch(SITE_BASE + 'data/techniques.json')
        .catch(function () { return null; })
        .then(function (techRes) {
          if (!techRes || !techRes.ok) return [idx, []];
          return techRes.json().then(function (tech) { return [idx, tech || []]; });
        });
    })
    .then(render)
    .catch(function (err) {
      console.warn('[sigma-library] index unavailable - ' + err.message);
      var banner = $('#atk-sigma-banner');
      if (banner) {
        banner.className = 'atk-sigma-banner is-missing';
        banner.innerHTML = 'Rule index not found. Run <code>python scripts/build_sigma_index.py</code> and commit <code>data/sigma-index.json</code> (see the repo README).';
      }
    });

  function render(args) {
    var idx = args[0];
    var techniques = args[1] || [];
    var rules = (idx && idx.rules) || [];
    var techById = {};
    techniques.forEach(function (r) { techById[r.id] = r; });

    var banner = $('#atk-sigma-banner');
    if (banner) {
      banner.className = 'atk-sigma-banner is-ok';
      banner.innerHTML = '<strong>All ' + ((idx && idx.count != null) ? idx.count : rules.length) +
        ' rules valid</strong> \u2014 last checked ' + esc(fmtDate(idx && idx.generated)) + ' UTC';
    }

    /* Filter options derived from the data itself. */
    var tactics = [];
    var products = [];
    rules.forEach(function (r) {
      (r.tactics || []).forEach(function (t) { if (tactics.indexOf(t) === -1) tactics.push(t); });
      var p = r.logsource && r.logsource.product;
      if (p && products.indexOf(p) === -1) products.push(p);
    });

    var filterRow = $('#atk-sigma-tactics');
    if (filterRow) {
      filterRow.innerHTML =
        '<button type="button" class="atk-chip is-filter is-on" data-tactic="">All tactics</button>' +
        tactics.sort().map(function (t) {
          return '<button type="button" class="atk-chip is-filter" data-tactic="' + esc(t) + '">' + esc(t) + '</button>';
        }).join('');
    }
    var productSel = $('#atk-sigma-product');
    if (productSel) {
      productSel.innerHTML =
        '<option value="">All logsource products</option>' +
        products.sort().map(function (p) {
          return '<option value="' + esc(p) + '">' + esc(p) + '</option>';
        }).join('');
    }

    var grid = $('#atk-sigma-grid');
    if (!grid) return;
    grid.innerHTML = rules.map(function (r) { return card(r); }).join('');

    function card(r) {
      var techChips = (r.techniques || []).map(function (tid) {
        var row = techById[tid];
        if (row && row.status === 'implemented' && row.page) {
          return '<a class="atk-chip is-live" href="' + SITE_BASE + esc(row.page) + '" title="Open the technique guide">' + esc(tid) + '</a>';
        }
        return '<span class="atk-chip is-planned" title="Guide in progress">' + esc(tid) + '</span>';
      }).join('');
      var levelClass = 'is-level-' + (r.level || 'low');
      return '<article class="atk-card atk-sigma-card" data-file="' + esc(r.file) + '" ' +
        'data-tactics="' + esc((r.tactics || []).join(' ')) + '" ' +
        'data-product="' + esc((r.logsource && r.logsource.product) || '') + '">' +
        '<div class="atk-card-top"><h3 class="atk-card-name">' + esc(r.title) + '</h3>' +
        '<span class="atk-badge ' + levelClass + '">' + esc(String(r.level || '').toUpperCase() || 'LEVEL?') + '</span></div>' +
        '<p class="atk-sigma-meta"><span class="atk-badge ' + (r.status === 'stable' ? 'is-live' : 'is-planned') + '">' + esc(r.status || '') + '</span>' +
        '<code class="atk-sigma-id">' + esc(r.id) + '</code></p>' +
        '<p class="atk-card-sum">' + esc(r.description || '') + '</p>' +
        '<p class="atk-sigma-meta"><span class="atk-sigma-ls">' +
        esc((r.logsource && r.logsource.category) || '') + ' / ' + esc((r.logsource && r.logsource.product) || '') +
        '</span></p>' +
        '<div class="atk-chips">' +
        (r.tactics || []).map(function (t) { return '<span class="atk-chip is-tactic">' + esc(t) + '</span>'; }).join('') +
        techChips + '</div>' +
        '<div class="atk-sigma-actions"><button type="button" class="atk-copy-yaml" data-file="' + esc(r.file) + '">Copy YAML</button></div>' +
        '</article>';
    }

    /* Filters: instant, client-side. */
    function applyFilters() {
      var shown = 0;
      $$('.atk-sigma-card', grid).forEach(function (cardEl) {
        var okT = !tacticFilter || cardEl.dataset.tactics.split(' ').indexOf(tacticFilter) !== -1;
        var okP = !productFilter || cardEl.dataset.product === productFilter;
        var ok = okT && okP;
        cardEl.classList.toggle('is-hidden', !ok);
        if (ok) shown += 1;
      });
      var emptyMsg = $('#atk-sigma-empty');
      if (emptyMsg) emptyMsg.hidden = shown !== 0;
    }

    if (filterRow) {
      filterRow.addEventListener('click', function (e) {
        var b = e.target.closest ? e.target.closest('.atk-chip.is-filter') : null;
        if (!b) return;
        tacticFilter = b.dataset.tactic || '';
        $$('.atk-chip.is-filter', filterRow).forEach(function (c) { c.classList.toggle('is-on', c === b); });
        applyFilters();
      });
    }
    if (productSel) {
      productSel.addEventListener('change', function () {
        productFilter = productSel.value;
        applyFilters();
      });
    }

    /* Copy YAML (delegated - survives re-renders). */
    grid.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('.atk-copy-yaml') : null;
      if (!b) return;
      b.disabled = true;
      b.textContent = 'Fetching\u2026';
      fetch(SITE_BASE + b.dataset.file).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.text();
      }).then(function (text) {
        copyText(text, function (ok) {
          b.textContent = ok ? 'Copied \u2713' : 'Copy failed';
          b.classList.add(ok ? 'is-ok' : 'is-err');
          window.setTimeout(function () {
            b.disabled = false;
            b.textContent = 'Copy YAML';
            b.classList.remove('is-ok', 'is-err');
          }, 1600);
        });
      }).catch(function (err) {
        console.warn('[sigma-library] ' + err.message);
        b.textContent = 'Fetch failed';
        window.setTimeout(function () {
          b.disabled = false;
          b.textContent = 'Copy YAML';
        }, 1600);
      });
    });

    /* Deep link: tools/sigma.html#sigma/rules/<file>.yml - used by the
     * "Detected by" chips on technique pages. Values are our own file
     * paths, so no sanitization is needed on either side. */
    var hash = decodeURIComponent((window.location.hash || '').slice(1));
    if (hash) {
      var target = $('.atk-sigma-card[data-file="' + hash.replace(/"/g, '\\"') + '"]', grid);
      if (target) {
        target.classList.add('is-flash');
        window.setTimeout(function () {
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 150);
      }
    }
  }
})();