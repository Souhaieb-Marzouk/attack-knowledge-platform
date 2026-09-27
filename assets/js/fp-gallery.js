
/*! ATT&CK Knowledge Platform - fp-gallery.js
 * False-positive gallery: curated benign triggers per Sigma rule,
 * rendered from data/fp-gallery.json joined against data/sigma-index.json.
 */
(function () {
  'use strict';

  var SITE_BASE = new URL('../../', document.currentScript.src).href;

  function $(sel, root) { return (root || document).querySelector(sel); }
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
    fetchJson('data/fp-gallery.json'),
    fetchJson('data/sigma-index.json')
  ]).then(render).catch(function (err) {
    console.warn('[fp-gallery] ' + err.message);
    var mount = $('#atk-fp-root');
    if (mount) mount.innerHTML = '<p class="atk-hub-error">Gallery data unavailable right now (' + esc(err.message) + ').</p>';
  });

  function render(res) {
    var groups = res[0] || [];
    var idx = res[1] || {};
    var rules = idx.rules || [];
    var ruleByFile = {};
    rules.forEach(function (r) { ruleByFile[r.file] = r; });

    var mount = $('#atk-fp-root');
    if (!mount) return;

    var totalEntries = groups.reduce(function (n, g) { return n + (g.entries || []).length; }, 0);
    var orphans = groups.filter(function (g) { return !ruleByFile[g.rule]; });

    var html = '<p class="atk-lede">' + totalEntries + ' curated false positive' + (totalEntries === 1 ? '' : 's') +
      ' across ' + groups.length + ' rule' + (groups.length === 1 ? '' : 's') +
      ' \u2014 each with the scenario, the evidence pattern, and the tuning decision.' +
      (orphans.length
        ? ' <strong class="atk-fp-warn">Data warning:</strong> ' + orphans.length + ' group' + (orphans.length === 1 ? '' : 's') +
          ' reference' + (orphans.length === 1 ? 's' : '') + ' a rule file that is not in the index \u2014 run <code>python scripts/validate_data.py</code> and fix the path.'
        : '') +
      '</p>';

    groups.forEach(function (g) {
      var rule = ruleByFile[g.rule];
      var levelClass = rule ? ('is-level-' + (rule.level || 'low')) : 'is-planned';
      html += '<section class="atk-fp-rule">' +
        '<div class="atk-fp-rule-head">' +
          '<h3>' + (rule ? esc(rule.title) : esc(g.rule)) + '</h3>' +
          (rule ? '<span class="atk-badge ' + levelClass + '">' + esc(String(rule.level || '').toUpperCase()) + '</span>' : '') +
          '<a class="atk-fp-rule-link" href="' + SITE_BASE + 'tools/sigma.html#' + esc(g.rule) + '">Open in library \u2192</a>' +
        '</div>' +
        '<p class="atk-fp-rule-meta">' +
          (rule
            ? esc((rule.logsource && rule.logsource.category) || '') + ' / ' + esc((rule.logsource && rule.logsource.product) || '') +
              ' \u00b7 <code>' + esc(rule.file) + '</code>'
            : 'rule missing from sigma-index.json') +
        '</p>' +
        (g.entries || []).map(function (e) {
          return '<article class="atk-fp-entry">' +
            '<h4>' + esc(e.name) + '</h4>' +
            '<p class="atk-fp-field"><span class="lbl">Scenario</span>' + esc(e.scenario) + '</p>' +
            '<p class="atk-fp-field"><span class="lbl">Evidence pattern</span>' + esc(e.evidence) + '</p>' +
            '<p class="atk-fp-field is-tuning"><span class="lbl">Tuning</span>' + esc(e.tuning) + '</p>' +
          '</article>';
        }).join('') +
      '</section>';
    });

    /* Honesty section: rules with no documented false positives yet. */
    var withFp = {};
    groups.forEach(function (g) { withFp[g.rule] = true; });
    var missing = rules.filter(function (r) { return !withFp[r.file]; });
    if (missing.length) {
      html += '<section class="atk-fp-rule">' +
        '<h3>No documented false positives yet</h3>' +
        missing.map(function (r) {
          return '<p class="atk-fp-empty">' + esc(r.title) + ' (<code>' + esc(r.file) + '</code>) \u2014 add an entry in <code>data/fp-gallery.json</code> once a benign trigger is confirmed in production.</p>';
        }).join('') +
      '</section>';
    }

    mount.innerHTML = html;
  }
})();