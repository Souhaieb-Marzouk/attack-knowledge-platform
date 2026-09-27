/*! ATT&CK Knowledge Platform - coverage.js
 * Detection coverage scoring: percentage of technique rows per tactic
 * with at least one CI-validated Sigma rule. Renders from techniques.json,
 * tactics.json and sigma-index.json - the same sources as everything else.
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

  function fetchJson(file) {
    return fetch(SITE_BASE + file).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status + ' for ' + file);
      return r.json();
    });
  }

  Promise.all([
    fetchJson('data/tactics.json'),
    fetchJson('data/techniques.json'),
    fetchJson('data/sigma-index.json')
  ]).then(render).catch(function (err) {
    console.warn('[coverage] ' + err.message);
    var summary = $('#atk-cov-summary');
    if (summary) summary.innerHTML = 'Coverage data unavailable right now (' + esc(err.message) + ').';
  });

  function render(res) {
    var tactics = res[0] || [];
    var techniques = res[1] || [];
    var idx = res[2] || {};
    var rules = idx.rules || [];

    /* covered[techniqueId] = [rule, rule, ...] - union of the rule's
     * technique tags and the row's sigma array, so either direction of
     * bookkeeping counts. */
    var covered = {};
    rules.forEach(function (r) {
      (r.techniques || []).forEach(function (t) {
        (covered[t] = covered[t] || []).push(r);
      });
    });
    var ruleByFile = {};
    rules.forEach(function (r) { ruleByFile[r.file] = r; });
    techniques.forEach(function (row) {
      (row.sigma || []).forEach(function (f) {
        if (ruleByFile[f] && (covered[row.id] || []).indexOf(ruleByFile[f]) === -1) {
          (covered[row.id] = covered[row.id] || []).push(ruleByFile[f]);
        }
      });
    });

    var ordered = tactics.slice().sort(function (a, b) { return a.order - b.order; });
    var totalCovered = 0;
    var perTactic = ordered.map(function (t) {
      var rows = techniques.filter(function (r) { return r.tactic === t.id; });
      var cov = rows.filter(function (r) { return covered[r.id]; });
      totalCovered += cov.length;
      return { tactic: t, rows: rows, covered: cov };
    });

    var total = techniques.length;
    var pct = total ? Math.round((totalCovered / total) * 100) : 0;

    /* ---- summary card: animated ring + the formula in plain words ---- */
    var summary = $('#atk-cov-summary');
    if (summary) {
      var R = 38, C = 2 * Math.PI * R;
      var built = String(idx.generated || '').slice(0, 10);
      summary.innerHTML =
        '<div class="atk-cov-ring" role="img" aria-label="Overall coverage ' + pct + ' percent">' +
          '<svg viewBox="0 0 92 92" aria-hidden="true" focusable="false">' +
            '<circle class="track" cx="46" cy="46" r="' + R + '"></circle>' +
            '<circle class="bar" cx="46" cy="46" r="' + R + '" stroke-dasharray="' + C.toFixed(1) + '" stroke-dashoffset="' + C.toFixed(1) + '"></circle>' +
          '</svg>' +
          '<span class="atk-cov-ring-num">' + pct + '%</span>' +
        '</div>' +
        '<div class="atk-cov-stats">' +
          '<p><b>' + totalCovered + ' of ' + total + '</b> tracked techniques have at least one CI-validated rule.</p>' +
          '<p><b>' + rules.length + '</b> rules in the library \u00b7 index built <b>' + esc(built || 'n/a') + '</b> UTC</p>' +
          '<p class="atk-cov-note">Coverage formula: a technique counts as covered when a rule in <code>data/sigma-index.json</code> tags it, or its <code>sigma</code> array links a rule in the index. Planned techniques can be covered \u2014 the rule often exists before the guide does.</p>' +
        '</div>';
      /* double rAF: paint the 0-state first, then animate to the value */
      window.requestAnimationFrame(function () {
        window.requestAnimationFrame(function () {
          var bar = summary.querySelector('.bar');
          if (bar) bar.setAttribute('stroke-dashoffset', (C * (1 - (total ? totalCovered / total : 0))).toFixed(1));
        });
      });
    }

    /* ---- per-tactic bars, staggered ---- */
    var bars = $('#atk-cov-bars');
    if (bars) {
      bars.innerHTML = perTactic.map(function (s, i) {
        var p = s.rows.length ? Math.round((s.covered.length / s.rows.length) * 100) : 0;
        return '<div class="atk-cov-row">' +
          '<span class="atk-cov-tactic">' + esc(s.tactic.name) + '</span>' +
          '<span class="atk-cov-barwrap"><span class="atk-cov-bar" data-w="' + p + '" style="transition-delay:' + (i * 60) + 'ms"></span></span>' +
          '<span class="atk-cov-pct">' + s.covered.length + ' / ' + s.rows.length + ' \u00b7 ' + p + '%</span>' +
        '</div>';
      }).join('');
      window.requestAnimationFrame(function () {
        window.requestAnimationFrame(function () {
          $$('.atk-cov-bar', bars).forEach(function (b) {
            b.style.width = b.dataset.w + '%';
          });
        });
      });
    }

    /* ---- detail table: every technique, its rules as library links ---- */
    var table = $('#atk-cov-table');
    if (table) {
      var html = '<table class="atk-cov-table"><thead><tr><th>Tactic</th><th>Technique</th><th>Validated rules</th></tr></thead><tbody>';
      perTactic.forEach(function (s) {
        s.rows.forEach(function (r) {
          var rl = covered[r.id] || [];
          var rulesCell = rl.length
            ? rl.map(function (rule) {
                return '<a href="' + SITE_BASE + 'tools/sigma.html#' + esc(rule.file) + '" title="Open this rule in the library">' + esc(rule.title) + '</a>';
              }).join('<br>')
            : '<span class="atk-cov-none">\u2014</span>';
          var name = (r.status === 'implemented' && r.page)
            ? '<a href="' + esc(SITE_BASE + r.page) + '"><b>' + esc(r.id) + '</b> ' + esc(r.name) + '</a>'
            : '<b>' + esc(r.id) + '</b> ' + esc(r.name);
          html += '<tr><td>' + esc(s.tactic.name) + '</td><td>' + name + '</td><td>' + rulesCell + '</td></tr>';
        });
      });
      html += '</tbody></table>';
      table.innerHTML = html;
    }
  }
})();