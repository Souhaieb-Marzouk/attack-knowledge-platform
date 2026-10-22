(function () {
  "use strict";

  var W = 1200, H = 620;
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) {
      return {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c];
    });
  }
  function pad(n) { return String(n).padStart(2, "0"); }
  function clock(sec) {
    sec = Math.max(0, Math.round(sec));
    return pad(Math.floor(sec / 60)) + ":" + pad(sec % 60);
  }
  function rgba(hex, alpha) {
    var h = String(hex || "#4f8cff").replace("#", "");
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    if (isNaN(n)) return "rgba(79,140,255," + alpha + ")";
    return "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + alpha + ")";
  }
  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function Simulation(mount, scenario) {
    this.mount = mount;
    this.scenario = scenario;
    this.steps = scenario.steps || [];
    this.nodes = scenario.nodes || [];
    this.flows = scenario.flows || [];
    // Keep the stage compact: the normalised node coordinates use a 620px
    // logical canvas, but the visible canvas only needs to reach below the
    // lowest node.
    var maxBottom = 0;
    this.nodes.forEach(function (n) { maxBottom = Math.max(maxBottom, (Number(n.y) || 0) + (Number(n.h) || 0)); });
    this.cropH = Math.max(360, Math.min(620, maxBottom * H / 100 + 78));
    this.byId = {};
    this.nodes.forEach(function (n) { this.byId[n.id] = n; }, this);
    this.step = 0;
    this.elapsed = 0;
    this.playing = false;
    this.speed = 1;
    this.raf = 0;
    this.last = 0;
    this.built = false;
    this.build();
    this.setStep(0, true);
  }

  Simulation.prototype.build = function () {
    var s = this.scenario;
    this.mount.innerHTML =
      '<div class="atk-sim-head">' +
        '<div><p class="atk-sim-kicker">Interactive technique simulation</p>' +
        '<h3 class="atk-sim-title">' + esc(s.title || "Attack simulation") + '</h3>' +
        '<p class="atk-sim-sub">' + esc(s.subtitle || "") + '</p></div>' +
        '<span class="atk-sim-state" aria-live="polite">Step 1 of ' + this.steps.length + '</span>' +
      '</div>' +
      '<div class="atk-sim-stage">' +
        '<canvas width="' + W + '" height="' + H + '" tabindex="0" role="img" aria-label="' + esc(s.aria || s.title || "Attack simulation") + '"></canvas>' +
        '<div class="atk-sim-tip" role="tooltip"></div>' +
      '</div>' +
      '<p class="atk-sim-mobile-hint">Scroll the diagram sideways to see every system.</p>' +
      '<div class="atk-sim-legend" aria-label="Scene legend">' +
        '<span><i class="atk-sim-swatch is-actor"></i>Actor</span>' +
        '<span><i class="atk-sim-swatch is-target"></i>Target</span>' +
        '<span><i class="atk-sim-swatch is-data"></i>Data / artifact</span>' +
        '<span><i class="atk-sim-swatch is-defender"></i>Defender</span>' +
        '<span class="atk-sim-legend-note">Hover a component for its role.</span>' +
      '</div>' +
      '<div class="atk-sim-progress"><i></i></div>' +
      '<div class="atk-sim-controls">' +
        '<button type="button" class="atk-sim-btn is-primary" data-act="play" aria-pressed="false">Play</button>' +
        '<button type="button" class="atk-sim-btn" data-act="restart">Restart</button>' +
        '<button type="button" class="atk-sim-btn" data-act="prev" aria-label="Previous step">Prev</button>' +
        '<button type="button" class="atk-sim-btn" data-act="next" aria-label="Next step">Next</button>' +
        '<label class="atk-sim-sr" for="sim-speed">Speed</label>' +
        '<select class="atk-sim-speed" id="sim-speed" aria-label="Playback speed">' +
          '<option value="0.5">0.5x</option><option value="1" selected>1x</option><option value="1.5">1.5x</option><option value="2">2x</option>' +
        '</select>' +
        '<span class="atk-sim-time">00:00 / 00:00</span>' +
      '</div>' +
      '<div class="atk-sim-steps" role="tablist" aria-label="Simulation steps"></div>' +
      '<div class="atk-sim-caption" aria-live="polite">' +
        '<div><h4></h4><p class="atk-sim-caption-text"></p></div>' +
        '<div class="atk-sim-detect"><b></b><span></span></div>' +
      '</div>' +
      '<div class="atk-sim-logs" aria-live="polite"><h4>Telemetry emitted in this step</h4><div class="atk-sim-log-list"></div></div>';

    this.canvas = this.mount.querySelector("canvas");
    this.ctx = this.canvas.getContext("2d");
    this.tip = this.mount.querySelector(".atk-sim-tip");
    this.stateEl = this.mount.querySelector(".atk-sim-state");
    this.progress = this.mount.querySelector(".atk-sim-progress i");
    this.timeEl = this.mount.querySelector(".atk-sim-time");
    this.stepsEl = this.mount.querySelector(".atk-sim-steps");
    this.capTitle = this.mount.querySelector(".atk-sim-caption h4");
    this.capText = this.mount.querySelector(".atk-sim-caption-text");
    this.detect = this.mount.querySelector(".atk-sim-detect");
    this.logList = this.mount.querySelector(".atk-sim-log-list");
    this.playBtn = this.mount.querySelector('[data-act="play"]');
    this.prevBtn = this.mount.querySelector('[data-act="prev"]');
    this.nextBtn = this.mount.querySelector('[data-act="next"]');
    this.speedEl = this.mount.querySelector(".atk-sim-speed");

    this.colors = this.readColors();
    this.buildChips();
    this.wire();
    this.fit();
    this.built = true;
  };

  Simulation.prototype.readColors = function () {
    var c = getComputedStyle(this.mount);
    return {
      text: (c.getPropertyValue("--sim-text") || "#e7edf8").trim(),
      muted: (c.getPropertyValue("--sim-muted") || "#9aa8c0").trim(),
      border: (c.getPropertyValue("--sim-border") || "#24314e").trim(),
      border2: (c.getPropertyValue("--sim-border-2") || "#2f4066").trim(),
      accent: (c.getPropertyValue("--sim-accent") || "#4f8cff").trim(),
      accent2: (c.getPropertyValue("--sim-accent-2") || "#22d3ee").trim(),
      good: (c.getPropertyValue("--sim-good") || "#34d399").trim(),
      warn: (c.getPropertyValue("--sim-warn") || "#fbbf24").trim(),
      bad: (c.getPropertyValue("--sim-bad") || "#f87171").trim(),
      violet: (c.getPropertyValue("--sim-violet") || "#a78bfa").trim(),
      panel: (c.getPropertyValue("--sim-panel") || "#121a2e").trim(),
      bg: (c.getPropertyValue("--sim-bg") || "#0a0e17").trim()
    };
  };

  Simulation.prototype.buildChips = function () {
    var self = this;
    this.stepsEl.innerHTML = "";
    this.steps.forEach(function (step, i) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "atk-sim-step";
      b.setAttribute("role", "tab");
      b.setAttribute("aria-selected", i === 0 ? "true" : "false");
      b.textContent = String(i + 1);
      b.setAttribute("aria-label", "Step " + (i + 1) + ": " + (step.title || ""));
      b.addEventListener("click", function () { self.setStep(i); });
      self.stepsEl.appendChild(b);
    });
  };

  Simulation.prototype.wire = function () {
    var self = this;
    this.playBtn.addEventListener("click", function () { self.toggle(); });
    this.mount.querySelector('[data-act="restart"]').addEventListener("click", function () { self.restart(); });
    this.prevBtn.addEventListener("click", function () { self.setStep(self.step - 1); });
    this.nextBtn.addEventListener("click", function () { self.setStep(self.step + 1); });
    this.speedEl.addEventListener("change", function () { self.speed = parseFloat(self.speedEl.value) || 1; });
    this.canvas.addEventListener("keydown", function (e) {
      if (e.key === " " || e.key === "Spacebar") { self.toggle(); e.preventDefault(); }
      else if (e.key === "ArrowRight") { self.setStep(self.step + 1); e.preventDefault(); }
      else if (e.key === "ArrowLeft") { self.setStep(self.step - 1); e.preventDefault(); }
      else if (e.key === "Home") { self.setStep(0); e.preventDefault(); }
      else if (e.key === "End") { self.setStep(self.steps.length - 1); e.preventDefault(); }
    });
    this.canvas.addEventListener("pointermove", function (e) { self.showTip(e); });
    this.canvas.addEventListener("pointerleave", function () { self.tip.style.display = "none"; });
    document.addEventListener("visibilitychange", function () {
      if (document.hidden && self.playing) { self.playing = false; self.syncPlay(); self.draw(); }
    });
    if (window.ResizeObserver) {
      new ResizeObserver(function () { self.fit(); }).observe(this.canvas.parentElement);
    } else {
      window.addEventListener("resize", function () { self.fit(); });
    }
    window.addEventListener("atk-theme-change", function () {
      self.colors = self.readColors();
      if (!self.playing) self.draw();
    });
  };

  Simulation.prototype.fit = function () {
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = W * dpr;
    this.canvas.height = this.cropH * dpr;
    this.canvas.style.aspectRatio = W + " / " + this.cropH;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (this.built) this.draw();
  };

  Simulation.prototype.currentDuration = function () {
    return Math.max(2, Number(this.steps[this.step].duration) || 6);
  };

  Simulation.prototype.totalDuration = function () {
    return this.steps.reduce(function (n, s) { return n + (Math.max(2, Number(s.duration) || 6)); }, 0);
  };

  Simulation.prototype.elapsedBefore = function () {
    var n = 0;
    for (var i = 0; i < this.step; i++) n += Math.max(2, Number(this.steps[i].duration) || 6);
    return n;
  };

  Simulation.prototype.setStep = function (index, silent) {
    index = Math.max(0, Math.min(this.steps.length - 1, index));
    this.step = index;
    this.elapsed = 0;
    var step = this.steps[index];
    this.stateEl.textContent = "Step " + (index + 1) + " of " + this.steps.length;
    this.capTitle.textContent = step.title || ("Step " + (index + 1));
    this.capText.textContent = step.caption || "";
    var d = step.detection || {state: "none", label: "No detection", detail: ""};
    this.detect.className = "atk-sim-detect is-" + (d.state || "none");
    this.detect.querySelector("b").textContent = d.label || "Detection status";
    this.detect.querySelector("span").textContent = d.detail || "";
    this.renderLogs(step.logs || []);
    this.updateChips();
    this.prevBtn.disabled = index === 0;
    this.nextBtn.disabled = index === this.steps.length - 1;
    if (!silent) this.syncPlay();
    this.updateTime();
    if (this.built) this.draw();
    if (this.playing && !this.raf) this.loop(performance.now());
  };

  Simulation.prototype.updateChips = function () {
    var self = this;
    Array.prototype.forEach.call(this.stepsEl.children, function (b, i) {
      b.setAttribute("aria-selected", i === self.step ? "true" : "false");
    });
  };

  Simulation.prototype.renderLogs = function (logs) {
    if (!logs.length) {
      this.logList.innerHTML = '<p class="atk-sim-empty">No event is recorded for this step.</p>';
      return;
    }
    this.logList.innerHTML = logs.map(function (log) {
      var fields = "";
      if (log.fields) {
        fields = Object.keys(log.fields).map(function (k) {
          return "<span><b>" + esc(k) + ":</b> " + esc(log.fields[k]) + "</span>";
        }).join("");
      }
      return '<div class="atk-sim-log"><span class="src">' + esc(log.source || "log") + '</span> ' +
        '<span class="evt">' + esc(log.event || "event") + '</span>' +
        (fields ? '<span class="fields">' + fields + '</span>' : '') + '</div>';
    }).join("");
  };

  Simulation.prototype.updateTime = function () {
    var total = this.totalDuration();
    var current = this.elapsedBefore() + Math.min(this.elapsed, this.currentDuration());
    this.timeEl.textContent = clock(current) + " / " + clock(total);
    var pct = total ? current / total * 100 : 0;
    this.progress.style.width = Math.min(100, Math.max(0, pct)) + "%";
  };

  Simulation.prototype.toggle = function () {
    if (this.playing) {
      this.playing = false;
      this.syncPlay();
      this.draw();
      return;
    }
    if (this.step === this.steps.length - 1 && this.elapsed >= this.currentDuration() - 0.05) {
      this.step = 0;
      this.elapsed = 0;
      this.setStep(0, true);
    }
    this.playing = true;
    this.last = performance.now();
    this.syncPlay();
    this.loop(this.last);
  };

  Simulation.prototype.restart = function () {
    this.playing = false;
    this.syncPlay();
    this.setStep(0, true);
    this.elapsed = 0;
    this.draw();
  };

  Simulation.prototype.syncPlay = function () {
    this.playBtn.textContent = this.playing ? "Pause" : "Play";
    this.playBtn.setAttribute("aria-pressed", this.playing ? "true" : "false");
  };

  Simulation.prototype.loop = function (ts) {
    var self = this;
    if (!this.playing) { this.raf = 0; return; }
    var dt = Math.min(0.06, (ts - this.last) / 1000 || 0);
    this.last = ts;
    this.elapsed += dt * this.speed;
    var dur = this.currentDuration();
    if (this.elapsed >= dur) {
      if (this.step < this.steps.length - 1) {
        this.setStep(this.step + 1, true);
      } else {
        this.elapsed = dur;
        this.playing = false;
        this.syncPlay();
        this.draw();
        this.raf = 0;
        return;
      }
    }
    this.updateTime();
    this.draw();
    this.raf = requestAnimationFrame(function (t) { self.loop(t); });
  };

  Simulation.prototype.curve = function (a, b, bend) {
    bend = Number(bend) || 0;
    return {
      a: a,
      c1: {x: a.x + (b.x - a.x) * 0.42, y: a.y + bend},
      c2: {x: a.x + (b.x - a.x) * 0.58, y: b.y + bend},
      b: b
    };
  };

  Simulation.prototype.point = function (curve, t) {
    var mt = 1 - t;
    return {
      x: mt * mt * mt * curve.a.x + 3 * mt * mt * t * curve.c1.x + 3 * mt * t * t * curve.c2.x + t * t * t * curve.b.x,
      y: mt * mt * mt * curve.a.y + 3 * mt * mt * t * curve.c1.y + 3 * mt * t * t * curve.c2.y + t * t * t * curve.b.y
    };
  };

  Simulation.prototype.center = function (n) {
    return {x: (n.x + n.w / 2) * W / 100, y: (n.y + n.h / 2) * H / 100};
  };

  Simulation.prototype.drawNetwork = function () {
    if (!this.ctx) return;
    var ctx = this.ctx;
    var c = this.colors;
    var step = this.steps[this.step];
    var active = {};
    (step.activeFlows || []).forEach(function (id) { active[id] = true; });
    var nodeState = step.nodes || {};

    ctx.clearRect(0, 0, W, this.cropH);
    var bg = ctx.createLinearGradient(0, 0, 0, this.cropH);
    bg.addColorStop(0, rgba(c.panel, 0.92));
    bg.addColorStop(1, c.bg);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, this.cropH);
    var glow = ctx.createRadialGradient(W * .2, 0, 0, W * .2, 0, W * .6);
    glow.addColorStop(0, rgba(c.accent, 0.10));
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, this.cropH);
    ctx.strokeStyle = rgba(c.border, 0.18);
    ctx.lineWidth = 1;
    for (var gx = 0; gx <= W; gx += 40) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, this.cropH); ctx.stroke(); }
    for (var gy = 0; gy <= this.cropH; gy += 40) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke(); }

    // Optional labelled bands (vendor side / customer side).
    (this.scenario.zones || []).forEach(function (z) {
      var x = z.x * W / 100, y = z.y * H / 100, w = z.w * W / 100, h = z.h * H / 100;
      ctx.fillStyle = rgba(z.color || c.border, 0.08);
      roundRect(ctx, x, y, w, h, 16);
      ctx.fill();
      ctx.strokeStyle = rgba(z.color || c.border, 0.25);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = rgba(z.color || c.muted, 0.9);
      ctx.font = "700 11px " + (getComputedStyle(this.mount).getPropertyValue("--font-mono") || "monospace");
      ctx.fillText(String(z.label || "").toUpperCase(), x + 14, y + 20);
    }, this);

    // Static edges.
    var self = this;
    this.flows.forEach(function (f) {
      var a = self.byId[f.from], b = self.byId[f.to];
      if (!a || !b) return;
      var curve = self.curve(self.center(a), self.center(b), f.bend);
      ctx.beginPath();
      ctx.moveTo(curve.a.x, curve.a.y);
      ctx.bezierCurveTo(curve.c1.x, curve.c1.y, curve.c2.x, curve.c2.y, curve.b.x, curve.b.y);
      ctx.strokeStyle = active[f.id] ? rgba(c.accent, 0.9) : rgba(c.border2, 0.55);
      ctx.lineWidth = active[f.id] ? 2.4 : 1.2;
      ctx.setLineDash(active[f.id] ? [] : [5, 7]);
      ctx.stroke();
      ctx.setLineDash([]);
      self.arrow(curve, active[f.id] ? c.accent : c.border2);
    });

    // Nodes.
    this.nodes.forEach(function (n) {
      var state = nodeState[n.id] || "idle";
      var col = state === "comp" ? c.bad : state === "alert" ? c.bad : state === "watch" ? c.warn :
        state === "done" ? c.good : state === "active" ? c.accent : c.border2;
      var x = n.x * W / 100, y = n.y * H / 100, w = n.w * W / 100, h = n.h * H / 100;
      ctx.save();
      ctx.shadowColor = rgba(col, state === "idle" ? 0.10 : 0.30);
      ctx.shadowBlur = state === "idle" ? 7 : 16;
      ctx.fillStyle = state === "idle" ? rgba(c.panel, 0.95) : rgba(col, 0.12);
      roundRect(ctx, x, y, w, h, 11);
      ctx.fill();
      ctx.restore();
      ctx.strokeStyle = state === "idle" ? c.border2 : col;
      ctx.lineWidth = state === "idle" ? 1 : 2;
      ctx.stroke();

      var iconR = 13;
      var ix = x + 23, iy = y + h / 2;
      ctx.beginPath();
      ctx.arc(ix, iy, iconR, 0, Math.PI * 2);
      ctx.fillStyle = rgba(self.kindColor(n.kind), 0.18);
      ctx.fill();
      ctx.strokeStyle = rgba(self.kindColor(n.kind), 0.85);
      ctx.lineWidth = 1.4;
      ctx.stroke();
      if (window.ATKSimRenderers && window.ATKSimRenderers.glyph) {
        window.ATKSimRenderers.glyph(self, n.kind, ix, iy, 16, self.kindColor(n.kind));
      } else {
        ctx.fillStyle = self.kindColor(n.kind);
        ctx.font = "700 11px " + (getComputedStyle(self.mount).getPropertyValue("--font-mono") || "monospace");
        ctx.textAlign = "center";
        ctx.fillText(self.kindLetter(n.kind), ix, iy + 3);
      }

      ctx.textAlign = "left";
      ctx.fillStyle = c.text;
      ctx.font = "700 15px system-ui, -apple-system, Segoe UI, sans-serif";
      ctx.fillText(n.label || n.id, x + 44, y + 22);
      ctx.fillStyle = c.muted;
      ctx.font = "11px " + (getComputedStyle(self.mount).getPropertyValue("--font-mono") || "monospace");
      ctx.fillText(n.sub || "", x + 44, y + 37);
      if (state !== "idle") {
        ctx.beginPath();
        ctx.arc(x + w - 13, y + 13, 4, 0, Math.PI * 2);
        ctx.fillStyle = col;
        ctx.fill();
      }
    });

    // Packets.
    var t = reduceMotion ? 0.55 : Math.min(1, Math.max(0, this.elapsed / this.currentDuration()));
    (step.packets || []).forEach(function (p) {
      var a = self.byId[p.from], b = self.byId[p.to];
      if (!a || !b) return;
      var curve = self.curve(self.center(a), self.center(b), p.bend);
      var start = Number(p.at) || 0;
      var dur = Math.max(0.3, Number(p.duration) || 1.6);
      var local = reduceMotion ? 0.55 : Math.min(1, Math.max(0, (t * self.currentDuration() - start) / dur));
      if (!reduceMotion && local <= 0 && t * self.currentDuration() < start) return;
      var pt = self.point(curve, local);
      var prev = self.point(curve, Math.max(0, local - 0.08));
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(pt.x, pt.y);
      ctx.strokeStyle = rgba(p.color ? self.colorByName(p.color) : c.accent2, 0.38);
      ctx.lineWidth = 7;
      ctx.lineCap = "round";
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = p.color ? self.colorByName(p.color) : c.accent2;
      ctx.fill();
      ctx.strokeStyle = rgba(c.bg, 0.9);
      ctx.lineWidth = 2;
      ctx.stroke();
      if (p.label) {
        ctx.font = "700 11px " + (getComputedStyle(self.mount).getPropertyValue("--font-mono") || "monospace");
        var tw = ctx.measureText(p.label).width + 12;
        var toRight = b.x >= a.x;
        var lx = toRight ? pt.x - tw - 10 : pt.x + 10;
        if (lx < 6) lx = Math.min(W - tw - 6, pt.x + 10);
        ctx.fillStyle = rgba(c.panel, 0.96);
        roundRect(ctx, lx, pt.y - 19, tw, 16, 5);
        ctx.fill();
        ctx.strokeStyle = rgba(c.border, 0.8);
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = c.text;
        ctx.fillText(p.label, lx + 6, pt.y - 7);
      }
    });

  };

  Simulation.prototype.draw = function () {
    if (!this.ctx) return;
    var type = this.scenario.renderer || "network";
    var renderer = window.ATKSimRenderers && window.ATKSimRenderers[type];
    if (renderer) renderer(this);
    else this.drawNetwork();
    this.drawHud();
  };

  Simulation.prototype.drawHud = function () {
    var ctx = this.ctx, c = this.colors, step = this.steps[this.step];

    ctx.fillStyle = c.muted;
    ctx.font = "700 11px " + (getComputedStyle(this.mount).getPropertyValue("--font-mono") || "monospace");
    ctx.fillText("STEP " + (this.step + 1) + "/" + this.steps.length, 16, 24);
    var d = step.detection || {};
    var dcol = d.state === "alert" ? c.bad : d.state === "clear" ? c.good : d.state === "partial" ? c.warn : c.muted;
    var label = (d.label || "No detection").toUpperCase();
    ctx.font = "700 11px " + (getComputedStyle(this.mount).getPropertyValue("--font-mono") || "monospace");
    var lw = ctx.measureText(label).width + 18;
    ctx.fillStyle = rgba(c.panel, 0.92);
    roundRect(ctx, W - lw - 16, 12, lw, 22, 11);
    ctx.fill();
    ctx.strokeStyle = rgba(dcol, 0.8);
    ctx.stroke();
    ctx.fillStyle = dcol;
    ctx.fillText(label, W - lw - 7, 27);
  };

  Simulation.prototype.arrow = function (curve, color) {
    var ctx = this.ctx;
    var b = curve.b, c2 = curve.c2;
    var angle = Math.atan2(b.y - c2.y, b.x - c2.x);
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-8, -4);
    ctx.lineTo(-8, 4);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  };

  Simulation.prototype.kindColor = function (kind) {
    var c = this.colors;
    return {attacker: c.bad, vendor: c.violet, repo: c.accent, ci: c.accent2, artifact: c.warn,
      customer: c.good, soc: c.accent2, cloud: c.violet, factory: c.warn, transit: c.warn,
      device: c.accent, c2: c.bad, researcher: c.good}[kind] || c.accent;
  };
  Simulation.prototype.colorByName = function (name) {
    var c = this.colors;
    return {accent: c.accent, accent2: c.accent2, danger: c.bad, bad: c.bad,
      success: c.good, good: c.good, warn: c.warn, violet: c.violet}[name] || c.accent2;
  };
  Simulation.prototype.kindLetter = function (kind) {
    return {attacker: "A", vendor: "V", repo: "R", ci: "C", artifact: "P", customer: "U",
      soc: "S", cloud: "☁", factory: "F", transit: "T", device: "D", c2: "C2", researcher: "?"}[kind] || "•";
  };

  Simulation.prototype.showTip = function (e) {
    var rect = this.canvas.getBoundingClientRect();
    var x = (e.clientX - rect.left) / rect.width * 100;
    var y = (e.clientY - rect.top) / rect.height * 100;
    var hit = this.nodes.find(function (n) {
      return x >= n.x && x <= n.x + n.w && y >= n.y && y <= n.y + n.h;
    });
    if (!hit) { this.tip.style.display = "none"; return; }
    this.tip.textContent = hit.tip || (hit.label + " — " + (hit.sub || ""));
    var stage = this.canvas.parentElement.getBoundingClientRect();
    this.tip.style.display = "block";
    this.tip.style.left = Math.min(stage.width - 260, e.clientX - stage.left + 14) + "px";
    this.tip.style.top = Math.max(8, e.clientY - stage.top + 12) + "px";
  };

  function boot() {
    var mounts = document.querySelectorAll(".atk-sim[data-scenario]");
    Array.prototype.forEach.call(mounts, function (mount) {
      var url = mount.getAttribute("data-scenario");
      mount.setAttribute("aria-busy", "true");
      fetch(url, {credentials: "same-origin"})
        .then(function (r) {
          if (!r.ok) throw new Error("HTTP " + r.status);
          return r.json();
        })
        .then(function (scenario) {
          mount.removeAttribute("aria-busy");
          mount.dataset.renderer = scenario.renderer || "network";
          if (scenario.theme) mount.classList.add("atk-sim-theme-" + scenario.theme);
          new Simulation(mount, scenario);
        })
        .catch(function () {
          mount.removeAttribute("aria-busy");
          mount.innerHTML = '<div class="atk-sim-error">Simulation data could not be loaded. ' +
            'Open this page through the site server and check <code>' + esc(url) + '</code>.</div>';
        });
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
