(function () {
  "use strict";
  if (window.__ATK_SIM_LOADER__) return;
  window.__ATK_SIM_LOADER__ = true;

  var BASE = window.__ATK_SIM_BASE__ || new URL("../../", document.currentScript.src).href;

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function techniqueId() {
    var header = $("#atk-header");
    if (header && header.dataset.technique) return header.dataset.technique.toUpperCase();
    var m = location.pathname.match(/T\d{4}(?:\.\d{3})?/i);
    return m ? m[0].toUpperCase() : "";
  }

  function simulationSection() {
    var sections = $$("section");
    var found = sections.filter(function (s) {
      var h = s.querySelector("h2");
      return (h && /simulation/i.test(h.textContent)) || s.id === "simulation" || s.id === "sim";
    });
    if (found.length) return found[0];
    var canvas = $("canvas");
    return canvas ? canvas.closest("section") : null;
  }

  function legacyContainer(section) {
    if (!section) return null;
    var candidates = $$(".sim-card, .sim-mount, .sim-wrap, .sim-shell, .sim, [data-sim-cfg]", section);
    var best = null;
    candidates.forEach(function (el) {
      if (!el.querySelector("canvas")) return;
      if (!best || best.contains(el)) best = el;
      else if (el.className && /sim-card|sim-mount|sim-wrap|sim-shell/.test(el.className)) best = el;
    });
    if (best) return best;
    var canvas = section.querySelector("canvas");
    return canvas ? (canvas.closest(".sim-card, .sim-mount, .sim-wrap, .sim") || canvas.parentElement) : null;
  }

  function hideLegacy(section, container) {
    if (container) {
      container.setAttribute("data-atk-legacy-hidden", "1");
      container.setAttribute("aria-hidden", "true");
    }
    var story = section.querySelector(".sim-story, .sim-story-card, #simStory, .sim-written");
    if (story) {
      var target = story.id === "simStory" ? (story.closest(".card, .sim-story, .sim-story-card") || story) : story;
      target.setAttribute("data-atk-legacy-hidden", "1");
      target.setAttribute("aria-hidden", "true");
    }
    $$("h3, h4", section).forEach(function (h) {
      if (!/scene-by-scene|step-by-step|written version|same story|walkthrough/i.test(h.textContent || "")) return;
      var next = h.nextElementSibling;
      h.setAttribute("data-atk-legacy-hidden", "1");
      if (next && /^(TABLE|OL|UL|DIV)$/.test(next.tagName)) next.setAttribute("data-atk-legacy-hidden", "1");
    });
  }

  function insertMount(section, container, id, scenarioUrl) {
    var mount = document.createElement("div");
    mount.className = "atk-sim";
    mount.setAttribute("data-scenario", scenarioUrl);
    mount.setAttribute("data-scenario-title", "Technique simulation");
    mount.setAttribute("aria-label", "Interactive simulation for " + id);
    var intro = section.querySelector(".sec-intro, .lead, p");
    var before = container || (intro ? intro.nextSibling : section.firstChild);
    if (before && before.parentNode) before.parentNode.insertBefore(mount, before);
    else section.appendChild(mount);
    return mount;
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  function loadEngine(mount) {
    if (window.ATKSim && window.ATKSim.__shared && window.ATKSim.init) {
      window.ATKSim.init();
      return;
    }
    loadScript(BASE + "assets/sim/simulation-renderers.js")
      .then(function () { return loadScript(BASE + "assets/sim/simulation-engine.js"); })
      .then(function () {
        if (window.ATKSim && window.ATKSim.init) window.ATKSim.init();
      })
      .catch(function () {
        mount.classList.add("atk-sim-error");
        mount.textContent = "The simulation engine could not be loaded.";
      });
  }

  function addCss() {
    if (document.querySelector('link[data-atk-sim-engine]')) return;
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = BASE + "assets/sim/simulation.css";
    link.dataset.atkSimEngine = "1";
    document.head.appendChild(link);
  }

  function init() {
    if (document.querySelector(".atk-sim")) return;
    var section = simulationSection();
    if (!section) return;
    var id = techniqueId();
    if (!/^T\d{4}(?:\.\d{3})?$/.test(id)) return;
    var scenarioUrl = new URL("assets/sim/scenarios/" + id + ".json", BASE).href;
    addCss();
    fetch(scenarioUrl, { credentials: "same-origin" })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function () {
        var container = legacyContainer(section);
        var mount = insertMount(section, container, id, scenarioUrl);
        hideLegacy(section, container);
        loadEngine(mount);
      })
      .catch(function (err) {
        console.warn("[simulation] could not load " + scenarioUrl + " - " + err.message);
      });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
