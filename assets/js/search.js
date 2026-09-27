/*! ATT&CK Knowledge Platform - search.js
 * Ctrl+K global search: inverted index + ranked results + a11y modal.
 * Loaded statically on shell pages; lazy-loaded by platform.js on
 * hand-made technique pages (the integration contract).
 *
 * Ranking (documented, sums per doc, stable sort, cap 12):
 *   exact ID match          100
 *   ID starts-with           60
 *   title starts-with        40
 *   alias/keyword hit        30   (actor aliases live in the subtitle)
 *   title substring          25
 *   text substring           10   (id + title + summary + keywords blob)
 */
(function () {
  'use strict';
  window.__atkSearchReady = true;

  var bootScript = document.currentScript;
  var SITE_BASE = (bootScript && bootScript.src)
    ? new URL('../../', bootScript.src).href
    : '';
  var pending = (bootScript && bootScript.dataset.atkPending) || '';
  /* Auto-open whenever platform.js injected this script ON DEMAND - it
   * stamps data-atk-pending on the tag for both lazy triggers (the 404
   * auto-search and the first Ctrl+K on hand-made pages), even when the
   * query is empty, so the FIRST trigger opens the modal. Statically
   * included tags carry no such attribute and never auto-open. */
  var lazyOpen = !!(bootScript && bootScript.hasAttribute && bootScript.hasAttribute('data-atk-pending'));

  /* ------------------------------------------------------------------ *
   * 1. Inverted index                                                   *
   * ------------------------------------------------------------------ */
  var docs = [];                 /* {type,id,title,subtitle,url,planned,updated,blob,isAlias} */
  var postings = new Map();      /* token -> array of doc indices */
  var loaded = false;
  var loading = null;

  /* Lowercase, split on non-alphanumerics but KEEP DOTS, and additionally
   * emit the dot-separated parts: "T1566.001" -> t1566.001, t1566, 001. */
  function tokenize(value) {
    var out = [];
    var raw = String(value == null ? '' : value).toLowerCase().match(/[a-z0-9.]+/g) || [];
    raw.forEach(function (tok) {
      out.push(tok);
      if (tok.indexOf('.') !== -1) {
        tok.split('.').forEach(function (part) { if (part) out.push(part); });
      }
    });
    return out;
  }

  function addDoc(doc, searchText) {
    var i = docs.length;
    doc.blob = searchText.toLowerCase();
    docs.push(doc);
    tokenize(searchText).forEach(function (tok) {
      if (!postings.has(tok)) postings.set(tok, []);
      var list = postings.get(tok);
      if (list.indexOf(i) === -1) list.push(i);
    });
  }

  function buildIndex() {
    var sources = [
      ['data/techniques.json', function (rows) {
        (rows || []).forEach(function (r) {
          addDoc({
            type: 'Technique', id: r.id, title: r.name,
            subtitle: r.summary || '',
            url: (r.status === 'implemented' && r.page) ? r.page : 'techniques/#' + r.id,
            planned: r.status !== 'implemented',
            isAlias: false,
            updated: r.updated || ''
          }, r.id + ' ' + r.name + ' ' + (r.summary || '') + ' ' + (r.platforms || []).join(' '));
        });
      }],
      ['data/actors.json', function (rows) {
        (rows || []).forEach(function (r) {
          addDoc({
            type: 'Actor', id: r.id, title: r.name,
            subtitle: (r.aliases || []).join(' \u00b7 '),
            url: 'actors/#' + r.id,
            planned: r.status !== 'implemented',
            isAlias: true,
            updated: r.updated || ''
          }, r.id + ' ' + r.name + ' ' + (r.aliases || []).join(' ') + ' ' + (r.summary || '') + ' ' + (r.uses || []).join(' '));
        });
      }],
      ['data/mitigations.json', function (rows) {
        (rows || []).forEach(function (r) {
          addDoc({
            type: 'Mitigation', id: r.id, title: r.name,
            subtitle: r.summary || '',
            url: 'mitigations/#' + r.id,
            planned: r.status !== 'implemented',
            isAlias: false,
            updated: r.updated || ''
          }, r.id + ' ' + r.name + ' ' + (r.type || '') + ' ' + (r.summary || ''));
        });
      }],
      ['data/campaigns.json', function (rows) {
        (rows || []).forEach(function (r) {
          addDoc({
            type: 'Campaign', id: r.id, title: r.name,
            subtitle: String(r.year || ''),
            url: 'campaigns/#' + r.id,
            planned: r.status !== 'implemented',
            isAlias: false,
            updated: r.updated || ''
          }, r.id + ' ' + r.name + ' ' + (r.summary || ''));
        });
      }],
      ['data/sigma-index.json', function (idx) {
        ((idx && idx.rules) || []).forEach(function (r) {
          addDoc({
            type: 'Sigma rule', id: r.id, title: r.title,
            subtitle: (r.level || '') + ' \u00b7 ' + ((r.logsource && r.logsource.product) || ''),
            url: 'tools/sigma.html#' + r.file,
            planned: false,
            isAlias: false,
            updated: r.date || ''
          }, r.title + ' ' + r.id + ' ' + r.file + ' ' + (r.techniques || []).join(' '));
        });
      }]
    ];
    /* Fetch in parallel, but INGEST in fixed source order. If each fetch
     * added its documents as it resolved, the docs array order - and with
     * it every tie-break in the ranking - would depend on network completion
     * order: typing 1566 could rank APT28 (whose 'uses' blob contains
     * T1566.001) above T1566.001 on one load and not the next. Deterministic
     * ranking requires a deterministic document order: techniques, actors,
     * mitigations, campaigns, rules - always. */
    return Promise.all(sources.map(function (s) {
      return fetch(SITE_BASE + s[0])
        .then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.json();
        })
        .catch(function (err) {
          /* Tolerate absent sources gracefully: skip with console.info,
           * never break search. (The Phase 2 seed means sigma-index.json
           * always exists; the tolerance stays as defense in depth.) */
          console.info('[search] skipping ' + s[0] + ' - ' + err.message);
          return null;
        });
    })).then(function (results) {
      results.forEach(function (rows, i) {
        if (rows) sources[i][1](rows);
      });
    });
  }

  /* ------------------------------------------------------------------ *
   * 2. Scoring                                                          *
   * ------------------------------------------------------------------ */
  function scorePhrase(doc, q) {
    if (!q) return 0;
    var idl = doc.id.toLowerCase();
    var titlel = doc.title.toLowerCase();
    var subl = (doc.subtitle || '').toLowerCase();
    var s = 0;
    if (idl === q) s += 100;
    if (idl.indexOf(q) === 0) s += 60;
    if (titlel.indexOf(q) === 0) s += 40;
    if (doc.isAlias && subl.indexOf(q) !== -1) s += 30;
    if (titlel.indexOf(q) > 0) s += 25;
    if (doc.blob.indexOf(q) !== -1) s += 10;
    return s;
  }

  function scoreDoc(doc, ql, tokens) {
    var total = scorePhrase(doc, ql);
    if (!(tokens.length === 1 && tokens[0] === ql)) {
      tokens.forEach(function (t) { total += scorePhrase(doc, t); });
    }
    return total;
  }

  function search(query) {
    var ql = String(query || '').trim().toLowerCase();
    if (!ql) return [];
    var tokens = tokenize(ql);

    /* Candidate generation: postings hits + prefix expansion over the
     * vocabulary + a substring safety net over the blob (keeps partial
     * IDs like "1566" working). */
    var cands = new Set();
    tokens.forEach(function (t) {
      postings.forEach(function (list, tok) {
        if (tok === t || tok.indexOf(t) === 0) {
          list.forEach(function (i) { cands.add(i); });
        }
      });
    });
    docs.forEach(function (d, i) {
      if (d.blob.indexOf(ql) !== -1) cands.add(i);
    });

    var scored = [];
    cands.forEach(function (i) {
      var s = scoreDoc(docs[i], ql, tokens);
      if (s > 0) scored.push({ i: i, s: s });
    });
    /* Stable sort: score desc, then original doc order. */
    scored.sort(function (a, b) { return b.s - a.s || a.i - b.i; });
    return scored.slice(0, 12).map(function (x) { return docs[x.i]; });
  }

  function recentTechniques() {
    return docs
      .filter(function (d) { return d.type === 'Technique'; })
      .sort(function (a, b) { return String(b.updated || '').localeCompare(String(a.updated || '')); })
      .slice(0, 5);
  }

  /* ------------------------------------------------------------------ *
   * 3. Modal UI                                                         *
   * ------------------------------------------------------------------ */
  var modal = null, input = null, list = null, foot = null;
  var opener = null, selected = -1, lastResults = [];

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

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
        '<ul class="atk-search-results" role="listbox" aria-label="Search results"></ul>' +
        '<div class="atk-search-foot"><kbd>\u2191\u2193</kbd> navigate <kbd>Enter</kbd> open <kbd>Esc</kbd> close</div>' +
      '</div>';
    document.body.appendChild(modal);
    input = modal.querySelector('input');
    list = modal.querySelector('.atk-search-results');
    foot = modal.querySelector('.atk-search-foot');

    modal.addEventListener('click', function (e) {
      if (e.target.closest('[data-close]') || e.target.closest('.atk-search-close')) close();
    });
    input.addEventListener('input', function () { runSearch(input.value); });
    input.addEventListener('keydown', onKeydown);
    document.addEventListener('keydown', function (e) {
      if (!modal || modal.hidden) return;
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      if (e.key === 'Tab') trapFocus(e);
    });
  }

  function resultHref(doc) {
    return (doc.url.indexOf('http') === 0 ? '' : SITE_BASE) + doc.url;
  }

  function renderSkeleton() {
    list.innerHTML = '';
    for (var i = 0; i < 5; i++) {
      var li = document.createElement('li');
      li.className = 'atk-search-skeleton';
      li.setAttribute('aria-hidden', 'true');
      list.appendChild(li);
    }
  }

  function renderResults() {
    selected = -1;
    if (!lastResults.length) {
      list.innerHTML =
        '<li class="atk-search-empty">No matches. ' +
        '<a href="' + SITE_BASE + 'techniques/">Browse all techniques \u2192</a></li>';
      return;
    }
    list.innerHTML = lastResults.map(function (doc, idx) {
      return '<li role="presentation">' +
        '<a class="atk-result" role="option" aria-selected="false" data-idx="' + idx + '" href="' + esc(resultHref(doc)) + '">' +
          '<span class="atk-badge is-planned" style="border-color:var(--accent-border);color:var(--accent)">' + esc(doc.type) + '</span>' +
          '<span class="atk-result-title">' + esc(doc.title) +
            (doc.planned ? ' <span class="atk-badge is-planned">Planned</span>' : '') + '</span>' +
          '<span class="atk-result-sub">' + esc(doc.id + (doc.subtitle ? ' \u00b7 ' + doc.subtitle : '')) + '</span>' +
        '</a></li>';
    }).join('');
    Array.prototype.forEach.call(list.querySelectorAll('.atk-result'), function (a) {
      a.addEventListener('mouseenter', function () { setSelected(parseInt(a.dataset.idx, 10), false); });
      a.addEventListener('click', function () { close(true); });
    });
  }

  function setSelected(idx, scroll) {
    var links = list.querySelectorAll('.atk-result');
    if (!links.length) return;
    if (idx < 0) idx = links.length - 1;
    if (idx >= links.length) idx = 0;
    selected = idx;
    Array.prototype.forEach.call(links, function (a, i) {
      var on = i === idx;
      a.classList.toggle('is-selected', on);
      a.setAttribute('aria-selected', String(on));
    });
    if (scroll) links[idx].scrollIntoView({ block: 'nearest' });
  }

  function renderRecent() {
    lastResults = recentTechniques();
    if (!lastResults.length) {
      list.innerHTML = '<li class="atk-search-empty">Start typing to search \u2014 techniques, actors, mitigations, campaigns, Sigma rules.</li>';
      return;
    }
    renderResults();
  }

  function runSearch(q) {
    if (!loaded) { renderSkeleton(); return; }
    var ql = String(q || '').trim();
    if (!ql) { renderRecent(); return; }
    lastResults = search(ql);
    renderResults();
  }

  function onKeydown(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(selected + 1, true); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelected(selected - 1, true); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (selected >= 0) {
        var link = list.querySelectorAll('.atk-result')[selected];
        if (link) window.location.href = link.getAttribute('href');
      } else if (lastResults.length === 1) {
        window.location.href = resultHref(lastResults[0]);
      }
    }
  }

  function trapFocus(e) {
    var focusables = [input].concat(Array.prototype.slice.call(modal.querySelectorAll('button, a[href]')));
    if (!focusables.length) return;
    var first = focusables[0];
    var last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    else if (modal !== document.activeElement && !modal.contains(document.activeElement)) {
      e.preventDefault(); first.focus();
    }
  }

  function open(query) {
    ensureModal();
    opener = document.activeElement;
    modal.hidden = false;
    document.documentElement.classList.add('atk-search-open');
    if (typeof query === 'string' && query) input.value = query;
    input.focus();
    input.select();
    if (!loaded && !loading) {
      renderSkeleton();
      loading = buildIndex().then(function () {
        loaded = true;
        runSearch(input.value);
      });
    } else {
      runSearch(input.value);
    }
  }

  function close(silent) {
    if (!modal) return;
    modal.hidden = true;
    document.documentElement.classList.remove('atk-search-open');
    if (!silent && opener && opener.focus) opener.focus();
    opener = null;
  }

  /* ------------------------------------------------------------------ *
   * 4. Wiring                                                           *
   * ------------------------------------------------------------------ */
  document.addEventListener('atk:open-search', function (e) {
    open((e.detail && e.detail.query) || '');
  });
  if (lazyOpen) window.setTimeout(function () { open(pending); }, 60);
})();