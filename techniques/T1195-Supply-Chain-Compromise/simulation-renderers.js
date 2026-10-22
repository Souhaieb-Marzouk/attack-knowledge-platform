(function () {
  "use strict";

  var W = 1200, H = 620;
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function rgba(hex, alpha) {
    var h = String(hex || "#4f8cff").replace("#", "");
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    if (isNaN(n)) return "rgba(79,140,255," + alpha + ")";
    return "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + alpha + ")";
  }
  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function mono(sim, size, weight) {
    return (weight || 600) + " " + size + "px " + (getComputedStyle(sim.mount).getPropertyValue("--font-mono") || "monospace");
  }
  function sans(sim, size, weight) {
    return (weight || 700) + " " + size + "px system-ui, -apple-system, Segoe UI, sans-serif";
  }
  function clear(sim) {
    var ctx = sim.ctx, c = sim.colors;
    ctx.clearRect(0, 0, W, sim.cropH);
    var g = ctx.createLinearGradient(0, 0, 0, sim.cropH);
    g.addColorStop(0, rgba(c.panel, 0.92));
    g.addColorStop(0.55, c.bg);
    g.addColorStop(1, rgba(c.bg, 0.96));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, sim.cropH);
    var glow = ctx.createRadialGradient(W * .18, 0, 0, W * .18, 0, W * .55);
    glow.addColorStop(0, rgba(c.accent, 0.10));
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, sim.cropH);
    ctx.strokeStyle = rgba(c.border, 0.20);
    ctx.lineWidth = 1;
    for (var x = 0; x <= W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, sim.cropH); ctx.stroke(); }
    for (var y = 0; y <= sim.cropH; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  }
  function stateColor(sim, state) {
    var c = sim.colors;
    return state === "comp" || state === "alert" ? c.bad :
      state === "watch" ? c.warn : state === "done" ? c.good :
      state === "active" ? c.accent : c.border2;
  }
  function activeSet(sim) {
    var out = {};
    (sim.steps[sim.step].activeFlows || []).forEach(function (id) { out[id] = true; });
    return out;
  }
  function packetProgress(sim, p) {
    var start = Number(p.at) || 0;
    var dur = Math.max(0.3, Number(p.duration) || 1.6);
    var t = reduceMotion ? 0.82 : Math.min(1, Math.max(0, sim.elapsed / sim.currentDuration()));
    return reduceMotion ? 0.55 : Math.min(1, Math.max(0, (t * sim.currentDuration() - start) / dur));
  }
  function packet(sim, p) {
    var a = sim.byId[p.from], b = sim.byId[p.to];
    if (!a || !b) return;
    var curve = sim.curve(sim.center(a), sim.center(b), p.bend);
    var local = packetProgress(sim, p);
    if (!reduceMotion && local <= 0 && (sim.elapsed / sim.currentDuration()) * sim.currentDuration() < (Number(p.at) || 0)) return;
    var pt = sim.point(curve, local);
    var prev = sim.point(curve, Math.max(0, local - 0.08));
    var ctx = sim.ctx, c = sim.colors;
    ctx.beginPath();
    ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(pt.x, pt.y);
    ctx.strokeStyle = rgba(p.color ? sim.colorByName(p.color) : c.accent2, 0.38);
    ctx.lineWidth = 7;
    ctx.lineCap = "round";
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = p.color ? sim.colorByName(p.color) : c.accent2;
    ctx.fill();
    ctx.strokeStyle = rgba(c.bg, 0.9);
    ctx.lineWidth = 2;
    ctx.stroke();
    if (p.label) {
      ctx.font = mono(sim, 10, 700);
      var tw = ctx.measureText(p.label).width + 12;
      var toRight = b.x >= a.x;
      var lx = toRight ? pt.x - tw - 10 : pt.x + 10;
      if (lx < 6) lx = Math.min(W - tw - 6, pt.x + 10);
      ctx.fillStyle = rgba(c.panel, 0.96);
      rr(ctx, lx, pt.y - 19, tw, 16, 5);
      ctx.fill();
      ctx.strokeStyle = rgba(c.border, 0.8);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = c.text;
      ctx.fillText(p.label, lx + 6, pt.y - 7);
    }
  }
  function packets(sim) {
    (sim.steps[sim.step].packets || []).forEach(function (p) { packet(sim, p); });
  }
  function stage(sim, n, label, sub, index, hot, kind) {
    var ctx = sim.ctx, c = sim.colors;
    var x = n.x * W / 100, y = n.y * H / 100, w = n.w * W / 100, h = n.h * H / 100;
    var col = stateColor(sim, hot);
    ctx.save();
    ctx.shadowColor = rgba(col, hot === "idle" ? 0.10 : 0.28);
    ctx.shadowBlur = hot === "idle" ? 6 : 15;
    ctx.fillStyle = rgba(c.panel, 0.94);
    rr(ctx, x, y, w, h, 10);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = hot === "idle" ? c.border2 : col;
    ctx.lineWidth = hot === "idle" ? 1 : 2;
    ctx.stroke();
    ctx.fillStyle = rgba(col, 0.16);
    ctx.fillRect(x, y, 4, h);
    ctx.fillStyle = c.muted;
    ctx.font = mono(sim, 9, 700);
    ctx.fillText(String(index).padStart(2, "0"), x + 14, y + 17);
    ctx.beginPath();
    ctx.arc(x + 24, y + h / 2 + 4, 13, 0, Math.PI * 2);
    ctx.fillStyle = rgba(sim.kindColor(kind), 0.14);
    ctx.fill();
    ctx.strokeStyle = rgba(sim.kindColor(kind), 0.5);
    ctx.lineWidth = 1;
    ctx.stroke();
    glyph(sim, kind, x + 24, y + h / 2 + 4, 15, sim.kindColor(kind));
    ctx.fillStyle = c.text;
    ctx.font = sans(sim, 14, 700);
    ctx.fillText(label, x + 44, y + 22);
    ctx.fillStyle = c.muted;
    ctx.font = mono(sim, 10, 500);
    ctx.fillText(sub || "", x + 44, y + 37);
    if (hot !== "idle") {
      ctx.beginPath();
      ctx.arc(x + w - 12, y + 12, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = col;
      ctx.fill();
    }
  }
  function line(sim, a, b, color, active, dash) {
    var ctx = sim.ctx;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = active ? 2.4 : 1.2;
    ctx.setLineDash(active ? [] : [5, 7]);
    ctx.stroke();
    ctx.setLineDash([]);
    sim.arrow({a: a, c1: a, c2: b, b: b}, color);
  }


  // Small pictograms make the scene readable without relying on abbreviations.
  function glyph(sim, kind, cx, cy, size, color) {
    var ctx = sim.ctx;
    var k = size / 24;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(k, k);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (kind === "attacker") {
      ctx.beginPath(); ctx.arc(0, -6, 3.5, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 7, 7, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
    } else if (kind === "vendor" || kind === "factory") {
      ctx.strokeRect(-8, -5, 16, 12);
      ctx.beginPath(); ctx.moveTo(-10, -5); ctx.lineTo(0, -11); ctx.lineTo(10, -5); ctx.stroke();
      ctx.fillRect(-4, 0, 2, 2); ctx.fillRect(2, 0, 2, 2);
    } else if (kind === "repo" || kind === "artifact") {
      ctx.strokeRect(-7, -8, 14, 16);
      ctx.beginPath(); ctx.moveTo(-7, -3); ctx.lineTo(7, -3); ctx.moveTo(0, -8); ctx.lineTo(0, 8); ctx.stroke();
    } else if (kind === "ci") {
      ctx.strokeRect(-9, -8, 18, 16);
      ctx.beginPath(); ctx.moveTo(-5, -2); ctx.lineTo(-1, 1); ctx.lineTo(-5, 4); ctx.moveTo(1, 4); ctx.lineTo(6, 4); ctx.stroke();
    } else if (kind === "customer") {
      ctx.strokeRect(-8, -7, 16, 11);
      ctx.beginPath(); ctx.moveTo(-5, 7); ctx.lineTo(5, 7); ctx.moveTo(0, 4); ctx.lineTo(0, 7); ctx.stroke();
    } else if (kind === "soc") {
      ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(8, -6); ctx.lineTo(8, 1); ctx.lineTo(0, 9); ctx.lineTo(-8, 1); ctx.lineTo(-8, -6); ctx.closePath(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-3, 0); ctx.lineTo(-1, 3); ctx.lineTo(4, -3); ctx.stroke();
    } else if (kind === "cloud") {
      ctx.beginPath(); ctx.arc(-5, 2, 5, Math.PI * .5, Math.PI * 1.5); ctx.arc(0, -3, 6, Math.PI, Math.PI * 2); ctx.arc(6, 2, 5, Math.PI * 1.5, Math.PI * .5); ctx.closePath(); ctx.stroke();
    } else if (kind === "transit") {
      ctx.strokeRect(-9, -4, 12, 9);
      ctx.beginPath(); ctx.moveTo(3, -4); ctx.lineTo(7, -1); ctx.lineTo(7, 5); ctx.lineTo(3, 5); ctx.stroke();
      ctx.beginPath(); ctx.arc(-5, 6, 2, 0, Math.PI * 2); ctx.arc(4, 6, 2, 0, Math.PI * 2); ctx.stroke();
    } else if (kind === "device") {
      ctx.strokeRect(-9, -3, 18, 7);
      ctx.beginPath(); ctx.moveTo(-5, -3); ctx.lineTo(-8, -9); ctx.moveTo(5, -3); ctx.lineTo(8, -9); ctx.stroke();
      ctx.beginPath(); ctx.arc(-5, 5, 1, 0, Math.PI * 2); ctx.arc(5, 5, 1, 0, Math.PI * 2); ctx.fill();
    } else if (kind === "c2") {
      ctx.beginPath(); ctx.moveTo(0, 9); ctx.lineTo(0, -7); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, -7, 2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(0, -7, 6, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, -7, 10, Math.PI * 1.2, Math.PI * 1.8); ctx.stroke();
    } else if (kind === "researcher") {
      ctx.beginPath(); ctx.arc(-2, -2, 6, 0, Math.PI * 1.8); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(3, 3); ctx.lineTo(9, 9); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }

  // 1. Dependency pipeline: a vertical release rail with stage cards.
  function pipeline(sim) {
    clear(sim);
    var ctx = sim.ctx, c = sim.colors;
    var active = activeSet(sim);
    var state = sim.steps[sim.step].nodes || {};
    var railX = 27.5 * W / 100;

    ctx.fillStyle = rgba(c.violet, 0.05);
    ctx.fillRect(2 * W / 100, 4 * H / 100, 43 * W / 100, 82 * H / 100);
    ctx.fillStyle = rgba(c.accent, 0.04);
    ctx.fillRect(54 * W / 100, 4 * H / 100, 43 * W / 100, 82 * H / 100);
    ctx.fillStyle = c.muted;
    ctx.font = mono(sim, 10, 700);
    ctx.fillText("UPSTREAM PROJECT", 16, 48);
    ctx.fillText("CONSUMER BUILD", 57 * W / 100, 48);

    ctx.beginPath();
    ctx.moveTo(railX, 10 * H / 100);
    ctx.lineTo(railX, 84 * H / 100);
    ctx.strokeStyle = rgba(c.violet, 0.45);
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 8]);
    ctx.stroke();
    ctx.setLineDash([]);

    sim.nodes.forEach(function (n, i) {
      var hot = state[n.id] || "idle";
      stage(sim, n, n.label, n.sub, i + 1, hot, n.kind);
      var cy = (n.y + n.h / 2) * H / 100;
      ctx.beginPath();
      ctx.arc(railX, cy, 6, 0, Math.PI * 2);
      ctx.fillStyle = hot === "idle" ? c.bg : stateColor(sim, hot);
      ctx.fill();
      ctx.strokeStyle = rgba(c.bg, 0.9);
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    sim.flows.forEach(function (f) {
      var a = sim.byId[f.from], b = sim.byId[f.to];
      if (!a || !b) return;
      var ac = active[f.id];
      line(sim, sim.center(a), sim.center(b), ac ? c.accent : rgba(c.border2, 0.55), ac);
    });
    packets(sim);

    ctx.fillStyle = c.muted;
    ctx.font = mono(sim, 10, 600);
    ctx.fillText("RELEASE RAIL · source → package → CI → artifact", 16, sim.cropH - 18);
  }

  // 2. Endpoint process tree: orthogonal parent/child connectors.
  function processTree(sim) {
    clear(sim);
    var ctx = sim.ctx, c = sim.colors;
    var active = activeSet(sim);
    var state = sim.steps[sim.step].nodes || {};

    ctx.fillStyle = rgba(c.bad, 0.04);
    ctx.fillRect(2 * W / 100, 4 * H / 100, 95 * W / 100, 58 * H / 100);
    ctx.fillStyle = c.muted;
    ctx.font = mono(sim, 10, 700);
    ctx.fillText("ENDPOINT / EDR PROCESS TREE", 16, 48);

    sim.flows.forEach(function (f) {
      var a = sim.byId[f.from], b = sim.byId[f.to];
      if (!a || !b) return;
      var ac = active[f.id];
      var col = ac ? c.accent2 : rgba(c.border2, 0.6);
      var ax = (a.x + a.w) * W / 100, ay = (a.y + a.h / 2) * H / 100;
      var bx = b.x * W / 100, by = (b.y + b.h / 2) * H / 100;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(ax + 22, ay);
      ctx.lineTo(ax + 22, by);
      ctx.lineTo(bx, by);
      ctx.strokeStyle = col;
      ctx.lineWidth = ac ? 2 : 1.2;
      ctx.setLineDash(ac ? [] : [4, 6]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx - 7, by - 4);
      ctx.lineTo(bx - 7, by + 4);
      ctx.closePath();
      ctx.fillStyle = col;
      ctx.fill();
    });

    sim.nodes.forEach(function (n) {
      var hot = state[n.id] || "idle";
      var col = stateColor(sim, hot);
      var x = n.x * W / 100, y = n.y * H / 100, w = n.w * W / 100, h = n.h * H / 100;
      ctx.fillStyle = rgba(c.panel, 0.96);
      rr(ctx, x, y, w, h, 7);
      ctx.fill();
      ctx.strokeStyle = hot === "idle" ? c.border2 : col;
      ctx.lineWidth = hot === "idle" ? 1 : 2;
      ctx.stroke();
      ctx.fillStyle = rgba(col, 0.14);
      ctx.fillRect(x, y, 3, h);
      ctx.fillStyle = col;
      ctx.font = mono(sim, 8, 800);
      ctx.fillText(n.kind === "c2" ? "C2" : "PROC", x + 12, y + 14);
      ctx.beginPath();
      ctx.arc(x + 19, y + 34, 11, 0, Math.PI * 2);
      ctx.fillStyle = rgba(sim.kindColor(n.kind), 0.14);
      ctx.fill();
      glyph(sim, n.kind, x + 19, y + 34, 13, sim.kindColor(n.kind));
      ctx.fillStyle = c.text;
      ctx.font = mono(sim, 11, 700);
      ctx.fillText(n.label, x + 35, y + 30);
      ctx.fillStyle = c.muted;
      ctx.font = mono(sim, 8, 500);
      ctx.fillText(n.sub || "", x + 35, y + 43);
      if (hot !== "idle") {
        ctx.beginPath();
        ctx.arc(x + w - 10, y + 10, 3, 0, Math.PI * 2);
        ctx.fillStyle = col;
        ctx.fill();
      }
    });
    packets(sim);
  }

  // 3. Physical route: a transit map with checkpoints and a tamper trail.
  function route(sim) {
    clear(sim);
    var ctx = sim.ctx, c = sim.colors;
    var active = activeSet(sim);
    var state = sim.steps[sim.step].nodes || {};
    var routeIds = ["factory", "transit", "depot", "device"];
    var routeNodes = routeIds.map(function (id) { return sim.byId[id]; }).filter(Boolean);

    ctx.strokeStyle = rgba(c.warn, 0.18);
    ctx.lineWidth = 1;
    for (var i = 1; i < 7; i++) {
      ctx.beginPath();
      ctx.moveTo(0, i * sim.cropH / 7);
      ctx.bezierCurveTo(W * .2, i * sim.cropH / 7 - 30, W * .7, i * sim.cropH / 7 + 30, W, i * sim.cropH / 7);
      ctx.stroke();
    }
    ctx.fillStyle = rgba(c.warn, 0.04);
    ctx.fillRect(2 * W / 100, 4 * H / 100, 92 * W / 100, 70 * H / 100);
    ctx.fillStyle = c.muted;
    ctx.font = mono(sim, 10, 700);
    ctx.fillText("PHYSICAL SUPPLY ROUTE · FACTORY → TRANSIT → SITE", 16, 40);

    if (routeNodes.length) {
      ctx.beginPath();
      routeNodes.forEach(function (n, i) {
        var p = sim.center(n);
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.strokeStyle = rgba(c.warn, 0.8);
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 8]);
      ctx.stroke();
      ctx.setLineDash([]);
      routeNodes.forEach(function (n, i) {
        var p = sim.center(n);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 16, 0, Math.PI * 2);
        ctx.fillStyle = rgba(c.warn, 0.12);
        ctx.fill();
        ctx.strokeStyle = rgba(c.warn, 0.75);
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = c.warn;
        ctx.font = mono(sim, 9, 800);
        ctx.textAlign = "center";
        ctx.fillText("0" + (i + 1), p.x, p.y + 3);
        ctx.textAlign = "left";
      });
    }

    sim.flows.forEach(function (f) {
      var a = sim.byId[f.from], b = sim.byId[f.to];
      if (!a || !b) return;
      if (routeIds.indexOf(f.to) !== -1 && routeIds.indexOf(f.from) !== -1) return;
      var ac = active[f.id];
      var col = ac ? c.bad : rgba(c.border2, 0.5);
      var pa = sim.center(a), pb = sim.center(b);
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.strokeStyle = col;
      ctx.lineWidth = ac ? 2 : 1;
      ctx.setLineDash(ac ? [] : [4, 6]);
      ctx.stroke();
      ctx.setLineDash([]);
    });

    sim.nodes.forEach(function (n) {
      var hot = state[n.id] || "idle";
      var col = stateColor(sim, hot);
      var x = n.x * W / 100, y = n.y * H / 100, w = n.w * W / 100, h = n.h * H / 100;
      ctx.fillStyle = rgba(c.panel, 0.96);
      rr(ctx, x, y, w, h, 10);
      ctx.fill();
      ctx.strokeStyle = hot === "idle" ? c.border2 : col;
      ctx.lineWidth = hot === "idle" ? 1 : 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x + 18, y + 18, 9, 0, Math.PI * 2);
      ctx.fillStyle = rgba(sim.kindColor(n.kind), 0.16);
      ctx.fill();
      ctx.strokeStyle = rgba(sim.kindColor(n.kind), 0.7);
      ctx.lineWidth = 1;
      ctx.stroke();
      glyph(sim, n.kind, x + 18, y + 18, 11, sim.kindColor(n.kind));
      ctx.fillStyle = c.text;
      ctx.font = sans(sim, 13, 700);
      ctx.fillText(n.label, x + 32, y + 20);
      ctx.fillStyle = c.muted;
      ctx.font = mono(sim, 9, 500);
      ctx.fillText(n.sub || "", x + 32, y + 35);
      if (hot !== "idle") {
        ctx.beginPath();
        ctx.arc(x + w - 10, y + 10, 3, 0, Math.PI * 2);
        ctx.fillStyle = col;
        ctx.fill();
      }
    });
    packets(sim);
  }

  window.ATKSimRenderers = {
    pipeline: pipeline,
    "process-tree": processTree,
    route: route,
    glyph: glyph
  };
})();
